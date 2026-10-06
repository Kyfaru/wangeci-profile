"use client";

import { useEffect } from "react";

import { useReaderStore, useReadingProgressSync } from "@/lib/stores/reader-store";

/** Starts the saver while the reader is open and clears the live position when it closes. Renders nothing. */
export function ReaderProgressSync() {
  useReadingProgressSync();
  useEffect(() => () => useReaderStore.getState().reset(), []);
  return null;
}
