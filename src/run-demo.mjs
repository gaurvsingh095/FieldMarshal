/* Regenerates all evidence in artifacts/ deterministically: node src/run-demo.mjs */
import fs from 'node:fs';
import {runPolicy,compare} from './engine.mjs';
const out=new URL('../artifacts/',import.meta.url);fs.mkdirSync(out,{recursive:true});
const definitions={
 completed:'Jobs with 100% progress inside the fixed horizon',
 ontime:'Completed jobs whose completion minute <= deadline',
 lateMinutes:'Sum over completed jobs of max(0, completion minute - deadline)',
 travel:'Grid units actually driven by all tractors (x metersPerUnit for km)',
 idle:'Tractor-minutes in idle state (failed tractors excluded), whether or not work remained',
 idleWithWork:'Idle tractor-minutes while a pending job the tractor is equipped for existed',
 violations:'Simulated minutes in which any invariant failed (duplicate job, incompatible implement, orphaned assignment, completed job <100%); checked every minute',
 duplicateTicks:'Minutes in which one job was held by >1 tractor',
 progressLost:'Total job-progress fraction that ever decreased (lost work)',
 abortedTravel:'Grid units driven toward assignments later cancelled by a replan',
 reroutes:'In-flight trips rerouted (job kept) after a road closure',
 replans:'Disruption events that triggered a re-dispatch',
 weightedValue:'Sum of priorities of completed jobs'};
const summary={generatedBy:'node src/run-demo.mjs',deterministic:true,definitions,regions:{}};
for(const region of ['yuma-winter','pinal-fall']){
 const c=JSON.parse(fs.readFileSync(new URL(`../scenarios/${region}.json`,import.meta.url)));
 const events=c.incidents||[];
 const runs={};for(const policy of ['baseline','smart']){const e=runPolicy(c,policy,events);if(e.state.audit.violations.length)throw Error(`${region}/${policy} invariant violation `+JSON.stringify(e.state.audit.violations[0]));runs[policy]=e;}
 const metrics=compare(c,events);const metricsNoIncidents=compare(c,[]);
 const km=v=>+(v*c.grid.metersPerUnit/1000).toFixed(2);
 fs.writeFileSync(new URL(`${region}-event-log.json`,out),JSON.stringify({scenario:c.name,region:c.region,policy:'FieldMarshal (smart)',horizonMinutes:c.duration,fieldGeometry:'Synthetic farm layout',injectedEvents:events,events:runs.smart.state.events,finalState:runs.smart.snapshot(),metrics:metrics.smart},null,2));
 fs.writeFileSync(new URL(`${region}-baseline-event-log.json`,out),JSON.stringify({scenario:c.name,policy:'FCFS baseline',injectedEvents:events,events:runs.baseline.state.events,metrics:metrics.baseline},null,2));
 summary.regions[region]={scenario:c.name,horizonMinutes:c.duration,injectedEvents:events,metrics,metricsNoIncidents,travelKm:{baseline:km(metrics.baseline.travel),smart:km(metrics.smart.travel)},metersPerGridUnit:c.grid.metersPerUnit,
  disclaimers:['Crop mix grounded in University of Arizona Cooperative Extension sources','Field geometry, speeds, durations, fuel, weather and telemetry are synthetic/illustrative','Not suitable for real-world autonomous machine guidance']};
}
fs.writeFileSync(new URL('baseline-comparison.json',out),JSON.stringify(summary,null,2));
fs.copyFileSync(new URL('yuma-winter-event-log.json',out),new URL('demo-event-log.json',out));
const rows=[];for(const [r,v] of Object.entries(summary.regions))for(const p of ['baseline','smart']){const m=v.metrics[p];rows.push({region:r,policy:p==='smart'?'FieldMarshal':'FCFS',done:m.completed,onTime:m.ontime,lateMin:m.lateMinutes,km:v.travelKm[p],idle:m.idle,idleWithWork:m.idleWithWork,violations:m.violations,dupMin:m.duplicateTicks,lost:m.progressLost,aborted:m.abortedTravel,reroutes:m.reroutes,unfinished:m.unfinished.join(',')||'-'})}
console.table(rows);
const calm=[];for(const [r,v] of Object.entries(summary.regions))for(const p of ['baseline','smart']){const m=v.metricsNoIncidents[p];calm.push({region:r,policy:p==='smart'?'FieldMarshal':'FCFS',condition:'no incidents',done:m.completed,onTime:m.ontime,lateMin:m.lateMinutes,km:+(m.travel*v.metersPerGridUnit/1000).toFixed(2),idle:m.idle,violations:m.violations})}console.table(calm);
