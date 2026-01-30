// app/api/inventory-batches/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/**
 * POST /api/inventory-batches
 * Add stock to a product by creating a new inventory batch (FIFO)
 */
const addStockSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
  costPrice: z.number().positive("Cost price must be positive"),
});

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const validation = addStockSchema.safeParse(payload);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { productId, quantity, costPrice } = validation.data;

    // Verify product exists first
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Create new inventory batch
    const batch = await prisma.inventoryBatch.create({
      data: {
        productId,
        quantity,
        initialQuantity: quantity,
        costPrice,
      },
    });

    // Update product total stock
    await prisma.product.update({
      where: { id: productId },
      data: { stock: { increment: quantity } },
    });

    return NextResponse.json(batch, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/inventory-batches error:", err);
    return NextResponse.json(
      { error: "Failed to add stock batch" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/inventory-batches?productId=<id>
 * Get all batches for a product (with quantity > 0)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { error: "productId query param required" },
        { status: 400 }
      );
    }

    const batches = await prisma.inventoryBatch.findMany({
      where: {
        productId,
        quantity: { gt: 0 }, // Only non-empty batches for performance
      },
      orderBy: { purchaseDate: "asc" }, // FIFO order
    });

    return NextResponse.json(batches, { status: 200 });
  } catch (err) {
    console.error("GET /api/inventory-batches error:", err);
    return NextResponse.json(
      { error: "Failed to fetch batches" },
      { status: 500 }
    );
  }
}
