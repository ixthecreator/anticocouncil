import {referenceLayout} from './reference-layout.mjs';

const layouts=new Set(['history','literature','essay','review']);

function bounded(value,min,max,fallback){
 if(value===''||value==null)return fallback;
 const number=Number(value);
 return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback;
}

export function normalizeTemplate(value){
 if(!value||typeof value.id!=='string'||!/^custom-[a-f0-9-]{36}$/.test(value.id))return null;
 const name=String(value.name||'').trim().slice(0,40);
 if(!name)return null;
 return {
  id:value.id,name,theme:layouts.has(value.theme)?value.theme:'essay',
  color:/^#[a-f\d]{6}$/i.test(value.color||'')?value.color:'#435b48',
  fontSize:bounded(value.fontSize,13,22,16),lineHeight:bounded(value.lineHeight,1.4,3,2),
  paragraphGap:bounded(value.paragraphGap,4,48,22),headingSize:bounded(value.headingSize,15,32,21),
  quote:['box','line','plain'].includes(value.quote)?value.quote:'line',
  numbered:value.numbered===true||value.numbered==='on'
 };
}

export function normalizePreferences(value={}){
 const seen=new Set();
 const templates=(Array.isArray(value.templates)?value.templates:[]).slice(0,100)
  .map(normalizeTemplate).filter(item=>item&&!seen.has(item.id)&&seen.add(item.id));
 const rules=value.rules||{};
 return {templates,reference:referenceLayout(value.reference),rules:{
  text:String(rules.text||'').slice(0,4000),
  titleLimit:Math.round(bounded(rules.titleLimit,0,200,0)),
  requireAuthor:rules.requireAuthor===true||rules.requireAuthor==='on',
  requireCover:rules.requireCover===true||rules.requireCover==='on',
  forbidden:String(rules.forbidden||'').slice(0,1000)
 }};
}

export function checkGuidelines(draft,rules){
 const issues=[];
 if(rules.titleLimit&&Array.from(draft.title||'').length>rules.titleLimit)issues.push(`标题超过 ${rules.titleLimit} 字`);
 if(rules.requireAuthor&&!draft.author?.trim())issues.push('缺少作者');
 if(rules.requireCover&&!draft.cover&&!draft.wechatCover)issues.push('缺少封面');
 const text=[draft.title,draft.digest,draft.body].join('\n');
 for(const word of new Set(rules.forbidden.split(/[,，\n]/).map(word=>word.trim()).filter(Boolean))){
  if(text.includes(word))issues.push(`含禁用词：${word}`);
 }
 return issues;
}

export function detachRemote(draft){
 const {wechatId,wechatRevision,wechatAccount,wechatIndex,wechatCover,wechatCoverUrl,syncedAt,autoSync,syncError,...local}=draft;
 return local;
}
