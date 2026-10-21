// Podatki, čas, shranjevanje, deljenje in koledar. Brez odvisnosti.
import { CONFIG } from "./config.js";

/* ------------------------------------------------------------ program */

export async function loadProgram() {
  const res = await fetch("data/program.json", { cache: "no-cache" });
  if (!res.ok) throw new Error("program.json: " + res.status);
  const P = await res.json();
  P.filmById = new Map(P.films.map((f) => [f.id, f]));
  P.screeningById = new Map(P.screenings.map((s) => [s.id, s]));
  P.venueById = new Map(P.venues.map((v) => [v.id, v]));
  P.screeningsByFilm = new Map();
  for (const s of P.screenings) {
    if (!P.screeningsByFilm.has(s.film_id)) P.screeningsByFilm.set(s.film_id, []);
    P.screeningsByFilm.get(s.film_id).push(s);
  }
  // Različni filmi z enakim slovenskim naslovom (npr. dva Dnevnika sobarice)
  const count = new Map();
  for (const f of P.films) {
    const k = norm(f.title_sl);
    count.set(k, (count.get(k) || 0) + 1);
  }
  for (const f of P.films) f.dupTitle = count.get(norm(f.title_sl)) > 1;
  P.days = [...new Set(P.screenings.map((s) => s.date))].sort();
  return P;
}

