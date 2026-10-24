/* Toronto :00 / :30 broadcast. Uses the device clock and browser IANA time zones.
   No audio, external requests, user input, canvas, or frame-by-frame JS loop.
   Preview once: index.html?time-signal-preview=1 */
(() => {
  'use strict';
  const screen = document.getElementById('screen');
  if (!screen) return;
  const DEFAULT_CITIES = [
    {name:'Toronto',code:'YYZ',region:'CANADA',timezone:'America/Toronto'},
    {name:'Los Angeles',code:'LAX',region:'UNITED STATES',timezone:'America/Los_Angeles'},
    {name:'New York',code:'NYC',region:'UNITED STATES',timezone:'America/New_York'},
    {name:'Shanghai',code:'SHA',region:'CHINA',timezone:'Asia/Shanghai'},
    {name:'London',code:'LON',region:'UNITED KINGDOM',timezone:'Europe/London'},
    {name:'Tokyo',code:'TYO',region:'JAPAN',timezone:'Asia/Tokyo'},
    {name:'Seoul',code:'SEL',region:'SOUTH KOREA',timezone:'Asia/Seoul'},
    {name:'New Delhi',code:'DEL',region:'INDIA',timezone:'Asia/Kolkata'},
    {name:'Sydney',code:'SYD',region:'AUSTRALIA',timezone:'Australia/Sydney'}
  ];
  const SLOT_KEY = 'cssu:time-signal:last-slot';
  const toronto = new Intl.DateTimeFormat('en-GB',{timeZone:'America/Toronto',minute:'2-digit',second:'2-digit'});
  let active = false, disposed = false, current = 0, beganAt = 0, duration = 14000;
  let scheduleTimer, clockTimer, lastSlot = null, stageTimers = [];
  let cards = [], pages = [], pageCities = [], routes = [], formatters = [], hiddenUnderlay = [];
  const element = (tag,cls,text) => {
    const e = document.createElement(tag); if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text; return e;
  };
  const overlay = element('section','time-signal');
  overlay.hidden = true; overlay.setAttribute('aria-label','CSSU world time broadcast');
  screen.append(overlay);
  try { lastSlot = sessionStorage.getItem(SLOT_KEY); } catch (_) {}

  function configuration() {
    const config = window.CSSU_TIME_SIGNAL_CONFIG || {};
    const seconds = Number(config.durationSeconds);
    const result = {enabled:config.enabled !== false,duration:Number.isFinite(seconds) && seconds >= 7 && seconds <= 30 ? seconds*1000 : 14000,cities:DEFAULT_CITIES};
    if (Array.isArray(config.cities) && config.cities.length === 9) {
      try {
        for (const city of config.cities) {
          for (const [key,max] of [['name',24],['code',3],['region',24]]) {
            if (typeof city[key] !== 'string' || !city[key].trim() || city[key].length > max) throw Error('Invalid city');
          }
          if (typeof city.timezone !== 'string' || !city.timezone.trim()) throw Error('Missing city timezone');
          new Intl.DateTimeFormat('en',{timeZone:city.timezone}).format();
        }
        result.cities = config.cities;
      } catch (_) { /* Invalid optional city data uses the bundled nine-city sequence. */ }
    }
    return result;
  }
  function boundary(date) {
    const parts = Object.fromEntries(toronto.formatToParts(date).map(p => [p.type,p.value]));
    const minute = Number(parts.minute), second = Number(parts.second);
    return {
      due:minute%30 === 0 && second < 2,
      slot:String(Math.floor(date.getTime()/1800000)),
      // Align a single timer precisely to the next Toronto :00 or :30.
      delay:(30-minute%30)*60000-second*1000-date.getMilliseconds()
    };
  }
  function render(cities) {
    const header = element('header','signal-header');
    const logo = element('img','signal-logo'); logo.src = 'assets/cssu-logo.webp'; logo.alt = 'CSSU'; logo.width=251; logo.height=70;
    header.append(logo,element('span','signal-header-title','WORLD CLOCK'),element('span','signal-header-note','ON THE HOUR & HALF HOUR'));
    const globe = element('img','signal-globe'); globe.src='assets/world-clock.svg'; globe.alt=''; globe.width=850; globe.height=850;
    const deck = element('div','signal-cards'), route = element('div','signal-route');
    route.setAttribute('aria-hidden','true');
    cards=[]; pages=[]; routes=[];
    pageCities=[cities.slice(0,1),cities.slice(1,5),cities.slice(5,9)];
    pageCities.forEach((group,i) => {
      const page=element('section',`signal-page ${i === 0 ? 'signal-page-solo' : 'signal-page-group'}`);
      page.setAttribute('data-page',String(i+1));
      page.setAttribute('aria-label',group.map(city => city.name).join(', '));
      if (i > 0) page.append(element('div','signal-page-label',`AROUND THE WORLD / 0${i}`));
      const columns=element('div','signal-columns'); page.append(columns); deck.append(page);
      pages.push({page,columns});
      const stop=element('div','signal-route-city');
      stop.append(element('span','signal-route-number',`PAGE 0${i+1}`),element('span','',group.map(city => city.name).join(' / ')));
      route.append(stop); routes.push(stop);
    });
    formatters=cities.map(city => ({
      clock:new Intl.DateTimeFormat('en-GB',{timeZone:city.timezone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}),
      date:new Intl.DateTimeFormat('en-GB',{timeZone:city.timezone,weekday:'long',day:'2-digit',month:'short',year:'numeric'}),
      offset:new Intl.DateTimeFormat('en-GB',{timeZone:city.timezone,timeZoneName:'longOffset'}),
      zone:new Intl.DateTimeFormat('en-CA',{timeZone:city.timezone,timeZoneName:'short'})
    }));
    cities.forEach((city,i) => {
      const card = element('article','signal-city'); card.setAttribute('aria-label',`${city.name} local time`);
      const label=element('div','signal-city-label'); label.append(element('span','signal-index',String(i+1).padStart(2,'0')),element('h2','',city.name));
      const time=element('time','signal-time'), hours=element('span','signal-hours'), seconds=element('span','signal-seconds'); time.append(hours,seconds);
      const date=element('div','signal-date'), zone=element('div','signal-zone');
      const offset=element('div','signal-offset'), abbreviation=element('div','signal-zone-name');
      zone.append(element('div','signal-city-code',city.code),element('div','signal-country',city.region),offset,abbreviation);
      const pageIndex=i === 0 ? 0 : i < 5 ? 1 : 2;
      card.append(label,time,date,zone); pages[pageIndex].columns.append(card);
      cards.push({card,time,hours,seconds,date,offset,abbreviation,pageIndex});
    });
    const footer=element('div','signal-bottom'); footer.append(element('span','','ONE COMMUNITY. DIFFERENT TIME ZONES.'),element('span','','CSSU / TIME SIGNAL'));
    overlay.replaceChildren(globe,element('div','signal-grid-line'),header,deck,route,footer,element('div','signal-progress'),element('div','signal-shutter'));
  }
  function updateClocks() {
    const now = new Date();
    cards.forEach((view,i) => {
      const f=formatters[i], parts=Object.fromEntries(f.clock.formatToParts(now).map(p => [p.type,p.value]));
      view.hours.textContent=`${parts.hour}:${parts.minute}`; view.seconds.textContent=parts.second;
      view.time.dateTime=now.toISOString(); view.time.setAttribute('aria-label',`${parts.hour}:${parts.minute}:${parts.second}`);
      view.date.textContent=f.date.format(now);
      view.offset.textContent=(f.offset.formatToParts(now).find(p => p.type === 'timeZoneName')?.value || 'GMT').replace('GMT','UTC');
      view.abbreviation.textContent=f.zone.formatToParts(now).find(p => p.type === 'timeZoneName')?.value || '';
    });
  }
  function stage(i) {
    current=i; updateClocks();
    pages.forEach((view,j) => {view.page.classList.toggle('is-current',j===i);view.page.setAttribute('aria-hidden',String(j!==i));});
    cards.forEach(view => {view.card.classList.toggle('is-current',view.pageIndex===i);view.card.setAttribute('aria-hidden',String(view.pageIndex!==i));});
    routes.forEach((stop,j) => {stop.classList.toggle('is-current',j===i);stop.classList.toggle('is-past',j<i);});
  }
  function finish() {
    if (!active) return;
    stageTimers.forEach(clearTimeout); stageTimers=[]; clearInterval(clockTimer);
    active=false; overlay.hidden=true; overlay.classList.remove('is-closing'); screen.classList.remove('time-signal-active');
    hiddenUnderlay.forEach(([node,value]) => {if(value === null) node.removeAttribute('aria-hidden'); else node.setAttribute('aria-hidden',value);}); hiddenUnderlay=[];
    document.dispatchEvent(new CustomEvent('cssu:time-signal-end'));
  }
  function start() {
    if (active || disposed || document.hidden) return false;
    const config=configuration(); if (!config.enabled) return false;
    duration=config.duration; render(config.cities); beganAt=Date.now(); active=true;
    hiddenUnderlay=[...screen.children].filter(e => e !== overlay).map(e => [e,e.getAttribute('aria-hidden')]);
    hiddenUnderlay.forEach(([node]) => node.setAttribute('aria-hidden','true'));
    overlay.style.setProperty('--signal-duration',`${duration}ms`); overlay.classList.remove('is-closing');
    screen.classList.add('time-signal-active'); overlay.hidden=false; stage(0);
    // At 14 seconds: Toronto 3.4s; each four-city board 5s; exit 0.6s.
    [3.4/14,8.4/14].forEach((fraction,i) => stageTimers.push(setTimeout(() => stage(i+1),Math.round(duration*fraction))));
    stageTimers.push(setTimeout(() => overlay.classList.add('is-closing'),duration-600));
    stageTimers.push(setTimeout(finish,duration)); clockTimer=setInterval(updateClocks,1000);
    document.dispatchEvent(new CustomEvent('cssu:time-signal-start',{detail:{durationMs:duration}}));
    return true;
  }
  function check() {
    if (disposed) return;
    const slot=boundary(new Date());
    if (slot.due && slot.slot !== lastSlot && !document.hidden && configuration().enabled) {
      lastSlot=slot.slot;
      try { sessionStorage.setItem(SLOT_KEY,lastSlot); } catch (_) {}
      start();
    }
    clearTimeout(scheduleTimer);
    scheduleTimer=setTimeout(check,Math.max(10,slot.delay));
  }
  function visibility() {
    if (document.hidden) finish();
    else { if (active && Date.now()-beganAt >= duration) finish(); check(); }
  }
  function destroy() {
    disposed=true; finish(); clearTimeout(scheduleTimer);
    document.removeEventListener('visibilitychange',visibility);
    window.removeEventListener('pagehide',destroy); overlay.remove();
  }
  window.CSSUTimeSignal=Object.freeze({
    isActive:() => active,
    getState:() => ({active,page:active ? current+1 : null,cities:active ? pageCities[current].map(city => city.name) : [],startedAt:beganAt,durationMs:duration}),
    preview:start,
    boundaryAt:date => boundary(new Date(date)),
    destroy
  });
  document.addEventListener('visibilitychange',visibility); window.addEventListener('pagehide',destroy);
  // A one-shot operator preview is automatic and adds no on-screen controls.
  if (new URLSearchParams(location.search).get('time-signal-preview') === '1') start();
  check();
})();
