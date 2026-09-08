import { lazy, Suspense, useEffect } from "react";
import LandingPage, { BlogPage, NotFoundPage } from "./components/LandingPage";

const Workspace = lazy(() => import("./WorkspaceEntry"));
const cloudAliases = new Set(["anticocouncil-sigma.vercel.app"]);

function CanonicalCloudEntry({ destination }: { destination: string }) {
  useEffect(() => { window.location.replace(destination); }, [destination]);
  return <div className="route-loading">正在前往正式协作工作台… <a href={destination}>继续</a></div>;
}

export default function SiteRouter() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if ((path === "/portal" || path === "/workspace") && cloudAliases.has(window.location.hostname)) {
    document.title = "正在前往协作工作台 · 安提柯议会";
    const destination = `https://www.anticocouncil.com${window.location.pathname}${window.location.search}${window.location.hash}`;
    return <CanonicalCloudEntry destination={destination} />;
  }
  if (path === "/portal" || path === "/workspace" || path === "/local") {
    const localOnly = path === "/local";
    document.title = `${localOnly ? "本地试用" : "协作工作台"} · 安提柯议会`;
    return (
      <Suspense
        fallback={<div className="route-loading">正在打开{localOnly ? "本地试用" : "协作工作台"}…</div>}
      >
        <Workspace localOnly={localOnly} />
      </Suspense>
    );
  }
  if (path === "/blog") {
    document.title = "文字与记录 · 安提柯议会";
    return <BlogPage />;
  }
  if (path === "/") return <LandingPage />;
  document.title = "页面未找到 · 安提柯议会";
  return <NotFoundPage />;
}
