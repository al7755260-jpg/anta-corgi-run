import './style.css';
import './pixel-ui.css';
import {assetUrl} from './assets.js';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {toonMaterial,trackMaterial,styleCampusMaterial,makePixelSky} from './art-direction.js';
import {computeBoundsTree,acceleratedRaycast} from 'three-mesh-bvh';
import {regions,createRoutes,routeFrame,toWorld,courseRegion} from './routes.js';
import {obstacle,pawToken,heartPickup,Corgi,ObstacleImpact} from './actors.js';
import {Sound} from './audio.js';
import {buildEncounters,coinGuide} from './encounters.js';
import {PixelRenderer} from './pixel.js';
import {openBridgeEntrances} from './bridge-openings.js';
import {createMobileControls} from './mobile-controls.js';
import {createTrackSurface} from './track-surface.js';
import {loadSportsAssets,sportObstacle,sportGate} from './sports-assets.js';
T.BufferGeometry.prototype.computeBoundsTree=computeBoundsTree;T.Mesh.prototype.raycast=acceleratedRaycast;
const $=s=>document.querySelector(s),sound=new Sound();
const icons={sound:'<path d="m11 5-6 4H2v6h3l6 4Z"/><path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',mute:'<path d="m11 5-6 4H2v6h3l6 4Z"/><path d="m16 9 5 6m0-6-5 6"/>',map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z"/><path d="M9 3v16m6-14v16"/>',pause:'<path d="M8 5v14m8-14v14"/>'};
icons.camera='<path d="M4 7h4l2-3h4l2 3h4v13H4Z"/><circle cx="12" cy="13" r="4"/>';
for(const k of ['map','pause','camera'])$('#'+k).innerHTML=`<svg viewBox="0 0 24 24">${icons[k]}</svg>`;
function updateSound(){const label=sound.enabled?'关闭声音':'开启声音';$('#sound').innerHTML=`<svg viewBox="0 0 24 24">${icons[sound.enabled?'sound':'mute']}</svg>`;$('#sound').ariaLabel=label;$('#sound').title=label;}updateSound();$('#sound').onclick=()=>{sound.toggle();updateSound();sound.play('coin')};
const canvas=$('#world');let renderer;
try{renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'})}catch(e){$('#loadtext').textContent='浏览器未启用 3D 图形，请在 Chrome 或 Edge 开启硬件加速后重试。';throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
const pixel=new PixelRenderer(renderer);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
const scene=new T.Scene();scene.background=makePixelSky();scene.fog=new T.Fog('#a0e5fa',320,1100);
const camera=new T.PerspectiveCamera(64,innerWidth/innerHeight,.12,1600);camera.position.set(105,72,175);
scene.add(new T.HemisphereLight('#e2f4ff','#8fa6bb',1.45));const sun=new T.DirectionalLight('#fff5df',1.9);sun.position.set(60,120,40);scene.add(sun);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;sun.shadow.camera.near=1;sun.shadow.camera.far=200;sun.shadow.bias=-.001;scene.add(sun.target);
const controls=new OrbitControls(camera,canvas);controls.enabled=false;controls.enableDamping=true;controls.dampingFactor=.07;controls.enablePan=false;controls.rotateSpeed=.6;controls.minDistance=2.6;controls.maxDistance=380;controls.maxPolarAngle=Math.PI*.49;
const routes=createRoutes(),totalLength=routes.reduce((a,r)=>a+r.length,0),routeGroup=new T.Group(),actors=new T.Group(),deco=new T.Group();scene.add(routeGroup,actors,deco);
const game={landmark:0,checkpoint:0,mode:'home',ready:false,stage:0,s:0,lane:0,lateral:0,jump:0,vy:0,slide:0,hearts:3,score:0,combo:0,power:0,invulnerable:0,time:0,visited:new Set(),collected:new Set(),tour:false,tourMoving:true,orbit:false,finished:false,transition:false,collisions:0,picked:0,impactCount:0,impactSlow:0,crashTime:0,qaImpactFrozen:false,lastImpact:null};
let mobileInput=null,touchStart=null;const canvasTouches=new Set();
function resetMobileInput(){mobileInput?.reset();touchStart=null;canvasTouches.clear();}
function syncMusic(options={}){sound.setActive(game.mode==='running'&&(!game.tour||game.tourMoving)&&!document.hidden,options)}
sound.onMusicError=message=>toast(message,4200);
let liftPlatform;let dog,campus,groundMeshes=[],entities=[],elapsed=0,last=performance.now(),noticeTimer,comboTimer,countTimer,stageTimer,wasMode='running';
const ray=new T.Raycaster();ray.firstHitOnly=true;const down=new T.Vector3(0,-1,0),smoothTarget=new T.Vector3(),dogPosition=new T.Vector3();
let best=0;try{best=Number(localStorage.getItem('anta-corgi-best')||0)}catch{}
const loadProgress={campus:0,corgi:0};
function progress(key,event){loadProgress[key]=event.total?event.loaded/event.total:Math.min(.95,event.loaded/(key==='campus'?18750000:10350000));const p=Math.round((loadProgress.campus*.72+loadProgress.corgi*.28)*90);$('#loadbar').style.width=p+'%';$('#loadtext').textContent=`正在准备${key==='campus'?'运动园区':'柯基伙伴'} · ${p}%`;}
const feedbackPaw='<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M9 13h10v3h3v8H6v-8h3ZM3 7h5v6H3Zm7-5h5v7h-5Zm8 1h5v7h-5Zm6 8h4v6h-4Z" fill="currentColor"/></svg>';
function revealFeedback(element){element.classList.remove('show');void element.offsetWidth;element.classList.add('show');}
function clearFeedback(){clearTimeout(noticeTimer);clearTimeout(comboTimer);for(const id of ['notice','combo'])$('#'+id).classList.remove('show');}
function toast(text,time=2800){
 clearTimeout(noticeTimer);const el=$('#notice');el.dataset.tone=/生命/.test(text)?'heart':/砰|休息|路障/.test(text)?'caution':'info';
 el.innerHTML=`<span class="feedback-emblem" aria-hidden="true">${feedbackPaw}</span><span class="notice-copy"></span>`;el.querySelector('.notice-copy').textContent=text;
 revealFeedback(el);noticeTimer=setTimeout(()=>el.classList.remove('show'),time);
}
function showCombo({count=0,multiplier=1,kind='combo',text='',points=25,duration=1500}={}){
 clearTimeout(comboTimer);const el=$('#combo');el.dataset.kind=kind;
 el.innerHTML=`<span class="combo-card"><span class="feedback-emblem" aria-hidden="true">${feedbackPaw}</span><span class="combo-copy"><span class="combo-eyebrow"></span><span class="combo-line"><strong class="combo-number"></strong><span class="combo-label"></span></span></span><span class="combo-pill"></span><i class="combo-spark" aria-hidden="true"></i></span>`;
 el.querySelector('.combo-eyebrow').textContent=kind==='combo'?'连击达成':'动作奖励';
 el.querySelector('.combo-number').textContent=kind==='combo'?String(count):'+'+points;
 el.querySelector('.combo-label').textContent=kind==='combo'?'COMBO':text;
 el.querySelector('.combo-pill').textContent=kind==='combo'?'×'+multiplier:kind==='slide'?'低身':'跳跃';
 revealFeedback(el);comboTimer=setTimeout(()=>el.classList.remove('show'),duration);
}
function safeFloor(p){return p.y+.025;}
function makeRibbon(route){routeGroup.add(createTrackSurface(route));}
function disposeGroup(group){while(group.children.length){const o=group.children[0];group.remove(o);o.traverse(x=>{if(x.geometry&&group===routeGroup)x.geometry.dispose()})}}
function placeOnRoute(object,s,lane=0,height=0){const f=routeFrame(routes[game.stage],s,lane);f.position.y=safeFloor(f.position)+height;object.position.copy(f.position);object.rotation.y=Math.atan2(f.tangent.x,f.tangent.z);return f;}
function label(text,color='#ff694f'){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,512,128);ctx.fillStyle='white';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='48px CampusPixel';ctx.fillText(text,256,65);const tex=new T.CanvasTexture(c);tex.magFilter=T.NearestFilter;tex.minFilter=T.NearestFilter;tex.colorSpace=T.SRGBColorSpace;return new T.Mesh(new T.PlaneGeometry(3.2,.8),new T.MeshBasicMaterial({map:tex,side:T.DoubleSide}));}
function gate(s,text){const g=sportGate(text);placeOnRoute(g,s);g.userData.s=s;deco.add(g);}
function buildStage(){for(const e of entities)e.impact?.dispose();disposeGroup(routeGroup);disposeGroup(actors);disposeGroup(deco);entities=[];const r=routes[game.stage];makeRibbon(r);gate(2,'KEEP MOVING');gate(r.length-4,'终点 · 好样的！');
 const encounters=buildEncounters(r,routeFrame);
 for(const row of encounters)for(const item of row.items){
  const {lane,type}=item,object=sportObstacle(type)??obstacle(type),spacing=routeFrame(r,row.s).laneSpacing;
  const widthScale=Math.min(.65,spacing*.85);
  object.scale.set(widthScale,.75,.65);placeOnRoute(object,row.s,lane);actors.add(object);
  entities.push({object,s:row.s,lane,type,hit:false,hitRadius:.19+(type==='cone'?.38:type==='block'?.60:.65)*widthScale});
 }
 for(let s=6;s<r.length-5;s+=2.2){
  const f=routeFrame(r,s);if(f.lift)continue;
  const {lane,height}=coinGuide(encounters,s,f.narrow),object=pawToken();
  object.scale.setScalar(.8);placeOnRoute(object,s,lane,height);actors.add(object);
  entities.push({object,s,lane,type:'coin',height,collected:game.collected.has('coin'+s)});
 }

 for(let s=65;s<r.length-20;s+=100){if(routeFrame(r,s).lift)continue;const object=heartPickup(),height=.48;placeOnRoute(object,s,0,height);actors.add(object);entities.push({object,s,lane:0,type:'heart',height,collected:game.collected.has('heart'+s)});}

 updateHUD();}
function resetStage(index,s=0){resetMobileInput();game.stage=index;game.s=s;game.lane=0;game.lateral=0;game.jump=0;game.vy=0;game.slide=0;game.invulnerable=2.2;game.impactSlow=0;game.crashTime=0;game.transition=false;game.visited.add(courseRegion(routes[0],s));buildStage();updateDog(0);snapCamera();}
function snapCamera(){const f=routeFrame(routes[game.stage],game.s);const target=dogPosition.clone().add(new T.Vector3(0,.85,0));camera.position.copy(dogPosition).addScaledVector(f.tangent,-4.8);camera.position.y=dogPosition.y+2.4;camera.lookAt(target.clone().addScaledVector(f.tangent,2.8));smoothTarget.copy(target);controls.target.copy(target);}
function updateDog(dt){const f=routeFrame(routes[game.stage],game.s,game.lateral);const floor=safeFloor(f.position);dogPosition.copy(f.position);dogPosition.y=floor;dog.root.position.copy(dogPosition);dog.root.position.y+=game.jump;if(liftPlatform){liftPlatform.visible=f.lift;liftPlatform.position.set(50,dogPosition.y-.125,20);}const angle=Math.atan2(f.tangent.x,f.tangent.z);dog.root.rotation.set(-Math.atan2(f.tangent.y,Math.hypot(f.tangent.x,f.tangent.z)),angle,0,'YXZ');dog.pose(dt,game.mode==='running'&&!f.lift&&(!game.tour||game.tourMoving),game.jump,game.slide>0,game.speed||9.5);dog.ground(dogPosition,f.tangent,game.jump);dog.root.visible=true;sun.position.copy(dogPosition).add(new T.Vector3(20,70,30));sun.target.position.copy(dogPosition);
 if(!game.orbit){const next=routeFrame(routes[game.stage],Math.min(game.s+2.8,routes[game.stage].length),game.lateral*.25).position;next.y=floor+.55;const desired=dogPosition.clone().addScaledVector(f.tangent,-4.8);desired.y=floor+2.4;const eye=dogPosition.clone().add(new T.Vector3(0,1.1,0));const cameraDir=desired.clone().sub(eye);ray.set(eye,cameraDir.clone().normalize());ray.far=cameraDir.length();const obstruction=ray.intersectObjects(groundMeshes,false).find(h=>h.distance>.65);if(obstruction)desired.copy(eye).addScaledVector(cameraDir.normalize(),Math.max(1.7,obstruction.distance-.4));const a=1-Math.exp(-dt*7);camera.position.lerp(desired,a);smoothTarget.lerp(next,a);camera.lookAt(smoothTarget);controls.target.copy(dogPosition).add(new T.Vector3(0,.7,0));}else {if(!game.tour){const target=dogPosition.clone().add(new T.Vector3(0,.7,0));camera.position.add(target.clone().sub(controls.target));controls.target.copy(target);}controls.update();if(!game.tour){const eye=controls.target.clone(),direction=camera.position.clone().sub(eye);ray.set(eye,direction.clone().normalize());ray.far=direction.length();const hit=ray.intersectObjects(groundMeshes,false).find(h=>h.distance>.35);if(hit)camera.position.copy(eye).addScaledVector(direction.normalize(),Math.max(.3,hit.distance-.2));}}}
function updateHUD(){const id=courseRegion(routes[0],game.s),r=regions[id];game.landmark=id;game.visited.add(id);$('#chapter').textContent='ONE CONTINUOUS RUN';$('#location').textContent=r.name;$('#mission').textContent=game.tour?'慢一点，看看身边的建筑。':routeFrame(routes[0],game.s).narrow?'窄道 · 自动居中，跟着爪印向前':r.subtitle;$('#score').textContent=game.score;$('#hearts').textContent=game.tour?'轻松漫游':'♥ '.repeat(game.hearts)+'♡ '.repeat(3-game.hearts);let distance=routes.slice(0,game.stage).reduce((a,r)=>a+r.length,0)+game.s;$('#distance').textContent=Math.round(distance);$('#progress').textContent=Math.min(100,Math.round(distance/totalLength*100))+'%';$('#power').classList.add('hidden');$('#power').textContent='';$('#route-rail').innerHTML=regions.map((r,i)=>`<button class="route-stop ${i===game.landmark?'active':game.visited.has(i)?'done':''}" data-region="${i}" aria-label="查看${r.name}"><i></i>${r.name}</button>`).join('');}
function showModal(html){resetMobileInput();sound.setActive(false);$('#modal-content').innerHTML=html;$('#modal-backdrop').classList.remove('hidden');$('#close-modal').focus();}
function closeModal(){if($('#modal-backdrop').classList.contains('hidden'))return;$('#modal-backdrop').classList.add('hidden');if(game.mode==='paused')game.mode=wasMode;else if(game.mode==='failed'||game.mode==='complete')home();syncMusic({gesture:true});}
$('#close-modal').onclick=closeModal;$('#modal-backdrop').onclick=e=>{if(e.target===$('#modal-backdrop'))closeModal()};
function pause(){if(game.mode==='home'||game.mode==='loading'||game.transition)return;if(game.mode==='paused'){closeModal();return}if(game.mode!=='running')return;wasMode=game.mode;game.mode='paused';showModal(`<h2 id="modal-title">休息一下，喝口水</h2><p>柯基在等你。回来后从这里继续。</p><button class="primary" id="resume">继续跑酷</button><button class="secondary" id="restart">从最近检查点继续</button><button class="secondary" id="tohome">返回首页</button>`);$('#resume').onclick=closeModal;$('#restart').onclick=()=>{closeModal();game.hearts=3;resetStage(0,game.checkpoint);};$('#tohome').onclick=home;}
$('#pause').onclick=pause;
function showMap(){if(!game.ready){toast('园区正在准备中');return}if(game.transition)return;if(game.mode==='running'){wasMode=game.mode;game.mode='paused';}showModal(`<h2 id="modal-title">跟着爪印，探索总部</h2><p>一条路，一口气跑到底。全程约 ${Math.round(totalLength)} 米，沿途探索入口、中庭、连廊与上层露台。</p><div class="route-list">${regions.map((r,i)=>`<div class="route-card"><strong>0${i+1}</strong><div><b>${r.name}</b><span>${r.subtitle}</span></div></div>`).join('')}</div><small>全程连续，无分关、无传送。空中露台通过可见的运动升降台往返；沿途检查点只用于碰撞后的继续。</small>`);document.querySelectorAll('[data-visit]').forEach(b=>b.onclick=()=>{closeModal();start(true,0);});}
$('#map').onclick=showMap;$('#route-rail').onclick=e=>{if(e.target.closest('[data-region]'))showMap()};
function home(){resetMobileInput();clearFeedback();clearInterval(countTimer);clearTimeout(stageTimer);game.transition=false;game.mode='home';sound.setActive(false);game.orbit=false;controls.enabled=false;$('#modal-backdrop').classList.add('hidden');$('#home').classList.remove('hidden');$('#hud').classList.add('hidden');$('#play-controls').classList.add('hidden');$('#tour-controls').classList.add('hidden');$('#countdown').classList.add('hidden');document.body.classList.remove('playing','hit');game.stage=0;game.landmark=0;game.visited.clear();updateHUD();}
$('#brand').onclick=()=>{if(game.mode!=='home'){pause();if(game.mode==='paused')$('#tohome')?.focus()}};
function start(tour=false,stage=0){if(!game.ready)return;clearFeedback();$('#modal-backdrop').classList.add('hidden');clearTimeout(stageTimer);clearInterval(countTimer);Object.assign(game,{mode:'running',tour,stage,qaSpeed:1,checkpoint:0,time:0,s:0,lane:0,lateral:0,jump:0,vy:0,slide:0,hearts:3,score:0,combo:0,power:0,invulnerable:2.5,tourMoving:true,orbit:false,finished:false,transition:false,collisions:0,picked:0,impactCount:0,impactSlow:0,crashTime:0,qaImpactFrozen:false,lastImpact:null});game.visited=new Set();game.collected=new Set();if($('#qa-impact'))$('#qa-impact').textContent='碰撞定格';controls.enabled=true;controls.maxDistance=tour?380:12;controls.touches.ONE=tour?T.TOUCH.ROTATE:null;controls.touches.TWO=T.TOUCH.DOLLY_ROTATE;$('#home').classList.add('hidden');$('#hud').classList.remove('hidden');$('#play-controls').classList.toggle('hidden',tour);$('#tour-controls').classList.toggle('hidden',!tour);$('#tour-play').textContent='暂停漫游';document.body.classList.add('playing');resetStage(0,0);syncMusic({gesture:true,restart:true});if(!tour){toast(matchMedia('(max-width:850px),(pointer:coarse)').matches?'出发！左手跟随摇杆 · 右手跳跃 / 长按下蹲':'出发！左右换道 · 空格跳跃 · 鼠标拖动环视',3500);}else{toast('慢跑导览已开始 · 拖动可停下环视');}}
$('#start').onclick=()=>start();$('#tour').onclick=()=>start(true);
controls.addEventListener('start',()=>{if(game.mode!=='running')return;game.orbit=true;if(game.tour){game.tourMoving=false;$('#tour-play').textContent='继续漫游';syncMusic()}});
function followDog(){game.orbit=false;controls.target.copy(dogPosition).add(new T.Vector3(0,.7,0));snapCamera();}
$('#camera').onclick=followDog;canvas.addEventListener('dblclick',followDog);
$('#tour-play').onclick=()=>{game.tourMoving=!game.tourMoving;if(game.tourMoving){game.orbit=false;controls.enabled=true}$('#tour-play').textContent=game.tourMoving?'暂停漫游':'继续漫游';syncMusic({gesture:true})};
$('#follow').onclick=()=>{game.orbit=false;game.tourMoving=true;$('#tour-play').textContent='暂停漫游';snapCamera();syncMusic({gesture:true})};
$('#overview').onclick=()=>{game.orbit=true;game.tourMoving=false;controls.enabled=true;camera.position.set(160,160,240);controls.target.set(0,20,0);controls.update();$('#tour-play').textContent='继续漫游';syncMusic()};
function action(which){if(game.mode!=='running'||game.tour)return;const frame=routeFrame(routes[0],game.s);if(frame.lift)return;if(frame.narrow&&(which==='left'||which==='right'))return;if(which==='left')game.lane=Math.max(-1,Math.round(game.lane)-1);if(which==='right')game.lane=Math.min(1,Math.round(game.lane)+1);if(which==='jump'&&game.jump<.06){if(frame.maxJump<.35){toast('这段通道较低，贴地通过就好',1600);return;}mobileInput?.releaseSlide();game.vy=Math.min(7.2,Math.sqrt(38*frame.maxJump));game.jump=.07;game.slide=0;sound.play('jump')}if(which==='slide'){if(game.jump>.1)game.vy=-9;game.slide=.95;}}
addEventListener('keydown',e=>{if(e.code==='Space'&&e.target?.closest?.('.mobile-action'))return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyA','KeyD','KeyW','KeyS','KeyP','KeyR','Escape'].includes(e.code))e.preventDefault();if(e.repeat)return;const map={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'jump',Space:'jump',KeyW:'jump',ArrowDown:'slide',KeyS:'slide'};if(map[e.code])action(map[e.code]);if(e.code==='KeyR')followDog();if(e.code==='KeyP'||e.code==='Escape'){if(!$('#modal-backdrop').classList.contains('hidden'))closeModal();else pause();}});
mobileInput=createMobileControls({
 host:$('.touch-controls'),
 getState:()=>{const frame=routeFrame(routes[0],game.s);return {active:game.mode==='running'&&!game.tour&&!frame.lift&&!document.hidden,canSteer:!frame.narrow&&!frame.lift,lane:game.lane};},
 selectLane:lane=>{game.lane=lane;},jump:()=>action('jump'),slide:()=>action('slide'),
});
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;canvasTouches.add(e.pointerId);touchStart=canvasTouches.size===1&&game.mode==='running'&&!game.tour?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;});
canvas.addEventListener('pointerup',e=>{const swipe=touchStart;canvasTouches.delete(e.pointerId);if(swipe?.id!==e.pointerId)return;touchStart=null;if(canvasTouches.size)return;const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;if(Math.max(Math.abs(dx),Math.abs(dy))>24)action(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'slide':'jump');});
for(const eventType of ['pointercancel','lostpointercapture'])canvas.addEventListener(eventType,e=>{canvasTouches.delete(e.pointerId);touchStart=null;});
addEventListener('blur',resetMobileInput);addEventListener('resize',resetMobileInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.mode==='running')pause()});
function strikeObstacle(entity){
 const route=routes[game.stage],protectedHit=game.invulnerable>0;
 entity.impact=new ObstacleImpact(entity.object,entity.type,distance=>{const lane=entity.lane*(1-.7*Math.min(1,distance/2.5)),frame=routeFrame(route,Math.min(route.length,entity.s+distance),lane);frame.position.y=safeFloor(frame.position);return frame;});
 game.impactCount++;game.impactSlow=.42;game.lastImpact={type:entity.type,s:entity.s,lane:entity.lane,protected:protectedHit};
 if(protectedHit)sound.play('hit');
}
function updateImpacts(dt){for(const entity of entities)if(entity.impact?.active)entity.impact.update(dt);}
function hit(){
 if(game.invulnerable>0||game.tour||game.mode!=='running')return;
 game.hearts--;game.collisions++;game.combo=0;game.invulnerable=2.8;sound.play('hit');document.body.classList.add('hit');setTimeout(()=>document.body.classList.remove('hit'),350);
 toast(game.hearts>0?'砰！路障被撞开了，注意换道躲避':'柯基需要休息一下',1800);
 if(game.hearts<=0){game.mode='crashing';resetMobileInput();game.crashTime=.8;game.transition=true;syncMusic();}
}
function showFailure(){
 game.mode='failed';game.transition=false;
 showModal(`<span class="medal">🐾</span><h2 id="modal-title">歇歇小短腿，再出发</h2><p>已到达「${regions[game.landmark].name}」。从这个检查点继续，之前的收集都会保留。</p><div class="result-number">${game.score}</div><p>枚活力爪印</p><button class="primary" id="retry">从检查点继续</button><button class="secondary" id="easy">切换轻松漫游</button><button class="secondary" id="endhome">返回首页</button>`);
 $('#retry').onclick=()=>{$('#modal-backdrop').classList.add('hidden');game.hearts=3;game.mode='running';resetStage(0,game.checkpoint);syncMusic({gesture:true})};
 $('#easy').onclick=()=>{$('#modal-backdrop').classList.add('hidden');start(true,0)};$('#endhome').onclick=home;
}
function finish(){game.mode='complete';game.finished=true;game.score+=500;best=Math.max(best,game.score);try{localStorage.setItem('anta-corgi-best',String(best))}catch{}sound.play('win');updateHUD();showModal(`<span class="medal">🏅</span><h2 id="modal-title">好样的，运动小队长！</h2><p>入口大楼梯、双环中庭、建筑连廊、空中露台。<br>你和柯基完成了今天的总部建筑巡游！</p><div class="result-number">${game.score}</div><div class="result-stats"><span>${Math.round(totalLength)} 米旅程</span><span>${game.visited.size} 个区域</span><span>最佳 ${best}</span></div><button class="primary" id="again">再跑一圈</button><button class="secondary" id="finish-tour">留下来逛逛</button><button class="secondary" id="finish-home">返回首页</button>`);$('#again').onclick=()=>{closeModal();start()};$('#finish-tour').onclick=()=>{closeModal();start(true,0)};$('#finish-home').onclick=home;}

