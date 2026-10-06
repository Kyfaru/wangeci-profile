/**
 * Plain-text SMS body templates. Kept short — Africa's Talking bills per
 * 160-character segment, and multi-part SMS is more likely to arrive out of
 * order or get dropped by carriers.
 */

const MAX_SMS_LENGTH = 160; // single-segment GSM-7 SMS limit

/** One-time password message for login/verification flows. */
export function otp(code: string): string {
  const message = `Your Wangeci verification code is ${code}. It expires in 5 minutes. Do not share this code.`;
  return message.slice(0, MAX_SMS_LENGTH);
}

/** Sent after a successful order payment. */
export function orderPaid(bookTitle: string): string {
  const message = `Payment received! "${bookTitle}" is ready to read on Wangeci. Thanks for your order.`;
  return message.slice(0, MAX_SMS_LENGTH);
}

/** Sent when an order is created but payment hasn't confirmed yet. */
export function orderPending(): string {
  return "Your Wangeci order is pending payment confirmation. We'll text you as soon as it's complete.";
}

/** Sent after a paid order: congratulations plus the dashboard link. Always 150 characters or fewer. */
export function orderWelcome(dashboardUrl: string): string {
  return `Congratulations! Your Wangeci book is ready. Open your dashboard: ${dashboardUrl}`.slice(0, 150);
}
