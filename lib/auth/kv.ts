import { Redis } from "@upstash/redis";

/**
 * Tiny key-value store with expiry, used by the OTP lockout ladder and the "replace other device"
 * consent. Upstash Redis in production; an in-memory Map for local development and tests.
 */
export interface Kv {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

export function memoryKv(): Kv {
  const data = new Map<string, { value: unknown; expiresAt: number }>();
  return {
    async get<T>(key: string) {
      const hit = data.get(key);
      if (!hit) return null;
      if (hit.expiresAt <= Date.now()) {
        data.delete(key);
        return null;
      }
      return hit.value as T;
    },
    async set(key, value, ttlSeconds) {
      data.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
    async del(key) {
      data.delete(key);
    },
  };
}

function redisKv(redis: Redis): Kv {
  return {
    get: async <T>(key: string) => (await redis.get<T>(key)) ?? null,
    set: async (key, value, ttlSeconds) => {
      await redis.set(key, value, { ex: ttlSeconds });
    },
    del: async (key) => {
      await redis.del(key);
    },
  };
}

// Survives dev hot reloads so lockout state is not lost on every file save.
const globalForKv = globalThis as unknown as { __kv?: Kv };

/** The shared store for this process. */
export function getKv(): Kv {
  if (!globalForKv.__kv) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token) globalForKv.__kv = redisKv(new Redis({ url, token }));
    else if (process.env.NEXT_PUBLIC_SITE_ENV === "production") throw new Error("Upstash Redis is not configured");
    else globalForKv.__kv = memoryKv();
  }
  return globalForKv.__kv;
}
