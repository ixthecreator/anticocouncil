import { Fragment, useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
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
import { AttendanceView } from "./AttendanceView";
import { Action, Empty, Field, SaveForm } from "./WorkspaceForms";

/* Tag colours support the text label; they never carry the status alone. */
const statusTone: Record<Issue["status"], string> = {
  agenda: "grey",
  voting: "blue",
  passed: "green",
  rejected: "red",
  authorization: "purple",
  execution: "purple",
  completed: "green",
};
const voteChoices = ["approve", "reject", "abstain"] as const;
const voteLabels = { approve: "赞成", reject: "反对", abstain: "弃权" } as const;
const ruleLabels = {
  simple: "赞成多于反对",
  absolute: "赞成超过已投票数的一半",
} as const;

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
  // An action that changes an issue's status removes or disables its own
  // button. Focus then moves to the first of these elements that is on the
  // page once the change has rendered, so keyboard and screen reader users
  // keep their place and hear the result.
  const focusTargets = useRef<string[]>([]);
  const moveFocus = () => {
    const target = focusTargets.current
      .map((id) => document.getElementById(id))
      .find((element) => element);
    if (!target) return;
    focusTargets.current = [];
    target.focus();
  };
  const focusAfterChange = (...ids: string[]) => {
    focusTargets.current = ids;
    requestAnimationFrame(moveFocus);
  };
  useEffect(moveFocus);
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
  const ballotCount = totals.approve + totals.reject + totals.abstain;
  const memberBallot = active?.ballots?.[memberId];
  const memberName = data.members.find((member) => member.id === memberId)?.name;
  const passing = !!active && votingResult(active) === "passed";
  return (
    <div className="session-workspace">
      <AttendanceView meeting={currentMeeting} workspace={workspace} />
      <div className="session-columns">
        <div className="session-main">
          <section className="workspace-panel" aria-labelledby="agenda-heading">
            <div className="workspace-heading">
              <h2 id="agenda-heading">
                议程与执行 <small>{allIssues.length} 项</small>
              </h2>
              <button
                type="button"
                className="workspace-button"
                onClick={onAddIssue}
              >
                <Plus size={18} aria-hidden="true" />
                新增议题
              </button>
            </div>
            {!issues.length ? (
              <Empty>
                {search
                  ? "没有匹配的议题。"
                  : "暂无议题。记录本次需要讨论或执行的事项。"}
              </Empty>
            ) : (
              <ul className="agenda-list">
                {issues.map((i) => (
                  <li key={i.id} className="agenda-item">
                    <div className="agenda-item-head">
                      <h3>
                        <button
                          type="button"
                          id={`agenda-title-${i.id}`}
                          className="agenda-title"
                          aria-describedby={`agenda-status-${i.id}`}
                          onClick={() => onOpenDetail(i)}
                        >
                          {i.title}
                        </button>
                      </h3>
                      <span
                        id={`agenda-status-${i.id}`}
                        className={`council-tag ${statusTone[i.status]}`}
                      >
                        {statusLabels[i.status]}
                      </span>
                    </div>
                    <p className="council-meta">
                      {i.category} · {i.signature || "待安排负责人"}
                      {i.dueDate ? ` · 截止 ${i.dueDate}` : ""}
                    </p>
                    {i.discussion && (
                      <p className="agenda-discussion">{i.discussion}</p>
                    )}
                    {i.status === "agenda" && (
                      <div className="workspace-actions">
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
                            focusAfterChange(`voting-title-${i.id}`);
                          }}
                        >
                          发起表决
                        </Action>
                        <Action
                          onClick={async () => {
                            await change("issues", i.id, (old) => {
                              if (!old) throw new Error("议题不存在");
                              return advanceIssue(old, "agenda", "execution");
                            });
                            focusAfterChange(`agenda-title-${i.id}`);
                          }}
                        >
                          直接执行
                        </Action>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="workspace-panel" aria-labelledby="minutes-heading">
            <div className="workspace-heading">
              <h2 id="minutes-heading">会议记录</h2>
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
                {currentMeeting.regularReport ? (
                  <p className="notes-text">{currentMeeting.regularReport}</p>
                ) : (
                  <Empty>暂无会议记录。</Empty>
                )}
                {currentMeeting.summary && (
                  <>
                    <h3 className="session-subheading">会议摘要</h3>
                    <p className="notes-text">{currentMeeting.summary}</p>
                  </>
                )}
                <div className="workspace-actions">
                  <button
                    type="button"
                    className="workspace-button"
                    onClick={() => {
                      setReport(currentMeeting.regularReport || "");
                      setSummary(currentMeeting.summary || "");
                      setEditingNotes(true);
                    }}
                  >
                    编辑会议记录
                  </button>
                </div>
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
        <section
          className="workspace-panel voting-panel"
          aria-labelledby="voting-heading"
        >
          <div className="workspace-heading">
            <h2 id="voting-heading" tabIndex={-1}>
              会议表决
            </h2>
            <span className={`council-tag ${voting.length ? "blue" : "grey"}`}>
              {voting.length ? "表决进行中" : "尚未开始"}
            </span>
          </div>
          {!active ? (
            <Empty>从议程中发起表决。成员投票不依赖汇报安排。</Empty>
          ) : (
            <>
              {voting.length > 1 && (
                <div className="voting-switch">
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
                </div>
              )}
              <h3
                id={`voting-title-${active.id}`}
                className="voting-title"
                tabIndex={-1}
              >
                {active.title}
              </h3>
              {active.description && (
                <p className="voting-description">{active.description}</p>
              )}
              <div className="voting-settings">
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
                    <option value="simple">{ruleLabels.simple}</option>
                    <option value="absolute">{ruleLabels.absolute}</option>
                  </select>
                </Field>
              </div>
              <dl className="division-figures">
                {voteChoices.map((vote) => (
                  <div key={vote} className={`division-figure is-${vote}`}>
                    <dt>{voteLabels[vote]}</dt>
                    <dd>{totals[vote]}</dd>
                  </div>
                ))}
              </dl>
              <p className="division-result" aria-live="polite">
                {ballotCount === 0 ? (
                  "尚未收到投票。"
                ) : (
                  <>
                    <span className={`council-tag ${passing ? "green" : "red"}`}>
                      {passing ? "将获通过" : "不获通过"}
                    </span>{" "}
                    共 {ballotCount} 票，按“{ruleLabels[active.voteRule || "simple"]}”计算，
                    {passing ? "现在结束表决即获通过。" : "现在结束表决将被否决。"}
                  </>
                )}
              </p>
              {active.voteMode === "members" ? (
                <div className="voting-ballot">
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
                  <div
                    className="workspace-actions vote-buttons"
                    role="group"
                    aria-label="投出一票"
                  >
                    {voteChoices.map((vote) => (
                      <Action
                        key={vote}
                        className={memberBallot === vote ? "is-chosen" : ""}
                        disabled={!data.members.some((member) => member.id === memberId)}
                        onClick={() =>
                          updateVoting((old) =>
                            recordBallot(old, memberId, vote),
                          )
                        }
                      >
                        {voteLabels[vote]}
                        {memberBallot === vote && (
                          <span className="ac-visually-hidden">（已选）</span>
                        )}
                      </Action>
                    ))}
                  </div>
                  {memberName && (
                    <p className="council-meta">
                      {memberBallot
                        ? `${memberName}当前投票：${voteLabels[memberBallot]}。`
                        : `${memberName}尚未投票。`}
                    </p>
                  )}
                  <p className="workspace-help">
                    每个成员计一票，结束前可改票。姓名由成员自行选择，请仅代表本人操作；此处不验证账号身份。
                  </p>
                </div>
              ) : (
                <fieldset className="manual-votes">
                  <legend>主持人录票</legend>
                  {voteChoices.map((vote) => (
                    <div
                      key={vote}
                      className="manual-vote"
                      role="group"
                      aria-labelledby={`manual-vote-${vote} manual-vote-${vote}-count`}
                    >
                      <span id={`manual-vote-${vote}`} className="manual-vote-label">
                        {voteLabels[vote]}票
                      </span>
                      {([-1, 1] as const).map((delta) => (
                        <Fragment key={delta}>
                          {delta > 0 && (
                            <span
                              id={`manual-vote-${vote}-count`}
                              className="manual-vote-count"
                            >
                              {totals[vote]}
                            </span>
                          )}
                          <Action
                            className="manual-vote-step"
                            disabled={delta < 0 && totals[vote] === 0}
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
                            {delta < 0 ? (
                              <Minus size={18} aria-hidden="true" />
                            ) : (
                              <Plus size={18} aria-hidden="true" />
                            )}
                            <span className="ac-visually-hidden">
                              {delta < 0 ? "减少一票" : "增加一票"}
                            </span>
                          </Action>
                        </Fragment>
                      ))}
                    </div>
                  ))}
                </fieldset>
              )}
              <div className="workspace-actions voting-finish">
                <Action
                  className="primary"
                  disabled={!Object.values(totals).some((n) => n > 0)}
                  onClick={async () => {
                    await updateVoting((old) => ({
                      ...old,
                      status: votingResult(old),
                      votes: voteTotals(old),
                    }));
                    // The agenda row now carries the result in its tag.
                    focusAfterChange(`agenda-title-${active.id}`, "voting-heading");
                  }}
                >
                  结束表决并保存结果
                </Action>
              </div>
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
