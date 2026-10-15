import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  notifyAdmins: vi.fn(async () => {}),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  captureException: vi.fn(),
  store: new Map<string, unknown>(),
}));

vi.mock("@/lib/env", () => ({ env: mocks.env }));
vi.mock("@/lib/server/notify-admins", () => ({ notifyAdmins: mocks.notifyAdmins }));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag, revalidatePath: mocks.revalidatePath }));
vi.mock("@sentry/nextjs", () => ({ captureException: mocks.captureException }));
vi.mock("@/lib/auth/kv", () => ({
  getKv: () => ({
    get: async (k: string) => mocks.store.get(k) ?? null,
    set: async (k: string, v: unknown) => void mocks.store.set(k, v),
    del: async (k: string) => void mocks.store.delete(k),
  }),
}));

import { POST as chatwootPost } from "@/app/api/webhooks/chatwoot/route";
import { POST as sanityPost } from "@/app/api/webhooks/sanity/route";
// eslint-disable-next-line no-restricted-imports
import { parseTimeRange } from "@/lib/admin/time-range";
import { overview } from "@/lib/analytics";

const range = parseTimeRange({ range: "7d" });
const fetchMock = vi.fn();

beforeEach(() => {
  for (const k of Object.keys(mocks.env)) delete mocks.env[k];
  Object.assign(mocks.env, { UMAMI_API_URL: "https://api.umami.is/v1", SANITY_DATASET: "production" });
  mocks.store.clear();
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("umami", () => {
  it("is absent without config: nothing is called", async () => {
    expect(await overview(range)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns data when configured", async () => {
    Object.assign(mocks.env, { UMAMI_API_KEY: "k", UMAMI_WEBSITE_ID: "w" });
    fetchMock.mockImplementation(async (url: string) => {
      const body = url.includes("/stats") ? { visitors: { value: 4 }, pageviews: { value: 9 } } : url.includes("/active") ? { visitors: 2 } : url.includes("/pageviews") ? { pageviews: [{ x: "d", y: 3 }] } : [{ x: "/store", y: 5 }];
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const web = await overview(range);
    expect(web?.online).toBe(2);
    expect(web?.traffic).toEqual({ visitors: 4, pageviews: 9 });
    expect(web?.pages).toEqual([{ path: "/store", views: 5 }]);
  });

  it("an Umami failure does not throw and is traced", async () => {
    Object.assign(mocks.env, { UMAMI_API_KEY: "k", UMAMI_WEBSITE_ID: "w" });
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    const web = await overview(range);
    expect(web).toEqual({ online: undefined, pages: undefined, clicks: undefined, traffic: undefined, bars: undefined });
    expect(console.error).toHaveBeenCalled();
    expect(mocks.captureException).toHaveBeenCalled();
  });
});

describe("chatwoot webhook", () => {
  const secret = "s3cret";
  const sign = (body: string, ts = String(Math.floor(Date.now() / 1000))) => ({
    "x-chatwoot-timestamp": ts,
    "x-chatwoot-signature": `sha256=${createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex")}`,
  });
  const call = (body: string, headers: Record<string, string>) =>
    chatwootPost(new Request("http://x/api/webhooks/chatwoot", { method: "POST", body, headers }), undefined);
  const message = JSON.stringify({ event: "message_created", id: 7, message_type: "incoming", private: false, content: "hi", sender: { name: "Ann" }, conversation: { id: 3 } });

  it("404s when the secret is not set", async () => {
    expect((await call(message, sign(message))).status).toBe(404);
  });

  it("401s on a bad signature", async () => {
    mocks.env.CHATWOOT_WEBHOOK_SECRET = secret;
    expect((await call(message, { ...sign(message), "x-chatwoot-signature": "sha256=00" })).status).toBe(401);
    expect(mocks.notifyAdmins).not.toHaveBeenCalled();
  });

  it("ignores agent replies and private notes", async () => {
    mocks.env.CHATWOOT_WEBHOOK_SECRET = secret;
    for (const patch of [{ message_type: "outgoing" }, { private: true }]) {
      const body = JSON.stringify({ ...JSON.parse(message), ...patch });
      expect((await call(body, sign(body))).status).toBe(200);
    }
    expect(mocks.notifyAdmins).not.toHaveBeenCalled();
  });

  it("a duplicate delivery uses the same dedupe key (so one bell item)", async () => {
    mocks.env.CHATWOOT_WEBHOOK_SECRET = secret;
    await call(message, sign(message));
    await call(message, sign(message));
    const keys = mocks.notifyAdmins.mock.calls.map((c) => (c as unknown as [{ dedupeKey: string }])[0].dedupeKey);
    expect(keys).toEqual(["contact:chatwoot:3:7", "contact:chatwoot:3:7"]);
  });
});

describe("sanity webhook", () => {
  const secret = "sanity-secret";
  const body = JSON.stringify({ _type: "post" });
  const header = (b: string, t = String(Date.now())) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${b}`).digest("base64url")}`;
  const call = (signature: string) =>
    sanityPost(new Request("http://x/api/webhooks/sanity", { method: "POST", body, headers: { "sanity-webhook-signature": signature } }), undefined);

  it("404s when the secret is not set", async () => {
    expect((await call(header(body))).status).toBe(404);
  });

  it("401s on a bad signature and revalidates nothing", async () => {
    mocks.env.SANITY_WEBHOOK_SECRET = secret;
    expect((await call("t=1700000000000,v1=bad")).status).toBe(401);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("revalidates on a valid signature", async () => {
    mocks.env.SANITY_WEBHOOK_SECRET = secret;
    expect((await call(header(body))).status).toBe(200);
    expect(mocks.revalidateTag).toHaveBeenCalledWith("sanity", "max");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/blog");
  });
});
