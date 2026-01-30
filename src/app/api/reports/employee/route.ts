import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fromZonedTime } from "date-fns-tz";

const SL_TIME_ZONE = "Asia/Colombo";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dateParam = url.searchParams.get("date"); // Expects YYYY-MM-DD

    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return NextResponse.json({ error: "Date parameter in YYYY-MM-DD format is required" }, { status: 400 });
    }

    // Parse dates
    // Correctly convert Sri Lanka Start/EndOfDay to UTC for DB Query
    const startString = `${dateParam}T00:00:00.000`;
    const endString = `${dateParam}T23:59:59.999`;

    // fromZonedTime takes a Local Time string and a TimeZone, and returns the absolute UTC Date
    const rangeStart = fromZonedTime(startString, SL_TIME_ZONE);
    const rangeEnd = fromZonedTime(endString, SL_TIME_ZONE);

    // 1. Fetch all Employees (usually small list)
    // 2. Fetch Invoices ONLY for this day with relations
    // 1. Fetch all Employees (usually small list)
    // 2. Fetch Invoices ONLY for this day with relations
    const [allEmployees, dailyInvoices] = await Promise.all([
      prisma.employee.findMany(),
      prisma.invoice.findMany({
        where: {
          date: {
            gte: rangeStart,
            lte: rangeEnd,
          },
        },
        include: {
          items: true,
          payments: true,
          customer: true,
          vehicle: true,
          employees: true, // Fetch multiple employees
        },
      }),
    ]);

    // Create a map of full invoices for preview dialog (keeping existing API contract)
    // Map Prisma result to EnrichedInvoice structure expected by the Dialog
    const invoiceMap = new Map(dailyInvoices.map(inv => {
      const enriched: any = {
        ...inv,
        // serialize Decimals
        subtotal: inv.subtotal.toNumber(),
        globalDiscountAmount: inv.globalDiscountAmount?.toNumber() ?? 0,
        total: inv.total.toNumber(),
        amountPaid: inv.amountPaid.toNumber(),
        balanceDue: inv.balanceDue.toNumber(),
        changeGiven: inv.changeGiven?.toNumber() ?? 0,
        items: inv.items.map(item => ({
          ...item,
          unitPrice: item.unitPrice.toNumber(),
          discount: item.discount.toNumber(),
          total: item.total.toNumber(),
        })),
        payments: inv.payments.map(p => ({
          ...p,
          amount: p.amount.toNumber()
        })),

        customerDetails: inv.customer,
        vehicleDetails: inv.vehicle,
        employeeDetails: inv.employees[0], // Pick first for dialog preview
        employees: inv.employees,
      };
      return [inv.id, enriched];
    }));

    // Group invoices by employee
    const jobsByEmployee: Record<string, {
      jobs: Array<{
        invoiceId: string;
        invoiceNumber: string;
        customerName: string;
        vehicleNumber: string;
        total: number;
      }>;
      totalEarnings: number
    }> = {};

    for (const invoice of dailyInvoices) {
      // Loop through ALL employees assigned to this invoice
      for (const emp of invoice.employees) {
        const employeeId = emp.id;

        if (!jobsByEmployee[employeeId]) {
          jobsByEmployee[employeeId] = {
            jobs: [],
            totalEarnings: 0,
          };
        }

        jobsByEmployee[employeeId].jobs.push({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          customerName: invoice.customer?.name || 'Unknown',
          vehicleNumber: invoice.vehicle?.model || 'N/A',
          total: invoice.total.toNumber(),
        });
        // accumulate totalEarnings
        jobsByEmployee[employeeId].totalEarnings += invoice.total.toNumber();
      }
    }

    // Format the final report
    const report = allEmployees.map(employee => {
      const employeeJobs = jobsByEmployee[employee.id] || { jobs: [], totalEarnings: 0 };
      // Round earnings
      const roundedEarnings = Math.round((employeeJobs.totalEarnings + Number.EPSILON) * 100) / 100;

      return {
        employeeId: employee.id,
        employeeName: employee.name,
        jobCount: employeeJobs.jobs.length,
        jobs: employeeJobs.jobs,
        totalEarnings: roundedEarnings,
      };
    }).sort((a, b) => b.jobCount - a.jobCount);

    return NextResponse.json({
      report,
      fullInvoices: Object.fromEntries(invoiceMap),
      date: dateParam
    }, { status: 200 });

  } catch (err: any) {
    console.error("GET /api/reports/employee error:", err);
    return NextResponse.json({ error: err.message || "Failed to generate employee report" }, { status: 500 });
  }
}

