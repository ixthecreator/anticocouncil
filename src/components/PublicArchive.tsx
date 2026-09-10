import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  archiveRecords,
  archiveTerms,
  type ArchiveRecord,
} from "../content/archive";
import { PublicLayout, RecordList, SampleNotice } from "./LandingPage";

function Breadcrumbs({ title }: { title: string }) {
  return (
    <nav className="public-breadcrumbs" aria-label="当前位置">
      <ol>
        <li>
          <a href="/">首页</a>
        </li>
        {title !== "公开档案馆" && (
          <li>
            <a href="/archive">公开档案馆</a>
          </li>
        )}
        <li aria-current="page">{title}</li>
      </ol>
    </nav>
  );
}

export function PublicArchive() {
  return (
    <PublicLayout page="archive">
      <SampleNotice />
      <Breadcrumbs title="公开档案馆" />
      <section className="public-page-intro" aria-labelledby="archive-title">
        <p className="public-eyebrow" lang="en">
          PUBLIC ARCHIVE
        </p>
        <h1 id="archive-title">公开档案馆</h1>
        <p className="public-lead">按届次查阅工作回顾、议事记录与文章。</p>
      </section>
      <div className="public-archive-grid">
        <aside className="public-archive-nav" id="terms">
          <h2>按届次查阅</h2>
          <nav aria-label="届次目录">
            <ol>
              {archiveTerms.map((term) => (
                <li key={term.id}>
                  <a href={`#${term.id}`}>{term.title}</a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="public-reading-note">
            <h3>关于馆藏</h3>
            <p>
              这里收录供公众阅读的文章与资料。成员会议和日常事务请前往
              <a href="/portal">协作工作台</a>。
            </p>
          </div>
        </aside>
        <div className="public-collections">
          {archiveTerms.map((term, index) => {
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
                  <span className="public-volume-number" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="public-eyebrow" lang="en">
                      COLLECTION
                    </p>
                    <h2 id={`${term.id}-title`}>{term.title}</h2>
                    <p>{term.description}</p>
                  </div>
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
  const related = archiveRecords.filter(
    (item) => item.termId === record.termId && item.slug !== record.slug,
  );
  return (
    <PublicLayout page="archive">
      <SampleNotice />
      <Breadcrumbs title={record.title} />
      <article className="public-article" aria-labelledby="article-title">
        <header className="public-article-header">
          <p className="public-eyebrow">
            {record.category} <span aria-hidden="true">/</span> {term?.title}
          </p>
          <h1 id="article-title">{record.title}</h1>
          <p className="public-lead">{record.summary}</p>
          <dl className="public-article-metadata">
            <div>
              <dt>馆藏编号</dt>
              <dd>
                {record.isExample === true ? "SAMPLE" : "AC"}-{record.number}
              </dd>
            </div>
            <div>
              <dt>所属届次</dt>
              <dd>
                <a href={`/archive#${record.termId}`}>{term?.title}</a>
              </dd>
            </div>
            {record.isExample === true ? (
              <div>
                <dt>文档状态</dt>
                <dd>排版示例 · 非真实历史记录</dd>
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
          <aside className="public-article-contents">
            <nav aria-label="本文目录">
              <h2>本篇目录</h2>
              <ol>
                {record.sections.map((section, index) => (
                  <li key={section.title}>
                    <a href={`#section-${index + 1}`}>{section.title}</a>
                  </li>
                ))}
              </ol>
            </nav>
            <a className="public-return" href={`/archive#${record.termId}`}>
              <ArrowLeft size={16} aria-hidden="true" />
              返回本届目录
            </a>
          </aside>
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
            <div className="public-article-end">
              <span aria-hidden="true">——</span>
              <p>
                {record.isExample === true
                  ? "示例文稿，仅供本次设计审核。"
                  : "本文收录于安提柯议会公开档案馆。"}
              </p>
              <a href={`/archive#${record.termId}`}>
                返回{term?.title}
                <ArrowRight size={17} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </article>
      {!!related.length && (
        <section className="public-related" aria-labelledby="related-title">
          <h2 id="related-title">同届记录</h2>
          <RecordList records={related} />
        </section>
      )}
    </PublicLayout>
  );
}
