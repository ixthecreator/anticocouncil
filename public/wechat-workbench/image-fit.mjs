// Sizes an image for the WeChat API before it leaves the browser. Limits are
// base64 lengths: body images go through media/uploadimg (1 MB), covers through
// material/add_material and the site endpoint's own 3.5M-character cap.
export const wechatImageLimits={body:1_350_000,cover:3_400_000};

const payloadLength=data=>data.length-data.indexOf(',')-1;

function load(data){
 return new Promise((resolve,reject)=>{
  const image=new Image();
  image.onload=()=>resolve(image);
  image.onerror=()=>reject(Error('无法读取图片，请重新添加'));
  image.src=data;
 });
}

// Returns the data URL unchanged when it already fits; otherwise re-encodes it
// as JPEG on a white ground, lowering quality and then size until it fits.
// GIFs pass through untouched so an animation is never silently flattened.
export async function fitImage(data,limit){
 if(payloadLength(data)<=limit||data.startsWith('data:image/gif'))return data;
 const image=await load(data);
 const canvas=document.createElement('canvas');
 const context=canvas.getContext('2d');
 let side=Math.min(2560,Math.max(image.naturalWidth,image.naturalHeight));
 for(let round=0;round<12;round++){
  const scale=side/Math.max(image.naturalWidth,image.naturalHeight);
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  context.fillStyle='#fff';
  context.fillRect(0,0,canvas.width,canvas.height);
  context.drawImage(image,0,0,canvas.width,canvas.height);
  for(const quality of [.9,.82,.74]){
   const result=canvas.toDataURL('image/jpeg',quality);
   if(payloadLength(result)<=limit)return result;
  }
  side=Math.round(side*.8);
 }
 throw Error('图片过大，无法压缩到微信允许的大小，请换一张图片');
}

export async function imageDigest(data){
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(data));
 return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
