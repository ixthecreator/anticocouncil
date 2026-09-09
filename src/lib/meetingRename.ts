import type { Meeting } from "../types";

/** Apply a rename to the latest record without replacing its other fields. */
export function renameMeeting(
  latest: Meeting | null,
  expectedTitle: string,
  title: string,
): Meeting {
  const nextTitle = title.trim();
  if (!nextTitle) throw new Error("会议名称不能为空。");
  if (!latest) throw new Error("会议不存在，可能已被删除。请重新选择会议。");
  if (latest.title === nextTitle) return latest;
  if (latest.title !== expectedTitle) {
    throw new Error(
      `会议名称已被其他成员修改为“${latest.title}”。请取消后重新编辑。`,
    );
  }
  return { ...latest, title: nextTitle };
}
