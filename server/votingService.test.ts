import { describe, expect, test } from "bun:test";
import { createVotingService, VotingError, VOTING_OWNER_EMAIL } from "./votingService";
import type { VotingIdentity, VoteRule } from "./votingService";
import { VotingTestStore } from "./votingTestStore";

const admin: VotingIdentity = { uid: "admin", email: "admin@example.com", emailVerified: true };
const member: VotingIdentity = { uid: "member", email: "member@example.com", emailVerified: true };
const second: VotingIdentity = { uid: "second", email: "second@example.com", emailVerified: true };
const owner: VotingIdentity = { uid: "owner", email: VOTING_OWNER_EMAIL, emailVerified: true };

function fixture() {
  const store = new VotingTestStore();
  store.seed("issues/issue1", { id: "issue1", status: "agenda", archived: false, title: "测试议题", meetingId: "meeting1" });
  store.seed("meetings/meeting1", { id: "meeting1", title: "测试会议", issueIds: [] });
  for (const identity of [admin, member, second]) store.seed(`workspaceAccess/${identity.uid}`, {
    email: identity.email, active: true, role: identity === admin ? "admin" : "member",
  });
  let counter = 0;
  let tick = 0;
  const service = createVotingService({ store, newRoundId: () => `round${++counter}`,
    now: () => new Date(Date.UTC(2026, 8, 10, 12, 0, tick++)) });
  const start = (rule: VoteRule = "simple") => service.start(admin, { issueId: "issue1", rule });
  return { store, service, start };
}

async function errorCode(operation: Promise<unknown>, code: string) {
  try { await operation; throw new Error("Expected operation to fail"); }
  catch (error) { expect(error).toBeInstanceOf(VotingError); expect((error as VotingError).code).toBe(code); }
}

describe("private vote authorization", () => {
  test("only admin or verified owner can start; latest account approval is authoritative", async () => {
    const { store, service } = fixture();
    await errorCode(service.start(member, { issueId: "issue1", rule: "simple" }), "admin-required");
    await errorCode(service.start({ ...owner, emailVerified: false }, { issueId: "issue1", rule: "simple" }), "unauthenticated");
    await errorCode(service.start({ ...admin, email: "different@example.com" }, { issueId: "issue1", rule: "simple" }), "access-denied");
    store.seed("workspaceAccess/admin", { email: admin.email, role: "admin", active: false });
    await errorCode(service.start(admin, { issueId: "issue1", rule: "simple" }), "access-denied");
    expect(store.read("issues/issue1").status).toBe("agenda");
    expect((await service.start(owner, { issueId: "issue1", rule: "simple" })).roundId).toBeTruthy();
  });

  test("cast and own receipt access both reject a recently disabled account", async () => {
    const { store, service, start } = fixture();
    const round = await start();
    store.seed("workspaceAccess/member", { email: member.email, role: "member", active: false });
    await errorCode(service.cast(member, { ...round, choice: "approve" }), "access-denied");
    await errorCode(service.myBallot(member, round), "access-denied");
    await errorCode(service.cast({ ...member, uid: "../owner" }, { ...round, choice: "approve" }), "unauthenticated");
    expect(store.read(`privateVotes/${round.roundId}`).counts).toEqual({ approve: 0, reject: 0, abstain: 0 });
  });

  test("revocation racing a cast forces a fresh authorization check before any commit", async () => {
    const { store, start } = fixture();
    const round = await start();
    let revokeOnce = true;
    const service = createVotingService({ now: () => new Date(), newRoundId: () => "unused", store: {
      runTransaction: (operation) => store.runTransaction((tx) => operation({
        ...tx,
        get: async (path) => {
          const value = await tx.get(path);
          if (path === "issues/issue1" && revokeOnce) {
            revokeOnce = false;
            store.seed("workspaceAccess/member", { email: member.email, role: "member", active: false });
          }
          return value;
        },
      })),
    } });
    await errorCode(service.cast(member, { ...round, choice: "approve" }), "access-denied");
    expect(store.retries).toBeGreaterThan(0);
    expect(store.read(`privateVotes/${round.roundId}/ballots/member`)).toBeNull();
    expect(store.read(`privateVotes/${round.roundId}`).counts).toEqual({ approve: 0, reject: 0, abstain: 0 });
  });
});

