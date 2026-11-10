export const markerLabels={paragraph:'段落',heading:'小标题',emphasis:'重点',bold:'加粗',quote:'引文',note:'编者按',line:'分隔线',image:'图片'};

export function parseBlocks(body){
 const blocks=[];
 let start=0;
 for(const separator of body.matchAll(/\r?\n[ \t]*\r?\n(?:[ \t]*\r?\n)*/g)){
  addBlock(start,separator.index);
  start=separator.index+separator[0].length;
 }
 addBlock(start,body.length);
 return blocks;

 function addBlock(from,to){
  const source=body.slice(from,to);
  if(!source.trim())return;
  const image=source.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if(image){blocks.push({kind:'image',text:image[1],src:image[2],start:from,end:to});return;}
  if(/^---+$/.test(source.trim())){blocks.push({kind:'line',text:'',start:from,end:to});return;}
  const prefix=source.match(/^(## |>[ \t]+|\[(?:段落|编者按)\][ \t]?(?:\r?\n)?)/)?.[0]||'';
  const kind=prefix.startsWith('##')?'heading':prefix.startsWith('>')?'quote':prefix.startsWith('[编者按]')?'note':'paragraph';
  blocks.push({kind,text:source.slice(prefix.length),start:from,end:to,prefixLength:prefix.length});
 }
}

export function inlineMarkers(text){
 return Array.from(text.matchAll(/\*\*([^*\r\n]+)\*\*|==([^=\r\n]+)==/g),match=>({
  kind:match[1]===undefined?'emphasis':'bold',text:match[1]??match[2],start:match.index,end:match.index+match[0].length
 }));
}

export function listMarkers(body){
 return parseBlocks(body).flatMap(block=>{
  if(block.kind==='image'||block.kind==='line')return [block];
  const contentStart=block.start+block.prefixLength;
  return [
   {...block,replacement:block.prefixLength?block.text:undefined},
   ...inlineMarkers(block.text).map(mark=>({...mark,start:contentStart+mark.start,end:contentStart+mark.end,replacement:mark.text}))
  ];
 });
}
