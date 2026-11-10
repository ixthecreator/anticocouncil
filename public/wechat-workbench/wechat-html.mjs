const allowedTags=new Set('p div section article span h1 h2 h3 h4 h5 h6 strong b em i u s del small sup sub br hr blockquote pre code ol ul li table thead tbody tfoot tr th td figure figcaption a img'.split(' '));
const blockTags=new Set('p div section article h1 h2 h3 h4 h5 h6 blockquote pre li tr figure figcaption'.split(' '));
const omittedTags=new Set('script style link meta iframe object embed video audio canvas svg form input button textarea select'.split(' '));
const allowedStyles=new Set('color background-color font-family font-size font-style font-weight line-height letter-spacing text-align text-indent text-decoration vertical-align white-space word-break overflow-wrap margin margin-top margin-right margin-bottom margin-left padding padding-top padding-right padding-bottom padding-left width max-width min-width height max-height display border border-top border-right border-bottom border-left border-color border-style border-width border-radius border-collapse box-sizing'.split(' '));
const localImage=/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/;

export function wechatImageURL(value){
 if(typeof value!=='string')return '';
 let url;try{url=new URL(value.startsWith('//')?'https:'+value:value);}catch{return '';}
 if(url.protocol!=='https:'||url.username||url.password||url.port)return '';
 const host=url.hostname;
 return ['qpic.cn','qlogo.cn','weixin.qq.com','wx.qq.com'].some(domain=>host===domain||host.endsWith('.'+domain))?url.href:'';
}

function cleanStyle(value){
 return String(value||'').split(';').flatMap(part=>{
  const colon=part.indexOf(':');
  if(colon<0)return [];
  const key=part.slice(0,colon).trim().toLowerCase(),setting=part.slice(colon+1).trim();
  if(!allowedStyles.has(key)||!setting||setting.length>180||/[<>\\{}]/.test(setting)||/url\s*\(|expression\s*\(|var\s*\(|javascript:|@import/i.test(setting))return [];
  return [`${key}:${setting}`];
 }).join(';');
}

export function sanitizeWechatHtml(html,document){
 const source=document.createElement('template');
 source.innerHTML=String(html||'');
 const destination=document.createElement('div');
 let unsupported=0,media=0;
 const localImages=new Set();
 const text=[];
 const addBreak=()=>{if(text.length&&text.at(-1)!=='\n')text.push('\n');};
 function visit(node,parent){
  if(node.nodeType===3){parent.append(document.createTextNode(node.textContent));text.push(node.textContent);return;}
  if(node.nodeType!==1)return;
  const tag=node.localName;
  if(omittedTags.has(tag)||tag.startsWith('mp')||tag.startsWith('wx-')){unsupported++;return;}
  const isBlock=blockTags.has(tag)||tag==='br';
  if(isBlock)addBreak();
  if(!allowedTags.has(tag)){
   for(const child of node.childNodes)visit(child,parent);
   return;
  }
  const element=document.createElement(tag);
  const style=cleanStyle(node.getAttribute('style'));
  if(style)element.setAttribute('style',style);
  if(tag==='img'){
   const original=node.getAttribute('src')||'';
   const src=wechatImageURL(node.getAttribute('data-src'))||wechatImageURL(original)||(localImage.test(original)?original:'');
   if(!src){unsupported++;return;}
   if(localImage.test(src))localImages.add(src);
   element.setAttribute('src',src);
   element.setAttribute('alt',(node.getAttribute('alt')||'').slice(0,200));
   element.setAttribute('referrerpolicy','no-referrer');
   media++;
  }
  if(tag==='a'){
   const href=node.getAttribute('href')||'';
   let url;try{url=new URL(href);}catch{}
   if(url&&['http:','https:'].includes(url.protocol)&&!url.username&&!url.password){
    element.setAttribute('href',url.href);element.setAttribute('rel','noopener noreferrer');element.setAttribute('target','_blank');
   }
  }
  for(const attr of ['colspan','rowspan']){
   const value=node.getAttribute(attr);
   if((tag==='td'||tag==='th')&&/^\d{1,2}$/.test(value||''))element.setAttribute(attr,value);
  }
  for(const child of node.childNodes)visit(child,element);
  parent.append(element);
  if(isBlock)addBreak();
 }
 for(const node of source.content.childNodes)visit(node,destination);
 return {html:destination.innerHTML,text:text.join('').trim().replace(/\n{3,}/g,'\n\n'),unsupported,media,localImages:[...localImages]};
}
