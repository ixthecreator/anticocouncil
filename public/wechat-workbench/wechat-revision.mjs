import {createHash} from 'node:crypto';

export function draftRevision(newsItems){
 if(!Array.isArray(newsItems)||newsItems.length===0)throw Error('微信没有返回可识别的草稿正文');
 const fields=newsItems.map(article=>[
  article.title,article.author,article.digest,article.content,article.thumb_media_id,
  article.content_source_url,article.need_open_comment,article.only_fans_can_comment,article.show_cover_pic
 ]);
 return createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}

export function wechatArticleIndex(value){
 const index=value??0;
 if(!Number.isInteger(index)||index<0||index>99)throw Error('微信图文位置无效');
 return index;
}

export function buildWechatArticle(draft,existing,html,coverId){
 const article={
  title:draft.title,author:draft.author||'',digest:draft.digest||'',content:html,
  thumb_media_id:coverId,
  content_source_url:existing?.content_source_url||'',
  need_open_comment:existing?.need_open_comment??0,
  only_fans_can_comment:existing?.only_fans_can_comment??0
 };
 if(existing?.show_cover_pic!==undefined)article.show_cover_pic=existing.show_cover_pic;
 return article;
}

export function verifyRevision(draft,account,revision){
 if(draft.wechatAccount!==account||!draft.wechatRevision||draft.wechatRevision!==revision){
  const error=Error('微信草稿版本不同，已暂停覆盖。请先读取微信版本并核对。');
  error.status=409;
  throw error;
 }
}
