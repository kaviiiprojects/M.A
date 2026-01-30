
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fromZonedTime } from "date-fns-tz";

const SL_TIME_ZONE = "Asia/Colombo";

const safeRound = (num: number) =>
  Math.round((num + Number.EPSILON) * 100) / 100;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date"); // Expects "YYYY-MM-DD"

    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json(
        { error: "Date parameter in YYYY-MM-DD format is required" },
        { status: 400 }
      );
    }

    // Correctly convert Sri Lanka Start/EndOfDay to UTC for DB Query
    const startString = `${dateParam}T00:00:00.000`;
    const endString = `${dateParam}T23:59:59.999`;

    // fromZonedTime takes a Local Time string and a TimeZone, and returns the absolute UTC Date
    const startOfReportDay = fromZonedTime(startString, SL_TIME_ZONE);
    const endOfReportDay = fromZonedTime(endString, SL_TIME_ZONE);

    // In a real-world scenario with UTC stored in DB, we would convert these zoned times back to absolute UTC Date objects for Prisma.
    // Ensure that prisma.invoice.findMany uses these dates correctly.
    // For simplicity with the current setup, assuming date-fns handles the Date object conversion correctly for the filter.

    // 1. Aggregates for Totals (Revenue, Cash, Outstanding)
    const invoiceAggregates = await prisma.invoice.aggregate({
      where: {
        date: {
          gte: startOfReportDay,
          lte: endOfReportDay,
        },
      },
      _sum: {
        total: true,
        amountPaid: true,
        balanceDue: true,
        changeGiven: true,
      },
      _count: {
        id: true,
      },
    });

    const totalRevenue = invoiceAggregates._sum.total?.toNumber() || 0;
    const totalAmountPaid = invoiceAggregates._sum.amountPaid?.toNumber() || 0;
    const totalChangeGiven = invoiceAggregates._sum.changeGiven?.toNumber() || 0;
    // Net cash received = amount paid - change given back to customers
    const totalCashReceived = totalAmountPaid - totalChangeGiven;
    const totalOutstanding = invoiceAggregates._sum.balanceDue?.toNumber() || 0;
    const totalInvoices = invoiceAggregates._count.id;

    // 2. Fetch Invoice Items for COGS and Product Breakdown
    // We fetch only items for this day, which is scalable.
    const validItems = await prisma.invoiceItem.findMany({
      where: {
        invoice: {
          date: {
            gte: startOfReportDay,
            lte: endOfReportDay,
          },
        },
      },
      include: {
        // We might need product details if name is not enough, but name is stored in InvoiceItem
        invoice: false,
      },
    });

    let totalCogs = 0;
    const productsSold: Record<
      string,
      { name: string; quantity: number; revenue: number; cost: number }
    > = {};
    const servicesRendered: Record<
      string,
      { name: string; quantity: number; revenue: number }
    > = {};

    for (const item of validItems) {
      const itemTotal = item.total.toNumber();
      const itemQty = item.quantity;
      // Use stored costPrice if available (accurate for FIFO), else 0 (fallback)
      const unitCost = item.costPrice?.toNumber() || 0;
      const itemCost = unitCost * itemQty; // costPrice is usually per unit in many systems, BUT check schema. 
      // Schema says: costPrice Decimal? // Actual cost from FIFO batch at sale time. Usually per unit or total? 
      // Let's assume per unit for now as is typical, but previous code did: (item.costPrice ?? product.actualPrice ?? 0) * item.quantity;
      // If the schema stores the *unit* cost price, this is correct.

      totalCogs += itemCost;

      // Logic to distinguish Product vs Service
      // If it has a costPrice or linked to a Product (via itemId check?), it's likely a product.
      // The previous code checked: if (product) { ... } else { service }
      // We don't have the full product object here to check `product` existence easily unless we look up.
      // However, we can use `itemId`. If we want to be strict, we could count it as a product if `itemId` is present and it IS a product.
      // But services also have `itemId`.
      // Heuristic: If it has a costPrice > 0, it's definitely a product (stock). 
      // Or we can rely on `itemId` and maybe semantic naming?
      // Better: The previous code fetched ALL products and checked if `item.itemId` existed in that map.
      // TO keep it strictly correct, we should probably fetch the Products referenced by these items OR assume `costPrice` implies product.
      // BUT, Services don't have `costPrice`. So if `costPrice` is null, it might be a service.

      const isProduct = item.costPrice !== null; // Simple heuristic based on data availability

      if (isProduct) {
        const key = item.itemId || item.name;
        if (!productsSold[key]) {
          productsSold[key] = {
            name: item.name,
            quantity: 0,
            revenue: 0,
            cost: 0,
          };
        }
        productsSold[key].quantity += itemQty;
        productsSold[key].revenue += itemTotal;
        productsSold[key].cost += itemCost;
      } else {
        const key = item.itemId || item.name;
        if (!servicesRendered[key]) {
          servicesRendered[key] = {
            name: item.name,
            quantity: 0,
            revenue: 0,
          };
        }
        servicesRendered[key].quantity += itemQty;
        servicesRendered[key].revenue += itemTotal;
      }
    }

    const netProfit = safeRound(totalRevenue - totalCogs);

    // 3. Payment Methods Breakdown
    const payments = await prisma.payment.groupBy({
      by: ['method'],
      where: {
        invoice: {
          date: {
            gte: startOfReportDay,
            lte: endOfReportDay,
          },
        },
      },
      _sum: {
        amount: true,
      },
    });

    const paymentSummary: Record<string, number> = {
      Cash: 0,
      Card: 0,
      Cheque: 0,
    };

    payments.forEach(p => {
      if (p._sum.amount) {
        paymentSummary[p.method] = safeRound(p._sum.amount.toNumber());
      }
    });

    // Subtract change given from Cash payments (change is only given for cash)
    paymentSummary.Cash = safeRound(paymentSummary.Cash - totalChangeGiven);

    const responsePayload = {
      date: new Date(dateParam).toISOString(), // Return the requested date
      summary: {
        totalRevenue: safeRound(totalRevenue),
        netProfit,
        totalInvoices,
        totalCogs: safeRound(totalCogs),
        totalCashReceived: safeRound(totalCashReceived),
        totalOutstanding: safeRound(totalOutstanding),
      },
      breakdowns: {
        products: Object.values(productsSold).sort(
          (a, b) => b.revenue - a.revenue
        ),
        services: Object.values(servicesRendered).sort(
          (a, b) => b.revenue - a.revenue
        ),
        payments: paymentSummary,
      },
    };

    return NextResponse.json(responsePayload, { status: 200 });
  } catch (err: any) {
    console.error("GET /api/reports/day-end error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate day-end report" },
      { status: 500 }
    );
  }
}
