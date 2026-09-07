import { Inbox } from "lucide-react";
import React, { useState } from "react";
export function Action({
  children,
  onClick,
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void | Promise<unknown>;
  className?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={`workspace-button ${className}`}
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } catch {
          /* The workspace retains and displays the error. */
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "正在保存…" : children}
    </button>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="workspace-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="workspace-empty">
      <span className="empty-icon">
        <Inbox size={25} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <div>{children}</div>
    </div>
  );
}
export function SaveForm({
  onSave,
  children,
  onCancel,
}: {
  onSave: () => Promise<void>;
  children: React.ReactNode;
  onCancel?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="workspace-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
          await onSave();
        } catch (err) {
          setError(err instanceof Error ? err.message : "保存失败");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="workspace-fields">{children}</div>
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      <div className="workspace-actions">
        {onCancel && (
          <button
            type="button"
            disabled={busy}
            className="workspace-button"
            onClick={onCancel}
          >
            取消
          </button>
        )}
        <button
          disabled={busy}
          className="workspace-button primary"
          type="submit"
        >
          {busy ? "正在保存…" : "保存"}
        </button>
      </div>
    </form>
  );
}
