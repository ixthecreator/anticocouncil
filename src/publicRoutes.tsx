import LandingPage, { NotFoundPage } from "./components/LandingPage";
import { ArchiveArticle, PublicArchive } from "./components/PublicArchive";
import { archiveRecords, hasArchiveExamples } from "./content/archive";

export const publicPaths = [
  "/",
  "/archive",
  "/blog",
  ...archiveRecords.map((record) => `/archive/${record.slug}`),
];

export function getPublicRoute(path: string) {
  const normalized = path.replace(/\/+$/, "") || "/";
  if (normalized === "/")
    return {
      title: "安提柯议会 · 公开档案馆",
      description: "按届次查阅安提柯议会的工作报告、会议记录和交接资料。",
      noindex: hasArchiveExamples,
      page: <LandingPage />,
    };
  if (normalized === "/archive" || normalized === "/blog")
    return {
      title: "公开档案馆 · 安提柯议会",
      description: "安提柯议会各届公开档案目录。",
      noindex: hasArchiveExamples || normalized === "/blog",
      page: <PublicArchive />,
    };
  const record = archiveRecords.find(
    (item) => normalized === `/archive/${item.slug}`,
  );
  if (record)
    return {
      title: `${record.title}${record.isExample ? "（示例）" : ""} · 安提柯议会`,
      description: record.summary,
      noindex: record.isExample,
      page: <ArchiveArticle record={record} />,
    };
  return {
    title: "页面未找到 · 安提柯议会",
    description: "没有找到这一页，请返回首页或公开档案馆。",
    noindex: true,
    page: <NotFoundPage />,
  };
}
