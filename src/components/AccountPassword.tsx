import { useEffect, useRef, useState } from "react";
import type { CloudIdentity } from "../lib/accessPolicy";
import { cloudBackend, type EmailCodeChallenge, type PasswordResetChallenge } from "../lib/cloudBackend";

const emailNotice = "如果此邮箱对应本站账号，密码邮件将发送到收件箱。请检查收件箱及垃圾邮件，并按邮件中的链接操作。";
const codeNotice = "如果此邮箱对应本站账号，验证码将发送到收件箱。请检查收件箱及垃圾邮件。";
// A service that confirms email addresses with a code resets passwords with one too.
const codeProof = cloudBackend.emailProof === "code";

export function useResendDelay(initialSeconds = 0) {
  const [seconds, setSeconds] = useState(initialSeconds);
  useEffect(() => {
    if (!seconds) return;
    const timer = window.setTimeout(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);
  return { seconds, start: () => setSeconds(60) };
}

function CodeInput({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <label>邮件验证码<input required inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={value} onChange={event => onChange(event.target.value)} disabled={disabled}/></label>;
}
function ResendCodeButton({ resend, onError, onSent, disabled }: { resend: () => Promise<void>; onError: (message: string) => void; onSent: () => void; disabled: boolean }) {
  // The code that started the step was sent just now.
  const delay = useResendDelay(60);
  const [busy, setBusy] = useState(false);
  return <button type="button" className="ac-focus--link" disabled={disabled || busy || delay.seconds > 0} onClick={async () => {
    setBusy(true);
    try { await resend(); delay.start(); onSent(); }
    catch (err) { onError(cloudBackend.accessErrorMessage(err)); }
    finally { setBusy(false); }
  }}>{busy ? "正在发送…" : delay.seconds ? `${delay.seconds} 秒后可重新发送验证码` : "重新发送验证码"}</button>;
}

// The second step of a code-based registration. A confirmed code signs the new account in.
export function RegistrationCodeForm({ challenge, onBack }: { challenge: EmailCodeChallenge; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <>
    <h1 ref={heading} tabIndex={-1}>输入邮箱验证码</h1>
    <p>验证码已发送至 <strong>{challenge.email}</strong>。请查看收件箱或垃圾邮件文件夹，输入邮件中的数字完成注册。</p>
    <form className="cloud-auth-form" onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      setBusy(true); setError(""); setNotice("");
      try { await challenge.confirm(code); }
      catch (err) { setError(cloudBackend.accessErrorMessage(err)); }
      finally { setBusy(false); }
    }}>
      <CodeInput value={code} onChange={setCode} disabled={busy}/>
      <button type="submit" className="cloud-button primary" disabled={busy}>{busy ? "正在验证…" : "完成注册"}</button>
    </form>
    <div className="cloud-password-links"><ResendCodeButton resend={() => challenge.resend()} disabled={busy} onSent={() => { setError(""); setNotice("新的验证码已发送，请使用最新一封邮件中的验证码。"); }} onError={message => { setNotice(""); setError(message); }}/></div>
    {notice && <p className="cloud-notice" role="status">{notice}</p>}
    {error && <p className="cloud-error" role="alert">{error}</p>}
    <button type="button" className="cloud-button cloud-back-button" disabled={busy} onClick={onBack}>← 返回修改注册信息</button>
  </>;
}

// The second step of a code-based password reset: the emailed code and the new password.
function PasswordCodeForm({ challenge, submitLabel, onSaved }: { challenge: PasswordResetChallenge; submitLabel: string; onSaved?: () => void }) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const form = useRef<HTMLFormElement>(null);
  // The form replaces the button that sent the code, so focus moves into it.
  useEffect(() => { form.current?.querySelector("input")?.focus(); }, []);
  return <>
    <form ref={form} className="cloud-auth-form" onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      setBusy(true); setError(""); setNotice("");
      try { await challenge.confirm(code, password, confirmation); onSaved?.(); }
      catch (err) { setError(cloudBackend.accessErrorMessage(err)); }
      finally { setBusy(false); setPassword(""); setConfirmation(""); }
    }}>
      <CodeInput value={code} onChange={setCode} disabled={busy}/>
      <label>新密码<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" aria-describedby="cloud-code-password-hint" value={password} onChange={event => setPassword(event.target.value)} disabled={busy}/></label>
      <label>再次输入新密码<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy}/></label>
      <p className="cloud-help" id="cloud-code-password-hint">至少 8 位。验证码有时效，过期后请重新发送。</p>
      <button type="submit" className="cloud-button primary" disabled={busy}>{busy ? "正在保存…" : submitLabel}</button>
    </form>
    <div className="cloud-password-links"><ResendCodeButton resend={() => challenge.resend()} disabled={busy} onSent={() => { setError(""); setNotice(codeNotice); }} onError={message => { setNotice(""); setError(message); }}/></div>
    {notice && <p className="cloud-notice" role="status">{notice}</p>}
    {error && <p className="cloud-error" role="alert">{error}</p>}
  </>;
}

