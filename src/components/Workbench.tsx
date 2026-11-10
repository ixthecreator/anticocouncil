import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChartNoAxesCombined, Files } from "lucide-react";
import type { WorkbenchPage } from "../lib/workspaceNavigation";
import "../styles/workspace/pages/workbench.css";

const tools = [
  { id: "workbench-wechat", title: "微信草稿箱", description: "打开草稿，导入原文，排版后存入公众号。", icon: Files },
  { id: "workbench-charts", title: "制图工具", description: "待接入", icon: ChartNoAxesCombined },
] as const;

const editorOrigin = "http://127.0.0.1:4174";
const editorUrl = editorOrigin + "/council";

function WechatDraftWorkbench() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"connecting" | "ready" | "unavailable">("connecting");

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== editorOrigin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "antico:inkdesk-ready") {
        window.clearTimeout(timer);
        setState("ready");
      }
    }
    const timer = window.setTimeout(() => setState("unavailable"), 6500);
    window.addEventListener("message", receive);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", receive);
    };
  }, [attempt]);

  return (
    <div className="page-body council-workbench-editor">
      <div className="council-workbench-actions">
        <a className="workspace-button subtle" href="#workbench">← 返回工作台</a>
        <a className="workspace-button subtle" href={editorUrl} target="_blank" rel="noreferrer">在本机窗口打开 ↗</a>
      </div>
      {state === "connecting" && <p className="workspace-help" role="status">正在连接本机排版工作台…</p>}
      {state === "unavailable" && (
        <div className="workspace-panel">
          <p role="status">请先启动新版排版工作台。浏览器询问本机访问权限时，可允许此站点连接。</p>
          <button className="workspace-button" type="button" onClick={() => {
            setState("connecting");
            setAttempt(previous => previous + 1);
          }}>重新连接</button>
        </div>
      )}
      <iframe
        key={attempt}
        ref={frame}
        title="公众号草稿编辑与排版"
        src={editorUrl}
        allow="local-network-access; local-network; loopback-network"
        className={state === "ready" ? "council-workbench-frame" : "council-workbench-frame is-pending"}
        tabIndex={state === "ready" ? 0 : -1}
        aria-hidden={state !== "ready"}
        onLoad={() => frame.current?.contentWindow?.postMessage({ type: "antico:inkdesk-hello" }, editorOrigin)}
      />
    </div>
  );
}

export function Workbench({ page }: { page: WorkbenchPage }) {
  if (page === "workbench-wechat") return <WechatDraftWorkbench />;
  if (page === "workbench-charts") return (
    <div className="page-body">
      <a className="workspace-button subtle" href="#workbench">← 返回工作台</a>
    </div>
  );
  return (
    <ul className="page-body council-workbench-grid">
      {tools.map(({ id, title, description, icon: Icon }) => (
        <li key={id}>
          <a className="council-workbench-card" href={`#${id}`}>
            <Icon size={24} aria-hidden="true" />
            <div><h2>{title}</h2><p>{description}</p></div>
            <ArrowRight size={20} aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}
