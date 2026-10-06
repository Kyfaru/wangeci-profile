import { describe, expect, it } from "vitest";
import { clearSecureCache, loadSecureCache, saveSecureCache, type StorageLike } from "./secure-cache";

const memStorage = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
};

const profile = { name: "Wangeci K", email: "w***@example.com", phone: "+254***78" };

describe("secure cache", () => {
  it("round-trips data and never stores it in plain text", async () => {
    const local = memStorage();
    const session = memStorage();
    await saveSecureCache("session", profile, 4, { local, session });

    const everything = [...local.data.values(), ...session.data.values()].join("|");
    expect(everything).not.toContain("Wangeci");
    expect(await loadSecureCache("session", { local, session })).toEqual(profile);
  });

  it("splits the pieces across local and session storage under random names", async () => {
    const local = memStorage();
    const session = memStorage();
    await saveSecureCache("session", profile, 4, { local, session });
    expect(session.data.size).toBe(2);
    expect(local.data.size).toBe(3); // 2 pieces + manifest
  });

  it("is a cache miss when a piece is missing (for example a closed tab)", async () => {
    const local = memStorage();
    const session = memStorage();
    await saveSecureCache("session", profile, 4, { local, session });
    session.data.clear();
    expect(await loadSecureCache("session", { local, session })).toBeNull();
  });

  it("is a cache miss when a piece is edited", async () => {
    const local = memStorage();
    const session = memStorage();
    await saveSecureCache("session", profile, 4, { local, session });
    const [name, value] = [...session.data.entries()][0];
    session.data.set(name, value.slice(0, -4) + "AAAA");
    expect(await loadSecureCache("session", { local, session })).toBeNull();
  });

  it("clears every piece and the manifest", async () => {
    const local = memStorage();
    const session = memStorage();
    await saveSecureCache("session", profile, 4, { local, session });
    clearSecureCache("session", { local, session });
    expect(local.data.size).toBe(0);
    expect(session.data.size).toBe(0);
  });
});
