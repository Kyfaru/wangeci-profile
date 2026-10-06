/**
 * Encrypted, split browser cache for DISPLAY-ONLY data (name, masked contact, avatar).
 *
 * How it works: the JSON is encrypted with a random AES-GCM key, the ciphertext is cut into pieces,
 * and the pieces are stored under random key names, alternating between localStorage (survives
 * closing the browser) and sessionStorage (one tab). A small manifest in localStorage remembers the
 * key, the IV and where the pieces are. Any missing or damaged piece simply means "cache miss" and
 * the data is fetched again from the server.
 *
 * SECURITY NOTE: this is obfuscation against casual inspection, NOT a security boundary. Any script
 * running on our origin (for example through an XSS bug) can read the manifest and decrypt it. So it
 * must never hold the session token, one-time codes, orders or entitlements, and nothing on the
 * server ever trusts it. Who is signed in is decided by the server, always.
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface Manifest {
  v: 1;
  jwk: JsonWebKey;
  iv: string;
  /** [storage ("l" local, "s" session), key name] in ciphertext order. */
  parts: [string, string][];
}

const MANIFEST_PREFIX = "wc_m_";
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const randomName = () => `_${b64(crypto.getRandomValues(new Uint8Array(9))).replace(/[+/=]/g, "x")}`;

const browserStorage = () => ({
  local: typeof localStorage === "undefined" ? undefined : localStorage,
  session: typeof sessionStorage === "undefined" ? undefined : sessionStorage,
});

export async function saveSecureCache(
  namespace: string,
  data: unknown,
  shards = 4,
  storages: { local?: StorageLike; session?: StorageLike } = browserStorage(),
): Promise<void> {
  const { local, session } = storages;
  if (!local) return;
  clearSecureCache(namespace, storages);

  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(data))));

  const size = Math.ceil(cipher.length / shards);
  const parts: [string, string][] = [];
  for (let i = 0; i < shards; i++) {
    const piece = cipher.slice(i * size, (i + 1) * size);
    const useSession = Boolean(session) && i % 2 === 1;
    const name = randomName();
    (useSession ? session! : local).setItem(name, b64(piece));
    parts.push([useSession ? "s" : "l", name]);
  }

  const manifest: Manifest = { v: 1, jwk: await crypto.subtle.exportKey("jwk", key), iv: b64(iv), parts };
  local.setItem(MANIFEST_PREFIX + namespace, JSON.stringify(manifest));
}

/** Returns the cached data, or null on any problem (missing piece, tampering, wrong version). */
export async function loadSecureCache<T>(
  namespace: string,
  storages: { local?: StorageLike; session?: StorageLike } = browserStorage(),
): Promise<T | null> {
  const { local, session } = storages;
  try {
    const raw = local?.getItem(MANIFEST_PREFIX + namespace);
    if (!raw) return null;
    const manifest = JSON.parse(raw) as Manifest;
    if (manifest.v !== 1) return null;

    const pieces: Uint8Array[] = [];
    for (const [where, name] of manifest.parts) {
      const value = (where === "s" ? session : local)?.getItem(name);
      if (!value) return null;
      pieces.push(unb64(value));
    }
    const cipher = new Uint8Array(pieces.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    for (const p of pieces) {
      cipher.set(p, offset);
      offset += p.length;
    }

    const key = await crypto.subtle.importKey("jwk", manifest.jwk, { name: "AES-GCM" }, false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(manifest.iv) }, key, cipher);
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null; // AES-GCM rejects any change to the data, so tampering lands here
  }
}

export function clearSecureCache(
  namespace: string,
  storages: { local?: StorageLike; session?: StorageLike } = browserStorage(),
): void {
  const { local, session } = storages;
  try {
    const raw = local?.getItem(MANIFEST_PREFIX + namespace);
    if (raw) {
      for (const [where, name] of (JSON.parse(raw) as Manifest).parts) (where === "s" ? session : local)?.removeItem(name);
    }
    local?.removeItem(MANIFEST_PREFIX + namespace);
  } catch {
    local?.removeItem(MANIFEST_PREFIX + namespace);
  }
}
