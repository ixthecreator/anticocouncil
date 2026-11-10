import {formatRaw} from './format.mjs';
import {themes,render,esc,safeURL} from './render.mjs';
import {listMarkers,markerLabels} from './markers.mjs';
import {normalizePreferences,normalizeTemplate,checkGuidelines,detachRemote} from './editor-options.mjs';
import {sanitizeWechatHtml,wechatImageURL} from './wechat-html.mjs';
import {formatReferenceText,referenceAssetSlots,referenceAssetUrls,referenceBuiltinAssets,referenceImagePath,referenceLayout} from './reference-layout.mjs';
import {api,displayImage,displayMarkup,canonicalMarkup,storedImage} from './hosted-api.mjs';
const $=s=>document.querySelector(s);let drafts=[],active='',timer,saveChain=Promise.resolve(),uploadMode='body',config={},revision=0;
const councilEntry={enabled:true};
document.documentElement.classList.add('council-skin','hosted-workbench');
let preferences=normalizePreferences({});
const activeDrafts=()=>drafts.filter(draft=>!draft.deletedAt);
const sample={
 title:"测试文本123ABCabc",
 body:[
  "## 测试标题 测试文本123ABCabc",
  "[段落] 测试文本123ABCabc。测试文本123ABCabc，==测试文本123ABCabc==。",
  "![测试图片 测试文本123ABCabc](/sample.svg)",
  "> 测试文本123ABCabc。测试文本123ABCabc。",
  "[编者按] 测试文本123ABCabc。",
  "---",
  "## 测试标题 测试文本123ABCabc",
  "[段落] 测试文本123ABCabc。测试文本123ABCabc。"
 ].join('\n\n')
};
const sampleParagraph='测试文本123ABCabc。'.repeat(9);
const referenceSample={
 title:sample.title,
 body:[
  '[副标题] 测试文本123ABCabc',
  '[导语·注释] 测试文本123ABCabc。',
  '## 测试小标题 ABC',
  ...Array(12).fill(sampleParagraph),
  '## 测试小标题 abc',
  '测试文本123ABCabc[^1]。',
  '![测试图片 ABCabc](/sample.svg)',
  '[注释] 注释与引用',
  '[^1]: 测试文本123ABCabc。'
 ].join('\n\n')
};
function toast(t){$('#toast').textContent=t;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,6500);}
const current=()=>drafts.find(x=>x.id===active&&!x.deletedAt);
function create(theme='history',example=false){revision++;const d={id:crypto.randomUUID(),title:example?sample.title:'',body:example?sample.body:'',author:'',digest:'',cover:'',theme,color:themes[theme].color,fontSize:16,updated:Date.now()};drafts.unshift(d);active=d.id;show();persist();}
function nav(){ $('#draftCount').textContent=activeDrafts().length;$('#drafts').innerHTML=activeDrafts().map(d=>`<button class="draft ${d.id===active?'active':''}" data-id="${esc(d.id)}"><span class="draft-title">${esc(d.title||'未命名文章')}</span><span class="draft-meta">${themes[d.theme]?.name||'史料'}　·　${new Date(d.updated).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'})}${d.wechatId?'　↗':''}</span></button>`).join('');if(councilEntry.enabled)renderCouncilLocalDrafts();}
function preview(){const d=current();$('#preview').innerHTML=displayMarkup(typeof d.richHtml==='string'?sanitizeWechatHtml(d.richHtml,document).html:render(d));$('#wechatHeading').innerHTML='<h1>'+esc(d.title||'未命名文章')+'</h1><p><span>原创</span> '+esc(d.author||'作者')+' <b>公众号名称</b></p><small>今天　　微信阅读样式预览</small>'; $('#wordCount').textContent=d.body.replace(/\s/g,'').length+' 字';$('#themeName').textContent=typeof d.richHtml==='string'?'微信原稿':d.template?.name||themes[d.theme]?.name||'史料';updateSyncControls();$('#customSelect').value=d.template?.id||'';$('#currentName').textContent=d.title||'未命名文章';$('#themes').innerHTML=Object.entries(themes).map(([k,t])=>`<button class="theme ${d.theme===k?'active':''}" data-theme="${k}"><span class="mini mini-${k}"><i></i><i></i><i></i><i></i></span><strong>${t.name}</strong><small>${({reference:"交替边框",history:"编年笺注",literature:"留白刊物",essay:"日常手记",review:"阅读卡片"})[k]}</small></button>`).join('');$('#color').value=d.theme==='reference'?referenceLayout(d.referenceLayout).style.leftColor:d.color;$('#fontSize').value=d.fontSize;const cover=safeURL(d.cover)||wechatImageURL(d.wechatCoverUrl);$('#coverImage').hidden=!cover;$('#coverImage').src=displayImage(cover);$('#coverButton').textContent=d.cover||d.wechatCover?'更换封面':'＋ 添加封面';$('#coverStatus').textContent=d.cover?'已添加':d.wechatCover?'沿用微信封面':'';}
function show(){const d=current();for(const k of ['title','author','digest','body'])$('#'+k).value=d[k]||'';showRichBody(d);preview();nav();updateMarkerList();}
function persist(){clearTimeout(timer);$('#saveState').textContent='保存中…';const snapshot=JSON.stringify(drafts),savedRevision=revision;saveChain=saveChain.catch(()=>{}).then(()=>api('drafts',{drafts:JSON.parse(snapshot)})).then(()=>{if(savedRevision===revision)$('#saveState').textContent='已保存';}).catch(e=>{$('#saveState').textContent='保存失败';toast(e.message);throw e;});saveChain.catch(()=>{});return saveChain;}
function changed(){revision++;current().updated=Date.now();preview();nav();updateMarkerList();$('#saveState').textContent='尚未保存';clearTimeout(timer);persist();scheduleWechatSync(current());}
for(const k of ['title','author','digest','body'])$('#'+k).oninput=e=>{current()[k]=e.target.value;changed();};
$('#new').onclick=()=>{create();openCouncilEditor();};$('#drafts').onclick=e=>{const b=e.target.closest('[data-id]');if(b){active=b.dataset.id;show();}};
$('#themes').onclick=e=>{const button=e.target.closest('button[data-theme]');if(!button||!$('#themes').contains(button))return;const k=button.dataset.theme;if(themes[k]){if(typeof current().richHtml==='string'){toast('请先点「改用工作台排版」');return;}applyTemplate(current(),k);changed();}};
$('#fontSize').onchange=event=>{
 const draft=current();
 draft.fontSize=Number(event.target.value);
 if(draft.theme==='reference'){
  draft.referenceLayout=referenceLayout(draft.referenceLayout);
  draft.referenceLayout.style.bodySize=draft.fontSize;
 }
 changed();
};
$('#color').oninput=event=>{
 const draft=current();
 draft.color=event.target.value;
 if(draft.theme==='reference'){
  draft.referenceLayout=referenceLayout(draft.referenceLayout);
  draft.referenceLayout.style.leftColor=draft.color;
 }
 changed();
};
$('#example').onclick=()=>{if(current().body&&!confirm('用当前模板示例替换正文？'))return;Object.assign(current(),current().theme==='reference'?referenceSample:sample);show();changed();};
$('#delete').onclick=()=>moveToTrash([current()]);
const formatActions={
 paragraph:{prefix:'[段落] ',placeholder:'段落正文'},
 heading:{prefix:'## ',placeholder:'小标题'},
 quote:{prefix:'> ',placeholder:'引用文字'},
 note:{prefix:'[编者按] ',placeholder:'补充说明'},
 emphasis:{wrapper:'==',placeholder:'重点文字'},
 bold:{wrapper:'**',placeholder:'重点文字'}
};

function replaceBody(text,start,end){
 const editor=$('#body');
 editor.setRangeText(text,start,end,'end');
 current().body=editor.value;
 changed();
 editor.focus({preventScroll:true});
}

