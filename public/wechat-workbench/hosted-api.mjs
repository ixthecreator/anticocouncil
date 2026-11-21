import { referenceAssetUrls } from './reference-layout.mjs';
import { sanitizeWechatHtml } from './wechat-html.mjs';
import { fitImage, imageDigest, wechatImageLimits } from './image-fit.mjs';

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

function parentSession(token = false, refresh = false){
 if(window.parent===window)return Promise.resolve({scope:'local'});
 const channel = new MessageChannel();
 return new Promise(resolve=>{
  const done=result=>{clearTimeout(timeout);channel.port1.close();resolve(result);};
  const timeout=setTimeout(()=>done({scope:'local'}),token?10000:2000);
  channel.port1.onmessage=event=>done(event.data||{scope:'local'});
  window.parent.postMessage({type:'antico:wechat-session',token,refresh},location.origin,[channel.port2]);
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

const retryableActions=new Set(['settings','wechat/check','wechat/draft/list','wechat/draft/read']);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function saveDraftByScan(draft,onEvent,signal){
 const {scope}=await database();
 const session=await parentSession(true);
 if(!session.token||session.scope!==scope)throw Error('请先登录议会成员工作区。');
 const sources=new Set([...draft.body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(match=>match[1]));
 for(const asset of referenceAssetUrls(draft))if(!Object.hasOwn(builtinImages,asset))sources.add(asset);
 if(draft.cover)sources.add(draft.cover);
 const images={};
 for(const source of sources){
  signal.throwIfAborted();
  images[source]=await fitImage(storedImage(source),wechatImageLimits.body);
 }
 const body=JSON.stringify({draft,images});
 if(new TextEncoder().encode(body).length>4_300_000)throw Error('这篇稿件的图片总量过大，请缩小图片后重试。');
 const response=await fetch('/api/wechat-browser-save',{
  method:'POST',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json'},body,signal,
 });
 if(!response.ok){
  const error=await response.json().catch(()=>null);
  throw Error(error?.error||'微信扫码服务暂不可用');
 }
 const reader=response.body.pipeThrough(new TextDecoderStream()).getReader();
 let partial='';
 try{
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   partial+=value;
   const lines=partial.split('\n');
   partial=lines.pop();
   for(const line of lines){
    const event=JSON.parse(line);
    if(event.type==='saved'&&event.result?.ok===true)return event.result;
    if(event.type==='error')throw Error(event.message);
    onEvent(event);
   }
  }
  throw Error('微信连接已中断，请先检查草稿箱再重试。');
 }finally{await reader.cancel().catch(()=>{});}
}

async function hosted(action,input){
 const {scope}=await database();
 if(scope==='local')throw Object.assign(Error('请进入议会成员工作区使用公众号或 AI 服务'),{status:401});
 const retryable=retryableActions.has(action);
 let session=await parentSession(true);
 for(let attempt=0;;attempt++){
  if(!session.token||scope!==session.scope)throw Object.assign(Error('请重新登录议会成员工作区后连接公众号'),{status:401});
  const response=await fetch('/api/wechat-workbench',{
   method:'POST',headers:{Authorization:'Bearer '+session.token,'Content-Type':'application/json'},
   body:JSON.stringify({action,input}),signal:AbortSignal.timeout(retryable?10000:65000),
  }).catch(()=>null);
  const result=await response?.json().catch(()=>null);
  if(response?.ok&&result)return result;
  if(response?.status===401&&attempt===0&&retryable){
   session=await parentSession(true,true);
   continue;
  }
  const temporary=!response||(!result&&response.status>=500)||[502,504].includes(response.status)||response.headers.has('Retry-After');
  if(temporary&&retryable&&attempt<2){await pause(700*(attempt+1));continue;}
  throw Object.assign(Error(result?.error||(temporary?'暂时无法连接，可以重试。':`连接失败（${response.status}）`)),
   {status:response?.status||503,temporary});
 }
}

async function configuration(reconnect=false){
 if(reconnect)hostedConfiguration=undefined;
 if(!hostedConfiguration)hostedConfiguration=hosted('settings',{}).catch(error=>{
  hostedConfiguration=undefined;return {connectionError:error.message,connectionStatus:error.status};
 });
 return hostedConfiguration;
}

// Uploads one local image to the official account, or reuses the address WeChat
// gave the same image before. Body image URLs and cover materials are permanent,
// so repeat saves of a draft send only what changed. The cache is per browser
// profile, member and official account.
async function wechatAsset(db,account,kind,src,used){
 const data=storedImage(src);
 const key='wechat-upload:'+account+':'+kind+':'+await imageDigest(data);
 const cached=await storeRequest(db,'readonly',entries=>entries.get(key));
 if(typeof cached==='string'&&cached){used.push(key);return cached;}
 const result=await hosted('asset',{cover:kind==='cover',data:await fitImage(data,wechatImageLimits[kind])});
 const value=kind==='cover'?result.mediaId:result.url;
 await storeRequest(db,'readwrite',entries=>entries.put(value,key));
 return value;
}

async function sendDraft(draft,retried=false){
 const {db}=await database();
 const account=(await configuration()).appId||'default';
 const rich=typeof draft.richHtml==='string';
 const sources=new Set(rich?(draft.richDirty?sanitizeWechatHtml(draft.richHtml,document).localImages:[])
  :[...draft.body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(match=>match[1]));
 for(const src of referenceAssetUrls(draft))if(assets.has(src))sources.add(src);
 const uploaded={};
 const used=[];
 let coverMediaId='';
 if(draft.cover)coverMediaId=await wechatAsset(db,account,'cover',draft.cover,used);
 for(const src of sources)uploaded[src]=await wechatAsset(db,account,'body',src,used);
 try{
  return await hosted('wechat/draft',{draft,uploaded,coverMediaId});
 }catch(error){
  // 40007: WeChat no longer has a remembered material (deleted in the official
  // account backend). Forget what was reused and upload again, once.
  if(retried||!used.length||!/40007/.test(error.message))throw error;
  for(const key of used)await storeRequest(db,'readwrite',entries=>entries.delete(key));
  return sendDraft(draft,true);
 }
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
  const remote=await configuration(body?.reconnect===true);
  return {...userOptions,model:userOptions.model||remote.model||'deepseek-flash',appId:remote.appId||'',wechatMode:'api',
   wechatConnected:remote.wechatConnected,wechatRevoked:remote.wechatRevoked,wechatAccountName:remote.wechatAccountName,
   wechatScanConfigured:remote.wechatScanConfigured,canConnectWechat:remote.canConnectWechat,
   connectionError:remote.connectionError,connectionStatus:remote.connectionStatus,
   configured:{appSecret:Boolean(remote.appId),key:Boolean(credentials.key||remote.modelConfigured),searchKey:Boolean(credentials.searchKey)}};
 }
 if(path==='wechat/draft')return sendDraft(body);
 if(path==='chat'||path==='search'||path==='editor/reference-plan'){
  const preferences=path==='editor/reference-plan'?await storeRequest(db,'readonly',entries=>entries.get('editor/preferences')):null;
  return hosted(path,{...body,...userOptions,...credentials,rules:preferences?.rules});
 }
 return hosted(path,body||{});
}
