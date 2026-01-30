// app/api/invoices/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { InvoiceStatus } from "@/generated";

const BATCH_SIZE = 50;

/**
 * GET /api/invoices
 * Returns paginated, enriched invoices using Prisma.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const cursor = url.searchParams.get("startAfter");
    const search = url.searchParams.get("search") || "";

    const where: any = {};
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { vehicle: { numberPlate: { contains: search, mode: "insensitive" } } },
      ];
    }

    const queryOptions = {
      take: BATCH_SIZE,
      orderBy: { date: 'desc' as const },
      where, // Apply filter
      include: {
        customer: true,
        vehicle: true,
        employees: true, // Fetch multiple employees
        items: true,
        payments: true,
      },
      skip: 0,
      cursor: undefined as { id: string } | undefined
    };

    if (cursor) {
      queryOptions.skip = 1;
      queryOptions.cursor = { id: cursor };
    }

    const invoices = await prisma.invoice.findMany(queryOptions);

    // Transform to match frontend expectations (flat structure with details)
    const enrichedInvoices = invoices.map(inv => ({
      ...inv,
      // Helper fields the frontend might expect from 'enrichInvoices'
      customerName: inv.customer.name,
      vehicleModel: inv.vehicle?.model || "N/A",
      employeeName: inv.employees[0]?.name || "N/A", // Backward compatibility: show first employee
      customerDetails: inv.customer,
      vehicleDetails: inv.vehicle,
      employeeDetails: inv.employees[0], // Backward compatibility
      employees: inv.employees, // New field
      // Convert Decimal to number for API consumers
      subtotal: Number(inv.subtotal),
      total: Number(inv.total),
      amountPaid: Number(inv.amountPaid),
      balanceDue: Number(inv.balanceDue),
    }));

    const lastVisibleId = invoices.length > 0 ? invoices[invoices.length - 1].id : null;
    const hasMore = invoices.length === BATCH_SIZE;

    return NextResponse.json({ invoices: enrichedInvoices, hasMore, lastVisibleId }, { status: 200 });

  } catch (err) {
    console.error("GET /api/invoices error:", err);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}

const paymentSchema = z.object({
  id: z.string().optional(),
  method: z.enum(['Cash', 'Card', 'Cheque']),
  amount: z.number().positive(),
  chequeNumber: z.string().optional(),
  bank: z.string().optional(),
});

const invoiceSchema = z.object({
  invoiceNumber: z.string(),
  customerId: z.string().optional(), // Optional now, can be resolved via phone
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  vehicleId: z.string().optional(),
  vehicleModel: z.string().optional(),
  employeeIds: z.array(z.string()).min(1, "At least one employee is required"),
  date: z.number(),
  items: z.array(z.object({
    itemId: z.string(),
    name: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
    discount: z.number(),
    total: z.number(),
    warrantyMonths: z.number().optional(),
  })),
  subtotal: z.number(),
  globalDiscountPercent: z.number(),
  globalDiscountAmount: z.number(),
  total: z.number(),
  paymentStatus: z.enum(['Paid', 'Partial', 'Unpaid']),
  payments: z.array(paymentSchema),
  amountPaid: z.number(),
  balanceDue: z.number(),
  changeGiven: z.number(),
});

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const validation = invoiceSchema.safeParse(payload);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const { items, payments, date, ...invoiceData } = validation.data;

    // Use interactive transaction to ensure atomicity
    const createdInvoice = await prisma.$transaction(async (tx) => {
      // 1. Resolve Customer
      let targetCustomerId = invoiceData.customerId;

      if (!targetCustomerId) {
        if (!invoiceData.customerPhone || !invoiceData.customerName) {
          throw new Error("Customer phone and name are required if ID is not provided");
        }

        // Try to find by phone
        const existingCustomer = await tx.customer.findUnique({
          where: { phone: invoiceData.customerPhone }
        });

        if (existingCustomer) {
          targetCustomerId = existingCustomer.id;
        } else {
          // Create new customer
          const newCustomer = await tx.customer.create({
            data: {
              name: invoiceData.customerName,
              phone: invoiceData.customerPhone
            }
          });
          targetCustomerId = newCustomer.id;
        }
      }

      // 2. Resolve Vehicle
      let targetVehicleId = invoiceData.vehicleId;

      if (!targetVehicleId && invoiceData.vehicleModel && targetCustomerId) {
        // Create new vehicle linked to customer
        // Check if similar exists? Requirement says "add again to prevent this... existing vehicle list also fetch".
        // But here if the frontend sent a model string instead of an ID, it implies a NEW vehicle or explicitly not selecting existing.
        // We will create a new one as requested for "New" flow.
        const newVehicle = await tx.vehicle.create({
          data: {
            model: invoiceData.vehicleModel,
            customerId: targetCustomerId
          }
        });
        targetVehicleId = newVehicle.id;
      }


      // Process items and calculate FIFO costs
      const processedItems: Array<{
        name: string;
        quantity: number;
        unitPrice: number;
        discount: number;
        total: number;
        itemId: string | null;
        warrantyMonths?: number;
        costPrice: number | null;
      }> = [];

      // Batch deduction updates to perform
      const batchUpdates: Array<{ batchId: string; deductQty: number }> = [];
      const productUpdates: Array<{ productId: string; quantityToDeduct: number }> = [];

      for (const item of items) {
        const isCustomItem = item.itemId.startsWith('custom-');
        let costPrice: number | null = null;

        if (!isCustomItem) {
          // Check if this is a product (has batches) or a service
          const product = await tx.product.findUnique({
            where: { id: item.itemId },
            include: {
              batches: {
                where: { quantity: { gt: 0 } },
                orderBy: { purchaseDate: 'asc' } // FIFO: oldest first
              }
            }
          });

          if (product) {
            // Verify sufficient stock (prevent negative stock)
            if (product.stock < item.quantity) {
              throw new Error(`Insufficient stock for product "${product.name}". Available: ${product.stock}, Required: ${item.quantity}`);
            }

            // FIFO Deduction - calculate from oldest batches first
            let remainingQty = item.quantity;
            let totalCost = 0;

            for (const batch of product.batches) {
              if (remainingQty <= 0) break;

              const deductQty = Math.min(batch.quantity, remainingQty);
              totalCost += deductQty * Number(batch.costPrice);
              remainingQty -= deductQty;

              // Queue batch update
              batchUpdates.push({ batchId: batch.id, deductQty });
            }

            // If batches didn't cover all quantity, use product's actualPrice for remainder
            if (remainingQty > 0) {
              totalCost += remainingQty * Number(product.actualPrice);
            }

            // Calculate weighted average cost per unit for this sale
            costPrice = totalCost / item.quantity;

            // Queue product stock update
            productUpdates.push({ productId: item.itemId, quantityToDeduct: item.quantity });
          }
        }

        processedItems.push({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          total: item.total,
          itemId: isCustomItem ? null : item.itemId,
          warrantyMonths: item.warrantyMonths,
          costPrice,
        });
      }

      // Create Invoice with processed Items and Payments
      if (!targetCustomerId) throw new Error("Failed to resolve customer ID");

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber: invoiceData.invoiceNumber,
          customerId: targetCustomerId,
          vehicleId: targetVehicleId, // Can be undefined (optional)
          // employeeId: invoiceData.employeeId, // REMOVED: Now using employees relation
          employees: {
            connect: invoiceData.employeeIds.map(id => ({ id }))
          },
          subtotal: invoiceData.subtotal,
          globalDiscountPercent: invoiceData.globalDiscountPercent,
          globalDiscountAmount: invoiceData.globalDiscountAmount,
          total: invoiceData.total,
          paymentStatus: invoiceData.paymentStatus,
          amountPaid: invoiceData.amountPaid,
          balanceDue: invoiceData.balanceDue,
          changeGiven: invoiceData.changeGiven,
          date: new Date(date),
          items: {
            create: processedItems
          },
          payments: {
            create: payments.map(p => ({
              method: p.method,
              amount: p.amount,
              chequeNumber: p.chequeNumber,
              bank: p.bank,
            }))
          }
        },
        include: { items: true, payments: true, customer: true, vehicle: true, employees: true }
      });

      // Apply FIFO batch deductions
      for (const update of batchUpdates) {
        await tx.inventoryBatch.update({
          where: { id: update.batchId },
          data: { quantity: { decrement: update.deductQty } }
        });
      }

      // Apply product stock deductions
      for (const update of productUpdates) {
        await tx.product.update({
          where: { id: update.productId },
          data: { stock: { decrement: update.quantityToDeduct } }
        });
      }

      // Update Vehicle Last Visit if vehicle exists
      if (targetVehicleId) {
        await tx.vehicle.update({
          where: { id: targetVehicleId },
          data: { lastVisit: new Date(date) }
        });
      }

      return invoice;
    }, { maxWait: 5000, timeout: 20000 });

    return NextResponse.json(createdInvoice, { status: 201 });

  } catch (err: any) {
    console.error("POST /api/invoices error:", err);
    // Return 400 for insufficient stock (logic error), 500 for others
    const status = err.message.includes("Insufficient stock") ? 400 : 500;
    return NextResponse.json({ error: err.message || "Failed to create invoice" }, { status });
  }
}

const addPaymentSchema = z.object({
  invoiceId: z.string(),
  newPayments: z.array(paymentSchema).nonempty(),
});

export async function PUT(req: NextRequest) {
  try {
    const payload = await req.json();
    const validation = addPaymentSchema.safeParse(payload);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const { invoiceId, newPayments } = validation.data;

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true }
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Calculate new totals
    const existingPaid = Number(existingInvoice.amountPaid);
    const newPaidAmount = newPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalAmountPaid = existingPaid + newPaidAmount;
    const total = Number(existingInvoice.total);

    let newBalanceDue = total - totalAmountPaid;
    let newPaymentStatus: InvoiceStatus = 'Partial';
    let changeGiven = 0;

    if (newBalanceDue <= 0) {
      changeGiven = Math.abs(newBalanceDue);
      newBalanceDue = 0;
      newPaymentStatus = 'Paid';
    }

    // Update Invoice transactionally
    const result = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paymentStatus: newPaymentStatus,
        amountPaid: totalAmountPaid,
        balanceDue: newBalanceDue,
        changeGiven: (Number(existingInvoice.changeGiven) || 0) + changeGiven,
        payments: {
          create: newPayments.map(p => ({
            method: p.method,
            amount: p.amount,
            chequeNumber: p.chequeNumber,
            bank: p.bank,
          }))
        }
      },
      include: { payments: true }
    });

    return NextResponse.json(result, { status: 200 });

  } catch (err) {
    console.error("PUT /api/invoices error:", err);
    return NextResponse.json({ error: "Failed to update invoice payment" }, { status: 500 });
  }
}