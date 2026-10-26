import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
 * A time-limited URL the browser can PUT one file to. The ContentType is signed into the URL, so the
 * upload only succeeds with the same Content-Type header that was approved.
 * Why it exists: chapter audio is up to hundreds of MB; it goes browser to R2 directly, not through the server.
 */
export async function getSignedUploadUrl(bucket: string, key: string, contentType: string, expiresInSeconds: number): Promise<string> {
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  return getSignedUrl(r2Client, command, { expiresIn: expiresInSeconds });
}

/** Size and type of a stored object, or null when it does not exist. Lets the server trust the bucket, not the browser. */
export async function headObject(bucket: string, key: string): Promise<{ sizeBytes: number; contentType: string | null } | null> {
  try {
    const head = await r2Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { sizeBytes: head.ContentLength ?? 0, contentType: head.ContentType ?? null };
  } catch (error) {
    if ((error as { name?: string }).name === "NotFound" || (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

/** Removes one object. Deleting a key that is already gone is not an error (S3 semantics). */
export async function deleteObject(bucket: string, key: string): Promise<void> {
  await r2Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
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
