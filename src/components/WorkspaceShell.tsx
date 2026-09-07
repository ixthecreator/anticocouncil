import type { ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Cloud,
  Download,
  FolderArchive,
  FolderOpen,
  Gavel,
  LayoutGrid,
  Monitor,
  Package,
  PenLine,
  Search,
  Settings2,
  Upload,
  X,
} from "lucide-react";

export type WorkspacePage =
  | "session"
  | "post"
  | "supervision"
  | "archive"
  | "activity"
  | "editorial"
  | "assets"
  | "inventory";
export type WorkspaceTheme = "classic" | "prussian" | "burgundy" | "latenight";

const navigation = [
  {
    id: "session",
    title: "例会现场",
    description: "从签到到决议，让每一次讨论都有着落。",
    icon: Gavel,
    group: "会议协作",
    search: "搜索本次会议的议题…",
  },
  {
    id: "post",
    title: "会后执行",
    description: "跟进授权与执行，把会议决议变成实际进展。",
    icon: CheckCheck,
    group: "会议协作",
    search: "搜索本次会议的待办…",
  },
  {
    id: "supervision",
    title: "全局督办",
    description: "关注各次会议的待办与进展，及时推进未完成事项。",
    icon: LayoutGrid,
    group: "会议协作",
    search: "搜索全部议题…",
  },
  {
    id: "archive",
    title: "历届档案",
    description: "回顾讨论、查阅决议，留存每一次共同工作的记录。",
    icon: FolderArchive,
    group: "会议协作",
    search: "搜索会议名称、日期、报告…",
  },
  {
    id: "activity",
    title: "月度沙龙",
    description: "规划每月相聚的时间，记录话题与参与者。",
    icon: CalendarDays,
    group: "日常工作",
    search: "搜索沙龙、组织者、地点…",
  },
  {
    id: "editorial",
    title: "编辑部",
    description: "从选题到发布，让作者、编辑与美工有序协作。",
    icon: PenLine,
    group: "日常工作",
    search: "搜索编辑安排…",
  },
  {
    id: "assets",
    title: "资料库",
    description: "汇集作者名片、设计素材与往期成果，随时取用。",
    icon: FolderOpen,
    group: "日常工作",
    search: "搜索资料、作者、标签…",
  },
  {
    id: "inventory",
    title: "文创库存",
    description: "记录物品、数量与存放位置，让每一份物料都有去处。",
    icon: Package,
    group: "日常工作",
    search: "搜索物品、存放位置、保管人…",
  },
] as const;

