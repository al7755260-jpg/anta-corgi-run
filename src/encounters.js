// Deterministic encounter phrases: readable choices followed by a short action.
// Every solid-block row keeps a free lane; full-width rows are jumpable hurdles.
export function buildEncounters(route, frame) {
  const rows=[];
  const add=(s,items,rewardLane)=>rows.push({s,items,rewardLane});
  const clear=(s,jump=.9)=>[-3,0,4,10,17].every(d=>{
    const f=frame(route,s+d);return !f.lift&&!f.narrow&&f.maxJump>=jump;
  });
  for(let s=15,phrase=0;s<route.length-24;s+=34,phrase++){
    if(!clear(s))continue;
    const safe=[0,-1,1,0,1,-1][phrase%6],other=[-1,0,1].filter(l=>l!==safe);
    const kind=phrase%5;
    if(s<55){add(s,[{lane:phrase%3-1,type:'cone'}],safe);continue;}
    if(kind===0){
      add(s,other.map(lane=>({lane,type:'block'})),safe);
      add(s+17,[{lane:safe,type:'hurdle'}],safe);
    }else if(kind===1){
      add(s,[{lane:-1,type:'block'},{lane:0,type:'cone'}],1);
      add(s+17,[{lane:1,type:'block'},{lane:0,type:'hurdle'}],-1);
    }else if(kind===2){
      add(s,[{lane:safe,type:'arch'},{lane:other[0],type:'block'}],safe);
      add(s+17,[{lane:other[1],type:'cone'}],safe);
    }else if(kind===3&&clear(s,1.2)){
      add(s,[-1,0,1].map(lane=>({lane,type:'hurdle'})),0);
    }else{
      add(s,[{lane:0,type:'block'},{lane:-1,type:'hurdle'}],1);
      add(s+17,[{lane:1,type:'arch'},{lane:-1,type:'cone'}],0);
    }
  }
  return rows.sort((a,b)=>a.s-b.s);
}

export function coinGuide(rows, s, narrow) {
  if(narrow)return {lane:0,height:.5};
  const row=rows.find(r=>r.s-s>=-2.2&&r.s-s<19);
  if(!row)return {lane:Math.floor(s/20)%3-1,height:.5};
  const lane=row.rewardLane,obstacle=row.items.find(o=>o.lane===lane);
  const delta=Math.abs(row.s-s);
  const height=obstacle?.type==='hurdle'&&delta<3.5?.5+Math.sin((1-delta/3.5)*Math.PI*.5)*.85:.5;
  return {lane,height};
}
