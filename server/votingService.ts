/** Server-only voting policy. Storage and time are injectable for isolated tests. */
export type VoteChoice = "approve" | "reject" | "abstain";
export type VoteRule = "simple" | "absolute";
export type VoteCounts = Record<VoteChoice, number>;
export type VoteResult = "passed" | "rejected";
export type VotingRecord = Record<string, unknown>;

export interface VotingIdentity {
  uid: string;
  email: string;
  emailVerified: boolean;
}

export interface VotingTransaction {
  get(path: string): Promise<VotingRecord | null>;
  hasMatchingDocument(collection: string, field: string, value: string): Promise<boolean>;
  create(path: string, data: VotingRecord): void;
  update(path: string, data: VotingRecord, deleteFields?: string[]): void;
  delete(path: string): void;
}

export interface VotingStore {
  runTransaction<T>(operation: (transaction: VotingTransaction) => Promise<T>): Promise<T>;
}

export class VotingError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "VotingError";
  }
}

export const VOTING_OWNER_EMAIL = "yulun8964@gmail.com";
const choices: readonly VoteChoice[] = ["approve", "reject", "abstain"];
const rules: readonly VoteRule[] = ["simple", "absolute"];
const has = (value: VotingRecord, key: string) => Object.prototype.hasOwnProperty.call(value, key);

export function validVotingId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

export function validVoteChoice(value: unknown): value is VoteChoice {
  return choices.includes(value as VoteChoice);
}

export function validVoteRule(value: unknown): value is VoteRule {
  return rules.includes(value as VoteRule);
}

function checkId(value: unknown): asserts value is string {
  if (!validVotingId(value)) throw new VotingError(400, "invalid-input", "议题或投票轮次编号无效。");
}

function conflict(message: string, code = "vote-conflict"): never {
  throw new VotingError(409, code, message);
}

function countsFrom(value: unknown): VoteCounts {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return conflict("投票数据需要管理员核查。", "invalid-vote-data");
  const data = value as VotingRecord;
  if (Object.keys(data).length !== 3 || !choices.every((choice) =>
    Number.isSafeInteger(data[choice]) && (data[choice] as number) >= 0))
    return conflict("投票数据需要管理员核查。", "invalid-vote-data");
  const counts = { approve: data.approve as number, reject: data.reject as number, abstain: data.abstain as number };
  if (!Number.isSafeInteger(counts.approve + counts.reject + counts.abstain))
    return conflict("投票数据需要管理员核查。", "invalid-vote-data");
  return counts;
}

function outcome(counts: VoteCounts, rule: VoteRule): VoteResult {
  const total = counts.approve + counts.reject + counts.abstain;
  return (rule === "absolute" ? counts.approve > total / 2 : counts.approve > counts.reject)
    ? "passed" : "rejected";
}

export interface BallotReceipt {
  choice: VoteChoice;
  createdAt: string;
}

function receiptFrom(data: VotingRecord): BallotReceipt {
  if (!validVoteChoice(data.choice) || typeof data.createdAt !== "string" || !Number.isFinite(Date.parse(data.createdAt)))
    return conflict("个人投票记录需要管理员核查。", "invalid-vote-data");
  // Return only the voter's receipt, even if an unexpected field exists in storage.
  return { choice: data.choice, createdAt: data.createdAt };
}

function assertRound(issue: VotingRecord, round: VotingRecord | null, issueId: string, roundId: string): asserts round is VotingRecord {
  if (issue.voteMode !== "private" || issue.voteRoundId !== roundId)
    conflict("投票轮次已变化，请刷新议题后重试。", "round-mismatch");
  if (!round || round.issueId !== issueId || round.roundId !== roundId ||
    !validVoteRule(round.rule) || round.rule !== issue.voteRule ||
    !["open", "closed"].includes(round.status as string))
    conflict("投票数据需要管理员核查。", "invalid-vote-data");
}

function assertNoLegacyBallots(issue: VotingRecord) {
  if (has(issue, "ballots") || has(issue, "voters") || ["manual", "members", "legacy"].includes(issue.voteMode as string))
    conflict("此议题包含旧版公开投票记录，请先由管理员完成旧票处理。", "legacy-voting");
}

const closedIssueStatuses = ["passed", "rejected", "authorization", "execution", "completed"];

