import { getCloudAuth } from "./cloudAccess";

export type BallotChoice = "approve" | "reject" | "abstain";
export type BallotReceipt = { choice: BallotChoice; createdAt: string };
export type VotingResponse = {
  ok: true; issueId?: string; roundId?: string; ballot?: BallotReceipt | null;
  votes?: { approve: number; reject: number; abstain: number };
};
export async function votingRequest(
  input: Record<string, string | boolean>,
  options: { signal?: AbortSignal; expectedUid?: string; assertCurrent?: () => void } = {},
): Promise<VotingResponse> {
  const auth = getCloudAuth();
  const user = auth.currentUser;
  if (!user || (options.expectedUid && user.uid !== options.expectedUid)) throw new Error("登录账号已改变，请重新打开工作台。");
  const assertCurrent = () => {
    options.assertCurrent?.();
    if (options.signal?.aborted || auth.currentUser !== user) throw new Error("操作已取消或账号已改变。");
  };
  assertCurrent();
  const token = await user.getIdToken();
  assertCurrent();
  const read = input.action === "my-ballot";
  const ownQuery = Object.fromEntries(["action", "issueId", "roundId"].filter(key => typeof input[key] === "string").map(key => [key, input[key] as string]));
  const query = read ? `?${new URLSearchParams(ownQuery)}` : "";
  const response = await fetch(`/api/voting${query}`, {
    method: read ? "GET" : "POST", cache: "no-store", signal: options.signal,
    headers: { Authorization: `Bearer ${token}`, ...(read ? {} : { "Content-Type": "application/json" }) },
    ...(read ? {} : { body: JSON.stringify(input) }),
  });
  assertCurrent();
  const result = await response.json().catch(() => null);
  assertCurrent();
  if (!response.ok || result?.ok !== true) {
    throw new Error(typeof result?.error?.message === "string" && result.error.message
      ? result.error.message
      : "表决服务暂不可用，请稍后重试；不会退回公开或可改票的模式。");
  }
  return result;
}