for(const button of document.querySelectorAll('[data-format]'))button.onclick=()=>{
 const editor=$('#body'),kind=button.dataset.format;
 const {selectionStart:start,selectionEnd:end}=editor;
 if(kind==='line'){
  const selected=editor.value.slice(start,end);
  replaceBody(selected+'\n\n---\n\n',start,end);
  return;
 }
 const action=formatActions[kind];
 const selected=editor.value.slice(start,end);
 const content=selected||action.placeholder;
 const formatted=action.wrapper
  ?content.replace(/[^\r\n]+/g,line=>line.trim()?action.wrapper+line+action.wrapper:line)
  :'\n\n'+content.split(/\r?\n[ \t]*\r?\n/).filter(part=>part.trim()).map(part=>action.prefix+part).join('\n\n')+'\n\n';
 replaceBody(formatted,start,end);
 if(!selected&&['paragraph','emphasis','note'].includes(kind)){
  const cursor=start+formatted.indexOf(action.placeholder);
  editor.setSelectionRange(cursor,cursor+action.placeholder.length);
 }
};

let visibleMarkers=[];
function updateMarkerList(){
 const marks=listMarkers(current()?.body||'');
 const blockCount=marks.filter(mark=>mark.kind!=='bold'&&mark.kind!=='emphasis').length;
 const focusCount=marks.length-blockCount;
 $('#markerCount').textContent=`${blockCount} 段 · ${focusCount} 处强调`;
 if(!$('#markerPanel').open)return;
 const filter=$('#markerFilter').value;
 visibleMarkers=marks.filter(mark=>filter==='all'||(filter==='structure'
  ?['paragraph','heading','image','line'].includes(mark.kind)
  :['emphasis','bold','quote','note'].includes(mark.kind)));
 $('#markerList').innerHTML=visibleMarkers.map((mark,index)=>{
  const summary=mark.text.replace(/\s+/g,' ').trim().slice(0,65)||markerLabels[mark.kind];
  const remove=mark.replacement===undefined?'':`<button type="button" class="marker-remove" data-remove="${index}" aria-label="移除${markerLabels[mark.kind]}标记" title="移除标记，保留文字">✕</button>`;
  return `<li><button type="button" class="marker-jump" data-marker="${index}"><span class="marker-badge marker-${mark.kind}">${markerLabels[mark.kind]}</span><span class="marker-snippet">${esc(summary)}</span></button>${remove}</li>`;
 }).join('')||'<li class="marker-empty">暂无匹配标记</li>';
}

function jumpToMarker(mark){
 const editor=$('#body');
 // Measure with the textarea's font and width so wrapped lines scroll correctly.
 const style=getComputedStyle(editor);
 const mirror=document.createElement('div');
 Object.assign(mirror.style,{position:'fixed',visibility:'hidden',width:`${editor.clientWidth}px`,font:style.font,lineHeight:style.lineHeight,letterSpacing:style.letterSpacing,padding:style.padding,whiteSpace:'pre-wrap',overflowWrap:'break-word'});
 const anchor=document.createElement('span');
 anchor.textContent=editor.value[mark.start]||' ';
 mirror.append(editor.value.slice(0,mark.start),anchor);
 document.body.append(mirror);
 const top=anchor.getBoundingClientRect().top-mirror.getBoundingClientRect().top;
 mirror.remove();
 editor.focus({preventScroll:true});
 editor.setSelectionRange(mark.start,mark.end);
 editor.scrollTop=Math.max(0,top-editor.clientHeight/3);
}

