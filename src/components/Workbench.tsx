import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Files, Quote } from "lucide-react";
import { getCloudAuth } from "../lib/cloudAccess";
import { isWorkbenchPage, workspacePageFromHash, type WorkbenchPage } from "../lib/workspaceNavigation";
import "../styles/workspace/pages/workbench.css";

const tools = [
  { id: "workbench-wechat", title: "微信草稿箱", description: "打开草稿，导入原文，排版后存入公众号。", icon: Files },
  { id: "workbench-citatio", title: "每日书摘配图", description: "输入引文与出处，选版式和底图，导出「每日一引」PNG。", icon: Quote },
] as const;

function currentTool(): WorkbenchPage {
  const page = workspacePageFromHash(window.location.hash);
  return isWorkbenchPage(page) ? page : "workbench";
}

export function WorkbenchWindow({ draftScope, account }: { draftScope: string; account?: ReactNode }) {
  const [page, setPage] = useState(currentTool);
  const active = tools.find(tool => tool.id === page);
  const councilHome = draftScope === "local" ? "/local#overview" : "/portal#overview";
  useEffect(() => {
    const sync = () => setPage(currentTool());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    document.title = active ? `${active.title} · 安提柯议会工作台` : "工作台 · 安提柯议会";
  }, [active]);
  return (
    <div className="council-workbench-window">
      <header className="council-workbench-masthead">
        <a className="council-workbench-brand" href="#workbench">安提柯议会 · 工作台</a>
        <div>{account || <a className="council-workbench-brand" href="/portal?workbench=1#workbench-wechat">登录议会</a>}</div>
      </header>
      <nav className="council-workbench-tabs" aria-label="工作台工具">
        <a href={councilHome}>← 返回议会</a>
        <a href="#workbench" aria-current={!active ? "page" : undefined}>工作台</a>
        {tools.map(tool => <a href={`#${tool.id}`} key={tool.id} aria-current={page === tool.id ? "page" : undefined}>{tool.title}</a>)}
      </nav>
      <main className="council-workbench-main">
        <Workbench page={page} draftScope={draftScope} />
      </main>
    </div>
  );
}

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
        const token = user && draftScope === `cloud:${user.uid}` ? await user.getIdToken(event.data.refresh === true) : undefined;
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
  if (page === "workbench-citatio") return (
    <div className="page-body council-workbench-editor">
      <a className="workspace-button subtle" href="#workbench">← 返回工作台</a>
      {/* Self-contained tool: text and layout stay in this browser; PNGs are drawn locally. */}
      <iframe title="每日书摘配图" className="council-workbench-frame council-workbench-frame--tall"
        src="/citatio/index.html" allow="clipboard-write" />
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
