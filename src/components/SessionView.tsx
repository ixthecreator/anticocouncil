import { useState } from "react";
import type { Issue, Meeting } from "../types";
import type { Workspace } from "../lib/useWorkspace";
import {
  downloadText,
  advanceIssue,
  meetingBrief,
  statusLabels,
} from "../lib/workspace";
import { VotingPanel } from "./VotingPanel";
import { votingRequest } from "../lib/privateVoting";
import type { AccessActor } from "../lib/cloudAccess";
import { mergeEditedRecord } from "../lib/editRecord";
import { AttendanceView } from "./AttendanceView";
import { Action, Empty, Field, SaveForm } from "./WorkspaceForms";

export function SessionView({
  currentMeeting,
  workspace,
  search,
  onAddIssue,
  onOpenDetail,
  actor,
}: {
  currentMeeting: Meeting | null;
  workspace: Workspace;
  search: string;
  actor?: AccessActor;
  onAddIssue: () => void;
  onOpenDetail: (issue: Issue) => void;
}) {
  const { data, change } = workspace;
  const [activeId, setActiveId] = useState("");
  const [startRule, setStartRule] = useState<"simple" | "absolute">("simple");
  const canHost = workspace.mode === "local" || actor?.role === "admin";
  const [notesOriginal, setNotesOriginal] = useState<Meeting | null>(null);
  const [report, setReport] = useState(currentMeeting?.regularReport || "");
  const [summary, setSummary] = useState(currentMeeting?.summary || "");
  const [editingNotes, setEditingNotes] = useState(false);
  if (!currentMeeting)
    return (
      <Empty>还没有当前例会。点击「新建例会」，开始签到与议程记录。</Empty>
    );
  const allIssues = data.issues.filter(
    (i) => i.meetingId === currentMeeting.id && !i.archived,
  );
  const issues = allIssues.filter((i) =>
    [i.title, i.description, i.signature, i.category].some((value) =>
      value?.toLowerCase().includes(search.toLowerCase()),
    ),
  );
  const voting = allIssues.filter((i) => i.status === "voting");
  const active = voting.find((i) => i.id === activeId) || voting[0];
  return (
    <div className="session-workspace">
      <AttendanceView meeting={currentMeeting} workspace={workspace} />
      <div className="session-columns">
        <div className="space-y-6">
          <section className="workspace-panel">
            <div className="workspace-heading">
              <div>
                <span className="eyebrow">02 / AGENDA</span>
                <h2>
                  议程与执行 <small>{allIssues.length}</small>
                </h2>
              </div>
              <button className="workspace-button primary" onClick={onAddIssue}>
                ＋ 新增议题
              </button>
            </div>
            {canHost && allIssues.some(issue => issue.status === "agenda") && <Field label="新表决通过规则"><select value={startRule} onChange={event => setStartRule(event.target.value as "simple" | "absolute")}><option value="simple">赞成多于反对</option><option value="absolute">赞成超过已投票数的一半</option></select></Field>}
            {!issues.length ? (
              <Empty>
                {search
                  ? "没有匹配的议题。"
                  : "暂无议题。记录本次需要讨论或执行的事项。"}
              </Empty>
            ) : (
              <div className="agenda-list">
                {issues.map((i) => (
                  <article key={i.id}>
                    <div className="workspace-heading">
                      <button
                        className="agenda-title"
                        onClick={() => onOpenDetail(i)}
                      >
                        {i.title}
                      </button>
                      <span className="workspace-badge">
                        {statusLabels[i.status]}
                      </span>
                    </div>
                    <p className="workspace-help">
                      {i.category} · {i.signature || "待安排负责人"}
                      {i.dueDate ? ` · 截止 ${i.dueDate}` : ""}
                    </p>
                    {i.discussion && <p>{i.discussion}</p>}
                    <div className="workspace-actions">
                      <button
                        className="workspace-button"
                        onClick={() => onOpenDetail(i)}
                      >
                        编辑与记录
                      </button>
                      {i.status === "agenda" && (
                        <>
                          {canHost && <Action
                            onClick={async () => {
                              if (workspace.mode === "firebase") {
                                await workspace.runOperation(async assertCurrent => {
                                  assertCurrent();
                                  await votingRequest({ action: "start", issueId: i.id, rule: startRule }, { expectedUid: actor?.uid, assertCurrent });
                                });
                              } else {
                                await change("issues", i.id, old => {
                                  if (!old || old.status !== "agenda") throw new Error("议题状态已改变，请重试。");
                                  if (old.voteRoundId || old.ballots || old.votes) throw new Error("已有表决记录，请新建议题，保留原有历史。");
                                  return { ...old, status: "voting", voteMode: "members", voteRule: startRule, ballots: {}, updatedAt: new Date().toISOString() };
                                });
                              }
                              setActiveId(i.id);
                            }}
                          >发起表决</Action>}
                          <Action
                            onClick={() =>
                              change("issues", i.id, (old) => {
                                if (!old) throw new Error("议题不存在");
                          return advanceIssue(old, 'agenda', 'execution');
                              })
                            }
                          >
                            直接执行
                          </Action>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
          <section className="workspace-panel">
            <div className="workspace-heading">
              <div>
                <span className="eyebrow">03 / MINUTES</span>
                <h2>会议记录</h2>
              </div>
              <Action
                onClick={() =>
                  downloadText(
                    meetingBrief(data, currentMeeting.id),
                    `例会纪要_${currentMeeting.date}.txt`,
                  )
                }
              >
                导出完整纪要
              </Action>
            </div>
            {!editingNotes ? (
              <>
                <p className="notes-text">
                  {currentMeeting.regularReport || "暂无会议记录。"}
                </p>
                {currentMeeting.summary && (
                  <p className="notes-text">
                    会议摘要：{currentMeeting.summary}
                  </p>
                )}
                <button
                  className="workspace-button"
                  onClick={() => {
                    setNotesOriginal(structuredClone(currentMeeting));
                    setReport(currentMeeting.regularReport || "");
                    setSummary(currentMeeting.summary || "");
                    setEditingNotes(true);
                  }}
                >
                  编辑会议记录
                </button>
              </>
            ) : (
              <SaveForm
                onCancel={() => setEditingNotes(false)}
                onSave={async () => {
                  await change("meetings", currentMeeting.id, (old) => {
                    if (!old) throw new Error("会议不存在");
                    return mergeEditedRecord(old, notesOriginal, { ...notesOriginal!, regularReport: report, summary }, ["regularReport", "summary"]);
                  });
                  setEditingNotes(false);
                }}
              >
                <Field label="常规报告与会议记录">
                  <textarea
                    rows={7}
                    value={report}
                    onChange={(e) => setReport(e.target.value)}
                  />
                </Field>
                <Field label="会议摘要">
                  <textarea
                    rows={3}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                  />
                </Field>
              </SaveForm>
            )}
          </section>
        </div>
        <div>{voting.length > 1 && <Field label="切换表决议题"><select value={active.id} onChange={event => setActiveId(event.target.value)}>{voting.map(issue => <option key={issue.id} value={issue.id}>{issue.title}</option>)}</select></Field>}<VotingPanel key={active?.id || "empty"} active={active} workspace={workspace} actor={actor} meeting={currentMeeting} /></div>
      </div>
    </div>
  );
}
