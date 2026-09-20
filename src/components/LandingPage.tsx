import { type ReactNode } from "react";
import BrandIntro from "./BrandIntro";
import { ArrowRight, ArrowUpRight, FileText } from "lucide-react";
import {
  archiveRecords,
  archiveTerms,
  hasArchiveExamples,
  type ArchiveRecord,
} from "../content/archive";

type PublicPage = "home" | "archive" | "workspace" | "not-found";
export function PublicLayout({
  page,
  children,
}: {
  page: PublicPage;
  children: ReactNode;
}) {
  return (
    <div className="public-site">
      {page === "home" && <BrandIntro />}
      <a className="public-skip" href="#public-main">
        跳到页面内容
      </a>
      <header className="public-masthead">
        <div className="public-container public-brand-row">
          <a
            className="public-brand"
            href="/"
            aria-label="安提柯议会，返回首页"
          >
            <img src="/logo.png" alt="" width="54" height="54" />
            <span>
              <strong>安提柯议会</strong>
              <small lang="en">ANTICO COUNCIL</small>
            </span>
          </a>
        </div>
        <nav
          className="public-container public-navigation"
          aria-label="网站导航"
        >
          <a href="/" aria-current={page === "home" ? "page" : undefined}>
            首页
          </a>
          <a
            href="/archive"
            aria-current={page === "archive" ? "page" : undefined}
          >
            公开档案馆
          </a>
          <a className="public-portal-link" href="/portal" aria-current={page === "workspace" ? "page" : undefined}>
            协作工作台 <span>成员登录</span>
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </nav>
      </header>
      <main
        className="public-container public-main"
        id="public-main"
        tabIndex={-1}
      >
        {children}
      </main>
      <footer className="public-footer">
        <div className="public-container public-footer-inner">
          <div>
            <strong>安提柯议会</strong>
            <p>© {new Date().getFullYear()} Antico Council</p>
          </div>
          <nav aria-label="帮助与其他入口">
            <a
              href="/antico-council-guide.pdf"
              target="_blank"
              rel="noreferrer"
            >
              <FileText size={16} aria-hidden="true" />
              使用说明（PDF）
              <span className="public-sr-only">，在新窗口打开</span>
            </a>
            <a href="/preview/">试用演示</a>
            <a href="/local">本地工作台</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
export function SampleNotice() {
  if (!hasArchiveExamples) return null;
  return (
    <p className="public-phase">
      <strong>示例内容</strong>
      <span>{archiveRecords.every(record => record.isExample)
        ? "目前展示的届次和文章均为示例，真实档案尚未收录。"
        : "标有「示例」的文章不是实际会议或工作记录。"}</span>
    </p>
  );
}
export function RecordList({ records }: { records: readonly ArchiveRecord[] }) {
  if (!records.length)
    return <p className="public-empty">尚无已公开的档案。</p>;
  return (
    <ol className="public-record-list">
      {records.map((record) => (
        <li key={record.slug}>
          <span className="public-record-number" aria-hidden="true">
            {record.number}
          </span>
          <div className="public-record-copy">
            <div className="public-record-meta">
              <span>{record.category}</span>
              <span>
                {archiveTerms.find((term) => term.id === record.termId)?.title}
              </span>
              {record.isExample === true ? (
                <span className="public-example-tag">示例</span>
              ) : (
                <time dateTime={record.publishedOn}>{record.publishedOn}</time>
              )}
            </div>
            <h3>
              <a href={`/archive/${record.slug}`}>{record.title}</a>
            </h3>
            <p>{record.summary}</p>
          </div>
          <ArrowRight
            className="public-record-arrow"
            size={22}
            aria-hidden="true"
          />
        </li>
      ))}
    </ol>
  );
}
export default function LandingPage() {
  return (
    <PublicLayout page="home">
      <SampleNotice />
      <section className="public-home-intro" aria-labelledby="home-title">
        <div>
          <p className="public-eyebrow" lang="en">
            THE COUNCIL ARCHIVE
          </p>
          <h1 id="home-title">
            安提柯议会
            <br />
            公开档案馆
          </h1>
          <p className="public-lead">
            按届次整理工作报告、会议记录和交接资料。
          </p>
          <a className="public-button" href="/archive">
            查阅公开档案
            <ArrowRight size={20} aria-hidden="true" />
          </a>
        </div>
        <aside
          className="public-visitor-guide"
          aria-labelledby="visitor-guide-title"
        >
          <p className="public-eyebrow" lang="en">
            VISITOR’S GUIDE
          </p>
          <h2 id="visitor-guide-title">按届次查找</h2>
          <p>
            各届目录列出已收录的文章和文件。
          </p>
          <a href="/archive#terms">
            按届次浏览
            <ArrowRight size={18} aria-hidden="true" />
          </a>
          <div className="public-member-entry">
            <h3>成员工作台</h3>
            <p>登录后查看例会、处理议题和日常事务。</p>
            <a href="/portal">
              进入协作工作台
              <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </div>
        </aside>
      </section>
      <div className="public-home-columns">
        <section aria-labelledby="selected-records-title">
          <div className="public-section-heading">
            <h2 id="selected-records-title">档案选读</h2>
            <a href="/archive">
              全部档案
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
          <RecordList records={archiveRecords} />
        </section>
        <aside className="public-term-aside" aria-labelledby="home-terms-title">
          <p className="public-eyebrow" lang="en">
            COLLECTIONS
          </p>
          <h2 id="home-terms-title">历届档案</h2>
          <ol>
            {archiveTerms.map((term) => (
              <li key={term.id}>
                <a href={`/archive#${term.id}`}>
                  <span>{term.title}</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </a>
                <p>{term.description}</p>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </PublicLayout>
  );
}
export function NotFoundPage() {
  return (
    <PublicLayout page="not-found">
      <section className="public-not-found">
        <p className="public-eyebrow">404 · 页面未找到</p>
        <h1>没有找到这一页</h1>
        <p className="public-lead">地址可能有误，也可能已经更新。</p>
        <a className="public-button" href="/">
          返回首页
          <ArrowRight size={18} aria-hidden="true" />
        </a>
        <a href="/archive">查阅公开档案</a>
      </section>
    </PublicLayout>
  );
}
