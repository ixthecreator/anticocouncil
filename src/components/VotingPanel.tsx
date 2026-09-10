import { useEffect, useRef, useState } from "react";
import type { Issue, Meeting } from "../types";
import type { Workspace } from "../lib/useWorkspace";
import type { AccessActor } from "../lib/cloudAccess";
import { votingRequest, type BallotChoice, type BallotReceipt } from "../lib/privateVoting";
import { recordBallot, voteTotals, votingResult } from "../lib/workspace";
import { Action, Empty, Field } from "./WorkspaceForms";

const labels = { approve: "赞成", reject: "反对", abstain: "弃权" };

export function VotingPanel({ active, workspace, actor, meeting }: { active?: Issue; workspace: Workspace; actor?: AccessActor; meeting: Meeting }) {
  const [ballot, setBallot] = useState<BallotReceipt | null>(null);
  const [ballotReady, setBallotReady] = useState(false);
  const [ballotError, setBallotError] = useState("");
  const [reload, setReload] = useState(0);
  const [localMember, setLocalMember] = useState("");
  const [choice, setChoice] = useState<BallotChoice | "">("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const cloud = workspace.mode === "firebase";
  const canHost = !cloud || actor?.role === "admin";
  useEffect(() => {
    setBallot(null); setBallotReady(false); setBallotError(""); setChoice(""); setConfirmClose(false); setConfirmCancel(false);
    if (!cloud || active?.voteMode !== "private" || !active.voteRoundId) return;
    const abort = new AbortController();
    votingRequest({ action: "my-ballot", issueId: active.id, roundId: active.voteRoundId }, { signal: abort.signal, expectedUid: actor?.uid })
      .then(result => { if (!abort.signal.aborted) { setBallot(result.ballot || null); setBallotReady(true); } })
      .catch(error => { if (!abort.signal.aborted) setBallotError(error instanceof Error ? error.message : "选票读取失败。"); });
    return () => abort.abort();
  }, [active?.id, active?.voteRoundId, active?.voteMode, cloud, actor?.uid, reload]);
  const localBallot = active?.ballots?.[localMember];
  const submitted = cloud ? ballot?.choice : localBallot;
  const checked = workspace.data.attendance.filter(record => record.meetingId === meeting.id);
  return <section className="workspace-panel voting-panel">
    <div className="workspace-heading"><div><span className="eyebrow">VOTING</span><h2>会议表决</h2></div><span className="workspace-badge">{active ? "表决进行中" : "尚未开始"}</span></div>
    {!active ? <Empty>{canHost ? "从议程中发起表决；通过规则在发起时固定。" : "由管理员发起表决；获批成员可用本人账号投票。"}</Empty> : <>
      <h3 className="voting-title">{active.title}</h3><p>{active.description}</p>
      <p className="workspace-help">通过规则：{active.voteRule === "absolute" ? "赞成超过实际已投票数的一半" : "赞成多于反对"}。平票不通过，未投票者不计入分母。</p>
      <div className="workspace-panel"><strong>{cloud ? "个人选票仅本人可见" : "本地表决演示"}</strong><p>提交后不能更改。表决结束后公布匿名汇总，进行中不显示票数。</p></div>
      {cloud && active.voteMode !== "private" ? <>
        <p className="workspace-help">此项是旧版表决，已暂停继续投票。管理员须先安全转存旧记录，再确认是否结束；旧票不会自动计入新的表决。</p>
        {canHost && active.voteMode === "legacy" && <Action onClick={() => { setConfirmClose(true); }}>准备结束旧版表决</Action>}
      </> : <>
        {!cloud && <><p className="workspace-help">本地试用只演示流程，同一浏览器的数据不具备账号级隔离。</p><Field label="本地演示成员"><select value={localMember} onChange={event => { setLocalMember(event.target.value); setChoice(""); }}><option value="">选择本次已签到成员</option>{checked.map(record => <option key={record.memberId} value={record.memberId}>{record.memberName}</option>)}</select></Field></>}
        {cloud && <p>当前投票账号：{actor?.name || actor?.email}</p>}
        {ballotError && <div role="alert" className="workspace-error">{ballotError}<button type="button" className="workspace-button" onClick={() => setReload(value => value + 1)}>重新读取本人选票</button></div>}
        {cloud && !ballotReady && !ballotError && <p role="status">正在读取本人选票…</p>}
        {submitted ? <p role="status"><strong>你的选票：{labels[submitted]}</strong> · 已提交，不能修改。</p> : <fieldset disabled={cloud ? !ballotReady : !checked.some(record => record.memberId === localMember)}>
          <legend>选择你的选票</legend><div className="workspace-actions">{(["approve", "reject", "abstain"] as const).map(value => <label key={value}><input type="radio" name={`ballot-${active.id}`} value={value} checked={choice === value} onChange={() => setChoice(value)} /> {labels[value]}</label>)}</div>
          <Action className="primary full-width" disabled={!choice} onClick={async () => {
            if (!choice) return;
            if (cloud) {
              await workspace.runOperation(async assertCurrent => {
                assertCurrent();
                const result = await votingRequest({ action: "cast", issueId: active.id, roundId: active.voteRoundId!, choice }, { expectedUid: actor?.uid, assertCurrent });
                if (alive.current) setBallot(result.ballot || null);
              });
            } else {
              await workspace.localMutation(latest => {
                if (!latest.attendance.some(record => record.meetingId === meeting.id && record.memberId === localMember)) throw new Error("该成员尚未签到。");
                const issue = latest.issues.find(record => record.id === active.id);
                if (!issue) throw new Error("议题已被删除。");
                return { ...latest, issues: latest.issues.map(record => record.id === issue.id ? recordBallot(issue, localMember, choice) : record) };
              });
            }
          }}>确认提交，提交后不可修改</Action>
        </fieldset>}
        {canHost && !confirmClose && !confirmCancel && <div className="workspace-actions"><Action onClick={() => setConfirmClose(true)}>准备结束表决</Action><Action onClick={() => setConfirmCancel(true)}>取消未收票的表决</Action></div>}
        {canHost && confirmCancel && <div className="workspace-panel"><p>仅尚未收到任何选票时可取消。议题将回到待讨论；已有选票时系统会拒绝取消。</p><div className="workspace-actions"><button type="button" className="workspace-button" onClick={() => setConfirmCancel(false)}>保留表决</button><Action onClick={async () => {
          if (cloud) {
            await workspace.runOperation(async assertCurrent => {
              await votingRequest({ action: "cancel", issueId: active.id, roundId: active.voteRoundId! }, { expectedUid: actor?.uid, assertCurrent });
            });
          } else {
            await workspace.change("issues", active.id, latest => {
              if (!latest || latest.status !== "voting") throw new Error("表决状态已改变。");
              if (Object.values(voteTotals(latest)).some(value => value > 0)) throw new Error("已有选票，不能取消表决。");
              const next = { ...latest, status: "agenda" as const, updatedAt: new Date().toISOString() };
              delete next.ballots; delete next.votes; delete next.voteMode; delete next.voteRule; delete next.voteRoundId; delete next.voteClosedAt;
              return next;
            });
          }
        }}>确认取消</Action></div></div>}
      </>}
      {canHost && confirmClose && <div className="workspace-panel"><p>结束后停止接收选票并公布匿名汇总，不能撤回。</p><div className="workspace-actions"><button type="button" className="workspace-button" onClick={() => setConfirmClose(false)}>继续投票</button><Action className="primary" onClick={async () => {
        if (cloud) {
          await workspace.runOperation(async assertCurrent => {
            assertCurrent();
            await votingRequest(active.voteMode === "legacy" ? { action: "finish-legacy", issueId: active.id } : { action: "close", issueId: active.id, roundId: active.voteRoundId! }, { expectedUid: actor?.uid, assertCurrent });
          });
        } else {
          await workspace.change("issues", active.id, latest => {
            if (!latest || latest.status !== "voting") throw new Error("表决状态已改变。");
            const votes = voteTotals(latest);
            if (!Object.values(votes).some(value => value > 0)) throw new Error("尚无有效选票，不能生成表决结论。");
            return { ...latest, status: votingResult(latest), votes, voteClosedAt: new Date().toISOString() };
          });
        }
      }}>确认结束并公布汇总</Action></div></div>}
    </>}
  </section>;
}
