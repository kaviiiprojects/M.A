
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Dialog calls this URL via GET
// Format: ?campaignId=123&status=1
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const campaignId = searchParams.get('campaignId');
  const status = searchParams.get('status'); // 1=Submitted, 3=Delivered, 4=Failed

  if (campaignId && status) {
    let statusText = 'UNKNOWN';
    if (status === '1') statusText = 'SUBMITTED';
    if (status === '3') statusText = 'DELIVERED';
    if (status === '4') statusText = 'FAILED';

    console.log(`Webhook: Campaign ${campaignId} is ${statusText}`);

    // Update the log based on campaign ID
    // We search by campaignId (which might not be unique globally but unique for a time window, assume unique for now)
    // Need to findMany and update because campaignId is not unique in schema (we made transactionId unique)
    // However, campaignId should be enough to identify the batch.

    try {
      await prisma.smsLog.updateMany({
        where: { campaignId: campaignId },
        data: { status: statusText }
      });
    } catch (e) {
      console.error("Webhook Update Failed", e);
    }
  }

  return NextResponse.json({ received: true });
}
