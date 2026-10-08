export interface InitializePaymentRequest {
  businessId: string;
  orderId: string;
  amount: number; // in minor units (kobo for NGN) or major units
  currency: string;
  email: string;
  phoneNumber?: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

export interface InitializePaymentResponse {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface VerifyPaymentResponse {
  reference: string;
  status: 'success' | 'failed' | 'abandoned';
  amount: number;
  currency: string;
  paidAt?: Date;
  metadata?: Record<string, any>;
}

export interface PaymentWebhookEvent {
  event: string;
  data: {
    reference: string;
    amount: number;
    currency: string;
    status: string;
    paid_at?: string;
    metadata?: Record<string, any>;
    customer?: {
      email?: string;
      phone?: string;
    };
  };
}

export interface PaymentProvider {
  initializePayment(request: InitializePaymentRequest): Promise<InitializePaymentResponse>;
  verifyPayment(reference: string): Promise<VerifyPaymentResponse>;
  verifyWebhookSignature(
    rawBody: Buffer | string,
    signature: string,
    secret?: string,
  ): boolean;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
