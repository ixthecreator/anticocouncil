import type { Issue, Status } from "../types";
import { mergeEditedRecord } from "./editRecord";

export const issueTransitions: Record<Status, readonly Status[]> = {
  agenda: ["agenda", "execution"], voting: ["voting"],
  passed: ["passed", "authorization"], rejected: ["rejected"],
  authorization: ["authorization", "execution"], execution: ["execution", "completed"],
  completed: ["completed"],
};
export function mergeIssueEdit(latest: Issue | null, original: Issue | null, edited: Issue): Issue {
  const next = mergeEditedRecord(latest, original, edited, ["title", "description", "category", "priority", "discussion", "signature", "dueDate", "status"]);
  if (!latest && next.status !== "agenda") throw new Error("新议题须从待讨论开始。");
  if (latest && !issueTransitions[latest.status].includes(next.status)) throw new Error("请通过例会现场的表决或执行操作调整状态。");
  if (latest && (latest.status === "voting" || latest.voteMode === "private" || latest.voteMode === "legacy") && ["title", "description", "category"].some(key => latest[key] !== next[key])) {
    throw new Error("已进入表决的议题标题、背景与类别不能改写；可继续补充讨论和执行记录。");
  }
  return { ...next, updatedAt: new Date().toISOString() };
}
