import { useEffect, useRef, useState } from "react";
import { cloudAccessError, requestPasswordReset, setSitePassword, type CloudIdentity } from "../lib/cloudAccess";

const emailNotice = "如果此邮箱对应本站账号，密码邮件将发送到收件箱。请检查收件箱及垃圾邮件，并按邮件中的链接操作。";

function useResendDelay() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!seconds) return;
    const timer = window.setTimeout(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);
  return { seconds, start: () => setSeconds(60) };
}

export function PasswordRecoveryForm({ setup = false, initialEmail, onBack }: { setup?: boolean; initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const delay = useResendDelay();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <>
    <h1 ref={heading} tabIndex={-1}>{setup ? "给 Google 账号设置本站密码" : "找回本站密码"}</h1>
    <p>{setup ? "输入你曾用于 Google 登录本站的邮箱，通过邮件为原账号设置密码。完成后使用邮箱和新密码登录，原有成员权限保留。" : "输入注册时使用的邮箱，我们将通过邮件链接帮助你重设本站密码。"}</p>
    <form className="cloud-auth-form" onSubmit={async event => {
      event.preventDefault();
      if (busy || delay.seconds) return;
      setBusy(true); setError(""); setSent(false);
      try { await requestPasswordReset(email); setSent(true); delay.start(); }
      catch (err) { setError(cloudAccessError(err)); }
      finally { setBusy(false); }
    }}>
      <label>账号邮箱<input required type="email" autoComplete="email" value={email} onChange={event => { setEmail(event.target.value); setSent(false); setError(""); }} disabled={busy}/></label>
      <button type="submit" className="cloud-button primary" disabled={busy || delay.seconds > 0}>{busy ? "正在提交…" : delay.seconds ? `${delay.seconds} 秒后可重新发送` : setup ? "发送密码设置邮件" : "发送密码重置邮件"}</button>
    </form>
    {sent && <p className="cloud-notice" role="status">{emailNotice}</p>}
    {error && <p className="cloud-error" role="alert">{error}</p>}
    <div className="cloud-password-note">
      <p>邮件包含操作链接，无需输入数字验证码。链接过期时，请重新发送。邮件重置完成后，请用邮箱和新密码登录。</p>
      <p>邮件重置可能改变原 Google 登录关联。如果现在可以通过 Google 登录，建议登录后在账号菜单中选择「设置本站密码」，这样可以保留两种登录方式。</p>
    </div>
    <button type="button" className="cloud-button cloud-back-button" disabled={busy} onClick={onBack}>← 返回登录</button>
  </>;
}

export function PasswordSettingsDialog({ identity, onClose }: { identity: CloudIdentity; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const delay = useResendDelay();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => { previous?.focus(); };
  }, []);
  useEffect(() => {
    if (busy) panel.current?.focus();
    else if (saved) panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [busy, saved]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
      if (event.key !== "Tab") return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)") || []);
      if (!controls.length || busy) { event.preventDefault(); panel.current?.focus(); return; }
      if (!panel.current?.contains(document.activeElement) || document.activeElement === panel.current) { event.preventDefault(); (event.shiftKey ? controls.at(-1) : controls[0])?.focus(); return; }
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [busy, onClose]);
  return <div className="cloud-modal-backdrop"><div ref={panel} tabIndex={-1} className="cloud-members cloud-password-dialog" role="dialog" aria-modal="true" aria-labelledby="cloud-password-title" aria-busy={busy}>
    <header><div><span className="cloud-eyebrow">ACCOUNT SECURITY</span><h2 id="cloud-password-title">设置本站密码</h2></div><button type="button" className="cloud-button" disabled={busy} onClick={onClose}>关闭</button></header>
    <p className="cloud-password-email">{identity.email}</p>
    <p>使用 Google 登录的账号可添加独立密码，并继续保留 Google 登录；已有本站密码的账号可在此修改密码。成员身份和权限保持原样。</p>
    {!saved && <form className="cloud-auth-form" onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      setBusy(true); setError(""); setNotice("");
      try { await setSitePassword(password, confirmation, identity); setSaved(true); setNotice("本站密码已保存。以后可以使用此邮箱和新密码登录。"); }
      catch (err) { setError(cloudAccessError(err)); }
      finally { setPassword(""); setConfirmation(""); setBusy(false); }
    }}>
      <label>新密码<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy}/></label>
      <label>再次输入新密码<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy}/></label>
      <p className="cloud-help">至少 8 位。这是本站独立密码，无需填写 Google 或邮箱本身的密码。</p>
      <button type="submit" className="cloud-button primary" disabled={busy}>{busy ? "正在保存…" : "保存本站密码"}</button>
    </form>}
    {notice && <p className="cloud-notice" role="status">{notice}</p>}
    {error && <p className="cloud-error" role="alert">{error}</p>}
    {!saved && <div className="cloud-password-note"><p>如提示需要重新登录，请重新登录后再设置；也可以向当前邮箱发送重置链接，按邮件完成后使用邮箱登录。邮件重置可能改变原 Google 登录关联。</p><button type="button" className="cloud-button" disabled={busy || delay.seconds > 0} onClick={async () => {
      if (busy || delay.seconds) return;
      setBusy(true); setError(""); setNotice(""); setPassword(""); setConfirmation("");
      try { await requestPasswordReset(identity.email); setNotice(emailNotice); delay.start(); }
      catch (err) { setError(cloudAccessError(err)); }
      finally { setBusy(false); }
    }}>{delay.seconds ? `${delay.seconds} 秒后可重新发送` : "向当前邮箱发送重置链接"}</button></div>}
  </div></div>;
}
