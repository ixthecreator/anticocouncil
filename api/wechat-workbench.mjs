import { serveNode } from '../server/node-response.mjs';

const load = () => import('../server/wechat-workbench.mjs');
export const handle = async request => (await load()).handle(request);
export default (request, response) => serveNode(request, response, async () => (await load()).handle);
