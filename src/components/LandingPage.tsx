import { type ReactNode } from "react";
import BrandIntro from "./BrandIntro";
import { ArrowRight, FileText } from "lucide-react";
import {
  archiveRecords,
  archiveTerms,
  hasArchiveExamples,
  type ArchiveRecord,
} from "../content/archive";

type PublicPage = "home" | "archive" | "workspace" | "not-found";

/**
 * Shared frame for the script-free public archive (and the member sign-in
 * pages): skip link, brand header band, primary navigation, the sample-content
 * notice, a white content container on the grey page, and the footer.
 */
export function PublicLayout({
  page,
  children,
}: {
  page: PublicPage;
  children: ReactNode;
}) {
  const current = (target: PublicPage) =>
    page === target ? ("page" as const) : undefined;
  return (
    <div className="public-site">
      {page === "home" && <BrandIntro />}
      <a className="ac-skip-link" href="#public-main">
        跳到页面内容
      </a>
      <header className="public-masthead">
        <div className="public-brand-band">
          <div className="ac-container public-brand-row">
            <a className="public-brand" href="/">
              <img src="/logo.png" alt="" width="48" height="48" />
              <span className="public-brand-name">安提柯议会</span>
              <span className="ac-visually-hidden">，返回首页</span>
            </a>
            <span className="public-product-name">
              {page === "workspace" ? "工作台" : "公开档案馆"}
            </span>
            {page !== "workspace" && (
              <a className="public-header-entry" href="/portal">
                进入协作工作台
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
        <nav className="public-navigation" aria-label="网站导航">
          <ul className="ac-container public-navigation-list">
            <li>
              <a href="/" aria-current={current("home")}>
                首页
              </a>
            </li>
            <li>
              <a href="/archive" aria-current={current("archive")}>
                公开档案馆
              </a>
            </li>
          </ul>
        </nav>
        {(page === "home" || page === "archive") && <SampleNotice />}
      </header>
      <main className="public-main" id="public-main" tabIndex={-1}>
        <div className="ac-container ac-surface public-surface">
          {children}
        </div>
      </main>
      <footer className="public-footer">
        <div className="ac-container public-footer-inner">
          <div className="public-footer-identity">
            <p className="public-footer-name">安提柯议会</p>
            <p>© {new Date().getFullYear()} 安提柯议会</p>
          </div>
          <nav aria-label="帮助与其他入口">
            <ul className="public-footer-links">
              <li>
                <a
                  href="/antico-council-guide.pdf"
                  target="_blank"
                  rel="noreferrer"
                >
                  <FileText size={16} aria-hidden="true" />
                  使用说明（PDF）
                  <span className="ac-visually-hidden">，在新窗口打开</span>
                </a>
              </li>
              <li>
                <a href="/preview/">试用演示</a>
              </li>
              <li>
                <a href="/local">本地工作台</a>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/** The service strip under the navigation: a tag plus one sentence. */
export function SampleNotice() {
  if (!hasArchiveExamples) return null;
  return (
    <div className="public-notice">
      <p className="ac-container public-notice-inner">
        <strong className="public-tag">示例内容</strong>
        <span>
          {archiveRecords.every((record) => record.isExample)
            ? "目前展示的届次和文章均为示例，真实档案尚未收录。"
            : "标有「示例」的文章不是实际会议或工作记录。"}
        </span>
      </p>
    </div>
  );
}

export function RecordList({ records }: { records: readonly ArchiveRecord[] }) {
  if (!records.length)
    return <p className="public-empty">尚无已公开的档案。</p>;
  return (
    <ul className="public-record-list">
      {records.map((record) => (
        <li key={record.slug}>
          <h3>
            <a href={`/archive/${record.slug}`}>{record.title}</a>
          </h3>
          <p className="public-record-meta">
            <span>{record.category}</span>
            <span aria-hidden="true">·</span>
            <span>
              {archiveTerms.find((term) => term.id === record.termId)?.title}
            </span>
            {record.isExample === true ? (
              <strong className="public-tag">示例</strong>
            ) : (
              <>
                <span aria-hidden="true">·</span>
                <time dateTime={record.publishedOn}>{record.publishedOn}</time>
              </>
            )}
          </p>
          <p className="public-record-summary">{record.summary}</p>
        </li>
      ))}
    </ul>
  );
}

export default function LandingPage() {
  return (
    <PublicLayout page="home">
      <div className="public-home-banner">
        <section className="public-home-intro" aria-labelledby="home-title">
          <h1 id="home-title">安提柯议会公开档案馆</h1>
          <p className="public-lead">
            按届次整理安提柯议会的工作报告、会议记录和交接资料，无需登录即可查阅。
          </p>
          <a className="public-button" href="/archive">
            查阅公开档案
            <ArrowRight size={20} aria-hidden="true" />
          </a>
        </section>
        <aside className="public-finder" aria-labelledby="finder-title">
          <h2 id="finder-title">查找方式</h2>
          <ul>
            <li>
              <a className="public-emphasised-link" href="/archive#terms">
                按届次浏览
                <ArrowRight size={18} aria-hidden="true" />
              </a>
              <p>各届目录列出已收录的文章和文件。</p>
            </li>
            <li>
              <a className="public-emphasised-link" href="/portal">
                进入协作工作台
                <ArrowRight size={18} aria-hidden="true" />
              </a>
              <p>成员登录后查看例会、处理议题和日常事务。</p>
            </li>
          </ul>
        </aside>
      </div>
      <div className="public-home-columns">
        <section
          className="public-home-section"
          aria-labelledby="selected-records-title"
        >
          <div className="public-section-heading">
            <h2 id="selected-records-title">档案选读</h2>
            <a href="/archive">全部档案</a>
          </div>
          <RecordList records={archiveRecords} />
        </section>
        <aside
          className="public-home-section public-term-aside"
          aria-labelledby="home-terms-title"
        >
          <h2 id="home-terms-title">历届档案</h2>
          <ul>
            {archiveTerms.map((term) => (
              <li key={term.id}>
                <a href={`/archive#${term.id}`}>{term.title}</a>
                <p>{term.description}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </PublicLayout>
  );
}

export function NotFoundPage() {
  return (
    <PublicLayout page="not-found">
      <section className="public-not-found" aria-labelledby="not-found-title">
        <h1 id="not-found-title">没有找到这一页</h1>
        <p className="public-lead">地址可能有误，也可能已经更新。</p>
        <p>如果是从链接进入，请检查地址；也可以从以下页面重新查找。</p>
        <div className="public-actions">
          <a className="public-button" href="/">
            返回首页
          </a>
          <a className="public-emphasised-link" href="/archive">
            查阅公开档案
            <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
      </section>
    </PublicLayout>
  );
}
