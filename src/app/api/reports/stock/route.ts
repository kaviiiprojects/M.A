import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fromZonedTime } from "date-fns-tz";

const SL_TIME_ZONE = "Asia/Colombo";

export type StockReportItem = {
  productId: string;
  productName: string;
  stockIn: number;
  stockOut: number;
  currentStock: number;
};

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");

    if (!startDateParam || !endDateParam) {
      return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
    }

    const startString = `${startDateParam}T00:00:00.000`;
    const endString = `${endDateParam}T23:59:59.999`;

    const rangeStart = fromZonedTime(startString, SL_TIME_ZONE);
    const rangeEnd = fromZonedTime(endString, SL_TIME_ZONE);

    // 1. Fetch Aggregated Stock In (from Inventory Batches created/purchased in range)
    // Note: This relies on 'initialQuantity' which was recently added. Old batches will have 0.
    const stockInAgg = await prisma.inventoryBatch.groupBy({
      by: ['productId'],
      where: {
        purchaseDate: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      _sum: {
        initialQuantity: true,
      },
    });

    // 2. Fetch Aggregated Stock Sales (from Invoice Items in range)
    // We need to filter by invoice date, which requires a join, but groupBy doesn't support deep relation filtering easily in all adapters.
    // However, Prisma supports it. But 'itemId' is on InvoiceItem.
    // We can't use groupBy on InvoiceItem with a where clause on Invoice relation in a simple way if we want to be strict.
    // Actually, prisma.invoiceItem.groupBy allows `where: { invoice: { ... } }`.
    const stockOutAgg = await prisma.invoiceItem.groupBy({
      by: ['itemId'],
      where: {
        itemId: { not: null }, // Only products
        invoice: {
          date: {
            gte: rangeStart,
            lte: rangeEnd,
          },
        },
      },
      _sum: {
        quantity: true,
      },
    });

    // 3. Fetch All Products (to get names and current stock)
    // Optimization: limit to products involved? Or show all?
    // Report usually shows all active products.
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        stock: true,
      },
      orderBy: { name: 'asc' }
    });

    // 4. Map and Merge
    const stockInMap = new Map(stockInAgg.map(i => [i.productId, i._sum.initialQuantity || 0]));
    const stockOutMap = new Map(stockOutAgg.map(i => [i.itemId!, i._sum.quantity || 0]));

    const report: StockReportItem[] = products.map(p => {
      const stockIn = stockInMap.get(p.id) || 0;
      const stockOut = stockOutMap.get(p.id) || 0;
      // Only include if there is some activity or stock?
      // Or show all. Let's show all for now, or maybe filter out if 0, 0, 0?
      // User said "how many products added removed and still available", implies products in the library.

      return {
        productId: p.id,
        productName: p.name,
        stockIn,
        stockOut,
        currentStock: p.stock
      };
    }).filter(item => item.stockIn > 0 || item.stockOut > 0 || item.currentStock > 0);
    // Filter out completely dead items (no stock, no movement) to keep report clean.

    return NextResponse.json(report, { status: 200 });

  } catch (err: any) {
    console.error("GET /api/reports/stock error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate stock report" }, { status: 500 });
  }
}
