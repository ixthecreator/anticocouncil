import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ChevronDown,
  CircleCheck,
  Clock,
  CloudOff,
  Download,
  FileText,
  Menu,
  Monitor,
  Search,
  Settings2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import {
  workspaceNavigation as navigation,
  type WorkspacePage,
} from "../lib/workspaceNavigation";
export type { WorkspacePage } from "../lib/workspaceNavigation";

const primaryNavigation = navigation.filter((item) => item.group === "会议协作");
const dailyNavigation = navigation.filter((item) => item.group === "日常工作");

function isoDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function WorkspaceShell({
  page,
  onNavigate,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const extraNavigation = useRef<HTMLDetailsElement>(null);
  const settingsDetails = useRef<HTMLDetailsElement>(null);
  const dailyActive = dailyNavigation.some((item) => item.id === page);
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
  const StatusIcon =
    connection === "error"
      ? TriangleAlert
      : connection === "offline"
        ? CloudOff
        : pending || !ready
          ? Clock
          : CircleCheck;
  const today = new Date();

  // Popovers close when the pointer goes down anywhere outside them.
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      for (const details of [extraNavigation.current, settingsDetails.current])
        if (details?.open && !details.contains(event.target as Node))
          details.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  const go = (next: WorkspacePage) => {
    onNavigate(next);
    const daily = extraNavigation.current;
    if (daily?.open) {
      daily.open = false;
      if (daily.contains(document.activeElement))
        daily.querySelector("summary")?.focus();
    }
    if (menuOpen) {
      setMenuOpen(false);
      menuButton.current?.focus();
    }
  };
  // Navigation items are real links (#page) so they can open in a new tab;
  // a plain click stays in the app.
  const follow =
    (next: WorkspacePage) => (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      go(next);
    };
  const closeOnEscape =
    (details: RefObject<HTMLDetailsElement | null>) =>
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && details.current?.open) {
        event.stopPropagation();
        details.current.open = false;
        details.current.querySelector("summary")?.focus();
      }
    };

  return (
    <div className="council-shell workspace-shell">
      <a
        className="ac-skip-link"
        href="#workspace-main"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById("workspace-main");
          main?.focus();
          main?.scrollIntoView();
        }}
      >
        跳到页面内容
      </a>
      <header className="workspace-masthead">
        <div className="workspace-brand-band">
          <div className="ac-container workspace-brand-row">
            <a className="workspace-brand" href="/">
              <img src="/logo.png" alt="" width="48" height="48" />
              <span className="workspace-brand-name">安提柯议会</span>
              <span className="ac-visually-hidden">，返回首页</span>
            </a>
            <span className="workspace-product-name">工作台</span>
            <div className="workspace-account">
              {account || (
                <span className="workspace-local-account">
                  <Monitor size={20} aria-hidden="true" />
                  本地试用
                </span>
              )}
            </div>
          </div>
        </div>
        <nav
          className="workspace-navigation"
          aria-label="工作区导航"
          onKeyDown={(event) => {
            if (event.key === "Escape" && menuOpen) {
              setMenuOpen(false);
              menuButton.current?.focus();
            }
          }}
        >
          <div className="ac-container">
            <button
              type="button"
              ref={menuButton}
              className="workspace-menu-button"
              aria-expanded={menuOpen}
              aria-controls="workspace-navigation-list"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? (
                <X size={20} aria-hidden="true" />
              ) : (
                <Menu size={20} aria-hidden="true" />
              )}
              菜单
            </button>
            <ul
              id="workspace-navigation-list"
              className={`workspace-navigation-list${menuOpen ? " is-open" : ""}`}
            >
              {primaryNavigation.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    aria-current={page === item.id ? "page" : undefined}
                    onClick={follow(item.id)}
                  >
                    {item.title}
                  </a>
                </li>
              ))}
              <li className="workspace-navigation-daily">
                <details
                  ref={extraNavigation}
                  onKeyDown={closeOnEscape(extraNavigation)}
                >
                  <summary className={dailyActive ? "has-active-page" : undefined}>
                    日常工作
                    {dailyActive && (
                      <span className="ac-visually-hidden">，含当前页面</span>
                    )}
                    <ChevronDown size={16} aria-hidden="true" />
                  </summary>
                  <ul className="workspace-daily-menu">
                    {dailyNavigation.map((item) => (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          aria-current={page === item.id ? "page" : undefined}
                          onClick={follow(item.id)}
                        >
                          {item.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            </ul>
          </div>
        </nav>
        <div className="workspace-service-strip">
          <div className="ac-container workspace-service-inner">
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
              <StatusIcon size={16} aria-hidden="true" />
              {status}
            </span>
          </div>
        </div>
      </header>
      <main
        id="workspace-main"
        className={`workspace-content page-${page}`}
        tabIndex={-1}
      >
        <div className="ac-container ac-surface workspace-surface">
          <div className="workspace-topbar">
            <nav className="workspace-breadcrumbs" aria-label="面包屑">
              <ol>
                <li>
                  <a href="#overview" onClick={follow("overview")}>
                    工作台
                  </a>
                </li>
                <li>{current.title}</li>
              </ol>
            </nav>
            <div className="topbar-tools">
              {page !== "cards" && (
                <div className="workspace-search">
                  <Search size={20} aria-hidden="true" />
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
                      <X size={20} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
              <details
                className="shell-settings"
                ref={settingsDetails}
                onKeyDown={closeOnEscape(settingsDetails)}
              >
                <summary aria-label="工作区设置">
                  <Settings2 size={20} aria-hidden="true" />
                  <span>设置</span>
                </summary>
                <div className="settings-popover">
                  <p className="settings-popover-title">工作区设置</p>
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
                      <Download size={20} aria-hidden="true" />
                      导出备份
                    </button>
                    <button
                      type="button"
                      className="workspace-button"
                      disabled={!!pending}
                      onClick={onImport}
                    >
                      <Upload size={20} aria-hidden="true" />
                      导入备份
                    </button>
                  </div>
                  <a
                    className="workspace-guide-link"
                    href="/antico-council-guide.pdf"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText size={16} aria-hidden="true" />
                    查看 PDF 使用说明
                    <span className="ac-visually-hidden">，在新窗口打开</span>
                  </a>
                </div>
              </details>
            </div>
          </div>
          <div className="page-heading">
            <div className="page-heading-text">
              <h1>{current.title}</h1>
              <p className="page-lead">{current.description}</p>
            </div>
            <p className="workspace-date">
              <time dateTime={isoDate(today)}>
                {today.toLocaleDateString("zh-CN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}{" "}
                {today.toLocaleDateString("zh-CN", { weekday: "long" })}
              </time>
            </p>
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
              <CircleCheck size={16} aria-hidden="true" />
              {notice}
            </p>
          )}
          {children}
        </div>
      </main>
      <footer className="workspace-footer">
        <div className="ac-container workspace-footer-inner">
          <div className="workspace-footer-identity">
            <p className="workspace-footer-name">安提柯议会</p>
            <p>共同讨论 · 共同决定 · 共同执行</p>
            <p>成员交流 QQ 群：977589830</p>
          </div>
          <nav aria-label="帮助与其他入口">
            <ul className="workspace-footer-links">
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
                <a href="/archive">公开档案馆</a>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
