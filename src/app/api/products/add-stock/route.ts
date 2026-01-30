// app/api/products/add-stock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const addStockSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z.number().int().gt(0, "Quantity must be a positive integer"),
});

/**
 * POST /api/products/add-stock
 * Body: { productId: string, quantity: number }
 * Atomically increments the stock of a product and logs the addition.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const validation = addStockSchema.safeParse(payload);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    // Explicit narrowing by returning above, but access data safely
    const { productId, quantity } = validation.data;

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx: any) => {
      // First check if product exists
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw new Error("Product not found");
      }

      // Use atomic increment
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: quantity } }
      });

      // Create a log entry for the stock addition
      await tx.stockAdjustmentLog.create({
        data: {
          productId,
          productName: product.name,
          action: 'add',
          quantity,
          reason: 'Manual stock addition via "Add Stock" feature.',
          date: new Date()
        }
      });

      return updatedProduct;
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/products/add-stock error:", err);
    const message = err.message === "Product not found" ? "Product not found" : "Failed to update stock";
    const status = err.message === "Product not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
