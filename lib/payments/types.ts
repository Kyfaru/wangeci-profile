/**
 * Payment provider contract. Callers (checkout, webhooks, the status check, refunds) only talk to this,
 * so another provider can be added without changing them.
 *
 * Money rules: amounts in this interface are Kenyan shillings in MAJOR units (a number such as 1500).
 * Each provider converts to the unit its API documents (Paystack wants the smallest unit, cents).
 */
export type ProviderId = "PAYSTACK" | "MPESA";

export interface InitializeInput {
  /** Our order id and the provider reference we generated for it (Paystack). */
  orderId: string;
  reference: string;
  amount: number;
  currency: string;
  buyer: { email: string; phone?: string };
  /** Where the buyer's browser returns after paying (a thank-you page only; never proof of payment). */
  returnUrl: string;
}

export interface InitializeResult {
  /** The id the provider will use in webhooks (Paystack: our reference; M-Pesa: the CheckoutRequestID). */
  reference: string;
  /** Card flows: send the browser here to pay. */
  redirectUrl?: string;
  /** M-Pesa flow: extra ids to store on the order. */
  merchantRequestId?: string;
}

/** What the provider says about a payment right now (used by the status fallback and the cron job). */
export type VerifyResult =
  | { state: "success"; amount?: number; currency?: string; receipt?: string }
  | { state: "failed"; reason?: string }
  | { state: "pending" };

/** A provider event translated into our own words. */
export type ProviderEvent =
  | { type: "payment.succeeded"; provider: ProviderId; reference: string; amount: number; currency: string; receipt?: string; payerPhone?: string }
  | { type: "payment.failed"; provider: ProviderId; reference: string; reason?: string }
  | { type: "refund.processed"; provider: ProviderId; reference: string }
  | { type: "refund.failed"; provider: ProviderId; reference: string }
  | { type: "ignored" };

export interface PaymentProvider {
  id: ProviderId;
  /** Starts a payment. Throws if the provider refuses. */
  initialize(input: InitializeInput): Promise<InitializeResult>;
  /** True only if the request really came from the provider (signature, secret path, ...). */
  verifyWebhook(rawBody: string, headers: Headers): boolean;
  /** Turns the provider's payload into a ProviderEvent. Never trusts any field without the check above. */
  parseEvent(payload: unknown): ProviderEvent;
  /** Asks the provider (server to server) what happened to a payment. */
  verify(reference: string): Promise<VerifyResult>;
  /** Asks the provider to refund. `manual: true` means a person must send the money back and record it. */
  refund(input: { reference: string; amount: number; reason: string }): Promise<{ ok: boolean; manual?: boolean }>;
}

export class ProviderError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ProviderError";
  }
}
