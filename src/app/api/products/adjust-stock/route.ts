// app/api/products/adjust-stock/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const adjustmentSchema = z.object({
  productId: z.string().min(1),
  action: z.enum(['decrement', 'delete']),
  quantity: z.number().int().optional(),
  reason: z.string().min(10),
});

/**
 * POST /api/products/adjust-stock
 * Body: { productId, action, quantity?, reason }
 * Performs a stock adjustment (decrement or delete) and logs the action.
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const validation = adjustmentSchema.safeParse(payload);

    if (!validation.success) {
      return NextResponse.json({ error: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    // Explicit narrowing
    const { productId, action, quantity, reason } = validation.data;

    await prisma.$transaction(async (tx: any) => {
      // 1. Fetch the product
      const product = await tx.product.findUnique({ where: { id: productId } });
      if (!product) {
        throw new Error("Product not found");
      }

      // 2. Perform the requested action
      if (action === 'decrement') {
        if (quantity === undefined || quantity <= 0) {
          throw new Error("A positive quantity is required for decrement.");
        }
        if (product.stock < quantity) {
          throw new Error("Adjustment quantity cannot be greater than current stock.");
        }
        await tx.product.update({
          where: { id: productId },
          data: { stock: { decrement: quantity } }
        });
      } else if (action === 'delete') {
        await tx.product.delete({ where: { id: productId } });
      }

      // 3. Create the log entry
      await tx.stockAdjustmentLog.create({
        data: {
          productId,
          productName: product.name,
          action: action,
          reason,
          quantity: action === 'decrement' ? quantity : null,
          date: new Date()
        }
      });
    });

    return NextResponse.json({ success: true, message: `Action '${action}' performed.` }, { status: 200 });

  } catch (err: any) {
    console.error("POST /api/products/adjust-stock error:", err);
    // Determine status code based on error message roughly
    let status = 500;
    if (err.message === "Product not found") status = 404;
    else if (err.message.includes("quantity")) status = 400;

    return NextResponse.json({ error: err.message || "Failed to perform stock adjustment." }, { status });
  }
}
