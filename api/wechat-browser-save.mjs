import { serveNode } from '../server/node-response.mjs';

export default (request, response) => serveNode(request, response, async () =>
 (await import('../server/wechat-browser-save.mjs')).handle);
