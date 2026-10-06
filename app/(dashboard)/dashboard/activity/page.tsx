import type { Metadata } from "next";

import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { getLibrary } from "@/lib/library";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "My Activity" };
export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  login: "Signed in",
  "login.blocked": "A sign-in was blocked because you were already signed in elsewhere",
  "session.replaced": "Signed out your other device",
};

/** Reading and listening stats from saved positions, plus a short security log of your own sign-ins. */
export default async function ActivityPage() {
  const user = await requireUser();
  const [library, events] = await Promise.all([
    getLibrary(user.id),
    prisma.activityEvent.findMany({ where: { userId: user.id, type: { in: Object.keys(EVENT_LABELS) } }, orderBy: { createdAt: "desc" }, take: 15, select: { id: true, type: true, createdAt: true } }),
  ]);

  const inProgress = library.filter((i) => i.status === "in-progress").length;
  const completed = library.filter((i) => i.status === "completed").length;
  const stats: [string, number][] = [["Books you own", library.length], ["In progress", inProgress], ["Completed", completed]];

  return (
    <>
      <DashboardTopbar />
      <div className="px-6 py-10 md:px-10">
        <h1 className="text-3xl font-medium text-black md:text-4xl">My Activity</h1>

        <dl className="mt-8 grid max-w-[760px] gap-4 sm:grid-cols-3">
          {stats.map(([label, n]) => (
            <div key={label} className="rounded-2xl border border-black/10 bg-white p-5">
              <dt className="text-sm text-black/60">{label}</dt>
              <dd className="mt-1 font-display text-4xl text-navy">{n}</dd>
            </div>
          ))}
        </dl>

        {library.length > 0 && (
          <section className="mt-10 max-w-[760px]">
            <h2 className="font-display text-2xl text-black">Progress</h2>
            <ul className="mt-4 space-y-4">
              {library.map((i) => (
                <li key={i.editionId}>
                  <div className="flex justify-between text-black">
                    <span>{i.title} ({i.format === "ebook" ? "ebook" : "audiobook"})</span>
                    <span className="font-display text-gold">{Math.round(i.progressPercent)}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-line">
                    <div className="h-2 rounded-full bg-gold-bright" style={{ width: `${i.progressPercent}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10 max-w-[760px]">
          <h2 className="font-display text-2xl text-black">Recent sign-in activity</h2>
          {events.length === 0 ? (
            <p className="mt-3 text-black/60">Nothing yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-black/10 rounded-2xl border border-black/10 bg-white">
              {events.map((e) => (
                <li key={e.id} className="flex justify-between gap-4 px-5 py-3 text-black">
                  <span>{EVENT_LABELS[e.type]}</span>
                  <span className="shrink-0 text-sm text-black/50">{e.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
