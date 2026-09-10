import { describe, expect, test } from "bun:test";
import { Readable } from "node:stream";
import type { ServerResponse } from "node:http";
import { createVotingHandler, MAX_VOTING_BODY_BYTES } from "./votingHttp";
import type { VotingHttpDependencies, VotingRequest } from "./votingHttp";
import { VotingError } from "./votingService";
import type { VotingService } from "./votingService";

function fixture(isMaintenance = () => false) {
  const calls: { method: string; identity: unknown; input: unknown }[] = [];
  const tokens: string[] = [];
  const identity = { uid: "trusted-uid", email: "trusted@example.com", emailVerified: true };
  const service = Object.fromEntries(["start", "cast", "close", "cancel", "myBallot", "deleteMeeting", "migrateLegacy", "finishLegacy"].map((method) => [method,
    async (verified: unknown, input: unknown) => {
      calls.push({ method, identity: verified, input });
      return { marker: method };
    },
  ])) as unknown as VotingService;
  const dependencies: VotingHttpDependencies = {
    service,
    verifyToken: async (token) => { tokens.push(token); return identity; },
  };
  let initialized = 0;
  const handler = createVotingHandler(() => { initialized++; return dependencies; }, isMaintenance);
  const invoke = async (input: {
    method?: string; url?: string; body?: unknown; raw?: string | string[];
    headers?: Record<string, string | string[] | undefined>;
  } = {}) => {
    const request = Readable.from(typeof input.raw === "string" ? [input.raw] : input.raw ?? []) as VotingRequest;
    request.method = input.method ?? "POST";
    request.url = input.url ?? "/api/voting";
    request.headers = { "content-type": "application/json", authorization: "Bearer token.a.b", ...input.headers };
    if (input.body !== undefined) request.body = input.body;
    const headers: Record<string, unknown> = {};
    let body = "";
    const response = { statusCode: 0, setHeader: (name: string, value: unknown) => { headers[name] = value; },
      end: (value: string) => { body = value; } };
    await handler(request, response as unknown as ServerResponse);
    return { status: response.statusCode, headers, json: JSON.parse(body), raw: body };
  };
  return { invoke, calls, tokens, dependencies, identity, initialized: () => initialized };
}

