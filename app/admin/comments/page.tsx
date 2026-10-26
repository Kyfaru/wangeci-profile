import type { Metadata } from "next";
import Link from "next/link";

import { feedbackStatusAction, moderateCommentAction, replyToCommentAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { DataTable, pageFrom, type Column } from "@/components/admin/DataTable";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/server/session";
import type { CommentStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Comments" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const FILTERS = ["PENDING", "APPROVED", "REJECTED", "SPAM", "HIDDEN"] as const;
const field = "mt-1 w-full rounded-xl border-black/20 text-sm";

/** Comment queue (newest pending first) and reader feedback. Plain text only: React escapes everything shown here. */
export default async function CommentsPage({ searchParams }: PageProps<"/admin/comments">) {
  await requireRole("comments.moderate");
  const sp = await searchParams;
  const status: CommentStatus = FILTERS.find((f) => f === sp.status) ?? "PENDING";
  const page = pageFrom(sp.page);

  const [rows, total, feedback] = await Promise.all([
    prisma.comment.findMany({
      where: { status, parentId: null },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.comment.count({ where: { status, parentId: null } }),
    prisma.feedback.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 50, include: { user: { select: { name: true } } } }),
  ]);

  const columns: Column<(typeof rows)[number]>[] = [
    {
      key: "comment",
      label: "Comment",
      render: (c) => (
        <div className="space-y-1">
          <p className="text-xs text-black/50">{c.user.name} · {c.postSlug} · {c.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</p>
          <p className="whitespace-pre-wrap">{c.body}</p>
        </div>
      ),
    },
    {
      key: "moderate",
      label: "Moderate",
      render: (c) => (
        <div className="space-y-4">
          <ActionForm action={moderateCommentAction} hidden={{ commentId: c.id }} submitLabel="Apply">
            <select name="status" className={field} defaultValue="APPROVED">
              <option value="APPROVED">Approve</option>
              <option value="REJECTED">Reject</option>
              <option value="SPAM">Mark as spam</option>
              <option value="HIDDEN">Hide</option>
            </select>
          </ActionForm>
          <ActionForm action={replyToCommentAction} hidden={{ commentId: c.id }} submitLabel="Reply" withReason={false}>
            <label className="block text-sm text-black/70">
              Reply as the site
              <textarea name="body" required maxLength={1000} rows={2} className={field} />
            </label>
          </ActionForm>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-[1000px] space-y-8">
      <h1 className="text-3xl font-medium text-black md:text-4xl">Comments</h1>

      <nav aria-label="Filter" className="flex flex-wrap gap-2 text-sm">
        {FILTERS.map((f) => (
          <Link key={f} href={`/admin/comments?status=${f}`} className={`rounded-full border px-4 py-1.5 ${f === status ? "border-navy bg-navy text-white" : "border-black/20 hover:border-navy"}`}>
            {f.toLowerCase()}
          </Link>
        ))}
      </nav>

      <DataTable
        caption="Comments"
        columns={columns}
        rows={rows}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        hrefForPage={(p) => `/admin/comments?status=${status}&page=${p}`}
        empty="No comments in this list."
      />

      <section aria-labelledby="fb" className="rounded-2xl border border-black/10 bg-white p-5">
        <h2 id="fb" className="font-display text-xl text-black">Feedback</h2>
        {feedback.length === 0 ? (
          <p className="mt-2 text-sm text-black/50">No feedback yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/5 text-sm">
            {feedback.map((f) => (
              <li key={f.id} className="space-y-2 py-3">
                <p className="text-xs text-black/50">
                  {f.user.name} · {f.page}{f.rating ? ` · ${f.rating} of 5` : ""} · {f.status.toLowerCase()} · {f.createdAt.toISOString().slice(0, 10)}
                </p>
                <p className="whitespace-pre-wrap">{f.message}</p>
                {f.status === "NEW" && <ActionForm action={feedbackStatusAction} hidden={{ feedbackId: f.id, status: "READ" }} submitLabel="Mark as read" withReason={false} />}
                {f.status !== "ACTIONED" && <ActionForm action={feedbackStatusAction} hidden={{ feedbackId: f.id, status: "ACTIONED" }} submitLabel="Mark as actioned" withReason={false} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