function updateEntities(dt){const active=game.mode==='running';for(const e of entities){if(e.impact){e.object.visible=e.impact.active;continue;}const d=e.s-game.s;e.object.visible=!e.collected&&d>-12&&d<100;if(!e.object.visible)continue;if(e.object.userData.animate)e.object.userData.animate(elapsed);if(e.type==='coin'||e.type==='heart'){if(e.type==='coin')e.object.rotation.y=elapsed*1.8;const base=routeFrame(routes[game.stage],e.s,e.lane).position;e.object.position.y=safeFloor(base)+e.height+Math.sin(elapsed*4+e.s)*(e.type==='heart'?.055:.09);}
 if(!active||game.tour||game.mode!=='running')continue;const dx=Math.abs(e.lane-game.lateral);if(e.type==='coin'||e.type==='heart'){if(!e.collected&&(Math.abs(d)<.9&&dx<.7&&Math.abs(e.height-(game.jump+.40))<.54)){e.collected=true;game.collected.add(e.type+e.s);e.object.visible=false;if(e.type==='coin'){game.picked++;game.combo++;game.score+=10*Math.min(4,1+Math.floor(game.combo/15));if(game.combo%10===0){showCombo({count:game.combo,multiplier:Math.min(4,1+Math.floor(game.combo/15))})}sound.play('coin');}else{const restored=game.hearts<3;game.hearts=Math.min(3,game.hearts+1);sound.play('win');toast(restored?'+1颗生命':'生命已满（最多3颗）')}}}else if(!e.hit&&Math.abs(d)<.58&&dx*routeFrame(routes[0],e.s).laneSpacing<e.hitRadius){const avoid=e.type==='arch'?(game.slide>0||game.jump>1.2):((e.type==='cone'||e.type==='hurdle')&&game.jump>(e.type==='cone'?.36:.64));if(!avoid){e.hit=true;strikeObstacle(e);hit();}else{e.hit=true;game.score+=25;sound.play('coin');showCombo({kind:game.slide>0?'slide':'jump',text:game.slide>0?'漂亮滑行':'轻巧一跃',points:25,duration:1300});}}}}
