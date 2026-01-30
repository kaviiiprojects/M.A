
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const logs = await prisma.smsLog.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' }
    });

    // Transform Decimal to number for JSON
    const safeLogs = logs.map(log => ({
      ...log,
      cost: log.cost ? parseFloat(log.cost.toString()) : 0
    }));

    return NextResponse.json(safeLogs);
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await prisma.smsLog.deleteMany({});
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to clear logs" }, { status: 500 });
  }
}
