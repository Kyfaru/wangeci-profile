/**
 * Turns a provider's failure text into a short sentence for the buyer (always fewer than 10 words).
 * Safaricom codes: 1032 cancelled, 2001 wrong PIN, 1 insufficient funds, 1037 no response, 1025/1019 expired.
 */
const RULES: [RegExp, string][] = [
  [/(^|\D)1032\b|cancel/i, "You cancelled the request."],
  [/2001|wrong pin|invalid initiator/i, "The PIN entered was wrong."],
  [/(^|\D)1\b:|insufficient/i, "Insufficient funds in your account."],
  [/1037|timeout|timed out|no response|expired|1019|1025/i, "No response from your phone."],
  [/declin/i, "Your card was declined."],
  [/abandon/i, "The payment was not completed."],
  [/provider_initialize_failed/i, "We could not start the payment."],
];

export function shortReason(raw: string | null | undefined): string {
  const text = raw ?? "";
  for (const [pattern, message] of RULES) if (pattern.test(text)) return message;
  return "The payment did not go through.";
}
