"use client";

import { useEffect } from "react";
import { useReaderStore, useReadingProgressSync } from "@/lib/stores/reader-store";

/** Wires the reader page into the already-built position store + sync hook. Renders nothing. */
export function ReaderProgressSync({ editionId, chapterIdx }: { editionId: string; chapterIdx: number }) {
  const setPosition = useReaderStore((s) => s.setPosition);

  useEffect(() => {
    setPosition({ editionId, chapterIdx, scrollPosition: 0, charPosition: 0 });
  }, [editionId, chapterIdx, setPosition]);

  useReadingProgressSync();

  return null;
}
