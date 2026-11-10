import {parseBlocks,inlineMarkers} from './markers.mjs';
import {normalizeTemplate} from './editor-options.mjs';

import {renderReference} from './reference-layout.mjs';

export const themes={reference:{name:'参考版式',color:'#0d0015',font:'sans-serif',label:'参考版式'},history:{name:'史料',color:'#8b4939',font:'Georgia, SimSun, serif',label:'历史 · 笺注'},literature:{name:'文学',color:'#485d51',font:'Georgia, SimSun, serif',label:'文学 · 片刻'},essay:{name:'随笔',color:'#6e655c',font:'Microsoft YaHei, sans-serif',label:'随笔 · 日常'},review:{name:'书评',color:'#465c79',font:'Georgia, SimSun, serif',label:'阅读 · 札记'}};
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function safeURL(s){return /^(https?:\/\/|\/uploads\/|\/sample\.svg$)/i.test(s||'')?s:'';}
export function render(d){if(d.theme==='reference')return renderReference(d,esc,safeURL);const custom=normalizeTemplate(d.template);const base=custom?.theme||d.theme;const t=Object.hasOwn(themes,base)?themes[base]:themes.history,c=/^#[0-9a-f]{6}$/i.test(d.color||'')?d.color:(custom?.color||t.color);const size=Math.min(22,Math.max(13,Number(d.fontSize)||custom?.fontSize||16));const key=Object.hasOwn(themes,base)?base:'history';const layout={history:{outer:'background:#faf6ec;border-top:3px double '+c,head:'border-bottom:1px solid #d4c3aa;padding-bottom:12px',p:'text-indent:2em;line-height:2.2',quote:'background:#f1eadb;border:1px solid #d4c3aa',img:'padding:6px;border:1px solid #d4c3aa'},literature:{outer:'background:white;padding-top:35px',head:'text-align:center;letter-spacing:5px;font-weight:400;padding:20px 0',p:'line-height:2.5;letter-spacing:1px',quote:'text-align:center;border:0;border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:30px 15px;font-style:italic',img:'margin-left:-10px;margin-right:-10px'},essay:{outer:'background:white',head:'border-left:4px solid '+c+';padding-left:14px',p:'line-height:2',quote:'border:0;border-radius:12px;background:#f2f0e9;padding:22px',img:'padding:12px;background:#f3f1e9'},review:{outer:'background:#f1f4f7',head:'background:'+c+';color:white;padding:12px;font-size:18px',p:'line-height:2',quote:'background:white;border-left:3px solid '+c+';padding:22px',img:'padding:18px;background:white;border-bottom:3px solid '+c}}[key]||{};let section=0;
 const quoteStyle=custom?({box:'border:1px solid #dedbd3;background:#f6f4ef',line:`border-left:3px solid ${c};background:#faf8f2`,plain:'border:0;background:transparent'})[custom.quote]:layout.quote;
 function inline(text){
  let html='',start=0;
  for(const mark of inlineMarkers(text)){
   html+=esc(text.slice(start,mark.start));
   const value=esc(mark.text);
   html+=mark.kind==='emphasis'?`<strong style="color:${c};background:#f4efe2;padding:0 2px">${value}</strong>`:`<strong>${value}</strong>`;
   start=mark.end;
  }
  return (html+esc(text.slice(start))).replace(/\r?\n/g,'<br/>');
 }
 const body=parseBlocks(String(d.body||'')).map(block=>{
  const {kind,text,src}=block;
  if(kind==='image')return `<section style="margin:28px 0;${layout.img}"><img src="${esc(safeURL(src))}" alt="${esc(text)}" style="width:100%;display:block;border-radius:2px"/><p style="font-size:12px;color:#888;text-align:center;margin:8px 0">${esc(text)}</p></section>`;
  if(kind==='line')return '<hr style="border:0;border-top:1px solid #dedbd3;margin:32px 0"/>';
  if(kind==='heading'){
   section++;
   const number=custom&&!custom.numbered?'':custom?.numbered&&key!=='history'&&key!=='review'?`${section}. `:key==='review'?String(section).padStart(2,'0')+' / ':key==='history'?'第 '+section+' 节 · ':'';
   return `<h2 style="color:${c};font-size:21px;margin:32px 0 18px;font-weight:600;${layout.head};${custom?`font-size:${custom.headingSize}px`:""}">${number}${inline(text)}</h2>`;
  }
  if(kind==='quote')return `<blockquote style="margin:24px 0;padding:14px 18px;border-left:3px solid ${c};background:#f6f4ef;color:#666;${quoteStyle}">${inline(text)}</blockquote>`;
  if(kind==='note')return `<section style="margin:24px 0;padding:14px 18px;border:1px solid #dedbd3;background:#faf8f2"><p style="color:${c};font-size:12px;font-weight:bold;margin:0 0 6px">编者按</p><p style="margin:0">${inline(text)}</p></section>`;
  return `<p style="margin:0 0 22px;text-align:justify;line-height:2;${layout.p};${custom?`line-height:${custom.lineHeight};margin-bottom:${custom.paragraphGap}px`:""}">${inline(text)}</p>`;
 }).join('');
 return `<section data-layout="${esc(key)}" style="font-family:${t.font};font-size:${size}px;color:#353530;line-height:1.9;padding:12px 18px;${layout.outer}">${key==='essay'?'':`<p style="font-family:sans-serif;font-size:11px;letter-spacing:4px;color:${c};margin:12px 0 24px;text-align:center">${t.label}</p>`}${key==='review'?`<section style="background:white;border:1px solid #dce0e7;padding:20px;margin-bottom:25px"><small style="color:${c}">READING NOTES</small><p style="margin-bottom:0">${esc(d.digest||'阅读 · 思考 · 对话')}</p></section>`:''}${body}</section>`;}
