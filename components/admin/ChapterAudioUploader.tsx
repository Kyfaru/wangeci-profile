"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { attachChapterAudioAction } from "@/app/admin/actions";

/** Reads the length of an audio file in the browser (the server never decodes audio). */
function readDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (Number.isFinite(audio.duration)) resolve(Math.round(audio.duration));
      else reject(new Error("Could not read the length of this file."));
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file could not be read as audio."));
    };
  });
}

function put(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(file);
  });
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Sign, upload straight to storage with progress, then record the file on the chapter. */
export function ChapterAudioUploader({ editionId, chapterId, current }: { editionId: string; chapterId: string; current: number | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    setPct(0);
    setBusy(true);
    try {
      const seconds = await readDuration(file);
      setDuration(seconds);
      const res = await fetch("/api/admin/chapter-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editionId, chapterId, filename: file.name, contentType: file.type, sizeBytes: file.size }),
      });
      const signed = (await res.json().catch(() => ({}))) as { url?: string; key?: string; error?: string };
      if (!res.ok || !signed.url || !signed.key) throw new Error(signed.error ?? "Could not start the upload.");
      await put(signed.url, file, setPct);
      const fd = new FormData();
      fd.set("chapterId", chapterId);
      fd.set("key", signed.key);
      fd.set("durationSeconds", String(seconds));
      const result = await attachChapterAudioAction(null, fd);
      setMsg({ ok: result.ok, text: result.message });
      if (result.ok) router.refresh();
    } catch (e) {
      console.error("chapter audio upload failed", e);
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Upload failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 text-sm">
      <p className="text-black/60">Current audio: {current ? mmss(current) : "none"}. Uploading replaces it. The file is stored privately and only owners can hear it.</p>
      <input type="file" accept=".mp3,.m4a,audio/mpeg,audio/mp4" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} className="block min-h-11 w-full text-sm" aria-label="Chapter audio file" />
      {duration !== null && <p className="text-black/70">Length in file: {mmss(duration)}</p>}
      {busy && (
        <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded-full bg-black/10">
          <div className="h-full bg-navy transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      {msg && <p role="status" className={msg.ok ? "text-green" : "text-error"}>{msg.text}</p>}
    </div>
  );
}
