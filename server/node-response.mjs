const maxBody = 4_400_000;

export async function serveNode(request, response, loadHandler) {
 try {
  const method = request.method || 'GET';
  const protocol = request.socket?.encrypted || request.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const origin = protocol + '://' + request.headers.host;
  const url = new URL(request.url || '/', origin);
  if (url.origin !== origin) {
   response.writeHead(400, { 'Cache-Control': 'no-store' }).end();
   return;
  }
  const init = { method, headers: request.headers };
  if (method !== 'GET' && method !== 'HEAD') {
   let body = request.body;
   if (body === undefined) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
     const bytes = Buffer.from(chunk);
     size += bytes.length;
     if (size > maxBody) break;
     chunks.push(bytes);
    }
    if (size > maxBody) {
     response.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify({ error: '请求内容过大' }));
     return;
    }
    body = Buffer.concat(chunks);
   }
   init.body = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  }
  const handler = await loadHandler();
  const result = await handler(new Request(url, init));
  response.writeHead(result.status, Object.fromEntries(result.headers));
  response.end(Buffer.from(await result.arrayBuffer()));
 } catch (error) {
  console.error('WeChat workbench handler failed:', error?.code || error?.name);
  if (!response.headersSent) response.writeHead(503, {
   'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '3',
  });
  response.end(JSON.stringify({ error: '站点连接服务正在恢复，请稍后重试' }));
 }
}
