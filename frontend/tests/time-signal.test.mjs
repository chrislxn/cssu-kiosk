import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../time-signal.js',import.meta.url),'utf8');
const configSource=fs.readFileSync(new URL('../time-signal-config.js',import.meta.url),'utf8');
class Element {
 constructor(tag='div'){this.tagName=tag;this.children=[];this.attributes={};this.style={setProperty(){}};this.hidden=false;this.classes=new Set();this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x),contains:x=>this.classes.has(x)};}
 set className(s){this.classes=new Set(s.split(' ').filter(Boolean))}get className(){return [...this.classes].join(' ')}
 append(...children){for(const child of children){child.parent=this;this.children.push(child)}}
 replaceChildren(...children){this.children=[];this.append(...children)}
 setAttribute(k,v){this.attributes[k]=v}getAttribute(k){return this.attributes[k]??null}removeAttribute(k){delete this.attributes[k]}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this)}
}
function setup(iso,{storage=new Map(),preview=false,enabled=true}={}){
 let clock=Date.parse(iso),nextId=1,resumes=0;
 const timers=new Map(),listeners=new Map(),windowListeners=new Map();
 class TestDate extends Date{constructor(...args){super(...(args.length?args:[clock]))}static now(){return clock}}
 const root=new Element();for(let i=0;i<4;i++)root.append(new Element());
 const document={hidden:false,getElementById:id=>id==='screen'?root:null,createElement:tag=>new Element(tag),addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),dispatchEvent:event=>{if(event.type==='cssu:time-signal-end')resumes++;listeners.get(event.type)?.(event);return true;}};
 const addTimer=(fn,ms,interval)=>{const id=nextId++;timers.set(id,{fn,at:clock+ms,interval});return id};
 const context={Date:TestDate,Intl,URLSearchParams,CustomEvent:class {constructor(type,options={}){this.type=type;this.detail=options.detail}},console,document,location:{search:preview?'?time-signal-preview=1':''},sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},setTimeout:(f,ms)=>addTimer(f,ms,0),setInterval:(f,ms)=>addTimer(f,ms,ms),clearTimeout:id=>timers.delete(id),clearInterval:id=>timers.delete(id),addEventListener:(name,fn)=>windowListeners.set(name,fn),removeEventListener:name=>windowListeners.delete(name)};
 context.window=context;vm.createContext(context);vm.runInContext(configSource,context);context.CSSU_TIME_SIGNAL_CONFIG.enabled=enabled;
 // Neither event data nor its player API can be accessed in this standalone run.
 Object.defineProperty(context,'CSSU_CONTENT',{get(){throw Error('Unexpected event content dependency')}});
 Object.defineProperty(context,'CSSUSignage',{get(){throw Error('Unexpected event player dependency')}});
 vm.runInContext(source,context);
 const walk=e=>[e,...e.children.flatMap(walk)];
 return {api:context.CSSUTimeSignal,root,storage,timers,document,listeners,windowListeners,stall(ms){clock+=ms},resumes:()=>resumes,find:cls=>walk(root).filter(e=>e.classes.has(cls)),advance(ms){const target=clock+ms;let n=0;while(true){const due=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;if(++n>5000)throw Error('timer loop');const [id,t]=due;clock=Math.max(clock,t.at);if(t.interval)t.at=clock+t.interval;else timers.delete(id);t.fn()}clock=target}};
}
const h=setup('2026-10-24T05:59:59.500Z');
assert.equal(h.api.isActive(),false);
assert.equal(h.timers.size,1,'idle scheduler has exactly one deadline');
assert.equal([...h.timers.values()].filter(t=>t.interval).length,0,'idle scheduler has no interval/poll');
assert.equal(h.api.getState().nextScheduledAt,Date.parse('2026-10-24T06:00:00Z'));
h.advance(499);assert.equal(h.api.isActive(),false);
h.advance(1);assert.equal(h.api.isActive(),true);assert.equal(h.api.getState().startedAt,Date.parse('2026-10-24T06:00:00Z'));
assert.equal(h.api.getState().dispatchDelayMs,0);
assert.equal(h.api.getState().nextScheduledAt,Date.parse('2026-10-24T06:10:00Z'));
assert.equal(h.find('signal-hours').map(e=>e.textContent).join(','),'02:00,23:00,02:00,14:00,07:00,15:00,15:00,11:30,17:00');
assert.equal(h.find('signal-offset')[7].textContent,'UTC+05:30');
assert.match(h.find('signal-date')[1].textContent,/23 Oct/);
assert.equal(h.find('signal-page').length,3);
h.advance(4999);assert.equal(h.api.getState().page,1);
h.advance(1);assert.equal(h.api.getState().page,2);
assert.equal(h.api.getState().cities.join(','),'Los Angeles,New York,Shanghai,London');
h.advance(7200);assert.equal(h.api.getState().page,3);
assert.equal(h.api.getState().cities.join(','),'Tokyo,Seoul,New Delhi,Sydney');
h.advance(7200);assert(h.find('time-signal')[0].classes.has('is-closing'));
h.advance(600);assert.equal(h.api.isActive(),false);assert.equal(h.resumes(),1);
assert.equal(h.timers.size,1);assert.equal([...h.timers.values()].filter(t=>t.interval).length,0);
assert(h.root.children.slice(0,4).every(e=>e.getAttribute('aria-hidden')===null));
h.advance(580000);assert(h.api.isActive(),'ten-minute deadline fires directly');
assert.equal(h.api.getState().startedAt,Date.parse('2026-10-24T06:10:00Z'));
assert.equal(h.api.getState().dispatchDelayMs,0);
const a=h.api.boundaryAt('2026-11-01T05:00:00Z'),b=h.api.boundaryAt('2026-11-01T06:00:00Z');assert(a.due&&b.due);assert.notEqual(a.slot,b.slot);
assert.equal(h.api.boundaryAt('2026-10-24T06:00:00.001Z').due,false,'no startup grace window');
h.api.destroy();assert.equal(h.timers.size,0);
// Even a late delivered callback executes its registered task; no seconds gate discards it.
const delayed=setup('2026-10-24T05:59:59.500Z');delayed.stall(4000);delayed.advance(0);
assert(delayed.api.isActive());assert.equal(delayed.api.getState().dispatchDelayMs,3500);
assert.equal(delayed.api.getState().lastScheduledAt,Date.parse('2026-10-24T06:00:00Z'));
assert.equal(delayed.api.getState().nextScheduledAt,Date.parse('2026-10-24T06:10:00Z'),'deadline must not drift with callback delay');delayed.api.destroy();
// Starting or returning after a boundary never launches an off-time catch-up.
const after=setup('2026-10-24T06:00:02Z');assert(!after.api.isActive());assert.equal(after.api.getState().nextScheduledAt,Date.parse('2026-10-24T06:10:00Z'));after.api.destroy();
// An operator preview cannot postpone a real ten-minute signal.
const spanning=setup('2026-10-24T05:59:59Z',{preview:true});spanning.advance(1000);
assert(spanning.api.isActive());assert.equal(spanning.api.getState().startedAt,Date.parse('2026-10-24T06:00:00Z'));assert.equal(spanning.api.getState().page,1);spanning.advance(20000);assert(!spanning.api.isActive());spanning.api.destroy();
// Completed signals are deduplicated at an exact-boundary reload.
const completed=setup('2026-10-24T06:00:00Z');completed.advance(20000);
const reload=setup('2026-10-24T06:00:00Z',{storage:completed.storage});reload.advance(0);assert(!reload.api.isActive());assert.equal(reload.api.getState().nextScheduledAt,Date.parse('2026-10-24T06:10:00Z'));completed.api.destroy();reload.api.destroy();
// Restored pages get a new exact future deadline, not a dead controller or stale replay.
const cached=setup('2026-10-24T05:59:59Z');cached.windowListeners.get('pagehide')({persisted:true});assert.equal(cached.timers.size,0);cached.stall(6000);cached.windowListeners.get('pageshow')({persisted:true});assert(!cached.api.isActive());assert.equal(cached.api.getState().nextScheduledAt,Date.parse('2026-10-24T06:10:00Z'));cached.advance(595000);assert(cached.api.isActive());cached.api.destroy();
const returned=setup('2026-10-24T05:59:59Z');returned.document.hidden=true;returned.listeners.get('visibilitychange')();assert.equal(returned.timers.size,0);returned.stall(6000);returned.document.hidden=false;returned.listeners.get('visibilitychange')();assert(!returned.api.isActive());assert.equal(returned.api.getState().nextScheduledAt,Date.parse('2026-10-24T06:10:00Z'));returned.api.destroy();
// Simulate a full day: 144 completed signals, no accumulating timers or idle intervals.
const day=setup('2026-10-24T04:00:00Z');day.advance(86400000-1);assert.equal(day.resumes(),144);assert.equal(day.timers.size,1);assert.equal([...day.timers.values()].filter(t=>t.interval).length,0);day.api.destroy();
const disabled=setup('2026-10-24T06:00:00Z',{enabled:false});disabled.advance(0);assert(!disabled.api.isActive());assert.equal(disabled.timers.size,1);disabled.api.destroy();
console.log('PASS: one-shot exact hour/ten-minute deadlines; zero idle polling; zero artificial delay; no drift; 20-second 1+4+4 playback; late-callback diagnostics; no off-time startup/return; preview preemption; completed-slot deduplication; BFCache recovery; nine-city DST/date/offset checks; 144-signal day simulation; module independence and timer cleanup.');
