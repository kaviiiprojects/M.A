// app/api/customers/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const customerSchema = z.object({
  name: z.string().min(1, 'Full Name is required'),
  phone: z.string().regex(/^\d{10}$/, 'Phone number must be exactly 10 digits and contain only numbers'),
});


/**
 * GET /api/customers
 * Returns array of customers
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const phone = url.searchParams.get("phone");
    const limit = url.searchParams.get("limit");
    const search = url.searchParams.get("search");

    if (phone) {
      const customer = await prisma.customer.findUnique({
        where: { phone },
        include: { vehicles: true }
      });
      return NextResponse.json(customer ? [customer] : [], { status: 200 });
    }

    // Filter/Search Logic
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      take: limit ? parseInt(limit) : undefined,
      orderBy: { updatedAt: 'desc' }, // Recent first
    });

    return NextResponse.json(customers, { status: 200 });
  } catch (err) {
    console.error("GET /api/customers error:", err);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

/**
 * POST /api/customers
 * Body: JSON customer object (without id)
 * Creates a customer and returns created object
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const validation = customerSchema.safeParse(payload);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    // Check for existing customer with same phone
    const existing = await prisma.customer.findUnique({
      where: { phone: validation.data.phone }
    });

    if (existing) {
      return NextResponse.json({ error: "Customer with this mobile number already exists." }, { status: 409 });
    }

    const created = await db.create("customers", validation.data);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    console.error("POST /api/customers error:", err);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}


/**
 * PUT /api/customers
 * Body: { id: string, ...customerData }
 * Updates an existing customer
 */
export async function PUT(req: NextRequest) {
  try {
    const payload = await req.json();
    const { id, ...data } = payload;

    if (!id) {
      return NextResponse.json({ error: "ID is required for update" }, { status: 400 });
    }

    const validation = customerSchema.safeParse(data);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const updated = await db.update("customers", id, validation.data);
    return NextResponse.json(updated, { status: 200 });

  } catch (err) {
    console.error("PUT /api/customers error:", err);
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
  }
}


/**
 * DELETE /api/customers?id=<id>
 * Deletes a customer by their ID.
 */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id query param required" }, { status: 400 });
    }

    // Perform cascading delete in a transaction
    // 1. Delete all vehicles associated with this customer
    // 2. Delete the customer
    // Note: If Invoices exist for this customer or their vehicles, this might still fail 
    // unless we decide to delete Invoices too (which is usually not desired for financial records).

    await prisma.$transaction(async (tx) => {
      // Check for invoices first to give a clear error
      const invoiceCount = await tx.invoice.count({
        where: { customerId: id }
      });

      if (invoiceCount > 0) {
        throw new Error("Cannot delete customer with existing invoices. Please delete the invoices first.");
      }

      await tx.vehicle.deleteMany({
        where: { customerId: id }
      });

      await tx.customer.delete({
        where: { id }
      });
    });

    return NextResponse.json({ success: true, id }, { status: 200 });

  } catch (err: any) {
    console.error("DELETE /api/customers error:", err);

    // meaningful error message
    const message = err.message || "Failed to delete customer";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
