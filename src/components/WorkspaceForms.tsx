import React, { useId, useState } from "react";
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
      className={["workspace-button", className].filter(Boolean).join(" ")}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
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

type ControlProps = {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
};

/**
 * A form group. Without a hint or an error the label wraps the control.
 * With either, the label points at the control with htmlFor, and the hint
 * and the error message are tied to it with aria-describedby.
 */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  /** Optional hint shown under the label. */
  hint?: React.ReactNode;
  /** Optional error message; marks the control invalid. */
  error?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  if ((!hint && !error) || !React.isValidElement<ControlProps>(children)) {
    return (
      <label className={`workspace-field${error ? " workspace-field--error" : ""}`}>
        <span className="workspace-label">{label}</span>
        {hint && <span className="workspace-help">{hint}</span>}
        {error && <span className="workspace-field-error">{error}</span>}
        {children}
      </label>
    );
  }
  const controlId = children.props.id || `${id}-control`;
  const hintId = hint ? `${id}-hint` : "";
  const errorId = error ? `${id}-error` : "";
  const describedBy = [children.props["aria-describedby"], hintId, errorId]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={`workspace-field${error ? " workspace-field--error" : ""}`}>
      <label className="workspace-label" htmlFor={controlId}>
        {label}
      </label>
      {hint && (
        <p id={hintId} className="workspace-help">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="workspace-field-error">
          <span className="ac-visually-hidden">错误：</span>
          {error}
        </p>
      )}
      {React.cloneElement(children, {
        id: controlId,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : children.props["aria-invalid"],
      })}
    </div>
  );
}

/** An empty state: one or two plain sentences on a secondary background. */
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="workspace-empty">{children}</div>;
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
  const errorId = `${useId()}-error`;
  return (
    <form
      className="workspace-form"
      aria-describedby={error ? errorId : undefined}
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
        <p id={errorId} role="alert" className="workspace-error">
          {error}
        </p>
      )}
      <div className="workspace-actions">
        <button
          disabled={busy}
          className="workspace-button primary"
          type="submit"
          aria-describedby={error ? errorId : undefined}
        >
          {busy ? "正在保存…" : "保存"}
        </button>
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
      </div>
    </form>
  );
}
