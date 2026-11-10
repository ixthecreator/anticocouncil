import { referenceAssetUrls } from './reference-layout.mjs';
import { sanitizeWechatHtml } from './wechat-html.mjs';

export const builtinImages = {
 '/reference/opening-04333e81.gif':'https://mmbiz.qpic.cn/mmbiz_gif/pbSZFRcB05gaVKicpztFy0SjJrdPNzsOQiaj1nEViaTHa9X77wnSC82XcyWwvWhVQoZQI3FQ2wrmMr4BvBCW6C7ZA/640?wx_fmt=gif',
 '/reference/lead-d9462ba1.png':'https://mmbiz.qpic.cn/sz_mmbiz_png/h1IQ9EJX1rn6wwHCsWMaicYHEHva3QZOqibltYDrDNzU6Kyp1cPYk6ibc6Ux2JlnaZFmcGRksLzH28SjyBPygY8zhyrDic0g5mBgelq5Jq2ib2Bs/640?wx_fmt=png&from=appmsg',
};
const assets = new Map();
const displays = new Map();
const canonical = new Map();
let ready;
let credentials = {};
let userOptions = {provider:'deepseek',baseURL:'https://api.deepseek.com',model:''};
let hostedConfiguration;

function parentSession(token = false){
 if(window.parent===window)return Promise.resolve({scope:'local'});
 const channel = new MessageChannel();
 return new Promise(resolve=>{
  const done=result=>{clearTimeout(timeout);channel.port1.close();resolve(result);};
  const timeout=setTimeout(()=>done({scope:'local'}),token?10000:2000);
  channel.port1.onmessage=event=>done(event.data||{scope:'local'});
  window.parent.postMessage({type:'antico:wechat-session',token},location.origin,[channel.port2]);
 });
}

function openStore(scope){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open('antico-wechat-workbench:'+scope,1);
  request.onupgradeneeded=()=>request.result.createObjectStore('entries');
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>resolve(request.result);
 });
}
async function storeRequest(db,mode,action){
 const transaction=db.transaction('entries',mode);
 return new Promise((resolve,reject)=>{
  const request=action(transaction.objectStore('entries'));
  transaction.oncomplete=()=>resolve(request.result);
  transaction.onerror=()=>reject(transaction.error||request.error);
  transaction.onabort=()=>reject(transaction.error||Error('浏览器未保存这次修改'));
 });
}
function register(url,data){
 const [header,bytes]=data.split(',',2);
 const mime=header.slice(5,header.indexOf(';'));
 const blob=new Blob([Uint8Array.from(atob(bytes),char=>char.charCodeAt(0))],{type:mime});
 const display=URL.createObjectURL(blob);
 assets.set(url,data);displays.set(url,display);canonical.set(display,url);
}
async function initialize(){
 const {scope}=await parentSession();
 const db=await openStore(scope);
 const stored=await storeRequest(db,'readonly',entries=>entries.getAll(IDBKeyRange.bound('asset:','asset:\uffff')));
 for(const item of stored)register(item.url,item.data);
 userOptions={...userOptions,...await storeRequest(db,'readonly',entries=>entries.get('settings'))};
 return {db,scope};
}
function database(){return ready??=initialize();}

