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
    { name: "Monster", detail: "For the extra-long sessions", price: "$2.75", icon: "energy" },
    { name: "Red Bull", detail: "A little lift", price: "$2.75", icon: "bolt" },
    { name: "Chips", detail: "The study-break essential", price: "$0.75", icon: "chips" },
    { name: "KitKat · large", detail: "Take a well-earned break", price: "$1.50", icon: "chocolate" },
    { name: "Ice cream sandwich", detail: "A little frozen treat", price: "$0.50", icon: "icecream" },
    { name: "Gum", detail: "A fresh little break", price: "$2.00", icon: "gum" },
    { name: "Mini chocolate", detail: "A bite-sized treat", price: "$0.50", icon: "mini-chocolate" }
  ],
  slides: [
    {
      id: "fumbles-failures", category: "CSSU × WiCS", theme: "build", art: "build", isSample: false,
      title: ["Fumbles &", "Failures"], accentLine: 1,
      description: "Profs, grad students & undergrads.",
      eventName: "Fumbles & Failures", shortTitle: "Fumbles & Failures", shortDetail: "RSVP via @uoftcssu bio",
      meta: "Nov 3 · 1–4 PM · BA3200", tag: "RSVP VIA @UOFTCSSU BIO",
      startsAt: null, endsAt: "2026-11-03T16:00:00-05:00", schedule: null
    },
    {
      id: "bytes-world", category: "CSSU SOCIAL", theme: "play", art: "play", isSample: false,
      title: ["Bytes Around", "the World"], accentLine: 1,
      description: "Free food from around the world.",
      eventName: "Bytes Around the World", shortTitle: "Bytes Around the World", shortDetail: "Free food · BA3200",
      meta: "Nov 6 · 3–5 PM · BA3200", tag: "FREE FOOD",
      startsAt: null, endsAt: "2026-11-06T17:00:00-05:00", schedule: null
    }
  ],
  announcements: [
    { text: "Fumbles & Failures · Nov 3, 1–4 PM · BA3200 · RSVP via @uoftcssu bio.", startsAt: null, endsAt: "2026-11-03T16:00:00-05:00", schedule: null },
    { text: "Bytes Around the World · Nov 6, 3–5 PM · BA3200 · Free food!", startsAt: null, endsAt: "2026-11-06T17:00:00-05:00", schedule: null },
    { text: "Demo menu · Confirm current prices and availability at the counter.", startsAt: null, endsAt: null, schedule: null },
    { text: "Your community, on display. A space for projects, people and ideas.", startsAt: null, endsAt: null, schedule: null }
  ]
};
