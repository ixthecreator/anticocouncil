import type { EditorialItem, EditorialSubmission } from "../types";

export const MAX_MANUSCRIPT_LENGTH = 100_000;
export type SubmissionDraft = Pick<EditorialItem, "title" | "author" | "department"> &
  Pick<EditorialSubmission, "content" | "url" | "contact">;

export function validateSubmission(value: unknown): asserts value is EditorialSubmission {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("投稿内容格式无效。");
  const row = value as Record<string, unknown>;
  const limits = { content: MAX_MANUSCRIPT_LENGTH, url: 2048, contact: 200, submittedAt: 40, updatedAt: 40 };
  for (const [key, limit] of Object.entries(limits)) {
    if (typeof row[key] !== "string" || row[key].length > limit)
      throw new Error("投稿字段格式无效或超过长度限制。");
  }
  const submission = value as EditorialSubmission;
  if (!submission.content.trim() && !submission.url.trim())
    throw new Error("请填写稿件正文或稿件链接。");
  if (submission.url) {
    let url: URL;
    try { url = new URL(submission.url); }
    catch { throw new Error("稿件链接需要是完整的 http:// 或 https:// 网址。"); }
    if (!["https:", "http:"].includes(url.protocol))
      throw new Error("稿件链接需要是完整的 http:// 或 https:// 网址。");
  }
  for (const date of [submission.submittedAt, submission.updatedAt]) {
    if (!/^\d{4}-\d{2}-\d{2}T/.test(date) || !Number.isFinite(Date.parse(date)))
      throw new Error("投稿保存时间无效。");
  }
}

function sameSubmission(a: EditorialSubmission | undefined, b: EditorialSubmission | undefined): boolean {
  return a === b || (!!a && !!b &&
    a.content === b.content && a.url === b.url && a.contact === b.contact &&
    a.submittedAt === b.submittedAt && a.updatedAt === b.updatedAt);
}

/** Runs inside workspace.change's cloud transaction, preserving the latest schedule. */
export function saveEditorialSubmission(
  latest: EditorialItem | null,
  expected: EditorialItem | null,
  id: string,
  draft: SubmissionDraft,
  now: string,
): EditorialItem {
  if (expected) {
    if (!latest) throw new Error("投稿记录已被删除，请保留正文并重新投稿。");
    if (!sameSubmission(latest.submission, expected.submission) ||
        latest.title !== expected.title || latest.author !== expected.author ||
        latest.department !== expected.department)
      throw new Error("投稿已被其他成员修改，请复制当前正文，取消后重新打开。");
  } else if (latest) {
    throw new Error("投稿编号已存在，请重新打开后修改。");
  }
  const title = draft.title.trim();
  const author = draft.author.trim();
  if (!title || title.length > 200) throw new Error("请填写投稿标题，最多 200 个字。");
  if (!author || author.length > 80) throw new Error("请填写作者姓名，最多 80 个字。");
  if (!["微信编辑部", "QQ编辑部"].includes(draft.department))
    throw new Error("请选择有效的编辑部。");
  const submission: EditorialSubmission = {
    content: draft.content.trim(),
    url: draft.url.trim(),
    contact: draft.contact.trim(),
    submittedAt: latest?.submission?.submittedAt || now,
    updatedAt: now,
  };
  validateSubmission(submission);
  return {
    ...(latest || { id, editor: "", designer: "", dueDate: "", status: "撰稿" as const, notes: "" }),
    title, author, department: draft.department, submission,
  };
}

/** Schedule forms may have opened before a manuscript was submitted or revised. */
export function saveEditorialSchedule(
  latest: EditorialItem | null, draft: EditorialItem, expected: EditorialItem | null,
): EditorialItem {
  if (expected && !latest) throw new Error("选题已被删除，请保留输入内容并重新打开。");
  if (!expected && latest) throw new Error("选题编号已存在，请重新打开。");
  const fields = ["title", "department", "author", "editor", "designer", "dueDate", "status", "notes"] as const;
  if (expected && latest && fields.some(key => latest[key] !== expected[key]))
    throw new Error("编辑安排已被其他成员修改，请取消后重新打开。");
  const { submission: _staleSubmission, ...schedule } = draft;
  return { ...latest, ...schedule };
}

export function matchesEditorial(row: EditorialItem, search: string): boolean {
  const query = search.toLowerCase();
  return [row.title, row.department, row.author, row.editor, row.designer,
    row.dueDate, row.status, row.notes, ...Object.values(row.submission || {})]
    .some(value => value.toLowerCase().includes(query));
}
