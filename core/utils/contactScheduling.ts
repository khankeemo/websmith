export interface TimeSlotGroup {
  group: string;
  slots: string[];
}

export const CONTACT_TIME_SLOT_GROUPS: TimeSlotGroup[] = [
  {
    group: "Morning (08:00 AM – 12:00 PM)",
    slots: [
      "Early Morning (08:00 AM – 10:00 AM)",
      "Mid Morning (10:00 AM – 12:00 PM)",
    ],
  },
  {
    group: "Afternoon (12:00 PM – 06:00 PM)",
    slots: [
      "Early Afternoon (12:00 PM – 02:00 PM)",
      "Mid Afternoon (02:00 PM – 04:00 PM)",
      "Late Afternoon (04:00 PM – 06:00 PM)",
    ],
  },
  {
    group: "Evening & Night (06:00 PM – 12:00 AM)",
    slots: [
      "Early Evening (06:00 PM – 08:00 PM)",
      "Late Evening (08:00 PM – 10:00 PM)",
      "Night / Late Hours (10:00 PM – 12:00 AM)",
    ],
  },
  {
    group: "Flexible Option",
    slots: [
      "Anytime / Flexible (First Available)",
    ],
  },
];

export const CONTACT_TIME_SLOTS = CONTACT_TIME_SLOT_GROUPS.flatMap((g) => g.slots);

export interface PopularTimeZone {
  value: string;
  label: string;
  region: string;
}

export const POPULAR_TIMEZONES: PopularTimeZone[] = [
  // North America
  { value: "America/New_York", label: "US Eastern (New York, Miami, Toronto) · EDT/EST", region: "North America" },
  { value: "America/Chicago", label: "US Central (Chicago, Dallas, Houston) · CDT/CST", region: "North America" },
  { value: "America/Denver", label: "US Mountain (Denver, Phoenix, Calgary) · MDT/MST", region: "North America" },
  { value: "America/Los_Angeles", label: "US Pacific (Los Angeles, SF, Vancouver) · PDT/PST", region: "North America" },
  { value: "America/Anchorage", label: "US Alaska (Anchorage) · AKDT/AKST", region: "North America" },
  { value: "Pacific/Honolulu", label: "US Hawaii (Honolulu) · HST", region: "North America" },

  // UK & Europe
  { value: "Europe/London", label: "UK & Ireland (London, Dublin) · GMT/BST", region: "Europe" },
  { value: "Europe/Paris", label: "Central Europe (Paris, Berlin, Rome, Madrid) · CET/CEST", region: "Europe" },
  { value: "Europe/Athens", label: "Eastern Europe (Athens, Bucharest, Helsinki) · EEST", region: "Europe" },

  // Middle East & South Asia
  { value: "Asia/Dubai", label: "Gulf & UAE (Dubai, Abu Dhabi) · GST (UTC+4)", region: "Middle East" },
  { value: "Asia/Riyadh", label: "Saudi Arabia (Riyadh) · AST (UTC+3)", region: "Middle East" },
  { value: "Asia/Kolkata", label: "India & Sri Lanka (Kolkata, Mumbai, New Delhi) · IST (UTC+5:30)", region: "South Asia" },
  { value: "Asia/Dhaka", label: "Bangladesh (Dhaka) · BST (UTC+6)", region: "South Asia" },
  { value: "Asia/Karachi", label: "Pakistan (Karachi) · PKT (UTC+5)", region: "South Asia" },

  // Asia Pacific & Australia
  { value: "Asia/Singapore", label: "Singapore & Malaysia (Singapore, KL) · SGT (UTC+8)", region: "Asia Pacific" },
  { value: "Asia/Hong_Kong", label: "Hong Kong & China · HKT (UTC+8)", region: "Asia Pacific" },
  { value: "Asia/Tokyo", label: "Japan (Tokyo, Osaka) · JST (UTC+9)", region: "Asia Pacific" },
  { value: "Australia/Sydney", label: "Australia Eastern (Sydney, Melbourne) · AEST/AEDT", region: "Australia" },
  { value: "Australia/Perth", label: "Australia Western (Perth) · AWST (UTC+8)", region: "Australia" },
  { value: "Pacific/Auckland", label: "New Zealand (Auckland, Wellington) · NZST/NZDT", region: "Pacific" },

  // Africa & South America
  { value: "Africa/Johannesburg", label: "South Africa (Johannesburg, Cape Town) · SAST", region: "Africa" },
  { value: "Africa/Lagos", label: "West Africa (Lagos) · WAT (UTC+1)", region: "Africa" },
  { value: "America/Sao_Paulo", label: "Brazil (São Paulo, Rio) · BRT", region: "South America" },
];

export interface TimeZoneGroup {
  group: string;
  zones: { value: string; label: string }[];
}