export function norm(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function haystack(f) {
  return norm([f.title_sl, f.title_en, f.title_orig, f.director].join(" "));
}

/* ------------------------------------------------------------ čas */

export const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const fmtMin = (min) => {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${h}.${String(m).padStart(2, "0")}`;
};

export function startMin(s) {
  return toMin(s.time);
}

export function endMin(s, P) {
  const f = P.filmById.get(s.film_id);
  return f && f.runtime ? toMin(s.time) + f.runtime : null;
}

const WD = ["ned.", "pon.", "tor.", "sre.", "čet.", "pet.", "sob."];
const WD_LONG = ["nedelja", "ponedeljek", "torek", "sreda", "četrtek", "petek", "sobota"];

function ymd(d) {
  const [y, m, dd] = d.split("-").map(Number);
  return { y, m, d: dd, wd: new Date(Date.UTC(y, m - 1, dd)).getUTCDay() };
}

export function dayShort(d) {
  const x = ymd(d);
  return `${WD[x.wd]} ${x.d}. ${x.m}.`;
}

export function dayLong(d) {
  const x = ymd(d);
  return `${WD_LONG[x.wd]}, ${x.d}. ${x.m}.`;
}

export function dayParts(d) {
  const x = ymd(d);
  return { wd: WD[x.wd].replace(".", ""), d: x.d, m: x.m };
}

// Datum in ura v Ljubljani, ne glede na časovni pas naprave.
export function ljNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Ljubljana",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t).value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, min: Number(g("hour")) * 60 + Number(g("minute")) };
}

export function fmtStamp(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return new Intl.DateTimeFormat("sl-SI", {
    timeZone: "Europe/Ljubljana", day: "numeric", month: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

/* ------------------------------------------------------------ prekrivanja */

// Vrne Map screeningId → [screeningId, …] s katerimi se prekriva.
// Brez znanega trajanja prekrivanja ne moremo izračunati, zato ga ne trdimo.
export function overlaps(ids, P) {
  const list = ids.map((id) => P.screeningById.get(id)).filter(Boolean);
  const out = new Map();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.date !== b.date) continue;
      const ae = endMin(a, P), be = endMin(b, P);
      if (ae == null || be == null) continue;
      if (startMin(a) < be && startMin(b) < ae) {
        if (!out.has(a.id)) out.set(a.id, []);
        if (!out.has(b.id)) out.set(b.id, []);
        out.get(a.id).push(b.id);
        out.get(b.id).push(a.id);
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------ shranjevanje */

const KEY = "luma-liffe-2026";
let mem = { fav: [], plan: [] };

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const v = JSON.parse(raw);
      mem = { fav: Array.isArray(v.fav) ? v.fav : [], plan: Array.isArray(v.plan) ? v.plan : [] };
    }
  } catch (_) { /* zasebno okno ipd.: delujemo iz pomnilnika */ }
  return mem;
}

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (_) {}
  listeners.forEach((fn) => fn(mem));
}

const listeners = new Set();
const externalListeners = new Set();
export const store = {
  get: () => mem,
  init: read,
  onChange: (fn) => listeners.add(fn),
  // sprememba v drugem zavihku istega brskalnika
  onExternalChange: (fn) => externalListeners.add(fn),
  isFav: (id) => mem.fav.includes(id),
  inPlan: (id) => mem.plan.includes(id),
  toggleFav(id) {
    mem.fav = mem.fav.includes(id) ? mem.fav.filter((x) => x !== id) : [...mem.fav, id];
    write();
  },
  togglePlan(id) {
    mem.plan = mem.plan.includes(id) ? mem.plan.filter((x) => x !== id) : [...mem.plan, id];
    write();
  },
  swap(oldId, newId) {
    mem.plan = mem.plan.filter((x) => x !== oldId);
    if (!mem.plan.includes(newId)) mem.plan.push(newId);
    write();
  },
  merge(fav, plan) {
    mem.fav = [...new Set([...mem.fav, ...fav])];
    mem.plan = [...new Set([...mem.plan, ...plan])];
    write();
  },
  clear() {
    mem = { fav: [], plan: [] };
    write();
  },
};
window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  read();
  listeners.forEach((fn) => fn(mem));
  externalListeners.forEach((fn) => fn(mem));
});

/* ------------------------------------------------------------ deljenje */

// V povezavi so SAMO ID-ji: t227379 → »4vfv« (base36), drugi ID-ji dobesedno.
const encId = (id) => (/^t\d+$/.test(id) ? Number(id.slice(1)).toString(36) : "~" + id);
const decId = (x) => (x.startsWith("~") ? x.slice(1) : "t" + parseInt(x, 36));

export function shareUrl(fav, plan) {
  const p = new URLSearchParams();
  if (plan.length) p.set("t", plan.map(encId).join("."));
  if (fav.length) p.set("f", fav.join("."));
  return `${location.origin}${location.pathname}#/deljeno?${p.toString()}`;
}

export function parseShare(params) {
  const plan = (params.get("t") || "").split(".").filter(Boolean).map(decId);
  const fav = (params.get("f") || "").split(".").filter((x) => /^\d+$/.test(x));
  return { plan, fav };
}

/* ------------------------------------------------------------ koledar */

const icsEsc = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

function icsLocal(date, min) {
  // min je lahko > 1440 (film čez polnoč)
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + min * 60000);
  const p = (n) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}T${p(t.getUTCHours())}${p(t.getUTCMinutes())}00`;
}

function fold(line) {
  // RFC 5545: vrstice do 75 oktetov
  const out = [];
  let cur = "";
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 74) { out.push(cur); cur = " " + ch; } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
}

const VTIMEZONE = [
  "BEGIN:VTIMEZONE", "TZID:Europe/Ljubljana",
  "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST",
  "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET",
  "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
  "END:VTIMEZONE",
];

export function venueLabel(v) {
  return v.place ? `${v.place}, ${v.name}` : v.name;
}

export function buildIcs(ids, P) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LuMa film klub//LuMa x LIFFe 2026//SL",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Moj LIFFe 2026", "X-WR-TIMEZONE:Europe/Ljubljana", ...VTIMEZONE];
  for (const id of ids) {
    const s = P.screeningById.get(id);
    if (!s) continue;
    const f = P.filmById.get(s.film_id);
    const v = P.venueById.get(s.venue);
    const st = startMin(s);
    const desc = [
      f.title_en && f.title_en !== f.title_sl ? f.title_en : null,
      [f.director, f.runtime ? `${f.runtime} min` : null].filter(Boolean).join(" · "),
      f.runtime ? null : "Trajanje ni znano – konec ni vpisan.",
      "Uradna stran filma: " + f.liffe_url,
      "Dogodek v koledarju ni vstopnica.",
    ].filter(Boolean).join("\n");
    lines.push("BEGIN:VEVENT",
      `UID:${s.id}@luma-liffe-2026`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Ljubljana:${icsLocal(s.date, st)}`);
    if (f.runtime) lines.push(`DTEND;TZID=Europe/Ljubljana:${icsLocal(s.date, st + f.runtime)}`);
    lines.push(`SUMMARY:${icsEsc("LIFFe: " + f.title_sl)}`,
      `LOCATION:${icsEsc(venueLabel(v) + ", Ljubljana")}`,
      `DESCRIPTION:${icsEsc(desc)}`,
      `URL:${f.liffe_url}`,
      "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function downloadIcs(ids, P, name) {
  const blob = new Blob([buildIcs(ids, P)], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name || "moj-liffe-2026.ics";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function gcalUrl(s, P) {
  const f = P.filmById.get(s.film_id);
  const v = P.venueById.get(s.venue);
  const st = startMin(s);
  const en = f.runtime ? st + f.runtime : st + 1; // Google zahteva konec; brez trajanja le začetek
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: "LIFFe: " + f.title_sl,
    dates: `${icsLocal(s.date, st)}/${icsLocal(s.date, en)}`,
    ctz: "Europe/Ljubljana",
    location: venueLabel(v) + ", Ljubljana",
    details: `${f.runtime ? "" : "Trajanje ni znano. "}Uradna stran: ${f.liffe_url}\nDogodek v koledarju ni vstopnica.`,
  });
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

/* ------------------------------------------------------------ LuMa (Google Sheet) */

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = (rows.shift() || []).map((h) => norm(h).replace(/ /g, "_"));
  return rows
    .filter((r) => r.some((c) => c.trim()))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
}

