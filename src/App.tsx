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
import { Empty } from "./components/WorkspaceForms";
import { Users, ListChecks, CircleCheck } from "lucide-react";
import { MeetingManager } from "./components/MeetingManager";
import { IssueDetailModal } from "./components/IssueDetailModal";
import { SessionView } from "./components/SessionView";
import { PostMeetingView } from "./components/PostMeetingView";
import { ArchiveView } from "./components/ArchiveView";
import { SupervisionView } from "./components/SupervisionView";
import { ActivityView } from "./components/ActivityView";
import { OperationsView } from "./components/OperationsView";
import { latexDocument } from "./lib/latex";
import { useWorkspace } from "./lib/useWorkspace";
import {
  downloadText,
  meetingBrief,
  localDate,
  weekday,
  statusLabels,
  advanceIssue,
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
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { motion, AnimatePresence } from "motion/react";

// Import GitHub Sync helpers

const workspacePages = new Set<WorkspacePage>(["session", "post", "archive", "supervision", "activity", "editorial", "assets", "inventory"]);
function pageFromHash(): WorkspacePage {
  const page = window.location.hash.slice(1) as WorkspacePage;
  return workspacePages.has(page) ? page : "session";
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
  const [activeTab, setActiveTab] = useState<
    | "session"
    | "post"
    | "archive"
    | "supervision"
    | "activity"
    | "editorial"
    | "assets"
    | "inventory"
  >(pageFromHash);
  useEffect(() => {
    const navigate = () => { setActiveTab(pageFromHash()); setGlobalSearch(""); };
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
  const [theme, setTheme] = useState<
    "classic" | "prussian" | "burgundy" | "latenight"
  >(() => {
    return (localStorage.getItem("app_theme") as any) || "prussian";
  });

  // Modal State
  const [activeIssueForDetail, setActiveIssueForDetail] =
    useState<Issue | null>(null);
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);

  const [selectedMeetingIdsForExport, setSelectedMeetingIdsForExport] =
    useState<string[]>([]);

  const [isCompiling, setIsCompiling] = useState(false);
  useEffect(() => {
    setActiveIssueForDetail(null);
    setSelectedMeetingIdsForExport([]);
  }, [storageMode]);
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

  // Populate default export selections when meetings are synchronized
  useEffect(() => {
    if (meetings.length > 0 && selectedMeetingIdsForExport.length === 0) {
      setSelectedMeetingIdsForExport(meetings.map((m) => m.id));
    }
  }, [meetings]);

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
      data.attendance.some((r) => r.meetingId === id)
    ) {
      setError("会议仍有关联议题或签到记录，请保留档案。");
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

  // --- EXPORT AND COMPILATION SYSTEMS (PDF & LaTeX) ---

  const handleToggleMeetingExportSelection = (id: string) => {
    setSelectedMeetingIdsForExport((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id],
    );
  };

  // 1. One-click LaTeX Download
  const handleExportLatex = () => {
    if (selectedMeetingIdsForExport.length === 0) {
      alert("请至少选择一个周期例会进行导出。");
      return;
    }

    downloadText(
      latexDocument(data, selectedMeetingIdsForExport),
      `例会纪要_${localDate()}.tex`,
    );
  };

  // 2. High-Fidelity PDF Exporter using jsPDF and html2canvas
  const handleExportPDF = async () => {
    if (selectedMeetingIdsForExport.length === 0) {
      alert("请至少选择一个周期例会进行导出。");
      return;
    }

    setIsCompiling(true);
    // Tiny delay to ensure DOM is fully computed and painted
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const element = document.getElementById("pdf-compile-preview");
      if (!element) {
        throw new Error("未找到编译预览区域");
      }

      // Render canvas with maximum crispness and direct element width
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: 800, // Forces the rendering canvas to be exactly 800px wide
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 210; // A4 standard width in mm
      const pageHeight = 295; // A4 standard height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Handles paging cleanly for larger multi-meeting compilations
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`assembly_report_${Date.now()}.pdf`);
    } catch (err) {
      console.error("PDF导出失败:", err);
      alert("PDF编译导出中遇到意外错误。");
    } finally {
      setIsCompiling(false);
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
  const currentAttendance = data.attendance.filter(
    (row) => row.meetingId === currentMeetingId,
  );

  return (
    <div className={`council-app theme-${theme}`}>
      <WorkspaceShell
        page={activeTab}
        onNavigate={(page) => {
          window.location.hash = page;
          setActiveTab(page);
          setGlobalSearch("");
          window.scrollTo({ top: 0 });
        }}
        theme={theme}
        onThemeChange={(next) => {
          setTheme(next);
          localStorage.setItem("app_theme", next);
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
                <span>本次签到</span>
                <strong>
                  {currentAttendance.length}
                  <small> / {members.length} 位成员</small>
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
                    currentAttendance.filter(
                      (row) => row.reportStatus !== "pending",
                    ).length
                  }
                  <small> / {currentAttendance.length} 人已汇报或免汇报</small>
                </strong>
              </div>
            </div>
          </div>
        )}
        {!ready && !error && !workspace.connectionError && (
          <div className="workspace-loading" role="status">
            <span />
            正在准备工作区…
          </div>
        )}
        {workspace.dataLoaded && (
          <fieldset className="page-body workspace-editable" disabled={!ready}>
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
            {activeTab === "archive" &&
              (globalSearch && !searchedMeetings.length ? (
                <Empty>
                  没有匹配的会议。试试其他关键词，或清除搜索查看全部档案。
                </Empty>
              ) : (
                <ArchiveView
                  meetings={searchedMeetings}
                  issues={issues}
                  onOpenDetail={(issue) => {
                    setIsAddingNew(false);
                    setActiveIssueForDetail(issue);
                  }}
                  onDeleteMeeting={handleDeleteMeeting}
                  selectedMeetingIdsForExport={selectedMeetingIdsForExport}
                  onToggleMeetingExportSelection={
                    handleToggleMeetingExportSelection
                  }
                  onExportLatex={handleExportLatex}
                  onExportPDF={handleExportPDF}
                  isCompiling={isCompiling}
                />
              ))}
            {activeTab === "supervision" && (
              <SupervisionView
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

      {/* 6. HIGH-FIDELITY PRINT-READY VISIBLE-BUT-OFFSCREEN CONTAINER FOR PDF GENERATION */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          width: "800px",
        }}
      >
        <div
          id="pdf-compile-preview"
          className="w-[800px] bg-white p-12 text-neutral-950 font-sans space-y-10"
        >
          {/* Cover Header */}
          <div className="text-center border-b-4 border-neutral-950 pb-8 space-y-4">
            <h1 className="font-serif text-4xl font-bold tracking-widest uppercase">
              议事会议纪要与决议公报
            </h1>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">
              Assembly Compilation & Resolution Bulletin
            </p>
            <div className="flex justify-center gap-8 text-xs font-mono text-neutral-500 pt-4 border-t border-neutral-100 max-w-md mx-auto">
              <div>发布日期: {new Date().toLocaleDateString("zh-CN")}</div>
              <div>
                包含周期:{" "}
                {
                  meetings.filter((m) =>
                    selectedMeetingIdsForExport.includes(m.id),
                  ).length
                }{" "}
                期
              </div>
            </div>
          </div>

          {/* Compilation Contents */}
          <div className="space-y-10">
            {meetings
              .filter((m) => selectedMeetingIdsForExport.includes(m.id))
              .map((m, idx) => {
                const mIssues = issues.filter((i) => i.meetingId === m.id);
                return (
                  <div
                    key={m.id}
                    className="space-y-6 pb-8 border-b-2 border-neutral-200 last:border-b-0 last:pb-0"
                  >
                    <div className="flex justify-between items-end border-b border-neutral-950 pb-2">
                      <h2 className="font-serif text-xl font-bold text-neutral-950">
                        {idx + 1}. {m.title} ({m.week})
                      </h2>
                      <span className="font-mono text-xs text-neutral-500">
                        召开日期: {m.date}
                      </span>
                    </div>

                    <div className="whitespace-pre-wrap text-sm">
                      {meetingBrief(data, m.id).split("议程与执行")[0]}
                    </div>
                    {/* Regular report */}
                    <div className="space-y-2">
                      <h3 className="font-sans text-xs font-bold text-neutral-700 uppercase tracking-widest">
                        【常规报告】
                      </h3>
                      <div className="text-xs text-neutral-800 leading-relaxed font-serif bg-neutral-50 p-4 border border-neutral-200 whitespace-pre-wrap">
                        {m.regularReport || "暂无常规报告。"}
                      </div>
                    </div>

                    {/* Issues List */}
                    <div className="space-y-3">
                      <h3 className="font-sans text-xs font-bold text-neutral-700 uppercase tracking-widest">
                        【会商决议明细】
                      </h3>
                      {mIssues.length === 0 ? (
                        <p className="text-xs text-neutral-400 font-mono italic p-2 border border-dashed border-neutral-200">
                          本期例会无关联的议题。
                        </p>
                      ) : (
                        <div className="border border-neutral-950 divide-y divide-neutral-950">
                          {mIssues.map((issue, issueIdx) => (
                            <div
                              key={issue.id}
                              className="p-4 bg-white space-y-2.5"
                            >
                              <div className="flex justify-between items-baseline">
                                <div className="font-bold font-serif text-neutral-950 text-sm">
                                  ({issueIdx + 1}) 《{issue.title}》
                                </div>
                                <span className="font-mono text-[9px] uppercase border border-neutral-950 px-2 py-0.5 bg-neutral-100">
                                  {statusLabels[issue.status]}
                                </span>
                              </div>

                              {issue.description && (
                                <p className="text-neutral-700 font-sans text-xs leading-normal">
                                  <span className="font-bold text-neutral-500">
                                    事项描述:
                                  </span>{" "}
                                  {issue.description}
                                </p>
                              )}

                              {issue.discussion && (
                                <div className="bg-neutral-50 p-3 border border-neutral-200 font-serif text-xs leading-normal">
                                  <span className="font-bold font-sans text-[10px] text-neutral-500 block mb-1">
                                    会商结论:
                                  </span>
                                  {issue.discussion}
                                </div>
                              )}

                              <div className="text-[10px] font-mono text-neutral-500 flex justify-between pt-1 border-t border-neutral-100">
                                <div>
                                  类别:{" "}
                                  <span className="text-neutral-800">
                                    {issue.category}
                                  </span>
                                </div>
                                <div>
                                  负责人/经办人:{" "}
                                  <span className="font-bold text-neutral-950">
                                    {issue.signature || "待指派"}
                                  </span>
                                </div>
                                <div>
                                  优先级:{" "}
                                  <span
                                    className={
                                      issue.priority === "urgent"
                                        ? "text-red-600 font-bold"
                                        : "text-neutral-800"
                                    }
                                  >
                                    {issue.priority === "urgent"
                                      ? "紧急"
                                      : issue.priority === "high"
                                        ? "高"
                                        : issue.priority === "medium"
                                          ? "中"
                                          : "低"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Autograph / Handstamp area */}
          <div className="pt-10 border-t-4 border-neutral-950 space-y-6">
            <p className="text-xs text-neutral-400 font-mono text-center">
              * 全体成员鉴章：见公报如面，各尽其职，对以上所列各项决议负责。
            </p>
            <div className="grid grid-cols-3 gap-8 pt-10 text-center text-xs font-serif text-neutral-800">
              <div className="space-y-14">
                <div className="border-b border-neutral-300 w-44 mx-auto" />
                <div className="font-bold tracking-wider">主事人鉴字盖章</div>
              </div>
              <div className="space-y-14">
                <div className="border-b border-neutral-300 w-44 mx-auto" />
                <div className="font-bold tracking-wider">监察委员鉴字盖章</div>
              </div>
              <div className="space-y-14">
                <div className="border-b border-neutral-300 w-44 mx-auto" />
                <div className="font-bold tracking-wider">经办代表鉴字盖章</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