export function buildAllWorldTimeZones(): TimeZoneGroup[] {
  let allSupported: string[] = [];
  try {
    if (typeof Intl !== "undefined" && typeof (Intl as any).supportedValuesOf === "function") {
      allSupported = (Intl as any).supportedValuesOf("timeZone");
    }
  } catch {
    allSupported = [];
  }

  if (!allSupported || allSupported.length === 0) {
    return [
      {
        group: "⭐ Popular Business Hubs",
        zones: POPULAR_TIMEZONES.map((p) => ({ value: p.value, label: p.label })),
      },
    ];
  }

  const groupsMap: Record<string, { value: string; label: string }[]> = {
    "⭐ Popular Business Hubs": POPULAR_TIMEZONES.map((p) => ({ value: p.value, label: p.label })),
    "North & Central America": [],
    "Europe": [],
    "Asia & Middle East": [],
    "Australia & Pacific": [],
    "South America": [],
    "Africa": [],
    "Atlantic & Indian Oceans": [],
    "Other Regions": [],
  };

  const southAmericaCities = [
    "Sao_Paulo", "Buenos_Aires", "Bogota", "Lima", "Santiago", 
    "Caracas", "Montevideo", "Asuncion", "La_Paz", "Guyana", "Paramaribo"
  ];

  for (const tz of allSupported) {
    const parts = tz.split("/");
    const city = parts[parts.length - 1].replace(/_/g, " ");
    const label = `${city} (${tz})`;

    if (tz.startsWith("America/") || tz.startsWith("Canada/") || tz.startsWith("US/")) {
      if (southAmericaCities.some((c) => tz.includes(c))) {
        groupsMap["South America"].push({ value: tz, label });
      } else {
        groupsMap["North & Central America"].push({ value: tz, label });
      }
    } else if (tz.startsWith("Europe/")) {
      groupsMap["Europe"].push({ value: tz, label });
    } else if (tz.startsWith("Asia/")) {
      groupsMap["Asia & Middle East"].push({ value: tz, label });
    } else if (tz.startsWith("Australia/") || tz.startsWith("Pacific/")) {
      groupsMap["Australia & Pacific"].push({ value: tz, label });
    } else if (tz.startsWith("Africa/")) {
      groupsMap["Africa"].push({ value: tz, label });
    } else if (tz.startsWith("Atlantic/") || tz.startsWith("Indian/")) {
      groupsMap["Atlantic & Indian Oceans"].push({ value: tz, label });
    } else {
      groupsMap["Other Regions"].push({ value: tz, label });
    }
  }

  return Object.entries(groupsMap)
    .filter(([_, list]) => list.length > 0)
    .map(([group, zones]) => ({ group, zones }));
}

export const ALL_WORLD_TIMEZONE_GROUPS: TimeZoneGroup[] = buildAllWorldTimeZones();

export function convertSlotHourToIST(dateStr: string, hour: number, minute: number, clientTz: string): string {
  try {
    const baseDate = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : new Date().toISOString().split("T")[0];
    const [y, m, d] = baseDate.split("-").map(Number);
    let utcGuess = new Date(Date.UTC(y, m - 1, d, hour, minute));
    
    for (let i = 0; i < 3; i++) {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: clientTz,
        year: "numeric", month: "numeric", day: "numeric",
        hour: "numeric", minute: "numeric", hour12: false
      }).formatToParts(utcGuess);
      
      const getP = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
      const pHour = getP("hour") % 24;
      const pMin = getP("minute");
      const pDay = getP("day");
      
      const diffMin = ((pDay - d) * 24 * 60) + ((pHour - hour) * 60) + (pMin - minute);
      if (diffMin === 0) break;
      utcGuess = new Date(utcGuess.getTime() - diffMin * 60000);
    }
    
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).format(utcGuess);
  } catch {
    return "";
  }
}

export function parseSlotHours(slotStr: string): { startHour: number; startMin: number; endHour: number; endMin: number } | null {
  const m = slotStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return null;
  let startHour = Number(m[1]), startMin = Number(m[2]), startPeriod = m[3].toUpperCase();
  let endHour = Number(m[4]), endMin = Number(m[5]), endPeriod = m[6].toUpperCase();
  if (startPeriod === "PM" && startHour < 12) startHour += 12;
  if (startPeriod === "AM" && startHour === 12) startHour = 0;
  if (endPeriod === "PM" && endHour < 12) endHour += 12;
  if (endPeriod === "AM" && endHour === 12) endHour = 0;
  return { startHour, startMin, endHour, endMin };
}

export function getSlotISTRange(dateStr: string, slotStr: string, clientTz: string): string {
  if (!slotStr || slotStr.toLowerCase().includes("flexible") || slotStr.toLowerCase().includes("anytime")) {
    return "Flexible / Anytime";
  }
  if (!clientTz) return slotStr;

  const parsed = parseSlotHours(slotStr);
  if (!parsed) return slotStr;

  try {
    const startIST = convertSlotHourToIST(dateStr, parsed.startHour, parsed.startMin, clientTz);
    const endIST = convertSlotHourToIST(dateStr, parsed.endHour, parsed.endMin, clientTz);
    if (!startIST || !endIST) return slotStr;
    return `${startIST} – ${endIST} IST`;
  } catch {
    return slotStr;
  }
}

export function getBookingDateLimits(maxDays = 7) {
  const formatYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  const today = new Date();
  const max = new Date();
  max.setDate(today.getDate() + maxDays);
  return {
    minDate: formatYMD(today),
    maxDate: formatYMD(max),
  };
}
