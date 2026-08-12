#!/usr/bin/env node
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const sizes=[16,32,180,192,512];
const brands={
  studios:{dir:'apps/studios/public',bg:'#171713',fg:'#f4f0e7',accent:'#b76f4d',draw(draw){draw.roundRect(0,0,64,64,12,this.bg);draw.polygon([[16,18],[48,18],[48,26],[28,26],[28,34],[48,34],[48,46],[16,46],[16,38],[36,38],[36,34],[16,34]],this.fg);draw.polygon([[48,18],[48,26],[40,26]],this.accent);}},
  aspheral:{dir:'apps/aspheral/public',bg:'#151716',fg:'#f1eee6',accent:'#6f8b79',draw(draw){draw.roundRect(0,0,64,64,12,this.bg);draw.polygon([[14,46],[30,16],[38,16],[50,46],[41,46],[38,38],[25,38],[21,46]],this.fg);draw.polygon([[28,30],[36,30],[32,19]],this.bg);draw.circle(48,17,5,this.accent);}},
  ilmp:{dir:'apps/ilmp/public',bg:'#171615',fg:'#f1eee6',accent:'#9a795f',draw(draw){draw.roundRect(0,0,64,64,12,this.bg);draw.strokeRect(14,14,36,36,5,this.fg);draw.line(14,26,50,26,3,this.accent);draw.line(26,14,26,50,3,this.accent);draw.strokeRect(29,29,21,21,3,this.accent);}}
};
for(const [name,brand] of Object.entries(brands)){for(const size of sizes){const scale=Math.max(4,Math.ceil(256/size)),canvas=new Canvas(size*scale,size*scale,scale*size/64);brand.draw(canvas);const png=canvas.toPng(size,size,scale);const file=size===180?'apple-touch-icon.png':size===16?'favicon-16.png':size===32?'favicon-32.png':`icon-${size}.png`;const path=join(brand.dir,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,png);console.log(`generated ${name} ${size}x${size}: ${path}`)}}

class Canvas{
  constructor(width,height,unit){this.width=width;this.height=height;this.unit=unit;this.data=new Uint8Array(width*height*4)}
  color(hex){return[parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16),255]}
  pixel(x,y,color){if(x<0||y<0||x>=this.width||y>=this.height)return;const i=(y*this.width+x)*4;this.data.set(color,i)}
  insideRounded(px,py,x,y,w,h,r){const u=this.unit,X=px/u,Y=py/u;if(X>=x+r&&X<=x+w-r&&Y>=y&&Y<=y+h)return true;if(Y>=y+r&&Y<=y+h-r&&X>=x&&X<=x+w)return true;const centers=[[x+r,y+r],[x+w-r,y+r],[x+r,y+h-r],[x+w-r,y+h-r]];return centers.some(([cx,cy])=>(X-cx)**2+(Y-cy)**2<=r*r)}
  roundRect(x,y,w,h,r,hex){const c=this.color(hex);for(let py=Math.floor(y*this.unit);py<Math.ceil((y+h)*this.unit);py++)for(let px=Math.floor(x*this.unit);px<Math.ceil((x+w)*this.unit);px++)if(this.insideRounded(px+.5,py+.5,x,y,w,h,r))this.pixel(px,py,c)}
  polygon(points,hex){const c=this.color(hex),ys=points.map(p=>p[1]),minY=Math.floor(Math.min(...ys)*this.unit),maxY=Math.ceil(Math.max(...ys)*this.unit);for(let py=minY;py<maxY;py++){const y=(py+.5)/this.unit,ints=[];for(let i=0,j=points.length-1;i<points.length;j=i++){const [xi,yi]=points[i],[xj,yj]=points[j];if((yi>y)!==(yj>y))ints.push((xj-xi)*(y-yi)/(yj-yi)+xi)}ints.sort((a,b)=>a-b);for(let k=0;k+1<ints.length;k+=2)for(let px=Math.floor(ints[k]*this.unit);px<Math.ceil(ints[k+1]*this.unit);px++)this.pixel(px,py,c)}}
  circle(cx,cy,r,hex){const c=this.color(hex);for(let py=Math.floor((cy-r)*this.unit);py<Math.ceil((cy+r)*this.unit);py++)for(let px=Math.floor((cx-r)*this.unit);px<Math.ceil((cx+r)*this.unit);px++){const x=(px+.5)/this.unit,y=(py+.5)/this.unit;if((x-cx)**2+(y-cy)**2<=r*r)this.pixel(px,py,c)}}
  fillRect(x,y,w,h,hex){const c=this.color(hex);for(let py=Math.floor(y*this.unit);py<Math.ceil((y+h)*this.unit);py++)for(let px=Math.floor(x*this.unit);px<Math.ceil((x+w)*this.unit);px++)this.pixel(px,py,c)}
  strokeRect(x,y,w,h,t,hex){this.fillRect(x,y,w,t,hex);this.fillRect(x,y+h-t,w,t,hex);this.fillRect(x,y,t,h,hex);this.fillRect(x+w-t,y,t,h,hex)}
  line(x1,y1,x2,y2,t,hex){if(Math.abs(y2-y1)<1e-6)this.fillRect(Math.min(x1,x2),y1-t/2,Math.abs(x2-x1),t,hex);else if(Math.abs(x2-x1)<1e-6)this.fillRect(x1-t/2,Math.min(y1,y2),t,Math.abs(y2-y1),hex)}
  toPng(outW,outH,scale){const rgba=new Uint8Array(outW*outH*4);for(let y=0;y<outH;y++)for(let x=0;x<outW;x++){const sum=[0,0,0,0];for(let sy=0;sy<scale;sy++)for(let sx=0;sx<scale;sx++){const i=(((y*scale+sy)*this.width)+(x*scale+sx))*4;for(let c=0;c<4;c++)sum[c]+=this.data[i+c]}const o=(y*outW+x)*4;for(let c=0;c<4;c++)rgba[o+c]=Math.round(sum[c]/(scale*scale))}const raw=new Uint8Array((outW*4+1)*outH);for(let y=0;y<outH;y++){raw[y*(outW*4+1)]=0;raw.set(rgba.subarray(y*outW*4,(y+1)*outW*4),y*(outW*4+1)+1)}return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr(outW,outH)),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])}
}
function ihdr(w,h){const b=Buffer.alloc(13);b.writeUInt32BE(w,0);b.writeUInt32BE(h,4);b[8]=8;b[9]=6;return b}
function chunk(type,data){const t=Buffer.from(type),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data]))>>>0);return Buffer.concat([len,t,data,crc])}
function crc32(buf){let c=0xffffffff;for(const byte of buf){c^=byte;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
