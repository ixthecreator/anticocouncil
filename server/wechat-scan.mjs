import { createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const failure = (message, status = 503) => Object.assign(new Error(message), { status });
const appIdPattern = /^wx[a-z0-9]{16}$/i;
const noncePattern = /^[a-f0-9]{64}$/;
const callbackPath = '/api/wechat-workbench';
const cookieName = '__Host-council-wechat-state';
const stateLifetime = 600;
const success = () => new Response('success', { headers: { 'Cache-Control': 'no-store' } });

export function createWechatScan(wxJson, env = process.env) {
 const appId = env.WECHAT_COMPONENT_APP_ID;
 const account = env.WECHAT_SCAN_ACCOUNT_ID || env.WECHAT_APP_ID;
 const aesKey = env.WECHAT_COMPONENT_AES_KEY;
 const origin = URL.parse(env.WECHAT_SCAN_ORIGIN || '');
 const redisOrigin = URL.parse(env.UPSTASH_REDIS_REST_URL || '');
 const configured = appIdPattern.test(appId || '') && appIdPattern.test(account || '')
  && Boolean(env.WECHAT_COMPONENT_APP_SECRET && env.WECHAT_COMPONENT_TOKEN && env.UPSTASH_REDIS_REST_TOKEN)
  && /^[A-Za-z0-9+/]{43}$/.test(aesKey || '') && origin?.protocol === 'https:'
  && redisOrigin?.protocol === 'https:' && redisOrigin.hostname.endsWith('.upstash.io') && !redisOrigin.username && !redisOrigin.password;
 const prefix = `council:wechat:${appId}:`;
 const bindingKey = 'binding:' + account;
 const ticketKey = 'ticket';

 async function command(parts) {
  try {
   const response = await fetch(redisOrigin.origin, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(6000),
    headers: { Authorization: 'Bearer ' + env.UPSTASH_REDIS_REST_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(parts),
   });
   const result = await response.json();
   if (!response.ok || result.error) throw new Error();
   return result.result;
  } catch {
   throw failure('公众号授权存储暂不可用，请稍后重试');
  }
 }
 async function read(key) {
  return JSON.parse(await command(['GET', prefix + key]) ?? 'null');
 }
 function write(key, value, options = []) {
  return command(['SET', prefix + key, JSON.stringify(value), ...options]);
 }
 function evaluate(script, keys, values) {
  return command(['EVAL', script, keys.length, ...keys.map(key => prefix + key), ...values]);
 }
 async function withLock(key, run) {
  const lockKey = 'lock:' + key;
  const claim = randomBytes(16).toString('hex');
  if (!await write(lockKey, claim, ['NX', 'EX', 55])) throw failure('微信授权正在更新，请稍后重试', 503);
  try {
   return await run();
  } finally {
   await evaluate('if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) end',
    [lockKey], [JSON.stringify(claim)]).catch(() => {});
  }
 }
 function cookie(value, maxAge) {
  return `${cookieName}=${value}; Max-Age=${maxAge}; Path=/; Secure; HttpOnly; SameSite=Lax`;
 }
 function assertSetup(request) {
  if (!configured || new URL(request.url).origin !== origin.origin) throw failure('站点尚未配置微信扫码，请联系管理员');
 }
 const fresh = value => value?.accessToken && value.expiresAt > Date.now();
 function credential(value, expiresIn) {
  if (typeof value !== 'string' || !value || !(Number(expiresIn) > 120)) throw failure('微信未返回有效授权令牌', 502);
  return { accessToken: value, expiresAt: Date.now() + (Number(expiresIn) - 120) * 1000 };
 }
 function platformRequest(path, body, token) {
  return wxJson(path, token ? { component_access_token: token } : {}, {
   method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
 }
 async function componentToken() {
  const cached = await read('component');
  if (fresh(cached)) return cached.accessToken;
  return withLock('component', async () => {
   const current = await read('component');
   if (fresh(current)) return current.accessToken;
   const ticket = await read(ticketKey);
   if (!ticket) throw failure('尚未收到微信开放平台推送的验证票据，请检查授权事件接收地址');
   const result = await platformRequest('component/api_component_token', {
    component_appid: appId, component_appsecret: env.WECHAT_COMPONENT_APP_SECRET, component_verify_ticket: ticket.value,
   });
   const next = credential(result.component_access_token, result.expires_in);
   await write('component', next, ['EX', Number(result.expires_in)]);
   return next.accessToken;
  });
 }
 async function replaceBinding(previous, next) {
  const written = await evaluate(
   'if (redis.call("GET", KEYS[1]) or "null") == ARGV[1] then redis.call("SET", KEYS[1], ARGV[2]); return 1 end return 0',
   [bindingKey], [JSON.stringify(previous), JSON.stringify(next)],
  );
  if (!written) throw failure('公众号授权已变更，请刷新后重试', 409);
 }
 async function accessToken(binding) {
  if (binding.revoked) throw failure('公众号授权已撤销，请由管理员重新扫码', 403);
  if (fresh(binding)) return binding.accessToken;
  return withLock(bindingKey, async () => {
   const current = await read(bindingKey);
   if (!current || current.revoked) throw failure('公众号授权已撤销，请由管理员重新扫码', 403);
   if (fresh(current)) return current.accessToken;
   const result = await platformRequest('component/api_authorizer_token', {
    component_appid: appId, authorizer_appid: account, authorizer_refresh_token: current.refreshToken,
   }, await componentToken());
   const next = { ...current, ...credential(result.authorizer_access_token, result.expires_in),
    refreshToken: result.authorizer_refresh_token || current.refreshToken };
   await replaceBinding(current, next);
   return next.accessToken;
  });
 }
 async function invalidate(binding, value) {
  const current = await read(bindingKey);
  if (!current || current.revoked || current.accessToken !== value || current.at !== binding.at) return;
  await replaceBinding(current, { ...current, expiresAt: 0 }).catch(() => {});
 }
 async function start(request) {
  assertSetup(request);
  const result = await platformRequest('component/api_create_preauthcode', { component_appid: appId }, await componentToken());
  if (typeof result.pre_auth_code !== 'string' || !result.pre_auth_code) throw failure('微信未返回预授权码', 502);
  const state = randomBytes(32).toString('hex');
  await write('state:' + state, { at: Date.now() }, ['EX', stateLifetime]);
  const callback = new URL(callbackPath, origin);
  callback.searchParams.set('state', state);
  const authorization = new URL('https://mp.weixin.qq.com/cgi-bin/componentloginpage');
  authorization.search = new URLSearchParams({
   component_appid: appId, pre_auth_code: result.pre_auth_code, redirect_uri: callback.href, biz_appid: account,
  }).toString();
  return Response.json({ authorizationUrl: authorization.href }, {
   headers: { 'Cache-Control': 'no-store', 'Set-Cookie': cookie(state, stateLifetime) },
  });
 }
 async function callback(request) {
  assertSetup(request);
  const query = new URL(request.url).searchParams;
  const state = query.get('state') || '';
  const expected = (request.headers.get('cookie') || '').match(/(?:^|;\s*)__Host-council-wechat-state=([a-f0-9]{64})(?:;|$)/)?.[1];
  const redirect = result => new Response(null, {
   status: 303,
   headers: {
    Location: new URL('/portal?workbench=1&wechat-scan=' + result + '#workbench-wechat', origin).href,
    'Set-Cookie': cookie('', 0), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
   },
  });
  if (!noncePattern.test(state) || state !== expected) return redirect('expired');
  try {
   const pending = JSON.parse(await command(['GETDEL', prefix + 'state:' + state]) ?? 'null');
   if (!pending) return redirect('expired');
   const code = query.get('auth_code') || '';
   if (!code) return redirect('cancelled');
   if (!/^[\x21-\x7e]{1,512}$/.test(code)) return redirect('failed');
   return await withLock(bindingKey, async () => {
    const previous = await read(bindingKey);
    if (previous?.at >= pending.at) return redirect('expired');
    const platformToken = await componentToken();
    const { authorization_info: info } = await platformRequest('component/api_query_auth', {
     component_appid: appId, authorization_code: code,
    }, platformToken);
    if (info?.authorizer_appid !== account || !info.authorizer_refresh_token) return redirect('account');
    const access = credential(info.authorizer_access_token, info.expires_in);
    const drafts = await wxJson('draft/batchget', { access_token: access.accessToken }, {
     method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ offset: 0, count: 1, no_content: 1 }),
    });
    if (!Array.isArray(drafts.item)) return redirect('failed');
    const details = await platformRequest('component/api_get_authorizer_info', {
     component_appid: appId, authorizer_appid: account,
    }, platformToken).catch(() => null);
    const accountName = typeof details?.authorizer_info?.nick_name === 'string' ? details.authorizer_info.nick_name.slice(0, 100) : '';
    await replaceBinding(previous, { ...access, account, accountName, refreshToken: info.authorizer_refresh_token, at: pending.at });
    return redirect('connected');
   });
  } catch (error) {
   return redirect(error.wechatCode === 48001 ? 'permission' : 'failed');
  }
 }
 async function event(request) {
  if (!configured) return new Response(null, { status: 503 });
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const query = new URL(request.url).searchParams;
  let message;
  try {
   message = decryptEvent(await request.text(), query, { appId, aesKey, token: env.WECHAT_COMPONENT_TOKEN });
  } catch {
   return new Response(null, { status: 403 });
  }
  try {
   const type = xmlValue(message, 'InfoType');
   const at = Number(xmlValue(message, 'CreateTime')) * 1000;
   if (!Number.isSafeInteger(at) || at <= 0 || at > Date.now() + 300000) return new Response(null, { status: 400 });
   if (type === 'component_verify_ticket') {
    const value = xmlValue(message, 'ComponentVerifyTicket');
    if (!value || value.length > 1024) return new Response(null, { status: 400 });
    await writeNewer(ticketKey, { value, at });
   }
   if (type === 'unauthorized' && xmlValue(message, 'AuthorizerAppid') === account) {
    await writeNewer(bindingKey, { account, revoked: true, at });
   }
   return success();
  } catch {
   return new Response(null, { status: 503 });
  }
 }
 function writeNewer(key, value) {
  return evaluate(
   'local old=redis.call("GET",KEYS[1]); if not old or cjson.decode(old).at <= tonumber(ARGV[1]) then return redis.call("SET",KEYS[1],ARGV[2]) end',
   [key], [value.at, JSON.stringify(value)],
  );
 }
 return {
  configured, start, callback, event, accessToken, invalidate,
  binding: () => configured ? read(bindingKey) : null,
 };
}

function xmlValue(xml, tag) {
 return xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[([^\\]]*)\\]\\]>|([^<]*))</${tag}>`))?.slice(1).find(value => value !== undefined) || '';
}

export function decryptEvent(xml, query, { appId, aesKey, token }) {
 if (xml.length > 65536 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error();
 const encoded = xmlValue(xml, 'Encrypt');
 const signature = query.get('msg_signature') || '';
 const timestamp = query.get('timestamp') || '';
 const nonce = query.get('nonce') || '';
 if (!/^[\w+/=]+$/.test(encoded) || !/^[a-f0-9]{40}$/.test(signature) || !/^\d{1,12}$/.test(timestamp) || !nonce || nonce.length > 128) throw new Error();
 const expected = createHash('sha1').update([token, timestamp, nonce, encoded].sort().join('')).digest();
 if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new Error();
 const key = Buffer.from(aesKey + '=', 'base64');
 const decipher = createDecipheriv('aes-256-cbc', key, key.subarray(0, 16));
 decipher.setAutoPadding(false);
 const bytes = Buffer.concat([decipher.update(Buffer.from(encoded, 'base64')), decipher.final()]);
 const padding = bytes.at(-1);
 const end = bytes.length - padding;
 if (padding < 1 || padding > 32 || end < 20 || bytes.subarray(end).some(byte => byte !== padding)) throw new Error();
 const messageEnd = 20 + bytes.readUInt32BE(16);
 if (messageEnd >= end || bytes.toString('utf8', messageEnd, end) !== appId) throw new Error();
 return bytes.toString('utf8', 20, messageEnd);
}