let hudTick=0;function tick(now){requestAnimationFrame(tick);const dt=Math.min((now-last)/1000,.045);last=now;elapsed+=dt;if(!game.ready)return;mobileInput?.update();syncMusic();if(game.mode==='home')return;if(!document.hidden&&['running','crashing','failed','complete'].includes(game.mode))updateImpacts(dt);if(game.mode==='crashing'&&!document.hidden){game.crashTime=Math.max(0,game.crashTime-dt);if(!game.crashTime)showFailure();}if(game.mode==='running'){game.time+=dt;game.invulnerable=Math.max(0,game.invulnerable-dt);game.impactSlow=Math.max(0,(game.impactSlow||0)-dt);game.slide=Math.max(0,game.slide-dt);if(mobileInput?.slideHeld)game.slide=Math.max(game.slide,.14);if(game.jump>0||game.vy>0){game.vy-=19*dt;game.jump+=game.vy*dt;if(game.jump<0){game.jump=0;game.vy=0;}}const corridor=routeFrame(routes[0],game.s);if(corridor.narrow)game.lane=0;if(game.jump>corridor.maxJump){game.jump=corridor.maxJump;game.vy=Math.min(game.vy,0);}game.lateral=T.MathUtils.damp(game.lateral,game.lane,mobileInput?.steering?30:13,dt);if(!game.tour||game.tourMoving){const lift=routeFrame(routes[0],game.s).lift;const speed=lift?10:game.tour?5.5:corridor.narrow?7.4:9.5+Math.min(game.s*.0045,4.5);const impactScale=game.impactSlow>0?1-.48*(game.impactSlow/.42):1;game.speed=speed*impactScale;if(lift){game.lane=0;game.jump=0;game.vy=0;game.slide=0;}game.checkpoint=Math.floor(game.s/70)*70;game.s=Math.min(routes[game.stage].length,game.s+game.speed*dt*(game.qaSpeed||1));if(game.s>=routes[0].length-.2)finish();}}
 if(game.mode!=='paused'&&game.mode!=='failed'&&game.mode!=='complete'){updateDog(dt);updateEntities(dt);deco.children.forEach(o=>{if(o.userData.s!==undefined)o.visible=o.userData.s-game.s>-18&&o.userData.s-game.s<95;if(o.visible)o.userData.animate?.(elapsed)});routeGroup.children.forEach(o=>{if(o.userData.updateRouteSurface){o.userData.updateRouteSurface(game.s,routeFrame(routes[0],game.s).lift)}else if(o.userData.ribbon){const n=o.userData.count,start=Math.max(0,Math.floor((game.s-12)/routes[0].length*n)),end=Math.min(n,Math.ceil((game.s+95)/routes[0].length*n));const step=o.userData.indicesPerStep||18;o.geometry.setDrawRange(start*step,(end-start)*step);o.visible=!routeFrame(routes[0],game.s).lift}else if(o.userData.s!==undefined)o.visible=o.userData.s-game.s>-12&&o.userData.s-game.s<95;});}else if(game.tour&&game.orbit)controls.update();hudTick+=dt;if(hudTick>.15){updateHUD();hudTick=0}pixel.render(scene,camera);}