export function PasswordRecoveryForm({ setup = false, initialEmail, onBack }: { setup?: boolean; initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [challenge, setChallenge] = useState<PasswordResetChallenge | null>(null);
  const delay = useResendDelay();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <>
    <h1 ref={heading} tabIndex={-1}>{setup ? "给 Google 账号设置本站密码" : "找回本站密码"}</h1>
    <p>{setup ? "输入你曾用于 Google 登录本站的邮箱，通过邮件为原账号设置密码。完成后使用邮箱和新密码登录，原有成员权限保留。"
      : codeProof ? "输入注册时使用的邮箱，我们会发送验证码。填写验证码和新密码后即可登录。"
      : "输入注册时使用的邮箱，我们将通过邮件链接帮助你重设本站密码。"}</p>
    {challenge ? <>
      <p className="cloud-notice" role="status">{codeNotice}</p>
      <PasswordCodeForm key={challenge.email} challenge={challenge} submitLabel="设置新密码并登录"/>
      <div className="cloud-password-links"><button type="button" className="ac-focus--link" onClick={() => { setChallenge(null); setSent(false); setError(""); }}>更换邮箱</button></div>
    </> : <form className="cloud-auth-form" onSubmit={async event => {
      event.preventDefault();
      if (busy || delay.seconds) return;
      setBusy(true); setError(""); setSent(false);
      try { const next = await cloudBackend.requestPasswordReset(email); setChallenge(next); setSent(!next); delay.start(); }
      catch (err) { setError(cloudBackend.accessErrorMessage(err)); }
      finally { setBusy(false); }
    }}>
      <label>账号邮箱<input required type="email" autoComplete="email" value={email} onChange={event => { setEmail(event.target.value); setSent(false); setError(""); }} disabled={busy}/></label>
      <button type="submit" className="cloud-button primary" disabled={busy || delay.seconds > 0}>{busy ? "正在提交…" : delay.seconds ? `${delay.seconds} 秒后可重新发送` : codeProof ? "发送验证码" : setup ? "发送密码设置邮件" : "发送密码重置邮件"}</button>
    </form>}
    {sent && <p className="cloud-notice" role="status">{emailNotice}</p>}
    {error && <p className="cloud-error" role="alert">{error}</p>}
    {!codeProof && <div className="cloud-password-note">
      <p>邮件包含操作链接，无需输入数字验证码。链接过期时，请重新发送。邮件重置完成后，请用邮箱和新密码登录。</p>
      <p>邮件重置可能改变原 Google 登录关联。如果现在可以通过 Google 登录，建议登录后在账号菜单中选择「设置本站密码」，这样可以保留两种登录方式。</p>
    </div>}
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
  const [challenge, setChallenge] = useState<PasswordResetChallenge | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const delay = useResendDelay();
  const setSitePassword = cloudBackend.setSitePassword;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (panel.current?.querySelector<HTMLElement>("input") || panel.current?.querySelector<HTMLElement>(".cloud-button.primary"))?.focus();
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
  const sendCode = async () => {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { setChallenge(await cloudBackend.requestPasswordReset(identity.email)); }
    catch (err) { setError(cloudBackend.accessErrorMessage(err)); }
    finally { setBusy(false); }
  };
  return <div className="cloud-modal-backdrop"><div ref={panel} tabIndex={-1} className="cloud-members cloud-password-dialog" role="dialog" aria-modal="true" aria-labelledby="cloud-password-title" aria-busy={busy}>
    <header><div><h2 id="cloud-password-title">{setSitePassword ? "设置本站密码" : "修改本站密码"}</h2></div><button type="button" className="cloud-button" disabled={busy} onClick={onClose}>关闭</button></header>
    <p className="cloud-password-email">{identity.email}</p>
    {!setSitePassword ? <>
      <p>我们会向当前邮箱发送验证码，用验证码设置新密码。成员身份和权限保持原样。</p>
      {saved ? null : challenge ? <PasswordCodeForm challenge={challenge} submitLabel="保存新密码" onSaved={() => { setSaved(true); setNotice("新密码已保存。以后请使用此邮箱和新密码登录。"); }}/>
        : <div className="cloud-gate-actions"><button type="button" className="cloud-button primary" disabled={busy} onClick={() => void sendCode()}>{busy ? "正在发送…" : "向当前邮箱发送验证码"}</button></div>}
    </> : <>
      <p>使用 Google 登录的账号可添加独立密码，并继续保留 Google 登录；已有本站密码的账号可在此修改密码。成员身份和权限保持原样。</p>
      {!saved && <form className="cloud-auth-form" onSubmit={async event => {
        event.preventDefault();
        if (busy) return;
        setBusy(true); setError(""); setNotice("");
        try { await setSitePassword(password, confirmation, identity); setSaved(true); setNotice("本站密码已保存。以后可以使用此邮箱和新密码登录。"); }
        catch (err) { setError(cloudBackend.accessErrorMessage(err)); }
        finally { setPassword(""); setConfirmation(""); setBusy(false); }
      }}>
        <label>新密码<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" aria-describedby="cloud-site-password-hint" value={password} onChange={event => setPassword(event.target.value)} disabled={busy}/></label>
        <label>再次输入新密码<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy}/></label>
        <p className="cloud-help" id="cloud-site-password-hint">至少 8 位。这是本站独立密码，无需填写 Google 或邮箱本身的密码。</p>
        <button type="submit" className="cloud-button primary" disabled={busy}>{busy ? "正在保存…" : "保存本站密码"}</button>
      </form>}
    </>}
    {notice && <p className="cloud-notice" role="status">{notice}</p>}
    {error && <p className="cloud-error" role="alert">{error}</p>}
    {setSitePassword && !saved && <div className="cloud-password-note"><p>如提示需要重新登录，请重新登录后再设置；也可以向当前邮箱发送重置链接，按邮件完成后使用邮箱登录。邮件重置可能改变原 Google 登录关联。</p><button type="button" className="cloud-button" disabled={busy || delay.seconds > 0} onClick={async () => {
      if (busy || delay.seconds) return;
      setBusy(true); setError(""); setNotice(""); setPassword(""); setConfirmation("");
      try { await cloudBackend.requestPasswordReset(identity.email); setNotice(emailNotice); delay.start(); }
      catch (err) { setError(cloudBackend.accessErrorMessage(err)); }
      finally { setBusy(false); }
    }}>{delay.seconds ? `${delay.seconds} 秒后可重新发送` : "向当前邮箱发送重置链接"}</button></div>}
  </div></div>;
}
