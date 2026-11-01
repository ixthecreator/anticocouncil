import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { EditorialItem } from "../types";
import { EditorialManuscript } from "../components/EditorialSubmissionForm";
import {
  MAX_MANUSCRIPT_LENGTH, matchesEditorial, saveEditorialSchedule,
  saveEditorialSubmission, type SubmissionDraft,
} from "./editorialSubmission";
import { parseBackup } from "./workspace";

const now = "2026-11-01T05:00:00.000Z";
const later = "2026-11-01T06:00:00.000Z";
const draft = (edits: Partial<SubmissionDraft> = {}): SubmissionDraft => ({
  title: "  一篇投稿  ", author: "  作者甲  ", department: "微信编辑部",
  content: "第一段\n\n第二段", url: "", contact: "writer@example.com", ...edits,
});
const submit = () => saveEditorialSubmission(null, null, "submission-1", draft(), now);

test("new submissions persist their full manuscript and round-trip through JSON backup", () => {
  const row = submit();
  expect(row).toMatchObject({
    id: "submission-1", title: "一篇投稿", author: "作者甲", status: "撰稿",
    department: "微信编辑部", editor: "", designer: "", notes: "",
    submission: { content: "第一段\n\n第二段", submittedAt: now, updatedAt: now },
  });
  expect(parseBackup(JSON.parse(JSON.stringify({ editorial: [row] }))).editorial).toEqual([row]);
});

test("link-only submissions work for either department and trim their fields", () => {
  const row = saveEditorialSubmission(null, null, "qq", draft({
    department: "QQ编辑部", content: "  ", url: " https://example.com/manuscript ", contact: " QQ:123 ",
  }), now);
  expect(row.submission).toMatchObject({ content: "", url: "https://example.com/manuscript", contact: "QQ:123" });
});

test("blank manuscripts, invalid links, missing identity and excessive fields are rejected", () => {
  for (const edit of [
    { content: " ", url: "" }, { url: "javascript:alert(1)" }, { url: "file:///稿件" },
    { url: "example.com" }, { title: " " }, { author: "" },
    { content: "稿".repeat(MAX_MANUSCRIPT_LENGTH + 1) }, { contact: "x".repeat(201) },
    { url: "https://example.com/" + "x".repeat(2048) },
  ]) {
    expect(() => saveEditorialSubmission(null, null, "id", draft(edit), now)).toThrow();
  }
});

test("revising a manuscript preserves concurrent schedule edits and first submission time", () => {
  const expected = submit();
  const latest: EditorialItem = { ...expected, status: "排版", editor: "编辑乙", designer: "美工丙", dueDate: "2026-11-08", notes: "已校对" };
  const revised = saveEditorialSubmission(latest, expected, latest.id, draft({ content: "修订正文" }), later);
  expect(revised).toMatchObject({
    status: "排版", editor: "编辑乙", designer: "美工丙", dueDate: "2026-11-08", notes: "已校对",
    submission: { content: "修订正文", submittedAt: now, updatedAt: later },
  });
  expect(expected.submission?.content).toBe("第一段\n\n第二段");
});

test("stale manuscripts or metadata cannot overwrite another member's changes", () => {
  const expected = submit();
  const revised = saveEditorialSubmission(expected, expected, expected.id, draft({ content: "另一位成员的新稿" }), later);
  for (const latest of [revised, { ...expected, author: "新作者" }, { ...expected, title: "新标题" }]) {
    expect(() => saveEditorialSubmission(latest, expected, expected.id, draft(), later)).toThrow("其他成员修改");
  }
  expect(() => saveEditorialSubmission(null, expected, expected.id, draft(), later)).toThrow("已被删除");
  expect(() => saveEditorialSubmission(expected, null, expected.id, draft(), later)).toThrow("编号已存在");
});

test("legacy schedules and backups remain readable and can receive a manuscript", () => {
  const { submission, ...legacy } = submit();
  expect(parseBackup({ editorial: [legacy] }).editorial).toEqual([legacy]);
  const updated = saveEditorialSubmission(legacy, legacy, legacy.id, draft(), now);
  expect(updated.submission).toEqual(submission);
});

test("saving an old schedule preserves a manuscript submitted or revised since it opened", () => {
  const latest = submit();
  const { submission: _submission, ...oldSchedule } = latest;
  const updated = saveEditorialSchedule(latest, { ...oldSchedule, editor: "编辑乙" }, oldSchedule);
  expect(updated.submission).toEqual(latest.submission);
  expect(updated.editor).toBe("编辑乙");
  expect(saveEditorialSchedule(null, oldSchedule, null)).not.toHaveProperty("submission");
});

test("backup import rejects malformed, unsafe and oversized manuscripts before writing", () => {
  const row = submit();
  for (const submission of [
    null, "text", [], {}, { ...row.submission, content: {} },
    { ...row.submission, content: "x".repeat(MAX_MANUSCRIPT_LENGTH + 1) },
    { ...row.submission, content: "", url: "" }, { ...row.submission, url: "data:text/html,hi" },
    { ...row.submission, submittedAt: "yesterday" }, { ...row.submission, updatedAt: 4 },
  ]) {
    expect(() => parseBackup({ editorial: [{ ...row, submission }] })).toThrow();
  }
});

test("search matches manuscript content and contact details as well as legacy schedules", () => {
  const row = submit();
  expect(matchesEditorial(row, "第二段")).toBe(true);
  expect(matchesEditorial(row, "WRITER@EXAMPLE.COM")).toBe(true);
  expect(matchesEditorial(row, "找不到")).toBe(false);
  const { submission: _submission, ...legacy } = row;
  expect(matchesEditorial(legacy, "投稿")).toBe(true);
});

test("manuscript display escapes user HTML, preserves text and opens safe external links", () => {
  const item = saveEditorialSubmission(null, null, "html", draft({
    content: '<script>alert("x")</script>\n第二段', url: "https://example.com/draft",
  }), now);
  const html = renderToStaticMarkup(createElement(EditorialManuscript, { item }));
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).toContain('rel="noreferrer"');
  expect(html).toContain('href="https://example.com/draft"');
  expect(html).toContain("查看稿件");
  expect(html).toContain("writer@example.com");
});

test("a stale schedule cannot overwrite changed metadata or recreate a deleted topic", () => {
  const expected = submit();
  expect(() => saveEditorialSchedule({ ...expected, title: "作者的新标题" }, expected, expected)).toThrow("其他成员修改");
  expect(() => saveEditorialSchedule(null, expected, expected)).toThrow("已被删除");
});
