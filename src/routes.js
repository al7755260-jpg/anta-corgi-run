import * as THREE from 'three';
import safeRoute from './safe-route.json' with { type: 'json' };
import navigation from './navigation.json' with { type: 'json' };
export const regions=[
 {name:'入口广场',subtitle:'穿过 KEEP MOVING 入口，向活力出发',color:'#ff694f',speed:5.2,points:[[348,10,0],[348,20,0],[348,26,0],[349,31,1.5],[350,38,3.7],[350,44,6],[350,49,6]],hint:'左右换道收集爪印，空格跳过路障。'},
 {name:'活力中庭',subtitle:'穿梭双环中庭，迎接下一段运动挑战',color:'#26c7dc',speed:7,points:[[350,49,6],[358,57,6],[366,71,6],[367,86,6],[363,99,6],[354,111,6],[338,119,6],[324,119,6],[311,108,6],[299,97,6],[286,91,6],[269,91,6],[252,90,6],[238,83,6],[229,71,6],[231,58,6],[241,47,6],[254,44,6],[270,47,6],[283,59,6],[294,73,6],[309,74,6],[323,67,6],[337,54,6],[350,49,6]],hint:'跳过跨栏、滑过横杆，跟着爪印继续向前。'},
 {name:'双环连廊',subtitle:'沿建筑回廊继续向前，近看双环与连桥结构',color:'#9bcf56',speed:8,points:[[246,90,6],[234,99,6],[220,113,6],[210,126,6],[200,130,6],[187,126,6],[178,124,6],[190,132,6],[207,135,6],[222,136,3],[239,141,1],[260,154,0],[277,169,-.93],[295,182,-.93],[315,190,-.93],[338,194,-.93],[362,200,-.93],[385,211,-.93],[406,223,-.93],[429,232,-.93],[455,236,-.93],[474,237,-.93]],hint:'收集青柠色磁力球，让附近爪印自动靠近。'},
 {name:'空中露台',subtitle:'搭乘运动升降台，奔向建筑上方的风景',color:'#ffae45',speed:6.8,points:[[358.5,46,46.81],[363,50,46.81],[370,61,46.81],[372,69,46.81],[370,81,46.81],[368,94,46.81],[361,106,46.81],[350,115,46.81],[337,120,46.81],[325,121,46.81],[315,116,46.81],[301,106,46.81],[286,100,46.81],[270,96,46.81],[256,97,46.81],[251,102,46.81],[248,110,46.81]],hint:'空中弯道自动转向，专心跳跃与换道。'},
 {name:'入口归途',subtitle:'沿入口大楼梯下行，完成总部建筑巡游',color:'#7383ef',speed:9,points:[[348,20,0],[331,17,0],[311,16,0],[300,20,0],[287,20,0],[271,12,0],[252,13,0],[233,20,0],[213,22,0],[200,29,0],[200,43,0],[203,51,0],[204,65,0],[202,78,0],[211,96,0],[217,110,0],[233,119,0],[252,129,0],[269,134,0],[281,133,0],[300,142,0],[316,148,0],[331,153,0],[346,154,0],[359,148,0],[369,149,0],[385,138,0],[394,121,0],[397,98,0],[401,82,0],[401,68,0],[395,63,0],[393,51,0],[394,44,0],[386,32,0],[371,23,0],[353,18,0],[348,20,0]],hint:'终点就在前方，带着满满的爪印回到入口！'},
];
export function toWorld([x,y,z]){return new THREE.Vector3(x-300,z,80-y)}
export function createDesignRoute(){
 const points=[],sections=[];let distance=0;
 const add=(id,list)=>{const start=distance;for(const p of list){if(points.length){const prev=points.at(-1),d=Math.hypot(...p.map((v,i)=>v-prev[i]));if(d<.08)continue;distance+=d;}points.push([...p]);}sections.push({id,start,end:distance});};
 const courtyard=navigation[1];
 add(0,navigation[0]);add(1,courtyard.slice(0,Math.ceil(courtyard.length/2)));add(2,courtyard.slice(Math.ceil(courtyard.length/2)-1));
 // A visible sports lift in the open courtyard connects levels continuously.
 const liftUp=[[350,50,6],[350,54,6],[350,58,6],[350,60,6],[350,60,10],[350,60,18],[350,60,28],[350,60,38],[350,60,49.7],[353,57,49.7],[356,52,49.7],[358.5,47.5,48.3]];
 add(3,liftUp);add(3,navigation[3]);add(3,navigation[3].slice(0,-1).reverse());
 add(3,[[358.5,47.5,48.3],[356,52,49.7],[353,57,49.7],[350,60,49.7],[350,60,38],[350,60,28],[350,60,18],[350,60,10],[350,60,6],[350,58,6],[350,54,6],[350,50,6]]);
 add(4,navigation[0].slice().reverse());
 const curve=new THREE.CatmullRomCurve3(points.map(toWorld),false,'centripetal');curve.arcLengthDivisions=18000;const length=curve.getLength();sections.forEach(s=>{s.start=s.start/distance*length;s.end=s.end/distance*length});
 return [{name:'园区连续旅程',index:0,color:'#26c7dc',speed:8,curve,length,sections}];
}