$('#markerPanel').addEventListener('toggle',updateMarkerList);
$('#markerFilter').onchange=updateMarkerList;
$('#markerList').onclick=event=>{
 const button=event.target.closest('[data-marker],[data-remove]');
 if(!button)return;
 const mark=visibleMarkers[Number(button.dataset.marker??button.dataset.remove)];
 if(!mark)return;
 if(button.dataset.remove!==undefined)replaceBody(mark.replacement,mark.start,mark.end);
 else jumpToMarker(mark);
};
$('#imageButton').onclick=()=>{uploadMode='body';$('#fileInput').click();};$('#coverButton').onclick=()=>{uploadMode='cover';$('#fileInput').click();};$('#richImage').onclick=()=>{uploadMode='rich';$('#fileInput').click();};
$('#fileInput').onchange=async e=>{const file=e.target.files[0];if(!file)return;const d=current(),mode=uploadMode;try{if(file.size>5*1024*1024)throw Error('图片请控制在 5 MB 以内');const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});const result=await api('upload',{data});if(mode==='cover')d.cover=result.url;else if(mode==='rich'){const safe=sanitizeWechatHtml(d.richHtml+'<p><img src="'+esc(result.url)+'" alt="'+esc(file.name)+'"></p>',document);d.richHtml=safe.html;d.body=safe.text;d.richDirty=true;}else d.body+='\n\n!['+file.name.replace(/[\[\]\n]/g,'')+']('+result.url+')\n\n';d.updated=Date.now();revision++;if(current().id===d.id)show();scheduleWechatSync(d);await persist();}catch(e){toast(e.message);}finally{$('#fileInput').value='';}};
async function dataURL(url){return storedImage(url);}
const isLocalImage=url=>typeof url==='string'&&referenceImagePath.test(url);
function remapReference(layout,images){
 const {assets,style}=referenceLayout(layout);
 return {style,assets:Object.fromEntries(Object.entries(assets).map(([slot,url])=>[slot,images.get(url)??(url===referenceBuiltinAssets[slot]?url:'')]))};
}
async function downloadBackup(items){
 try{
  const copy=structuredClone(items).map(detachRemote),assets={};
  for(const draft of copy){
   const sources=new Set([draft.cover,...referenceAssetUrls(draft),...Array.from(draft.body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g),match=>match[1])]);
   if(typeof draft.richHtml==='string')for(const image of sanitizeWechatHtml(draft.richHtml,document).localImages)sources.add(image);
   for(const source of sources)if(isLocalImage(source)&&!assets[source])assets[source]=await dataURL(source);
  }
  for(const source of Object.values(preferences.reference.assets))if(isLocalImage(source)&&!assets[source])assets[source]=await dataURL(source);
  const bundle={version:2,drafts:copy,assets,preferences};
  const url=URL.createObjectURL(new Blob([JSON.stringify(bundle)],{type:'application/json'}));
  const link=document.createElement('a');
  link.href=url;link.download='工作台备份-'+new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)+'.json';
  link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast(`已备份 ${items.length} 篇稿件`);
 }catch(error){toast(error.message);}
}
$('#export').onclick=()=>downloadBackup(drafts);
$('#import').onclick=()=>$('#importInput').click();
$('#importInput').onchange=async event=>{
 try{
  const file=event.target.files[0];if(!file)return;
  const backup=JSON.parse(await file.text());
  if(![1,2].includes(backup.version)||!Array.isArray(backup.drafts)||backup.drafts.length+drafts.length>1000)throw Error('不支持的备份格式，或稿件数量超过上限');
  for(const item of backup.drafts)if(!item||typeof item.title!=='string'||typeof item.body!=='string'||!Object.hasOwn(themes,item.theme))throw Error('稿件数据不完整');
  const images=new Map();
  for(const [url,data] of Object.entries(backup.assets||{}))if(isLocalImage(url))images.set(url,(await api('upload',{data})).url);
  const imported=backup.drafts.map(item=>{
   const draft=detachRemote(item);
   const body=draft.body.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,(raw,caption,url)=>images.has(url)?`![${caption}](${images.get(url)})`:raw);
   let richHtml=draft.richHtml;
   if(typeof richHtml==='string'){for(const [old,url] of images)richHtml=richHtml.replaceAll(`src="${old}"`,`src="${url}"`);richHtml=sanitizeWechatHtml(richHtml,document).html;}
   return {...draft,id:crypto.randomUUID(),body,richHtml,cover:images.get(draft.cover)||'',template:normalizeTemplate(draft.template),referenceLayout:draft.referenceLayout?remapReference(draft.referenceLayout,images):undefined,updated:Date.now(),deletedAt:Number(draft.deletedAt)||null};
  });
  if(backup.version===2&&backup.preferences){
   const restored=normalizePreferences(backup.preferences);
   const byId=new Map(preferences.templates.map(item=>[item.id,item]));
   for(const item of restored.templates)if(!byId.has(item.id))byId.set(item.id,item);
   const hasRules=Object.values(preferences.rules).some(Boolean);
   const defaultReference=JSON.stringify(referenceLayout())===JSON.stringify(preferences.reference);
   await storePreferences({templates:[...byId.values()],rules:hasRules?preferences.rules:restored.rules,reference:defaultReference?remapReference(restored.reference,images):preferences.reference});
  }
  drafts.unshift(...imported);revision++;
  active=imported.find(item=>!item.deletedAt)?.id||active;
  show();await persist();if($('#libraryDialog').open)renderLibrary();
  toast(`已导入 ${imported.length} 篇稿件，原有稿件未覆盖`);
 }catch(error){toast(error.message);}
 finally{$('#importInput').value='';}
};
$('#assistantToggle').onclick=()=>$('#assistant').hidden=!$('#assistant').hidden;$('#assistantClose').onclick=()=>$('#assistant').hidden=true;document.querySelectorAll('.suggestion').forEach(b=>b.onclick=()=>{$('#prompt').value=b.textContent;$('#prompt').focus();});
function message(text,role){const div=document.createElement('div');div.className='message '+role;div.textContent=text;$('#messages').append(div);div.scrollIntoView({block:'end'});return div;}
$('#chatForm').onsubmit=async e=>{e.preventDefault();const prompt=$('#prompt').value.trim();if(!prompt)return;const d=current();$('.assistant-intro')?.remove();message(prompt,'user');$('#prompt').value='';$('#ask').disabled=true;const pending=message($('#webSearch').checked?'正在检索与整理…':'正在整理…','ai');try{const j=await api('chat',{prompt,article:d.body,search:$('#webSearch').checked});pending.textContent=j.answer;const button=document.createElement('button');button.textContent='插入当前正文';button.onclick=()=>{appendArticleText(j.answer);toast('已插入');};pending.append(document.createElement('br'),button);for(const s of j.results){const card=document.createElement('div');card.className='source';const a=document.createElement('a');a.textContent=s.title;a.href=safeURL(s.url)||'#';a.target='_blank';a.rel='noreferrer';const p=document.createElement('p');p.textContent=(s.summary||'').slice(0,180);const use=document.createElement('button');use.textContent='加入来源';use.onclick=()=>{appendArticleText('参考资料：'+s.title+'\n'+s.url);toast('已加入来源');};card.append(a,p,use);pending.append(card);}}catch(e){pending.textContent=e.message;$('#prompt').value=prompt;}finally{$('#ask').disabled=false;}};
function fillSettings(){
 const form=$('#settingsForm');
 form.elements.model.value=config.model||'';
 for(const key of ['key','searchKey']){
  form.elements[key].value='';
  form.elements[key].placeholder=config.configured?.[key]?'已配置 · 留空保留':'选填';
 }
 $('#wechatConnection').textContent=config.appId?'站点已配置公众号，可检查连接。':'公众号连接由站点管理员配置。';
}
$('#settings').onclick=async()=>{
 try{config=await api('settings');fillSettings();$('#settingsStatus').textContent='';$('#settingsDialog').showModal();}
 catch(error){toast(error.message);}
};
$('#settingsClose').onclick=()=>$('#settingsDialog').close();
$('#settingsForm').onsubmit=async event=>{
 event.preventDefault();
 try{
  config=await api('settings',Object.fromEntries(new FormData($('#settingsForm'))));
  $('#settingsDialog').close();toast('服务设置已保存');
 }catch(error){$('#settingsStatus').textContent=error.message;}
};
$('#checkWechat').onclick=async()=>{
 const button=$('#checkWechat');
 button.disabled=true;$('#settingsStatus').textContent='检查中…';
 try{$('#settingsStatus').textContent=(await api('wechat/check',{})).message;}
 catch(error){$('#settingsStatus').textContent=error.message;}
 finally{button.disabled=false;}
};
$('#clearKeys').onclick=async()=>{
 try{config=await api('settings',{clearSecrets:['key','searchKey']});fillSettings();$('#settingsStatus').textContent='已清除本次会话填写的 Key';}
 catch(error){$('#settingsStatus').textContent=error.message;}
};
let wechatSaving=false;
async function sendToWechat(draft,onProgress,automatic=false){
 if(wechatSaving)throw Error('另一篇稿件正在同步');
 if(!draft?.title.trim()||(!draft.body.trim()&&!draft.richHtml)||draft.deletedAt)throw Error('请选择一篇未删除且含标题和正文的稿件');
 const issues=checkGuidelines(draft,preferences.rules);
 if(issues.length)throw Error(issues.join('；'));
 const snapshot=structuredClone(draft);
 wechatSaving=true;
 pendingWechatWrites.add(draft.id);updateSyncControls();
 try{
  await persist();
  if(automatic&&(!snapshot.wechatId||!snapshot.wechatRevision||!draft.autoSync))throw Error('自动同步需要绑定微信草稿');
  onProgress('正在存入公众号草稿箱…');
  if(draft.deletedAt||(automatic&&!draft.autoSync))throw Error('稿件已停止同步');
  const result=await api('wechat/draft',snapshot);
  if(!result.ok&&!result.media_id)throw Error('微信尚未确认草稿已保存，请先检查草稿箱');
  if(result.media_id){
   draft.wechatId=result.media_id;
   draft.wechatIndex=result.index??draft.wechatIndex??0;
   draft.wechatRevision=result.revision||null;
   draft.wechatAccount=result.account||null;
   if(snapshot.cover)draft.wechatCover=true;
   if(typeof draft.richHtml==='string'&&draft.richHtml===snapshot.richHtml)draft.richDirty=false;
   if(!draft.wechatRevision)draft.autoSync=false;
  }
  draft.syncedAt=Date.now();draft.syncError='';
  try{await persist();}catch{return '微信已确认草稿已保存，本地同步记录写入失败';}
  nav();
  return result.media_id&&!result.revision?'微信已写入草稿，但读取版本失败，自动同步已暂停':'微信已确认草稿已保存';
 }finally{wechatSaving=false;pendingWechatWrites.delete(draft.id);updateSyncControls();}
}
$('#sync').onclick=async()=>{
 const button=$('#sync');
 button.disabled=true;
 const draft=current();
 try{toast(await sendToWechat(draft,progress=>{button.textContent=progress;}));}
 catch(error){if(error.status===409)pauseWechatSync(draft,error.message);toast(error.message);}
 finally{button.disabled=false;button.textContent=syncButtonLabel(current());updateSyncControls();}
};
window.addEventListener('beforeunload',e=>{if($('#saveState').textContent!=='已保存'){e.preventDefault();e.returnValue='';}});


let rawResult=null,rawRevision=0,rawAiRevision=-1,rawDraftId=null,rawBusy=false,rawImages=[];
$('#rawOpen').onclick=()=>{$('#rawDialog').showModal();$('#rawText').focus();};
$('#rawClose').onclick=()=>$('#rawDialog').close();
$('#rawDialog').addEventListener('cancel',event=>{if(rawBusy)event.preventDefault();});

