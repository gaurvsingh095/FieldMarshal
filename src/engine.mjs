/* FieldMarshal: deterministic, event-sourced simulated fleet orchestration.
   One minute per simulation tick; all times and distances are simulated units. */
export const clone = x => JSON.parse(JSON.stringify(x));
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const key = (a,b) => [a,b].sort().join('|');
export function validateConfig(c){
  if(!c || !Array.isArray(c.tractors)||!Array.isArray(c.fields)||!Array.isArray(c.jobs))throw Error('Malformed scenario');
  for(const type of ['tractors','fields','jobs'])if(new Set(c[type].map(x=>x.id)).size!==c[type].length)throw Error(`Duplicate ${type} ID`);
  const ids=new Set(c.fields.map(x=>x.id));
  for(const j of c.jobs){if(!ids.has(j.field)||!['spray','mow','inspect'].includes(j.type)||!(j.duration>0)||!(j.deadline>=0)||!(j.priority>=1&&j.priority<=5))throw Error(`Invalid job ${j.id}`)}
  for(const t of c.tractors){if(!Array.isArray(t.capabilities)||!(t.fuel>=0&&t.fuel<=t.maxFuel)||!(t.speed>0)||!(t.workRate>0))throw Error(`Invalid tractor ${t.id}`)}
  return true;
}
const center=f=>({x:f.x+f.w/2,y:f.y+f.h/2});
export function makeEngine(config,policy='smart'){
 validateConfig(config);const c=clone(config), fields=Object.fromEntries(c.fields.map(f=>[f.id,f]));
 const s={config:c,policy,time:0,tractors:c.tractors.map(t=>({...t,initialFuel:t.fuel,state:'idle',jobId:null,remaining:0,total:0,travel:0,idle:0,work:0,fuelUsed:0,route:[],reason:'Awaiting dispatch',lastAssigned:null,fromNode:'DEPOT'})),jobs:c.jobs.map(j=>({...j,state:'pending',assigned:null,progress:0,started:null,completedAt:null,missed:false})),events:[],logIndex:0,blockedEdges:new Set(c.blockedEdges||[]),replanCount:0,audit:{violationTicks:0,violations:[],progressLost:0,duplicateTicks:0,idleWithWork:0,abortedTravel:0,reroutes:0}};
 const log=(kind,message,extra={})=>s.events.push({seq:++s.logIndex,at:s.time,kind,message,...extra});
 const getField=j=>fields[j.field];
 const getTr=id=>s.tractors.find(t=>t.id===id);
 const getJob=id=>s.jobs.find(j=>j.id===id);
 const nodes=()=>[{id:'DEPOT',x:c.depot.x,y:c.depot.y},...c.fields.map(f=>({id:f.id,...center(f)}))];
 function route(from,fieldId){
   const ns=nodes(), src={id:from.lastAssigned||'DEPOT',x:from.x,y:from.y};
   const target=ns.find(n=>n.id===fieldId);if(!target)return null;
   // Discrete farm road network: any two field centers connect unless specifically blocked.
   // From a tractor between nodes, connect to its nearest unblocked network node.
   const dist=new Map(),prev=new Map(),unseen=new Set(ns.map(n=>n.id));
   const seed=ns.map(n=>({n,d:distance(src,n)})).sort((a,b)=>a.d-b.d)[0];
   dist.set(seed.n.id,seed.d);
   while(unseen.size){let u=null,best=Infinity;for(const id of unseen){const d=dist.get(id)??Infinity;if(d<best){best=d;u=id}}if(u===null)break;unseen.delete(u);if(u===fieldId)break;
     const a=ns.find(n=>n.id===u);for(const b of ns){if(!unseen.has(b.id)||s.blockedEdges.has(key(u,b.id)))continue;const alt=best+distance(a,b);if(alt<(dist.get(b.id)??Infinity)){dist.set(b.id,alt);prev.set(b.id,u)}}
   }
   if(!Number.isFinite(dist.get(fieldId)))return null;
   const path=[fieldId];let p=fieldId;while(prev.has(p)){p=prev.get(p);path.unshift(p)}
   return {length:dist.get(fieldId),path,waypoints:[...path.map(id=>ns.find(n=>n.id===id))]};
 }
 const fuelNeed=(t,r,j)=>r.length*0.13+(j.duration/t.workRate)*0.22;
 const eligible=(t,j)=>t.state==='idle'&&t.capabilities.includes(j.type)&&t.fuel>=fuelNeed(t,route(t,j.field)||{length:Infinity},j)+5&&!!route(t,j.field);
 function candidates(){let pairs=[];for(const t of s.tractors.filter(t=>t.state==='idle'))for(const j of s.jobs.filter(j=>j.state==='pending')){if(!eligible(t,j))continue;const r=route(t,j.field),travelTime=r.length/t.speed,finish=s.time+travelTime+j.duration*(1-j.progress)/t.workRate;const late=Math.max(0,finish-j.deadline);/* Smart policy score: priority value, minus travel time and field-work time, plus a bonus when the deadline is still achievable.
   Overdue work is NOT penalised (an earlier -4/min lateness term made late jobs ever later, e.g. a 46%-done priority-5 job waited 49 min). */
 const slack=j.deadline-finish;const score=policy==='baseline' ? -(s.jobs.indexOf(j)*1e6+s.tractors.indexOf(t)*1e3) : j.priority*9 - travelTime+(slack>=0?9:0) - j.duration/t.workRate*.24 + (j.type==='inspect'?3:0);
 pairs.push({t,j,r,travelTime,finish,late,score});}return pairs}
 function assign(p){const {t,j,r,finish,late}=p;t.state='travel';t.jobId=j.id;t.remaining=r.length;t.total=r.length;t.route=r.waypoints;t.lastAssigned=j.field;j.state='travel';j.assigned=t.id;j.started??=s.time;
   t.reason=policy==='baseline'?'First compatible idle tractor, in submitted job order':`Best-scoring of ${p.n} feasible tractor-job pairs: priority ${j.priority}/5, deadline T+${j.deadline}, ETA T+${Math.ceil(finish)} (${late?Math.ceil(late)+'m projected late — overdue work is not deferred':Math.floor(j.deadline-finish)+'m slack'}); ${r.length.toFixed(1)} units travel${j.progress>0?`; resumes at ${Math.round(j.progress*100)}% done`:''}; implement ${t.implement} supports ${j.type}; fuel ${Math.round(t.fuel)} ≥ need+reserve`;
   log('assignment',`${t.name} assigned ${j.type} at ${getField(j).name}`,{tractor:t.id,job:j.id,reason:t.reason});}
 function dispatch(){let did=0;for(;;){const list=candidates().sort((a,b)=>b.score-a.score||a.j.id.localeCompare(b.j.id)||a.t.id.localeCompare(b.t.id));if(!list.length)break;list[0].n=list.length;assign(list[0]);did++;}return did}
 function release(t,reason){if(t.state==='travel')s.audit.abortedTravel+=t.total-t.remaining;const j=getJob(t.jobId);if(j && j.state!=='done'){j.state='pending';j.assigned=null;log('recovery',`${j.id} returned to queue (${reason}); preserved ${Math.round(j.progress*100)}% field progress`,{job:j.id,tractor:t.id});}t.jobId=null;t.route=[];t.remaining=0;t.total=0;if(t.state!=='failed')t.state='idle'}
 function tick(){if(s.time>=c.duration)return false;s.time++;
   for(const t of s.tractors){if(t.state==='failed')continue;
     if(t.state==='idle'){t.idle++;if(s.jobs.some(j=>j.state==='pending'&&t.capabilities.includes(j.type)))s.audit.idleWithWork++;continue}
     const j=getJob(t.jobId);if(!j){t.state='idle';continue}
     if(t.state==='travel'){let budget=t.speed,covered=0;while(budget>1e-8&&t.route.length){const dest=t.route[0],seg=distance(t,dest);if(seg<1e-8){t.route.shift();continue}const d=Math.min(seg,budget);t.x+=(dest.x-t.x)*d/seg;t.y+=(dest.y-t.y)*d/seg;budget-=d;covered+=d;if(d>=seg-1e-8)t.fromNode=t.route.shift().id;}t.remaining=Math.max(0,t.remaining-covered);t.travel+=covered;t.fuel=Math.max(0,t.fuel-covered*.13);t.fuelUsed+=covered*.13;
       if(t.remaining<=1e-8||t.route.length===0){const f=center(getField(j));t.x=f.x;t.y=f.y;t.state='working';j.state='working';t.remaining=j.duration*(1-j.progress)/t.workRate;t.total=j.duration/t.workRate;log('arrival',`${t.name} began ${j.type} at ${getField(j).name}`,{tractor:t.id,job:j.id});}
     }else if(t.state==='working'){const used=Math.min(1,t.remaining);t.remaining-=used;t.work+=used;t.fuel=Math.max(0,t.fuel-used*.22);t.fuelUsed+=used*.22;j.progress=Math.min(1,j.progress+used*t.workRate/j.duration);
       if(t.remaining<=1e-8||j.progress>=1-1e-8){j.progress=1;j.state='done';j.assigned=null;j.completedAt=s.time;j.missed=s.time>j.deadline;log('completed',`${t.name} completed ${j.id}${j.missed?' after deadline':''}`,{tractor:t.id,job:j.id});t.jobId=null;t.state='idle';t.remaining=0;t.route=[];}
     }
   }
   dispatch();audit();return true;
 }
 function audit(){const errs=check();if(errs.length){s.audit.violationTicks++;s.audit.violations.push({at:s.time,errors:errs})}const seen=new Map();for(const t of s.tractors)if(t.jobId)seen.set(t.jobId,(seen.get(t.jobId)||0)+1);if([...seen.values()].some(n=>n>1))s.audit.duplicateTicks++;for(const j of s.jobs){const prev=s._progress?.[j.id]??0;if(j.progress<prev-1e-9)s.audit.progressLost+=prev-j.progress}s._progress=Object.fromEntries(s.jobs.map(j=>[j.id,j.progress]))}
 function fail(id){const t=getTr(id);if(!t||t.state==='failed')return false;const job=t.jobId;t.state='failed';if(job)release(t,'tractor breakdown');log('breakdown',`${t.name} failed${job?`; ${job} requires reassignment`:''}`,{tractor:id,job});s.replanCount++;dispatch();return true}
 function repair(id){const t=getTr(id);if(!t||t.state!=='failed')return false;t.state='idle';log('repair',`${t.name} returned to service`,{tractor:id});s.replanCount++;dispatch();return true}
 function block(a,b){if(a===b||!nodes().some(n=>n.id===a)||!nodes().some(n=>n.id===b))return false;s.blockedEdges.add(key(a,b));log('block',`Road between ${a} and ${b} blocked`,{edge:key(a,b)});s.replanCount++;
  // Safety-first: halt and reroute all in-flight travels, preserve work progress.
  const k=key(a,b);for(const t of s.tractors.filter(t=>t.state==='travel')){const ids=[t.fromNode,...t.route.map(n=>n.id)];let uses=false;for(let i=1;i<ids.length;i++)if(key(ids[i-1],ids[i])===k)uses=true;if(!uses)continue;const j=getJob(t.jobId),r=route(t,j.field);if(r&&t.fuel>=fuelNeed(t,r,j)+5){t.route=r.waypoints;t.remaining=r.length;t.total=r.length;s.audit.reroutes++;log('reroute',`${t.name} rerouted around closed road to ${getField(j).name} (${r.length.toFixed(1)} units, via ${r.path.join(' → ')})`,{tractor:t.id,job:j.id})}else release(t,'no feasible route after road closure')}dispatch();return true}
 function unblock(a,b){s.blockedEdges.delete(key(a,b));log('unblock',`Road between ${a} and ${b} reopened`,{edge:key(a,b)});s.replanCount++;dispatch();return true}
 function reprioritize(id,p){const j=getJob(id);if(!j||j.state==='done'||!(p>=1&&p<=5))return false;j.priority=p;log('priority',`${id} priority changed to ${p}`,{job:id});s.replanCount++;dispatch();
  // Escalated job still waiting: pre-empt at most one compatible tractor that is still driving to lower-priority work (no field work lost), closest first.
  if(j.state==='pending'){const f=center(getField(j));const pre=s.tractors.filter(t=>t.state==='travel'&&t.capabilities.includes(j.type)&&getJob(t.jobId).priority<p).sort((x,y)=>distance(x,f)-distance(y,f))[0];if(pre){release(pre,`pre-empted for priority-${p} ${id}`);const r=route(pre,j.field);if(r&&eligible(pre,j)){const travelTime=r.length/pre.speed,finish=s.time+travelTime+j.duration*(1-j.progress)/pre.workRate;assign({t:pre,j,r,finish,late:Math.max(0,finish-j.deadline),n:1})}dispatch()}}return true}
 function refuel(id){const t=getTr(id);if(!t||t.state!=='idle')return false;const d=distance(t,c.depot);if(d>4)return false;t.fuel=t.maxFuel;log('refuel',`${t.name} refueled at depot`,{tractor:id});dispatch();return true}
 function metrics(){const done=s.jobs.filter(j=>j.state==='done'),ontime=done.filter(j=>!j.missed);return {completed:done.length,ontime:ontime.length,weightedValue:done.reduce((n,j)=>n+j.priority,0),travel:+s.tractors.reduce((n,t)=>n+t.travel,0).toFixed(1),idle:+s.tractors.reduce((n,t)=>n+t.idle,0).toFixed(1),working:+s.tractors.reduce((n,t)=>n+t.work,0).toFixed(1),fuel:+s.tractors.reduce((n,t)=>n+t.fuelUsed,0).toFixed(1),replans:s.replanCount,violations:s.audit.violationTicks,idleWithWork:s.audit.idleWithWork,lateMinutes:done.reduce((n,j)=>n+Math.max(0,j.completedAt-j.deadline),0),abortedTravel:+s.audit.abortedTravel.toFixed(1),reroutes:s.audit.reroutes,progressLost:+s.audit.progressLost.toFixed(4),duplicateTicks:s.audit.duplicateTicks,unfinished:s.jobs.filter(j=>j.state!=='done').map(j=>j.id)};}
 function check(){const errors=[],active=new Set();for(const t of s.tractors){if(!t.jobId)continue;if(active.has(t.jobId))errors.push('Duplicate '+t.jobId);active.add(t.jobId);const j=getJob(t.jobId);if(!j||j.assigned!==t.id||!t.capabilities.includes(j.type))errors.push('Invalid assignment '+t.id)}for(const j of s.jobs){if(j.state==='done'&&j.progress!==1)errors.push('Lost completed work '+j.id);if(j.assigned&&!active.has(j.id))errors.push('Orphan '+j.id)}return errors}
 function snapshot(){return {time:s.time,tractors:clone(s.tractors),jobs:clone(s.jobs),events:clone(s.events),metrics:metrics(),blockedEdges:[...s.blockedEdges],replanCount:s.replanCount,violations:check(),audit:clone(s.audit)}}
 log('start',`${policy==='smart'?'FieldMarshal optimizer':'FCFS baseline'} initialized with ${s.tractors.length} tractors / ${s.jobs.length} jobs`);dispatch();
 return {state:s,tick,fail,repair,block,unblock,reprioritize,refuel,metrics,check,snapshot};
}
export function applyEvent(e,ev){if(ev.kind==='breakdown')return e.fail(ev.tractor);if(ev.kind==='repair')return e.repair(ev.tractor);if(ev.kind==='block')return e.block(ev.a,ev.b);if(ev.kind==='unblock')return e.unblock(ev.a,ev.b);if(ev.kind==='priority')return e.reprioritize(ev.job,ev.priority);return false}
/* Run one policy over the horizon with an identical, time-stamped event schedule (events at minute t fire before tick t+1). */
export function runPolicy(config,policy,events=[],duration=config.duration){const e=makeEngine(config,policy);for(let t=0;t<duration;t++){for(const ev of events.filter(v=>v.at===t))applyEvent(e,ev);e.tick();}return e}
export function compare(config,events=[],duration=config.duration){const results={};for(const policy of ['baseline','smart'])results[policy]=runPolicy(config,policy,events,duration).metrics();return results}
