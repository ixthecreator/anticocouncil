/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  Issue,
  Meeting,
  Member,
  Status,
  Priority,
  DEFAULT_DEPARTMENTS,
  ActivityEvent,
} from "./types";
import { WorkspaceShell, type WorkspacePage } from "./components/WorkspaceShell";
import {
  workspacePageFromHash,
  workspaceTheme,
  type WorkspaceTheme,
} from "./lib/workspaceNavigation";
import { CouncilOverview } from "./components/CouncilOverview";
import { ProposalIndex } from "./components/ProposalIndex";
import "./components/parliament.css";
import { Empty } from "./components/WorkspaceForms";
import { AuthLoadingContent } from "./components/AuthPageFrame";
import { Users, ListChecks, CircleCheck } from "lucide-react";
import { MeetingManager } from "./components/MeetingManager";
import { IssueDetailModal } from "./components/IssueDetailModal";
import { SessionView } from "./components/SessionView";
import { PostMeetingView } from "./components/PostMeetingView";
import { ArchiveView } from "./components/ArchiveView";
import { SupervisionView } from "./components/SupervisionView";
import { ActivityView } from "./components/ActivityView";
import { OperationsView } from "./components/OperationsView";
import { buildMeetingExport, exportMeetingFileName, renderMeetingLatex, type MeetingExportKind } from "./lib/meetingExport";
import { renameMeeting } from "./lib/meetingRename";
import { downloadBlob } from "./lib/downloadBlob";
import { useWorkspace } from "./lib/useWorkspace";
import {
  downloadText,
  localDate,
  weekday,
  advanceIssue,
  weeklyReports,
} from "./lib/workspace";
import {
  Columns,
  List,
  BookOpen,
  Plus,
  Calendar,
  Clock,
  ArrowUpDown,
  FileText,
  Download,
  AlertCircle,
  Gavel,
  CheckSquare,
  FolderOpen,
  Activity,
  Settings,
  Search,
  Upload,
  Database,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Import GitHub Sync helpers

function pageFromHash(): WorkspacePage {
  return workspacePageFromHash(window.location.hash);
}

export default function App(props: {mode: "local" | "firebase"; onModeChange: (mode: "local" | "firebase") => void; account?: React.ReactNode}) {
  const workspace = useWorkspace(props);
  const {
    data,
    mode: storageMode,
    switchMode: setStorageMode,
    save,
    remove,
    ready,
    pending,
    error,
    notice,
    setError,
  } = workspace;
  const { issues, meetings, members, activities } = data;
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  useEffect(() => {
    setCurrentMeetingId((previous) =>
      meetings.some((m) => m.id === previous)
        ? previous
        : [...meetings].sort(
            (a, b) =>
              b.date.localeCompare(a.date) ||
              b.createdAt.localeCompare(a.createdAt),
          )[0]?.id || null,
    );
  }, [meetings]);

  // Filtering & Sorting State
  const [globalSearch, setGlobalSearch] = useState<string>("");
  const [selectedSignatureFilter, setSelectedSignatureFilter] =
    useState<string>("");
  const navigationSearch = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspacePage>(pageFromHash);
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(localDate()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const navigateTo = (page: WorkspacePage, nextSearch = "") => {
    navigationSearch.current =
      window.location.hash === `#${page}` ? null : nextSearch;
    window.location.hash = page;
    setActiveTab(page);
    setGlobalSearch(nextSearch);
    window.scrollTo({ top: 0 });
  };
  const openMeeting = (meeting: Meeting) => {
    setCurrentMeetingId(meeting.id);
    navigateTo("session");
  };
  const openIssue = (issue: Issue) => {
    setIsAddingNew(false);
    setActiveIssueForDetail(issue);
  };
  useEffect(() => {
    const navigate = () => {
      setActiveTab(pageFromHash());
      setGlobalSearch(navigationSearch.current ?? "");
      navigationSearch.current = null;
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [listSortKey, setListSortKey] = useState<
    "priority" | "category" | "status"
  >("priority");
  const [listSortOrder, setListSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<string>("all");
  const [selectedPriorityFilter, setSelectedPriorityFilter] =
    useState<string>("all");

  // Theme State
  const [theme, setTheme] = useState<WorkspaceTheme>(() => {
    try {
      return workspaceTheme(localStorage.getItem("app_theme"));
    } catch {
      return "parliament";
    }
  });

  // Modal State
  const [activeIssueForDetail, setActiveIssueForDetail] =
    useState<Issue | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);

  const [exportStatus, setExportStatus] = useState("");
  const [exportError, setExportError] = useState("");
  const exporting = useRef(false);
  const exportContext = useRef(0);
  useEffect(() => {
    setActiveIssueForDetail(null);
    exportContext.current++;
    setExportError("");
  }, [storageMode]);
  useEffect(() => () => { exportContext.current++; }, []);
  const handleStartAddIssue = () => {
    setActiveIssueForDetail({
      id: crypto.randomUUID(),
      title: "",
      category: "其他",
      priority: "medium",
      status: "agenda",
      description: "",
      discussion: "",
      signature: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: false,
      meetingId: currentMeetingId,
    } as any);
    setIsAddingNew(true);
  };

  const handleSaveIssue = (updated: Issue) =>
    workspace.change("issues", updated.id, (old) => {
      if (!old) return { ...updated, updatedAt: new Date().toISOString() };
      const originalStatus =
        activeIssueForDetail?.id === updated.id
          ? activeIssueForDetail.status
          : old.status;
      if (updated.status !== originalStatus && old.status !== originalStatus)
        throw new Error("议题状态已被其他成员修改。请重新打开后再调整状态。");
      return {
        ...old,
        title: updated.title,
        description: updated.description,
        category: updated.category,
        priority: updated.priority,
        discussion: updated.discussion,
        signature: updated.signature,
        dueDate: updated.dueDate || "",
        status: updated.status === originalStatus ? old.status : updated.status,
        updatedAt: new Date().toISOString(),
      };
    });
  const handleDeleteIssue = (id: string) => remove("issues", id);
  const handleAdvanceIssue = (updated: Issue) =>
    workspace.change("issues", updated.id, (old) => {
      if (!old) throw new Error("议题不存在。");
      const expected = (
        {
          authorization: "passed",
          execution: "authorization",
          completed: "execution",
        } as Partial<Record<Status, Status>>
      )[updated.status];
      if (!expected) throw new Error("不支持此状态流转。");
      return advanceIssue(old, expected, updated.status);
    });
  const handleAddMeeting = async (meeting: Meeting) => {
    await save("meetings", meeting);
    setCurrentMeetingId(meeting.id);
  };
  const handleRenameMeeting = (id: string, expectedTitle: string, title: string) =>
    workspace.change("meetings", id, (latest) => renameMeeting(latest, expectedTitle, title));
  const handleUpdateMeetingSummary = (id: string, summary: string) =>
    workspace.change("meetings", id, (old) => {
      if (!old) throw new Error("会议不存在");
      return { ...old, summary };
    });
  const handleUpdateMeetingRegularReport = (
    id: string,
    regularReport: string,
  ) =>
    workspace.change("meetings", id, (old) => {
      if (!old) throw new Error("会议不存在");
      return { ...old, regularReport };
    });
  const handleDeleteMeeting = async (id: string) => {
    if (
      issues.some((i) => i.meetingId === id) ||
      data.attendance.some((r) => r.meetingId === id || r.reportMeetingId === id)
    ) {
      setError("会议仍有关联议题或汇报记录，请保留档案。");
      return;
    }
    try {
      await remove("meetings", id);
    } catch {
      /* displayed in workspace */
    }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const handleExportJSON = () =>
    downloadText(
      !ready && storageMode === "local"
        ? workspace.rawLocalBackup()
        : JSON.stringify({ version: 2, ...data }, null, 2),
      `安提柯备份_${localDate()}.json`,
      "application/json",
    );
  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImportFile(event.target.files?.[0] || null);
    event.target.value = "";
  };

  const handleExportMeeting = async (
    ids: string[],
    kind: MeetingExportKind,
    format: "pdf" | "docx" | "latex",
  ) => {
    if (exporting.current) return;
    exporting.current = true;
    const context = exportContext.current;
    setExportError("");
    setExportStatus("正在准备会议文档…");
    try {
      if (!workspace.dataLoaded) throw new Error("会议数据尚未加载完成，请稍后重试。");
      const snapshot = buildMeetingExport(data, [...ids], format === "latex" ? "minutes" : kind, new Date());
      let blob: Blob;
      if (format === "pdf") {
        setExportStatus("正在加载 PDF 和中文字体…");
        const { renderMeetingPdf } = await import("./lib/meetingPdf");
        blob = await renderMeetingPdf(snapshot, () => {
          if (context === exportContext.current) setExportStatus("正在生成 PDF…");
        });
      } else if (format === "docx") {
        setExportStatus("正在生成 Word 文档…");
        const { renderMeetingDocx } = await import("./lib/meetingDocx");
        blob = await renderMeetingDocx(snapshot);
      } else {
        blob = new Blob([renderMeetingLatex(snapshot)], { type: "application/x-tex;charset=utf-8" });
      }
      if (context === exportContext.current) {
        downloadBlob(blob, exportMeetingFileName(snapshot, format === "latex" ? "tex" : format));
      }
    } catch (err) {
      if (context === exportContext.current) {
        setExportError(err instanceof Error ? err.message : "文档生成失败，请重试。");
      }
    } finally {
      exporting.current = false;
      setExportStatus("");
    }
  };

  // --- SORTING AND FILTERING FOR LIST VIEW ---
  const handleSort = (key: "priority" | "category" | "status") => {
    if (listSortKey === key) {
      setListSortOrder(listSortOrder === "asc" ? "desc" : "asc");
    } else {
      setListSortKey(key);
      setListSortOrder("asc");
    }
  };

  const priorityWeightMap = { urgent: 4, high: 3, medium: 2, low: 1 };

  const getSortedAndFilteredList = () => {
    // 1. Base filter: belong to active selected meeting and not archived
    let list = issues.filter(
      (i) => i.meetingId === currentMeetingId && !i.archived,
    );

    // 2. Signature filter
    if (selectedSignatureFilter) {
      list = list.filter(
        (i) =>
          i.signature
            ?.toLowerCase()
            .includes(selectedSignatureFilter.toLowerCase()) ||
          selectedSignatureFilter
            .toLowerCase()
            .includes(i.signature?.toLowerCase()),
      );
    }

    // 3. Category filter
    if (selectedCategoryFilter !== "all") {
      list = list.filter((i) => i.category === selectedCategoryFilter);
    }

    // 4. Priority filter
    if (selectedPriorityFilter !== "all") {
      list = list.filter((i) => i.priority === selectedPriorityFilter);
    }

    // 5. Apply sorting
    list.sort((a, b) => {
      let comparison = 0;
      if (listSortKey === "priority") {
        comparison =
          priorityWeightMap[a.priority] - priorityWeightMap[b.priority];
      } else if (listSortKey === "category") {
        comparison = a.category.localeCompare(b.category);
      } else if (listSortKey === "status") {
        comparison = a.status.localeCompare(b.status);
      }

      return listSortOrder === "asc" ? comparison : -comparison;
    });

    return list;
  };

  // Find active selected meeting object
  const selectedMeeting =
    meetings.find((m) => m.id === currentMeetingId) || null;

  // Helper for Chinese weekday names
  const getWeekdayCN = (dateStr: string): string => {
    if (!dateStr) return "";
    const date = new Date(`${dateStr}T12:00:00`);
    const weekdays = [
      "星期日",
      "星期一",
      "星期二",
      "星期三",
      "星期四",
      "星期五",
      "星期六",
    ];
    return weekdays[date.getDay()];
  };

  const sortedAndFilteredIssues = getSortedAndFilteredList();

  const searchedIssues = issues.filter((i) => {
    if (!globalSearch) return true;
    const q = globalSearch.toLowerCase();
    return (
      i.title.toLowerCase().includes(q) ||
      i.description?.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q) ||
      i.signature?.toLowerCase().includes(q) ||
      i.serialNumber?.toLowerCase().includes(q)
    );
  });

  const searchedActivities = activities.filter((a) => {
    if (!globalSearch) return true;
    const q = globalSearch.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q) ||
      a.organizer.toLowerCase().includes(q) ||
      a.location?.toLowerCase().includes(q)
    );
  });

  const searchedMeetings = meetings.filter((m) => {
    if (!globalSearch) return true;
    const q = globalSearch.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      m.date.includes(q) ||
      m.regularReport?.toLowerCase().includes(q)
    );
  });

  const currentIssues = issues.filter(
    (i) => i.meetingId === currentMeetingId && !i.archived,
  );
  const currentReports = selectedMeeting ? weeklyReports(data, selectedMeeting.date) : [];

  return (
    <div className={`council-app parliament-app theme-${theme}`}>
      <WorkspaceShell
        page={activeTab}
        onNavigate={navigateTo}
        theme={theme}
        onThemeChange={(next) => {
          setTheme(next);
          try {
            localStorage.setItem("app_theme", next);
          } catch {
            // Keep the selected theme for this session.
          }
        }}
        mode={storageMode}
        onModeChange={setStorageMode}
        pending={pending}
        ready={ready}
        notice={notice}
        connection={workspace.connection}
        connectionError={workspace.connectionError}
        onReconnect={workspace.reconnect}
        account={React.isValidElement(props.account) ? React.cloneElement(props.account as React.ReactElement<{workspacePending?: number}>, {workspacePending: pending}) : props.account}
        search={globalSearch}
        onSearchChange={setGlobalSearch}
        onExport={handleExportJSON}
        onImport={() => fileInputRef.current?.click()}
      >
        {error && (
          <div className="workspace-error" role="alert">
            {error}
            <button onClick={() => setError("")} aria-label="关闭提示">
              ×
            </button>
          </div>
        )}
        {importFile && (
          <div className="workspace-panel">
            <p>
              将「{importFile.name}
              」合并到当前工作区。同编号记录会更新，其余记录保留。建议先导出备份。
              {!ready &&
                storageMode === "local" &&
                "当前数据不可读，恢复将以此备份重建工作区，损坏的原始数据另行保留。"}
            </p>
            <div className="workspace-actions">
              <button
                className="workspace-button"
                disabled={importing}
                onClick={() => setImportFile(null)}
              >
                取消
              </button>
              <button
                className="workspace-button primary"
                disabled={importing || (!ready && storageMode === "firebase")}
                onClick={async () => {
                  setImporting(true);
                  try {
                    await workspace.importBackup(
                      JSON.parse(await importFile.text()),
                    );
                    setImportFile(null);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "导入失败");
                  } finally {
                    setImporting(false);
                  }
                }}
              >
                确认合并
              </button>
            </div>
          </div>
        )}

        {(activeTab === "session" || activeTab === "post") && (
          <MeetingManager
            key={storageMode}
            meetings={meetings}
            issues={issues}
            members={members}
            ready={ready}
            currentMeetingId={currentMeetingId}
            onSelectMeeting={setCurrentMeetingId}
            onAddMeeting={handleAddMeeting}
            onRenameMeeting={handleRenameMeeting}
            onUpdateMeetingSummary={handleUpdateMeetingSummary}
            onDeleteMeeting={handleDeleteMeeting}
          />
        )}
        {activeTab === "session" && selectedMeeting && ready && (
          <div className="meeting-stats" aria-label="本次会议概览">
            <div className="stat-card">
              <span className="stat-icon">
                <Users size={21} />
              </span>
              <div>
                <span>本周安排汇报</span>
                <strong>
                  {currentReports.length}
                  <small> 位成员</small>
                </strong>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon amber">
                <ListChecks size={21} />
              </span>
              <div>
                <span>本次议题</span>
                <strong>
                  {currentIssues.length}
                  <small> 项议题</small>
                </strong>
              </div>
            </div>
            <div className="stat-card">
              <span className="stat-icon green">
                <CircleCheck size={21} />
              </span>
              <div>
                <span>汇报进度</span>
                <strong>
                  {
                    currentReports.filter(
                      (row) => row.reportStatus !== "pending",
                    ).length
                  }
                  <small> / {currentReports.length} 人已汇报或免汇报</small>
                </strong>
              </div>
            </div>
          </div>
        )}
        {!ready && !error && !workspace.connectionError && (
          <div className="workspace-loading">
            <AuthLoadingContent headingLevel={2} title="正在准备工作区" description="正在读取会议和工作记录，请稍候。" />
          </div>
        )}
        {workspace.dataLoaded && (
          <fieldset className="page-body workspace-editable" disabled={!ready}>
            {activeTab === "overview" && (
              <CouncilOverview
                data={data}
                today={today}
                search={globalSearch}
                onNavigate={navigateTo}
                onOpenMeeting={openMeeting}
                onOpenIssue={openIssue}
                onOpenEditorial={(title) => navigateTo("editorial", title)}
              />
            )}
            {activeTab === "proposals" && (
              <ProposalIndex
                issues={searchedIssues}
                data={data}
                today={today}
                onOpenIssue={openIssue}
                onOpenMeeting={openMeeting}
              />
            )}

            {activeTab === "session" && (
              <SessionView
                key={`${storageMode}-${currentMeetingId}`}
                currentMeeting={selectedMeeting}
                workspace={workspace}
                search={globalSearch}
                onAddIssue={handleStartAddIssue}
                onOpenDetail={(issue) => {
                  setIsAddingNew(false);
                  setActiveIssueForDetail(issue);
                }}
              />
            )}
            {activeTab === "post" &&
              (selectedMeeting ? (
                <PostMeetingView
                  issues={searchedIssues.filter(
                    (i) => i.meetingId === currentMeetingId,
                  )}
                  members={members}
                  onUpdateIssue={handleAdvanceIssue}
                  onOpenDetail={(issue) => {
                    setIsAddingNew(false);
                    setActiveIssueForDetail(issue);
                  }}
                />
              ) : (
                <Empty>创建或选择一场例会，即可跟进授权与执行事项。</Empty>
              ))}
            {activeTab === "archive" && (
              <ArchiveView
                key={storageMode}
                meetings={searchedMeetings}
                allMeetings={meetings}
                dataLoaded={workspace.dataLoaded}
                issues={issues}
                onOpenDetail={(issue) => {
                  setIsAddingNew(false);
                  setActiveIssueForDetail(issue);
                }}
                onDeleteMeeting={handleDeleteMeeting}
                onExport={handleExportMeeting}
                exportStatus={exportStatus}
                exportError={exportError}
              />
            )}
            {activeTab === "supervision" && (
              <SupervisionView
                members={data.members}
                meetings={meetings}
                issues={searchedIssues}
                onOpenDetail={(issue) => {
                  setIsAddingNew(false);
                  setActiveIssueForDetail(issue);
                }}
              />
            )}
            {activeTab === "activity" && (
              <ActivityView
                key={storageMode}
                workspace={workspace}
                search={globalSearch}
              />
            )}
            {(activeTab === "editorial" ||
              activeTab === "assets" ||
              activeTab === "inventory") && (
              <OperationsView
                key={`${storageMode}-${activeTab}`}
                kind={activeTab}
                workspace={workspace}
                search={globalSearch}
              />
            )}
          </fieldset>
        )}
      </WorkspaceShell>
      <input
        type="file"
        accept=".json"
        ref={fileInputRef}
        hidden
        onChange={handleImportJSON}
      />

      {/* 5. MODALS & DIALOGS */}

      {activeIssueForDetail && (
        <IssueDetailModal
          key={activeIssueForDetail.id}
          issue={activeIssueForDetail}
          members={members}
          categories={DEFAULT_DEPARTMENTS}
          onClose={() => {
            setActiveIssueForDetail(null);
            setIsAddingNew(false);
          }}
          onUpdate={handleSaveIssue}
          onDelete={handleDeleteIssue}
        />
      )}

    </div>
  );
}
