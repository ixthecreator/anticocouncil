import { useRef, useState, type ReactNode } from "react";
import {
  ArrowRight, ArrowUpRight, BookOpen, CalendarDays, CheckCheck, ChevronRight,
  CircleHelp, FileText, FolderArchive, FolderOpen, Gavel, House, LayoutGrid,
  Lightbulb, Package, PenLine, Search, X,
} from "lucide-react";
import "./landing.css";

const workModules = [
  { id: "session", title: "例会现场", description: "成员签到、记录汇报，讨论议题并参与表决。", keywords: "会议 投票 发言 纪要", group: "会议协作", icon: Gavel, color: "blue" },
  { id: "post", title: "会后执行", description: "跟进决议授权、任务交接与执行进度。", keywords: "待办 完成 工作", group: "会议协作", icon: CheckCheck, color: "green" },
  { id: "supervision", title: "全局督办", description: "查看各次会议的待办，推进未完成事项。", keywords: "任务 跟踪 进展", group: "会议协作", icon: LayoutGrid, color: "amber" },
  { id: "archive", title: "历届档案", description: "查阅历次会议记录，导出纪要与决议。", keywords: "历史 PDF 文档", group: "会议协作", icon: FolderArchive, color: "slate" },
  { id: "activity", title: "月度沙龙", description: "安排活动时间、交流主题与参与组织。", keywords: "日程 排期 会议链接", group: "日常工作", icon: CalendarDays, color: "purple" },
  { id: "editorial", title: "编辑部", description: "安排选题、作者、编辑与排版，跟进发布。", keywords: "微信 QQ 文章 稿件 创作", group: "日常工作", icon: PenLine, color: "blue" },
  { id: "assets", title: "资料库", description: "整理作者名片、设计素材与往期成果。", keywords: "文件 下载 美工 上传 附件", group: "日常工作", icon: FolderOpen, color: "green" },
  { id: "inventory", title: "文创库存", description: "登记物品数量、存放地点与保管人。", keywords: "物料 后勤 文创存放", group: "日常工作", icon: Package, color: "amber" },
] as const;

type PortalPage = "home" | "blog" | "not-found";
type ModuleGroup = "全部模块" | "会议协作" | "日常工作";

