import { render, esc } from '../public/wechat-workbench/render.mjs';
import { referenceAssetUrls } from '../public/wechat-workbench/reference-layout.mjs';
import { builtinImages } from '../public/wechat-workbench/hosted-api.mjs';
import { wechatImageURL } from '../public/wechat-workbench/wechat-html.mjs';

const WECHAT_ORIGIN='https://mp.weixin.qq.com';
const TITLE_INPUT='input[placeholder*="标题"]:visible,textarea[placeholder*="标题"]:visible,[contenteditable="true"][data-placeholder*="标题"]:visible';

function onWechat(page){
 return page&&!page.isClosed()&&URL.parse(page.url())?.origin===WECHAT_ORIGIN;
}

function visibleText(page,text){
 return page.getByText(text,{exact:true}).and(page.locator(':visible'));
}

// Keep this function self-contained so Playwright can run it in the editor frame.
export function readEditorField(element){
 if(typeof element.value==='string')return {text:element.value.trim(),media:false};
 const content=element.cloneNode(true);
 for(const placeholder of content.querySelectorAll('.editor_content_placeholder.ProseMirror-widget[contenteditable="false"]'))placeholder.remove();
 return {
  text:(content.textContent||'').replace(/[\u200B\uFEFF]/g,'').trim(),
  media:Boolean(content.querySelector('img,video,audio,iframe,object,embed,svg,table,[data-node-type="image"],[data-node-type="video"]'))
 };
}

