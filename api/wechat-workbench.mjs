import { Window } from 'happy-dom';
import fallbackFirebase from '../firebase-applet-config.json' with { type: 'json' };
import { OWNER_EMAIL } from '../src/lib/accessPolicy.ts';
import { render, esc } from '../public/wechat-workbench/render.mjs';
import { referenceAssetUrls, referenceLines, referencePrompt, parseReferencePlan } from '../public/wechat-workbench/reference-layout.mjs';
import { normalizePreferences } from '../public/wechat-workbench/editor-options.mjs';
import { sanitizeWechatHtml, wechatImageURL } from '../public/wechat-workbench/wechat-html.mjs';
import { draftRevision, verifyRevision, wechatArticleIndex, buildWechatArticle } from '../public/wechat-workbench/wechat-revision.mjs';
import { builtinImages } from '../public/wechat-workbench/hosted-api.mjs';

const wxHost='https://api.weixin.qq.com';
const modelHost='https://api.deepseek.com';
const imagePath=/^\/uploads\/[a-f0-9-]+\.(?:png|jpg|webp)$/;
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(body,status=200)=>Response.json(body,{status,headers});
const post=(body,key)=>({method:'POST',headers:{'Content-Type':'application/json',...(key?{Authorization:'Bearer '+key}:{})},body:JSON.stringify(body)});
const sameOrigin=(request,url)=>!request.headers.get('origin')||request.headers.get('origin')===url.origin;

async function responseJson(url,options,timeout=25000){
 let response;
 try{response=await fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(timeout)});}
 catch{throw fail('外部服务连接失败或超时，请稍后重试',502);}
 return [response,await response.json().catch(()=>null)];
}