describe("voting HTTP boundary", () => {
  test.each([
    [{ action: "start", issueId: "i1", rule: "absolute" }, "start"],
    [{ action: "cast", issueId: "i1", roundId: "r1", choice: "approve" }, "cast"],
    [{ action: "close", issueId: "i1", roundId: "r1" }, "close"],
    [{ action: "cancel", issueId: "i1", roundId: "r1" }, "cancel"],
    [{ action: "delete-meeting", meetingId: "m1" }, "deleteMeeting"],
    [{ action: "migrate-legacy", issueId: "i1" }, "migrateLegacy"],
    [{ action: "migrate-legacy", issueId: "i1", dryRun: false }, "migrateLegacy"],
    [{ action: "finish-legacy", issueId: "i1" }, "finishLegacy"],
  ])("dispatches validated %j with verified identity", async (body, method) => {
    const { invoke, calls, tokens, identity } = fixture();
    const result = await invoke({ body });
    expect(result.status).toBe(200);
    expect(result.json).toEqual({ ok: true, marker: method });
    expect(calls).toEqual([{ method, identity, input: body }]);
    expect(tokens).toEqual(["token.a.b"]);
    expect(result.headers["Cache-Control"]).toContain("no-store");
    expect(result.headers["Vercel-CDN-Cache-Control"]).toBe("no-store");
    expect(result.headers["Vary"]).toBe("Authorization");
    expect(result.headers).not.toHaveProperty("Access-Control-Allow-Origin");
  });

  test("GET exposes only the authenticated caller's receipt", async () => {
    const { invoke, calls, identity } = fixture();
    const response = await invoke({ method: "GET", url: "/api/voting?action=my-ballot&issueId=i1&roundId=r1" });
    expect(response.status).toBe(200);
    expect(calls).toEqual([{ method: "myBallot", identity, input: { action: "my-ballot", issueId: "i1", roundId: "r1" } }]);
  });

  test.each(["PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])("rejects %s before initializing credentials", async (method) => {
    const { invoke, initialized } = fixture();
    const response = await invoke({ method });
    expect(response.status).toBe(405);
    expect(response.headers.Allow).toBe("GET, POST");
    expect(initialized()).toBe(0);
  });

  test.each([
    { action: "cast", issueId: "i1", roundId: "r1", choice: "approve", uid: "victim" },
    { action: "cast", issueId: "i1", roundId: "r1", choice: "approve", votes: { approve: 50 } },
    { action: "close", issueId: "i1", roundId: "r1", status: "passed" },
    { action: "cast", issueId: "../privateVotes", roundId: "r1", choice: "approve" },
    { action: "cast", issueId: "i1", choice: "approve" },
    { action: "cast", issueId: "i1", roundId: "r1", choice: "invalid" },
    { action: "start", issueId: "i1", rule: "unanimous" },
    { action: "migrate-legacy", issueId: "i1", dryRun: "false" },
    { action: "my-ballot", issueId: "i1", roundId: "r1" },
    { action: "unknown" }, [], null,
  ])("rejects manipulated body %j before token verification", async (body) => {
    const { invoke, calls, tokens } = fixture();
    const result = await invoke({ body });
    expect(result.status).toBe(400);
    expect(calls).toHaveLength(0);
    expect(tokens).toHaveLength(0);
  });

  test.each([
    "/api/voting?action=my-ballot&issueId=i1&roundId=r1&uid=victim",
    "/api/voting?action=my-ballot&issueId=i1&roundId=r1&roundId=r2",
    "/api/voting?action=my-ballot&issueId=i1",
    "/api/voting?action=close&issueId=i1&roundId=r1",
  ])("rejects unsafe GET query %s", async (url) => {
    const { invoke, tokens } = fixture();
    expect((await invoke({ method: "GET", url })).status).toBe(400);
    expect(tokens).toHaveLength(0);
  });

  test("streamed and pre-parsed body limits are both enforced", async () => {
    const { invoke, tokens } = fixture();
    const oversize = "x".repeat(MAX_VOTING_BODY_BYTES + 1);
    expect((await invoke({ body: { action: oversize } })).status).toBe(413);
    expect((await invoke({ raw: ["{", oversize] })).status).toBe(413);
    expect((await invoke({ body: "{}", headers: { "content-length": String(MAX_VOTING_BODY_BYTES + 1) } })).status).toBe(413);
    expect(tokens).toHaveLength(0);
  });

  test("requires JSON, rejects compressed and malformed bodies, accepts a valid raw stream", async () => {
    const { invoke } = fixture();
    expect((await invoke({ body: {}, headers: { "content-type": "text/plain" } })).status).toBe(415);
    expect((await invoke({ body: {}, headers: { "content-encoding": "gzip" } })).status).toBe(415);
    expect((await invoke({ raw: "{bad json" })).status).toBe(400);
    expect((await invoke({ raw: JSON.stringify({ action: "start", issueId: "i1", rule: "simple" }) })).status).toBe(200);
  });

  test.each([undefined, "Basic abc", "Bearer token with spaces", "Bearer " + "x".repeat(16385)])("rejects missing or malformed authorization", async (authorization) => {
    const { invoke, initialized } = fixture();
    expect((await invoke({ body: { action: "start", issueId: "i1", rule: "simple" }, headers: { authorization } })).status).toBe(401);
    expect(initialized()).toBe(0);
  });

  test("revoked credentials fail safely and internal errors never expose secrets", async () => {
    const { invoke, dependencies, calls } = fixture();
    const body = { action: "start", issueId: "i1", rule: "simple" };
    dependencies.verifyToken = async () => { throw new VotingError(401, "unauthenticated", "登录状态已失效，请重新登录。"); };
    expect((await invoke({ body })).status).toBe(401);
    expect(calls).toHaveLength(0);
    dependencies.verifyToken = async () => { throw new Error("PRIVATE KEY secret token.a.b"); };
    const failure = await invoke({ body });
    expect(failure.status).toBe(500);
    expect(failure.raw).not.toMatch(/PRIVATE KEY|secret|token.a.b|stack/);
  });
});


test("maintenance blocks ordinary writes before credentials and still permits authenticated migration/read", async () => {
  const { invoke, calls, initialized, tokens } = fixture(() => true);
  for (const body of [
    { action: "start", issueId: "i1", rule: "simple" },
    { action: "cast", issueId: "i1", roundId: "r1", choice: "approve" },
    { action: "close", issueId: "i1", roundId: "r1" },
    { action: "cancel", issueId: "i1", roundId: "r1" },
    { action: "finish-legacy", issueId: "i1" },
    { action: "delete-meeting", meetingId: "m1" },
  ]) {
    const result = await invoke({ body });
    expect(result.status).toBe(503);
    expect(result.json.error.code).toBe("maintenance");
  }
  expect(initialized()).toBe(0);
  expect(calls).toHaveLength(0);
  expect((await invoke({ body: { action: "migrate-legacy", issueId: "i1" } })).status).toBe(200);
  expect((await invoke({ method: "GET", url: "/api/voting?action=my-ballot&issueId=i1&roundId=r1" })).status).toBe(200);
  expect(tokens).toEqual(["token.a.b", "token.a.b"]);
  expect(calls.map(call => call.method)).toEqual(["migrateLegacy", "myBallot"]);
});
