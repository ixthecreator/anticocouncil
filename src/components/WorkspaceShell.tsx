import { useRef, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  Download,
  Monitor,
  Search,
  Settings2,
  Upload,
  X,
} from "lucide-react";
import {
  workspaceNavigation as navigation,
  type WorkspacePage,
  type WorkspaceTheme,
} from "../lib/workspaceNavigation";
export type { WorkspacePage, WorkspaceTheme } from "../lib/workspaceNavigation";

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
  const extraNavigation = useRef<HTMLDetailsElement>(null);
  const settingsContainer = useRef<HTMLDivElement>(null);
  const ModeIcon = mode === "local" ? Monitor : Cloud;
  const status =
    connection === "error"
      ? "连接需要处理"
      : connection === "offline"
        ? "连接中断"
        : pending
          ? "正在保存"
          : ready
            ? notice === "已保存"
              ? "已保存"
              : mode === "firebase"
                ? "云端已连接"
                : "工作区已就绪"
            : mode === "firebase"
              ? "正在连接云端"
              : "正在加载";
  const go = (next: WorkspacePage) => {
    onNavigate(next);
    if (extraNavigation.current) extraNavigation.current.open = false;
  };
  return (
    <div className="council-shell parliament-shell">
      <a
        className="skip-link"
        href="#workspace-main"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById("workspace-main");
          main?.focus();
          main?.scrollIntoView();
        }}
      >
        跳到工作内容
      </a>
      <header className="parliament-masthead">
        <div className="parliament-container parliament-header-inner">
          <a
            className="parliament-brand"
            href="/"
            aria-label="安提柯议会，返回首页"
          >
            <span className="parliament-monogram" aria-hidden="true">
              A<span>·</span>C
            </span>
            <span>
              <strong>安提柯议会</strong>
              <small>ANTICO COUNCIL</small>
            </span>
          </a>
          <div className="parliament-header-tools">
            <span className="parliament-header-label">
              {mode === "local" ? "本地工作台" : "成员工作台"}
            </span>
            {account || (
              <span className="parliament-local-account">
                <Monitor size={19} aria-hidden="true" /> 本地试用
              </span>
            )}
          </div>
        </div>
      </header>
      <div className="parliament-navigation-bar">
        <nav
          className="parliament-container parliament-navigation"
          aria-label="工作区导航"
        >
          {navigation.slice(0, 5).map((item) => (
            <button
              type="button"
              key={item.id}
              aria-current={page === item.id ? "page" : undefined}
              onClick={() => go(item.id)}
            >
              {item.title}
            </button>
          ))}
          <details
            className="parliament-more"
            ref={extraNavigation}
            onKeyDown={(event) => {
              if (event.key === "Escape" && extraNavigation.current) {
                extraNavigation.current.open = false;
                extraNavigation.current.querySelector("summary")?.focus();
              }
            }}
          >
            <summary
              className={
                navigation.slice(5).some((item) => item.id === page)
                  ? "has-active-page"
                  : ""
              }
            >
              更多工作 <ChevronDown size={15} aria-hidden="true" />
            </summary>
            <div className="parliament-more-menu">
              {navigation.slice(5).map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-current={page === item.id ? "page" : undefined}
                  onClick={() => go(item.id)}
                >
                  {item.title}
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              ))}
            </div>
          </details>
        </nav>
      </div>
      <div className="parliament-container parliament-service-strip">
        <span className="council-tag purple">
          {mode === "local" ? "本地试用" : "成员协作"}
        </span>
        <p>
          {mode === "local"
            ? "数据只保存在此浏览器；团队协作请进入云端 Portal。"
            : "议会成员共享此工作区，请等待保存确认后离开。"}
        </p>
        <span
          className={`save-status ${pending || !ready ? "is-pending" : ""} connection-${connection}`}
          role="status"
        >
          {ready && !pending && <Check size={14} aria-hidden="true" />}
          {status}
        </span>
      </div>
      <div className="council-main">
        <div className="workspace-topbar parliament-container">
          <div className="breadcrumb">
            <button
              type="button"
              className="council-link"
              onClick={() => go("overview")}
            >
              {mode === "local" ? "本地工作台" : "成员工作台"}
            </button>
            <ChevronRight size={14} aria-hidden="true" />
            <strong>{current.title}</strong>
          </div>
          <div className="topbar-tools">
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
            <div
              ref={settingsContainer}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  const details =
                    settingsContainer.current?.querySelector("details");
                  if (details) {
                    details.open = false;
                    details.querySelector("summary")?.focus();
                  }
                }
              }}
            >
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
                      <option value="parliament">议会紫</option>
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
                      <option value="local">本地试用 · 此浏览器</option>
                      <option value="firebase">Portal · 团队云端</option>
                    </select>
                  </label>
                  <p className="workspace-help">
                    本地试用与团队云端分别保存。进入 Portal
                    需要登录并获得成员批准，切换不会迁移记录。
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
                  <a
                    className="workspace-guide-link"
                    href="/antico-council-guide.pdf"
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看 PDF 使用说明
                  </a>
                </div>
              </details>
            </div>
          </div>
        </div>
        <main
          id="workspace-main"
          className={`workspace-content page-${page}`}
          tabIndex={-1}
        >
          <div className="page-heading">
            <div>
              <span className="page-kicker">{current.kicker}</span>
              <h1>{current.title}</h1>
              <p>{current.description}</p>
            </div>
            <span className="parliament-date">
              {new Date().toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              <small>
                {new Date().toLocaleDateString("zh-CN", { weekday: "long" })}
              </small>
            </span>
          </div>
          {mode === "firebase" && connectionError && (
            <div className="workspace-connection-error" role="alert">
              <span>{connectionError}</span>
              <button
                type="button"
                className="workspace-button"
                onClick={onReconnect}
              >
                重新连接
              </button>
            </div>
          )}
          {notice && notice !== "已保存" && (
            <p className="workspace-notice" role="status">
              <Check size={16} aria-hidden="true" />
              {notice}
            </p>
          )}
          {children}
        </main>
        <footer className="parliament-footer">
          <div className="parliament-container">
            <div>
              <strong>安提柯议会</strong>
              <span>共同讨论 · 共同决定 · 共同执行</span>
            </div>
            <a
              href="/antico-council-guide.pdf"
              target="_blank"
              rel="noreferrer"
            >
              使用说明
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