describe("private vote transactions", () => {
  test("start is atomic and idempotent without exposing counts", async () => {
    const { store, service, start } = fixture();
    const [first, retry] = await Promise.all([start(), start()]);
    expect(retry).toEqual(first);
    expect(store.paths().filter((path) => /^privateVotes\/[^/]+$/.test(path))).toHaveLength(1);
    expect(store.retries).toBeGreaterThan(0);
    expect(store.read("issues/issue1")).not.toHaveProperty("votes");
    expect(JSON.stringify(first)).not.toContain("counts");
    await errorCode(service.start(admin, { issueId: "issue1", rule: "absolute" }), "already-started");
  });

  test.each([
    { status: "voting", voteMode: "members", ballots: { oldName: "approve" } },
    { status: "voting", votes: { approve: 2, reject: 0, abstain: 0 } },
    { status: "agenda", ballots: {} },
    { status: "agenda", votes: { approve: 0, reject: 0, abstain: 0 } },
    { status: "agenda", voteRoundId: "original-round", voteMode: "private" },
  ])("start refuses existing vote data without deleting it: %j", async (legacy) => {
    const { store, start } = fixture();
    store.seed("issues/issue1", { id: "issue1", archived: false, ...legacy });
    const original = store.read("issues/issue1");
    await errorCode(start(), "legacy-voting");
    expect(store.read("issues/issue1")).toEqual(original);
    expect(store.paths().some((path) => path.startsWith("privateVotes/"))).toBe(false);
  });

  test("concurrent duplicate requests create exactly one immutable UID ballot", async () => {
    const { store, service, start } = fixture();
    const round = await start();
    const receipts = await Promise.all(Array.from({ length: 12 }, () => service.cast(member, { ...round, choice: "approve" })));
    expect(receipts.filter((receipt) => !receipt.alreadyCast)).toHaveLength(1);
    expect(new Set(receipts.map((receipt) => receipt.ballot.createdAt)).size).toBe(1);
    expect(store.read(`privateVotes/${round.roundId}`).counts).toEqual({ approve: 1, reject: 0, abstain: 0 });
    await errorCode(service.cast(member, { ...round, choice: "reject" }), "already-voted");
    expect(store.read(`privateVotes/${round.roundId}/ballots/member`).choice).toBe("approve");
    expect(JSON.stringify(receipts)).not.toMatch(/counts|votes|admin@example|member@example/);
  });

  test("simultaneous different choices can accept only one", async () => {
    const { store, service, start } = fixture();
    const round = await start();
    const results = await Promise.allSettled([
      service.cast(member, { ...round, choice: "approve" }),
      service.cast(member, { ...round, choice: "reject" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const counts = store.read(`privateVotes/${round.roundId}`).counts as { approve: number; reject: number; abstain: number };
    expect(counts.approve + counts.reject + counts.abstain).toBe(1);
  });

  test("each caller reads only their own minimal receipt, never another ballot", async () => {
    const { store, service, start } = fixture();
    const round = await start();
    await service.cast(member, { ...round, choice: "abstain" });
    expect((await service.myBallot(second, round)).ballot).toBeNull();
    const original = store.read(`privateVotes/${round.roundId}/ballots/member`);
    store.seed(`privateVotes/${round.roundId}/ballots/member`, { ...original, unexpectedSecret: "do-not-return" });
    const receipt = (await service.myBallot(member, round)).ballot;
    expect(original.choice).toBe(receipt.choice);
    expect(original.createdAt).toBe(receipt.createdAt);
    expect(Object.keys(receipt).sort()).toEqual(["choice", "createdAt"]);
    await errorCode(service.myBallot(member, { ...round, roundId: "wrong" }), "round-mismatch");
    await errorCode(service.cast(member, { ...round, roundId: "wrong", choice: "approve" }), "round-mismatch");
  });

  test("close requires admin and a nonempty poll", async () => {
    const { store, service, start } = fixture();
    const round = await start();
    await errorCode(service.close(member, round), "admin-required");
    await errorCode(service.close(admin, round), "empty-vote");
    expect(store.read("issues/issue1").status).toBe("voting");
    expect(store.read(`privateVotes/${round.roundId}`).status).toBe("open");
  });

  test.each(["simple", "absolute"] as const)("close publishes frozen totals with the %s rule", async (rule) => {
    const { store, service, start } = fixture();
    const round = await start(rule);
    await Promise.all([
      service.cast(member, { ...round, choice: "approve" }),
      service.cast(second, { ...round, choice: "abstain" }),
    ]);
    expect(store.read("issues/issue1")).not.toHaveProperty("votes");
    const closed = await service.close(admin, round);
    expect(closed.status).toBe(rule === "simple" ? "passed" : "rejected");
    expect(closed.votes).toEqual({ approve: 1, reject: 0, abstain: 1 });
    expect(store.read("issues/issue1").votes).toEqual(closed.votes);
    expect(store.read("issues/issue1").voteClosedAt).toBe(closed.closedAt);
    expect(await service.close(admin, round)).toEqual(closed);
    expect((await service.cast(member, { ...round, choice: "approve" })).alreadyCast).toBe(true);
    await errorCode(service.cast(owner, { ...round, choice: "approve" }), "voting-closed");
  });

  test("a close racing a new ballot either includes it or refuses it, with no lost vote", async () => {
    const { store, service, start } = fixture();
    const round = await start();
    await service.cast(member, { ...round, choice: "approve" });
    const [casting, closing] = await Promise.allSettled([
      service.cast(second, { ...round, choice: "reject" }), service.close(admin, round),
    ]);
    expect(closing.status).toBe("fulfilled");
    const published = store.read("issues/issue1").votes;
    expect(published).toEqual(store.read(`privateVotes/${round.roundId}`).counts);
    expect(published).toEqual({ approve: 1, reject: casting.status === "fulfilled" ? 1 : 0, abstain: 0 });
    expect(Boolean(store.read(`privateVotes/${round.roundId}/ballots/second`))).toBe(casting.status === "fulfilled");
  });

  test("corrupt counters fail without creating a ballot or publishing invented totals", async () => {
    const { store, service, start } = fixture();
    const round = await start();
    store.seed(`privateVotes/${round.roundId}`, { ...store.read(`privateVotes/${round.roundId}`), counts: { approve: -1, reject: 0, abstain: 0 } });
    await errorCode(service.cast(member, { ...round, choice: "approve" }), "invalid-vote-data");
    await errorCode(service.close(admin, round), "invalid-vote-data");
    expect(store.read(`privateVotes/${round.roundId}/ballots/member`)).toBeNull();
    expect(store.read("issues/issue1")).not.toHaveProperty("votes");
  });

  test("only admin can cancel an empty round; audit remains and a new round gets a new ID", async () => {
    const { store, service, start } = fixture();
    const round = await start();
    await errorCode(service.cancel(member, round), "admin-required");
    const cancelled = await service.cancel(admin, round);
    expect(cancelled.status).toBe("agenda");
    expect(await service.cancel(admin, round)).toEqual(cancelled);
    const issue = store.read("issues/issue1");
    for (const field of ["votes", "voteRule", "voteMode", "voteRoundId", "voteClosedAt"]) expect(issue).not.toHaveProperty(field);
    expect(store.read(`privateVotes/${round.roundId}`)).toMatchObject({ status: "cancelled", cancelledAt: cancelled.cancelledAt, counts: { approve: 0, reject: 0, abstain: 0 } });
    const replacement = await start("absolute");
    expect(replacement.roundId).not.toBe(round.roundId);
    await errorCode(service.cast(member, { ...round, choice: "approve" }), "round-mismatch");
    await errorCode(service.cancel(admin, round), "round-mismatch");
    expect(store.read(`privateVotes/${round.roundId}`).status).toBe("cancelled");
  });

  test("a nonempty vote cannot be cancelled or have its ballot discarded", async () => {
    const { store, service, start } = fixture();
    const round = await start();
    await service.cast(member, { ...round, choice: "abstain" });
    await errorCode(service.cancel(admin, round), "vote-not-empty");
    expect(store.read("issues/issue1").status).toBe("voting");
    expect(store.read(`privateVotes/${round.roundId}/ballots/member`).choice).toBe("abstain");
  });

  test("cancel racing a first vote either preserves the ballot or cancels before accepting it", async () => {
    const { store, service, start } = fixture();
    const round = await start();
    const results = await Promise.allSettled([service.cancel(admin, round), service.cast(member, { ...round, choice: "approve" })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const wasCancelled = results[0].status === "fulfilled";
    expect(store.read(`privateVotes/${round.roundId}`).status).toBe(wasCancelled ? "cancelled" : "open");
    expect(Boolean(store.read(`privateVotes/${round.roundId}/ballots/member`))).toBe(!wasCancelled);
    expect(store.read("issues/issue1").status).toBe(wasCancelled ? "agenda" : "voting");
  });
});

describe("meeting deletion", () => {
  test("authoritative child links prevent deletion even when cached issueIds is empty", async () => {
    const { store, service } = fixture();
    await errorCode(service.deleteMeeting(member, { meetingId: "meeting1" }), "meeting-has-records");
    expect(store.read("meetings/meeting1")).not.toBeNull();
    store.seed("issues/issue1", { ...store.read("issues/issue1"), meetingId: null });
    store.seed("attendance/a1", { meetingId: "meeting1" });
    await errorCode(service.deleteMeeting(member, { meetingId: "meeting1" }), "meeting-has-records");
    store.seed("attendance/a1", { meetingId: "another" });
    expect(await service.deleteMeeting(member, { meetingId: "meeting1" })).toEqual({ meetingId: "meeting1", deleted: true });
    expect(store.read("meetings/meeting1")).toBeNull();
    await errorCode(service.deleteMeeting(member, { meetingId: "meeting1" }), "meeting-not-found");
  });
});

describe("legacy migration", () => {
  function legacyFixture(status = "voting") {
    const values = fixture();
    values.store.seed("issues/issue1", { ...values.store.read("issues/issue1"), status,
      voteMode: "members", voteRule: "absolute", ballots: { "Old Member Name": "approve", "old-roster-id": "abstain" },
      votes: { approve: 99, reject: 99, abstain: 99 }, voters: ["Old Member Name"],
    });
    return values;
  }

  test("dry run is the default and leaks neither identities nor open vote counts", async () => {
    const { store, service } = legacyFixture();
    const before = store.read("issues/issue1");
    const result = await service.migrateLegacy(admin, { issueId: "issue1" });
    expect(result).toMatchObject({ dryRun: true, migration: "paused" });
    expect(store.read("issues/issue1")).toEqual(before);
    expect(store.read("legacyVoteArchives/issue1")).toBeNull();
    expect(JSON.stringify(result)).not.toMatch(/Old Member Name|old-roster-id|approve|abstain|counts/);
    await errorCode(service.migrateLegacy(member, { issueId: "issue1", dryRun: false }), "admin-required");
  });

  test("open migration archives exact old fields, hides all votes and does not fabricate UIDs", async () => {
    const { store, service } = legacyFixture();
    const original = store.read("issues/issue1");
    const migrated = await service.migrateLegacy(admin, { issueId: "issue1", dryRun: false });
    expect(migrated.migration).toBe("paused");
    const issue = store.read("issues/issue1");
    expect(issue).toMatchObject({ status: "voting", voteMode: "legacy", voteRule: "absolute" });
    for (const key of ["ballots", "voters", "votes", "voteRoundId"]) expect(issue).not.toHaveProperty(key);
    const archive = store.read("legacyVoteArchives/issue1");
    expect(archive.originalFields).toEqual({ ballots: original.ballots, voters: original.voters, votes: original.votes, voteMode: "members", voteRule: "absolute" });
    expect(archive.counts).toEqual({ approve: 1, reject: 0, abstain: 1 });
    expect(store.paths().some((path) => path.startsWith("privateVotes/"))).toBe(false);
    expect((await service.migrateLegacy(admin, { issueId: "issue1", dryRun: false })).migration).toBe("already-migrated");
    expect(store.read("legacyVoteArchives/issue1")).toEqual(archive);
    await errorCode(service.start(admin, { issueId: "issue1", rule: "simple" }), "legacy-voting");
  });

  test("concurrent migration keeps one immutable backup, including unusual old field names", async () => {
    const { store, service } = legacyFixture();
    store.seed("issues/issue1", { ...store.read("issues/issue1"), "vote.person": "old-identity" });
    const results = await Promise.all([
      service.migrateLegacy(admin, { issueId: "issue1", dryRun: false }),
      service.migrateLegacy(admin, { issueId: "issue1", dryRun: false }),
    ]);
    expect(results.map((result) => result.migration).sort()).toEqual(["already-migrated", "paused"]);
    expect(Object.keys(store.read("issues/issue1"))).not.toContain("vote.person");
    expect((store.read("legacyVoteArchives/issue1").originalFields as Record<string, unknown>)["vote.person"]).toBe("old-identity");
  });

  test("closed migration preserves the historical result while publishing original mode totals", async () => {
    const { store, service } = legacyFixture("passed");
    await service.migrateLegacy(admin, { issueId: "issue1", dryRun: false });
    // The original status is evidence, even if today's rule calculation would reject this tie.
    expect(store.read("issues/issue1")).toMatchObject({ status: "passed", voteMode: "legacy", votes: { approve: 1, reject: 0, abstain: 1 } });
    expect(store.read("issues/issue1")).not.toHaveProperty("ballots");
    await errorCode(service.finishLegacy(admin, { issueId: "issue1" }), "invalid-legacy-state");
  });

  test("manual migration freezes supplied counts, then only admin explicitly finishes", async () => {
    const { store, service } = fixture();
    store.seed("issues/issue1", { status: "voting", voteMode: "manual", votes: { approve: 3, reject: 1, abstain: 1 } });
    await service.migrateLegacy(admin, { issueId: "issue1", dryRun: false });
    expect(store.read("issues/issue1").status).toBe("voting");
    await errorCode(service.finishLegacy(member, { issueId: "issue1" }), "admin-required");
    const closed = await service.finishLegacy(admin, { issueId: "issue1" });
    expect(closed).toMatchObject({ status: "passed", votes: { approve: 3, reject: 1, abstain: 1 } });
    expect(await service.finishLegacy(admin, { issueId: "issue1" })).toEqual(closed);
    expect(store.read("legacyVoteArchives/issue1").originalFields).toEqual({ voteMode: "manual", votes: { approve: 3, reject: 1, abstain: 1 } });
  });

  test("empty legacy votes stay paused until separate administrator resolution", async () => {
    const { store, service } = fixture();
    store.seed("issues/issue1", { status: "voting", voteMode: "members", ballots: {} });
    await service.migrateLegacy(admin, { issueId: "issue1", dryRun: false });
    await errorCode(service.finishLegacy(admin, { issueId: "issue1" }), "empty-vote");
    expect(store.read("issues/issue1").status).toBe("voting");
    expect(store.read("issues/issue1")).not.toHaveProperty("votes");
  });

  test("no old votes is a no-op; private rounds and damaged old votes cannot be migrated", async () => {
    const { store, service, start } = fixture();
    expect((await service.migrateLegacy(admin, { issueId: "issue1", dryRun: false })).migration).toBe("not-needed");
    await start();
    await errorCode(service.migrateLegacy(admin, { issueId: "issue1", dryRun: false }), "private-round-exists");
    store.seed("issues/issue1", { status: "voting", voteMode: "manual", votes: { approve: 1.5, reject: 0, abstain: 0 } });
    await errorCode(service.migrateLegacy(admin, { issueId: "issue1", dryRun: false }), "invalid-vote-data");
    expect(store.read("legacyVoteArchives/issue1")).toBeNull();
  });
});
