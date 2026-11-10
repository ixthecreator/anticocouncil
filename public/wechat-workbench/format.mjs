/** Format plain text without rewriting, summarizing, or inventing sentences. */
export function formatRaw(raw,theme='history'){
 const text=String(raw||'').replace(/\r\n?/g,'\n').replace(/^\uFEFF/,'').trim();
 if(!text)throw Error('请先输入原文');
 const lines=text.split('\n').map(x=>x.trim()).filter(Boolean);
 const first=lines[0];
 const explicitTitle=first.match(/^#\s+(.+)$/);
 const heading=/^(?:\[(?:段落|编者按)\]|#{2,6}\s|>\s|!\[|[“「『]|[一二三四五六七八九十百]+[、．.]|第[一二三四五六七八九十百0-9]+[章节部分]|\d+[、．.]\s*\S)/;
 const looksLikeTitle=first.length<=60&&!heading.test(first)&&!/[。！？；!?]$/.test(first);
 const title=lines.length>1?(explicitTitle?.[1]||(looksLikeTitle?first:'')):'';
 const content=title?lines.slice(1):lines;
 const blocks=[];
 for(const line of content){
  if(/^\[(?:段落|编者按)\]/.test(line)||/^!\[.*\]\(.*\)$/.test(line)||/^#{1,2}\s/.test(line)||/^>\s/.test(line)){blocks.push(line);continue;}
  if(line.length<=45&&/^(?:[一二三四五六七八九十百]+[、．.]|[（(][一二三四五六七八九十百0-9]+[）)]|第[一二三四五六七八九十百0-9]+[章节部分]|\d+[、．.]\s*\S)/.test(line)){blocks.push('## '+line);continue;}
  if(/^[“「『][\s\S]+[”」』]$/.test(line)&&line.length<500){blocks.push('> '+line);continue;}
  if(line.length<=220){blocks.push(line);continue;}
  // Split between characters so punctuation and closing quotes stay in the draft.
  const sentences=line.split(/(?<=[。！？](?:[”」』）】])?)(?![。！？… ”」』）】])/u);
  let paragraph='';
  for(const sentence of sentences){
   paragraph+=sentence;
   if(paragraph.length>=150){blocks.push(paragraph);paragraph='';}
  }
  if(paragraph)blocks.push(paragraph);
 }
 return {title,body:blocks.join('\n\n'),theme};
}
