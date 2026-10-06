// These packages ship no TypeScript types for the entry points we use.
declare module "@paystack/inline-js" {
  interface ResumeCallbacks {
    onSuccess?: (transaction: { reference: string }) => void;
    onCancel?: () => void;
    onLoad?: (response: unknown) => void;
    onError?: (error: { message: string }) => void;
  }
  export default class PaystackPop {
    resumeTransaction(accessCode: string, callbacks?: ResumeCallbacks): void;
  }
}
declare module "preline/plugins/overlay-non-auto" {
  const HSOverlay: unknown;
  export default HSOverlay;
}
