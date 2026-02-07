
import { NextRequest, NextResponse } from "next/server";
import { dialogSms } from "@/lib/sms";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mobile, message, fromFlow, recipients, saveToHistory = true } = body;

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // BULK MODE
    if (recipients && Array.isArray(recipients) && recipients.length > 0) {
      const result = await dialogSms.sendBulkSms(recipients, message, fromFlow || "Bulk Campaign");
      return NextResponse.json({ success: true, data: result });
    }

    // SINGLE MODE
    if (mobile) {
      const result = await dialogSms.sendSms(mobile, message, fromFlow || "Direct Send", saveToHistory);

      if (result.success) {
        return NextResponse.json({ success: true, data: result.log });
      } else {
        return NextResponse.json({ success: false, error: "Failed to send SMS via gateway" }, { status: 502 });
      }
    }

    return NextResponse.json({ error: "Mobile number or recipients list required" }, { status: 400 });
  } catch (error: any) {
    console.error("POST /api/sms/send error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