export function displayImage(url){
 return displays.get(url)||(Object.hasOwn(builtinImages,url)?builtinImages[url]:url==='/sample.svg'?'/wechat-workbench/sample.svg':url);
}
export function displayMarkup(html){
 return html.replace(/(\bsrc="|\burl\(')(\/uploads\/[a-f0-9-]+\.(?:png|jpg|webp|gif)|\/reference\/(?:opening-04333e81\.gif|lead-d9462ba1\.png)|\/sample\.svg)(["'])/g,
  (_,before,url,after)=>before+displayImage(url).replaceAll('&','&amp;')+after);
}
export function canonicalMarkup(html){
 return html.replace(/blob:[^"'\s<>]+/g,url=>canonical.get(url)||url);
}
export function storedImage(url){
 if(!assets.has(url))throw Error('找不到本地图片，请重新添加图片');
 return assets.get(url);
}

async function hosted(action,input){
 const {scope}=await database();
 if(scope==='local')throw Object.assign(Error('请进入议会成员工作区使用公众号或 AI 服务'),{status:401});
 const session=await parentSession(true);
 if(!session.token||scope!==session.scope)throw Object.assign(Error('请在议会成员工作区登录后使用公众号或 AI 服务'),{status:401});
 const response=await fetch('/api/wechat-workbench',{
  method:'POST',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json'},
  body:JSON.stringify({action,input}),signal:AbortSignal.timeout(65000),
 });
 const result=await response.json().catch(()=>({error:'站点服务暂不可用，请稍后重试'}));
 if(!response.ok)throw Object.assign(Error(result.error||'请求失败'),{status:response.status});
 return result;
}

async function configuration(){
 if(!hostedConfiguration)hostedConfiguration=hosted('settings',{}).catch(()=>{
  hostedConfiguration=undefined;return {};
 });
 return hostedConfiguration;
}

async function sendDraft(draft){
 const rich=typeof draft.richHtml==='string';
 const sources=new Set(rich?(draft.richDirty?sanitizeWechatHtml(draft.richHtml,document).localImages:[])
  :[...draft.body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(match=>match[1]));
 for(const src of referenceAssetUrls(draft))if(assets.has(src))sources.add(src);
 const uploaded={};
 let coverMediaId='';
 if(draft.cover)coverMediaId=(await hosted('asset',{cover:true,data:storedImage(draft.cover)})).mediaId;
 for(const src of sources)uploaded[src]=(await hosted('asset',{data:storedImage(src)})).url;
 return hosted('wechat/draft',{draft,uploaded,coverMediaId});
}

export async function api(path,body){
 const {db}=await database();
 if(path==='drafts'||path==='editor/preferences'){
  if(body===undefined)return await storeRequest(db,'readonly',entries=>entries.get(path))||(path==='drafts'?[]:{});
  await storeRequest(db,'readwrite',entries=>entries.put(path==='drafts'?body.drafts:body,path));
  return path==='drafts'?{ok:true}:body;
 }
 if(path==='upload'){
  const match=String(body.data).match(/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
  if(!match)throw Error('支持 JPG、PNG、WebP、GIF');
  if(match[2].length>7_000_000)throw Error('图片请控制在 5 MB 以内');
  const url='/uploads/'+crypto.randomUUID()+'.'+(match[1]==='jpeg'?'jpg':match[1]);
  await storeRequest(db,'readwrite',entries=>entries.put({url,data:body.data},'asset:'+url));
  register(url,body.data);
  return {url};
 }
 if(path==='settings'){
  if(body){
   for(const key of ['key','searchKey'])if(body[key])credentials[key]=body[key];
   for(const key of body.clearSecrets||[])delete credentials[key];
   if(typeof body.model==='string')userOptions.model=body.model.trim();
   await storeRequest(db,'readwrite',entries=>entries.put(userOptions,'settings'));
  }
  const remote=await configuration();
  return {...userOptions,model:userOptions.model||remote.model||'deepseek-flash',appId:remote.appId||'',wechatMode:'api',
   configured:{appSecret:Boolean(remote.appId),key:Boolean(credentials.key||remote.modelConfigured),searchKey:Boolean(credentials.searchKey)}};
 }
 if(path==='wechat/draft')return sendDraft(body);
 if(path==='chat'||path==='search'||path==='editor/reference-plan'){
  const preferences=path==='editor/reference-plan'?await storeRequest(db,'readonly',entries=>entries.get('editor/preferences')):null;
  return hosted(path,{...body,...userOptions,...credentials,rules:preferences?.rules});
 }
 return hosted(path,body||{});
}
