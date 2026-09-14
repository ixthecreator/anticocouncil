import { useState } from "react";
import type { Issue, Meeting } from "../types";
import type { Workspace } from "../lib/useWorkspace";
import {
  downloadText,
  advanceIssue,
  meetingBrief,
  recordBallot,
  statusLabels,
  voteTotals,
  votingResult,
} from "../lib/workspace";
import { ParliamentChart } from "./ParliamentChart";
import { AttendanceView } from "./AttendanceView";
import { Action, Empty, Field, SaveForm } from "./WorkspaceForms";

export function SessionView({
  currentMeeting,
  workspace,
  search,
  onAddIssue,
  onOpenDetail,
}: {
  currentMeeting: Meeting | null;
  workspace: Workspace;
  search: string;
  onAddIssue: () => void;
  onOpenDetail: (issue: Issue) => void;
}) {
  const { data, change } = workspace;
  const [activeId, setActiveId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [report, setReport] = useState(currentMeeting?.regularReport || "");
  const [summary, setSummary] = useState(currentMeeting?.summary || "");
  const [editingNotes, setEditingNotes] = useState(false);
  if (!currentMeeting)
    return (
      <Empty>还没有当前例会。点击「新建例会」，开始汇报与议程记录。</Empty>
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
  const totals = active
    ? voteTotals(active)
    : { approve: 0, reject: 0, abstain: 0 };
  const updateVoting = (update: (issue: Issue) => Issue) =>
    active &&
    change("issues", active.id, (old) => {
      if (!old || old.status !== "voting") throw new Error("此表决已结束。");
      return { ...update(old), updatedAt: new Date().toISOString() };
    });
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
                          <Action
                            onClick={async () => {
                              await change("issues", i.id, (old) => {
                                if (!old || old.status !== "agenda")
                                  throw new Error("议题状态已改变，请重试。");
                                return {
                                  ...old,
                                  status: "voting",
                                  voteMode: "members",
                                  voteRule: "simple",
                                  ballots: {},
                                  votes: { approve: 0, reject: 0, abstain: 0 },
                                  updatedAt: new Date().toISOString(),
                                };
                              });
                              setActiveId(i.id);
                            }}
                          >
                            发起表决
                          </Action>
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
                    return { ...old, regularReport: report, summary };
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
        <section className="workspace-panel voting-panel">
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">LIVE / VOTING</span>
              <h2>会议表决</h2>
            </div>
            <span className="workspace-badge">
              {voting.length ? "表决进行中" : "尚未开始"}
            </span>
          </div>
          {!active ? (
            <Empty>从议程中发起表决。成员投票不依赖汇报安排。</Empty>
          ) : (
            <>
              {voting.length > 1 && (
                <Field label="切换表决议题">
                  <select
                    value={active.id}
                    onChange={(e) => setActiveId(e.target.value)}
                  >
                    {voting.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.title}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <h3 className="voting-title">{active.title}</h3>
              <p>{active.description}</p>
              <div className="workspace-fields">
                <Field label="计票方式">
                  <select
                    value={active.voteMode || "manual"}
                    disabled={
                      Object.keys(active.ballots || {}).length > 0 ||
                      Object.values(totals).some((n) => n > 0)
                    }
                    onChange={(e) => {
                      const value = e.target.value as "members" | "manual";
                      void updateVoting((old) => {
                        if (
                          Object.keys(old.ballots || {}).length ||
                          Object.values(voteTotals(old)).some((n) => n > 0)
                        )
                          throw new Error("已有投票，不能切换计票方式。");
                        return { ...old, voteMode: value };
                      }).catch(() => {});
                    }}
                  >
                    <option value="members">成员投票</option>
                    <option value="manual">主持人录票</option>
                  </select>
                </Field>
                <Field label="通过规则">
                  <select
                    value={active.voteRule || "simple"}
                    onChange={(e) => {
                      const value = e.target.value as "simple" | "absolute";
                      void updateVoting((old) => ({
                        ...old,
                        voteRule: value,
                      })).catch(() => {});
                    }}
                  >
                    <option value="simple">赞成多于反对</option>
                    <option value="absolute">赞成超过已投票数的一半</option>
                  </select>
                </Field>
              </div>
              <ParliamentChart
                approve={totals.approve}
                reject={totals.reject}
                abstain={totals.abstain}
              />
              <div className="vote-totals">
                <div>
                  <strong>{totals.approve}</strong>赞成
                </div>
                <div>
                  <strong>{totals.reject}</strong>反对
                </div>
                <div>
                  <strong>{totals.abstain}</strong>弃权
                </div>
              </div>
              {active.voteMode === "members" ? (
                <>
                  <Field label="投票成员">
                    <select
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                    >
                      <option value="">选择成员</option>
                      {data.members.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.name} · {member.role}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="workspace-actions vote-buttons">
                    {(["approve", "reject", "abstain"] as const).map((vote) => (
                      <Action
                        key={vote}
                        className={
                          active.ballots?.[memberId] === vote ? "primary" : ""
                        }
                        disabled={!data.members.some((member) => member.id === memberId)}
                        onClick={() =>
                          updateVoting((old) =>
                            recordBallot(old, memberId, vote),
                          )
                        }
                      >
                        {
                          { approve: "赞成", reject: "反对", abstain: "弃权" }[
                            vote
                          ]
                        }
                      </Action>
                    ))}
                  </div>
                  <p className="workspace-help">
                    每个成员计一票，结束前可改票。姓名由成员自行选择，请仅代表本人操作；此处不验证账号身份。
                  </p>
                </>
              ) : (
                <div className="manual-votes">
                  {(["approve", "reject", "abstain"] as const).map((vote) => (
                    <div key={vote}>
                      <span>
                        {
                          { approve: "赞成", reject: "反对", abstain: "弃权" }[
                            vote
                          ]
                        }
                      </span>
                      {[-1, 1].map((delta) => (
                        <Action
                          key={delta}
                          onClick={() =>
                            updateVoting((old) => {
                              if (old.voteMode === "members")
                                throw new Error(
                                  "当前为成员投票，不能手动修改票数。",
                                );
                              return {
                                ...old,
                                votes: {
                                  ...voteTotals(old),
                                  [vote]: Math.max(
                                    0,
                                    voteTotals(old)[vote] + delta,
                                  ),
                                },
                              };
                            })
                          }
                        >
                          {delta < 0 ? "−" : "＋"}
                        </Action>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <Action
                className="primary full-width"
                disabled={!Object.values(totals).some((n) => n > 0)}
                onClick={() =>
                  updateVoting((old) => ({
                    ...old,
                    status: votingResult(old),
                    votes: voteTotals(old),
                  }))
                }
              >
                结束表决并保存结果
              </Action>
              <p className="workspace-help">
                平票不通过。规则以实际收到的票数计算，未投票成员不计入分母。
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
