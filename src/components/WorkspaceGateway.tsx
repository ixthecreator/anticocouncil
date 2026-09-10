import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { firebaseConfiguration, getDatabase } from "../lib/firebase";
import {
  OWNER_EMAIL, approveWorkspaceRequest, canChangeMemberRole, canManageMember, cancelGoogleLogin,
  cloudAccessError, declineWorkspaceRequest, getCloudAuth, hasWorkspaceAccess,
  isConfirmedAccessSnapshot, isWorkspaceOwner, loginWithEmail, loginWithGoogle, logoutCloud, observeCloudAuthentication,
  readAccessRequest, readWorkspaceAccess, refreshCloudAuthentication,
  registerWithEmail, requestWorkspaceAccess, resendVerification, sameAuthorizationIdentity, updateWorkspaceMember,
  type AccessActor, type AccessRequest, type CloudIdentity, type WorkspaceAccess,
} from "../lib/cloudAccess";
import "./cloud-access.css";
import { PasswordRecoveryForm, PasswordSettingsDialog } from "./AccountPassword";

type StorageMode = "local" | "firebase";
export interface WorkspaceGatewayProps {
  mode?: StorageMode;
  children: (props: { mode: StorageMode; onModeChange: (mode: StorageMode) => void; account?: ReactNode }) => ReactNode;
}

function MembersPanel({ actor, onClose }: { actor: AccessActor; onClose: () => void }) {
  const [members, setMembers] = useState<WorkspaceAccess[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [loaded, setLoaded] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    let failed = false;
    const seen = new Set<string>();
    const database = getDatabase();
    const onError = (err: unknown) => { if (active) { failed = true; setLoaded(false); setMembers([]); setRequests([]); setError(`${cloudAccessError(err)} 请关闭后重新打开成员管理。`); } };
    const membersSubscription = onSnapshot(collection(database, "workspaceAccess"), { includeMetadataChanges: true }, snapshot => {
      if (!active || failed || snapshot.metadata.fromCache) return;
      setMembers(snapshot.docs.map(item => readWorkspaceAccess(item.id, item.data())).filter((item): item is WorkspaceAccess => !!item));
      seen.add("members"); setLoaded(seen.size === 2);
    }, onError);
    const requestsSubscription = onSnapshot(collection(database, "accessRequests"), { includeMetadataChanges: true }, snapshot => {
      if (!active || failed || snapshot.metadata.fromCache) return;
      setRequests(snapshot.docs.map(item => readAccessRequest(item.id, item.data())).filter((item): item is AccessRequest => !!item));
      seen.add("requests"); setLoaded(seen.size === 2);
    }, onError);
    return () => { active = false; membersSubscription(); requestsSubscription(); };
  }, []);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
      if (event.key !== "Tab") return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), select:not(:disabled), input:not(:disabled)") || []);
      if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
      if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
    };
    document.addEventListener("keydown", listener);
    return () => { document.removeEventListener("keydown", listener); previous?.focus(); };
  }, [onClose, pending]);
  const run = async (id: string, action: () => Promise<unknown>) => {
    setPending(id); setError("");
    try { await action(); } catch (err) { setError(cloudAccessError(err)); } finally { setPending(""); }
  };
  return <div className="cloud-modal-backdrop"><div className="cloud-members" ref={panel} role="dialog" aria-modal="true" aria-labelledby="cloud-members-title">
    <header><div><span className="cloud-eyebrow">COUNCIL MEMBERS</span><h2 id="cloud-members-title">成员与访问管理</h2></div><button type="button" className="cloud-button" disabled={!!pending} onClick={onClose}>关闭</button></header>
    <p className="cloud-help">获批成员可以共同维护会议及日常工作记录。停用后不删除历史记录。管理员角色由所有者调整。</p>
    {error && <p className="cloud-error" role="alert">{error}</p>}
    {!loaded ? <p role="status">正在连接成员服务…</p> : <>
      <section><h3>待审批申请 <small>{requests.length}</small></h3>{!requests.length && <p className="cloud-help">目前没有待审批申请。</p>}
        {requests.map(request => <article className="cloud-member-row" key={request.uid}><div><strong>{request.name}</strong><span>{request.email}</span></div><div className="cloud-actions"><button type="button" className="cloud-button primary" disabled={!!pending || request.uid === actor.uid || request.email === OWNER_EMAIL} onClick={() => void run(request.uid, () => approveWorkspaceRequest(request.uid))}>{pending === request.uid ? "正在处理…" : "批准加入"}</button><button type="button" className="cloud-button" disabled={!!pending || request.uid === actor.uid} onClick={() => void run(request.uid, () => declineWorkspaceRequest(request.uid))}>不予批准</button></div></article>)}
      </section>
      <section><h3>议会成员 <small>{members.filter(member => member.email !== OWNER_EMAIL).length + 1}</small></h3>
        <article className="cloud-member-row owner"><div><strong>议会所有者</strong><span>{OWNER_EMAIL}</span></div><span className="cloud-tag">所有者</span></article>
        {members.filter(member => member.email !== OWNER_EMAIL).sort((a,b) => a.name.localeCompare(b.name, "zh-CN")).map(member => <article className="cloud-member-row" key={member.uid}><div><strong>{member.name}{member.uid === actor.uid ? "（本人）" : ""}</strong><span>{member.email}</span><small>{member.role === "admin" ? "管理员" : "成员"} · {member.active ? "已启用" : "已停用"}</small></div><div className="cloud-actions">
          {canChangeMemberRole(actor, member) && <label className="cloud-role-label">角色<select aria-label={`${member.name}的角色`} value={member.role} disabled={!!pending} onChange={event => { const role = event.target.value as "member" | "admin"; void run(member.uid, () => updateWorkspaceMember(actor, member, { role })); }}><option value="member">成员</option><option value="admin">管理员</option></select></label>}
          {canManageMember(actor, member) ? <button type="button" className={`cloud-button ${member.active ? "danger" : ""}`} disabled={!!pending} onClick={() => void run(member.uid, () => updateWorkspaceMember(actor, member, { active: !member.active }))}>{pending === member.uid ? "正在处理…" : member.active ? "停用访问" : "恢复访问"}</button> : <span className="cloud-help">{member.uid === actor.uid ? "不能修改自己的授权" : "由所有者管理"}</span>}
        </div></article>)}
      </section>
    </>}
  </div></div>;
}

