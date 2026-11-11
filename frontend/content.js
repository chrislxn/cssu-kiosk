/* EDIT THIS FILE, then reload. No build, API, or internet connection required.
   Prices are supplied by the user; November events are from owner-supplied posters.
   isSample: false = verified event; omitted/true retains SAMPLE EVENT labeling.
   Keep titles to two short lines, descriptions under 110 characters.
   Dates: null = unrestricted; otherwise use ISO timestamps with explicit offsets.
   schedule: null OR { weekdays: [1,2,3,4,5], from: "09:00", to: "18:00" }
   Weekdays: Sunday=0. Schedule uses America/Toronto; overnight ranges supported.
   For overnight ranges, weekdays refers to the day the window STARTS.
   Validity is startsAt inclusive, endsAt exclusive.
*/
window.CSSU_CONTENT = {
  schemaVersion: 1,
  settings: {
    timezone: "America/Toronto",
    slideSeconds: 14,
    tickerPixelsPerSecond: 70,
    announcementSeconds: 10,
    // Optional HTTP/localhost cache interface. Keep false for file:// use.
    serviceWorker: false,
    // Opt-in last-good content persistence. Disabled so edits always show directly.
    persistContent: false
  },
  coffee: { name: "Coffee to go", price: "$1.25", note: "A little fuel for your next big idea." },
  shopNote: "Demo menu · prices supplied for this concept. Confirm current prices and availability at the counter.",
  menu: [
    { name: "Soda cans", detail: "The classic pick-me-up", price: "$1.00", icon: "cola" },
    { name: "Monster", detail: "For the extra-long sessions", price: "$3.00", icon: "energy" },
    { name: "Red Bull", detail: "A little lift", price: "$3.00", icon: "bolt" },
    { name: "Chips", detail: "The study-break essential", price: "$0.75", icon: "chips" },
    { name: "KitKat · large", detail: "Take a well-earned break", price: "$1.50", icon: "chocolate" },
    { name: "Ice cream sandwich", detail: "A little frozen treat", price: "$0.50", icon: "icecream" },
    { name: "Gum", detail: "A fresh little break", price: "$2.00", icon: "gum" },
    { name: "Mini chocolate", detail: "A bite-sized treat", price: "$0.50", icon: "mini-chocolate" }
  ],
  slides: [
    {
      id: "llm-workshop-1", category: "UTMIST · AI WORKSHOP", theme: "build", art: "code", isSample: false,
      title: ["LLM", "Workshop 1"], accentLine: 1,
      description: "Build a transformer in PyTorch.",
      eventName: "Large Language Models Workshop 1", shortTitle: "LLM Workshop 1", shortDetail: "Free · RSVP required · GB244",
      meta: "Nov 12 · 6–8 PM · GB244", tag: "FREE · RSVP REQUIRED",
      startsAt: null, endsAt: "2026-11-12T20:00:00-05:00", schedule: null
    },
    {
      id: "llvm-clang-meetup", category: "TORONTO SOCIAL · CSSU", theme: "code", art: "code", isSample: false,
      title: ["LLVM / Clang", "Meetup"], accentLine: 1,
      description: "Technical talks & LLVM social.",
      eventName: "LLVM / Clang Toronto Meetup", shortTitle: "LLVM / Clang Meetup", shortDetail: "Free · Talks & social · BA3200",
      meta: "Nov 12 · 6:30–9 PM · BA3200", tag: "FREE · TALKS & SOCIAL",
      startsAt: null, endsAt: "2026-11-12T21:00:00-05:00", schedule: null
    }
  ],
  announcements: [
    { text: "UTMIST LLM Workshop 1 · Nov 12, 6–8 PM · GB244 · Free; RSVP: fable.social/s/oyTX4", startsAt: null, endsAt: "2026-11-12T20:00:00-05:00", schedule: null },
    { text: "LLVM / Clang Meetup · Nov 12, 6:30–9 PM · Bahen BA3200 · Free technical talks & social.", startsAt: null, endsAt: "2026-11-12T21:00:00-05:00", schedule: null },
    { text: "Fumbles & Failures · Nov 3, 1–4 PM · BA3200 · RSVP via @uoftcssu bio.", startsAt: null, endsAt: "2026-11-03T16:00:00-05:00", schedule: null },
    { text: "Bytes Around the World · Nov 6, 3–5 PM · BA3200 · Free food!", startsAt: null, endsAt: "2026-11-06T17:00:00-05:00", schedule: null },
    { text: "Demo menu · Confirm current prices and availability at the counter.", startsAt: null, endsAt: null, schedule: null },
    { text: "Your community, on display. A space for projects, people and ideas.", startsAt: null, endsAt: null, schedule: null }
  ]
};
