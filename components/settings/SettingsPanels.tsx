"use client";

import QRCode from "qrcode";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { updatePreferences } from "@/app/actions/settings";
import { OtpInput } from "@/components/auth/OtpInput";
import { authClient } from "@/lib/auth-client";
import { inputClass } from "@/lib/auth/client-actions";
import { describeAuthError } from "@/lib/auth/flow";
import { cn } from "@/lib/cn";
import { broadcastSignOut, useSessionStore } from "@/lib/stores/session-store";

const card = "mt-8 max-w-[760px] rounded-2xl border border-black/10 bg-white p-6";
const btn = "rounded-full bg-navy px-6 py-2.5 text-sm font-medium text-cream transition-colors hover:bg-gold disabled:opacity-50";
const ghost = "rounded-full border border-black/20 px-6 py-2.5 text-sm font-medium text-black transition-colors hover:border-navy disabled:opacity-50";

interface Props {
  name: string;
  email: string;
  phone: string | null;
  twoFactorEnabled: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
}

export function SettingsPanels(props: Props) {
  const router = useRouter();
  const [name, setName] = useState(props.name);
  const [msg, setMsg] = useState<string | null>(null);
  const [emailOn, setEmailOn] = useState(props.emailNotifications);
  const [smsOn, setSmsOn] = useState(props.smsNotifications);
  const [tfEnabled, setTfEnabled] = useState(props.twoFactorEnabled);
  const [setup, setSetup] = useState<{ qr: string; secret: string; backupCodes: string[] } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 1) return;
    setBusy(true);
    const { error } = await authClient.updateUser({ name: name.trim() });
    setBusy(false);
    setMsg(error ? describeAuthError(error) : "Name saved.");
    if (!error) void useSessionStore.getState().hydrate();
    router.refresh();
  }

  async function savePrefs(next: { emailNotifications: boolean; smsNotifications: boolean }) {
    setEmailOn(next.emailNotifications);
    setSmsOn(next.smsNotifications);
    const res = await updatePreferences(next);
    setMsg(res.ok ? "Preferences saved." : "Could not save preferences.");
  }

  async function startTwoFactor() {
    setBusy(true);
    setMsg(null);
    const { data, error } = await authClient.twoFactor.enable({});
    setBusy(false);
    if (error || !data || !("totpURI" in data)) return setMsg(describeAuthError(error));
    const secret = new URL(data.totpURI).searchParams.get("secret") ?? "";
    setSetup({ qr: await QRCode.toDataURL(data.totpURI, { margin: 1, width: 200 }), secret, backupCodes: data.backupCodes });
  }

  async function confirmTwoFactor(value: string) {
    setBusy(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code: value });
    setBusy(false);
    if (error) {
      setCode("");
      return setMsg(describeAuthError(error));
    }
    setTfEnabled(true);
    setSetup(null);
    setCode("");
    setMsg("Two-step check is on.");
    router.refresh();
  }

  async function disableTwoFactor() {
    setBusy(true);
    const { error } = await authClient.twoFactor.disable({});
    setBusy(false);
    if (error) return setMsg(describeAuthError(error));
    setTfEnabled(false);
    setMsg("Two-step check is off.");
    router.refresh();
  }

  async function signOutEverywhere() {
    setBusy(true);
    await authClient.revokeSessions();
    useSessionStore.getState().clear();
    broadcastSignOut();
    router.replace("/sign-in");
    router.refresh();
  }

  return (
    <div>
      {msg && (
        <p role="status" className="mt-6 max-w-[760px] rounded-xl bg-white px-4 py-3 text-sm text-black">
          {msg}
        </p>
      )}

      <section className={card} aria-labelledby="s-profile">
        <h2 id="s-profile" className="font-display text-2xl text-black">Profile</h2>
        <form onSubmit={saveName} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1">
            <span className="text-sm text-black/60">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className={cn(inputClass, "mt-1")} />
          </label>
          <button type="submit" disabled={busy || name.trim() === props.name} className={btn}>Save</button>
        </form>
        <dl className="mt-5 grid gap-1 text-black sm:grid-cols-[110px_1fr]">
          <dt className="text-black/60">Email</dt>
          <dd>{props.email}</dd>
          <dt className="text-black/60">Phone</dt>
          <dd>{props.phone ?? "Not added"}</dd>
        </dl>
        <p className="mt-3 text-sm text-black/50">To change your email or phone, contact us.</p>
      </section>

      <section className={card} aria-labelledby="s-notify">
        <h2 id="s-notify" className="font-display text-2xl text-black">Notifications</h2>
        <p className="mt-2 text-sm text-black/60">Receipts, sign-in codes and refund notices are always sent. These control the optional ones (new chapters and similar).</p>
        <label className="mt-4 flex items-center gap-3 text-black">
          <input type="checkbox" checked={emailOn} onChange={(e) => savePrefs({ emailNotifications: e.target.checked, smsNotifications: smsOn })} className="size-5 rounded" />
          Email me
        </label>
        <label className="mt-3 flex items-center gap-3 text-black">
          <input type="checkbox" checked={smsOn} onChange={(e) => savePrefs({ emailNotifications: emailOn, smsNotifications: e.target.checked })} className="size-5 rounded" />
          Text me
        </label>
      </section>

      <section className={card} aria-labelledby="s-2fa">
        <h2 id="s-2fa" className="font-display text-2xl text-black">Two-step check (authenticator app)</h2>
        <p className="mt-2 text-sm text-black/60">An extra step when you sign in: a 6-digit code from an app such as Google Authenticator. Required for admin accounts.</p>
        {setup ? (
          <div className="mt-4">
            <p className="text-black">1. Scan this with your authenticator app (or type the key).</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
            <img src={setup.qr} alt="QR code for your authenticator app" width={200} height={200} className="mt-3 rounded-lg border border-black/10" />
            <p className="mt-2 break-all text-sm text-black/70">Key: <code>{setup.secret}</code></p>
            <p className="mt-4 text-black">2. Save these backup codes somewhere safe. Each works once if you lose your phone.</p>
            <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm text-black sm:max-w-sm">
              {setup.backupCodes.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <p className="mt-4 text-black">3. Enter the 6-digit code from the app.</p>
            <div className="mt-2"><OtpInput length={6} value={code} onChange={setCode} onComplete={confirmTwoFactor} disabled={busy} autoFocus /></div>
          </div>
        ) : tfEnabled ? (
          <button type="button" onClick={disableTwoFactor} disabled={busy} className={cn(ghost, "mt-4")}>Turn off</button>
        ) : (
          <button type="button" onClick={startTwoFactor} disabled={busy} className={cn(btn, "mt-4")}>Set up</button>
        )}
      </section>

      <section className={card} aria-labelledby="s-sessions">
        <h2 id="s-sessions" className="font-display text-2xl text-black">Sessions</h2>
        <p className="mt-2 text-sm text-black/60">Sign out of this device and every other one.</p>
        <button type="button" onClick={signOutEverywhere} disabled={busy} className={cn(ghost, "mt-4")}>Sign out everywhere</button>
      </section>
    </div>
  );
}
