"use client";

import { useEffect, useRef } from "react";

import { consumePendingStart, registerAudioElement, usePlayerStore } from "@/lib/stores/player-store";

const SAVE_EVERY_MS = 30_000;
const REFRESH_CHECK_MS = 10_000;
const REFRESH_AT = 0.8; // ask for a new link when 80% of the old link's life has passed

/**
 * The ONE <audio> element for the whole dashboard, mounted in the dashboard layout so playback keeps
 * going while the listener browses. It mirrors the element's real events into the store (so the play /
 * pause button can never show the wrong state), swaps in a fresh signed link before the old one expires
 * (same element, same position, no remount), saves the listening position, and talks to the lock screen.
 */
export function AudioHost() {
  const ref = useRef<HTMLAudioElement>(null);
  const src = usePlayerStore((s) => s.src);
  const lastSaved = useRef<{ chapterIdx: number; seconds: number } | null>(null);
  const refreshing = useRef(false);

  const save = (beacon = false) => {
    const el = ref.current;
    const { editionId, chapterIdx, src: current } = usePlayerStore.getState();
    if (!el || !editionId || !current) return;
    const seconds = Math.floor(el.currentTime);
    if (lastSaved.current?.chapterIdx === chapterIdx && Math.abs(lastSaved.current.seconds - seconds) < 2) return;
    lastSaved.current = { chapterIdx, seconds };
    const body = JSON.stringify({ editionId, chapterIdx, offset: seconds });
    if (beacon && navigator.sendBeacon) navigator.sendBeacon("/api/reading/progress", new Blob([body], { type: "text/plain" }));
    else void fetch("/api/reading/progress", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    registerAudioElement(el);
    const { patch, next } = usePlayerStore.getState();

    const on: Record<string, () => void> = {
      loadedmetadata: () => {
        const store = usePlayerStore.getState();
        patch({ duration: Number.isFinite(el.duration) ? el.duration : store.duration });
        el.playbackRate = store.playbackRate;
        const start = consumePendingStart();
        if (start) {
          if (start.seconds > 0) el.currentTime = start.seconds;
          if (start.autoplay) void el.play().catch(() => patch({ status: "paused" }));
          else patch({ status: "paused" });
        }
      },
      durationchange: () => Number.isFinite(el.duration) && patch({ duration: el.duration }),
      playing: () => patch({ status: "playing", error: null }),
      waiting: () => patch({ status: "buffering" }),
      pause: () => {
        if (!el.ended) patch({ status: "paused" });
        save();
      },
      timeupdate: () => patch({ currentTime: el.currentTime }),
      progress: () => patch({ bufferedEnd: el.buffered.length ? el.buffered.end(el.buffered.length - 1) : 0 }),
      ended: () => {
        patch({ status: "ended" });
        next(); // on to the next chapter, if there is one
      },
      error: () => patch({ status: "error", error: "The audio could not be played. Please try again." }),
    };
    Object.entries(on).forEach(([name, fn]) => el.addEventListener(name, fn));

    const saveTimer = window.setInterval(() => !el.paused && save(), SAVE_EVERY_MS);
    const onHide = () => save(true);
    window.addEventListener("pagehide", onHide);

    // Swap in a new signed link before the old one dies.
    const refreshTimer = window.setInterval(async () => {
      const s = usePlayerStore.getState();
      if (!s.src || !s.editionId || s.ttlMs === 0 || refreshing.current) return;
      if (Date.now() < s.expiresAt - s.ttlMs * (1 - REFRESH_AT)) return;
      refreshing.current = true;
      try {
        const res = await fetch("/api/media/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ editionId: s.editionId, chapterIdx: s.chapterIdx }) });
        if (res.ok) {
          const grant = (await res.json()) as { url: string; expiresInSeconds: number };
          usePlayerStore.getState().swapSource(grant.url, grant.expiresInSeconds);
        } else if (res.status === 404 || res.status === 401) {
          el.pause();
          patch({ status: "error", error: "Your access to this audiobook has ended." });
        }
      } finally {
        refreshing.current = false;
      }
    }, REFRESH_CHECK_MS);

    return () => {
      Object.entries(on).forEach(([name, fn]) => el.removeEventListener(name, fn));
      window.clearInterval(saveTimer);
      window.clearInterval(refreshTimer);
      window.removeEventListener("pagehide", onHide);
      registerAudioElement(null);
    };
  }, []);

  // Lock screen, headphone buttons and the browser's media notification.
  const { bookTitle, author, cover, chapters, chapterIdx, status } = usePlayerStore();
  useEffect(() => {
    if (!("mediaSession" in navigator) || !src) return;
    const title = chapters.find((c) => c.idx === chapterIdx)?.title ?? bookTitle;
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: author, album: bookTitle, artwork: cover ? [{ src: cover, sizes: "512x512" }] : [] });
    navigator.mediaSession.playbackState = status === "playing" ? "playing" : "paused";
    const s = usePlayerStore.getState();
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => s.toggle()],
      ["pause", () => s.toggle()],
      ["seekbackward", () => s.skip(-10)],
      ["seekforward", () => s.skip(10)],
      ["previoustrack", () => s.previous()],
      ["nexttrack", () => s.next()],
      ["seekto", (d) => typeof d.seekTime === "number" && s.seek(d.seekTime)],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* this browser does not support that action */
      }
    }
  }, [bookTitle, author, cover, chapters, chapterIdx, status, src]);

  return <audio ref={ref} src={src ?? undefined} preload="metadata" className="hidden" />;
}
