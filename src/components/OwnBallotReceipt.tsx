import { useEffect, useState } from "react";
import { votingRequest, type BallotReceipt } from "../lib/privateVoting";

/** A separate account-scoped request; the shared issue never contains a ballot. */
export function OwnBallotReceipt({ issueId, roundId, uid }: { issueId: string; roundId: string; uid: string }) {
  const [ballot, setBallot] = useState<BallotReceipt | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setReady(false); setBallot(null); setError("");
    votingRequest({ action: "my-ballot", issueId, roundId }, { expectedUid: uid, signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setBallot(result.ballot || null); setReady(true); } })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "选票读取失败。"); });
    return () => controller.abort();
  }, [issueId, roundId, uid, retry]);
  return <section className="workspace-panel" aria-label="本人的选票回执">
    <strong>本人的选票回执</strong>
    {error ? <div role="alert"><p>{error}</p><button type="button" className="workspace-button" onClick={() => setRetry(value => value + 1)}>重试读取</button></div>
      : !ready ? <p role="status">正在读取…</p>
        : ballot ? <p>你的选票：{{ approve: "赞成", reject: "反对", abstain: "弃权" }[ballot.choice]} · 已提交，不能修改。</p>
          : <p>你没有参与这次表决。</p>}
  </section>;
}
