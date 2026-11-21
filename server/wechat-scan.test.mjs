import { createCipheriv, createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWechatScan } from './wechat-scan.mjs';

test('encrypted WeChat event, one-time callback, account restriction and revocation', async () => {
 const origin = 'https://council.example';
 const account = 'wx0000000000000001';
 const appId = 'wx0000000000000002';
 const key = Buffer.alloc(32, 3);
 const verifyToken = 'fixture-verify';
 const store = new Map();
 const env = {
  WECHAT_COMPONENT_APP_ID: appId, WECHAT_SCAN_ACCOUNT_ID: account, WECHAT_SCAN_ORIGIN: origin,
  WECHAT_COMPONENT_APP_SECRET: 'fixture-secret', WECHAT_COMPONENT_TOKEN: verifyToken,
  WECHAT_COMPONENT_AES_KEY: key.toString('base64').slice(0, -1),
  UPSTASH_REDIS_REST_URL: 'https://fixture.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'fixture-redis',
 };
 const originalFetch = globalThis.fetch;
 globalThis.fetch = async (url, options) => {
  assert.equal(url, env.UPSTASH_REDIS_REST_URL);
  const [operation, k, value, ...args] = JSON.parse(options.body);
  let result;
  if (operation === 'GET') result = store.get(k) ?? null;
  if (operation === 'GETDEL') {
   result = store.get(k) ?? null;
   store.delete(k);
  }
  if (operation === 'SET') {
   result = args.includes('NX') && store.has(k) ? null : 'OK';
   if (result) store.set(k, value);
  }
  if (operation === 'EVAL') {
   assert.equal(value, 1);
   const [redisKey, before, after] = args;
   const current = store.get(redisKey);
   if (k.includes('DEL')) result = current === before ? Number(store.delete(redisKey)) : 0;
   else if (k.includes('cjson')) {
    if (!current || JSON.parse(current).at <= Number(before)) store.set(redisKey, after);
    result = 'OK';
   } else {
    result = Number((current ?? 'null') === before);
    if (result) store.set(redisKey, after);
   }
  }
  assert.notEqual(result, undefined, operation);
  return Response.json({ result });
 };
 let selected = 'wx0000000000000009';
 let exchanges = 0;
 const scan = createWechatScan(async (path, params, options) => {
  const input = JSON.parse(options.body);
  switch (path) {
   case 'component/api_component_token':
    assert.equal(input.component_verify_ticket, 'ticket-value');
    return { component_access_token: 'component-token', expires_in: 7200 };
   case 'component/api_create_preauthcode': return { pre_auth_code: 'preauth-code' };
   case 'component/api_query_auth':
    exchanges++;
    assert.equal(input.authorization_code, 'queryauthcode@@@sample');
    return { authorization_info: { authorizer_appid: selected, authorizer_access_token: 'access-token',
     authorizer_refresh_token: 'refresh-token', expires_in: 7200 } };
   case 'draft/batchget':
    assert.equal(params.access_token, 'access-token');
    return { item: [] };
   case 'component/api_get_authorizer_info': return { authorizer_info: { nick_name: '议会测试号' } };
   case 'component/api_authorizer_token':
    assert.equal(input.authorizer_refresh_token, 'refresh-token');
    return { authorizer_access_token: 'refreshed-token', expires_in: 7200 };
   default: assert.fail(path);
  }
 }, env);
 function event(type, seconds, content, badSignature = false) {
  const xml = Buffer.from(`<xml><InfoType>${type}</InfoType><CreateTime>${seconds}</CreateTime>${content}</xml>`);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(xml.length);
  const data = Buffer.concat([Buffer.alloc(16), length, xml, Buffer.from(appId)]);
  const padding = 32 - data.length % 32;
  const cipher = createCipheriv('aes-256-cbc', key, key.subarray(0, 16));
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(Buffer.concat([data, Buffer.alloc(padding, padding)])), cipher.final()]).toString('base64');
  const timestamp = String(seconds);
  const nonce = 'fixture';
  const signature = createHash('sha1').update([verifyToken, timestamp, nonce, encrypted].sort().join('')).digest('hex');
  const url = new URL('/api/wechat-component-events', origin);
  url.search = new URLSearchParams({ timestamp, nonce, msg_signature: badSignature ? '0'.repeat(40) : signature });
  return scan.event(new Request(url, { method: 'POST', body: `<xml><Encrypt><![CDATA[${encrypted}]]></Encrypt></xml>` }));
 }
 async function authorization() {
  const response = await scan.start(new Request(origin));
  const { authorizationUrl } = await response.json();
  const url = new URL(authorizationUrl);
  assert.equal(url.hostname, 'mp.weixin.qq.com');
  assert.equal(url.searchParams.get('biz_appid'), account);
  const callback = new URL(url.searchParams.get('redirect_uri'));
  callback.searchParams.set('auth_code', 'queryauthcode@@@sample');
  const cookie = response.headers.get('set-cookie').split(';')[0];
  return { callback, cookie };
 }
 const seconds = Math.floor(Date.now() / 1000);
 try {
  assert.equal((await event('component_verify_ticket', seconds, '', true)).status, 403);
  assert.equal((await event('component_verify_ticket', seconds, '<ComponentVerifyTicket>ticket-value</ComponentVerifyTicket>')).status, 200);
  const wrong = await authorization();
  assert.match((await scan.callback(new Request(wrong.callback))).headers.get('location'), /wechat-scan=expired/);
  assert.equal(exchanges, 0);
  assert.match((await scan.callback(new Request(wrong.callback, { headers: { cookie: wrong.cookie } }))).headers.get('location'), /wechat-scan=account/);
  assert.equal(await scan.binding(), null);
  selected = account;
  const right = await authorization();
  const callback = new Request(right.callback, { headers: { cookie: right.cookie } });
  assert.match((await scan.callback(callback)).headers.get('location'), /wechat-scan=connected#workbench-wechat$/);
  assert.match((await scan.callback(callback)).headers.get('location'), /wechat-scan=expired/);
  assert.equal(exchanges, 2);
  const binding = await scan.binding();
  assert.equal(binding.accountName, '议会测试号');
  await scan.invalidate(binding, 'access-token');
  assert.equal(await scan.accessToken(await scan.binding()), 'refreshed-token');
  await event('unauthorized', seconds - 60, `<AuthorizerAppid>${account}</AuthorizerAppid>`);
  assert.equal((await scan.binding()).revoked, undefined);
  await event('unauthorized', seconds + 1, `<AuthorizerAppid>${account}</AuthorizerAppid>`);
  await assert.rejects(scan.accessToken(await scan.binding()), /授权已撤销/);
 } finally {
  globalThis.fetch = originalFetch;
 }
});
