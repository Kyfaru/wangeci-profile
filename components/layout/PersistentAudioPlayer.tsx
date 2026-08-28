"use client";

import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/lib/stores/player-store";

export interface PersistentAudioPlayerProps {
  /** Display title for Media Session (lock-screen/OS) metadata. Falls back
   * to `currentEditionId` from the store when omitted. */
  bookTitle?: string;
  /** Falls back to "Chapter {currentChapterIdx + 1}" when omitted. */
  chapterTitle?: string;
  /** Lock-screen artwork, if any edition art is available. */
  artworkUrl?: string;
}

const SEEK_EPSILON_SECONDS = 0.75;
const SKIP_SECONDS = 30;

function hasMediaSession(): boolean {
  return typeof navigator !== "undefined" && "mediaSession" in navigator;
}

/**
 * The audio "engine" — renders exactly one hoisted, visually-hidden
 * `<audio>` element and keeps it synced with `usePlayerStore` in both
 * directions, plus wires the Media Session API for lock-screen/OS controls.
 * No visible UI: `MiniPlayer` is the control surface, this just drives the
 * real element. Mount both once at the root, alongside each other.
 *
 * Two-way sync notes:
 * - store -> audio: play/pause, playbackRate, and "seeks" (see below) are
 *   pushed onto the element via effects.
 * - audio -> store: `timeupdate`/`loadedmetadata`/`play`/`pause`/`ended`
 *   native events push back into the store.
 * - Seeking specifically needs a threshold check: `timeupdate` continuously
 *   writes the element's position into `store.currentTime`, and the
 *   scrubber/skip buttons in `MiniPlayer` write to that same field. Naively
 *   mirroring every `store.currentTime` change onto `audio.currentTime`
 *   would fight normal playback. Instead, the store->audio seek effect only
 *   moves the element when the two have drifted apart by more than
 *   `SEEK_EPSILON_SECONDS` — true during a scrubber/skip action, never true
 *   during ordinary playback ticks.
 */
export function PersistentAudioPlayer({
  bookTitle,
  chapterTitle,
  artworkUrl,
}: PersistentAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastLoadedUrlRef = useRef<string | null>(null);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);

  const audioUrl = usePlayerStore((s) => s.audioUrl);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const currentEditionId = usePlayerStore((s) => s.currentEditionId);
  const currentChapterIdx = usePlayerStore((s) => s.currentChapterIdx);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // (Re)load the element whenever the track actually changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioUrl !== lastLoadedUrlRef.current) {
      lastLoadedUrlRef.current = audioUrl;
      if (audioUrl) audio.load();
    }
  }, [audioUrl]);

  // store -> audio: play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;
    if (isPlaying) {
      audio.play().catch(() => {
        // Autoplay blocked (no user gesture yet, etc.) — reflect the real
        // state back into the store instead of leaving it lying.
        pause();
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, audioUrl, pause]);

  // store -> audio: playback rate
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate]);

  // store -> audio: seeks (see class doc above for the threshold rationale)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || Number.isNaN(audio.duration)) return;
    if (Math.abs(audio.currentTime - currentTime) > SEEK_EPSILON_SECONDS) {
      audio.currentTime = currentTime;
    }
  }, [currentTime]);

  // audio -> store: native media events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (hasMediaSession() && Number.isFinite(audio.duration) && audio.duration > 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: Math.min(audio.currentTime, audio.duration),
          });
        } catch {
          // Some browsers throw on stale values mid-seek — non-critical.
        }
      }
    };
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onEnded = () => pause();
    const onNativePlay = () => play();
    const onNativePause = () => pause();

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onNativePlay);
    audio.addEventListener("pause", onNativePause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onNativePlay);
      audio.removeEventListener("pause", onNativePause);
    };
  }, [setCurrentTime, setDuration, pause, play]);

  // Media Session metadata
  useEffect(() => {
    if (!hasMediaSession()) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: chapterTitle ?? `Chapter ${currentChapterIdx + 1}`,
      artist: bookTitle ?? currentEditionId ?? "Audiobook",
      artwork: artworkUrl
        ? [{ src: artworkUrl, sizes: "512x512", type: "image/png" }]
        : [],
    });
  }, [chapterTitle, bookTitle, currentEditionId, currentChapterIdx, artworkUrl]);

  // Media Session playback state
  useEffect(() => {
    if (!hasMediaSession()) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  // Media Session action handlers (lock-screen/OS controls). Uses refs for
  // currentTime/duration instead of listing them as deps, so this doesn't
  // re-register on every `timeupdate` tick.
  useEffect(() => {
    if (!hasMediaSession()) return;
    const mediaSession = navigator.mediaSession;

    mediaSession.setActionHandler("play", () => play());
    mediaSession.setActionHandler("pause", () => pause());
    mediaSession.setActionHandler("seekbackward", () =>
      setCurrentTime(Math.max(0, currentTimeRef.current - SKIP_SECONDS)),
    );
    mediaSession.setActionHandler("seekforward", () =>
      setCurrentTime(
        Math.min(durationRef.current || Infinity, currentTimeRef.current + SKIP_SECONDS),
      ),
    );
    mediaSession.setActionHandler("seekto", (details) => {
      if (details.seekTime !== undefined) setCurrentTime(details.seekTime);
    });

    return () => {
      mediaSession.setActionHandler("play", null);
      mediaSession.setActionHandler("pause", null);
      mediaSession.setActionHandler("seekbackward", null);
      mediaSession.setActionHandler("seekforward", null);
      mediaSession.setActionHandler("seekto", null);
    };
  }, [play, pause, setCurrentTime]);

  return <audio ref={audioRef} src={audioUrl ?? undefined} preload="metadata" hidden />;
}
