// src/app/api/vehicles/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/vehicles/search?query=<search_term>
 * Searches for vehicles by numberPlate
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const searchQuery = url.searchParams.get("query");

    if (!searchQuery) {
      return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
    }

    const vehicles = await prisma.vehicle.findMany({
      where: {
        OR: [
          { customer: { name: { contains: searchQuery, mode: 'insensitive' } } },
          { customer: { phone: { contains: searchQuery, mode: 'insensitive' } } },
        ]
      },
      include: {
        customer: true,
      },
      take: 10
    });

    return NextResponse.json(vehicles, { status: 200 });

  } catch (err) {
    console.error("GET /api/vehicles/search error:", err);
    return NextResponse.json({ error: "Failed to search for vehicles" }, { status: 500 });
  }
}
