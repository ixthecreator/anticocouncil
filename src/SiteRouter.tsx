import { lazy, Suspense } from "react";
import LandingPage, { BlogPage, NotFoundPage } from "./components/LandingPage";

const Workspace = lazy(() => import("./WorkspaceEntry"));

export default function SiteRouter() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/workspace") {
    document.title = "协作工作台 · 安提柯议会";
    return (
      <Suspense
        fallback={<div className="route-loading">正在打开协作工作台…</div>}
      >
        <Workspace />
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
