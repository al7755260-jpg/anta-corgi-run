import './mobile-controls.css';

const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const laneNames = ['左侧跑道','中间跑道','右侧跑道'];

export function createMobileControls({host,getState,selectLane,jump,slide}) {
  host.classList.add('mobile-controls');
  host.innerHTML = `<div class="mobile-steering"><div class="mobile-joystick" role="slider" tabindex="0" aria-label="跟手方向轮，拖动连续移动，松手吸附跑道" aria-orientation="horizontal" aria-valuemin="-1" aria-valuemax="1" aria-valuenow="0"><span class="mobile-direction mobile-direction-left" aria-hidden="true">‹</span><span class="mobile-direction mobile-direction-right" aria-hidden="true">›</span><span class="mobile-stick-track" aria-hidden="true"></span><span class="mobile-stick-thumb" aria-hidden="true"><span>↔</span></span></div><span class="mobile-control-caption">跟手换道</span></div><div class="mobile-action-pad"><div class="mobile-action-buttons"><button type="button" class="mobile-action mobile-jump" aria-label="跳跃"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 15 16 4l11 11-5 5-3-3v11h-6V17l-3 3Z"/></svg><span>跳跃</span></button><button type="button" class="mobile-action mobile-slide" aria-label="下蹲，长按持续"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 17 16 28l11-11-5-5-3 3V4h-6v11l-3-3Z"/></svg><span>下蹲</span></button></div><span class="mobile-control-caption">下蹲可长按</span></div>`;
  const wheel = host.querySelector('.mobile-joystick');
  const thumb = host.querySelector('.mobile-stick-thumb');
  const jumpButton = host.querySelector('.mobile-jump');
  const slideButton = host.querySelector('.mobile-slide');
  let stick = null, jumpPointer = null, slidePointer = null;
  let thumbX = 0, thumbY = 0, selected = 0, continuous = 0, lastActive, lastCanSteer;
  const stopEvent = event => {event.preventDefault();event.stopPropagation();};
  const capture = (element,id) => {try {element.setPointerCapture(id);} catch {}};
  const release = (element,id) => {if(id === null)return;try {if(element.hasPointerCapture(id))element.releasePointerCapture(id);} catch {}};
  const usable = event => getState().active && (event.pointerType !== 'mouse' || event.button === 0);

  function showLane(lane) {
    selected = clamp(Math.round(lane),-1,1);
    wheel.setAttribute('aria-valuenow',String(selected));
    wheel.setAttribute('aria-valuetext',laneNames[selected+1]);
    wheel.dataset.lane = String(selected);
  }
  function choose(lane) {continuous=clamp(lane,-1,1);showLane(continuous);selectLane(continuous);}
  function moveThumb(x,y) {
    thumbX=x;thumbY=y;
    thumb.style.setProperty('--stick-x',`${x}px`);
    thumb.style.setProperty('--stick-y',`${y}px`);
  }
  function steer(event) {
    if(!stick || event.pointerId !== stick.id)return;
    const state=getState();
    if(!state.active || !state.canSteer){stopStick(false);return;}
    stopEvent(event);
    let x=event.clientX-stick.centerX,y=event.clientY-stick.centerY;
    const length=Math.hypot(x,y);
    if(length>stick.radius){x*=stick.radius/length;y*=stick.radius/length;}
    moveThumb(x,y);
    const horizontal=x/stick.radius,deadZone=.10;
    const offset=Math.abs(horizontal)<=deadZone?0:Math.sign(horizontal)*(Math.abs(horizontal)-deadZone)/(1-deadZone);
    // Map displacement from the lane selected on pointer-down. Holding the wheel
    // never repeats lane changes; its full throw can cross both adjacent lanes.
    continuous=clamp(stick.anchor+offset*2,-1,1);
    choose(continuous);
  }
  function stopStick(snap) {
    if(!stick)return;
    const id=stick.id;stick=null;
    // Also settle cancelled/interrupted gestures, including while paused.
    // Narrow passages and lifts hand control back to the route's centre.
    choose(getState().canSteer?Math.round(continuous):0);
    wheel.classList.remove('is-active');moveThumb(0,0);release(wheel,id);
  }
  function releaseSlide() {
    const id=slidePointer;slidePointer=null;
    slideButton.classList.remove('is-pressed');slideButton.setAttribute('aria-pressed','false');release(slideButton,id);
  }
  function releaseJump() {
    const id=jumpPointer;jumpPointer=null;
    jumpButton.classList.remove('is-pressed');release(jumpButton,id);
  }
  wheel.addEventListener('pointerdown',event => {
    stopEvent(event);
    if(!usable(event) || !getState().canSteer || stick)return;
    const rect=wheel.getBoundingClientRect();
    const radius=Math.max(22,(Math.min(rect.width,rect.height)-thumb.offsetWidth)/2-3);
    showLane(getState().lane);continuous=selected;
    stick={id:event.pointerId,centerX:rect.left+rect.width/2,centerY:rect.top+rect.height/2,radius,anchor:selected};
    wheel.classList.add('is-active');capture(wheel,event.pointerId);steer(event);
  });
  wheel.addEventListener('pointermove',steer);
  wheel.addEventListener('pointerup',event => {if(stick?.id===event.pointerId){stopEvent(event);steer(event);stopStick(true);}});
  for(const type of ['pointercancel','lostpointercapture'])wheel.addEventListener(type,event => {if(stick?.id===event.pointerId){stopEvent(event);stopStick(false);}});
  wheel.addEventListener('keydown',event => {
    if(!['ArrowLeft','ArrowRight'].includes(event.code))return;
    stopEvent(event);
    if(event.repeat || !getState().active || !getState().canSteer)return;
    choose(getState().lane+(event.code==='ArrowLeft'?-1:1));
  });

  jumpButton.addEventListener('pointerdown',event => {
    stopEvent(event);if(!usable(event) || jumpPointer!==null)return;
    releaseSlide();jumpPointer=event.pointerId;jumpButton.classList.add('is-pressed');capture(jumpButton,event.pointerId);jump();
  });
  slideButton.addEventListener('pointerdown',event => {
    stopEvent(event);if(!usable(event) || slidePointer!==null)return;
    slidePointer=event.pointerId;slideButton.classList.add('is-pressed');slideButton.setAttribute('aria-pressed','true');capture(slideButton,event.pointerId);slide();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture']) {
    jumpButton.addEventListener(type,event => {if(jumpPointer===event.pointerId){stopEvent(event);releaseJump();}});
    slideButton.addEventListener(type,event => {if(slidePointer===event.pointerId){stopEvent(event);releaseSlide();}});
  }
  // Keyboard/assistive clicks have detail 0. Pointer clicks already fired on down.
  jumpButton.addEventListener('click',event => {stopEvent(event);if(event.detail===0&&getState().active){releaseSlide();jump();}});
  slideButton.addEventListener('click',event => {stopEvent(event);if(event.detail===0&&getState().active)slide();});
  host.addEventListener('contextmenu',stopEvent);

  function reset() {
    stopStick(false);releaseSlide();releaseJump();moveThumb(0,0);showLane(getState().lane);
  }
  function update() {
    const state=getState();
    if(!state.active&&(stick||slidePointer!==null||jumpPointer!==null))reset();else if(!state.canSteer)stopStick(false);
    if(!stick&&selected!==Math.round(state.lane))showLane(state.lane);
    if(state.active!==lastActive||state.canSteer!==lastCanSteer){
      wheel.setAttribute('aria-disabled',String(!state.active||!state.canSteer));
      wheel.tabIndex=state.active&&state.canSteer?0:-1;
      jumpButton.disabled=slideButton.disabled=!state.active;
      lastActive=state.active;lastCanSteer=state.canSteer;
    }
  }
  addEventListener('blur',reset);addEventListener('resize',reset);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  showLane(getState().lane);update();
  return {
    reset,update,releaseSlide,
    get slideHeld(){return slidePointer!==null;},
    get steering(){return !!stick;},
    snapshot:()=>({stickActive:!!stick,slideHeld:slidePointer!==null,jumpHeld:jumpPointer!==null,lane:selected,continuous:stick?continuous:getState().lane,follow:true,thumb:[thumbX,thumbY]}),
  };
}