export function WorkspaceShell({
  page,
  onNavigate,
  theme,
  onThemeChange,
  mode,
  onModeChange,
  pending,
  ready,
  notice,
  connection,
  connectionError,
  onReconnect,
  account,
  search,
  onSearchChange,
  onExport,
  onImport,
  children,
}: {
  page: WorkspacePage;
  onNavigate: (page: WorkspacePage) => void;
  theme: WorkspaceTheme;
  onThemeChange: (theme: WorkspaceTheme) => void;
  mode: "local" | "firebase";
  onModeChange: (mode: "local" | "firebase") => void;
  pending: number;
  ready: boolean;
  notice: string;
  connection: "local" | "connecting" | "connected" | "offline" | "error";
  connectionError: string;
  onReconnect: () => void;
  account?: ReactNode;
  search: string;
  onSearchChange: (search: string) => void;
  onExport: () => void;
  onImport: () => void;
  children: ReactNode;
}) {
  const current = navigation.find((item) => item.id === page)!;
  const ModeIcon = mode === "local" ? Monitor : Cloud;
  const status = connection === "error" ? "连接需要处理" : connection === "offline" ? "连接中断" : pending
    ? "正在保存"
    : ready
      ? notice === "已保存"
        ? "已保存"
        : mode === "firebase" ? "云端已连接" : "工作区已就绪"
      : mode === "firebase" ? "正在连接云端" : "正在加载";
  return (
    <div className="council-shell">
      <a className="skip-link" href="#workspace-main">
        跳到工作内容
      </a>
      <aside className="council-sidebar">
        <a className="council-brand" href="/" aria-label="安提柯议会，返回首页">
          <span className="brand-emblem">
            <img src="/logo.png" alt="" />
          </span>
          <span>
            <strong>安提柯议会</strong>
            <small>ANTICO COUNCIL</small>
          </span>
        </a>
        <div className="sidebar-caption">共同讨论 · 有序行动</div>
        <nav className="council-navigation" aria-label="工作区导航">
          {["会议协作", "日常工作"].map((group) => (
            <div className="nav-group" key={group}>
              <span className="nav-group-label">{group}</span>
              {navigation
                .filter((item) => item.group === group)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      aria-current={page === item.id ? "page" : undefined}
                      onClick={() => onNavigate(item.id)}
                    >
                      <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
                      <span>{item.title}</span>
                      {page === item.id && (
                        <ChevronRight
                          className="nav-arrow"
                          size={15}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="storage-note">
            <ModeIcon size={20} aria-hidden="true" />
            <strong>{mode === "local" ? "本地工作区" : "云端工作区"}</strong>
            <span className={`connection-dot connection-${connection}`} />
          </div>
          <p>
            {mode === "local"
              ? "数据保存在此浏览器。定期导出备份，让记录安心留存。"
              : "议会成员共享此工作区。请按分工维护资料，等待保存完成后离开。"}
          </p>
          <span className="sidebar-signature">
            每一份共识，都值得被记录。
            <ArrowUpRight size={14} aria-hidden="true" />
          </span>
        </div>
      </aside>
      <div className="council-main">
        <header className="workspace-topbar">
          <div className="breadcrumb">
            <span>工作台</span>
            <ChevronRight size={14} aria-hidden="true" />
            <strong>{current.title}</strong>
          </div>
          <div className="topbar-tools">
            {account}
            <div className="workspace-search">
              <Search size={17} aria-hidden="true" />
              <input
                type="search"
                aria-label={current.search.replace("…", "")}
                placeholder={current.search}
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
              />
              {search && (
                <button
                  type="button"
                  aria-label="清除搜索"
                  onClick={() => onSearchChange("")}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <details className="shell-settings">
              <summary aria-label="工作区设置" title="工作区设置">
                <Settings2 size={19} />
                <span>设置</span>
              </summary>
              <div className="settings-popover">
                <h2>工作区设置</h2>
                <label className="workspace-field">
                  <span>界面配色</span>
                  <select
                    value={theme}
                    onChange={(event) =>
                      onThemeChange(event.target.value as WorkspaceTheme)
                    }
                  >
                    <option value="prussian">普鲁士蓝</option>
                    <option value="classic">经典石墨</option>
                    <option value="burgundy">勃艮第红</option>
                    <option value="latenight">深夜模式</option>
                  </select>
                </label>
                <label className="workspace-field">
                  <span>数据位置</span>
                  <select
                    value={mode}
                    disabled={!!pending}
                    onChange={(event) =>
                      onModeChange(event.target.value as "local" | "firebase")
                    }
                  >
                    <option value="local">此浏览器 · 本地存储</option>
                    <option value="firebase">云端协作 · Firebase</option>
                  </select>
                </label>
                <p className="workspace-help">
                  本地和云端分别保存，切换后显示对应工作区。
                </p>
                <div className="settings-backup">
                  <button
                    type="button"
                    className="workspace-button"
                    disabled={!ready && mode !== "local"}
                    onClick={onExport}
                  >
                    <Download size={16} />
                    导出备份
                  </button>
                  <button
                    type="button"
                    className="workspace-button"
                    disabled={!!pending}
                    onClick={onImport}
                  >
                    <Upload size={16} />
                    导入备份
                  </button>
                </div>
                <a className="workspace-guide-link" href="/antico-council-guide.pdf" target="_blank" rel="noreferrer">查看 PDF 使用说明</a>
              </div>
            </details>
          </div>
        </header>
        <main
          id="workspace-main"
          className={`workspace-content page-${page}`}
          tabIndex={-1}
        >
          <div className="page-heading">
            <div>
              <span className="page-kicker">{current.group}</span>
              <h1>
                {current.title}
                <span className="heading-dot" />
              </h1>
              <p>{current.description}</p>
            </div>
            <div className="workspace-presence">
              <span className="mode-label">
                <ModeIcon size={15} />
                {mode === "local" ? "本地工作区" : "云端工作区"}
              </span>
              <span
                className={`save-status ${pending || !ready ? "is-pending" : ""} connection-${connection}`}
                role="status"
              >
                {ready && !pending && <Check size={14} />}
                {status}
              </span>
            </div>
          </div>
          {mode === "firebase" && connectionError && (
            <div className="workspace-connection-error" role="alert">
              <span>{connectionError}</span>
              <button type="button" className="workspace-button" onClick={onReconnect}>重新连接</button>
            </div>
          )}
          {notice && notice !== "已保存" && (
            <p className="workspace-notice" role="status">
              <Check size={16} aria-hidden="true" />
              {notice}
            </p>
          )}
          {children}
          <footer className="workspace-footer">
            <span>ANTICO COUNCIL</span>
            <span>议有所决，行有所成。</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