export class WechatBrowser {
 constructor(context, page, images){this.context=context;this.page=page;this.images=images;}
 async openArticle(){
  const landing=this.page;
  if(!onWechat(landing))throw Error('公众号页面已离开微信官方域名');
  const existing=landing.locator(TITLE_INPUT);
  if(await existing.count()===1)return existing;

  const previousPages=new Set(this.context.pages());
  const newCreation=visibleText(landing,'新的创作');
  if(await newCreation.count()===1){
   const article=visibleText(landing,'文章');
   if(await article.count()!==1)await newCreation.click({timeout:5000});
   await article.waitFor({state:'visible',timeout:5000}).catch(()=>{throw Error('已打开「新的创作」，但未找到唯一的「文章」入口');});
   await article.click({timeout:5000});
  }else{
   const legacy=visibleText(landing,'图文消息');
   if(await legacy.count()!==1)throw Error('当前微信页面未找到「新的创作」。请回到公众号首页后重试');
   await legacy.click({timeout:5000});
  }

  // WeChat can load the editor in place or open a new tab in the same session.
  const deadline=Date.now()+18000;
  while(Date.now()<deadline){
   for(const page of this.context.pages()){
    if((page!==landing&&previousPages.has(page))||!onWechat(page))continue;
    const field=page.locator(TITLE_INPUT);
    if(await field.count()===1){this.page=page;await page.bringToFront();return field;}
   }
   await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw Error('已选择「新的创作 → 文章」，但编辑页未就绪。请检查微信窗口是否弹出登录或验证提示');
 }
 async editable(){
  const deadline=Date.now()+7000;
  while(Date.now()<deadline){
   const candidates=[];
   for(const frame of this.page.frames()){
    const editors=frame.locator('[contenteditable]:visible,body:visible');
    const matches=await editors.evaluateAll(elements=>elements.flatMap((element,index)=>{
     const designMode=element===document.body&&document.designMode==='on';
     if(!designMode&&(!element.isContentEditable||element.getAttribute('contenteditable')==='false'))return [];
     if(!designMode&&!element.hasAttribute('contenteditable'))return [];
     const label=['placeholder','data-placeholder','aria-label','id','class'].map(name=>element.getAttribute(name)||'').join(' ');
     if(/标题|作者|摘要|搜索|title|author|digest|search/i.test(label))return [];
     const {width,height}=element.getBoundingClientRect();
     const rich=/正文|article.?content|ueditor|ProseMirror|ql-editor|tiptap/i.test(label)||element.hasAttribute('data-slate-editor')||designMode;
     return [{index,rich,area:width*height,height}];
    })).catch(()=>[]);
    for(const item of matches)candidates.push({...item,locator:editors.nth(item.index)});
   }
   const rich=candidates.filter(item=>item.rich);
   if(rich.length===1)return rich[0].locator;
   if(candidates.length===1)return candidates[0].locator;
   const [largest,next]=candidates.sort((a,b)=>b.area-a.area);
   if(largest?.height>=90&&largest.area>(next?.area||0)*1.75)return largest.locator;
   await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw Error('已打开文章编辑页，但没有识别到唯一的正文编辑区');
 }
 async paste(editor,html){
  await editor.focus();
  await editor.evaluate((node,markup)=>{
   const data=new DataTransfer();
   data.setData('text/html',markup);
   node.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));
  },html);
  const pasted=await editor.evaluate(readEditorField);
  if(pasted.text||pasted.media)return;
  await this.context.grantPermissions(['clipboard-read','clipboard-write'],{origin:WECHAT_ORIGIN});
  await this.page.evaluate(async markup=>{
   await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([markup],{type:'text/html'})})]);
  },html);
  await editor.press('Control+V');
 }
 async fillCover(mime,base64){
  const tips=this.page.getByText(/^(?:选择封面|从图片库选择|上传封面)$/);
  const trigger=tips.filter({visible:true}).first();
  if(!await trigger.count())throw Error('微信没有显示可识别的封面上传入口');
  await trigger.click({timeout:5000});
  let file=this.page.locator('input[type="file"][accept*="image"]').last();
  if(!await file.count()){
   const upload=this.page.getByText(/^(?:本地上传|上传图片)$/).filter({visible:true}).first();
   if(!await upload.count())throw Error('微信没有显示封面文件选择入口');
   const [chooser]=await Promise.all([this.page.waitForEvent('filechooser',{timeout:6000}),upload.click()]);
   await chooser.setFiles({name:'cover'+({'image/png':'.png','image/webp':'.webp'}[mime]||'.jpg'),mimeType:mime,buffer:Buffer.from(base64,'base64')});
  }else{
   await file.setInputFiles({name:'cover'+({'image/png':'.png','image/webp':'.webp'}[mime]||'.jpg'),mimeType:mime,buffer:Buffer.from(base64,'base64')});
  }
  const next=this.page.getByText(/^(?:下一步|确定|完成)$/).filter({visible:true}).last();
  await next.waitFor({timeout:8000});
  await next.click();
  const finish=this.page.getByText(/^(?:确定|完成)$/).filter({visible:true}).last();
  if(await finish.count())await finish.click();
 }
 async submit(d){
  if(!onWechat(this.page))throw Error('微信登录窗口已关闭');
  if(!d.title?.trim()||!d.body?.trim())throw Error('请先填写标题与正文');
  let html=render(d);
  const urls=new Set(Array.from(d.body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g),match=>match[1]));
  for(const src of referenceAssetUrls(d)){
   if(!html.includes(src))continue;
   if(Object.hasOwn(builtinImages,src))html=html.replaceAll(src,esc(builtinImages[src]));
   else urls.add(src);
  }
  if([...urls].some(src=>src.endsWith('.gif')))throw Error('自定义 GIF 可在工作台预览。存公众号草稿时可选内置动图或静态图片');
  await this.page.bringToFront();
  const field=await this.openArticle();
  const editor=await this.editable();
  const [existingTitle,existingBody]=await Promise.all([field.evaluate(readEditorField),editor.evaluate(readEditorField)]);
  if(existingTitle.text||existingBody.text||existingBody.media)throw Error('微信编辑器已有内容。为避免覆盖，请新建一篇空白文章后重试');
  for(const src of urls){
   if(!/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(src))throw Error('请先把示例图或外部图替换为本地上传图片');
   const match=(Object.hasOwn(this.images,src)?this.images[src]:'').match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
   if(!match)throw Error('缺少正文配图，请重新添加');
   const [,mime,base64]=match;
   await this.context.grantPermissions(['clipboard-read','clipboard-write'],{origin:'https://mp.weixin.qq.com'});
   await this.page.evaluate(async({base64,mime})=>{const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const bitmap=await createImageBitmap(new Blob([bytes],{type:mime}));const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);},{base64,mime});
   const images=editor.locator('img[src^="https://"]');
   const image=images.nth(await images.count());
   await editor.click();await this.page.keyboard.press('Control+V');
   await image.waitFor({timeout:18000});const uploaded=await image.getAttribute('src');if(!wechatImageURL(uploaded))throw Error('图片上传未得到微信素材地址，请在微信窗口检查');html=html.replaceAll(src,esc(uploaded));
  }
  if(urls.size){await editor.press('Control+a');await editor.press('Backspace');}
  await this.paste(editor,html);
  const inserted=await editor.evaluate(readEditorField);
  if(!inserted.text&&!inserted.media)throw Error('微信没有接收排版正文，已停止保存。请保留本地稿并重试');
  await field.fill(d.title);
  if((await field.evaluate(readEditorField)).text!==d.title.trim())throw Error('微信没有完整接收标题，请检查标题长度后重试');
  const author=this.page.locator('input[placeholder*="作者"]:visible');if(d.author&&await author.count()===1)await author.fill(d.author);
  const digest=this.page.locator('textarea[placeholder*="摘要"]:visible');if(d.digest&&await digest.count()===1)await digest.fill(d.digest);
  if(d.cover){
   const image=this.images[d.cover];
   const match=String(image||'').match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
   if(!match)throw Error('请重新上传封面图片');
   await this.fillCover(match[1],match[2]);
  }
  const save=this.page.getByText('保存为草稿',{exact:true});if(await save.count()!==1)throw Error('正文已填入微信，但未识别到“保存为草稿”。请在微信窗口完成封面选择与保存');
  let result;
  try{
   const [response]=await Promise.all([
    this.page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).origin==='https://mp.weixin.qq.com'&&/operate_appmsg/.test(r.url()),{timeout:18000}),
    save.click()
   ]);
   result=await response.json();
  }catch{throw Error('微信尚未确认保存。请检查封面、登录验证或提示，不要重复提交');}
  const ret=result.base_resp?.ret??result.ret??result.errcode;if(ret!==0)throw Error('微信未保存：'+(result.base_resp?.err_msg||result.errmsg||ret||'请检查微信页面提示'));
  return {ok:true,message:'微信已确认保存草稿',browserSaved:true};
 }
}
