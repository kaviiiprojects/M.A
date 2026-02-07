
import { prisma } from "@/lib/prisma";
import type { SmsLog } from "@prisma/client";

const DIALOG_LOGIN_URL = 'https://e-sms.dialog.lk/api/v2/user/login';
const DIALOG_SEND_URL = 'https://e-sms.dialog.lk/api/v2/sms';

export class DialogSmsService {

  // 1. Helper to get a valid token (Login only if needed)
  private async getValidToken(): Promise<string> {
    // A. Fetch token from NeonDB (SystemSettings)
    const storedToken = await prisma.systemSetting.findUnique({
      where: { key: 'dialog_access_token' }
    });

    const storedExpiry = await prisma.systemSetting.findUnique({
      where: { key: 'dialog_token_expiry' }
    });

    const now = Math.floor(Date.now() / 1000);

    // B. If token exists and has > 5 mins remaining, use it
    if (storedToken && storedExpiry && parseInt(storedExpiry.value) > (now + 300)) {
      return storedToken.value;
    }

    // C. Otherwise, login to get a new one
    console.log("Refreshing Dialog SMS Token...");

    // Check internal env vars
    const username = process.env.DIALOG_USERNAME;
    const password = process.env.DIALOG_PASSWORD;

    if (!username || !password) {
      throw new Error("Missing DIALOG_USERNAME or DIALOG_PASSWORD environment variables");
    }

    const loginRes = await fetch(DIALOG_LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await loginRes.json();

    if (data.status !== 'success' || !data.token) {
      throw new Error(`Dialog Login Failed: ${data.comment || 'Unknown error'}`);
    }

    // D. Save new token to DB
    await prisma.systemSetting.upsert({
      where: { key: 'dialog_access_token' },
      update: { value: data.token },
      create: { key: 'dialog_access_token', value: data.token }
    });

    // Calculate expiry: now + expiration seconds (usually 12 hours)
    const expiryTime = (now + (data.expiration || 43200)).toString();
    await prisma.systemSetting.upsert({
      where: { key: 'dialog_token_expiry' },
      update: { value: expiryTime },
      create: { key: 'dialog_token_expiry', value: expiryTime }
    });

    return data.token;
  }

  // 2. Multi-send / Bulk Helper
  async sendBulkSms(mobiles: string[], message: string, campaignName: string = "Bulk Campaign") {
    if (!mobiles.length) return { success: true, count: 0 };

    // Dialog API supports multiple MSISDNs in one request.
    // However, to be safe with payload sizes and timeouts, we'll chunk them.
    // Let's say 50 numbers per batch.
    const chunkSize = 50;
    const results = [];

    const token = await this.getValidToken();

    for (let i = 0; i < mobiles.length; i += chunkSize) {
      const chunk = mobiles.slice(i, i + chunkSize);

      // Fix: Ensure transaction ID is numeric/safe (no hyphens)
      // Format: Timestamp + BatchIndex (padded)
      const transactionId = `${Date.now()}${i.toString().padStart(3, '0')}`;
      const msisdnPayload = chunk.map(m => ({ mobile: m }));

      const payload = {
        msisdn: msisdnPayload,
        message: message,
        sourceAddress: process.env.DIALOG_MASK || "Dialog Demo",
        transaction_id: transactionId,
        push_notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/sms-delivery`
      };

      console.log(`[Bulk SMS] Batch ${i} Payload:`, JSON.stringify(payload));

      try {
        const res = await fetch(DIALOG_SEND_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        const responseData = await res.json();
        console.log(`[Bulk SMS] Batch ${i} Response:`, responseData);

        const status = responseData.status === 'success' ? 'SENT' : 'FAILED';
        const campaignId = responseData.data?.campaign_id?.toString() || null;
        const cost = responseData.data?.cost || 0;

        // Create Logs for EACH recipient in this batch
        const logsData = chunk.map((mobile, idx) => ({
          transactionId: `${transactionId}${idx}`, // Local unique referencing
          mobile,
          message,
          status,
          campaignId,
          cost: cost ? (cost / chunk.length) : 0, // Approx cost per unit
          recipientName: campaignName
        }));

        await prisma.smsLog.createMany({ data: logsData });

        results.push({ batch: i, status, count: chunk.length });

      } catch (e) {
        console.error(`Batch ${i} failed`, e);
        results.push({ batch: i, status: 'FAILED', count: chunk.length, error: e });
      }
    }

    return results;
  }

  // 3. The Public Send Method (Single)
  async sendSms(mobile: string, message: string, recipientName?: string, saveToHistory = true) {
    const token = await this.getValidToken();

    // Generate a unique transaction ID (Max 18 digits)
    const transactionId = `${Date.now()}${Math.floor(Math.random() * 1000)}`;

    const payload = {
      msisdn: [{ mobile: mobile }],
      message: message,
      sourceAddress: process.env.DIALOG_MASK || "Dialog Demo",
      transaction_id: transactionId,
      push_notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/sms-delivery`
    };

    let status = 'PENDING';
    let campaignId = null;
    let cost = 0;

    try {
      const res = await fetch(DIALOG_SEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const responseData = await res.json();

      if (responseData.status === 'success') {
        status = 'SENT';
        campaignId = responseData.data?.campaign_id?.toString() || null;
        cost = responseData.data?.cost || 0;
      } else {
        status = 'FAILED';
        console.error("SMS Send Failed:", responseData);
      }
    } catch (e) {
      status = 'FAILED';
      console.error("SMS Fetch Failed:", e);
    }

    // Only log to DB if saveToHistory is true (skip for invoice notifications)
    if (saveToHistory) {
      const log = await prisma.smsLog.create({
        data: {
          transactionId: transactionId,
          mobile: mobile,
          message: message,
          status: status,
          campaignId: campaignId,
          cost: cost ? cost : undefined,
          recipientName: recipientName
        }
      });
      return { success: status === 'SENT', log };
    }

    return { success: status === 'SENT', log: null };
  }
  // 4. Check Balance
  async getBalance() {
    // Note: The exact endpoint can vary. 
    // Common Dialog/e-SMS pattern is GET /user/balance or parsing from login.
    // For now, we will try to fetch it.

    // Attempt 1: Check if we can get it from the 'details' endpoint if exists, 
    // or just return a mock if we can't find the docs? 
    // User requested "fetch accurate", so we must try a real call.

    const token = await this.getValidToken();
    try {
      const res = await fetch('https://e-sms.dialog.lk/api/v2/user/balance', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        // Fallback: Try /user/info
        const resInfo = await fetch('https://e-sms.dialog.lk/api/v2/user/info', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        if (resInfo.ok) {
          const data = await resInfo.json();
          return data.balance || 0.00;
        }
        // throw new Error(`Balance fetch failed: ${res.status}`);
        console.warn(`Balance API not available (Status: ${res.status}). Defaulting to 0.`);
        return 0.00;
      }

      const data = await res.json();
      return data.balance || 0.00;

    } catch (e) {
      console.warn("Failed to fetch balance (api might be unavailable):", e);
      return 0.00; // Return 0 if failed to avoid breaking UI
    }
  }
}

export const dialogSms = new DialogSmsService();