function renderRaw(source,theme,plan){
 const template=preferences.templates.find(item=>item.id===theme);
 const article=theme==='reference'?formatReferenceText(source,plan,rawImages):formatRaw(source,template?.theme||theme);
 if(!article.title){
  const lead=article.body.split('\n').find(line=>line.trim()&&!line.startsWith('!['))||'';
  article.title=lead.replace(/^(?:##\s+|>\s+|\[(?:段落|编者按)\]\s*)/,'')
   .replace(/\*\*|==/g,'').split(/[。！？；]/,1)[0].slice(0,40).trim()||'未命名文章';
 }
 if(!article.body.trim())throw Error('请粘贴标题和正文');
 rawResult={...article,template:template||null,color:template?.color||themes[article.theme].color,fontSize:template?.fontSize||16,author:current()?.author||''};
 if(theme==='reference'){
  rawResult.referenceLayout=referenceLayout(preferences.reference);
  rawResult.fontSize=rawResult.referenceLayout.style.bodySize;
 }
 $('#rawPreview').innerHTML=(theme==='reference'?'':'<h2>'+esc(rawResult.title)+'</h2>')+displayMarkup(render(rawResult));
 $('#rawEmpty').hidden=true;
 $('#rawPreview').hidden=false;
}

function setRawBusy(busy){
 rawBusy=busy;
 for(const id of ['rawText','rawTheme','rawPolish','rawClose','rawImport','rawAddImages','rawReference'])$('#'+id).disabled=busy;
 for(const id of ['rawGenerate','rawApply','rawSync'])$('#'+id).disabled=busy||!rawResult;
}

function refreshRawPreview(){
 rawRevision++;
 rawResult=null;
 rawDraftId=null;
 $('#rawPreview').hidden=true;
 $('#rawEmpty').hidden=false;
 $('#rawStatus').textContent='';
 const reference=$('#rawTheme').value==='reference';
 for(const id of ['rawAddImages','rawReference','rawImages'])$('#'+id).hidden=!reference;
 $('#rawAiLabel').textContent=reference?'AI 整理（发送原文）':'AI 润色（发送原文）';
 $('#rawImages').innerHTML=rawImages.map(image=>`<button type="button" data-remove-image="${image.id}" aria-label="移除 ${esc(image.name)}">${esc(image.name)} ×</button>`).join('');
 const source=$('#rawText').value;
 if(source.trim()){
  try{renderRaw(source,$('#rawTheme').value);$('#rawStatus').textContent='已自动排版';}
  catch(error){$('#rawStatus').textContent=error.message;}
 }
 setRawBusy(false);
}
for(const [id,event] of [['rawText','input'],['rawTheme','change'],['rawPolish','change']])$('#'+id).addEventListener(event,refreshRawPreview);
$('#rawGenerate').disabled=true;

async function prepareRaw(){
 if(!rawResult)throw Error('请先粘贴原文');
 if(!$('#rawPolish').checked||rawAiRevision===rawRevision)return;
 const source=$('#rawText').value,theme=$('#rawTheme').value;
 if(source.length>24000)throw Error('AI 整理每次最多处理 24,000 个字符');
 if(theme==='reference'){
  $('#rawStatus').textContent='AI 正在识别标题、导语和配图位置…';
  const {plan}=await api('editor/reference-plan',{article:source,images:rawImages.map(({id,name})=>({id,name}))});
  renderRaw(source,theme,plan);
  rawResult.aiAssisted=true;
  rawAiRevision=rawRevision;
  return;
 }
 $('#rawStatus').textContent='AI 正在整理标题、段落和重点…';
 const result=await api('chat',{
  prompt:'把原文排成可直接交给公众号编辑的文章。第一行用 # 写标题，章节用 ##，空行分段，引文用 >。保留事实、数字、出处和图片占位，不添加材料。只输出排版后的文章。\n编辑自定义规范：'+preferences.rules.text,
  article:source,search:false
 });
 renderRaw(result.answer,theme);
 rawResult.aiAssisted=true;
 rawAiRevision=rawRevision;
}

$('#rawGenerate').onclick=async()=>{
 if(rawBusy)return;
 setRawBusy(true);
 try{await prepareRaw();$('#rawStatus').textContent=$('#rawPolish').checked?'AI 已整理，请核对预览':'已自动排版';}
 catch(error){$('#rawStatus').textContent=error.message;}
 finally{setRawBusy(false);}
};

async function saveRaw(toWechat){
 if(rawBusy||!rawResult)return;
 setRawBusy(true);
 try{
  await prepareRaw();
  let draft=drafts.find(item=>item.id===rawDraftId);
  if(!draft){
   if(drafts.length>=1000)throw Error('已达到 1000 篇稿件上限');
   rawDraftId=crypto.randomUUID();
   draft={...rawResult,id:rawDraftId,digest:'',cover:'',updated:Date.now()};
   drafts.unshift(draft);
   revision++;
  }
  active=draft.id;
  show();
  let notice='草稿已保存';
  if(toWechat)notice=await sendToWechat(draft,progress=>{$('#rawStatus').textContent=progress;});
  else await persist();
  $('#rawDialog').close();
  openCouncilEditor();
  $('#rawText').value='';
  rawImages=[];
  refreshRawPreview();
  toast(notice);
 }catch(error){$('#rawStatus').textContent=error.message;}
 finally{setRawBusy(false);}
}
$('#rawApply').onclick=()=>saveRaw(false);
$('#rawSync').onclick=()=>saveRaw(true);

async function uploadImage(file){
 if(file.size>5*1024*1024)throw Error('图片请控制在 5 MB 以内');
 const data=await new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>resolve(reader.result);
  reader.onerror=()=>reject(Error('无法读取图片'));
  reader.readAsDataURL(file);
 });
 return (await api('upload',{data})).url;
}

