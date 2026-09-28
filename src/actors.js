import * as T from 'three';
import {toonMaterial,styleCorgiMaterial} from './art-direction.js';
const matCache=new Map();const material=(c)=>{if(!matCache.has(c))matCache.set(c,toonMaterial({color:c}));return matCache.get(c)};
function mesh(g,c,parent,x=0,y=0,z=0){const m=new T.Mesh(g,material(c));m.position.set(x,y,z);parent.add(m);m.castShadow=true;return m}
const ball=new T.SphereGeometry(1,12,8),box=new T.BoxGeometry(1,1,1),capsule=new T.CapsuleGeometry(.11,.4,3,8);
function blob(parent,c,position,scale){const m=mesh(ball,c,parent,...position);m.scale.set(...scale);return m}
export function obstacle(type='cone'){const g=new T.Group();if(type==='block'){const base=mesh(box,'#183e65',g,0,.07,0);base.scale.set(.8,.14,.7);const body=mesh(box,'#ff7954',g,0,.83,0);body.scale.set(.75,1.5,.62);for(const y of [.3,.78,1.25]){const stripe=mesh(box,'#fff7e3',g,0,y,.32);stripe.scale.set(.65,.12,.025);}const cap=mesh(box,'#ffcf44',g,0,1.63,0);cap.scale.set(.82,.12,.72);}else if(type==='cone'){const base=mesh(box,'#ff7756',g,0,.06,0);base.scale.set(.76,.12,.76);mesh(new T.ConeGeometry(.29,.72,12),'#ff7756',g,0,.46,0);mesh(new T.CylinderGeometry(.14,.20,.13,12),'#fff',g,0,.49,0);}else if(type==='hurdle'){for(const x of [-.52,.52]){const p=mesh(box,'#25c6d7',g,x,.35,0);p.scale.set(.09,.7,.1);const foot=mesh(box,'#193e59',g,x,.06,0);foot.scale.set(.22,.1,.65)}const bar=mesh(box,'#ffca4f',g,0,.73,0);bar.scale.set(1.25,.2,.17);for(const x of [-.35,0,.35]){const s=mesh(box,'#fff',g,x,.735,.09);s.scale.set(.13,.21,.015)}}else if(type==='arch'){for(const x of [-.56,.56]){const pole=mesh(box,'#b48bea',g,x,.9,0);pole.scale.set(.12,1.8,.15)}const beam=mesh(box,'#b48bea',g,0,1.25,0);beam.scale.set(1.3,.6,.3);for(const x of [-.4,0,.4]){const s=mesh(box,'#fff',g,x,1.25,.16);s.scale.set(.14,.4,.02)}}return g;}
export function pawToken(){const g=new T.Group();const ring=mesh(new T.CylinderGeometry(.28,.28,.10,20),'#ffc94a',g);ring.rotation.x=Math.PI/2;blob(g,'#fff4c8',[0,-.04,.07],[.10,.09,.025]);for(const [x,y] of [[-.13,.045],[-.05,.13],[.05,.13],[.13,.045]])blob(g,'#fff4c8',[x,y,.075],[.042,.052,.022]);return g;}
export function heartPickup(){
 const group=new T.Group(),heart=new T.Group(),shape=new T.Shape();
 const points=[[0,-.34],[-.31,-.07],[-.36,.10],[-.30,.25],[-.15,.29],[0,.16],[.15,.29],[.30,.25],[.36,.10],[.31,-.07]];
 shape.moveTo(...points[0]);for(const p of points.slice(1))shape.lineTo(...p);shape.closePath();
 const geometry=new T.ExtrudeGeometry(shape,{depth:.13,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:1,steps:1,curveSegments:1});geometry.translate(0,.02,-.065);
 const body=new T.Mesh(geometry,[material('#ff526d'),material('#b82553')]);body.castShadow=true;heart.add(body);
 for(const z of [-.11,.11]){const shine=mesh(box,'#ffd2dd',heart,-.17,.19,z);shine.scale.set(.10,.05,.018);const glint=mesh(box,'#ffecf0',heart,-.245,.12,z);glint.scale.set(.045,.055,.018);}
 heart.scale.setScalar(.84);group.add(heart);group.userData.animate=t=>{heart.rotation.y=Math.sin(t*1.8)*.26;heart.rotation.z=Math.sin(t*2.3)*.07;};
 return group;
}
// A short, local prop animation: the building and the character rig stay untouched.
export class ObstacleImpact {
 constructor(object,type,sample){
  this.object=object;this.sample=sample;this.age=0;this.travel=0;this.active=true;this.bounces=0;
  this.speed=type==='cone'?8.2:type==='block'?6.8:5.6;
  this.vy=type==='cone'?5.2:type==='block'?4.4:3.5;
  this.spin=type==='cone'?9:type==='block'?6.5:4.3;
  this.bounds=new T.Box3().setFromObject(object);const center=this.bounds.getCenter(new T.Vector3());
  const localCenter=object.worldToLocal(center.clone());
  for(const child of object.children)child.position.sub(localCenter);
  object.position.copy(center);this.height=center.y-sample(0).position.y;this.restHeight=this.height;
  this.materials=[];object.traverse(node=>{if(!node.isMesh)return;const clone=m=>{const copy=m.clone();copy.transparent=true;this.materials.push({material:copy,color:copy.color.clone()});return copy;};node.material=Array.isArray(node.material)?node.material.map(clone):clone(node.material);});
  this.turn=new T.Quaternion();this.axis=new T.Vector3();this.floorNormal=new T.Vector3();this.floorContact=new T.Vector3();this.flashColor=new T.Color('#fff7ce');this.wide=type==='arch'||type==='hurdle';
 }
 update(dt){
  if(!this.active)return false;
  this.age+=dt;this.travel=Math.min(4.6,this.travel+this.speed*dt);const frame=this.sample(this.travel);
  this.vy-=13.5*dt;this.height+=this.vy*dt;
  const ceiling=this.restHeight+Math.max(.2,Math.min(1.1,frame.maxJump*.55));if(this.height>ceiling){this.height=ceiling;this.vy=Math.min(0,this.vy);}
  this.axis.copy(frame.right).multiplyScalar(-this.spin).addScaledVector(frame.tangent,this.wide?.08:.55).add(new T.Vector3(0,this.wide?.18:1.3,0));
  const spin=this.axis.length();this.turn.setFromAxisAngle(this.axis.normalize(),spin*dt);this.object.quaternion.premultiply(this.turn);
  this.object.position.copy(frame.position);this.object.position.y+=this.height;
  this.object.updateMatrixWorld(true);this.bounds.setFromObject(this.object);
  this.floorNormal.crossVectors(frame.right,frame.tangent).normalize();if(this.floorNormal.y<0)this.floorNormal.negate();
  if(this.floorNormal.y<.001)this.floorNormal.set(0,1,0);
  // The support corner gives the minimum signed distance of all eight box
  // corners to the sloping track, so a tumbling prop cannot sink uphill.
  this.floorContact.set(this.floorNormal.x>=0?this.bounds.min.x:this.bounds.max.x,this.bounds.min.y,this.floorNormal.z>=0?this.bounds.min.z:this.bounds.max.z);
  const clearance=this.floorContact.sub(frame.position).dot(this.floorNormal);
  if(clearance<0){
   const correction=-clearance/this.floorNormal.y;this.height+=correction;this.object.position.y+=correction;
   if(this.vy<0){this.vy=this.bounces<2?-this.vy*.3:0;this.bounces++;this.speed*=.67;this.spin*=.58;}
  }
  this.speed*=Math.exp(-dt*(this.bounces?2.2:.35));
  const opacity=1-T.MathUtils.smoothstep(this.age,1.15,1.65),flash=Math.max(0,1-this.age/.13)*.5;
  for(const {material,color}of this.materials){material.opacity=opacity;material.color.copy(color).lerp(this.flashColor,flash);}
  this.active=this.age<1.65;this.object.visible=this.active;
  return this.active;
 }
 dispose(){for(const {material}of this.materials)material.dispose();}
}
export class Corgi{
 constructor(model,clips=[]){
  this.root=new T.Group();this.model=model;this.root.add(model);
  model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.pose();});model.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3());
  model.scale.multiplyScalar(.76/size.y);bounds.setFromObject(model);
  const center=bounds.getCenter(new T.Vector3());model.position.set(-center.x,-bounds.min.y,-center.z);
  this.baseY=model.position.y;this.bones={};this.contacts=[];
  model.traverse(o=>{
   if(o.isBone)this.bones[o.userData.name||o.name]={bone:o,q:o.quaternion.clone()};
   if(o.isMesh){o.frustumCulled=false;o.castShadow=true;o.material=Array.isArray(o.material)?o.material.map(styleCorgiMaterial):styleCorgiMaterial(o.material);}
  });
  this.root.updateMatrixWorld(true);const point=new T.Vector3();
  model.traverse(o=>{
   if(!o.isSkinnedMesh)return;o.skeleton.update();const low=[];
   for(let i=0;i<o.geometry.attributes.position.count;i++){o.getVertexPosition(i,point).applyMatrix4(o.matrixWorld);if(point.y<.14)low.push(i);}
   const indices=[];for(let j=0;j<low.length;j+=Math.max(1,Math.floor(low.length/240)))indices.push(low[j]);
   this.contacts.push({mesh:o,indices});
  });
  this.mixer=new T.AnimationMixer(model);this.actions={};this.animation='Idle';
  for(const name of ['Idle','Run','Jump','Slide']){
   const clip=T.AnimationClip.findByName(clips,name);if(!clip)throw new Error(`柯基动画缺失：${name}`);
   const action=this.mixer.clipAction(clip).play();action.setEffectiveWeight(name==='Idle'?1:0);this.actions[name]=action;
  }
  this.mixer.update(0);
 }
 ground(point,tangent,jump=0){
  this.root.updateMatrixWorld(true);
  const right=new T.Vector3(-tangent.z,0,tangent.x).normalize(),normal=right.cross(tangent).normalize();if(normal.y<0)normal.negate();
  const v=new T.Vector3();let min=Infinity;
  for(const {mesh,indices}of this.contacts){mesh.skeleton.update();for(const i of indices){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);min=Math.min(min,v.sub(point).dot(normal));}}
  if(isFinite(min)&&normal.y>.5){this.root.position.y+=(jump*normal.y+.014-min)/normal.y;this.root.updateMatrixWorld(true);}
 }
 pose(dt,running,jump,slide,speed=9.5){
  this.animation=slide?'Slide':jump>.015?'Jump':running?'Run':'Idle';
  for(const [name,action] of Object.entries(this.actions)){
   action.setEffectiveWeight(T.MathUtils.damp(action.getEffectiveWeight(),name===this.animation?1:0,22,dt));
  }
  this.actions.Run.setEffectiveTimeScale(1.25*T.MathUtils.clamp(speed/9.5,.85,1.35));
  this.mixer.update(dt);
 }
}
