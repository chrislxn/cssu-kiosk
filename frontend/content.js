/* EDIT THIS FILE, then reload. No build, API, or internet connection required.
   Prices are supplied by the user; event details below are fictional demos.
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
      id: "code", category: "CODE & CONNECT", theme: "code", art: "code",
      title: ["Code &", "Coffee."], accentLine: 1,
      description: "Bring a project. Find your people.",
      eventName: "Code & Coffee", shortTitle: "Code & Coffee", shortDetail: "Bring your curiosity",
      meta: "Sample meetup · Time & location TBD", tag: "ALL SKILL LEVELS",
      startsAt: null, endsAt: null, schedule: null
    },
    {
      id: "play", category: "PAUSE & PLAY", theme: "play", art: "play",
      title: ["Close tabs.", "Play games."], accentLine: 1,
      description: "Pull up a chair. Make your next move.",
      eventName: "Unplugged Night", shortTitle: "Unplugged Night", shortDetail: "A different kind of game loop",
      meta: "Sample social · Time & location TBD", tag: "EVERYONE WELCOME",
      startsAt: null, endsAt: null, schedule: null
    },
    {
      id: "build", category: "MAKE & SHARE", theme: "build", art: "build",
      title: ["Build it.", "Show it."], accentLine: 1,
      description: "Your next big idea starts small.",
      eventName: "Show & Tell", shortTitle: "Show & Tell", shortDetail: "Share what you’re making",
      meta: "Sample showcase · Time & location TBD", tag: "IDEAS IN PROGRESS",
      startsAt: null, endsAt: null, schedule: null
    }
  ],
  announcements: [
    { text: "Sample events only. Dates and locations to be announced.", startsAt: null, endsAt: null, schedule: null },
    { text: "Demo menu · Confirm current prices and availability at the counter.", startsAt: null, endsAt: null, schedule: null },
    { text: "Your community, on display. A space for projects, people and ideas.", startsAt: null, endsAt: null, schedule: null }
  ]
};