function CloudAccount({ identity, role, onLogout, workspacePending = 0 }: { identity: CloudIdentity; role: "member" | "admin"; onLogout: () => Promise<void>; workspacePending?: number }) {
  const [managing, setManaging] = useState(false);
  const [passwordSettings, setPasswordSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const actor: AccessActor = { ...identity, role };
  useEffect(() => { setManaging(false); }, [identity.uid, role]);
  return <div className="cloud-account">
    <details><summary><span className="cloud-avatar">{(identity.name || identity.email).slice(0,1)}</span><span>{identity.name || identity.email}<small>{isWorkspaceOwner(identity) ? "所有者" : role === "admin" ? "管理员" : "议会成员"}</small></span></summary>
      <div className="cloud-account-menu"><strong>{identity.name || "已登录"}</strong><p>{identity.email}</p><button type="button" className="cloud-button" disabled={busy || workspacePending > 0} onClick={() => setPasswordSettings(true)}>设置本站密码</button>{(isWorkspaceOwner(identity) || role === "admin") && <button type="button" className="cloud-button" onClick={() => setManaging(true)}>成员与访问管理</button>}<button type="button" className="cloud-button" disabled={busy || workspacePending > 0} onClick={async () => { if (workspacePending > 0) return; setBusy(true); setError(""); try { await onLogout(); } catch (err) { setError(cloudAccessError(err)); } finally { setBusy(false); } }}>{busy ? "正在退出…" : "退出账号"}</button>{workspacePending > 0 && <p role="status">有记录正在等待保存确认</p>}{error && <p className="cloud-error" role="alert">{error}</p>}</div>
    </details>
    {managing && (isWorkspaceOwner(identity) || role === "admin") && <MembersPanel actor={actor} onClose={() => setManaging(false)}/>}
    {passwordSettings && <PasswordSettingsDialog key={identity.uid} identity={identity} onClose={() => setPasswordSettings(false)}/>}
  </div>;
}

export function WorkspaceGateway({ children, mode = "firebase" }: WorkspaceGatewayProps) {
  const [identity, setIdentity] = useState<CloudIdentity | null>(null);
  const identityRef = useRef<CloudIdentity | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [access, setAccess] = useState<WorkspaceAccess | null>(null);
  const [request, setRequest] = useState<AccessRequest | null>(null);
  const [accessReady, setAccessReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [redirectError, setRedirectError] = useState("");
  const [redirectPending, setRedirectPending] = useState(false);
  const [authDelayed, setAuthDelayed] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [googleDelayed, setGoogleDelayed] = useState(false);
  const [screen, setScreen] = useState<"login" | "register" | "reset" | "setup">("login");
  const [passwordSettings, setPasswordSettings] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const configured = !!firebaseConfiguration.config;
  const selectEmailScreen = (next: "login" | "register" | "reset" | "setup") => {
    cancelGoogleLogin(); setScreen(next); setPassword(""); setError(""); setNotice("");
  };

  useEffect(() => {
    if (!googlePending) return;
    const timer = window.setTimeout(() => setGoogleDelayed(true), 20000);
    return () => window.clearTimeout(timer);
  }, [googlePending]);
  useEffect(() => {
    setAuthDelayed(false);
    if (mode !== "firebase" || !configured || authReady) return;
    const timer = window.setTimeout(() => setAuthDelayed(true), 20000);
    return () => window.clearTimeout(timer);
  }, [mode, configured, authReady, refreshKey]);

  const onModeChange = (next: StorageMode) => {
    if (next === mode || busy) return;
    // The workspace calls this only after its pending-save guard has passed.
    // A new route also discards all in-memory data belonging to the old mode.
    window.location.assign(`${next === "local" ? "/local" : "/portal"}${window.location.hash}`);
  };
  useEffect(() => {
    if (mode !== "firebase" || !configured) return;
    identityRef.current = null;
    setAuthReady(false); setIdentity(null); setAccess(null); setAccessReady(false); setAuthError("");
    try {
      return observeCloudAuthentication(getCloudAuth(), state => {
        if (!state.identity || !sameAuthorizationIdentity(identityRef.current, state.identity)) {
          setAccess(null); setAccessReady(false);
          setPasswordSettings(false);
        }
        identityRef.current = state.identity;
        setIdentity(state.identity); setAuthReady(state.ready); setAuthError(state.error);
        setRedirectError(state.redirectError);
        setRedirectPending(state.redirectPending);
        if (state.identity) setName(previous => previous || state.identity!.name);
      });
    } catch (err) { setAuthError(cloudAccessError(err)); setAuthReady(true); }
  }, [mode, configured, refreshKey]);

  useEffect(() => {
    setAccess(null); setRequest(null); setAccessReady(false);
    if (mode !== "firebase" || !identity?.verified || isWorkspaceOwner(identity)) return;
    let active = true;
    const database = getDatabase();
    const accessSubscription = onSnapshot(doc(database, "workspaceAccess", identity.uid), { includeMetadataChanges: true }, snapshot => {
      if (!active) return;
      // An offline cache or a local write awaiting server approval cannot grant access.
      if (!isConfirmedAccessSnapshot(snapshot.metadata)) { setAccessReady(false); setAccess(null); return; }
      setAccess(snapshot.exists() ? readWorkspaceAccess(snapshot.id, snapshot.data()) : null);
      setAccessReady(true); setAuthError("");
    }, err => { if (active) { setAccessReady(false); setAccess(null); setAuthError(cloudAccessError(err)); } });
    const requestSubscription = onSnapshot(doc(database, "accessRequests", identity.uid), { includeMetadataChanges: true }, snapshot => {
      if (active && !snapshot.metadata.fromCache) setRequest(snapshot.exists() ? readAccessRequest(snapshot.id, snapshot.data()) : null);
    }, err => { if (active) setError(cloudAccessError(err)); });
    return () => { active = false; accessSubscription(); requestSubscription(); };
  }, [mode, identity?.uid, identity?.email, identity?.verified, refreshKey]);

  const run = async (operation: () => Promise<unknown>, message = "") => {
    setBusy(true); setError(""); setNotice("");
    try { await operation(); if (message) setNotice(message); }
    catch (err) { setError(cloudAccessError(err)); }
    finally { setBusy(false); setPassword(""); }
  };
  const startGoogleLogin = async () => {
    if (busy || googlePending) return;
    setGooglePending(true); setGoogleDelayed(false); setRedirectError("");
    try { await run(loginWithGoogle); }
    finally { setGooglePending(false); setGoogleDelayed(false); }
  };
  const returnToEmailLogin = () => { cancelGoogleLogin(); window.location.reload(); };
  const logout = async () => { await logoutCloud(); identityRef.current = null; setIdentity(null); setAccess(null); setRequest(null); setName(""); setPassword(""); setPasswordSettings(false); setScreen("login"); setError(""); setNotice(""); setRedirectError(""); };
  const owner = isWorkspaceOwner(identity);
  const approved = authReady && (owner || accessReady && hasWorkspaceAccess(identity, access));

  if (mode === "local") return <Fragment key="local">{children({ mode, onModeChange })}</Fragment>;
  if (identity && approved) return <Fragment key={`cloud:${identity.uid}`}>{children({ mode, onModeChange, account: <CloudAccount key={identity.uid} identity={identity} role={owner ? "admin" : access!.role} onLogout={logout}/> })}</Fragment>;

  return <main className="cloud-gateway"><a className="cloud-home" href="/">← 返回议会首页</a><section className="cloud-gate-card">
    <a className="cloud-brand" href="/"><img src="/logo.png" alt=""/><span>安提柯议会<small>ANTICO COUNCIL</small></span></a>
    <span className="cloud-eyebrow">SHARED WORKSPACE</span>
    {!configured ? <><h1>云端工作区尚未配置</h1><p>请议会管理员连接自有 Firebase 项目后再使用云端协作。你可以先进入本地试用。</p></> : !authReady ? <><h1>正在确认登录状态</h1><p role="status">请稍候，正在连接账号服务并确认登录结果…</p>{authDelayed && <div className="cloud-login-wait"><p role="status">暂时还没有收到完整的登录结果。请检查网络后重新载入此页，也可以在系统浏览器中打开本站重试。</p><button type="button" className="cloud-button" onClick={() => window.location.reload()}>重新载入登录页</button></div>}</> : !identity && (screen === "reset" || screen === "setup") ? <PasswordRecoveryForm key={screen} setup={screen === "setup"} initialEmail={email} onBack={() => { setScreen("login"); setError(""); setNotice(""); }}/>
    : !identity ? <>
      <h1>{screen === "login" ? "成员登录" : "注册成员账号"}</h1><p>首次使用须验证邮箱并申请加入，经管理员批准后可进入工作台。</p>
      <div className="cloud-auth-tabs"><button type="button" aria-pressed={screen === "login"} onClick={() => selectEmailScreen("login")} disabled={busy}>邮箱登录</button><button type="button" aria-pressed={screen === "register"} onClick={() => selectEmailScreen("register")} disabled={busy}>注册账号</button></div>
      <form className="cloud-auth-form" onSubmit={event => { event.preventDefault(); void run(() => screen === "login" ? loginWithEmail(email, password) : registerWithEmail(name, email, password), screen === "register" ? "验证邮件已发送，请查看收件箱或垃圾邮件文件夹。" : ""); }}>
        {screen === "register" && <label>成员姓名<input required maxLength={80} autoComplete="name" value={name} onChange={event => setName(event.target.value)} disabled={busy}/></label>}
        <label>邮箱地址<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={busy}/></label>
        <label>密码<input required type="password" minLength={screen === "register" ? 8 : undefined} autoComplete={screen === "register" ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} disabled={busy}/></label>
        {screen === "register" && <p className="cloud-help">至少 8 位。注册后会收到邮箱验证链接，完成验证及成员审批后即可进入。</p>}
        <button className="cloud-button primary" type="submit" disabled={busy}>{busy ? "正在处理…" : screen === "login" ? "登录" : "注册并发送验证邮件"}</button>
      </form>
      <div className="cloud-password-links"><button type="button" disabled={busy} onClick={() => selectEmailScreen("reset")}>忘记密码？</button><button type="button" disabled={busy} onClick={() => selectEmailScreen("setup")}>给 Google 账号设置本站密码</button></div>
      <div className="cloud-divider"><span>或者</span></div><button type="button" className="cloud-button google" disabled={busy || redirectPending} onClick={() => void startGoogleLogin()}>{googlePending ? "正在前往 Google…" : redirectPending ? "正在确认 Google 登录…" : "使用 Google 账号登录"}</button>
      {googlePending && <div className="cloud-login-wait">
        <p role="status">{googleDelayed ? "本页尚未跳转到 Google，登录服务可能仍在等待网络响应。" : "即将前往 Google 登录页面。选择账号并完成登录后，会自动回到本站确认成员资格。"}</p>
        {googleDelayed && <>
          <p>如果一直没有跳转，请检查网络后重新载入此页。也可以在系统浏览器中打开本站重试，或重新载入后选择邮箱登录。</p>
        </>}
        <button type="button" className="cloud-button" onClick={returnToEmailLogin}>取消 Google 登录，使用邮箱</button>
      </div>}
      {redirectPending && !googlePending && <div className="cloud-login-wait"><p role="status">正在确认 Google 返回的登录结果。你也可以直接使用邮箱登录或找回密码。</p><button type="button" className="cloud-button" onClick={returnToEmailLogin}>取消 Google 登录，使用邮箱</button></div>}
    </> : !identity.verified ? <>
      <h1>请先验证邮箱</h1><p>当前账号：<strong>{identity.email || "未提供邮箱"}</strong></p><p>打开验证邮件中的链接完成验证，再回到此处刷新认证状态。没有收到时，请检查垃圾邮件文件夹或重新发送。</p>
      <div className="cloud-gate-actions"><button type="button" className="cloud-button primary" disabled={busy} onClick={() => void run(refreshCloudAuthentication)}>已验证，刷新认证状态</button><button type="button" className="cloud-button" disabled={busy} onClick={() => void run(resendVerification, "验证邮件已重新发送，请查看收件箱。")}>重新发送验证邮件</button></div>
    </> : !accessReady ? <>
      <h1>正在确认成员资格</h1><p role="status">正在连接议会成员服务。确认有效授权后会自动进入工作台。</p><button type="button" className="cloud-button" disabled={busy} onClick={() => { setAuthError(""); setRefreshKey(key => key + 1); }}>重新检查</button>
    </> : access ? <>
      <h1>当前账号暂不能访问工作区</h1><p>{identity.email}</p><p>{!access.active ? "此账号的议会访问权限已停用。历史工作记录仍然保留，如需恢复访问，请联系管理员。" : "当前邮箱与成员授权记录不一致，请联系管理员核对。"}</p><button type="button" className="cloud-button" disabled={busy} onClick={() => void run(refreshCloudAuthentication)}>刷新认证状态</button>
    </> : request ? <>
      <h1>加入申请已提交</h1><p><strong>{request.name}</strong> · {request.email}</p><p>请等待议会管理员批准。此页面会自动更新，通过后即可进入工作台。</p><button type="button" className="cloud-button" disabled={busy} onClick={() => { setAuthError(""); setRefreshKey(key => key + 1); }}>刷新申请状态</button>
    </> : <>
      <h1>申请加入议会工作区</h1><p>邮箱已验证：<strong>{identity.email}</strong></p><p>填写成员姓名，让管理员确认你的申请。</p><form className="cloud-auth-form" onSubmit={event => { event.preventDefault(); void run(() => requestWorkspaceAccess(name), "加入申请已提交。"); }}><label>成员姓名<input required maxLength={80} autoComplete="name" value={name} onChange={event => setName(event.target.value)} disabled={busy}/></label><button type="submit" className="cloud-button primary" disabled={busy}>{busy ? "正在提交…" : "提交加入申请"}</button></form>
    </>}
    {redirectError && <p className="cloud-error" role="alert">{redirectError}</p>}{(error || authError) && <p className="cloud-error" role="alert">{error || authError}</p>}{notice && <p className="cloud-notice" role="status">{notice}</p>}
    <footer className="cloud-gate-footer">{identity && <><button type="button" disabled={busy} onClick={() => void run(logout)}>退出账号 / 更换账号</button>{identity.verified && <button type="button" disabled={busy} onClick={() => setPasswordSettings(true)}>设置本站密码</button>}</>}<button type="button" disabled={busy} onClick={() => onModeChange("local")}>本地试用</button><p>试用数据仅保存在当前浏览器，不会同步到云端。</p></footer>
    {identity?.verified && passwordSettings && <PasswordSettingsDialog key={identity.uid} identity={identity} onClose={() => setPasswordSettings(false)}/>}
  </section></main>;
}

export default WorkspaceGateway;
