import { useLayoutEffect, useRef } from "react";
import { ArrowRight, ChartNoAxesCombined, Files } from "lucide-react";
import { getCloudAuth } from "../lib/cloudAccess";
import type { WorkbenchPage } from "../lib/workspaceNavigation";
import "../styles/workspace/pages/workbench.css";

const tools = [
  { id: "workbench-wechat", title: "微信草稿箱", description: "打开草稿，导入原文，排版后存入公众号。", icon: Files },
  { id: "workbench-charts", title: "制图工具", description: "待接入", icon: ChartNoAxesCombined },
] as const;

function WechatDraftWorkbench({ draftScope }: { draftScope: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const editor = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    async function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow ||
          event.data?.type !== "antico:wechat-session" || event.ports.length !== 1) return;
      const port = event.ports[0];
      try {
        const user = draftScope.startsWith("cloud:") && event.data.token ? getCloudAuth().currentUser : null;
        const token = user && draftScope === `cloud:${user.uid}` ? await user.getIdToken() : undefined;
        port.postMessage({ scope: draftScope, token });
      } catch {
        port.postMessage({ scope: draftScope });
      } finally {
        port.close();
      }
    }
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [draftScope]);

  return (
    <div ref={editor} className="page-body council-workbench-editor">
      <a className="workspace-button subtle" href="#workbench">← 返回工作台</a>
      <iframe ref={frame} title="公众号草稿编辑与排版" className="council-workbench-frame"
        src="/wechat-workbench/index.html"
        onLoad={() => editor.current?.scrollIntoView({ block: "nearest" })} />
    </div>
  );
}

export function Workbench({ page, draftScope }: { page: WorkbenchPage; draftScope: string }) {
  if (page === "workbench-wechat") return <WechatDraftWorkbench draftScope={draftScope} />;
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
