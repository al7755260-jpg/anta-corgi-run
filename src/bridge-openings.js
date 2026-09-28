import * as T from 'three';
// Game bridge entrances. Only web runtime copies are cut; source assets are retained.
export const bridgeOpenings=[
 {min:[-57,6.14,-12],max:[-52.3,8.1,-6.9]},
 {min:[48.2,6.16,22.8],max:[51.8,8.1,28.7]}
];
const boxes=bridgeOpenings.map(b=>new T.Box3(new T.Vector3(...b.min),new T.Vector3(...b.max)));
function split(poly,axis,value,sign){const inside=[],outside=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a.p[axis]-value)*sign,db=(b.p[axis]-value)*sign;const ia=da>=-1e-7,ib=db>=-1e-7;(ia?inside:outside).push(a);if(ia!==ib){const t=da/(da-db),v={p:a.p.map((x,j)=>x+(b.p[j]-x)*t),w:a.w.map((x,j)=>x+(b.w[j]-x)*t)};inside.push(v);outside.push(v);}}return {inside,outside};}
export function openBridgeEntrances(geometry,matrix=new T.Matrix4()){
 geometry.computeBoundingBox();const bounds=geometry.boundingBox.clone().applyMatrix4(matrix),relevant=boxes.filter(b=>b.intersectsBox(bounds));if(!relevant.length)return geometry;
 const pos=geometry.getAttribute('position'),index=geometry.index,count=index?index.count:pos.count,indices=[],added=[],v=new T.Vector3();let changed=false;
 for(let k=0;k<count;k+=3){const ids=[0,1,2].map(j=>index?index.getX(k+j):k+j),world=ids.map(i=>v.fromBufferAttribute(pos,i).applyMatrix4(matrix).toArray());let polys=[world.map((p,j)=>({p,w:[j===0?1:0,j===1?1:0,j===2?1:0]}))];let cut=false;
 for(const box of relevant){const min=box.min.toArray(),max=box.max.toArray();if([0,1,2].some(a=>Math.max(...world.map(p=>p[a]))<min[a]||Math.min(...world.map(p=>p[a]))>max[a]))continue;
 const output=[];for(const poly of polys){let inside=poly;for(let axis=0;axis<3&&inside.length;axis++){for(const [value,sign]of [[min[axis],1],[max[axis],-1]]){if(!inside.length)break;const r=split(inside,axis,value,sign);if(r.outside.length>=3)output.push(r.outside);inside=r.inside;}}if(inside.length>=3)cut=true;}polys=output;
 }
 if(!cut){indices.push(...ids);continue;}changed=true;
 for(const poly of polys){const pi=[];for(const vert of poly){let original=vert.w.findIndex(w=>w>1-1e-7);if(original>=0)pi.push(ids[original]);else{pi.push(pos.count+added.length);added.push({ids,w:vert.w});}}for(let j=1;j<pi.length-1;j++)indices.push(pi[0],pi[j],pi[j+1]);}
 }
 if(!changed)return geometry;
 const out=new T.BufferGeometry();for(const [name,attr]of Object.entries(geometry.attributes)){const arr=new Float32Array((attr.count+added.length)*attr.itemSize);for(let i=0;i<attr.count;i++)for(let c=0;c<attr.itemSize;c++)arr[i*attr.itemSize+c]=attr.getComponent(i,c);for(let i=0;i<added.length;i++){const {ids,w}=added[i];for(let c=0;c<attr.itemSize;c++)arr[(attr.count+i)*attr.itemSize+c]=ids.reduce((sum,id,j)=>sum+attr.getComponent(id,c)*w[j],0);}out.setAttribute(name,new T.BufferAttribute(arr,attr.itemSize));}out.setIndex(indices);out.computeBoundingBox();out.computeBoundingSphere();return out;
}
