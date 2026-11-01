import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
class Element {
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.dataset={};this.children=[];this.attributes={};this.classes=new Set();this.offsetWidth=1000;this.style={values:{},setProperty(k,v){this.values[k]=v}};this.classList={add:x=>this.classes.add(x),remove:x=>this.classes.delete(x),toggle:(x,on)=>on?this.classes.add(x):this.classes.delete(x),contains:x=>this.classes.has(x)};}
 set className(s){this.classes=new Set(s.split(' ').filter(Boolean))}get className(){return [...this.classes].join(' ')}
 append(...nodes){nodes.forEach(n=>{n.parent=this;this.children.push(n)})}replaceChildren(...nodes){this.children=[];this.append(...nodes)}
 setAttribute(k,v){this.attributes[k]=v}getAttribute(k){return this.attributes[k]??null}removeAttribute(k){delete this.attributes[k]}addEventListener(){}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this)}
}
function setup(withClock){
 let wall=Date.parse('2026-10-24T15:17:00Z'),mono=0,id=1;
 const ids=new Map(),listeners=new Map(),timers=new Map(),errors=[];
 const document={hidden:false,documentElement:new Element(),getElementById(name){if(!ids.has(name))ids.set(name,new Element());return ids.get(name)},createElement:tag=>new Element(tag),addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn)},removeEventListener:(type,fn)=>listeners.get(type)?.delete(fn),dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);return true}};
 const root=document.getElementById('screen');for(let i=0;i<4;i++)root.append(new Element());
 class TestDate extends Date{constructor(...args){super(...(args.length?args:[wall]))}static now(){return wall}}
 const set=(fn,ms,interval)=>{const current=id++;timers.set(current,{fn,at:mono+ms,interval});return current};
 const context={document,Intl,Date:TestDate,JSON,URLSearchParams,CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail}},performance:{now:()=>mono},innerWidth:1280,innerHeight:720,location:{protocol:'file:',search:''},navigator:{},console:{error:e=>errors.push(e),warn(){}},setTimeout:(f,ms)=>set(f,ms,0),clearTimeout:id=>timers.delete(id),setInterval:(f,ms)=>set(f,ms,ms),clearInterval:id=>timers.delete(id),addEventListener(){},removeEventListener(){},localStorage:{getItem:()=>null,removeItem(){},setItem(){}},sessionStorage:{getItem:()=>null,setItem(){}}};
 context.window=context;vm.createContext(context);
 for(const file of ['display-shell.js','time-signal-config.js','content.js','app.js',...(withClock?['time-signal.js']:[])])vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),context);
 assert.equal(errors.length,0,'modules must initialize');
 return {context,errors,document,advance(ms){const target=mono+ms;let calls=0;while(true){const next=[...timers].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;if(++calls>200)throw Error('timer loop');const [key,t]=next;wall+=t.at-mono;mono=t.at;if(t.interval)t.at+=t.interval;else timers.delete(key);t.fn()}wall+=target-mono;mono=target}};
}
const h=setup(true),player=h.context.CSSUSignage,clock=h.context.CSSUTimeSignal;
assert.equal(h.document.documentElement.style.values['--design-scale'],2/3);
assert.equal('timeSignal' in player.getContent(),false,'event data contains no clock configuration');
h.advance(12000);assert.equal(player.getState().slideId,'fumbles-failures');clock.preview();
const before=clock.getState();h.advance(1000);
const next=player.getContent();next.slides[0].title=['Updated event','New content'];next.settings.timezone='Asia/Shanghai';player.updateContent(next);
assert.equal(clock.getState().startedAt,before.startedAt);assert.equal(clock.getState().durationMs,20000);assert.equal(clock.getState().cities.join(','),'Toronto');
const invalid=player.getContent();invalid.schemaVersion=99;assert.throws(()=>player.updateContent(invalid));assert(clock.isActive());
h.advance(4000);assert.equal(clock.getState().page,2);assert.equal(clock.getState().cities.join(','),'Los Angeles,New York,Shanghai,London');
assert.equal(player.getState().slideId,'fumbles-failures','activity timer must stay paused');
h.advance(15000);assert.equal(clock.isActive(),false);assert.equal(player.getState().slideId,'fumbles-failures','same event resumes');
h.advance(14000);assert.equal(player.getState().slideId,'bytes-world','event playback resumes with a full interval');
player.destroy();clock.destroy();
const mainOnly=setup(false);assert.equal(mainOnly.context.CSSUTimeSignal,undefined);mainOnly.advance(14000);assert.equal(mainOnly.context.CSSUSignage.getState().slideId,'bytes-world');mainOnly.context.CSSUSignage.destroy();
console.log('PASS: independent display shell; separate configs; event edits/timezone changes and invalid updates cannot reset active time signal; lifecycle notifications pause/resume the event player; event player runs without the clock module.');
