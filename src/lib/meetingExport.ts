import type { WorkspaceData } from "../types";
import { isReportRecord, statusLabels, voteTotals } from "./workspace";

export type MeetingExportKind = "agenda" | "minutes";

export interface MeetingExportIssue {
  id: string;
  title: string;
  serialNumber: string;
  category: string;
  priority: string;
  status: string;
  responsibleName: string;
  dueDate: string;
  description: string;
  discussion?: string;
  archived?: boolean;
  voteSummary?: { approve: number; reject: number; abstain: number; rule: string };
}

export interface MeetingExportMeeting {
  id: string;
  title: string;
  date: string;
  week: string;
  regularReport: string;
  summary?: string;
  attendance?: { name: string; reportStatus: string; reportNote: string }[];
  issues: MeetingExportIssue[];
}

export interface MeetingExport {
  kind: MeetingExportKind;
  title: string;
  generatedAt: string;
  meetings: MeetingExportMeeting[];
}

export type MeetingExportBlock =
  | { type: "heading"; text: string; level: 1 | 2 | 3 }
  | { type: "text"; text: string; muted?: boolean }
  | { type: "table"; headers: string[]; rows: string[][] };

export interface MeetingExportPage {
  meetingId: string;
  title: string;
  blocks: MeetingExportBlock[];
}

const priorities = { low: "低", medium: "中", high: "高", urgent: "紧急" };
const reportStatuses = { pending: "待汇报", reported: "已汇报", exempt: "本次免汇报" };
const closedStatuses = new Set(["passed", "rejected", "authorization", "execution", "completed"]);
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Copy an export snapshot; private ballot maps never leave the input workspace. */
export function buildMeetingExport(
  data: WorkspaceData,
  meetingIds: readonly string[],
  kind: MeetingExportKind,
  generatedAt: Date | string,
): MeetingExport {
  if (kind !== "agenda" && kind !== "minutes") throw new Error("不支持的会议文档类型。");
  const time = new Date(generatedAt);
  if (!Number.isFinite(time.getTime())) throw new Error("导出时间无效。");
  const selected = new Set(meetingIds);
  const meetings = data.meetings.filter((meeting) => selected.has(meeting.id))
    .sort((a, b) => compare(a.date, b.date) || compare(a.id, b.id));
  if (!meetings.length) throw new Error("请选择至少一场仍然存在的会议。");
  const members = new Map(data.members.map((member) => [member.id, member.name]));

  return {
    kind,
    title: kind === "agenda" ? "会议议程" : "完整会议纪要",
    generatedAt: time.toISOString(),
    meetings: meetings.map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      date: meeting.date,
      week: meeting.week,
      regularReport: meeting.regularReport || "",
      ...(kind === "minutes" ? {
        summary: meeting.summary || "",
        attendance: data.attendance.filter((row) => row.meetingId === meeting.id && isReportRecord(row))
          .sort((a, b) => compare(a.checkedInAt, b.checkedInAt) || compare(a.id, b.id))
          .map((row) => ({
            name: row.memberName,
            reportStatus: reportStatuses[row.reportStatus],
            reportNote: row.reportNote,
          })),
      } : {}),
      issues: data.issues.filter((issue) => issue.meetingId === meeting.id && (kind === "minutes" || !issue.archived))
        .sort((a, b) => compare(a.createdAt, b.createdAt) || compare(a.id, b.id))
        .map((issue) => ({
          id: issue.id,
          title: issue.title,
          serialNumber: issue.serialNumber || "",
          category: issue.category,
          priority: priorities[issue.priority],
          status: statusLabels[issue.status],
          responsibleName: members.get(issue.signature) || issue.signature || "",
          dueDate: issue.dueDate || "",
          description: issue.description,
          ...(kind === "minutes" ? {
            discussion: issue.discussion || "",
            archived: issue.archived,
            ...(closedStatuses.has(issue.status) && (issue.votes || issue.ballots) ? {
              voteSummary: {
                ...voteTotals(issue),
                rule: issue.voteRule === "absolute" ? "赞成超过已投票数的一半" : "赞成多于反对",
              },
            } : {}),
          } : {}),
        })),
    })),
  };
}

