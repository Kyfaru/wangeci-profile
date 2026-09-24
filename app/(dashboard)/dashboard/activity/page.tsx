import type { ComponentType } from "react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { FlameIcon, HeadphoneIcon, TrophyIcon } from "@/components/dashboard/icons";
import { Card, SectionHeading, StarIcon } from "@/components/ui";
import { CartIcon, BookIcon, BookmarkIcon } from "@/components/layout/icons";
import { ClockIcon } from "@/components/store/icons";
import {
  findEditionById,
  type ListeningChapter,
  type ReadingChapter,
} from "@/lib/mock-books";
import { getLibraryForUser } from "@/lib/mock-user";
import { getActivityForUser, type ActivityType } from "@/lib/mock-activity";
import { CURRENT_USER_ID } from "@/lib/dashboard/current-user";

export const metadata: Metadata = {
  title: "My Activity — Felister Wangechi Kariuki",
};

const WORDS_PER_MINUTE = 200;

/**
 * Estimated hours engaged, derived from real fixture data: for each library
 * item, the fraction of the edition actually consumed (`progressPercent`)
 * applied to that edition's total word count (ebook, at a 200wpm assumption)
 * or total audio duration (audiobook). There's no time-tracking fixture to
 * read this from directly, so this is a computed estimate rather than a
 * stored stat.
 */
function estimateHoursEngaged(userId: string): number {
  const library = getLibraryForUser(userId);
  let totalHours = 0;

  for (const item of library) {
    const found = findEditionById(item.editionId);
    if (!found) continue;
    const fraction = item.progressPercent / 100;

    if (item.format === "ebook") {
      const chapters = found.edition.chapters as ReadingChapter[];
      const totalWords = chapters.reduce((sum, c) => sum + c.wordCount, 0);
      totalHours += (totalWords * fraction) / WORDS_PER_MINUTE / 60;
    } else {
      const chapters = found.edition.chapters as ListeningChapter[];
      const totalSeconds = chapters.reduce(
        (sum, c) => sum + c.durationSeconds,
        0,
      );
      totalHours += (totalSeconds * fraction) / 3600;
    }
  }

  return totalHours;
}

const ACTIVITY_ICONS: Record<ActivityType, ComponentType<{ className?: string }>> = {
  purchase: CartIcon,
  "reading-milestone": BookIcon,
  "listening-milestone": HeadphoneIcon,
  bookmark: BookmarkIcon,
  review: StarIcon,
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * `/dashboard/activity` — no dedicated Figma frame (see build brief): stats
 * row (hours engaged, books completed, streak) + a timeline from
 * `lib/mock-activity.ts`.
 *
 * Judgment call: "streak" has no backing fixture field anywhere in this
 * codebase (activity entries span months, not consecutive days), so it's
 * shown as a static illustrative placeholder rather than computed from
 * data that doesn't represent a real daily cadence — flagged here and in
 * the final report rather than silently faked as if it were real.
 */
export default function DashboardActivityPage() {
  const library = getLibraryForUser(CURRENT_USER_ID);
  const activity = getActivityForUser(CURRENT_USER_ID);
  const booksCompleted = library.filter((i) => i.status === "completed").length;
  const hoursEngaged = estimateHoursEngaged(CURRENT_USER_ID);
  const placeholderStreakDays = 3;

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-8">
      <SectionHeading as="h1" eyebrow="Your progress">
        My Activity
      </SectionHeading>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card padding="lg" className="flex items-center gap-4">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
            <ClockIcon className="size-5" />
          </span>
          <div>
            <p className="font-display text-2xl text-navy">
              {hoursEngaged.toFixed(1)}
            </p>
            <p className="text-sm text-gray">Hours engaged</p>
          </div>
        </Card>

        <Card padding="lg" className="flex items-center gap-4">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-green/15 text-green">
            <TrophyIcon className="size-5" />
          </span>
          <div>
            <p className="font-display text-2xl text-navy">{booksCompleted}</p>
            <p className="text-sm text-gray">Books completed</p>
          </div>
        </Card>

        <Card padding="lg" className="flex items-center gap-4">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-gold-bright/20 text-gold">
            <FlameIcon className="size-5" />
          </span>
          <div>
            <p className="font-display text-2xl text-navy">
              {placeholderStreakDays}-day
            </p>
            <p className="text-sm text-gray">Current streak</p>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-display text-xl text-navy">Recent activity</h2>
        {activity.length === 0 ? (
          <EmptyState message="No activity yet — start reading or listening to see it here." />
        ) : (
          <div className="flex flex-col gap-3">
            {activity.map((entry) => {
              const Icon = ACTIVITY_ICONS[entry.type];
              return (
                <Card key={entry.id} padding="sm" className="flex items-center gap-3.5">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-navy/5 text-navy">
                    <Icon className="size-4.5" />
                  </span>
                  <p className="min-w-0 flex-1 text-sm text-navy">{entry.message}</p>
                  <span className="shrink-0 text-xs text-gray">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