requestAnimationFrame(tick);
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);pixel.resize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6))});
function buildLift(){
 const material=toonMaterial({color:'#ffcf50',});liftPlatform=new T.Group();const floor=new T.Mesh(new T.BoxGeometry(3.4,.25,3.4),material);liftPlatform.add(floor);scene.add(liftPlatform);liftPlatform.visible=false;
 for(const x of [48.4,51.6])for(const z of [18.4,21.6]){const rail=new T.Mesh(new T.BoxGeometry(.13,44.7,.13),toonMaterial({color:'#31c5d6'}));rail.position.set(x,28.1,z);scene.add(rail)}
 const sign=label('SPORTS LIFT','#ff694f');sign.position.set(50,51.6,20);scene.add(sign);
 const path=[[50,6,30],[50,6,25],[50,6,20]],upper=[[50,49.74,20],[53,49.74,23],[56,49.74,28],[58.5,48.34,32.5],[59.26,46.94,35.02]];
 for(const list of [path,upper])for(let i=1;i<list.length;i++){const a=new T.Vector3(...list[i-1]),b=new T.Vector3(...list[i]),d=b.clone().sub(a),mid=a.clone().add(b).multiplyScalar(.5);const deck=new T.Mesh(new T.BoxGeometry(3.1,.22,d.length()+.15),toonMaterial({color:'#5ad3de'}));deck.position.copy(mid);deck.position.y-=.12;deck.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),d.clone().normalize());scene.add(deck);}


}
async function boot(){const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);const [building,corgi]=await Promise.all([loader.loadAsync(assetUrl('campus-web.glb'),e=>progress('campus',e)),loader.loadAsync(assetUrl('corgi-web.glb'),e=>progress('corgi',e)),loadSportsAssets(loader)]);campus=building.scene;campus.position.set(-300,0,80);scene.add(campus);campus.updateMatrixWorld(true);campus.traverse(o=>{if(!o.isMesh)return;o.geometry=openBridgeEntrances(o.geometry,o.matrixWorld);o.castShadow=false;o.receiveShadow=false;o.material=Array.isArray(o.material)?o.material.map(styleCampusMaterial):styleCampusMaterial(o.material);o.geometry.computeBoundsTree({maxLeafSize:16});groundMeshes.push(o);});dog=new Corgi(corgi.scene,corgi.animations);scene.add(dog.root);buildLift();game.ready=true;resetStage(0);$('#loadbar').style.width='100%';$('#loadtext').textContent='伙伴就位，随时出发！';$('#start span').textContent='开始跑酷';$('#start').disabled=false;$('#tour').disabled=false;updateHUD();}
boot().catch(error=>{console.error('Game initialization failed',error);$('#loadtext').textContent='园区加载失败，请刷新重试。'+error.message;$('#start span').textContent='重新加载';$('#start').disabled=false;$('#start').onclick=()=>location.reload()});
// Read-only metrics aid production QA; commands are exposed only for local ?qa=1 sessions.
window.gameState=()=>({ready:game.ready,mobileInput:mobileInput?.snapshot(),mode:game.mode,stage:game.stage,s:game.s,lane:game.lane,lateral:game.lateral,jump:game.jump,slide:game.slide,score:game.score,hearts:game.hearts,collectedHearts:[...game.collected].filter(key=>key.startsWith('heart')).length,nextHeartS:entities.find(e=>e.type==='heart'&&!e.collected&&e.s>=game.s)?.s??null,tour:game.tour,orbit:game.orbit,picked:game.picked,collisions:game.collisions,impactCount:game.impactCount,activeImpacts:entities.filter(e=>e.impact?.active).length,lastImpact:game.lastImpact,impactObjects:entities.filter(e=>e.impact?.active).map(e=>({type:e.type,age:e.impact.age,travel:e.impact.travel,position:e.object.position.toArray(),rotation:e.object.quaternion.toArray()})),crashTime:game.crashTime,finished:game.finished,visited:[...game.visited],routeLengths:routes.map(r=>r.length),landmark:game.landmark,narrow:routeFrame(routes[0],game.s).narrow,maxJump:routeFrame(routes[0],game.s).maxJump,renderResolution:pixel.material.uniforms.resolution.value.toArray(),drawCalls:pixel.sceneStats?.calls,triangles:pixel.sceneStats?.triangles,cameraPosition:camera.position.toArray(),cameraTarget:controls.target.toArray(),speed:game.speed||0,animation:dog?.animation,animationTime:dog?.actions[dog.animation]?.time,runPlaybackRate:dog?.actions.Run.getEffectiveTimeScale(),heading:dog?.root.rotation.y,lift:routeFrame(routes[0],game.s).lift,animatedLegs:dog?Object.keys(dog.bones).filter(n=>/thigh/.test(n)).length:0,position:dog?dog.root.position.toArray():null,bones:dog?Object.keys(dog.bones):[]});
if(new URLSearchParams(location.search).has('qa'))window.qa={start,resetStage,action,hit,finish,scene,camera,renderer,routes,game,get dog(){return dog},get meshes(){return groundMeshes},frame:routeFrame,floor:safeFloor,setProgress(s){game.s=s;updateDog(.1);snapCamera()},};
if(new URLSearchParams(location.search).has('qa')){
 const panel=document.createElement('section');panel.id='qa-panel';panel.style='position:fixed;left:10px;top:205px;z-index:50;background:#ffffffe0;padding:8px;font:11px monospace;max-width:230px;border-radius:8px';panel.innerHTML='<label>进度 <input id="qa-progress" type="number" value="0" min="0" max="100" style="width:50px"></label><button id="qa-go">定位并停下</button><button id="qa-run">跑酷测试</button><button id="qa-next">抵达终点</button><button id="qa-full">加速巡检</button><button id="qa-impact">碰撞定格</button><button id="qa-feedback">连击提示</button><button id="qa-hide">隐藏面板</button><pre id="qa-state" style="white-space:pre-wrap"></pre>';document.body.append(panel);
 $('#qa-go').onclick=()=>{start(true,0);game.tourMoving=false;game.s=routes[game.stage].length*Number($('#qa-progress').value)/100;game.invulnerable=0;updateDog(.1);snapCamera();updateHUD();updateEntities(0);$('#tour-play').textContent='继续漫游'};
 $('#qa-run').onclick=()=>{start(false,0);clearInterval(countTimer);$('#countdown').classList.add('hidden');game.mode='running';game.s=routes[game.stage].length*Number($('#qa-progress').value)/100;snapCamera()};
 $('#qa-impact').onclick=()=>{
  if(game.qaImpactFrozen){game.qaImpactFrozen=false;game.mode='running';$('#qa-impact').textContent='碰撞定格';syncMusic({gesture:true});return;}
  start(false,0);const target=entities.find(e=>e.type==='block'&&e.s>30)||entities.find(e=>e.type==='cone');if(!target)return;
  game.s=target.s;game.lane=target.lane;game.lateral=target.lane;game.invulnerable=0;updateDog(0);snapCamera();updateEntities(0);
  for(let i=0;i<18;i++)updateImpacts(1/60);
  game.mode='paused';game.qaImpactFrozen=true;wasMode='running';syncMusic();updateHUD();$('#qa-impact').textContent='继续演示';
 };
 let qaFeedbackIndex=0;$('#qa-feedback').onclick=()=>{const examples=[{count:20,multiplier:2},{count:40,multiplier:3},{kind:'slide',text:'漂亮滑行',points:25},{kind:'jump',text:'轻巧一跃',points:25}];showCombo({...examples[qaFeedbackIndex++%examples.length],duration:60000});toast('好样的，保持运动节奏！',60000);};
 $('#qa-full').onclick=()=>{start(true,0);game.qaSpeed=5;};$('#qa-next').onclick=()=>{game.s=routes[game.stage].length-.3;game.tourMoving=true};$('#qa-hide').onclick=()=>panel.style.display='none';setInterval(()=>{if(game.ready)$('#qa-state').textContent=JSON.stringify(window.gameState(),(k,v)=>['bones','routeLengths'].includes(k)?undefined:v,1)},300);
}