/** The only content formatter used by PDF, Word and LaTeX renderers. */
export function meetingExportBlocks(snapshot: MeetingExport): MeetingExportPage[] {
  return snapshot.meetings.map((meeting) => {
    const blocks: MeetingExportBlock[] = [
      { type: "text", text: `安提柯议会 · ${snapshot.title}`, muted: true },
      { type: "heading", level: 1, text: meeting.title },
      { type: "text", text: `会议日期：${meeting.date || "未设定"}　会期：${meeting.week || "未设定"}` },
      { type: "text", text: `导出时间：${snapshot.generatedAt.replace("T", " ").replace(/\.\d{3}Z$/, " UTC")}`, muted: true },
      { type: "heading", level: 2, text: "常规报告" },
      { type: "text", text: meeting.regularReport || "暂无常规报告。" },
    ];
    if (meeting.summary !== undefined) {
      blocks.push({ type: "heading", level: 2, text: "会议摘要" }, { type: "text", text: meeting.summary || "暂无会议摘要。" });
    }
    if (meeting.attendance !== undefined) {
      blocks.push({ type: "heading", level: 2, text: `汇报记录（${meeting.attendance.length} 人）` });
      if (meeting.attendance.length) blocks.push({
        type: "table",
        headers: ["姓名", "汇报状态", "汇报记录"],
        rows: meeting.attendance.map((row) => [row.name || "未填写", row.reportStatus, row.reportNote || "暂无"]),
      });
      else blocks.push({ type: "text", text: "暂无汇报记录。" });
    }
    blocks.push({ type: "heading", level: 2, text: `议题（${meeting.issues.length} 项）` });
    if (!meeting.issues.length) blocks.push({ type: "text", text: "暂无符合导出范围的议题。" });
    meeting.issues.forEach((issue, index) => {
      blocks.push(
        { type: "heading", level: 3, text: `${index + 1}. ${issue.title}` },
        { type: "table", headers: ["项目", "内容"], rows: [
          ["议题编号", issue.serialNumber || "未编号"],
          ["类别 / 优先级", `${issue.category || "未分类"} / ${issue.priority}`],
          ["状态", issue.status],
          ["负责人", issue.responsibleName || "待安排"],
          ["截止日期", issue.dueDate || "未设定"],
          ...(issue.archived === undefined ? [] : [["归档状态", issue.archived ? "已归档" : "未归档"]]),
        ] },
        { type: "text", text: `议题说明\n${issue.description || "暂无说明。"}` },
      );
      if (issue.discussion !== undefined) blocks.push({ type: "text", text: `讨论、结论与执行记录\n${issue.discussion || "暂无记录。"}` });
      if (issue.voteSummary) {
        blocks.push({ type: "text", text: `表决汇总：赞成 ${issue.voteSummary.approve} / 反对 ${issue.voteSummary.reject} / 弃权 ${issue.voteSummary.abstain}\n表决规则：${issue.voteSummary.rule}。` });
      }
    });
    return { meetingId: meeting.id, title: meeting.title, blocks };
  });
}

export function exportMeetingFileName(snapshot: MeetingExport, extension: "pdf" | "docx" | "tex"): string {
  const label = snapshot.meetings.length === 1 ? snapshot.meetings[0].title : `${snapshot.meetings.length}场会议`;
  const safeLabel = label.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_").replace(/[. ]+$/g, "").slice(0, 80) || "会议";
  return `安提柯_${snapshot.title}_${safeLabel}_${snapshot.generatedAt.slice(0, 10)}.${extension}`;
}

export const escapeMeetingLatex = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[\\{}$&#%_^~]/g, (character) => ({
  "\\": "\\textbackslash{}", "{": "\\{", "}": "\\}", "$": "\\$", "&": "\\&", "#": "\\#", "%": "\\%", "_": "\\_", "^": "\\textasciicircum{}", "~": "\\textasciitilde{}",
})[character]!);

function latexBlock(block: MeetingExportBlock): string {
  if (block.type === "heading") return `\\${({ 1: "section", 2: "subsection", 3: "subsubsection" })[block.level]}*{${escapeMeetingLatex(block.text)}}`;
  if (block.type === "text") return block.text.split(/\r\n?|\n/).map((line) => line ? `${escapeMeetingLatex(line)}\\par` : "\\medskip").join("\n");
  const column = `p{\\dimexpr\\linewidth/${block.headers.length}-2\\tabcolsep-2\\arrayrulewidth\\relax}`;
  const row = (cells: string[], bold = false) => cells.map((cell) => {
    const value = escapeMeetingLatex(cell).replace(/\r\n?|\n/g, "\\newline ");
    return bold ? `\\textbf{${value}}` : value;
  }).join(" & ") + " \\\\ \\hline";
  const header = row(block.headers, true);
  return `\\begin{longtable}{|${block.headers.map(() => column).join("|")}|}\n\\hline\n${header}\n\\endfirsthead\n\\hline\n${header}\n\\endhead\n${block.rows.map((cells) => row(cells)).join("\n")}\n\\end{longtable}`;
}

export function renderMeetingLatex(snapshot: MeetingExport): string {
  return `% 使用 XeLaTeX 编译；本文件仅包含所选会议的导出快照。\n\\documentclass[UTF8,a4paper,fontset=fandol]{ctexart}\n\\usepackage[margin=20mm]{geometry}\n\\usepackage{longtable,array}\n\\setlength{\\parindent}{0pt}\n\\setlength{\\parskip}{6pt}\n\\setlength{\\emergencystretch}{3em}\n\\pagestyle{plain}\n\\begin{document}\n${meetingExportBlocks(snapshot).map((page) => page.blocks.map(latexBlock).join("\n\n")).join("\n\\clearpage\n")}\n\\end{document}\n`;
}
