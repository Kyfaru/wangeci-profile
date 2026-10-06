import { mpesa, mpesaConfigured } from "@/lib/payments/mpesa";
import { paystack } from "@/lib/payments/paystack";
import type { PaymentProvider, ProviderId } from "@/lib/payments/types";

const providers: Record<ProviderId, PaymentProvider> = { PAYSTACK: paystack, MPESA: mpesa };

export const getProvider = (id: ProviderId): PaymentProvider => providers[id];

/** Which payment options the checkout may offer right now (M-Pesa only when it is configured). */
export const enabledProviders = (): ProviderId[] => (mpesaConfigured() ? ["PAYSTACK", "MPESA"] : ["PAYSTACK"]);
