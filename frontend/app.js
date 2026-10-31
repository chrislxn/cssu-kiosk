/* CSSU signage / zero-dependency player. Public integration seam: CSSUSignage.
   No remote requests. All rendered copy uses textContent, never content HTML. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const CACHE_KEY = 'cssu-signage:content:v1';
  const ART = ['code', 'play', 'build'];
  const PRODUCT_ICONS = new Set(['coffee','cola','energy','bolt','chips','chocolate','icecream','gum','mini-chocolate']);
  let content, formatTime, formatDate, formatZone, formatSchedule;
  let activeSlides = [], activeAnnouncements = [], index = 0, announcementIndex = 0;
  let started = performance.now(), announcementStarted = performance.now();
  let slideKey = '', announcementKey = '', announcementTimer, destroyed = false, timeSignalActive = false;

  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const text = (value, max, label) => {
    if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error(`Invalid ${label} (1–${max} characters required)`);
  };
  function validate(data) {
    const copy = JSON.parse(JSON.stringify(data));
    if (!copy || copy.schemaVersion !== 1) throw Error('Unsupported content schema');
    if (!copy.settings) throw Error('Missing settings');
    new Intl.DateTimeFormat('en-CA', {timeZone: copy.settings.timezone}).format();
    for (const name of ['slideSeconds', 'announcementSeconds']) {
      if (!Number.isFinite(copy.settings[name]) || copy.settings[name] < 5 || copy.settings[name] > 300) throw Error(`Invalid ${name}: use 5–300 seconds`);
    }
    const timing = item => {
      for (const key of ['startsAt', 'endsAt']) {
        if (item[key] != null && (typeof item[key] !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(item[key]) || !Number.isFinite(Date.parse(item[key])))) throw Error(`Invalid ${key}: use ISO timestamp with offset`);
      }
      if (item.startsAt && item.endsAt && Date.parse(item.startsAt) >= Date.parse(item.endsAt)) throw Error('endsAt must follow startsAt');
      const s = item.schedule;
      if (s != null && (!Array.isArray(s.weekdays) || !s.weekdays.length || !s.weekdays.every(d => Number.isInteger(d) && d >= 0 && d <= 6) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.from) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(s.to) || s.from === s.to)) throw Error('Invalid schedule');
    };
    if (!Array.isArray(copy.slides) || copy.slides.length < 1 || copy.slides.length > 3) throw Error('Provide 1–3 slides for this layout');
    const ids = new Set();
    copy.slides.forEach(s => {
      text(s.id, 32, 'slide id'); if (ids.has(s.id)) throw Error('Slide IDs must be unique'); ids.add(s.id);
      if (s.isSample != null && typeof s.isSample !== 'boolean') throw Error('isSample must be a boolean');
      if (!ART.includes(s.art) || !ART.includes(s.theme)) throw Error('Unknown art/theme');
      if (!Array.isArray(s.title) || s.title.length !== 2) throw Error('Use two title lines');
      s.title.forEach(t => text(t, 22, 'title line'));
      if (![0, 1].includes(s.accentLine)) throw Error('accentLine must be 0 or 1');
      for (const [key,max] of Object.entries({category:28, description:110, eventName:32, shortTitle:24, shortDetail:36, meta:60, tag:28})) text(s[key],max,key);
      timing(s);
    });
    if (!Array.isArray(copy.menu) || copy.menu.length < 1 || copy.menu.length > 12) throw Error('Provide 1–12 shop items');
    if (copy.settings.tickerPixelsPerSecond != null && (!Number.isFinite(copy.settings.tickerPixelsPerSecond) || copy.settings.tickerPixelsPerSecond < 20 || copy.settings.tickerPixelsPerSecond > 160)) throw Error('Ticker speed must be 20–160 pixels per second');
    copy.menu.forEach(m => { text(m.name,24,'menu name'); text(m.detail,40,'menu detail'); text(m.price,12,'menu price'); });
    if (!copy.coffee) throw Error('Missing coffee feature');
    text(copy.coffee.name,25,'coffee name'); text(copy.coffee.note,50,'coffee note'); text(copy.coffee.price,12,'coffee price'); text(copy.shopNote,150,'shop note');
    if (!Array.isArray(copy.announcements) || copy.announcements.length > 20) throw Error('Invalid announcements');
    copy.announcements.forEach(a => { text(a.text,145,'announcement'); timing(a); });
    return copy;
  }
  function configureFormats() {
    const timeZone = content.settings.timezone;
    formatTime = new Intl.DateTimeFormat('en-GB', {timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    formatDate = new Intl.DateTimeFormat('en-CA', {timeZone,weekday:'short',month:'short',day:'2-digit'});
    formatZone = new Intl.DateTimeFormat('en-CA', {timeZone,timeZoneName:'short'});
    formatSchedule = new Intl.DateTimeFormat('en-US', {timeZone,weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  }
  function eligible(item, now = new Date()) {
    if (item.startsAt && now.getTime() < Date.parse(item.startsAt)) return false;
    if (item.endsAt && now.getTime() >= Date.parse(item.endsAt)) return false;
    if (!item.schedule) return true;
    const parts = Object.fromEntries(formatSchedule.formatToParts(now).map(p => [p.type,p.value]));
    const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday);
    const minute = Number(parts.hour) * 60 + Number(parts.minute);
    const convert = t => Number(t.slice(0,2)) * 60 + Number(t.slice(3));
    const {weekdays,from,to} = item.schedule, start = convert(from), end = convert(to);
    if (start < end) return weekdays.includes(day) && minute >= start && minute < end;
    return (weekdays.includes(day) && minute >= start) || (weekdays.includes((day+6)%7) && minute < end);
  }
  const fallback = {id:'standby',category:'THE COMMON ROOM',theme:'code',art:'code',isSample:false,title:['Your space.','Your people.'],accentLine:1,description:'No events are scheduled right now.',eventName:'Community board',meta:'Awaiting the next scheduled item',tag:'COMMUNITY BOARD',shortTitle:'Community board',shortDetail:'New content coming soon'};
  function refreshEligibility(now, force = false) {
    let nextSlides = content.slides.filter(s => eligible(s,now));
    if (!nextSlides.length) nextSlides = [fallback];
    const nextKey = nextSlides.map(s => s.id).join('|');
    if (force || nextKey !== slideKey) {
      const oldId = activeSlides[index]?.id;
      activeSlides = nextSlides; slideKey = nextKey;
      index = Math.max(0,activeSlides.findIndex(s => s.id === oldId));
      renderSlides(); show(index);
    }
    const notices = content.announcements.filter(a => eligible(a,now));
    const key = JSON.stringify(notices);
    if (force || key !== announcementKey) {
      activeAnnouncements = notices; announcementKey = key; announcementIndex = 0;
      clearTimeout(announcementTimer); $('announcement').classList.remove('changing');
      $('announcement').textContent = activeAnnouncements[0]?.text || 'No current notices.';
      announcementStarted = performance.now();
    }
  }
  function renderSlides() {
    $('slides').replaceChildren(); $('slide-tracks').replaceChildren();
    activeSlides.forEach((s, i) => {
      const slide = node('article',`slide theme-${s.theme}`);
      const isSample = s.isSample !== false;
      slide.setAttribute('aria-label',`${i+1} of ${activeSlides.length}: ${s.eventName}${isSample ? ' — sample event' : ''}`);
      slide.setAttribute('aria-roledescription','slide');
      const top = node('div','slide-top'); top.append(node('span','',s.category));
      if (isSample) top.append(node('span','sample','SAMPLE EVENT'));
      const title = node('h1'); s.title.forEach((line,j) => title.append(node('span',j === s.accentLine ? 'accent':'',line)));
      const art = node('img','hero-art'); art.src = `assets/${s.art}.svg`; art.alt = ''; art.width = 755; art.height = 755;
      const details = node('div','event-details'); details.append(node('span','event-meta',s.meta));
      slide.append(top,title,node('p','description',s.description),art,details,node('span','event-tag',s.tag)); $('slides').append(slide);
      const track = node('span','track'); track.append(node('span','fill')); $('slide-tracks').append(track);
    });
  }
  function show(nextIndex) {
    if (!activeSlides.length) return;
    index = (nextIndex + activeSlides.length) % activeSlides.length; started = performance.now();
    [...$('slides').children].forEach((slide,i) => { slide.classList.toggle('active',i === index); slide.setAttribute('aria-hidden',String(i !== index)); });
    [...$('slide-tracks').children].forEach((track,i) => {
      track.classList.remove('active');
      // Replacing the tiny progress span restarts its CSS animation without layout reads.
      track.replaceChildren(node('span','fill')); if (i === index) track.classList.add('active');
    });
    $('slide-number').textContent = `${String(index+1).padStart(2,'0')} / ${String(activeSlides.length).padStart(2,'0')}`;
  }
  function renderMenu() {
    const items = [{name:content.coffee.name,price:content.coffee.price,icon:'coffee'},...content.menu];
    const track = $('price-track');
    const makeGroup = duplicate => {
      const group = node('div','price-group');
      if (duplicate) group.setAttribute('aria-hidden','true');
      items.forEach(item => {
        const entry = node('span','price-item');
        const image = node('img','product-image');
        image.src = `assets/products/${PRODUCT_ICONS.has(item.icon) ? item.icon : 'snack'}.svg`;
        image.alt = ''; image.width = 52; image.height = 65;
        image.setAttribute('aria-hidden','true');
        image.addEventListener('error',() => { image.src = 'assets/products/snack.svg'; },{once:true});
        entry.append(image,node('span','item-name',item.name),node('span','item-price',item.price));
        group.append(entry);
      });
      return group;
    };
    track.replaceChildren(makeGroup(false),makeGroup(true));
    // One width read at content update; the loop itself is a composited transform.
    // Equal copies and translateX(-50%) make the last item join the first seamlessly.
    const duration = track.children[0].offsetWidth / (content.settings.tickerPixelsPerSecond || 70);
    $('screen').style.setProperty('--ticker-duration',`${Math.max(15,duration || 30)}s`);
  }
  function apply(data, persist = false) {
    const validated = validate(data); // Validate first; failed updates leave the current screen intact.
    content = validated; configureFormats(); renderMenu();
    $('screen').style.setProperty('--slide-duration',`${content.settings.slideSeconds}s`);
    refreshEligibility(new Date(),true);
    if (persist && content.settings.persistContent) {
      try { localStorage.setItem(CACHE_KEY,JSON.stringify(content)); } catch (_) { console.warn('Content updated. Persistent storage is unavailable.'); }
    }
  }
  function tick() {
    if (destroyed) return;
    const now = new Date(), monotonic = performance.now();
    $('clock-time').textContent = formatTime.format(now); $('clock-time').dateTime = now.toISOString();
    $('clock-date').textContent = formatDate.format(now); $('clock-zone').textContent = formatZone.formatToParts(now).find(p => p.type === 'timeZoneName')?.value || 'LOCAL TIME';
    refreshEligibility(now);
    if (!timeSignalActive && monotonic - started >= content.settings.slideSeconds*1000) show(index+1);
    if (!timeSignalActive && activeAnnouncements.length > 1 && monotonic-announcementStarted >= content.settings.announcementSeconds*1000) {
      announcementStarted = monotonic; $('announcement').classList.add('changing');
      announcementTimer = setTimeout(() => {
        announcementIndex = (announcementIndex+1)%activeAnnouncements.length;
        $('announcement').textContent = activeAnnouncements[announcementIndex]?.text || '';
        $('announcement').classList.remove('changing');
      },350);
    }
  }
 document.addEventListener('visibilitychange',() => { if (!document.hidden) { started=performance.now(); show(index); tick(); } });
  try {
    let initial = window.CSSU_CONTENT;
    if (initial?.settings?.persistContent) {
      try { const saved = localStorage.getItem(CACHE_KEY); if (saved) initial = validate(JSON.parse(saved)); } catch (_) { /* Keep bundled content on denied storage or malformed cache. */ }
    }
    apply(initial); tick();
    const timer = setInterval(tick,1000);
    // Only lifecycle notifications cross module boundaries; no clock API/data access.
    const onTimeSignalStart = () => { timeSignalActive=true; };
    const onTimeSignalEnd = () => { timeSignalActive=false; show(index); announcementStarted=performance.now(); tick(); };
    document.addEventListener('cssu:time-signal-start',onTimeSignalStart);
    document.addEventListener('cssu:time-signal-end',onTimeSignalEnd);
    window.CSSUSignage = Object.freeze({
      updateContent: (data,{persist=false}={}) => { apply(data,persist); tick(); },
      getContent: () => JSON.parse(JSON.stringify(content)),
      getState: () => ({slideId:activeSlides[index]?.id,mode:'automatic',eligibleSlides:activeSlides.map(s=>s.id),source:'local'}),
      // Pure schedule seam: pass explicit Date to verify future rotation windows.
      isEligible: (item,date) => eligible(item,new Date(date)),
      clearCache: () => { try { localStorage.removeItem(CACHE_KEY); } catch (_) {} },
      reset: () => { try { localStorage.removeItem(CACHE_KEY); } catch (_) {} apply(window.CSSU_CONTENT); tick(); },
      destroy: () => { destroyed=true; clearInterval(timer); clearTimeout(announcementTimer); document.removeEventListener('cssu:time-signal-start',onTimeSignalStart); document.removeEventListener('cssu:time-signal-end',onTimeSignalEnd); }
    });
    if (content.settings.serviceWorker && /^https?:$/.test(location.protocol) && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => console.warn('Optional web cache unavailable; local playback continues.'));
    }
  } catch (error) {
    $('announcement').textContent = `CONTENT ERROR / ${error.message}. Check content.js and reload.`;
    $('slides').append(node('div','slide active theme-code','Content could not be loaded. Check content.js and reload.'));
    console.error(error);
  }
})();
