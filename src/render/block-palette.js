// Owns render-time grading of independently authored block atlas paint, leaving source assets intact.
const STONE = new Set(['stone','tower','gate','wood','stairs','door','magazine','palace','mount','foundation']);
const smooth = (a,b,x) => { const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };

/** Grade authored sRGB bytes; tile indices count upward from the atlas bottom, as glTF UVs do. */
export function gradeBlockPixels(data, width, manifest) {
  const tile=manifest.atlas.tile_px, height=data.length/4/width, columns=width/tile;
  const original=data.slice();
  const light=i=>(original[i]+original[i+1]+original[i+2])/3;
  for(const block of manifest.blocks) {
    if(!STONE.has(block.key) && block.key!=='roof') continue;
    const plain=['stone','mount','foundation'].includes(block.key);
    const tiles=[...block.atlas_tiles??[],...(block.damage_atlas_tiles??[]).flat()];
    for(const index of tiles) {
      const x0=index%columns*tile, y0=height-(Math.floor(index/columns)+1)*tile;
      const gain=index%4===2 ? .15 : plain ? .35 : .8;
      for(let y=y0;y<y0+tile;y++)for(let x=x0;x<x0+tile;x++) {
        const i=(y*width+x)*4, r=data[i],g=data[i+1],b=data[i+2];
        if(!data[i+3])continue;
        if(block.key==='roof') {
          // 2026-10-17: fired clay needs a red face under the neutral forest light.
          if(r>g*1.7 && g>b*1.15) {data[i]=r*1.13;data[i+1]=g*.96;data[i+2]=b*.94;}
        } else if(r>=g-3 && r-g<22 && g-b>=0 && g-b<30) {
          // Lift pale limestone faces while retaining dark recessed mortar and cracks.
          // Chromatic oak, glazing and ivy are deliberately outside this neutral-stone range.
          // Filter the grading signal, not the mortar edge: high-frequency grain must not
          // receive a second contrast boost. Top faces already receive direct sunlight.
          const local=(2*light(i)+light((y*width+Math.max(x0,x-2))*4)+light((y*width+Math.min(x0+tile-1,x+2))*4)
            +light((Math.max(y0,y-2)*width+x)*4)+light((Math.min(y0+tile-1,y+2)*width+x)*4))/6;
          const lift=(88*smooth(70,140,local)-8)*gain;
          data[i]=r+lift+5;data[i+1]=g+lift+1;data[i+2]=b+lift-3;
        }
      }
    }
  }
  return data;
}

/** The canvas is derived only from our authored atlas, never from reference imagery. */
export function gradeBlockAtlas(texture,manifest) {
  if(!manifest.blocks.some(b=>b.atlas_tiles))return texture; // kit v0 keeps its own palette
  const canvas=document.createElement('canvas');
  canvas.width=texture.image.width;canvas.height=texture.image.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(texture.image,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  gradeBlockPixels(pixels.data,canvas.width,manifest);ctx.putImageData(pixels,0,0);
  texture.image=canvas;texture.needsUpdate=true;return texture;
}
