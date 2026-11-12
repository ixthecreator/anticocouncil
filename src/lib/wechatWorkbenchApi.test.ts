import { afterEach, beforeEach, expect, test } from "bun:test";
import { OWNER_EMAIL } from "./accessPolicy";
import { handle } from "../../api/wechat-workbench.mjs";

const realFetch = globalThis.fetch;
let calls: { url: URL; body: unknown }[] = [];
let wechat: (url: URL, body: any) => unknown;

beforeEach(() => {
  calls = [];
  process.env.WECHAT_APP_ID = "wx-test";
  process.env.WECHAT_APP_SECRET = "secret";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
    calls.push({ url, body });
    if (url.hostname === "identitytoolkit.googleapis.com")
      return Response.json({ users: [{ emailVerified: true, email: OWNER_EMAIL, localId: "owner" }] });
    if (url.hostname === "api.weixin.qq.com") return Response.json(wechat(url, body));
    throw new Error(`unexpected request to ${url.hostname}`);
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

const request = (action: string, input = {}) =>
  handle(new Request("https://www.anticocouncil.com/api/wechat-workbench", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer id-token" },
    body: JSON.stringify({ action, input }),
  }));
const wechatCalls = () => calls.filter((call) => call.url.hostname === "api.weixin.qq.com");

test("access tokens come from stable_token, are reused, and are dropped once WeChat rejects them", async () => {
  let issued = 0;
  let reject = false;
  wechat = (url) => {
    if (url.pathname === "/cgi-bin/stable_token") return { access_token: `token-${++issued}`, expires_in: 7200 };
    if (url.pathname === "/cgi-bin/draft/batchget")
      return reject ? { errcode: 40001, errmsg: "invalid credential" } : { item: [], total_count: 0 };
    throw new Error(`unexpected WeChat path ${url.pathname}`);
  };

  expect((await request("wechat/check")).status).toBe(200);
  const [tokenCall] = wechatCalls();
  expect(tokenCall.url.pathname).toBe("/cgi-bin/stable_token");
  // The secret travels in the POST body, not in the query string.
  expect(tokenCall.url.search).toBe("");
  expect(tokenCall.body).toEqual({ grant_type: "client_credential", appid: "wx-test", secret: "secret", force_refresh: false });

  expect((await request("wechat/draft/list")).status).toBe(200);
  expect(issued).toBe(1);
  expect(wechatCalls().at(-1)?.url.searchParams.get("access_token")).toBe("token-1");

  reject = true;
  expect((await request("wechat/draft/list")).status).toBe(502);
  reject = false;
  expect((await request("wechat/draft/list")).status).toBe(200);
  expect(issued).toBe(2);
  expect(wechatCalls().at(-1)?.url.searchParams.get("access_token")).toBe("token-2");
});