function PortalLayout({ page, children }: { page: PortalPage; children: ReactNode }) {
  const title = page === "home" ? "门户首页" : page === "blog" ? "文字与记录" : "页面未找到";
  return (
    <div className="public-site portal-layout">
      <a className="portal-skip" href="#portal-main">跳到页面内容</a>
      <aside className="portal-sidebar">
        <a className="portal-brand" href="/" aria-label="安提柯议会，返回门户首页">
          <span className="portal-emblem"><img src="/logo.png" alt="" /></span>
          <span><strong>安提柯议会</strong><small>ANTICO COUNCIL</small></span>
        </a>
        <p className="portal-sidebar-caption">共同讨论 · 有序行动</p>
        <nav className="portal-navigation" aria-label="门户导航">
          <span className="portal-nav-label">协作门户</span>
          <a href="/" aria-current={page === "home" ? "page" : undefined}><House size={19} aria-hidden="true" /><span>门户首页</span>{page === "home" && <ChevronRight className="portal-nav-arrow" size={16} aria-hidden="true" />}</a>
          <a href="/#modules"><LayoutGrid size={19} aria-hidden="true" /><span>工作模块</span></a>
          <a href="/#guide"><CircleHelp size={19} aria-hidden="true" /><span>使用指南</span></a>
          <a href="/blog" aria-current={page === "blog" ? "page" : undefined}><BookOpen size={19} aria-hidden="true" /><span>文字与记录</span>{page === "blog" && <ChevronRight className="portal-nav-arrow" size={16} aria-hidden="true" />}</a>
        </nav>
        <nav className="portal-navigation portal-frequent" aria-label="常用工作入口">
          <span className="portal-nav-label">快速开始</span>
          <a href="/workspace#session"><Gavel size={19} aria-hidden="true" /><span>参加例会</span><ArrowUpRight size={15} aria-hidden="true" /></a>
          <a href="/workspace#post"><CheckCheck size={19} aria-hidden="true" /><span>跟进执行</span><ArrowUpRight size={15} aria-hidden="true" /></a>
          <a href="/workspace#editorial"><PenLine size={19} aria-hidden="true" /><span>安排编辑</span><ArrowUpRight size={15} aria-hidden="true" /></a>
        </nav>
        <div className="portal-sidebar-footer"><span className="portal-sidebar-rule" /><strong>议有所决，行有所成。</strong><p>让每一份共识，都有下一步。</p></div>
      </aside>
      <div className="portal-main-column">
        <header className="portal-topbar">
          <div className="portal-breadcrumb"><span>安提柯议会</span><ChevronRight size={15} aria-hidden="true" /><strong>{title}</strong></div>
          <a className="portal-button portal-topbar-enter" href="/workspace#session">进入工作台<ArrowUpRight size={17} aria-hidden="true" /></a>
        </header>
        <main className="portal-content" id="portal-main" tabIndex={-1}>{children}</main>
        <footer className="portal-footer"><span>© {new Date().getFullYear()} Antico Council</span><div><a href="/">门户首页</a><a href="/antico-council-guide.pdf" target="_blank" rel="noreferrer">使用说明（PDF）<span className="portal-sr-only">，在新窗口打开</span></a></div></footer>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<ModuleGroup>("全部模块");
  const searchRef = useRef<HTMLInputElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredModules = workModules.filter((module) =>
    (group === "全部模块" || module.group === group) &&
    `${module.title} ${module.description} ${module.keywords}`.toLocaleLowerCase().includes(normalizedQuery),
  );
  const resetSearch = () => { setQuery(""); setGroup("全部模块"); searchRef.current?.focus(); };
  return (
    <PortalLayout page="home">
      <section className="portal-welcome" aria-labelledby="portal-welcome-title">
        <div><span className="portal-eyebrow">协作，从这里开始</span><h1 id="portal-welcome-title">欢迎来到安提柯议会<span aria-hidden="true">。</span></h1><p>找到要做的事，直接进入对应的工作空间。</p></div>
        <a className="portal-guide-shortcut" href="/antico-council-guide.pdf" target="_blank" rel="noreferrer"><span className="portal-guide-shortcut-icon"><FileText size={23} aria-hidden="true" /></span><span><strong>第一次使用？</strong><span>查看使用说明 · PDF</span></span><ArrowUpRight size={19} aria-hidden="true" /><span className="portal-sr-only">，在新窗口打开</span></a>
      </section>
      <section className="portal-modules-section" id="modules" aria-labelledby="modules-title">
        <div className="portal-section-heading">
          <div><h2 id="modules-title">工作模块</h2><p>从会议协作到日常工作，一处直达。</p></div>
          <form className="portal-module-search" role="search" aria-label="搜索工作模块" onSubmit={(event) => event.preventDefault()}><Search size={18} aria-hidden="true" /><input ref={searchRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索模块，如签到、资料…" aria-label="搜索模块名称或功能" aria-controls="portal-module-results" />{query && <button type="button" aria-label="清除模块搜索" onClick={() => { setQuery(""); searchRef.current?.focus(); }}><X size={17} aria-hidden="true" /></button>}</form>
        </div>
        <div className="portal-module-toolbar">
          <div className="portal-module-filters" role="group" aria-label="按工作类型筛选">{(["全部模块", "会议协作", "日常工作"] as const).map((label) => <button type="button" key={label} aria-pressed={group === label} onClick={() => setGroup(label)}>{label}<span aria-hidden="true">{label === "全部模块" ? workModules.length : workModules.filter((module) => module.group === label).length}</span></button>)}</div>
          <p className="portal-result-count" role="status" aria-live="polite" aria-atomic="true">{normalizedQuery || group !== "全部模块" ? `找到 ${filteredModules.length} 个模块` : `${workModules.length} 个工作入口`}</p>
        </div>
        <div id="portal-module-results">{filteredModules.length ? <div className="portal-module-grid">{filteredModules.map((module) => {
          const Icon = module.icon;
          return <a className="portal-module-card" key={module.id} href={`/workspace#${module.id}`}><div className="portal-module-card-top"><span className={`portal-module-icon ${module.color}`}><Icon size={23} strokeWidth={1.7} aria-hidden="true" /></span><ArrowUpRight className="portal-module-arrow" size={18} aria-hidden="true" /></div><h3>{module.title}</h3><p>{module.description}</p><span className="portal-module-category">{module.group}</span></a>;
        })}</div> : <div className="portal-no-results"><Search size={30} aria-hidden="true" /><h3>没有找到对应模块</h3><p>试试“例会”“编辑”或“资料”，也可以重置筛选。</p><button className="portal-button secondary" type="button" onClick={resetSearch}>查看全部模块</button></div>}</div>
      </section>
      <div className="portal-bottom-grid">
        <section className="portal-panel portal-guide" id="guide" aria-labelledby="guide-title">
          <div className="portal-panel-heading"><h2 id="guide-title"><Lightbulb size={20} aria-hidden="true" />使用提示</h2><a className="portal-text-link" href="/antico-council-guide.pdf" target="_blank" rel="noreferrer">完整说明<ArrowUpRight size={16} aria-hidden="true" /><span className="portal-sr-only">（PDF，在新窗口打开）</span></a></div>
          <ol className="portal-guide-list">
            <li><span className="portal-guide-number">01</span><div><h3>参加例会，先选择本次会议</h3><p>进入例会现场，选择或新建会议，再签到、记录汇报与讨论议题。</p></div><a href="/workspace#session" aria-label="前往例会现场"><ArrowRight size={19} aria-hidden="true" /></a></li>
            <li><span className="portal-guide-number">02</span><div><h3>会议结束，继续跟进执行</h3><p>在会后执行中推进授权与任务；需要回看时，打开历届档案。</p></div><a href="/workspace#post" aria-label="前往会后执行"><ArrowRight size={19} aria-hidden="true" /></a></li>
            <li><span className="portal-guide-number">03</span><div><h3>换设备或域名前，记得备份</h3><p>本地记录保存在当前浏览器。通过工作台右上角设置导出，再到新环境导入。</p></div></li>
          </ol>
        </section>
        <section className="portal-panel portal-journal" aria-labelledby="journal-title"><div className="portal-panel-heading"><h2 id="journal-title"><BookOpen size={20} aria-hidden="true" />文字与记录</h2><span className="portal-coming-soon">筹备中</span></div><div className="portal-journal-body"><span className="portal-journal-icon"><PenLine size={26} strokeWidth={1.5} aria-hidden="true" /></span><h3>给思考，留一个位置。</h3><p>这里将收录文章、沙龙札记与协作记录。栏目正在筹备，暂未发布文章。</p><a className="portal-text-link" href="/blog">查看文章栏目<ArrowRight size={17} aria-hidden="true" /></a></div></section>
      </div>
    </PortalLayout>
  );
}

export function BlogPage() {
  return <PortalLayout page="blog"><section className="portal-page-heading"><span className="portal-eyebrow">议会文章栏目</span><h1>文字与记录<span aria-hidden="true">。</span></h1><p>讨论之外，也留一点篇幅，给值得展开的思考。</p></section><section className="portal-panel portal-empty-page"><span className="portal-empty-icon"><BookOpen size={35} strokeWidth={1.4} aria-hidden="true" /></span><span className="portal-coming-soon">栏目筹备中</span><h2>第一篇，正在酝酿。</h2><p>未来的文章、沙龙札记与活动记录会在这里相聚。<br />目前还没有发布文章。</p><a className="portal-button secondary" href="/">返回门户首页<ArrowRight size={17} aria-hidden="true" /></a></section></PortalLayout>;
}

export function NotFoundPage() {
  return <PortalLayout page="not-found"><section className="portal-panel portal-empty-page portal-not-found"><span className="portal-error-code" aria-hidden="true">404</span><h1>这一页还不存在</h1><p>地址可能有误，也可能已经更新。<br />返回门户首页，找到需要的工作模块。</p><a className="portal-button" href="/">返回门户首页<ArrowRight size={17} aria-hidden="true" /></a></section></PortalLayout>;
}