class SampledCourse {
 constructor(rows){
  this.rows=rows;this.points=rows.map(p=>new THREE.Vector3(...p.slice(0,3)));this.distances=[0];
  for(let i=1;i<this.points.length;i++)this.distances.push(this.distances[i-1]+this.points[i].distanceTo(this.points[i-1]));
  this.length=this.distances.at(-1);this.liftSpans=[];
  for(let i=0;i<rows.length;i++){
   if(rows[i][6]!==1)continue;
   const first=i;while(i+1<rows.length&&rows[i+1][6]===1)i++;
   // metadata() includes the segments entering/leaving a flagged sample.
   const startIndex=Math.max(0,first-1),endIndex=Math.min(rows.length-1,i+1);
   const entry=this.horizontalHeading(startIndex-1,-1),exit=this.horizontalHeading(endIndex,1);
   const entryAngle=Math.atan2(entry.x,entry.z),exitAngle=Math.atan2(exit.x,exit.z);
   const turn=THREE.MathUtils.euclideanModulo(exitAngle-entryAngle+Math.PI,Math.PI*2)-Math.PI;
   this.liftSpans.push({start:this.distances[startIndex],end:this.distances[endIndex],entryAngle,exitAngle,turn,entry,exit});
  }
 }
 horizontalHeading(segment,direction){
  for(let i=segment;i>=0&&i<this.points.length-1;i+=direction){
   const heading=this.points[i+1].clone().sub(this.points[i]);heading.y=0;
   if(heading.lengthSq()>1e-8)return heading.normalize();
  }
  return new THREE.Vector3(0,0,-1);
 }
 liftHeading(s){
  const span=this.liftSpans.find(span=>s>=span.start-1e-7&&s<=span.end+1e-7);
  if(!span)return new THREE.Vector3(0,0,-1);
  const progress=THREE.MathUtils.clamp((s-span.start)/(span.end-span.start),0,1);
  // Turn gently while travelling, then face the destination walkway for the
  // final 40% of either ascent or descent. Position stays on the lift route.
  const blend=THREE.MathUtils.smoothstep(progress,0,.6),angle=span.entryAngle+span.turn*blend;
  return new THREE.Vector3(Math.sin(angle),0,Math.cos(angle));
 }
 sample(s){s=THREE.MathUtils.clamp(s,0,this.length);let lo=0,hi=this.distances.length-1;while(lo+1<hi){const m=(lo+hi)>>1;if(this.distances[m]<=s)lo=m;else hi=m;}const t=(s-this.distances[lo])/Math.max(1e-8,this.distances[hi]-this.distances[lo]);return {lo,hi,t};}
 getPointAt(u){const {lo,hi,t}=this.sample(u*this.length);return this.points[lo].clone().lerp(this.points[hi],t);}
 getTangentAt(u){const s=u*this.length,{lo,hi}=this.sample(s);return this.points[hi].clone().sub(this.points[lo]).normalize();}
 metadata(s){const {lo,hi,t}=this.sample(s),a=this.rows[lo],b=this.rows[hi];return {laneSpacing:Math.min(a[3],b[3]),maxJump:Math.min(a[4],b[4]),id:t<.5?a[5]:b[5],lift:a[6]===1||b[6]===1};}
}
export function createRoutes(){const curve=new SampledCourse(safeRoute.points);return [{name:'园区连续旅程',index:0,color:'#26c7dc',speed:8,curve,length:curve.length,safe:true}];}
export function courseRegion(route,s){return route.safe?route.curve.metadata(s).id:route.sections.find(section=>s>=section.start&&s<=section.end)?.id??4;}
export function routeFrame(route,s,lane=0){const u=THREE.MathUtils.clamp(s/route.length,0,1),position=route.curve.getPointAt(u),tangent=route.curve.getTangentAt(u).normalize();const meta=route.safe?route.curve.metadata(s):{laneSpacing:.85,maxJump:1.45,lift:Math.abs(tangent.y)>.65&&Math.abs(position.x-50)<1.2&&Math.abs(position.z-20)<2};const lift=meta.lift;if(lift)tangent.copy(route.safe?route.curve.liftHeading(s):new THREE.Vector3(0,0,-1));const right=new THREE.Vector3(-tangent.z,0,tangent.x).normalize();position.addScaledVector(right,lift?0:lane*meta.laneSpacing);return {position,tangent,right,u,lift,laneSpacing:meta.laneSpacing,maxJump:meta.maxJump,narrow:meta.laneSpacing<.42};}
