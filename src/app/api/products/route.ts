import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/products
 * Query Params:
 * - page: number (default 1)
 * - limit: number (default 50)
 * - search: string (optional, searches name, sku, barcode)
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const search = url.searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' }, // or name: 'asc'
        include: { batches: true }, // Optional: include batch info if needed
      }),
      prisma.product.count({ where }),
    ]);

    // Transform Decimal to number for API
    const transformedProducts = products.map(p => ({
      ...p,
      actualPrice: p.actualPrice.toNumber(),
      sellingPrice: p.sellingPrice.toNumber(),
    }));

    return NextResponse.json({
      products: transformedProducts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }, { status: 200 });

  } catch (err) {
    console.error("GET /api/products error:", err);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

/**
 * POST /api/products
 * Body: JSON product object (without id)
 * Creates a product and returns created object
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    // Basic validation
    if (!payload.name || typeof payload.name !== "string") {
      return NextResponse.json({ error: "`name` is required" }, { status: 400 });
    }

    const dataToCreate = {
      name: payload.name,
      sku: payload.sku || null, // Ensure SKU is unique in schema, handle error if duplicate (nulls allowed)
      description: payload.description,
      stock: payload.stock || 0,
      stockThreshold: payload.stockThreshold || 0,
      actualPrice: payload.actualPrice || 0,
      sellingPrice: payload.sellingPrice || 0,
      barcode: payload.barcode || `885${Date.now().toString().slice(-9)}`,
      warrantyMonths: payload.warrantyMonths,
    };

    const created = await prisma.product.create({
      data: dataToCreate,
    });

    // Create initial inventory batch if stock > 0? 
    // Usually initial stock creation implies a batch. 
    // For now, simple create. Backend logic for creating batch on product creation can be added if needed,
    // but typical flow is Product Create -> Stock Add.
    // If we assume initial stock is a "gift", we should create a batch.
    if (dataToCreate.stock > 0) {
      await prisma.inventoryBatch.create({
        data: {
          productId: created.id,
          quantity: dataToCreate.stock,
          initialQuantity: dataToCreate.stock,
          costPrice: dataToCreate.actualPrice,
        }
      });
    }

    return NextResponse.json({
      ...created,
      actualPrice: created.actualPrice.toNumber(),
      sellingPrice: created.sellingPrice.toNumber(),
    }, { status: 201 });
  } catch (err: any) {
    console.error("POST /api/products error:", err);
    // Handle Unique constraint violation
    if (err.code === 'P2002') {
      return NextResponse.json({ error: "Product with this SKU or Barcode already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}

/**
 * PUT /api/products
 * Body: { id: string, ...fieldsToUpdate }
 * Updates an existing product (partial allowed)
 */
export async function PUT(req: NextRequest) {
  try {
    const payload = await req.json();
    if (!payload || typeof payload !== "object" || !payload.id) {
      return NextResponse.json({ error: "Invalid payload: id required" }, { status: 400 });
    }
    const { id, ...fields } = payload;

    // Filter out fields that shouldn't be updated directly like 'stock' (should be via transaction)
    // For now, allow direct update but warn or restrict if needed.

    // Handle empty SKU -> null to avoid unique constraint violation on empty strings
    if (typeof fields.sku === 'string' && fields.sku.trim() === '') {
      fields.sku = null;
    }

    const updated = await prisma.product.update({
      where: { id },
      data: fields,
    });

    return NextResponse.json({
      ...updated,
      actualPrice: updated.actualPrice.toNumber(),
      sellingPrice: updated.sellingPrice.toNumber(),
    }, { status: 200 });
  } catch (err: any) {
    console.error("PUT /api/products error:", err);
    if (err.code === 'P2002') {
      return NextResponse.json({ error: "Product with this SKU or Barcode already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

/**
 * DELETE /api/products?id=<id>
 */
export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id query param required" }, { status: 400 });

    await prisma.product.delete({
      where: { id }
    });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE /api/products error:", err);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
