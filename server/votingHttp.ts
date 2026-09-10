import type { IncomingMessage, ServerResponse } from "node:http";
import { VotingError, validVoteChoice, validVoteRule, validVotingId } from "./votingService";
import type { VotingIdentity, VotingService } from "./votingService";

export const MAX_VOTING_BODY_BYTES = 8192;

export interface VotingRequest extends IncomingMessage {
  body?: unknown;
}

export interface VotingHttpDependencies {
  service: VotingService;
  verifyToken(token: string): Promise<VotingIdentity>;
}

type VotingCommand =
  | { action: "start"; issueId: string; rule: "simple" | "absolute" }
  | { action: "cast"; issueId: string; roundId: string; choice: "approve" | "reject" | "abstain" }
  | { action: "close" | "cancel" | "my-ballot"; issueId: string; roundId: string }
  | { action: "delete-meeting"; meetingId: string }
  | { action: "migrate-legacy"; issueId: string; dryRun?: boolean }
  | { action: "finish-legacy"; issueId: string };

function invalidInput(message = "请求参数无效。请刷新页面后重试。"): never {
  throw new VotingError(400, "invalid-input", message);
}

function header(request: VotingRequest, name: string): string | undefined {
  const value = request.headers[name];
  if (Array.isArray(value)) return invalidInput();
  return value;
}

function checkBodySize(size: number) {
  if (size > MAX_VOTING_BODY_BYTES)
    throw new VotingError(413, "request-too-large", "请求内容过大。");
}

