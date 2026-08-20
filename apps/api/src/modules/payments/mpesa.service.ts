import { Injectable, Logger } from '@nestjs/common';

interface StkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
}

@Injectable()
export class MpesaService {
  private readonly logger = new Logger(MpesaService.name);
  private cachedToken: { value: string; expiresAt: number } | null = null;

  private get baseUrl() {
    return process.env.MPESA_ENV === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  /// OAuth tokens last ~1 hour. Cached in memory and only refreshed once
  /// actually close to expiring, rather than fetching a new one per request.
  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.value;
    }

    const consumerKey = process.env.MPESA_CONSUMER_KEY!;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET!;
    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    const res = await fetch(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${credentials}` }
    });

    if (!res.ok) {
      throw new Error(`Failed to get M-Pesa access token: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as { access_token: string; expires_in: string };
    this.cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000 // refresh a minute early
    };
    return this.cachedToken.value;
  }

  private buildPassword(timestamp: string): string {
    const shortcode = process.env.MPESA_SHORTCODE!;
    const passkey = process.env.MPESA_PASSKEY!;
    return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  }

  private timestamp(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      now.getFullYear().toString() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds())
    );
  }

  /// Initiates the STK push — the customer's phone gets the PIN prompt
  /// within a few seconds if this succeeds. IMPORTANT: a successful
  /// response here only means "M-Pesa accepted the request," NOT "the
  /// payment succeeded." That answer only arrives later, asynchronously,
  /// via the callback registered as CallBackURL below.
  async initiateStkPush(params: {
    phoneNumber: string;
    amount: number;
    accountReference: string;
    transactionDesc: string;
  }): Promise<StkPushResult> {
    const token = await this.getAccessToken();
    const ts = this.timestamp();
    const shortcode = process.env.MPESA_SHORTCODE!;

    const res = await fetch(`${this.baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: this.buildPassword(ts),
        Timestamp: ts,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(params.amount),
        PartyA: params.phoneNumber,
        PartyB: shortcode,
        PhoneNumber: params.phoneNumber,
        CallBackURL: process.env.MPESA_CALLBACK_URL!,
        AccountReference: params.accountReference.slice(0, 12), // Daraja caps this field
        TransactionDesc: params.transactionDesc
      })
    });

    const data = await res.json();

    if (!res.ok || data.ResponseCode !== '0') {
      this.logger.error(`STK push rejected: ${JSON.stringify(data)}`);
      throw new Error(data.errorMessage || data.ResponseDescription || 'STK push request failed');
    }

    return {
      merchantRequestId: data.MerchantRequestID,
      checkoutRequestId: data.CheckoutRequestID,
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription
    };
  }
}
