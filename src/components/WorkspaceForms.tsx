import React, { useContext, useEffect, useId, useRef, useState } from "react";

/**
 * A button that runs an async action and shows "正在保存…" while it runs.
 * ARIA attributes such as aria-pressed or aria-label pass through to the
 * button; aria-busy is managed here.
 */
export function Action({
  children,
  onClick,
  className = "",
  disabled = false,
  ...aria
}: {
  children: React.ReactNode;
  onClick: () => void | Promise<unknown>;
  className?: string;
  disabled?: boolean;
} & Omit<React.AriaAttributes, "aria-busy">) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      {...aria}
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

/** Builds a field's error message from its label. */
type FieldMessage = (label: string) => string;

/**
 * Validation errors of the enclosing SaveForm, keyed by control id. A Field
 * shows the error of its own control.
 */
const FieldErrorsContext = React.createContext<Record<string, FieldMessage>>(
  {},
);

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** The message for a control that fails its constraints (required, type, min…). */
function validationMessage(control: Control): FieldMessage {
  const { validity } = control;
  const input = control instanceof HTMLInputElement ? control : null;
  const choose =
    control instanceof HTMLSelectElement ||
    input?.type === "file" ||
    input?.type === "checkbox" ||
    input?.type === "radio";
  if (validity.valueMissing)
    return (label) => `请${choose ? "选择" : "填写"}${label}`;
  if (validity.typeMismatch && input?.type === "url")
    return (label) => `${label}需要是完整网址，以 https:// 开头`;
  if (validity.typeMismatch && input?.type === "email")
    return (label) => `${label}需要是有效的邮箱地址`;
  if (validity.rangeUnderflow && input)
    return (label) => `${label}不能小于 ${input.min}`;
  if (validity.rangeOverflow && input)
    return (label) => `${label}不能大于 ${input.max}`;
  if (validity.stepMismatch && input?.step === "1")
    return (label) => `${label}需要是整数`;
  if (validity.tooShort && !(control instanceof HTMLSelectElement))
    return (label) => `${label}至少需要 ${control.minLength} 个字`;
  if (validity.tooLong && !(control instanceof HTMLSelectElement))
    return (label) => `${label}最多 ${control.maxLength} 个字`;
  return (label) => `${label}的格式不正确`;
}

/**
 * A form group: label, optional hint and error, then the control. The label
 * points at the control with htmlFor, and the hint and the error message are
 * tied to it with aria-describedby. Inside a SaveForm, a failed check on the
 * control shows here as the error.
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
  const formErrors = useContext(FieldErrorsContext);
  if (!React.isValidElement<ControlProps>(children)) {
    // Several children (e.g. a control and a status line): the label wraps them.
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
  const message = error || formErrors[controlId]?.(label);
  const hintId = hint ? `${id}-hint` : "";
  const errorId = message ? `${id}-error` : "";
  const describedBy = [children.props["aria-describedby"], hintId, errorId]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={`workspace-field${message ? " workspace-field--error" : ""}`}>
      <label className="workspace-label" htmlFor={controlId}>
        {label}
      </label>
      {hint && (
        <p id={hintId} className="workspace-help">
          {hint}
        </p>
      )}
      {message && (
        <p id={errorId} className="workspace-field-error">
          <span className="ac-visually-hidden">错误：</span>
          {message}
        </p>
      )}
      {React.cloneElement(children, {
        id: controlId,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": message ? true : children.props["aria-invalid"],
      })}
    </div>
  );
}

/** An empty state: one or two plain sentences on a secondary background. */
export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="workspace-empty">{children}</div>;
}

/**
 * A form with 保存 and 取消. The browser's own validation bubbles are off:
 * on submit the form checks each control's constraints (required, type,
 * min…), shows the failures as errors on their Fields and moves focus to the
 * first one. Errors from onSave show as an alert under the fields.
 */
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, FieldMessage>>(
    {},
  );
  const focusFirstError = useRef("");
  const errorId = `${useId()}-error`;

  // Focus the first invalid control once its error message is rendered, so
  // the message is read with it.
  useEffect(() => {
    if (!focusFirstError.current) return;
    document.getElementById(focusFirstError.current)?.focus();
    focusFirstError.current = "";
  }, [fieldErrors]);

  return (
    <FieldErrorsContext.Provider value={fieldErrors}>
      <form
        className="workspace-form"
        noValidate
        aria-describedby={error ? errorId : undefined}
        onInput={(event) => {
          // A corrected control loses its error straight away.
          const control = event.target as Control;
          if (control.id && fieldErrors[control.id] && control.validity?.valid)
            setFieldErrors((previous) => {
              const next = { ...previous };
              delete next[control.id];
              return next;
            });
        }}
        onSubmit={async (event) => {
          event.preventDefault();
          const invalid = Array.from(event.currentTarget.elements).filter(
            (element): element is Control =>
              (element instanceof HTMLInputElement ||
                element instanceof HTMLSelectElement ||
                element instanceof HTMLTextAreaElement) &&
              element.willValidate &&
              !element.validity.valid,
          );
          if (invalid.length) {
            setError(
              invalid.some((control) => !control.id)
                ? "请检查并填写必填项。"
                : "",
            );
            focusFirstError.current = invalid[0].id;
            if (!invalid[0].id) invalid[0].focus();
            setFieldErrors(
              Object.fromEntries(
                invalid
                  .filter((control) => control.id)
                  .map((control) => [control.id, validationMessage(control)]),
              ),
            );
            return;
          }
          setFieldErrors({});
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
    </FieldErrorsContext.Provider>
  );
}