async function readJson(request: VotingRequest): Promise<Record<string, unknown>> {
  if (header(request, "content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json")
    throw new VotingError(415, "unsupported-media-type", "请求必须使用 JSON 格式。");
  const encoding = header(request, "content-encoding");
  if (encoding && encoding !== "identity")
    throw new VotingError(415, "unsupported-media-type", "不支持此请求编码。");
  const declaredSize = header(request, "content-length");
  if (declaredSize !== undefined) {
    if (!/^\d+$/.test(declaredSize)) invalidInput();
    checkBodySize(Number(declaredSize));
  }
  let parsed: unknown;
  if (request.body !== undefined && typeof request.body !== "string" && !Buffer.isBuffer(request.body)) {
    // Vercel may have already parsed req.body. Recheck its size before dispatch.
    let serialized: string;
    try { serialized = JSON.stringify(request.body); } catch { return invalidInput(); }
    if (serialized === undefined) return invalidInput();
    checkBodySize(Buffer.byteLength(serialized));
    parsed = request.body;
  } else {
    let raw: string;
    if (typeof request.body === "string" || Buffer.isBuffer(request.body)) {
      checkBodySize(Buffer.byteLength(request.body));
      raw = request.body.toString();
    } else {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.byteLength;
        checkBodySize(size);
        chunks.push(buffer);
      }
      raw = Buffer.concat(chunks).toString("utf8");
    }
    try { parsed = JSON.parse(raw); } catch { return invalidInput("请求不是有效的 JSON。"); }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return invalidInput();
  return parsed as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, required: string[], optional: string[] = []) {
  if (required.some((key) => !Object.prototype.hasOwnProperty.call(value, key)) ||
    Object.keys(value).some((key) => !required.includes(key) && !optional.includes(key))) invalidInput();
}

async function commandFrom(request: VotingRequest): Promise<VotingCommand> {
  const url = new URL(request.url || "/api/voting", "https://voting.invalid");
  if (request.method === "GET") {
    if (header(request, "transfer-encoding") || Number(header(request, "content-length") || 0) > 0)
      invalidInput();
    const keys = [...url.searchParams.keys()];
    if (new Set(keys).size !== keys.length) invalidInput();
    const input = Object.fromEntries(url.searchParams);
    exactKeys(input, ["action", "issueId", "roundId"]);
    if (input.action !== "my-ballot" || !validVotingId(input.issueId) || !validVotingId(input.roundId)) invalidInput();
    return { action: "my-ballot", issueId: input.issueId, roundId: input.roundId };
  }
  if (request.method !== "POST")
    throw new VotingError(405, "method-not-allowed", "只支持 GET 和 POST 请求。");
  if ([...url.searchParams].length) invalidInput();
  const input = await readJson(request);
  switch (input.action) {
    case "start":
      exactKeys(input, ["action", "issueId", "rule"]);
      if (!validVotingId(input.issueId) || !validVoteRule(input.rule)) invalidInput();
      return { action: input.action, issueId: input.issueId, rule: input.rule };
    case "cast":
      exactKeys(input, ["action", "issueId", "roundId", "choice"]);
      if (!validVotingId(input.issueId) || !validVotingId(input.roundId) || !validVoteChoice(input.choice)) invalidInput();
      return { action: input.action, issueId: input.issueId, roundId: input.roundId, choice: input.choice };
    case "close":
    case "cancel":
      exactKeys(input, ["action", "issueId", "roundId"]);
      if (!validVotingId(input.issueId) || !validVotingId(input.roundId)) invalidInput();
      return { action: input.action, issueId: input.issueId, roundId: input.roundId };
    case "delete-meeting":
      exactKeys(input, ["action", "meetingId"]);
      if (!validVotingId(input.meetingId)) invalidInput();
      return { action: input.action, meetingId: input.meetingId };
    case "migrate-legacy":
      exactKeys(input, ["action", "issueId"], ["dryRun"]);
      if (!validVotingId(input.issueId) || ("dryRun" in input && typeof input.dryRun !== "boolean")) invalidInput();
      return { action: input.action, issueId: input.issueId, ...(typeof input.dryRun === "boolean" ? { dryRun: input.dryRun } : {}) };
    case "finish-legacy":
      exactKeys(input, ["action", "issueId"]);
      if (!validVotingId(input.issueId)) invalidInput();
      return { action: input.action, issueId: input.issueId };
    default:
      return invalidInput("不支持此操作。");
  }
}

/** No CORS allowance: clients call the same-origin Vercel function with a Firebase ID token. */
export function createVotingHandler(
  getDependencies: () => Promise<VotingHttpDependencies> | VotingHttpDependencies,
  isMaintenance: () => boolean = () => false,
) {
  return async (request: VotingRequest, response: ServerResponse): Promise<void> => {
    response.setHeader("Cache-Control", "private, no-store, max-age=0");
    response.setHeader("Vercel-CDN-Cache-Control", "no-store");
    response.setHeader("Vary", "Authorization");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("X-Content-Type-Options", "nosniff");
    try {
      const command = await commandFrom(request);
      if (isMaintenance() && !["migrate-legacy", "my-ballot"].includes(command.action))
        throw new VotingError(503, "maintenance", "投票服务正在维护，暂不能提交或结束表决。请稍后重试。");
      const authorization = header(request, "authorization");
      if (!authorization || authorization.length > 16384 || !/^Bearer [A-Za-z0-9._-]+$/i.test(authorization))
        throw new VotingError(401, "unauthenticated", "请登录后重试。");
      const { service, verifyToken } = await getDependencies();
      const identity = await verifyToken(authorization.slice(7));
      let result: object;
      switch (command.action) {
        case "start": result = await service.start(identity, command); break;
        case "cast": result = await service.cast(identity, command); break;
        case "close": result = await service.close(identity, command); break;
        case "cancel": result = await service.cancel(identity, command); break;
        case "my-ballot": result = await service.myBallot(identity, command); break;
        case "delete-meeting": result = await service.deleteMeeting(identity, command); break;
        case "migrate-legacy": result = await service.migrateLegacy(identity, command); break;
        case "finish-legacy": result = await service.finishLegacy(identity, command); break;
      }
      response.statusCode = 200;
      response.end(JSON.stringify({ ok: true, ...result }));
    } catch (error) {
      // Never serialize SDK errors, request bodies, tokens, or credential/configuration values.
      const failure = error instanceof VotingError ? error :
        new VotingError(500, "internal-error", "操作未完成，请稍后重试。提交过的同一选票可以安全重试。");
      if (failure.status === 405) response.setHeader("Allow", "GET, POST");
      response.statusCode = failure.status;
      response.end(JSON.stringify({ ok: false, error: { code: failure.code, message: failure.message } }));
    }
  };
}
