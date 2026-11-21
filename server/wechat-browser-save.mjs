import { chromium } from 'playwright-core';
import { setTimeout as pause } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { requireMember } from './wechat-workbench.mjs';
import { WechatBrowser } from './wechat-browser-editor.mjs';

const origin = 'https://mp.weixin.qq.com';
const qrSelector = 'img.login__type__container__scan__qrcode';
const imageKey = /^\/uploads\/[a-f0-9-]+\.(?:png|jpg|webp)$/;
let executable;

async function launch() {
 if (process.platform !== 'linux') return chromium.launch({ channel: 'chrome', headless: true });
 const { default: serverChromium } = await import('@sparticuz/chromium');
 if (!executable) executable = serverChromium.executablePath().catch(error => {
  executable = undefined;
  throw error;
 });
 const args = serverChromium.args.filter(arg => !/^--(?:disable-web-security|allow-running-insecure-content)(?:=|$)/.test(arg));
 return chromium.launch({ executablePath: await executable, args, headless: true, timeout: 25000 });
}

function trustedWechatRequest(value) {
 const url = URL.parse(value);
 return url && (['data:', 'blob:', 'about:'].includes(url.protocol) ||
  (url.protocol === 'https:' && /(?:^|\.)(?:qq\.com|qpic\.cn|gtimg\.cn|gtimg\.com|weixin\.com)$/.test(url.hostname)));
}

function validate(input) {
 const { draft, images } = input || {};
 if (!draft || typeof draft.title !== 'string' || !draft.title.trim() || draft.title.length > 200 ||
  typeof draft.body !== 'string' || !draft.body.trim() || draft.body.length > 200000 || draft.wechatId || draft.richHtml) {
  throw Object.assign(Error('扫码存草稿适用于含标题和正文的本地新稿'), { status: 400 });
 }
 if (!images || typeof images !== 'object' || Object.keys(images).length > 24 ||
  Object.entries(images).some(([key, data]) => !imageKey.test(key) || typeof data !== 'string' ||
   !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data))) {
  throw Object.assign(Error('图片格式不受支持，请重新添加图片'), { status: 400 });
 }
 return { draft, images };
}

async function waitForLogin(page, send, signal) {
 const qr = page.locator(qrSelector);
 let shown = '';
 const deadline = Date.now() + 105000;
 while (Date.now() < deadline) {
  signal.throwIfAborted();
  const url = URL.parse(page.url());
  if (url?.origin !== origin) throw Error('微信登录页已离开官方地址');
  if (url.searchParams.has('token') && !/login/.test(url.pathname)) return;
  if (await qr.isVisible() && await qr.evaluate(image => image.complete && image.naturalWidth > 0)) {
   const code = await qr.screenshot({ timeout: 4000 });
   const digest = createHash('sha256').update(code).digest('hex');
   if (shown !== digest) {
    shown = digest;
    send({ type: 'qr', data: code.toString('base64') });
   }
  }
  await pause(1800, undefined, { signal });
 }
 throw Error(shown ? '扫码等待超时，请重新点击保存并扫描新二维码。' : '微信未显示扫码二维码，请稍后重试。');
}

function streamSave({ draft, images }, requestSignal) {
 const stop = new AbortController();
 const signal = AbortSignal.any([stop.signal, requestSignal]);
 const encode = new TextEncoder();
 return new ReadableStream({
  start(controller) {
   const send = value => { if (!signal.aborted) controller.enqueue(encode.encode(JSON.stringify(value) + '\n')); };
   void (async () => {
    let browser;
    const close = () => { void browser?.close().catch(() => {}); };
    signal.addEventListener('abort', close, { once: true });
    try {
     send({ type: 'status', message: '正在打开微信官方扫码页…' });
     browser = await launch();
     signal.throwIfAborted();
     const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', acceptDownloads: false });
     await context.route('**/*', route => trustedWechatRequest(route.request().url()) ? route.continue() : route.abort());
     const page = await context.newPage();
     await page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 25000 });
     await waitForLogin(page, send, signal);
     send({ type: 'status', message: '微信扫码成功，正在自动填稿并保存…' });
     const result = await new WechatBrowser(context, page, images).submit(draft);
     send({ type: 'saved', result });
    } catch (error) {
     if (!signal.aborted) {
      const message = String(error?.message || '');
      send({ type: 'error', message: /^[\u3400-\u9fff]/.test(message)
       ? message : '微信未确认保存。请先在公众号草稿箱核对，再决定是否重试。' });
     }
    } finally {
     signal.removeEventListener('abort', close);
     await browser?.close().catch(() => {});
     if (!signal.aborted) controller.close();
    }
   })();
  },
  cancel() { stop.abort(); },
 });
}

export async function handle(request) {
 const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
 const fail = (error, status) => Response.json({ error }, { status, headers });
 if (request.method !== 'POST') return fail('请求方式不受支持', 405);
 if (request.headers.get('origin') !== new URL(request.url).origin) return fail('请求来源不受支持', 403);
 if (!request.headers.get('content-type')?.startsWith('application/json')) return fail('需要 JSON 请求', 415);
 try {
  await requireMember(request);
  const input = validate(await request.json().catch(() => null));
  return new Response(streamSave(input, request.signal), {
   headers: { ...headers, 'Content-Type': 'application/x-ndjson; charset=utf-8' },
  });
 } catch (error) {
  return fail(error.status ? error.message : '站点无法启动微信扫码保存', error.status || 500);
 }
}
