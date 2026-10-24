import React, { useState, useEffect, useRef } from "react";
import { Issue, Member, Priority, Status } from "../types";
import { X } from "lucide-react";
import { statusLabels } from "../lib/workspace";
import { StatusTag } from "./CouncilOverview";

interface IssueDetailModalProps {
  issue: Issue;
  members: Member[];
  categories: string[];
  onClose: () => void;
  onUpdate: (updated: Issue) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const TITLE_ERROR = "填写议题标题";
const SIGNATURE_ERROR = "填写经办人";
const statusOrder: Status[] = [
  "agenda",
  "voting",
  "passed",
  "rejected",
  "authorization",
  "execution",
  "completed",
];

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issue,
  members,
  categories,
  onClose,
  onUpdate,
  onDelete,
}) => {
  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description);
  const [category, setCategory] = useState(issue.category);
  const [priority, setPriority] = useState<Priority>(issue.priority);
  const [status, setStatus] = useState<Status>(issue.status);
  const [discussion, setDiscussion] = useState(issue.discussion || "");
  const [signature, setSignature] = useState(issue.signature || "");
  const [errorMsg, setErrorMsg] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dueDate, setDueDate] = useState(issue.dueDate || "");
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("input")?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        panel?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input, textarea, select, a[href]",
        ) || [],
      ).filter((el) => el.offsetParent !== null);
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [saving]);

  const handleSave = async () => {
    if (!title.trim()) {
      setErrorMsg(TITLE_ERROR);
      return;
    }
    if (!signature.trim()) {
      setErrorMsg(SIGNATURE_ERROR);
      return;
    }
    setErrorMsg("");
    setSaving(true);
    try {
      await onUpdate({
        ...issue,
        title: title.trim(),
        description: description.trim(),
        category: category.trim() || "其他",
        priority,
        status,
        discussion: discussion.trim(),
        signature,
        dueDate,
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "保存失败，请重试。");
    } finally {
      setSaving(false);
    }
  };

  const titleError = errorMsg === TITLE_ERROR;
  const signatureError = errorMsg === SIGNATURE_ERROR;
  const customCategory =
    !categories.includes(category) || category === "其他";

  return (
    <div className="issue-dialog-backdrop">
      <div
        id="issue-detail-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="issue-detail-title"
        className="issue-dialog"
      >
        <header className="issue-dialog-header">
          <div className="issue-dialog-heading">
            <h2 id="issue-detail-title">
              {issue.title ? "议题详情" : "新建议题"}
            </h2>
            <p className="council-meta issue-dialog-status">
              {issue.serialNumber && (
                <>
                  <span>编号 {issue.serialNumber}</span>
                  <span className="issue-dialog-status-sep" aria-hidden="true">
                    ·
                  </span>
                </>
              )}
              <span className="issue-dialog-status-item">
                当前状态 <StatusTag status={status} />
              </span>
            </p>
          </div>
          <button
            id="close-modal-btn"
            type="button"
            disabled={saving}
            onClick={onClose}
            className="issue-dialog-close"
          >
            <X aria-hidden="true" />
            关闭<span className="ac-visually-hidden">议题详情</span>
          </button>
        </header>

        <div className="issue-dialog-body">
          <div className="issue-dialog-form">
            <div
              className={`workspace-field${titleError ? " workspace-field--error" : ""}`}
            >
              <label className="workspace-label" htmlFor="issue-title">
                议题标题
              </label>
              {titleError && (
                <p className="workspace-field-error" id="issue-title-error">
                  {TITLE_ERROR}
                </p>
              )}
              <input
                id="issue-title"
                type="text"
                aria-required="true"
                aria-invalid={titleError || undefined}
                aria-describedby={titleError ? "issue-title-error" : undefined}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="workspace-field">
              <label className="workspace-label" htmlFor="issue-category">
                议题部门
              </label>
              <select
                id="issue-category"
                value={categories.includes(category) ? category : "其他"}
                onChange={(e) => {
                  const val = e.target.value;
                  setCategory(val === "其他" ? "" : val);
                }}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {customCategory && (
              <div className="workspace-field">
                <label
                  className="workspace-label"
                  htmlFor="issue-custom-category"
                >
                  部门名称（选填）
                </label>
                <span className="workspace-help" id="issue-custom-category-hint">
                  不在列表中的部门，在这里填写名称；留空则记为“其他”。
                </span>
                <input
                  id="issue-custom-category"
                  type="text"
                  aria-describedby="issue-custom-category-hint"
                  value={category === "其他" ? "" : category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
            )}

            <div className="workspace-field">
              <label className="workspace-label" htmlFor="issue-priority">
                优先级
              </label>
              <select
                id="issue-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
                <option value="urgent">紧急</option>
              </select>
            </div>

            <div className="workspace-field">
              <label className="workspace-label" htmlFor="issue-status">
                状态
              </label>
              <select
                id="issue-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
              >
                {statusOrder.map((value) => (
                  <option key={value} value={value}>
                    {statusLabels[value]}
                  </option>
                ))}
              </select>
            </div>

            <div className="workspace-field">
              <label className="workspace-label" htmlFor="issue-description">
                议题背景（选填）
              </label>
              <span className="workspace-help" id="issue-description-hint">
                说明议题的来由、遇到的问题和需要讨论的事项。
              </span>
              <textarea
                id="issue-description"
                aria-describedby="issue-description-hint"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>

            <div className="workspace-field">
              <label className="workspace-label" htmlFor="issue-due-date">
                执行截止日期（选填）
              </label>
              <input
                id="issue-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="workspace-field">
              <label className="workspace-label" htmlFor="issue-discussion">
                会商决议与执行要点（选填）
              </label>
              <span className="workspace-help" id="issue-discussion-hint">
                记录例会就此议题达成的结论、决议或指导意见。
              </span>
              <textarea
                id="issue-discussion"
                aria-describedby="issue-discussion-hint"
                value={discussion}
                onChange={(e) => setDiscussion(e.target.value)}
                rows={4}
              />
            </div>

            <fieldset
              className={`issue-dialog-fieldset${signatureError ? " workspace-field--error" : ""}`}
              aria-describedby="issue-signature-hint"
            >
              <legend className="workspace-label">经办人</legend>
              <p className="workspace-help" id="issue-signature-hint">
                每次修改状态或内容，都要写明负责执行或经办的成员。
              </p>
              {signatureError && (
                <p className="workspace-field-error" id="issue-signature-error">
                  {SIGNATURE_ERROR}
                </p>
              )}
              <div className="workspace-field">
                <label className="workspace-label" htmlFor="issue-signature-member">
                  从成员中选择
                </label>
                <select
                  id="issue-signature-member"
                  value={
                    members.some(
                      (m) => m.name === signature || m.id === signature,
                    )
                      ? signature
                      : ""
                  }
                  onChange={(e) => setSignature(e.target.value)}
                >
                  <option value="">选择成员</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}（{m.role}）
                    </option>
                  ))}
                </select>
              </div>
              <div className="workspace-field">
                <label className="workspace-label" htmlFor="issue-signature">
                  经办人姓名
                </label>
                <span className="workspace-help" id="issue-signature-name-hint">
                  选择成员后自动填入；不在名单中的经办人可直接填写。
                </span>
                <input
                  id="issue-signature"
                  type="text"
                  aria-required="true"
                  aria-invalid={signatureError || undefined}
                  aria-describedby={
                    signatureError
                      ? "issue-signature-error issue-signature-name-hint"
                      : "issue-signature-name-hint"
                  }
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                />
              </div>
            </fieldset>

            <p className="council-meta issue-dialog-timestamps">
              <span>
                创建于 {new Date(issue.createdAt).toLocaleString("zh-CN")}
              </span>
              <span>
                更新于 {new Date(issue.updatedAt).toLocaleString("zh-CN")}
              </span>
            </p>
          </div>
        </div>

        <footer className="issue-dialog-footer">
          {errorMsg && (
            <div className="workspace-error issue-dialog-error" role="alert">
              <span>{errorMsg}</span>
            </div>
          )}
          {showDeleteConfirm ? (
            <div className="issue-dialog-confirm">
              <p>确定要删除这项议题吗？删除后无法恢复。</p>
              <div className="workspace-actions">
                <button
                  type="button"
                  className="workspace-button danger"
                  disabled={saving}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await onDelete(issue.id);
                      onClose();
                    } catch (err) {
                      setErrorMsg(
                        err instanceof Error ? err.message : "删除失败",
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  确定删除
                </button>
                <button
                  type="button"
                  className="workspace-button"
                  autoFocus
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  保留议题
                </button>
              </div>
            </div>
          ) : (
            <div className="issue-dialog-actions">
              <button
                id="save-issue-btn"
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="workspace-button primary"
              >
                保存
              </button>
              <button
                id="cancel-modal-btn"
                type="button"
                disabled={saving}
                onClick={onClose}
                className="workspace-button"
              >
                取消
              </button>
              <button
                id="delete-issue-btn"
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="workspace-button danger issue-dialog-delete"
              >
                删除议题
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
};
