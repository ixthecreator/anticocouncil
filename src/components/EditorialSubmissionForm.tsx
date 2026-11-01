import { useState, type RefObject } from "react";
import type { EditorialItem } from "../types";
import type { Workspace } from "../lib/useWorkspace";
import { MAX_MANUSCRIPT_LENGTH, saveEditorialSubmission, type SubmissionDraft } from "../lib/editorialSubmission";
import { safeUrl } from "../lib/workspace";
import { Field, SaveForm } from "./WorkspaceForms";

export function EditorialSubmissionForm({
  initial, isNew, workspace, onClose, headingRef,
}: {
  initial: EditorialItem;
  isNew: boolean;
  workspace: Workspace;
  onClose: () => void;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const [draft, setDraft] = useState<SubmissionDraft>(() => ({
    title: initial.title, author: initial.author, department: initial.department,
    content: initial.submission?.content || "",
    url: initial.submission?.url || "",
    contact: initial.submission?.contact || "",
  }));
  const set = <K extends keyof SubmissionDraft>(key: K, value: SubmissionDraft[K]) =>
    setDraft(previous => ({ ...previous, [key]: value }));
  return (
    <SaveForm onCancel={onClose} onSave={async () => {
      const now = new Date().toISOString();
      await workspace.change("editorial", initial.id, latest =>
        saveEditorialSubmission(latest, isNew ? null : initial, initial.id, draft, now));
      onClose();
    }}>
      <h2 ref={headingRef} tabIndex={-1} className="daily-form-title">
        {isNew ? "在线投稿" : "编辑投稿"}
      </h2>
      <p className="workspace-help editorial-submission-help">
        {workspace.mode === "firebase"
          ? "保存后，工作区成员可查看和编辑稿件。请等待云端确认后再关闭页面。"
          : "当前为本地模式，稿件只保存在此浏览器；线上投稿请进入成员工作台。"}
      </p>
      <Field label="投稿标题"><input required maxLength={200} value={draft.title}
        onChange={event => set("title", event.target.value)} /></Field>
      <Field label="作者姓名"><input required maxLength={80} value={draft.author}
        onChange={event => set("author", event.target.value)} /></Field>
      <Field label="投稿编辑部"><select value={draft.department}
        onChange={event => set("department", event.target.value as EditorialItem["department"])}>
        <option>微信编辑部</option><option>QQ编辑部</option>
      </select></Field>
      <Field label="联系方式" hint="选填，可填写邮箱、微信或 QQ，供编辑联系。">
        <input maxLength={200} value={draft.contact}
          onChange={event => set("contact", event.target.value)} />
      </Field>
      <Field label="稿件正文" hint="正文和稿件链接至少填写一项；正文最多 100,000 个字。">
        <textarea rows={14} maxLength={MAX_MANUSCRIPT_LENGTH} value={draft.content}
          onChange={event => set("content", event.target.value)} />
      </Field>
      <Field label="稿件链接" hint="可填写在线文档链接，请确保编辑拥有访问权限。">
        <input type="url" maxLength={2048} placeholder="https://" value={draft.url}
          onChange={event => set("url", event.target.value)} />
      </Field>
    </SaveForm>
  );
}

export function EditorialManuscript({ item }: { item: EditorialItem }) {
  const submission = item.submission;
  if (!submission) return null;
  const date = (value: string) => new Date(value).toLocaleString("zh-CN", { hour12: false });
  return (
    <details className="editorial-manuscript">
      <summary>查看稿件<span className="ac-visually-hidden">：{item.title}</span></summary>
      <div className="editorial-manuscript-body">
        <p className="council-meta">
          投稿时间：<time dateTime={submission.submittedAt}>{date(submission.submittedAt)}</time><br />
          最近保存：<time dateTime={submission.updatedAt}>{date(submission.updatedAt)}</time>
        </p>
        {submission.contact && <p>联系方式：{submission.contact}</p>}
        {submission.url && <p><a className="council-link" href={safeUrl(submission.url)}
          target="_blank" rel="noreferrer">打开稿件链接
          <span className="ac-visually-hidden">：{item.title}（在新窗口打开）</span>
        </a></p>}
        {submission.content && <pre className="editorial-manuscript-text">{submission.content}</pre>}
      </div>
    </details>
  );
}