export const yes = (v) => /^(da|ja|yes|true|1|x|✓|✔)$/i.test(String(v || "").trim());

function cleanLuma(raw) {
  // Primeri v Sheetu (primer = DA) se nikoli ne prikažejo.
  const real = (r) => !yes(r.primer);
  const priporocila = (raw.priporocila || []).filter(real)
    .filter((r) => r.film_id && yes(r.aktivno))
    .map((r) => ({ film_id: String(r.film_id).trim(), komentar: r.komentar || "", vrstni_red: Number(r.vrstni_red) || 999 }))
    .sort((a, b) => a.vrstni_red - b.vrstni_red);
  const skupne = (raw.skupne || []).filter(real)
    .filter((r) => r.screening_id && yes(r.gremo))
    .map((r) => ({ screening_id: String(r.screening_id).trim(), povabilo: r.povabilo || "", prijava_url: r.prijava_url || "", zbirno_mesto: r.zbirno_mesto || "" }));
  const pridruzeni = (raw.pridruzeni || []).filter(real)
    .filter((r) => r.screening_id && r.vzdevek && yes(r.objavi))
    .map((r) => ({ screening_id: String(r.screening_id).trim(), vzdevek: r.vzdevek.slice(0, 40) }));
  return { priporocila, skupne, pridruzeni };
}

export async function loadLuma() {
  let snapshot = { priporocila: [], skupne: [], pridruzeni: [] };
  try {
    const r = await fetch("data/luma.json", { cache: "no-cache" });
    if (r.ok) snapshot = await r.json();
  } catch (_) {}
  const { sheetId, tabs, csv = {} } = CONFIG.luma;
  const published = csv.priporocila && csv.skupne && csv.pridruzeni;
  if (published || sheetId) {
    try {
      const get = async (key) => {
        const u = published
          ? csv[key]
          : `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabs[key])}`;
        const r = await fetch(u, { cache: "no-store" });
        if (!r.ok || !/csv/.test(r.headers.get("content-type") || "")) throw new Error(key + " " + r.status);
        return parseCsv(await r.text());
      };
      const [priporocila, skupne, pridruzeni] = await Promise.all([get("priporocila"), get("skupne"), get("pridruzeni")]);
      return { ...cleanLuma({ priporocila, skupne, pridruzeni }), live: true };
    } catch (e) {
      console.warn("LuMa Sheet ni dosegljiv, uporabljam data/luma.json:", e);
    }
  }
  return { ...cleanLuma(snapshot), live: false, updated_at: snapshot.updated_at };
}

export function rsvpUrl(row) {
  if (row.prijava_url && /^https:\/\//.test(row.prijava_url)) return row.prijava_url;
  const { formUrl, screeningEntry } = CONFIG.rsvp;
  if (formUrl && screeningEntry) {
    const u = new URL(formUrl);
    u.searchParams.set("usp", "pp_url");
    u.searchParams.set(screeningEntry, row.screening_id);
    return u.toString();
  }
  return null;
}

/* ------------------------------------------------------------ html */

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
