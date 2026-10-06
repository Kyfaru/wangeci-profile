# Cloudflare R2 setup (two buckets)

Not done by the code (it needs your Cloudflare account). Do this once per environment (staging and production use different buckets and different API keys).

1. **Public bucket** (covers, free previews): create it, then either attach a custom domain (recommended, for example `media.yourdomain`) or enable the r2.dev URL. Put that domain, with no `https://`, in `R2_BUCKET_PUBLIC`. Note: `lib/r2.ts` currently builds public URLs as `https://<R2_BUCKET_PUBLIC>/<key>`, so that variable must hold the domain, not the bucket name. Add the domain to `images.remotePatterns` in `next.config.ts` and to the `img-src` rule in `proxy.ts`.
2. **Protected bucket** (audio files and anything paid): create it and keep it private, with no public access and no custom domain. Put its name in `R2_BUCKET_PROTECTED`. Turn on **object versioning** so an overwrite or delete can be undone.
3. **CORS on the protected bucket** (needed later for presigned browser uploads from the admin): allow `PUT` and `GET` from your site's origins only, allow the `Content-Type` header, expose `ETag`.
4. **API token**: create an R2 token limited to these two buckets (Object Read and Write), and store the access key id and secret in `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`. Put `R2_ACCOUNT_ID` in too.
5. Test: `node --env-file=.env.local scripts/publish-edition.ts <manifest> --dry-run`, then a real run with a small cover image.

Paid files are only ever delivered through short-lived signed URLs after the server checks the session and the purchase (Phase 4).