$('#rawImport').onclick=()=>$('#rawFile').click();
$('#rawFile').onchange=async event=>{
 const file=event.target.files[0];
 if(!file||rawBusy)return;
 setRawBusy(true);
 try{
  if(file.size>2*1024*1024)throw Error('TXT 请控制在 2 MB 以内');
  const bytes=new Uint8Array(await file.arrayBuffer());
  let source;
  if(bytes[0]===255&&bytes[1]===254)source=new TextDecoder('utf-16le').decode(bytes);
  else if(bytes[0]===254&&bytes[1]===255)source=new TextDecoder('utf-16be').decode(bytes);
  else try{source=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
  catch{source=new TextDecoder('gb18030',{fatal:true}).decode(bytes);}
  if(source.includes('\0'))throw Error('请选择纯文本 TXT 文件');
  $('#rawText').value=source;
  refreshRawPreview();
 }catch(error){$('#rawStatus').textContent=error.message;}
 finally{event.target.value='';setRawBusy(false);}
};
$('#rawAddImages').onclick=()=>$('#rawImagesFile').click();
$('#rawImagesFile').onchange=async event=>{
 if(rawBusy)return;
 setRawBusy(true);
 try{
  const files=[...event.target.files];
  if(rawImages.length+files.length>12)throw Error('一次最多添加 12 张配图');
  for(const file of files)rawImages.push({id:'image-'+crypto.randomUUID(),name:file.name,url:await uploadImage(file)});
  refreshRawPreview();
 }catch(error){refreshRawPreview();$('#rawStatus').textContent=error.message;}
 finally{event.target.value='';setRawBusy(false);}
};
$('#rawImages').onclick=event=>{
 const button=event.target.closest('button[data-remove-image]');
 if(!button||rawBusy)return;
 rawImages=rawImages.filter(image=>image.id!==button.dataset.removeImage);
 refreshRawPreview();
};

function templateOptions(){
 return Object.entries(themes).map(([id,item])=>`<option value="${id}">${esc(item.name)}</option>`).join('')+
  preferences.templates.map(item=>`<option value="${item.id}">${esc(item.name)}</option>`).join('');
}

function updateTemplateOptions(){
 const rawChoice=$('#rawTheme').value;
 const custom=preferences.templates;
 $('#customPicker').hidden=!custom.length||typeof current()?.richHtml==='string';
 $('#customSelect').innerHTML='<option value="">选择模板…</option>'+custom.map(item=>`<option value="${item.id}">${esc(item.name)}</option>`).join('');
 $('#customSelect').value=current()?.template?.id||'';
 $('#rawTheme').innerHTML=templateOptions();
 $('#rawTheme').value=[...$('#rawTheme').options].some(option=>option.value===rawChoice)?rawChoice:'reference';
 $('#batchTemplate').innerHTML=templateOptions();
 $('#templateEdit').innerHTML='<option value="">新建模板</option>'+custom.map(item=>`<option value="${item.id}">${esc(item.name)}</option>`).join('');
}

async function storePreferences(next){
 preferences=normalizePreferences(await api('editor/preferences',normalizePreferences(next)));
 updateTemplateOptions();
}

const referenceFields={openingGap:'开头留白',headerPadding:'标题顶部留白',bodySize:'正文字号',lineHeight:'正文行距',paragraphGap:'段距',verticalPadding:'上下留白',horizontalPadding:'左右留白',frameWidth:'边框宽度',sectionLength:'换边目标字数',titleSize:'主标题字号',subtitleSize:'副标题字号',captionSize:'图注字号',captionColor:'图注与引用颜色',titleBackground:'标题底色',leftColor:'左框颜色',rightColor:'右框颜色'};
const referenceForm=$('#referenceForm');
let referenceSettings,referenceDraftId,referenceBusy=false;

function readReferenceForm(){
 return referenceLayout({assets:referenceSettings.assets,style:Object.fromEntries(Object.keys(referenceFields).map(key=>[key,referenceForm.elements[key].value]))});
}
function drawReference(){
 const example={...referenceSample,theme:'reference'};
 const draft=rawResult?.theme==='reference'?rawResult:drafts.find(item=>item.id===referenceDraftId&&item.theme==='reference'&&item.body);
 $('#referencePreview').innerHTML=displayMarkup(render({...(draft||example),referenceLayout:readReferenceForm()}));
}
function showReferenceAssets(){
 $('#referenceAssets').innerHTML=Object.entries(referenceAssetSlots).map(([slot,label])=>{
  const fallback=referenceBuiltinAssets[slot],selected=referenceSettings.assets[slot];
  const action=fallback&&selected!==fallback?'恢复内置':selected?'移除':'';
  return `<div class="reference-asset"><label>${label}<input type="file" data-reference-slot="${slot}" accept="image/png,image/jpeg,image/webp,image/gif"></label>${action?`<button type="button" data-clear-slot="${slot}">${action}</button>`:'<small>使用样式</small>'}</div>`;
 }).join('');
}
function showReferenceStyle(){
 $('#referenceStyle').innerHTML=Object.entries(referenceFields).map(([key,label])=>{
  const value=referenceSettings.style[key];
  return `<label>${label}<input name="${key}" type="${typeof value==='number'?'number':'color'}" ${key==='lineHeight'?'step="0.1"':''} value="${value}"></label>`;
 }).join('');
}
function openReference(draft){
 referenceDraftId=draft?.theme==='reference'?draft.id:null;
 referenceSettings=referenceLayout(referenceDraftId?draft.referenceLayout||preferences.reference:preferences.reference);
 showReferenceAssets();
 showReferenceStyle();
 $('#referenceStatus').textContent='';
 drawReference();
 $('#referenceDialog').showModal();
}
function setReferenceBusy(busy){
 referenceBusy=busy;
 for(const element of referenceForm.querySelectorAll('input,button'))element.disabled=busy;
 $('#referenceClose').disabled=busy;
}
$('#rawReference').onclick=()=>openReference();
$('#referenceDraftOpen').onclick=()=>openReference(current());
$('#referenceClose').onclick=()=>$('#referenceDialog').close();
$('#referenceDialog').addEventListener('cancel',event=>{if(referenceBusy)event.preventDefault();});
$('#referenceStyle').oninput=drawReference;
$('#referenceAssets').onchange=async event=>{
 const {referenceSlot:slot}=event.target.dataset;
 const file=event.target.files?.[0];
 if(!Object.hasOwn(referenceAssetSlots,slot)||!file)return;
 referenceSettings=readReferenceForm();
 setReferenceBusy(true);
 try{
  referenceSettings.assets[slot]=await uploadImage(file);
  showReferenceAssets();drawReference();$('#referenceStatus').textContent='';
 }catch(error){event.target.value='';$('#referenceStatus').textContent=error.message;}
 finally{setReferenceBusy(false);}
};
$('#referenceAssets').onclick=event=>{
 const button=event.target.closest('button[data-clear-slot]');
 if(!button||referenceBusy)return;
 const slot=button.dataset.clearSlot;
 const fallback=referenceBuiltinAssets[slot];
 referenceSettings.assets[slot]=fallback&&referenceSettings.assets[slot]!==fallback?fallback:'';
 showReferenceAssets();drawReference();
};
$('#referenceReset').onclick=()=>{
 referenceSettings={...referenceLayout(),assets:referenceSettings.assets};
 showReferenceStyle();drawReference();
};
referenceForm.onsubmit=async event=>{
 event.preventDefault();
 if(referenceBusy)return;
 const reference=readReferenceForm();
 setReferenceBusy(true);
 try{
  await storePreferences({...preferences,reference});
  if(referenceDraftId&&current()?.id===referenceDraftId&&current().theme==='reference'){
   current().referenceLayout=referenceLayout(preferences.reference);
   current().fontSize=preferences.reference.style.bodySize;
   changed();
  }
  if($('#rawDialog').open)refreshRawPreview();
  $('#referenceDialog').close();
 }catch(error){$('#referenceStatus').textContent=error.message;}
 finally{setReferenceBusy(false);}
};

function applyTemplate(draft,id){
 const custom=preferences.templates.find(item=>item.id===id);
 if(!custom&&!Object.hasOwn(themes,id))return;
 draft.template=custom?{...custom}:null;
 draft.theme=custom?.theme||id;
 draft.color=custom?.color||themes[id].color;
 if(custom)draft.fontSize=custom.fontSize;
 if(id==='reference'){
  draft.referenceLayout=referenceLayout(draft.referenceLayout||preferences.reference);
  draft.fontSize=draft.referenceLayout.style.bodySize;
 }
}

$('#customSelect').onchange=event=>{
 if(!event.target.value)return;
 if(typeof current().richHtml==='string'){event.target.value='';toast('请先点「改用工作台排版」');return;}
 applyTemplate(current(),event.target.value);changed();
};

let templateId='';
const templateForm=$('#templateForm');
function templateFromForm(){
 const fields=Object.fromEntries(new FormData(templateForm));
 return normalizeTemplate({...fields,id:templateId,name:fields.name||'模板预览'});
}

function drawTemplate(){
 const template=templateFromForm();
 if(!template)return;
 const draft=current();
 const example=draft?.body?draft:sample;
 $('#templatePreview').innerHTML='<h2>'+esc(example.title||'文章预览')+'</h2>'+displayMarkup(render({...example,template,theme:template.theme,color:template.color,fontSize:template.fontSize}));
}

function editTemplate(id){
 const saved=preferences.templates.find(item=>item.id===id);
 const draft=current();
 const existing=saved||{name:'',theme:draft?.theme==='reference'?'essay':draft?.theme||'essay',color:draft?.color||'#435b48',fontSize:draft?.fontSize||16,headingSize:21,lineHeight:2,paragraphGap:22,quote:'line',numbered:false};
 templateId=saved?.id||'custom-'+crypto.randomUUID();
 $('#templateEdit').value=saved?.id||'';
 for(const key of ['name','theme','color','fontSize','headingSize','lineHeight','paragraphGap','quote'])templateForm.elements[key].value=existing[key];
 templateForm.elements.numbered.checked=existing.numbered;
 $('#templateRemove').hidden=!saved;
 drawTemplate();
}

$('#templateOpen').onclick=()=>{if(typeof current()?.richHtml==='string'){toast('请先点「改用工作台排版」');return;}editTemplate(current()?.template?.id);$('#templateDialog').showModal();};
$('#templateClose').onclick=()=>$('#templateDialog').close();
$('#templateEdit').onchange=event=>editTemplate(event.target.value);
templateForm.addEventListener('input',drawTemplate);
templateForm.onsubmit=async event=>{
 event.preventDefault();
 const item=templateFromForm();
 if(!item||!templateForm.elements.name.value.trim())return;
 if(preferences.templates.length>=100&&!preferences.templates.some(template=>template.id===item.id)){toast('最多可保存 100 个自定义模板');return;}
 try{
  await storePreferences({...preferences,templates:[...preferences.templates.filter(template=>template.id!==item.id),item]});
  applyTemplate(current(),item.id);changed();
  $('#templateDialog').close();toast('模板已保存并应用');
 }catch(error){toast(error.message);}
};
$('#templateRemove').onclick=async()=>{
 try{
  await storePreferences({...preferences,templates:preferences.templates.filter(item=>item.id!==templateId)});
  editTemplate('');toast('已从模板列表移除。稿件保留已套用的样式。');
 }catch(error){toast(error.message);}
};

const rulesForm=$('#rulesForm');
function currentRules(){return normalizePreferences({rules:Object.fromEntries(new FormData(rulesForm))}).rules;}
$('#rulesOpen').onclick=()=>{
 for(const key of ['text','titleLimit','forbidden'])rulesForm.elements[key].value=preferences.rules[key];
 for(const key of ['requireAuthor','requireCover'])rulesForm.elements[key].checked=preferences.rules[key];
 $('#rulesStatus').textContent='';$('#rulesDialog').showModal();
};
$('#rulesClose').onclick=()=>$('#rulesDialog').close();
$('#rulesUpload').onclick=()=>$('#rulesFile').click();
$('#rulesFile').onchange=async event=>{
 try{
  const file=event.target.files[0];if(!file)return;
  if(file.size>20000)throw Error('规范文件过大，请保留 4000 字以内');
  const text=await file.text();
  if(text.length>4000)throw Error('规范说明最多 4000 字');
  rulesForm.elements.text.value=text;
 }catch(error){$('#rulesStatus').textContent=error.message;}
 finally{event.target.value='';}
};
$('#rulesCheck').onclick=()=>{
 const issues=checkGuidelines(current(),currentRules());
 $('#rulesStatus').textContent=issues.join('；')||'可自动检查的项目均已通过。';
};
rulesForm.onsubmit=async event=>{
 event.preventDefault();
 try{await storePreferences({...preferences,rules:currentRules()});$('#rulesDialog').close();toast('稿件规范已保存');}
 catch(error){$('#rulesStatus').textContent=error.message;}
};

let libraryMode='active';
const selectedIds=new Set();
function libraryItems(){
 const query=$('#libraryQuery').value.trim().toLowerCase();
 return drafts.filter(item=>Boolean(item.deletedAt)===(libraryMode==='trash')&&`${item.title}\n${item.body}`.toLowerCase().includes(query));
}
function selectedItems(){return libraryItems().filter(item=>selectedIds.has(item.id));}
function renderLibrary(){
 const inTrash=libraryMode==='trash';
 $('#activeBatch').hidden=inTrash;$('#trashBatch').hidden=!inTrash;
 $('#libraryActive').setAttribute('aria-pressed',String(!inTrash));
 $('#libraryTrash').setAttribute('aria-pressed',String(inTrash));
 $('#libraryList').innerHTML=libraryItems().map(item=>`<label><input type="checkbox" data-library-id="${esc(item.id)}" ${selectedIds.has(item.id)?'checked':''}>${esc(item.title||'未命名文章')}</label>`).join('')||'<p>没有匹配的稿件</p>';
 updateBatchControls();
}
function updateBatchControls(){
 const count=selectedItems().length;
 for(const id of ['batchApply','batchCheck','batchTrash','batchRestore','batchPurge','batchBackup'])$('#'+id).disabled=count===0;
 $('#libraryStatus').textContent=`已选 ${count} 篇`;
}
function chooseLibrary(mode){libraryMode=mode;selectedIds.clear();renderLibrary();}
$('#libraryOpen').onclick=()=>{chooseLibrary('active');$('#libraryDialog').showModal();};
$('#libraryClose').onclick=()=>$('#libraryDialog').close();
$('#libraryActive').onclick=()=>chooseLibrary('active');
$('#libraryTrash').onclick=()=>chooseLibrary('trash');
$('#libraryQuery').oninput=()=>{selectedIds.clear();renderLibrary();};
$('#libraryAll').onclick=()=>{
 const items=libraryItems();
 const select=!items.every(item=>selectedIds.has(item.id));
 for(const item of items)if(select)selectedIds.add(item.id);else selectedIds.delete(item.id);
 renderLibrary();
};
$('#libraryList').onchange=event=>{
 const id=event.target.dataset.libraryId;
 if(event.target.checked)selectedIds.add(id);else selectedIds.delete(id);
 updateBatchControls();
};

function afterLibraryEdit(){
 revision++;
 if(!current()){
  active=activeDrafts()[0]?.id||'';
  if(!active)create();else{show();persist();}
 }else{show();persist();}
 selectedIds.clear();if($('#libraryDialog').open)renderLibrary();
}
function moveToTrash(items){
 if(!items.length)return;
 if(items.some(item=>pendingWechatWrites.has(item.id))){toast('有稿件正在同步，请稍后再移入回收站');return;}
 if(items.length===activeDrafts().length&&drafts.length>=1000){toast('稿件已达上限，请先在回收站清理一篇');return;}
 for(const item of items){item.deletedAt=Date.now();item.autoSync=false;clearWechatTimer(item.id);}
 afterLibraryEdit();toast(`已移入回收站 ${items.length} 篇`);
}
$('#batchApply').onclick=()=>{
 const items=selectedItems();if(!items.length)return;
 if(items.some(item=>pendingWechatWrites.has(item.id))){toast('有稿件正在同步，请稍后再批量套用');return;}
 if(items.some(item=>typeof item.richHtml==='string')){toast('选中的微信原稿需先切换为工作台排版');return;}
 const id=$('#batchTemplate').value;
 for(const item of items){applyTemplate(item,id);item.updated=Date.now();item.autoSync=false;clearWechatTimer(item.id);}
 afterLibraryEdit();toast(`已给 ${items.length} 篇稿件套用模板`);
};
$('#batchCheck').onclick=()=>{
 const items=selectedItems();
 $('#libraryStatus').textContent=items.map(item=>`${item.title||'未命名文章'} · ${checkGuidelines(item,preferences.rules).join('；')||'通过'}`).join('\n');
};
$('#batchTrash').onclick=()=>moveToTrash(selectedItems());
$('#batchRestore').onclick=()=>{
 const items=selectedItems();for(const item of items)delete item.deletedAt;
 afterLibraryEdit();toast(`已恢复 ${items.length} 篇`);
};
$('#batchPurge').onclick=()=>{
 const items=selectedItems();
 if(!items.length||!confirm(`永久删除回收站中的 ${items.length} 篇本地稿件？此操作不可撤销。`))return;
 const ids=new Set(items.map(item=>item.id));drafts=drafts.filter(item=>!ids.has(item.id));afterLibraryEdit();
};
$('#batchBackup').onclick=()=>downloadBackup(selectedItems());
$('#libraryBackup').onclick=()=>downloadBackup(drafts);
$('#libraryImport').onclick=()=>$('#importInput').click();

const wechatTimers=new Map();
const pendingWechatWrites=new Set();
function clearWechatTimer(id){clearTimeout(wechatTimers.get(id));wechatTimers.delete(id);}
function updateSyncControls(){
 const item=current();if(!item)return;
 $('#referenceDraftOpen').hidden=typeof item.richHtml==='string'||item.theme!=='reference';
 const enabled=Boolean(item.autoSync);
 $('#autoSync').setAttribute('aria-pressed',String(enabled));
 $('#autoSync').textContent=enabled?'关闭微信自动同步':'开启微信自动同步';
 $('#remoteRead').hidden=!item.wechatId;
 if(!$('#sync').disabled)$('#sync').textContent=syncButtonLabel(item);
 $('#wechatSyncState').textContent=item.syncError||(
  pendingWechatWrites.has(item.id)?'正在同步到微信':wechatTimers.has(item.id)?'微信同步待提交':enabled?'自动同步已开启':item.syncedAt?'已同步到微信':'本地自动保存');
}
function pauseWechatSync(draft,message){
 if(!draft)return;
 draft.autoSync=false;draft.syncError=message;clearWechatTimer(draft.id);revision++;
 updateSyncControls();persist();
}
function scheduleWechatSync(draft){
 if(!draft?.autoSync||draft.deletedAt)return;
 clearWechatTimer(draft.id);
 wechatTimers.set(draft.id,setTimeout(()=>runWechatSync(draft),6500));
 updateSyncControls();
}
async function runWechatSync(draft){
 wechatTimers.delete(draft.id);
 if(!draft.autoSync||draft.deletedAt)return;
 if(wechatSaving){scheduleWechatSync(draft);return;}
 const before=draft.updated;
 try{
  await sendToWechat(draft,()=>{},true);
  if(before!==draft.updated)scheduleWechatSync(draft);
 }catch(error){pauseWechatSync(draft,error.message);}
}
$('#autoSync').onclick=async()=>{
 const draft=current();if(!draft)return;
 if(draft.autoSync){draft.autoSync=false;clearWechatTimer(draft.id);revision++;updateSyncControls();persist();return;}
 try{
  const settings=await api('settings');
  if(settings.wechatMode!=='api')throw Error('自动同步需要在设置中切换到官方 API 模式');
  if(!draft.wechatId||!draft.wechatRevision||draft.wechatAccount!==settings.appId)throw Error('先用官方 API 保存一次草稿，或读取已绑定草稿的微信版本');
  const latest=await api('wechat/draft/read',{wechatId:draft.wechatId,wechatAccount:draft.wechatAccount});
  if(latest.revision!==draft.wechatRevision)throw Error('微信草稿有新版本，请先读取并核对');
  draft.autoSync=true;draft.syncError='';revision++;updateSyncControls();await persist();
 }catch(error){toast(error.message);}
};

let remoteReview=null;
function remotePlainText(html){
 const fragment=document.createElement('template');fragment.innerHTML=String(html||'');
 for(const element of fragment.content.querySelectorAll('script,style,iframe,object'))element.remove();
 for(const element of fragment.content.querySelectorAll('br'))element.replaceWith('\n');
 for(const element of fragment.content.querySelectorAll('p,h1,h2,h3,blockquote,li,section'))element.append('\n');
 return fragment.content.textContent.trim().replace(/\n{3,}/g,'\n\n');
}
$('#remoteRead').onclick=async()=>{
 const draft=current(),button=$('#remoteRead');if(!draft?.wechatId)return;
 button.disabled=true;
 try{
  const remote=await api('wechat/draft/read',{wechatId:draft.wechatId,wechatAccount:draft.wechatAccount});
  const article=remote.articles[draft.wechatIndex||0];
  if(!article)throw Error('微信图文位置已改变，请从草稿箱重新打开');
  const text=remotePlainText(article.content);
  remoteReview={draft,remote,article,text};
  $('#remoteSummary').textContent=remote.revision===draft.wechatRevision?'微信版本与上次同步一致。':'微信版本不同。核对后可以更新同步基线。';
  $('#remoteText').textContent=[article.title,article.author,text].filter(Boolean).join('\n\n');
  $('#remoteAccept').disabled=remote.revision===draft.wechatRevision;
  $('#remoteDialog').showModal();
 }catch(error){toast(error.message);}
 finally{button.disabled=false;}
};
$('#remoteClose').onclick=()=>$('#remoteDialog').close();
$('#remoteCopy').onclick=()=>{
 if(!remoteReview)return;
 if(drafts.length>=1000){toast('已达到稿件上限');return;}
 const {article,text,draft}=remoteReview;
 const copy={...detachRemote(draft),id:crypto.randomUUID(),title:article.title||'微信稿件',author:article.author||'',digest:article.digest||'',body:text,cover:'',updated:Date.now()};
 drafts.unshift(copy);active=copy.id;revision++;show();persist();$('#remoteDialog').close();toast('微信版本已另存为本地文本稿');
};
$('#remoteAccept').onclick=()=>{
 if(!remoteReview||!confirm('已核对微信版本？下次手动同步将以这版作为覆盖检查的基线。'))return;
 const {draft,remote}=remoteReview;
 draft.wechatRevision=remote.revision;draft.wechatAccount=remote.account;draft.autoSync=false;draft.syncError='';clearWechatTimer(draft.id);
 revision++;persist();updateSyncControls();$('#remoteDialog').close();toast('已记录核对版本，可以重新开启同步');
};

let readingRemote=false;
async function checkForRemoteChanges(){
 const draft=current();
 if(document.hidden||readingRemote||wechatSaving||!draft?.autoSync||wechatTimers.has(draft.id))return;
 const revisionAtStart=draft.wechatRevision;
 readingRemote=true;
 try{
  const remote=await api('wechat/draft/read',{wechatId:draft.wechatId,wechatAccount:draft.wechatAccount});
  if(draft.autoSync&&draft.wechatRevision===revisionAtStart&&!wechatSaving&&remote.revision!==revisionAtStart){
   pauseWechatSync(draft,'检测到微信侧改动，已暂停同步。请读取微信版本。');
  }
 }catch{/* A read failure does not overwrite or replace the local draft. */}
 finally{readingRemote=false;}
}
window.setInterval(checkForRemoteChanges,25000);

function syncButtonLabel(draft){
 return draft?.wechatId?'保存回微信原稿 ↗':'存入公众号草稿箱 ↗';
}

function showRichBody(draft){
 const rich=typeof draft.richHtml==='string';
 const editor=$('#richBody');
 editor.hidden=!rich;
 $('#body').hidden=rich;
 $('#plainToolbar').hidden=rich;
 $('#richToolbar').hidden=!rich;
 $('#markerPanel').hidden=rich;
 for(const id of ['themes','templateOpen','previewAdjust'])$('#'+id).hidden=rich;
 $('#customPicker').hidden=rich||!preferences.templates.length;
 editor.innerHTML=rich?displayMarkup(sanitizeWechatHtml(draft.richHtml,document).html):'';
 editor.contentEditable=String(rich&&!draft.richReadOnly);
 $('#richModeLabel').textContent=draft.richReadOnly?'含微信专属组件，正文只读':'微信原稿';
 for(const button of document.querySelectorAll('[data-rich-format]'))button.disabled=Boolean(draft.richReadOnly);
 $('#richImage').disabled=Boolean(draft.richReadOnly);
 for(const id of ['fontSize','color','customSelect'])$('#'+id).disabled=rich;
}

function recordRichEdit(){
 const draft=current();
 if(!draft||draft.richReadOnly)return;
 const result=sanitizeWechatHtml(canonicalMarkup($('#richBody').innerHTML),document);
 draft.richHtml=result.html;draft.body=result.text;draft.richDirty=true;
 $('#body').value=draft.body;
 changed();
}

function appendArticleText(text){
 const draft=current();
 if(typeof draft.richHtml==='string'){
  if(draft.richReadOnly){toast('含微信专属组件，请在微信中编辑正文或改用工作台排版');return;}
  for(const line of text.split('\n')){
   const paragraph=document.createElement('p');paragraph.textContent=line;$('#richBody').append(paragraph);
  }
  recordRichEdit();
 }else{draft.body+='\n\n'+text;show();changed();}
}

$('#richBody').oninput=recordRichEdit;
$('#richBody').ondrop=event=>event.preventDefault();
$('#richBody').onpaste=event=>{
 event.preventDefault();
 if(current()?.richReadOnly||!event.clipboardData)return;
 const editor=$('#richBody'),selection=window.getSelection();
 if(!selection?.rangeCount||!editor.contains(selection.anchorNode)||!editor.contains(selection.focusNode))return;
 const range=selection.getRangeAt(0),fragment=document.createElement('template');
 const html=event.clipboardData.getData('text/html');
 if(html)fragment.innerHTML=sanitizeWechatHtml(html,document).html;
 if(!fragment.content.childNodes.length){
  for(const line of event.clipboardData.getData('text/plain').split(/\r?\n/)){
   const paragraph=document.createElement('p');paragraph.textContent=line;fragment.content.append(paragraph);
  }
 }
 const end=fragment.content.lastChild;
 if(!end)return;
 range.deleteContents();range.insertNode(fragment.content);range.setStartAfter(end);range.collapse(true);
 selection.removeAllRanges();selection.addRange(range);recordRichEdit();
};

for(const button of document.querySelectorAll('[data-rich-format]')){
 button.onmousedown=event=>event.preventDefault();
 button.onclick=()=>{
  const selection=window.getSelection(),editor=$('#richBody');
  if(!selection?.rangeCount||selection.isCollapsed||!editor.contains(selection.anchorNode)||!editor.contains(selection.focusNode)){
   toast('请先选中要设置样式的文字');return;
  }
  const range=selection.getRangeAt(0);
  const wrapper=document.createElement(({bold:'strong',italic:'em',underline:'u'})[button.dataset.richFormat]);
  wrapper.append(range.extractContents());range.insertNode(wrapper);range.selectNodeContents(wrapper);
  selection.removeAllRanges();selection.addRange(range);recordRichEdit();
 };
}

$('#richConvert').onclick=()=>{
 const draft=current();
 if(!draft?.body.trim()){toast('这篇文章没有可转换的文本，请继续用微信原稿模式');return;}
 if(!confirm('改用工作台排版会保留正文文字，图片、嵌入组件及原版式需重新添加。继续吗？'))return;
 delete draft.richHtml;delete draft.richDirty;delete draft.richReadOnly;
 draft.autoSync=false;clearWechatTimer(draft.id);show();changed();
};

let wechatLibrary={items:[],account:'',offset:0,next:null,total:0};
let wechatLibraryBusy=false;
function renderWechatLibrary(){
 $('#wechatLibraryList').innerHTML=wechatLibrary.items.map((group,groupIndex)=>{
  const date=group.updated?new Date(group.updated*1000).toLocaleString('zh-CN'):'';
  const entries=group.articles.map((item,index)=>`<button type="button" class="wechat-library-item" data-wx-group="${groupIndex}" data-wx-index="${index}"><span>${esc(item.title)}${item.author?' · '+esc(item.author):''}</span><small>打开编辑</small></button>`).join('');
  return `<section class="wechat-library-group"><small>${group.articles.length>1?`${group.articles.length} 篇图文 · `:''}${esc(date)}</small>${entries||'<p>微信没有返回这组图文的标题</p>'}</section>`;
 }).join('')||'<p>草稿箱为空</p>';
}
function setWechatLibraryBusy(value){
 wechatLibraryBusy=value;
 $('#wechatLibraryReload').disabled=value;
 $('#wechatLibraryPrev').disabled=value||!wechatLibrary.offset;
 $('#wechatLibraryNext').disabled=value||wechatLibrary.next===null;
 for(const button of $('#wechatLibraryList').querySelectorAll('button'))button.disabled=value;
}
async function loadWechatLibrary(offset){
 if(wechatLibraryBusy||offset==null)return;
 setWechatLibraryBusy(true);
 $('#wechatLibrarySettings').hidden=true;
 $('#wechatLibraryStatus').textContent='正在读取微信草稿…';
 try{
  wechatLibrary=await api('wechat/draft/list',{offset});
  renderWechatLibrary();
  $('#wechatLibraryStatus').textContent=`第 ${Math.floor(wechatLibrary.offset/10)+1} 页 · 共 ${wechatLibrary.total} 组草稿`;
  return true;
 }catch(error){
  $('#wechatLibraryStatus').textContent=error.message;
  $('#wechatLibrarySettings').hidden=false;
  return false;
 }finally{setWechatLibraryBusy(false);}
}
$('#wechatLibraryOpen').onclick=()=>{
 if(councilEntry.enabled){selectCouncilTab('wechat');return;}
 $('#wechatLibraryDialog').showModal();loadWechatLibrary(0);
};
$('#wechatLibraryClose').onclick=()=>$('#wechatLibraryDialog').close();
$('#wechatLibraryReload').onclick=()=>loadWechatLibrary(wechatLibrary.offset);
$('#wechatLibraryPrev').onclick=()=>loadWechatLibrary(Math.max(0,wechatLibrary.offset-10));
$('#wechatLibraryNext').onclick=()=>loadWechatLibrary(wechatLibrary.next);
$('#wechatLibrarySettings').onclick=()=>{if(!councilEntry.enabled)$('#wechatLibraryDialog').close();$('#settings').click();};

async function editWechatArticle(group,index){
 if(!group||wechatLibraryBusy)return;
 setWechatLibraryBusy(true);
 $('#wechatLibraryStatus').textContent='正在打开稿件…';
 try{
  const remote=await api('wechat/draft/read',{wechatId:group.id,wechatAccount:wechatLibrary.account});
  const article=remote.articles[index];
  if(!article)throw Error('这篇图文已从原位置移除，请刷新列表');
  let draft=drafts.find(item=>item.wechatId===group.id&&item.wechatAccount===remote.account&&(item.wechatIndex||0)===index);
  if(draft){
   if(draft.deletedAt){delete draft.deletedAt;draft.autoSync=false;}
   if(draft.wechatRevision!==remote.revision){
    draft.autoSync=false;clearWechatTimer(draft.id);draft.syncError='微信有新版本，已保留本地编辑稿。可点「读取微信版本」核对。';
   }
  }else{
   if(drafts.length>=1000)throw Error('已达到 1000 篇稿件上限');
   const rich=sanitizeWechatHtml(article.content,document);
   draft={
    id:crypto.randomUUID(),title:article.title||'未命名文章',author:article.author||'',digest:article.digest||'',
    body:rich.text,richHtml:rich.html,richDirty:false,richReadOnly:rich.unsupported>0,
    theme:'essay',color:themes.essay.color,fontSize:16,cover:'',
    wechatId:group.id,wechatIndex:index,wechatRevision:remote.revision,wechatAccount:remote.account,
    wechatCover:Boolean(article.thumb_media_id),wechatCoverUrl:wechatImageURL(article.thumb_url),
    autoSync:false,updated:Date.now()
   };
   drafts.unshift(draft);
  }
  active=draft.id;revision++;show();await persist();
  if(councilEntry.enabled)openCouncilEditor();else $('#wechatLibraryDialog').close();
  toast('已打开微信草稿，可在工作台编辑');
 }catch(error){$('#wechatLibraryStatus').textContent=error.message;}
 finally{setWechatLibraryBusy(false);}
}
$('#wechatLibraryList').onclick=event=>{
 const button=event.target.closest('[data-wx-group]');if(!button)return;
 editWechatArticle(wechatLibrary.items[Number(button.dataset.wxGroup)],Number(button.dataset.wxIndex));
};

let councilTab='local',councilSelection=0;
function setCouncilView(editing){
 $('#councilDraftHome').hidden=editing;
 $('.sidebar').hidden=!editing;
 $('#draftEditor').hidden=!editing;
 if(!editing)$('#assistant').hidden=true;
}

function openCouncilEditor(){
 if(!councilEntry.enabled)return;
 councilSelection++;
 setCouncilView(true);
 $('#title').focus();
}

function showCouncilDrafts(tab){
 councilTab=tab;
 setCouncilView(false);
 $('#councilLocal').setAttribute('aria-pressed',String(tab==='local'));
 $('#councilWechat').setAttribute('aria-pressed',String(tab==='wechat'));
 $('#councilLocalPanel').hidden=tab!=='local';
 $('#councilRemotePanel').hidden=tab!=='wechat';
 renderCouncilLocalDrafts();
}

function renderCouncilLocalDrafts(){
 $('#councilLocalList').innerHTML=activeDrafts().map(draft=>
  `<button class="wechat-library-item" type="button" data-council-draft="${esc(draft.id)}"><span>${esc(draft.title||'未命名文章')}</span><small>打开编辑</small></button>`
 ).join('')||'<p>暂无本地草稿</p>';
}

async function selectCouncilTab(tab,fallback=false){
 const selection=++councilSelection;
 $('#councilDraftStatus').textContent='';
 showCouncilDrafts(tab);
 if(tab==='wechat'){
  const loaded=await loadWechatLibrary(0);
  if(loaded===false&&fallback&&selection===councilSelection){
   showCouncilDrafts('local');
   $('#councilDraftStatus').textContent='微信草稿暂不可读取，可先编辑本地草稿。';
  }
 }
}

if(councilEntry.enabled){
 const dialog=$('#wechatLibraryDialog');
 $('#councilRemotePanel').append(dialog);
 dialog.open=true;
 $('#wechatLibraryClose').hidden=true;
 $('#councilDraftBack').hidden=false;
 $('#councilDraftBack').onclick=()=>{showCouncilDrafts(councilTab);$('#council'+(councilTab==='wechat'?'Wechat':'Local')).focus();};
 $('#councilNew').onclick=()=>$('#new').click();
 $('#councilRaw').onclick=()=>$('#rawOpen').click();
 $('#councilSettings').onclick=()=>$('#settings').click();
 $('#councilManage').onclick=()=>$('#libraryOpen').click();
 $('#councilWechat').onclick=()=>selectCouncilTab('wechat');
 $('#councilLocal').onclick=()=>selectCouncilTab('local');
 $('#councilLocalList').onclick=event=>{
  const button=event.target.closest('[data-council-draft]');
  if(!button)return;
  active=button.dataset.councilDraft;
  show();openCouncilEditor();
 };
 showCouncilDrafts('local');
}

try{
 drafts=await api('drafts');
 try{preferences=normalizePreferences(await api('editor/preferences'));}catch(error){toast('读取模板和规范失败：'+error.message);}
 updateTemplateOptions();
 refreshRawPreview();
 if(!activeDrafts().length){
  if(!councilEntry.enabled)create('history',drafts.length===0);
 }else{active=activeDrafts()[0].id;show();}
 if(councilEntry.enabled){
  showCouncilDrafts('local');
  const selected=councilSelection;
  const connected=await api('settings').catch(()=>null);
  if(councilSelection===selected&&connected?.wechatMode==='api'&&connected.appId&&connected.configured?.appSecret)await selectCouncilTab('wechat',true);
 }
}catch(error){toast('读取失败：'+error.message);$('#saveState').textContent='读取失败';}
