import { expect, test } from "bun:test";
import type { Issue } from "../types";
import { mergeIssueEdit } from "./issueEditing";

const original: Issue = { id: "issue", title: "讨论事项", category: "其他", priority: "medium", status: "agenda", description: "原始背景", signature: "委员", discussion: "", meetingId: "meeting", archived: false, createdAt: "2026-09-01", updatedAt: "2026-09-01" };

test("editing a note cannot undo a concurrently started private vote", () => {
  const latest: Issue = { ...original, status: "voting", voteMode: "private", voteRoundId: "round", voteRule: "absolute" };
  const result = mergeIssueEdit(latest, original, { ...original, discussion: "补充记录" });
  expect(result.status).toBe("voting");
  expect(result.voteRoundId).toBe("round");
  expect(result.voteRule).toBe("absolute");
  expect(result.discussion).toBe("补充记录");
});

test("a proposition draft cannot change what people are currently voting on", () => {
  const latest: Issue = { ...original, status: "voting", voteMode: "private", voteRoundId: "round" };
  for (const field of ["title", "description", "category"] as const) {
    expect(() => mergeIssueEdit(latest, original, { ...original, [field]: "新内容" })).toThrow("不能改写");
  }
  expect(original.title).toBe("讨论事项");
});

test("closed private vote retains result and proposition while execution can proceed", () => {
  const closed: Issue = { ...original, status: "passed", voteMode: "private", voteRoundId: "r", votes: { approve: 2, reject: 1, abstain: 0 } };
  const result = mergeIssueEdit(closed, closed, { ...closed, status: "authorization", votes: { approve: 99, reject: 0, abstain: 0 } });
  expect(result.status).toBe("authorization");
  expect(result.votes).toEqual(closed.votes);
  expect(() => mergeIssueEdit(closed, closed, { ...closed, title: "改变命题" })).toThrow("不能改写");
});

test("manual status edits cannot create or rewrite a voting result", () => {
  for (const status of ["voting", "passed", "rejected", "completed"] as const) {
    expect(() => mergeIssueEdit(original, original, { ...original, status })).toThrow("状态");
  }
  expect(() => mergeIssueEdit(null, null, { ...original, status: "passed" })).toThrow("待讨论");
});

test("deleted issues are not resurrected and conflicting note edits retain the draft", () => {
  expect(() => mergeIssueEdit(null, original, { ...original, title: "新名称" })).toThrow("已被删除");
  const draft = { ...original, discussion: "本人的记录" };
  expect(() => mergeIssueEdit({ ...original, discussion: "其他人的记录" }, original, draft)).toThrow("草稿已保留");
  expect(draft.discussion).toBe("本人的记录");
});
