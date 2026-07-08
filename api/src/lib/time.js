// Time-zone-aware bucketing (SDD 14.3). Events are stored in UTC; reporting
// buckets are generated in the selected IANA zone and saved with UTC boundaries.
import { DateTime } from "luxon";

export function nowUtc() {
  return new Date();
}

// Resolve a preset or explicit start/end into UTC Date boundaries.
export function resolvePeriod({ preset, start, end, timeZone }) {
  const tz = timeZone || "Africa/Johannesburg";
  if (start && end) {
    return { startUtc: new Date(start), endUtc: new Date(end), timeZone: tz };
  }
  const now = DateTime.now().setZone(tz);
  let s;
  let e = now.endOf("day");
  switch (preset) {
    case "today":
      s = now.startOf("day");
      e = now;
      break;
    case "last_7_days":
      s = now.startOf("day").minus({ days: 6 });
      break;
    case "last_90_days":
      s = now.startOf("day").minus({ days: 89 });
      break;
    case "this_month":
      s = now.startOf("month");
      break;
    case "last_30_days":
    default:
      s = now.startOf("day").minus({ days: 29 });
      break;
  }
  return { startUtc: s.toUTC().toJSDate(), endUtc: e.toUTC().toJSDate(), timeZone: tz };
}

// Previous comparison period of equal logical duration (SDD 14.3).
export function comparisonPeriod({ startUtc, endUtc }, compare) {
  if (!compare || compare === "none") return null;
  const durMs = endUtc.getTime() - startUtc.getTime();
  if (compare === "previous_period") {
    return { startUtc: new Date(startUtc.getTime() - durMs), endUtc: new Date(startUtc.getTime()) };
  }
  if (compare === "prior_year") {
    const s = DateTime.fromJSDate(startUtc).minus({ years: 1 }).toJSDate();
    const e = DateTime.fromJSDate(endUtc).minus({ years: 1 }).toJSDate();
    return { startUtc: s, endUtc: e };
  }
  return null;
}

// Enumerate day buckets between start/end in the reporting tz.
export function dayBuckets(startUtc, endUtc, timeZone, granularity = "day") {
  const tz = timeZone || "Africa/Johannesburg";
  const unit = granularity === "month" ? "month" : granularity === "week" ? "week" : "day";
  let cur = DateTime.fromJSDate(startUtc).setZone(tz).startOf(unit);
  const end = DateTime.fromJSDate(endUtc).setZone(tz);
  const buckets = [];
  let guard = 0;
  while (cur < end && guard < 1000) {
    const next = cur.plus({ [unit === "week" ? "weeks" : unit === "month" ? "months" : "days"]: 1 });
    buckets.push({
      startUtc: cur.toUTC().toJSDate(),
      endUtc: next.toUTC().toJSDate(),
      label: cur.toFormat(unit === "month" ? "yyyy-MM" : "yyyy-MM-dd"),
    });
    cur = next;
    guard += 1;
  }
  return buckets;
}
