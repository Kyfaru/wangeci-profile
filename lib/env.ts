import { z } from "zod";

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
  PAYSTACK_WEBHOOK_SECRET: z.string().min(1),

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

  // ElevenLabs (audiobook narration/voice)
  ELEVENLABS_API_KEY: z
    .string()
    .startsWith("sk_", "ELEVENLABS_API_KEY must start with sk_"),

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

  // Comma-separated list of emails allowed into the admin panel
  ADMIN_EMAIL_ALLOWLIST: z.string().min(1),
});

// Parsing at import time (rather than lazily on first use) means a bad
// deploy fails at boot, not on the first request that happens to touch
// the missing var — fail fast and loud instead of intermittently.
export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
