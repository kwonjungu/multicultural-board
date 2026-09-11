import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const names=['stage-1-egg','stage-2-larva','stage-3-pupa','stage-4-bee','stage-5-queen','acc-glasses','acc-scarf','acc-cape','held-book','held-flag','held-honeypot'];
const results=[];
for(const name of names){
  const file=`public/stickers/${name}.png`;
  const bytes=await readFile(resolve(root,file));
  const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let left=info.width,top=info.height,right=-1,bottom=-1;
  for(let y=0;y<info.height;y++) for(let x=0;x<info.width;x++) {
    if(data[(y*info.width+x)*info.channels+info.channels-1]>8){
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
  }
  const scale=Math.min(320/info.width,320/info.height);
  results.push({file,sha256:createHash('sha256').update(bytes).digest('hex'),width:info.width,height:info.height,
    alphaThreshold:8,alphaBounds:right<0?null:{left,top,right,bottom},
    contain320:{scale,offsetX:(320-info.width*scale)/2,offsetY:(320-info.height*scale)/2}});
}
const output=resolve(root,'docs/child-ux-20260911/asset-evidence.json');
await writeFile(output,JSON.stringify({note:'Read-only measurement. No source images modified. Alpha bbox is not an anatomical anchor.',results},null,2)+'\n');
for(const r of results) console.log(`${r.file}: ${r.width}x${r.height}, contain320 offset ${r.contain320.offsetX.toFixed(2)},${r.contain320.offsetY.toFixed(2)}`);