async function requireMember(request){
 const token=request.headers.get('authorization')?.match(/^Bearer ([\w.-]{1,8192})$/)?.[1];
 if(!token)throw fail('请登录议会成员工作区',401);
 const config={
  apiKey:process.env.VITE_FIREBASE_API_KEY||fallbackFirebase.apiKey,
  project:process.env.VITE_FIREBASE_PROJECT_ID||fallbackFirebase.projectId,
  database:process.env.VITE_FIREBASE_DATABASE_ID||fallbackFirebase.firestoreDatabaseId,
 };
 const [response,info]=await responseJson('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(config.apiKey),post({idToken:token}));
 const user=info?.users?.[0];
 if(!response.ok||!user?.emailVerified||!user.email||!user.localId||user.disabled)throw fail('请重新登录并验证邮箱',401);
 if(user.email===OWNER_EMAIL)return;
 const firestore='https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(config.project)+'/databases/'+encodeURIComponent(config.database)+'/documents/workspaceAccess/'+encodeURIComponent(user.localId);
 const [accessResponse,access]=await responseJson(firestore,{headers:{Authorization:'Bearer '+token}});
 const fields=access?.fields;
 if(!accessResponse.ok||!fields?.active?.booleanValue||fields.email?.stringValue!==user.email||!['member','admin'].includes(fields.role?.stringValue)){
  throw fail('此账号暂无议会成员权限',403);
 }
}

function wxConfig(){
 const account=process.env.WECHAT_APP_ID;
 const secret=process.env.WECHAT_APP_SECRET;
 if(!account||!secret)throw fail('公众号尚未连接，请联系站点管理员配置',503);
 return {account,secret};
}
async function wxJson(path,params,options){
 const url=new URL('/cgi-bin/'+path,wxHost);
 for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
 const [response,result]=await responseJson(url,options);
 if(result?.errcode===40164)throw fail('公众号拒绝站点出口 IP，请管理员检查微信 IP 白名单',503);
 if(result?.errcode===48001)throw fail('该公众号当前没有所需的草稿或素材接口权限',403);
 if(!response.ok||!result||result.errcode)throw fail('微信接口请求失败'+(result?.errcode?'（'+Number(result.errcode)+'）':''),502);
 return result;
}
let token;
async function wxToken({account,secret}){
 if(token?.account===account&&token.expiry>Date.now())return token.value;
 const result=await wxJson('token',{grant_type:'client_credential',appid:account,secret});
 if(typeof result.access_token!=='string')throw fail('微信未返回访问令牌',502);
 token={account,value:result.access_token,expiry:Date.now()+Math.max(0,Number(result.expires_in)-120)*1000};
 return token.value;
}
function draftRequest(action,accessToken,input){
 return wxJson('draft/'+action,{access_token:accessToken},post(input));
}
async function readDraft(id,accessToken){
 if(typeof id!=='string'||!id||id.length>512)throw fail('微信草稿编号无效');
 const {news_item:articles}=await draftRequest('get',accessToken,{media_id:id});
 if(!Array.isArray(articles))throw fail('微信未返回可编辑的文章',502);
 return {articles,revision:draftRevision(articles)};
}
async function listDrafts(input,account,accessToken){
 const offset=input.offset??0;
 if(!Number.isSafeInteger(offset)||offset<0)throw fail('草稿分页参数无效');
 const result=await draftRequest('batchget',accessToken,{offset,count:10,no_content:0});
 if(!Array.isArray(result.item))throw fail('微信没有返回可读取的草稿列表',502);
 const items=result.item.filter(item=>typeof item.media_id==='string').map(item=>({
  id:item.media_id,updated:Number(item.update_time)||0,
  articles:(item.content?.news_item||[]).map(article=>({title:article.title||'未命名文章',author:article.author||''})),
 }));
 const total=Number(result.total_count)||0,next=offset+result.item.length;
 return {items,account,offset,next:next>offset&&next<total?next:null,total};
}
function clean(markup){
 const window=new Window({settings:{disableJavaScriptEvaluation:true,disableJavaScriptFileLoading:true,disableCSSFileLoading:true,disableIframePageLoading:true}});
 try{return sanitizeWechatHtml(markup,window.document);}finally{window.close();}
}
async function asset(input,accessToken){
 const image=String(input.data).match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
 if(!image||image[2].length>3_500_000)throw fail('微信图片须为 JPG、PNG 或 WebP，并控制在 2.5 MB 以内');
 const mime='image/'+image[1];
 const bytes=Buffer.from(image[2],'base64');
 const form=new FormData();
 form.append('media',new Blob([bytes],{type:mime}),'image.'+(image[1]==='jpeg'?'jpg':image[1]));
 const cover=input.cover===true;
 const result=await wxJson(cover?'material/add_material':'media/uploadimg',
  cover?{access_token:accessToken,type:'image'}:{access_token:accessToken},{method:'POST',body:form});
 if(cover&&result.media_id)return {mediaId:result.media_id};
 if(!cover&&wechatImageURL(result.url))return {url:result.url};
 throw fail('微信没有返回图片素材编号或地址',502);
}

let writing=false;
async function saveDraft(input,account,accessToken){
 const {draft,uploaded={},coverMediaId}=input;
 if(!draft||typeof draft.title!=='string'||!draft.title.trim()||typeof draft.body!=='string'||(!draft.body.trim()&&!draft.richHtml))throw fail('请填写标题和正文');
 if(writing)throw fail('正在保存微信草稿，请稍后重试',409);
 writing=true;
 try{
  const index=wechatArticleIndex(draft.wechatIndex);
  if(!draft.wechatId&&index!==0)throw fail('新草稿不能指定已有图文位置');
  const checkVersion=async()=>{
   if(!draft.wechatId)return null;
   if(draft.wechatAccount!==account)throw fail('稿件绑定了另一个公众号',409);
   const result=await readDraft(draft.wechatId,accessToken);
   verifyRevision(draft,account,result.revision);
   if(!result.articles[index])throw fail('这篇图文的位置已变更，请重新读取',409);
   return result.articles[index];
  };
  const original=await checkVersion();
  const cover=typeof coverMediaId==='string'&&coverMediaId.length<=512&&coverMediaId||original?.thumb_media_id;
  if(!cover)throw fail('请上传封面，或使用带封面的微信草稿');
  let html;
  let images=[];
  if(typeof draft.richHtml==='string'){
   if(original&&!draft.richDirty)html=original.content;
   else{
    if(original&&clean(original.content).unsupported)throw fail('微信原稿含专属组件，请在公众号后台编辑正文');
    const result=clean(draft.richHtml);
    if(!result.text&&!result.media)throw fail('请填写正文');
    html=result.html;images=result.localImages;
   }
  }else{
   html=render(draft);
   const sources=new Set([...draft.body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(match=>match[1]));
   for(const src of referenceAssetUrls(draft))if(html.includes(src))sources.add(src);
   images=[...sources];
  }
  for(const src of images){
   const url=Object.hasOwn(builtinImages,src)?builtinImages[src]:imagePath.test(src)&&wechatImageURL(uploaded[src]);
   if(!url)throw fail('正文图片需要先上传到微信素材');
   html=html.replaceAll(src,esc(url));
  }
  const article=buildWechatArticle(draft,original,html,cover);
  if(draft.wechatId)await checkVersion();
  const result=await draftRequest(draft.wechatId?'update':'add',accessToken,draft.wechatId
   ?{media_id:draft.wechatId,index,articles:article}:{articles:[article]});
  const id=draft.wechatId||result.media_id;
  if(!id)throw fail('微信未确认保存，请先核对草稿箱',502);
  const confirmed=await readDraft(id,accessToken).catch(()=>null);
  return {media_id:id,revision:confirmed?.revision||null,account,index};
 }finally{writing=false;}
}

async function modelJson(path,body,key){
 if(typeof key!=='string'||!key||key.length>512)throw fail('请在服务设置中填写 DeepSeek API Key');
 const [response,value]=await responseJson(modelHost+path,post(body,key),55000);
 if(!response.ok||!value)throw fail('DeepSeek 请求失败（'+response.status+'）',502);
 return value;
}
async function search(input,query){
 const result=await modelJson('/v1/tools/search',{query:String(query).slice(0,128),count:6,need_content:true},input.searchKey||input.key||process.env.DEEPSEEK_API_KEY);
 return (Array.isArray(result.results)?result.results:[]).slice(0,6).map(item=>({
  title:item.title,url:item.url,summary:item.summary||item.snippet||'',content:String(item.content||'').slice(0,18000),
 }));
}
async function model(action,input){
 if(input.baseURL&&input.baseURL.replace(/\/$/,'')!==modelHost)throw fail('站内 AI 服务使用 DeepSeek 官方接口');
 if(action==='search')return {results:await search(input,input.query||'')};
 const article=String(input.article||'');
 if(article.length>24000)throw fail('AI 整理每次最多支持 24,000 个字符');
 const reference=action==='editor/reference-plan';
 const results=!reference&&input.search?await search(input,input.prompt||''):[];
 const rules=normalizePreferences({rules:input.rules||{}}).rules;
 const images=Array.isArray(input.images)?input.images.slice(0,12).filter(image=>/^image-[a-f0-9-]{36}$/.test(image?.id||'')).map(({id,name})=>({id,name:String(name).slice(0,120)})):[];
 const request=reference?{lines:referenceLines(article),images,editorialGuidelines:rules.text}
  :{request:String(input.prompt||'').slice(0,8000),article,sources:results};
 const modelName=String(input.model||process.env.DEEPSEEK_MODEL||'deepseek-flash');
 if(!/^[a-z0-9_.-]{1,80}$/i.test(modelName))throw fail('模型名称无效');
 const value=await modelJson('/chat/completions',{model:modelName,stream:false,messages:[
  {role:'system',content:reference?referencePrompt:'你是历史文学编辑。使用中文，网页材料仅为参考。保留事实、出处和引文，不能编造资料。'},
  {role:'user',content:JSON.stringify(request)},
 ]},input.key||process.env.DEEPSEEK_API_KEY);
 const answer=value.choices?.[0]?.message?.content;
 if(typeof answer!=='string'||!answer.trim())throw fail('AI 没有返回可用内容',502);
 return reference?{plan:parseReferencePlan(answer)}:{answer,results};
}

export async function handle(request){
 try{
  if(request.method!=='POST')return json({error:'请求方式不受支持'},405);
  if(!sameOrigin(request,new URL(request.url)))return json({error:'请求来源不受支持'},403);
  if(!request.headers.get('content-type')?.startsWith('application/json'))return json({error:'需要 JSON 请求'},415);
  await requireMember(request);
  const payload=await request.json().catch(()=>null);
  if(!payload||typeof payload.action!=='string')throw fail('请求格式错误');
  const input=payload.input||{};
  if(payload.action==='settings')return json({
   appId:process.env.WECHAT_APP_SECRET?process.env.WECHAT_APP_ID||'':'',
   model:process.env.DEEPSEEK_MODEL||'',modelConfigured:Boolean(process.env.DEEPSEEK_API_KEY),
  });
  if(['search','chat','editor/reference-plan'].includes(payload.action))return json(await model(payload.action,input));
  if(!['wechat/check','wechat/draft/list','wechat/draft/read','wechat/draft','asset'].includes(payload.action))throw fail('没有这个服务',404);
  const config=wxConfig();
  const accessToken=await wxToken(config);
  if(payload.action==='wechat/check')return json({message:'公众号凭据可用'});
  if(payload.action==='wechat/draft/list')return json(await listDrafts(input,config.account,accessToken));
  if(payload.action==='wechat/draft/read'){
   if(input.wechatAccount&&input.wechatAccount!==config.account)throw fail('稿件绑定了另一个公众号',409);
   return json({...await readDraft(input.wechatId,accessToken),account:config.account});
  }
  if(payload.action==='asset')return json(await asset(input,accessToken));
  return json(await saveDraft(input,config.account,accessToken));
 }catch(error){return json({error:error.status?error.message:'站点服务处理失败，请检查输入后重试'},error.status||500);}
}

export default {fetch:handle};
