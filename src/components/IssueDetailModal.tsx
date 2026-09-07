import React, { useState, useEffect, useRef } from "react";
import { Issue, Member, Priority, Status } from "../types";
import {
  X,
  Calendar,
  User,
  Tag,
  AlertTriangle,
  ArrowRight,
  MessageSquare,
} from "lucide-react";

interface IssueDetailModalProps {
  issue: Issue;
  members: Member[];
  categories: string[];
  onClose: () => void;
  onUpdate: (updated: Issue) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

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
      setErrorMsg("标题不能为空");
      return;
    }
    if (!signature.trim()) {
      setErrorMsg("经办落款不能为空");
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

  const getStatusLabel = (s: Status) => {
    switch (s) {
      case "agenda":
        return "议程";
      case "voting":
        return "表决中";
      case "passed":
        return "已通过";
      case "rejected":
        return "已否决";
      case "authorization":
        return "授权";
      case "execution":
        return "执行";
      case "completed":
        return "归档完成";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/50 backdrop-blur-sm">
      <div
        id="issue-detail-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="议题详情"
        className="w-full max-w-2xl bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)] border-2 border-[var(--theme-border,#171717)] flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b-2 border-[var(--theme-border,#171717)] bg-[var(--theme-accent-light,rgba(0,0,0,0.02))]">
          <div className="flex items-center gap-2">
            <span className="font-sans text-xs tracking-normal uppercase px-2 py-0.5 border border-[var(--theme-border,#171717)] bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)]">
              {getStatusLabel(status)}
            </span>
            <span className="font-sans text-xs text-[var(--theme-text-secondary,#525252)]">
              议题详情
            </span>
          </div>
          <button
            id="close-modal-btn"
            aria-label="关闭议题详情"
            disabled={saving}
            onClick={onClose}
            className="p-1 hover:bg-[var(--theme-accent-light,#eaeaea)] border border-transparent hover:border-[var(--theme-border,#171717)] transition-all cursor-pointer"
          >
            <X className="w-5 h-5 text-[var(--theme-text-primary,#171717)]" />
          </button>
        </div>

        {/* Modal Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Form Fields */}
          <div className="space-y-4">
            <div>
              <label className="block font-sans text-xs tracking-normal uppercase text-[var(--theme-text-secondary,#525252)] mb-1">
                议题标题 · 必填
              </label>
              <input
                type="text"
                aria-label="议题标题"
                aria-required="true"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)] font-sans text-lg focus:outline-none focus:bg-[var(--theme-accent-light,rgba(0,0,0,0.01))]"
                placeholder="在此录入议题标题..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="block font-sans text-xs tracking-normal uppercase text-[var(--theme-text-secondary,#525252)] mb-1">
                  议题部门
                </label>
                <select
                  aria-label="议题部门"
                  value={categories.includes(category) ? category : "其他"}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCategory(val === "其他" ? "" : val);
                  }}
                  className="w-full px-3 py-2 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)] font-sans text-xs focus:outline-none mb-2"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {(!categories.includes(category) || category === "其他") && (
                  <input
                    type="text"
                    value={category === "其他" ? "" : category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)] font-sans text-xs focus:outline-none focus:bg-[var(--theme-accent-light,rgba(0,0,0,0.01))]"
                    placeholder="请输入自定义部门..."
                  />
                )}
              </div>

              <div>
                <label className="block font-sans text-xs tracking-normal uppercase text-[var(--theme-text-secondary,#525252)] mb-1">
                  优先级
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full px-3 py-2 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)] font-sans text-xs focus:outline-none"
                >
                  <option value="low">低</option>
                  <option value="medium">中</option>
                  <option value="high">高</option>
                  <option value="urgent">紧急</option>
                </select>
              </div>

              <div>
                <label className="block font-sans text-xs tracking-normal uppercase text-[var(--theme-text-secondary,#525252)] mb-1">
                  状态
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                  className="w-full px-3 py-2 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)] font-sans text-xs focus:outline-none"
                >
                  <option value="agenda">议程 (Agenda)</option>
                  <option value="voting">表决中 (Voting)</option>
                  <option value="passed">已通过 (Passed)</option>
                  <option value="rejected">已否决 (Rejected)</option>
                  <option value="authorization">授权 (Authorization)</option>
                  <option value="execution">执行 (Execution)</option>
                  <option value="completed">归档完成 (Completed)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-sans text-xs tracking-normal uppercase text-[var(--theme-text-secondary,#525252)] mb-1">
                议题阐述与背景
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)] font-sans text-xs focus:outline-none focus:bg-[var(--theme-accent-light,rgba(0,0,0,0.01))] resize-none"
                placeholder="详细阐述议题的相关背景、遇到的障碍与核心待议事宜..."
              />
            </div>
          </div>

          <hr className="border-t-2 border-[var(--theme-border,#171717)] opacity-30" />

          {/* Discussion & Resolution */}
          <label className="workspace-field">
            <span>执行截止日期</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <MessageSquare className="w-4 h-4 text-[var(--theme-text-primary,#171717)]" />
                <label className="block font-sans text-xs tracking-normal uppercase text-[var(--theme-text-primary,#171717)] font-bold">
                  会商决议与执行要点
                </label>
              </div>
              <textarea
                value={discussion}
                onChange={(e) => setDiscussion(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)] font-sans text-xs focus:outline-none focus:bg-[var(--theme-accent-light,rgba(0,0,0,0.01))]"
                placeholder="在此记录例会就此议题达成的一致结论、行动决议或指导意见..."
              />
            </div>

            {/* Signature / 落款 */}
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <User className="w-4 h-4 text-[var(--theme-text-primary,#171717)]" />
                <label className="block font-sans text-xs tracking-normal uppercase text-[var(--theme-text-primary,#171717)] font-bold">
                  经办落款 · 必填
                </label>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <select
                    aria-label="指派经办成员"
                    value={
                      members.some(
                        (m) => m.name === signature || m.id === signature,
                      )
                        ? signature
                        : ""
                    }
                    onChange={(e) => setSignature(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)] font-sans text-xs focus:outline-none"
                  >
                    <option value="">-- 指派参会成员 --</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name} [{m.role}]
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <input
                    type="text"
                    aria-label="经办落款"
                    aria-required="true"
                    value={signature}
                    onChange={(e) => setSignature(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-card-bg,#ffffff)] text-[var(--theme-text-primary,#171717)] font-sans text-xs focus:outline-none focus:bg-[var(--theme-accent-light,rgba(0,0,0,0.01))]"
                    placeholder="或手写其他执行落款..."
                  />
                </div>
              </div>
              <p className="mt-1 text-xs text-[var(--theme-text-secondary,#525252)] font-sans">
                *
                每次状态流转或修改，均需指明明确的执行负责人或经办代表，确立核心责任。
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 border-2 border-[var(--theme-border,#171717)] bg-red-50 text-red-700 font-sans text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-700" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex flex-wrap gap-4 text-xs font-sans text-[var(--theme-text-secondary,#525252)] pt-4 border-t border-neutral-100">
            <div>
              创建于: {new Date(issue.createdAt).toLocaleString("zh-CN")}
            </div>
            <div>
              更新于: {new Date(issue.updatedAt).toLocaleString("zh-CN")}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t-2 border-[var(--theme-border,#171717)] bg-[var(--theme-accent-light,rgba(0,0,0,0.02))] flex items-center justify-between">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2 border-2 border-red-500 bg-red-50 p-2 text-xs font-sans">
              <span className="text-red-700 font-bold">
                确定要彻底删除该议题吗？此操作不可逆。
              </span>
              <button
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
                className="px-2 py-1 bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer font-bold"
              >
                确定删除
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 border border-neutral-300 text-neutral-600 hover:text-neutral-950 bg-white transition-all cursor-pointer font-bold"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              id="delete-issue-btn"
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 border border-neutral-400 text-neutral-500 hover:text-red-600 hover:border-red-600 text-xs font-sans transition-colors cursor-pointer"
            >
              彻底删除
            </button>
          )}

          <div className="flex gap-2">
            <button
              id="cancel-modal-btn"
              disabled={saving}
              onClick={onClose}
              className="px-4 py-2 border border-[var(--theme-border,#171717)] hover:bg-[var(--theme-accent-light,#eaeaea)] text-xs font-sans transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              id="save-issue-btn"
              disabled={saving}
              onClick={handleSave}
              className="px-4 py-2 border-2 border-[var(--theme-border,#171717)] bg-[var(--theme-accent,#171717)] text-white hover:opacity-90 text-xs font-bold font-sans transition-colors flex items-center gap-1 cursor-pointer"
            >
              存盘落款 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