function legacyCounts(issue: VotingRecord): VoteCounts {
  if (issue.voteMode === "members") {
    const ballots = issue.ballots ?? {};
    if (typeof ballots !== "object" || Array.isArray(ballots) || !ballots)
      return conflict("旧投票数据不完整，请由管理员核查后迁移。", "invalid-legacy-data");
    const counts: VoteCounts = { approve: 0, reject: 0, abstain: 0 };
    for (const choice of Object.values(ballots)) {
      if (!validVoteChoice(choice))
        return conflict("旧投票包含无效选项，请由管理员核查后迁移。", "invalid-legacy-data");
      counts[choice]++;
    }
    return countsFrom(counts);
  }
  if (issue.voteMode !== undefined && issue.voteMode !== "manual")
    return conflict("无法识别旧投票方式，请由管理员核查后迁移。", "invalid-legacy-data");
  if (!has(issue, "votes") && (has(issue, "ballots") || has(issue, "voters")))
    return conflict("旧选票缺少计票方式，请由管理员核查后迁移。", "invalid-legacy-data");
  return countsFrom(issue.votes ?? { approve: 0, reject: 0, abstain: 0 });
}

export function createVotingService(options: {
  store: VotingStore;
  now: () => Date;
  newRoundId: () => string;
  ownerEmail?: string;
}) {
  const { store } = options;
  const ownerEmail = options.ownerEmail ?? VOTING_OWNER_EMAIL;

  async function authorize(tx: VotingTransaction, identity: VotingIdentity, admin = false) {
    // The HTTP adapter creates this identity only after Firebase verifies the ID token.
    if (!identity || !identity.emailVerified || !identity.email ||
      typeof identity.uid !== "string" || identity.uid.length > 128 ||
      !identity.uid || identity.uid.includes("/") || [".", ".."].includes(identity.uid))
      throw new VotingError(401, "unauthenticated", "请使用已验证邮箱的账号重新登录。");
    if (identity.email === ownerEmail) return;
    // Read inside the transaction: a role removal racing this operation must take effect.
    const access = await tx.get(`workspaceAccess/${identity.uid}`);
    if (!access || access.active !== true || access.email !== identity.email ||
      !["member", "admin"].includes(access.role as string))
      throw new VotingError(403, "access-denied", "此账号尚未获批或访问权限已停用。");
    if (admin && access.role !== "admin")
      throw new VotingError(403, "admin-required", "只有管理员可以开始或结束投票。");
  }

  async function getIssue(tx: VotingTransaction, issueId: string) {
    const issue = await tx.get(`issues/${issueId}`);
    if (!issue) throw new VotingError(404, "issue-not-found", "议题不存在。");
    return issue;
  }

  return {
    async start(identity: VotingIdentity, input: { issueId: string; rule: VoteRule }) {
      checkId(input.issueId);
      if (!validVoteRule(input.rule)) throw new VotingError(400, "invalid-input", "投票规则无效。");
      // Keep the same ID if Firestore retries a transaction after a concurrent write.
      const newRoundId = options.newRoundId();
      checkId(newRoundId);
      return store.runTransaction(async (tx) => {
        await authorize(tx, identity, true);
        const issue = await getIssue(tx, input.issueId);
        assertNoLegacyBallots(issue);
        if (issue.status === "voting" && issue.voteMode !== "private")
          conflict("此议题仍在使用旧版投票，请先由管理员完成旧票处理。", "legacy-voting");
        if (issue.status === "voting" && issue.voteMode === "private" && validVotingId(issue.voteRoundId)) {
          const existingRound = await tx.get(`privateVotes/${issue.voteRoundId}`);
          assertRound(issue, existingRound, input.issueId, issue.voteRoundId);
          if (existingRound.status === "open" && existingRound.rule === input.rule && !issue.archived &&
            !has(issue, "votes") && !has(issue, "voteClosedAt"))
            return { issueId: input.issueId, roundId: issue.voteRoundId, rule: input.rule };
          conflict("议题已开始投票，无法更改规则。", "already-started");
        }
        if (issue.status !== "agenda" || issue.archived)
          conflict("只有未归档的待审议题可以开始投票。", "invalid-issue-state");
        if (["votes", "voteMode", "voteRoundId", "voteRule", "voteClosedAt"].some((key) => has(issue, key)))
          conflict("此议题保留了旧投票数据，请先由管理员完成旧票处理。", "legacy-voting");
        const createdAt = options.now().toISOString();
        tx.create(`privateVotes/${newRoundId}`, {
          issueId: input.issueId, roundId: newRoundId, status: "open", rule: input.rule,
          counts: { approve: 0, reject: 0, abstain: 0 }, createdAt, createdBy: identity.uid,
        });
        tx.update(`issues/${input.issueId}`, {
          status: "voting", voteMode: "private", voteRoundId: newRoundId,
          voteRule: input.rule, updatedAt: createdAt,
        });
        return { issueId: input.issueId, roundId: newRoundId, rule: input.rule };
      });
    },

    async cast(identity: VotingIdentity, input: { issueId: string; roundId: string; choice: VoteChoice }) {
      checkId(input.issueId);
      checkId(input.roundId);
      if (!validVoteChoice(input.choice)) throw new VotingError(400, "invalid-input", "投票选项无效。");
      return store.runTransaction(async (tx) => {
        await authorize(tx, identity);
        const issue = await getIssue(tx, input.issueId);
        assertNoLegacyBallots(issue);
        const round = await tx.get(`privateVotes/${input.roundId}`);
        assertRound(issue, round, input.issueId, input.roundId);
        const ballotPath = `privateVotes/${input.roundId}/ballots/${identity.uid}`;
        const existing = await tx.get(ballotPath);
        if (existing) {
          const ballot = receiptFrom(existing);
          if (ballot.choice !== input.choice) conflict("你已提交选票，不能修改。", "already-voted");
          // A lost response can be recovered with the same choice, including after close.
          return { issueId: input.issueId, roundId: input.roundId, ballot, alreadyCast: true };
        }
        if (issue.status !== "voting" || issue.archived || round.status !== "open" || has(issue, "voteClosedAt"))
          conflict("投票已结束，不能继续投票。", "voting-closed");
        if (has(issue, "votes")) conflict("投票数据需要管理员核查。", "invalid-vote-data");
        const counts = countsFrom(round.counts);
        counts[input.choice] += 1;
        countsFrom(counts);
        const ballot = { choice: input.choice, createdAt: options.now().toISOString() };
        tx.create(ballotPath, ballot);
        // The round document serializes cast/close. Counts never leave this server call.
        tx.update(`privateVotes/${input.roundId}`, { counts });
        return { issueId: input.issueId, roundId: input.roundId, ballot, alreadyCast: false };
      });
    },

    async close(identity: VotingIdentity, input: { issueId: string; roundId: string }) {
      checkId(input.issueId);
      checkId(input.roundId);
      return store.runTransaction(async (tx) => {
        await authorize(tx, identity, true);
        const issue = await getIssue(tx, input.issueId);
        assertNoLegacyBallots(issue);
        const round = await tx.get(`privateVotes/${input.roundId}`);
        assertRound(issue, round, input.issueId, input.roundId);
        const votes = countsFrom(round.counts);
        if (votes.approve + votes.reject + votes.abstain === 0)
          conflict("尚无选票，不能结束投票。", "empty-vote");
        const status = outcome(votes, round.rule as VoteRule);
        if (round.status === "closed") {
          const published = countsFrom(issue.votes);
          if (typeof round.closedAt !== "string" || issue.voteClosedAt !== round.closedAt ||
            round.result !== status || choices.some((choice) => published[choice] !== votes[choice]))
            conflict("投票结果需要管理员核查。", "invalid-vote-data");
          return { issueId: input.issueId, roundId: input.roundId, status, votes, closedAt: round.closedAt };
        }
        if (issue.status !== "voting" || has(issue, "votes") || has(issue, "voteClosedAt"))
          conflict("议题当前无法结束投票，请刷新后重试。", "invalid-issue-state");
        const closedAt = options.now().toISOString();
        tx.update(`privateVotes/${input.roundId}`, { status: "closed", result: status, closedAt, closedBy: identity.uid });
        tx.update(`issues/${input.issueId}`, { status, votes, voteClosedAt: closedAt, updatedAt: closedAt });
        return { issueId: input.issueId, roundId: input.roundId, status, votes, closedAt };
      });
    },

    async cancel(identity: VotingIdentity, input: { issueId: string; roundId: string }) {
      checkId(input.issueId);
      checkId(input.roundId);
      return store.runTransaction(async (tx) => {
        await authorize(tx, identity, true);
        const issue = await getIssue(tx, input.issueId);
        assertNoLegacyBallots(issue);
        const round = await tx.get(`privateVotes/${input.roundId}`);
        if (round?.status === "cancelled" && round.issueId === input.issueId && round.roundId === input.roundId &&
          typeof round.cancelledAt === "string" && issue.status === "agenda" &&
          !has(issue, "voteRoundId") && !has(issue, "voteMode") && !has(issue, "votes"))
          return { issueId: input.issueId, roundId: input.roundId, status: "agenda" as const, cancelledAt: round.cancelledAt };
        assertRound(issue, round, input.issueId, input.roundId);
        if (round.status !== "open" || issue.status !== "voting" || has(issue, "votes") || has(issue, "voteClosedAt"))
          conflict("此投票轮次无法取消，请刷新后重试。", "invalid-issue-state");
        const counts = countsFrom(round.counts);
        if (counts.approve + counts.reject + counts.abstain > 0)
          conflict("已有选票的投票不能取消，请正常结束投票。", "vote-not-empty");
        const cancelledAt = options.now().toISOString();
        tx.update(`privateVotes/${input.roundId}`, { status: "cancelled", cancelledAt, cancelledBy: identity.uid });
        tx.update(`issues/${input.issueId}`, { status: "agenda", updatedAt: cancelledAt },
          ["voteMode", "voteRule", "voteRoundId", "votes", "voteClosedAt"]);
        return { issueId: input.issueId, roundId: input.roundId, status: "agenda" as const, cancelledAt };
      });
    },

    async myBallot(identity: VotingIdentity, input: { issueId: string; roundId: string }) {
      checkId(input.issueId);
      checkId(input.roundId);
      return store.runTransaction(async (tx) => {
        await authorize(tx, identity);
        const issue = await getIssue(tx, input.issueId);
        assertNoLegacyBallots(issue);
        const round = await tx.get(`privateVotes/${input.roundId}`);
        assertRound(issue, round, input.issueId, input.roundId);
        const existing = await tx.get(`privateVotes/${input.roundId}/ballots/${identity.uid}`);
        return { issueId: input.issueId, roundId: input.roundId, ballot: existing ? receiptFrom(existing) : null };
      });
    },

    async deleteMeeting(identity: VotingIdentity, input: { meetingId: string }) {
      checkId(input.meetingId);
      return store.runTransaction(async (tx) => {
        await authorize(tx, identity);
        const meeting = await tx.get(`meetings/${input.meetingId}`);
        if (!meeting) throw new VotingError(404, "meeting-not-found", "会议不存在。");
        // Query the authoritative child links, not the potentially stale meeting.issueIds cache.
        const hasIssues = await tx.hasMatchingDocument("issues", "meetingId", input.meetingId);
        const hasAttendance = await tx.hasMatchingDocument("attendance", "meetingId", input.meetingId);
        if (hasIssues || hasAttendance)
          conflict("会议仍有关联议题或签到记录，请先处理这些记录。", "meeting-has-records");
        // Client child writes must also require getAfter(parent).exists in Firestore Rules.
        tx.delete(`meetings/${input.meetingId}`);
        return { meetingId: input.meetingId, deleted: true as const };
      });
    },

    async migrateLegacy(identity: VotingIdentity, input: { issueId: string; dryRun?: boolean }) {
      checkId(input.issueId);
      if (input.dryRun !== undefined && typeof input.dryRun !== "boolean")
        throw new VotingError(400, "invalid-input", "dryRun 必须为布尔值。");
      const dryRun = input.dryRun !== false;
      return store.runTransaction(async (tx) => {
        await authorize(tx, identity, true);
        const issue = await getIssue(tx, input.issueId);
        const archivePath = `legacyVoteArchives/${input.issueId}`;
        const existingArchive = await tx.get(archivePath);
        if (existingArchive) {
          if (issue.voteMode !== "legacy" || has(issue, "ballots") || has(issue, "voters"))
            conflict("已有旧票备份与议题状态不一致，请由管理员核查。", "legacy-archive-conflict");
          return { issueId: input.issueId, dryRun, migration: "already-migrated" as const };
        }
        if (issue.voteMode === "private" || has(issue, "voteRoundId"))
          conflict("私人投票轮次不能作为旧票迁移。", "private-round-exists");
        if (!has(issue, "ballots") && !has(issue, "voters") && !has(issue, "votes") &&
          !["manual", "members", "legacy"].includes(issue.voteMode as string))
          return { issueId: input.issueId, dryRun, migration: "not-needed" as const };
        const migration = issue.status === "voting" ? "paused" :
          closedIssueStatuses.includes(issue.status as string) ? "closed" : null;
        if (!migration)
          conflict("含旧票的议题状态需要管理员核查后再迁移。", "invalid-legacy-state");
        const counts = legacyCounts(issue);
        const rule = issue.voteRule ?? "simple";
        if (!validVoteRule(rule)) conflict("旧投票规则无效，请由管理员核查。", "invalid-legacy-data");
        const fields = Object.keys(issue).filter((key) => key.startsWith("vote") || key === "ballots").sort();
        if (dryRun) return { issueId: input.issueId, dryRun, migration, fields };
        const migratedAt = options.now().toISOString();
        const originalFields = Object.fromEntries(fields.map((key) => [key, issue[key]]));
        tx.create(archivePath, {
          issueId: input.issueId, originalStatus: issue.status, originalFields,
          counts, rule, migration, migratedAt, migratedBy: identity.uid,
        });
        const patch: VotingRecord = { voteMode: "legacy", voteRule: rule, updatedAt: migratedAt };
        if (migration === "closed") patch.votes = counts;
        // Archive identity-bearing values before removing them atomically from the readable issue.
        const deleteFields = fields.filter((key) => !["voteMode", "voteRule", "votes", "voteClosedAt"].includes(key));
        if (migration === "paused") deleteFields.push("votes", "voteClosedAt");
        tx.update(`issues/${input.issueId}`, patch, deleteFields);
        return { issueId: input.issueId, dryRun, migration, fields };
      });
    },

    async finishLegacy(identity: VotingIdentity, input: { issueId: string }) {
      checkId(input.issueId);
      return store.runTransaction(async (tx) => {
        await authorize(tx, identity, true);
        const issue = await getIssue(tx, input.issueId);
        const archivePath = `legacyVoteArchives/${input.issueId}`;
        const archive = await tx.get(archivePath);
        if (!archive || archive.issueId !== input.issueId || archive.migration !== "paused" ||
          issue.voteMode !== "legacy" || has(issue, "ballots") || has(issue, "voters") ||
          has(issue, "voteRoundId") || !validVoteRule(archive.rule) || issue.voteRule !== archive.rule)
          conflict("此议题没有可结算的旧投票备份。", "invalid-legacy-state");
        const votes = countsFrom(archive.counts);
        if (votes.approve + votes.reject + votes.abstain === 0)
          conflict("旧投票没有有效票，请由管理员另行处理。", "empty-vote");
        const status = outcome(votes, archive.rule);
        if (typeof archive.finishedAt === "string") {
          const published = countsFrom(issue.votes);
          if (archive.result !== status || issue.voteClosedAt !== archive.finishedAt ||
            !closedIssueStatuses.includes(issue.status as string) ||
            choices.some((choice) => votes[choice] !== published[choice]))
            conflict("旧投票结果需要管理员核查。", "invalid-legacy-data");
          return { issueId: input.issueId, status, votes, closedAt: archive.finishedAt };
        }
        if (issue.status !== "voting" || has(issue, "votes") || has(issue, "voteClosedAt"))
          conflict("此旧投票已结束或状态发生变化，请刷新后重试。", "invalid-legacy-state");
        const closedAt = options.now().toISOString();
        tx.update(archivePath, { finishedAt: closedAt, finishedBy: identity.uid, result: status });
        tx.update(`issues/${input.issueId}`, { status, votes, voteClosedAt: closedAt, updatedAt: closedAt });
        return { issueId: input.issueId, status, votes, closedAt };
      });
    },
  };
}

export type VotingService = ReturnType<typeof createVotingService>;
