import { z } from "zod";

import { isRelaxed } from "@/lib/site";

/**
 * Validates and parses all environment variables the app depends on.
 * Parsed once at import time so a missing or malformed var crashes boot
 * immediately with a clear error, instead of surfacing as a runtime
 * failure deep inside a request handler (e.g. a payment webhook).
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Postgres (Neon) — DATABASE_URL is the pooled connection used at
  // runtime, DIRECT_URL bypasses the pooler for migrations.
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // Better Auth
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url(),

  // Next.js Server Actions payload encryption
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: z
    .string()
    .min(32, "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY must be at least 32 characters"),

  // Paystack
  PAYSTACK_SECRET_KEY: z
    .string()
    .startsWith("sk_", "PAYSTACK_SECRET_KEY must start with sk_"),
  PAYSTACK_PUBLIC_KEY: z
    .string()
    .startsWith("pk_", "PAYSTACK_PUBLIC_KEY must start with pk_"),
  // Paystack signs webhooks with the secret key itself (confirmed in their docs): no separate webhook secret.

  // Cloudflare R2 (S3-compatible object storage)
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_PUBLIC: z.string().min(1),
  R2_BUCKET_PROTECTED: z.string().min(1),

  // Resend (transactional email)
  RESEND_API_KEY: z.string().startsWith("re_", "RESEND_API_KEY must start with re_"),
  RESEND_WEBHOOK_SECRET: z.string().min(1),

  // Africa's Talking (SMS)
  AT_USERNAME: z.string().min(1),
  AT_API_KEY: z.string().min(1),
  AT_SENDER_ID: z.string().max(11, "AT_SENDER_ID must be at most 11 characters"),

  // Audio is uploaded as finished files (no text-to-speech), so there is no ElevenLabs key.

  // Origins allowed to call the auth endpoints, besides BETTER_AUTH_URL.
  // Comma-separated (e.g. the staging domain). localhost is added only in development.
  TRUSTED_ORIGINS: z.string().optional(),

  // Upstash Redis (rate limits). Required in production, optional locally.
  UPSTASH_REDIS_REST_URL: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),
  UPSTASH_REDIS_REST_TOKEN: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),

  // Africa's Talking does not sign delivery reports, so the callback URL carries this secret
  // (?token=...). Required in production.
  AT_WEBHOOK_TOKEN: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(24).optional()),

  // Cloudflare Turnstile (bot check on code requests). Required in production.
  // Cloudflare publishes test keys that always pass for local development.
  TURNSTILE_SECRET_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),

  // Upstash QStash (queue that sends one-time codes). Optional locally: codes are then sent directly.
  QSTASH_TOKEN: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  QSTASH_CURRENT_SIGNING_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  QSTASH_NEXT_SIGNING_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),

  // M-Pesa (Safaricom Daraja STK push). Optional locally (the M-Pesa option then hides); required in production.
  DARAJA_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
  DARAJA_CONSUMER_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  DARAJA_CONSUMER_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  DARAJA_SHORTCODE: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^\d{5,7}$/).optional()),
  DARAJA_PASSKEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  // "CustomerPayBillOnline" for a Paybill, "CustomerBuyGoodsOnline" for a Till.
  DARAJA_TRANSACTION_TYPE: z.enum(["CustomerPayBillOnline", "CustomerBuyGoodsOnline"]).default("CustomerPayBillOnline"),
  // Safaricom does not sign callbacks, so the callback URL carries this secret in its path
  // (/api/webhooks/mpesa/<token>). Anything else is a 404.
  DARAJA_CALLBACK_TOKEN: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(24).optional()),

  // Processing fee added at checkout, as a percentage of the amount after discount. 0 (default) = no fee.
  CHECKOUT_FEE_PERCENT: z.preprocess((v) => (v === "" || v === undefined ? 0 : v), z.coerce.number().min(0).max(20)),

  // Shared secret for scheduled jobs (sent as "Authorization: Bearer <secret>").
  CRON_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(24).optional()),

  // Where urgent admin alerts and contact-form messages are emailed (Wangeci's mailbox).
  // TODO(client): her address. Without it the bell still works, but no email is sent.
  CONTACT_INBOX_EMAIL: z.preprocess((v) => (v === "" ? undefined : v), z.string().email().optional()),

  // Google sign-in. Optional until the OAuth client exists; the button hides without them.
  GOOGLE_CLIENT_ID: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),

  // Sentry — optional until a later agent wires up error monitoring.
  // Empty-string env vars (common when a platform sets an unfilled
  // secret to "") are treated as "not set" rather than a validation
  // failure, since z.string().url() would otherwise reject "".
  SENTRY_DSN: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().url().optional(),
  ),
  SENTRY_AUTH_TOKEN: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().optional(),
  ),

  // Umami analytics (hosted). Tracking needs UMAMI_WEBSITE_ID; the admin cards also need UMAMI_API_KEY.
  UMAMI_WEBSITE_ID: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  UMAMI_API_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  UMAMI_API_URL: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().default("https://api.umami.is/v1")),
  UMAMI_SCRIPT_URL: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().default("https://cloud.umami.is/script.js")),

  // Chatwoot live chat. The widget needs base URL + website token; the webhook also needs the secret.
  CHATWOOT_BASE_URL: z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional()),
  CHATWOOT_WEBSITE_TOKEN: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  CHATWOOT_WEBHOOK_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),

  // Sanity blog (read-only). Absent PROJECT_ID means no /blog.
  SANITY_PROJECT_ID: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  SANITY_DATASET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).default("production")),
  SANITY_API_TOKEN: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  SANITY_WEBHOOK_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),

  // Comma-separated list of emails allowed into the admin panel
  ADMIN_EMAIL_ALLOWLIST: z.string().min(1),
}).superRefine((value, ctx) => {
  // Fail fast at boot on the REAL production site rather than on the first request that needs the value.
  // Staging (Vercel) also runs with NODE_ENV=production, so it must say NEXT_PUBLIC_SITE_ENV=staging to boot without
  // the launch-only services (Upstash, QStash, Daraja, Turnstile...). An unset value is treated as the real site.
  if (isRelaxed(value.NODE_ENV)) return;
  for (const key of [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "AT_WEBHOOK_TOKEN",
    "TURNSTILE_SECRET_KEY",
    "QSTASH_TOKEN",
    "QSTASH_CURRENT_SIGNING_KEY",
    "QSTASH_NEXT_SIGNING_KEY",
    "CRON_SECRET",
    "DARAJA_CONSUMER_KEY",
    "DARAJA_CONSUMER_SECRET",
    "DARAJA_SHORTCODE",
    "DARAJA_PASSKEY",
    "DARAJA_CALLBACK_TOKEN",
  ] as const) {
    if (!value[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required in production` });
  }
});

// Parsed on first import. `instrumentation.ts` imports this at server start in
// production, so a bad deploy fails at boot (not on the first request).
// `next build` imports route modules to read their config but has no secrets (Docker/CI), so
// validation is skipped for that phase only. Nothing reads these values during the build.
export const env: z.infer<typeof envSchema> =
  process.env.NEXT_PHASE === "phase-production-build"
    ? (process.env as unknown as z.infer<typeof envSchema>)
    : envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
