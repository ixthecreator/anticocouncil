import { type ReactNode } from "react";
import { ArrowRight, ArrowUpRight, BookOpen, FileText, LayoutGrid, LockKeyhole } from "lucide-react";
import "./landing.css";

type PublicPage = "home" | "blog" | "not-found";

function PublicLayout({ page, children }: { page: PublicPage; children: ReactNode }) {
  return (
    <div className="public-site start-layout">
      <a className="start-skip" href="#start-main">跳到页面内容</a>
      <header className="start-header">
        <a className="start-brand" href="/" aria-label="安提柯议会，返回开始页">
          <span className="start-emblem"><img src="/logo.png" alt="" /></span>
          <span><strong>安提柯议会</strong><small lang="en">ANTICO COUNCIL</small></span>
        </a>
        <nav className="start-navigation" aria-label="网站导航">
          <a href="/" aria-current={page === "home" ? "page" : undefined}>开始页</a>
          <a href="/blog" aria-current={page === "blog" ? "page" : undefined}>Blog</a>
          <a className="start-nav-portal" href="/portal">Portal<ArrowUpRight size={16} aria-hidden="true" /></a>
        </nav>
      </header>
      <main className={`start-main ${page === "home" ? "start-home" : "start-secondary"}`} id="start-main" tabIndex={-1}>
        {children}
      </main>
      <footer className="start-footer">
        <span>© {new Date().getFullYear()} Antico Council</span>
        <nav aria-label="帮助与其他入口">
          <a href="/antico-council-guide.pdf" target="_blank" rel="noreferrer"><FileText size={15} aria-hidden="true" />使用说明<span className="start-pdf-label">PDF</span><span className="start-sr-only">，在新窗口打开</span></a>
          <a href="/preview/">新 UI 试用<ArrowUpRight size={15} aria-hidden="true" /></a>
          <a href="/local">本地试用<ArrowUpRight size={15} aria-hidden="true" /></a>
        </nav>
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return (
    <PublicLayout page="home">
      <section className="start-intro" aria-labelledby="start-title">
        <span className="start-eyebrow"><span aria-hidden="true" />ANTICO COUNCIL</span>
        <h1 id="start-title">共同讨论，<br className="start-mobile-break" />有序行动<span className="start-title-stop">。</span></h1>
        <p>参与协作，或阅读记录。<br className="start-mobile-break" />从这里，选择你的去处。</p>
      </section>
      <section className="start-destinations" aria-label="选择访问入口">
        <a className="start-destination start-destination-portal" href="/portal">
          <div className="start-card-top"><span className="start-access"><LockKeyhole size={14} aria-hidden="true" />登录后访问</span><LayoutGrid size={28} strokeWidth={1.4} aria-hidden="true" /></div>
          <div className="start-card-copy"><h2 lang="en">Portal</h2><h3>协作工作台</h3><p>登录后参与会议与日常协作，<br />让讨论、决议与行动有序衔接。</p></div>
          <div className="start-card-bottom"><span>进入 Portal</span><span className="start-card-arrow"><ArrowRight size={21} aria-hidden="true" /></span></div>
        </a>
        <a className="start-destination start-destination-blog" href="/blog">
          <div className="start-card-top"><span className="start-access">公开阅读<span className="start-access-dot" aria-hidden="true" />筹备中</span><BookOpen size={29} strokeWidth={1.4} aria-hidden="true" /></div>
          <div className="start-card-copy"><h2 lang="en">Blog</h2><h3>文字与记录</h3><p>留给文章、交流与思考的空间。<br />栏目正在筹备，暂未发布文章。</p></div>
          <div className="start-card-bottom"><span>前往 Blog</span><span className="start-card-arrow"><ArrowRight size={21} aria-hidden="true" /></span></div>
        </a>
      </section>
      <p className="start-access-note">Portal 需登录并获得成员访问权限；Blog 可公开浏览。</p>
    </PublicLayout>
  );
}

export function BlogPage() {
  return (
    <PublicLayout page="blog">
      <section className="start-page-intro" aria-labelledby="blog-title"><span className="start-eyebrow">BLOG</span><h1 id="blog-title">文字与记录<span className="start-title-stop">。</span></h1><p>讨论之外，留一点篇幅，给值得展开的思考。</p></section>
      <section className="start-empty" aria-labelledby="blog-empty-title">
        <span className="start-empty-icon"><BookOpen size={34} strokeWidth={1.3} aria-hidden="true" /></span>
        <span className="start-status">栏目筹备中</span>
        <h2 id="blog-empty-title">这里，留给未来的文字。</h2>
        <p>文章与活动记录将在这里发布。<br />目前还没有公开文章，欢迎之后再来。</p>
        <a className="start-button" href="/">返回开始页<ArrowRight size={18} aria-hidden="true" /></a>
      </section>
    </PublicLayout>
  );
}

export function NotFoundPage() {
  return (
    <PublicLayout page="not-found">
      <section className="start-empty start-not-found" aria-labelledby="not-found-title">
        <span className="start-error-code" aria-hidden="true">404</span>
        <h1 id="not-found-title">没有找到这一页</h1>
        <p>地址可能有误，也可能已经更新。<br />回到开始页，选择 Portal 或 Blog 继续。</p>
        <a className="start-button" href="/">返回开始页<ArrowRight size={18} aria-hidden="true" /></a>
      </section>
    </PublicLayout>
  );
}
