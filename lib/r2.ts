import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "@/lib/env";

/**
 * S3-compatible client for Cloudflare R2. R2 exposes the same API as S3
 * at an account-scoped endpoint, so the AWS SDK works unmodified — only
 * the endpoint and region differ from real S3.
 */
export const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Generates a time-limited signed URL for downloading a private object.
 * @param bucket - R2 bucket name the object lives in (typically
 *   env.R2_BUCKET_PROTECTED for paid content).
 * @param key - object key within the bucket.
 * @param expiresInSeconds - how long the URL stays valid.
 * @returns a signed HTTPS URL that grants temporary read access.
 * @throws if the underlying AWS SDK signing call fails (e.g. bad
 *   credentials) — callers should treat this as an operational error and
 *   return a structured 5xx to the client, not retry silently.
 * Why it exists: protected assets (purchased EPUBs/audiobooks) must never
 * be served from a public URL — access is granted per-request only after
 * an entitlement check, and expires quickly to limit link sharing.
 */
export async function getSignedDownloadUrl(
  bucket: string,
  key: string,
  expiresInSeconds: number,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
}

/**
 * Builds the public URL for an object in the public R2 bucket (cover
 * images, free previews — anything safe to serve without a signed URL).
 * @param key - object key within the public bucket.
 * @returns a plain HTTPS URL, valid indefinitely.
 * Why it exists: public assets don't need entitlement checks or signed
 * URLs, so callers should never route them through getSignedDownloadUrl.
 */
export function publicUrl(key: string): string {
  // TODO: R2_BUCKET_PUBLIC currently holds a bucket/domain placeholder —
  // once a real public bucket domain (or custom domain) is provisioned,
  // this should build off that domain instead.
  return `https://${env.R2_BUCKET_PUBLIC}/${key}`;
}
