import { ArrowLeft } from "lucide-react";
import {
  archiveRecords,
  archiveTerms,
  type ArchiveRecord,
} from "../content/archive";
import { PublicLayout, RecordList } from "./LandingPage";

type Crumb = { label: string; href?: string };

/** Ordered breadcrumbs; the last item is the current page, as plain text. */
function Breadcrumbs({ items }: { items: readonly Crumb[] }) {
  return (
    <nav className="public-breadcrumbs" aria-label="面包屑">
      <ol>
        {items.map((item) =>
          item.href ? (
            <li key={item.label}>
              <a href={item.href}>{item.label}</a>
            </li>
          ) : (
            <li key={item.label} aria-current="page">
              {item.label}
            </li>
          ),
        )}
      </ol>
    </nav>
  );
}

export function PublicArchive() {
  return (
    <PublicLayout page="archive">
      <Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "公开档案馆" }]} />
      <header className="public-page-intro">
        <h1>公开档案馆</h1>
        <p className="public-lead">查阅各届工作报告、会议记录和交接资料。</p>
      </header>
      <div className="public-archive-grid">
        <aside className="public-archive-nav" id="terms" aria-labelledby="terms-title">
          <h2 id="terms-title">按届次查阅</h2>
          <nav aria-label="届次目录">
            <ul>
              {archiveTerms.map((term) => (
                <li key={term.id}>
                  <a href={`#${term.id}`}>{term.title}</a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="public-reading-note">
            <h2>收录说明</h2>
            <p>
              本页收录公开资料。例会和日常事务请前往
              <a href="/portal">协作工作台</a>。
            </p>
          </div>
        </aside>
        <div className="public-collections">
          {archiveTerms.map((term) => {
            const records = archiveRecords.filter(
              (record) => record.termId === term.id,
            );
            return (
              <section
                className="public-collection"
                key={term.id}
                id={term.id}
                aria-labelledby={`${term.id}-title`}
              >
                <header>
                  <div className="public-collection-title">
                    <h2 id={`${term.id}-title`}>{term.title}</h2>
                    <p className="public-result-count">
                      共 {records.length} 篇
                    </p>
                  </div>
                  <p>{term.description}</p>
                </header>
                <RecordList records={records} />
              </section>
            );
          })}
        </div>
      </div>
    </PublicLayout>
  );
}

export function ArchiveArticle({ record }: { record: ArchiveRecord }) {
  const term = archiveTerms.find((item) => item.id === record.termId);
  const termHref = `/archive#${record.termId}`;
  const related = archiveRecords.filter(
    (item) => item.termId === record.termId && item.slug !== record.slug,
  );
  return (
    <PublicLayout page="archive">
      <Breadcrumbs
        items={[
          { label: "首页", href: "/" },
          { label: "公开档案馆", href: "/archive" },
          { label: term?.title ?? "届次目录", href: termHref },
          { label: record.title },
        ]}
      />
      <article className="public-article" aria-labelledby="article-title">
        <header className="public-article-header">
          <h1 id="article-title">{record.title}</h1>
          <p className="public-lead">{record.summary}</p>
          <dl className="public-article-metadata">
            <div>
              <dt>类别</dt>
              <dd>{record.category}</dd>
            </div>
            <div>
              <dt>所属届次</dt>
              <dd>
                <a href={termHref}>{term?.title}</a>
              </dd>
            </div>
            <div>
              <dt>档案编号</dt>
              <dd className="public-numeric">
                {record.isExample === true ? "示例" : "AC"}-{record.number}
              </dd>
            </div>
            {record.isExample === true ? (
              <div>
                <dt>文档状态</dt>
                <dd>
                  <strong className="public-tag">示例文稿</strong>
                </dd>
              </div>
            ) : (
              <>
                <div>
                  <dt>公开日期</dt>
                  <dd>
                    <time dateTime={record.publishedOn}>
                      {record.publishedOn}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>署名</dt>
                  <dd>{record.byline}</dd>
                </div>
              </>
            )}
          </dl>
        </header>
        <div className="public-article-grid">
          <nav className="public-article-contents" aria-label="本文目录">
            <h2>本文目录</h2>
            <ol>
              {record.sections.map((section, index) => (
                <li key={section.title}>
                  <a href={`#section-${index + 1}`}>{section.title}</a>
                </li>
              ))}
            </ol>
            <a className="public-return" href={termHref}>
              <ArrowLeft size={16} aria-hidden="true" />
              返回本届目录
            </a>
          </nav>
          <div className="public-article-body">
            {record.sections.map((section, index) => (
              <section
                key={section.title}
                id={`section-${index + 1}`}
                aria-labelledby={`section-${index + 1}-title`}
              >
                <h2 id={`section-${index + 1}-title`}>{section.title}</h2>
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex}>{paragraph}</p>
                ))}
              </section>
            ))}
            <p className="public-article-end">
              <a className="public-emphasised-link" href={termHref}>
                <ArrowLeft size={18} aria-hidden="true" />
                返回{term?.title ?? "届次目录"}
              </a>
            </p>
          </div>
        </div>
      </article>
      {!!related.length && (
        <section className="public-related" aria-labelledby="related-title">
          <div className="public-related-inner">
            <h2 id="related-title">同届记录</h2>
            <RecordList records={related} />
          </div>
        </section>
      )}
    </PublicLayout>
  );
}
