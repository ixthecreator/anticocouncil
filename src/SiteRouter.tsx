import { lazy, Suspense, useEffect } from "react";
import { getPublicRoute } from "./publicRoutes";
import { AuthLoadingContent, AuthPageFrame } from "./components/AuthPageFrame";
import "./components/landing.css";

const Workspace = lazy(() => import("./WorkspaceEntry"));
const cloudAliases = new Set(["anticocouncil-sigma.vercel.app"]);

function CanonicalCloudEntry({ destination }: { destination: string }) {
  useEffect(() => { window.location.replace(destination); }, [destination]);
  return (
    <AuthPageFrame>
      <AuthLoadingContent
        title="正在前往正式协作工作台"
        description="如果页面没有自动打开，请选择继续。"
      >
        <a className="public-button" href={destination}>继续</a>
      </AuthLoadingContent>
    </AuthPageFrame>
  );
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
        fallback={
          <AuthPageFrame aside={localOnly ? <><h2>本地试用</h2><p>试用数据仅保存在当前浏览器，不会同步到云端。</p></> : undefined}>
            <AuthLoadingContent
              title={`正在打开${localOnly ? "本地试用" : "协作工作台"}`}
              description={localOnly ? "本地数据保存在当前浏览器中。" : "正在加载工作台页面。"}
            />
          </AuthPageFrame>
        }
      >
        <Workspace localOnly={localOnly} />
      </Suspense>
    );
  }
  const route = getPublicRoute(path);
  document.title = route.title;
  return route.page;
}
