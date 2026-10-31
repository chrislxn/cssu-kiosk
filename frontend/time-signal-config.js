/* Independent world-clock configuration. Event and shop content live in content.js.
   This file does not depend on the event player or its data. */
window.CSSU_TIME_SIGNAL_CONFIG = {
  enabled: true,
  durationSeconds: 20,
  cities: [
    { name: "Toronto", code: "YYZ", region: "CANADA", timezone: "America/Toronto" },
    { name: "Los Angeles", code: "LAX", region: "UNITED STATES", timezone: "America/Los_Angeles" },
    { name: "New York", code: "NYC", region: "UNITED STATES", timezone: "America/New_York" },
    { name: "Shanghai", code: "SHA", region: "CHINA", timezone: "Asia/Shanghai" },
    { name: "London", code: "LON", region: "UNITED KINGDOM", timezone: "Europe/London" },
    { name: "Tokyo", code: "TYO", region: "JAPAN", timezone: "Asia/Tokyo" },
    { name: "Seoul", code: "SEL", region: "SOUTH KOREA", timezone: "Asia/Seoul" },
    { name: "New Delhi", code: "DEL", region: "INDIA", timezone: "Asia/Kolkata" },
    { name: "Sydney", code: "SYD", region: "AUSTRALIA", timezone: "Australia/Sydney" }
  ]
};
