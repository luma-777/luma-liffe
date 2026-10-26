import { CONFIG } from "./config.js";
import {
  loadProgram, loadLuma, norm, haystack, toMin, fmtMin, startMin, endMin, dayShort, dayLong, dayParts,
  ljNow, fmtStamp, overlaps, store, exported, tickets, shareUrl, parseShare, downloadIcs, gcalUrl, rsvpUrl, rsvpForm, sendRsvp, rsvpLog,
  venueLabel, esc,
} from "./lib.js";

let P = null; // uradni program
let L = { priporocila: [], skupne: [], pridruzeni: [], ziherce: [] }; // LuMa uredniški podatki
let lumaReady = false; // dokler LuMa podatki ne pridejo, ne kažemo »še nastaja«
const lumaWait = () => `<p class="luma-wait" role="status">${ic("reel", "spin")}<span>Nalagam najin izbor …</span></p>`;
const $main = document.getElementById("main");
const scrollMemo = new Map();
let prevHash = "";
let navCount = 0; // koliko pogledov smo že prikazali (za »Nazaj«)
let softRendering = false;
// Uredniški način (…?urednik v naslovu): izpiše ID-je za LuMa Sheet. Velja do zaprtja zavihka.
let editor = (() => { try { return sessionStorage.getItem("luma-urednik") === "1"; } catch (_) { return false; } })();
function setEditor(on) {
  editor = on;
  try { on ? sessionStorage.setItem("luma-urednik", "1") : sessionStorage.removeItem("luma-urednik"); } catch (_) {}
}
const idTag = (kind, id) => editor ? `<span class="idtag"><code>${kind}: ${esc(id)}</code><button type="button" class="linkbtn small" data-act="copyid" data-val="${esc(id)}">kopiraj</button></span>` : "";

/* ================================================================ pomožno */

const ic = (name, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const SEC_COLORS = ["#3b9a97", "#e0a53b", "#e58db4", "#c4532d", "#3b5fae", "#8f6bb3", "#5f8f3e", "#d7745a", "#2f6f8f", "#b9862a", "#a65d87", "#4d7f7a", "#7a6a55", "#6c4f9c"];
const secColor = (name) => SEC_COLORS[Math.max(0, P.sections.indexOf(name)) % SEC_COLORS.length];
const slug = (s) => norm(s).replace(/ /g, "-");

function venueShort(id) {
  const v = P.venueById.get(id);
  if (!v) return id;
  if (v.place === "Cankarjev dom") return "CD " + v.name.replace(" dvorana", "");
  return v.name.replace("Slovenska ", "");
}

function hashCode(s) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}

const lumaRec = (filmId) => L.priporocila.find((r) => r.film_id === filmId);
const seenTag = (rec) => rec ? `<span class="seen ${rec.videla ? "yes" : ""}">${rec.videla ? "Videla sva" : "Na radarju"}</span>` : "";
const lumaGoes = (sid) => L.skupne.find((r) => r.screening_id === sid);

function titleBits(f, { withAlt = true } = {}) {
  const alt = f.title_en || f.title_orig;
  const dis = f.dupTitle ? ` <span class="muted">(${esc([f.director, f.year].filter(Boolean).join(", "))})</span>` : "";
  return { main: esc(f.title_sl || f.title_en || f.title_orig || "Brez naslova") + dis, alt: withAlt && alt ? esc(alt) : "" };
}

function metaLine(f) {
  return [f.director, f.countries && f.countries.length ? f.countries.join(", ") : null, f.year, f.runtime ? `${f.runtime} min` : null]
    .filter(Boolean).map(esc).join(" · ");
}

function timeRange(s) {
  const e = endMin(s, P);
  return { start: fmtMin(startMin(s)), end: e != null ? fmtMin(e) : null };
}

/* tipografski nadomestek plakata — motivi iz Kinograda: oči, zvezde, kolut, trak, pike, vijuge */
function art(f, large = false) {
  const c = secColor(f.section);
  const sec = `<span class="art-sec">${esc(f.section)}</span>`;
  if (CONFIG.showPosters && f.img) {
    const sizes = large ? "(max-width: 640px) 100vw, 860px" : "(max-width: 560px) 100vw, 380px";
    return `<div class="art photo${large ? " large" : ""}" style="--c:${c}"><img src="${esc(large ? f.img.l : f.img.s)}" srcset="${esc(f.img.s)} 640w, ${esc(f.img.l)} 960w" sizes="${sizes}" width="640" height="265" alt="" ${large ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">${sec}</div>`;
  }
  const h = hashCode(f.id);
  const ink = "#1d1a2b", paper = "#f4eee2";
  const motifs = [
    `<svg viewBox="0 0 160 90" style="inset:0;width:100%;height:100%"><g transform="translate(92 18) rotate(-4)"><rect width="62" height="56" rx="4" fill="${ink}"/><path d="M6 18c8-10 42-10 50 0-8 10-42 10-50 0z" fill="${paper}"/><circle cx="31" cy="18" r="6" fill="${ink}"/><path d="M6 40c8-10 42-10 50 0-8 10-42 10-50 0z" fill="${paper}"/><circle cx="31" cy="40" r="6" fill="${ink}"/></g></svg>`,
    `<svg viewBox="0 0 160 90" style="inset:0;width:100%;height:100%"><rect x="70" y="6" width="84" height="56" fill="${ink}" transform="rotate(3 112 34)"/><g stroke="#e0a53b" stroke-width="1.2" fill="none"><path d="M82 22l18 10 14-14 22 8 10 20"/><path d="M100 32l4 20 22 2"/></g><g fill="#e0a53b"><circle cx="82" cy="22" r="2.4"/><circle cx="100" cy="32" r="2.4"/><circle cx="114" cy="18" r="2.4"/><circle cx="136" cy="26" r="2.4"/><circle cx="146" cy="46" r="2.4"/><circle cx="104" cy="52" r="2.4"/><circle cx="126" cy="54" r="2.4"/></g></svg>`,
    `<svg viewBox="0 0 160 90" style="inset:0;width:100%;height:100%"><g transform="translate(118 40)"><circle r="34" fill="${ink}"/><g fill="${paper}"><circle cy="-18" r="7"/><circle cy="18" r="7"/><circle cx="-18" r="7"/><circle cx="18" r="7"/><circle r="3"/></g></g></svg>`,
    `<svg viewBox="0 0 160 90" style="inset:0;width:100%;height:100%"><g transform="translate(60 14) rotate(-8)"><rect width="110" height="34" fill="${ink}"/><g fill="${paper}">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<rect x="${4 + i * 12}" y="3" width="6" height="5" rx="1"/><rect x="${4 + i * 12}" y="26" width="6" height="5" rx="1"/>`).join("")}</g><rect x="8" y="10" width="28" height="14" fill="${c}" opacity=".9"/><rect x="42" y="10" width="28" height="14" fill="${paper}" opacity=".85"/><rect x="76" y="10" width="28" height="14" fill="${c}" opacity=".9"/></g></svg>`,
    `<svg viewBox="0 0 160 90" style="inset:0;width:100%;height:100%"><g fill="${ink}" opacity=".85">${Array.from({ length: 30 }, (_, i) => `<circle cx="${84 + (i % 6) * 13}" cy="${10 + Math.floor(i / 6) * 13}" r="3.6"/>`).join("")}</g></svg>`,
    `<svg viewBox="0 0 160 90" style="inset:0;width:100%;height:100%"><path d="M70 60c10-40 30 10 40-20s30 30 20 0-30-20-10-34 30 20 34 4" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/><circle cx="132" cy="62" r="14" fill="${paper}"/><path d="M126 58h12l-2 14h-8z" fill="#c4532d"/></svg>`,
  ];
  return `<div class="art${large ? " large" : ""}" style="--c:${c}" aria-hidden="true">${motifs[h % motifs.length]}${sec}</div>`;
}

function planBtn(sid, small = true) {
  const on = store.inPlan(sid);
  return `<button type="button" class="btn ${small ? "btn-small" : ""} btn-soft planbtn" data-act="plan" data-id="${sid}" aria-pressed="${on}">${ic(on ? "check" : "plus")}<span>${on ? "V mojem LIFFe planu" : "Dodaj v moj LIFFe plan"}</span></button>`;
}

function ticketBtn(sid) {
  const on = tickets.has(sid);
  return `<button type="button" class="btn btn-small btn-ghost tixbtn" data-act="ticket" data-id="${sid}" aria-pressed="${on}">${ic(on ? "check" : "ticket")}<span>${on ? "Vstopnico imam" : "Imam vstopnico?"}</span></button>`;
}
// le oznaka stanja (ni povezava na vstopnico)
const ticketTag = (sid) => tickets.has(sid) ? `<span class="has-ticket">${ic("check")} vstopnica kupljena</span>` : "";

function favBtn(fid) {
  const on = store.isFav(fid);
  return `<button type="button" class="iconbtn fav" data-act="fav" data-id="${fid}" aria-pressed="${on}" aria-label="${on ? "Odstrani iz »Zanima me«" : "Zanima me"}" title="${on ? "Zanima me ✓" : "Zanima me"}">${ic(on ? "heart-f" : "heart")}</button>`;
}

function ticketLink(s, small = true) {
  if (s.ticket_url) {
    return `<a class="btn ${small ? "btn-small" : ""} btn-ghost" href="${esc(s.ticket_url)}" target="_blank" rel="noopener" title="Odpre nakup na vstopnice.cd-cc.si (uradna prodaja Cankarjevega doma)">${ic("ticket")}<span>Vstopnice</span></a>`;
  }
  return `<a class="btn ${small ? "btn-small" : ""} btn-ghost" href="${esc(P.festival.tickets_url)}" target="_blank" rel="noopener">${ic("ticket")}<span>Info o vstopnicah</span></a>`;
}

// Barvna glava zavihka v LuMa slogu: vsak zavihek ima svojo barvo in motiv.
function banner({ c, icon, kicker, title, lede = "" }) {
  return `<section class="luma-hero c-${c}">${ic(icon, "motif")}${kicker ? `<p class="kicker">${kicker}</p>` : ""}<h1>${title}</h1>${lede ? `<p class="lede">${lede}</p>` : ""}</section>`;
}

function emptyBox({ title, text, actions = "", motif = "reel" }) {
  return `<div class="empty">${ic(motif, "motif")}<h2>${title}</h2><p>${text}</p>${actions ? `<div class="btn-row">${actions}</div>` : ""}</div>`;
}

/* ================================================================ usmerjanje */

function parseRoute() {
  const h = location.hash.replace(/^#/, "") || "/";
  const [path, qs] = h.split("?");
  return { parts: path.split("/").filter(Boolean), params: new URLSearchParams(qs || "") };
}

function setNav(name) {
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.nav === name) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
}

function render(soft = false) {
  const { parts, params } = parseRoute();
  if (soft) {
    // osvežitev istega pogleda (npr. ko prispejo LuMa podatki): brez skoka in premika fokusa
    const y = window.scrollY;
    const q = document.getElementById("q");
    const typing = q && document.activeElement === q;
    if (typing) return renderDiscoverResults();
    prevHash = "";
    navCount--;
    softRendering = true;
    try { render(); } finally { softRendering = false; }
    window.scrollTo(0, y);
    refreshModal();
    return;
  }
  if (!softRendering && $modal.open) closeModal(); // povezava iz predogleda vodi drugam
  const [r, id] = parts;
  if (params.has("urednik")) setEditor(params.get("urednik") !== "0");
  const leaving = prevHash;
  if (leaving) scrollMemo.set(leaving, window.scrollY);
  const views = {
    undefined: () => [viewHome(), ""],
    odkrij: () => [viewDiscover(params), "odkrij"],
    film: () => [viewFilm(id), "odkrij"],
    moj: () => [viewMine(params), "moj"],
    zanima: () => [viewMine(params), "moj"], // stara povezava: zdaj del Mojega LIFFa
    deljeno: () => [viewShared(params), "moj"],
    luma: () => [viewZiherce(params), "luma"],
    ziherce: () => [viewZiherce(params), "luma"],
    skupaj: () => [viewTogether(), "skupaj"],
    "o-strani": () => [viewAbout(), ""],
  };
  navCount++;
  const fn = views[r] || (() => [viewNotFound(), ""]);
  const [html, nav] = fn();
  $main.innerHTML = (editor ? `<div class="notice info" style="margin-bottom:14px">${ic("warn")}<p><b>Uredniški način</b>: ob filmih in terminih so izpisani ID-ji za LuMa Sheet (film_id, screening_id). <button type="button" class="linkbtn" data-act="editoroff">Izklopi</button></p></div>` : "") + html;
  setNav(nav);
  afterRender(r, params);
  const came = leaving.startsWith("#/film/") || r === "odkrij"; // nazaj na seznam: tja, kjer si ostal
  const key = location.hash || "#/";
  if (came && scrollMemo.has(key)) window.scrollTo(0, scrollMemo.get(key));
  else window.scrollTo(0, 0);
  if (leaving) {
    const h1 = $main.querySelector("h1");
    if (h1) { h1.setAttribute("tabindex", "-1"); h1.focus({ preventScroll: true }); }
  }
  prevHash = key;
  document.title = r ? ($main.querySelector("h1")?.textContent?.trim() || "LuMa × LIFFe 2026") + " · LuMa × LIFFe 2026" : "LIFFe: Manj brskanja, več kina · LuMa × LIFFe 2026";
}

function afterRender(r) {
  if (r === "odkrij") { renderDiscoverResults(); rememberDiscover(location.hash); }
  const sc = r === "moj" && $main.querySelector(".tl-scroll");
  if (sc) {
    // časovnica: ostani, kjer si bil, sicer začni pri prvem dnevu s filmom
    const first = sc.querySelector(".tl-day.has");
    if (tlLeft != null) sc.scrollLeft = tlLeft;
    else if (first && sc.scrollWidth > sc.clientWidth) sc.scrollLeft = first.getBoundingClientRect().left - sc.querySelector(".tl-grid").getBoundingClientRect().left - sc.querySelector(".tl-axis").offsetWidth;
    sc.addEventListener("scroll", () => { tlLeft = sc.scrollLeft; }, { passive: true });
  }
  if (!r) startEyes();
}

/* ================================================================ domov */

function viewHome() {
  const today = ljNow();
  const recs = L.priporocila.filter((r) => P.filmById.has(r.film_id));
  // skupni ogledi: po vrsti, na prvi strani le prihodnji
  const tgAt = (r) => { const s = P.screeningById.get(r.screening_id); return s.date + s.time; };
  const tg = L.skupne.filter((r) => P.screeningById.has(r.screening_id)).sort((a, b) => tgAt(a).localeCompare(tgAt(b)));
  const nowKey = (() => { const n = ljNow(); return n.date + fmtMin(n.min).replace(".", ":").padStart(5, "0"); })();
  const tgNext = tg.filter((r) => tgAt(r) >= nowKey);
  const [sy, , sd] = P.festival.start.split("-").map(Number);
  const [, , ed] = P.festival.end.split("-").map(Number);
  const dayIdx = P.days.indexOf(today.date);
  const utc = (d) => { const [y, m, dd] = d.split("-").map(Number); return Date.UTC(y, m - 1, dd); };
  const dayDiff = Math.round((utc(P.festival.start) - utc(today.date)) / 86400000);
  let when;
  if (dayIdx >= 0) when = `Danes je ${dayIdx + 1}. festivalski dan`;
  else if (dayDiff > 0) when = dayDiff === 1 ? "Začne se jutri!" : `Začne se čez ${dayDiff} ${plural(dayDiff, "dan", "dneva", "dni", "dni")}`;
  else when = "Letošnji festival je mimo – se vidimo prihodnje leto";
  const during = dayIdx >= 0;
  const nightHref = `#/odkrij?tab=cas&d=${during ? today.date : P.days[0]}&od=17:30&do=23:59`;

  const { fav, plan } = store.get();
  const nFav = fav.filter((id) => P.filmById.has(id)).length;
  const nPlan = plan.filter((id) => P.screeningById.has(id)).length;

  return `
  <section class="hero" aria-labelledby="hero-h">
    ${skySvg()}
    <div class="hero-eyes" aria-hidden="true"><span></span><span></span></div>
    <h1 class="hero-title" id="hero-h"><span class="ht-pre">Ljubljanski mednarodni filmski festival<span class="sr">: </span></span>Manj brskanja,<br> <em>več kina.<svg class="ht-squiggle" aria-hidden="true"><use href="#i-squiggle"/></svg></em><span class="ht-pop" aria-hidden="true"> 🍿</span></h1>
    <p class="hero-lead">LIFFe je ena lepših stvari, ki jih prinese jesen.</p>
    <p class="hero-lede">Ogromno filmov, novih zgodb in dobrih razlogov za večer v kinu. Da se med vso to izbiro ne izgubimo, sva pripravila mali filmski vodič, ki ti pomaga izbrati pravi film.</p>
    <p class="hero-micro">Neuradni vodič LuMa film kluba – za filmske navdušence in čisto običajne radovedneže.</p>
    <p class="hero-date" aria-label="${esc(`Festival traja od ${sd}. do ${ed}. novembra ${sy} v Ljubljani. ${when}.`)}">
      <span class="hd-days">${sd}.–${ed}.</span>
      <span class="hd-month">november ${sy}</span>
      <span class="hd-where">Ljubljana · ${esc(when)}</span>
    </p>
  </section>

  <section class="steps" aria-labelledby="steps-h">
    <h2 id="steps-h" class="kicker">Kako deluje</h2>
    <ol class="steps-list">
      <li class="step s-mustard">
        <span class="step-n" aria-hidden="true">1</span>
        <div><h3>${ic("compass")} Odkrij</h3><p>Pobrskaj po filmih in najdi nekaj po svojem okusu.</p>
        <a class="step-go" href="#/odkrij">Vseh ${P.films.length} filmov ${ic("arrow")}</a></div>
      </li>
      <li class="step s-pink">
        <span class="step-n" aria-hidden="true">2</span>
        <div><h3>${ic("heart")} Shrani</h3><p>Označi filme, ki te zamikajo, da jih ne izgubiš med ostalimi.</p>
        <a class="step-go" href="#/moj">${nFav ? `Moj LIFFe · ${nFav} ${plural(nFav, "film", "filma", "filmi", "filmov")}` : "Moj LIFFe"} ${ic("arrow")}</a></div>
      </li>
      <li class="step s-teal">
        <span class="step-n" aria-hidden="true">3</span>
        <div><h3>${ic("cal")} Načrtuj</h3><p>Izberi projekcije in jih poglej v svojem koledarju.</p>
        ${nPlan ? `<a class="step-go" href="#/moj">Moj plan · ${nPlan} ${plural(nPlan, "termin", "termina", "termini", "terminov")} ${ic("arrow")}</a>` : `<a class="step-go" href="${nightHref}">Imam prost večer ${ic("arrow")}</a>`}</div>
      </li>
    </ol>
    <p class="steps-note">${ic("check")}<span>Tvoje izbire se shranijo samo v tem brskalniku – brez registracije in brez računa.</span></p>
  </section>

  <section class="section">
    <div class="section-head"><div><p class="kicker">${ic("star")} Ne veš, kje začet?</p><h2>Ziherce</h2><p class="section-lede">${ZIHERCE_IS}</p></div><a class="btn btn-ghost btn-small" href="#/ziherce">Vse ziherce</a></div>
    ${zihercaList("ocene").length ? `<div class="grid grid-wide">${zihercaList("ocene").slice(0, 3).map((z) => filmCard(P.filmById.get(z.film_id), null, { reviews: true, zih: false })).join("")}</div>`
      : recs.length ? `<div class="grid">${recs.slice(0, 3).map(homeRec).join("")}</div>`
      : !lumaReady ? lumaWait()
      : `<div class="empty empty-mini">${ic("eye", "motif")}<p><b>Najin izbor še nastaja.</b> Brskava po programu in kmalu tukaj objaviva, kaj naju je zamikalo.</p></div>`}
  </section>

  <section class="section">
    <div class="section-head"><div><p class="kicker">${ic("people")} Skupni ogledi</p><h2>Z LuMa v kino</h2><p class="section-lede"><b>Vabljeni v kino z nama!</b> Na te projekcije greva midva – če ti termin ustreza, pridi zraven in se malo podružimo pred ali po filmu.</p></div>${tg.length ? `<a class="btn btn-ghost btn-small" href="#/skupaj">Vsi skupni ogledi</a>` : ""}</div>
    ${tgNext.length ? `<div class="together">${tgNext.slice(0, 3).map(tgCard).join("")}</div>`
      : !lumaReady ? lumaWait()
      : `<div class="empty empty-mini">${ic("people", "motif")}<p><b>Skupni ogledi še niso razpisani.</b> Ko izbereva projekcije, na katere greva, bodo tukaj – s povabilom, da se pridružiš.</p></div>`}
  </section>

  <section class="section firsttime" aria-labelledby="ft-h">
    <div class="ft-icon" aria-hidden="true">${ic("ticket")}</div>
    <div>
      <h2 id="ft-h">Prvič na LIFFu? Dobro je vedeti</h2>
      <ul>
        <li><b>Ta vodič ne rezervira sedežev.</b> Moj LIFFe si izbire le zapomni v tvojem brskalniku – vstopnico kupiš posebej.</li>
        <li><b>Vstopnice</b> so na voljo na <a href="${esc(P.festival.tickets_url)}" target="_blank" rel="noopener">liffe.si</a> in na festivalskih blagajnah. Za Kino Bežigrad, Kino Šiška in dvorano AGRFT jih na prizorišču <b>ni mogoče kupiti</b> – kupi jih prej.</li>
        <li><b>Spremembe programa</b> so mogoče; vedno velja <a href="https://urnik.liffe.si/urnik.aspx" target="_blank" rel="noopener">uradni urnik</a>.</li>
      </ul>
    </div>
  </section>`;
}

function homeRec(r) {
  const f = P.filmById.get(r.film_id);
  const t = titleBits(f);
  return `<article class="card">
    <a class="card-link" href="#/film/${f.id}" data-film="${f.id}">
      ${art(f)}
      <div class="card-body">
        <span class="luma-flag">${ic("star")} LuMa priporoča</span> ${seenTag(r)}
        <h3 class="card-title">${t.main}</h3>
        ${t.alt ? `<p class="alt-title">${t.alt}</p>` : ""}
        ${r.komentar ? `<p class="rec-quote">»${esc(r.komentar)}«</p>` : `<p class="meta">${metaLine(f)}</p>`}
      </div>
    </a>
    ${favBtn(f.id)}
  </article>`;
}

function festRange() {
  const a = P.festival.start.split("-").map(Number), b = P.festival.end.split("-").map(Number);
  return `${a[2]}.–${b[2]}. novembra ${b[0]}`;
}

function skySvg() {
  const pts = [[8, 22], [17, 12], [27, 26], [38, 15], [49, 30], [61, 12], [70, 24], [82, 8], [91, 20], [12, 78], [24, 64], [33, 86], [58, 80], [66, 66], [78, 88], [88, 72]];
  const lines = [[0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [9, 10], [10, 11], [12, 13], [13, 14], [14, 15]];
  return `<svg class="hero-sky" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <g stroke="#e0a53b" stroke-width=".18" opacity=".55">${lines.map(([a, b]) => `<line x1="${pts[a][0]}" y1="${pts[a][1]}" x2="${pts[b][0]}" y2="${pts[b][1]}"/>`).join("")}</g>
    <g fill="#e0a53b">${pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 0.45 : 0.7}"/>`).join("")}</g>
  </svg>`;
}

function startEyes() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const eyes = $main.querySelectorAll(".hero-eyes span");
  if (!eyes.length) return;
  const onMove = (e) => {
    const x = (e.clientX / innerWidth - 0.5) * 2;
    eyes.forEach((el) => el.style.setProperty("--look", `${(x * 26).toFixed(1)}%`));
  };
  window.removeEventListener("pointermove", startEyes._h || (() => {}));
  startEyes._h = onMove;
  window.addEventListener("pointermove", onMove, { passive: true });
}

/* ================================================================ odkrij */

const TIMES = (() => {
  const out = [];
  for (let m = 10 * 60; m <= 23 * 60 + 30; m += 30) out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  return out;
})();

let D = null; // stanje filtrov

function readDiscover(params) {
  const set = (k) => new Set((params.get(k) || "").split(",").filter(Boolean));
  return {
    tab: params.get("tab") === "cas" ? "cas" : "filmi",
    view: params.get("tab") === "termini" || params.get("pogled") === "termini" ? "termini" : "filmi",
    q: params.get("q") || "",
    sec: set("sek"),
    d: set("d"),
    v: set("v"),
    od: params.get("od") || "",
    do: params.get("do") || "",
    late: params.get("pozno") === "1",
    sort: params.get("razvrsti") || "abc",
  };
}

function discoverQuery(st, over = {}) {
  const s = { ...st, ...over };
  const p = new URLSearchParams();
  if (s.tab !== "filmi") p.set("tab", s.tab);
  else if (s.view === "termini") p.set("pogled", "termini");
  if (s.q) p.set("q", s.q);
  if (s.sec.size) p.set("sek", [...s.sec].join(","));
  if (s.d.size) p.set("d", [...s.d].join(","));
  if (s.v.size) p.set("v", [...s.v].join(","));
  if (s.od) p.set("od", s.od);
  if (s.do) p.set("do", s.do);
  if (s.late) p.set("pozno", "1");
  if (s.sort !== "abc") p.set("razvrsti", s.sort);
  const qs = p.toString();
  return "#/odkrij" + (qs ? "?" + qs : "");
}

function syncUrl() {
  const h = discoverQuery(D);
  history.replaceState(null, "", h);
  prevHash = h;
  rememberDiscover(h);
}

// »Odkrij filme« v navigaciji odpre zadnje izbrane filtre (velja v tem zavihku brskalnika)
function rememberDiscover(h) {
  document.querySelector('[data-nav="odkrij"]')?.setAttribute("href", h);
  try { sessionStorage.setItem("luma-odkrij", h); } catch (_) {}
}

function viewDiscover(params) {
  D = readDiscover(params);
  const tabs = [["filmi", "Vsi filmi", "film"], ["cas", "Imam prost čas", "clock"]];
  return `
  ${banner({ c: "mustard", icon: "compass", kicker: "Ves ljubljanski program", title: "Odkrij filme", lede: D.tab === "cas" ? "Povej, kdaj imaš čas – pokažemo projekcije, ki se v tem oknu začnejo, in ali se film izteče pravočasno." : "Vsi filmi z vsaj eno projekcijo v Ljubljani." })}
  <nav class="tabs" aria-label="Način prikaza">
    ${tabs.map(([k, label, icon]) => `<a href="${discoverQuery(D, { tab: k })}" ${D.tab === k ? 'aria-current="page"' : ""}>${ic(icon)}${label}</a>`).join("")}
  </nav>
  <div style="margin-top:16px" class="stack">
    ${D.tab === "cas" ? `<div id="cas-controls">${casControls()}</div>` : ""}
    <label class="searchbar">${ic("search")}<span class="sr">Iskanje po slovenskem, angleškem ali izvirnem naslovu ali po režiserju</span>
      <input id="q" type="search" placeholder="${matchMedia("(max-width: 560px)").matches ? "Slovenski, angleški, izvirni naslov ali režiser" : "Išči po slovenskem, angleškem ali izvirnem naslovu ali po režiserju"}" value="${esc(D.q)}" autocomplete="off" enterkeyhint="search">
    </label>
  </div>
  <div id="controls">${filterControls()}</div>
  <div id="results" aria-live="polite"></div>`;
}

function dayChips(selected, act) {
  const today = ljNow().date;
  return `<div class="chips scroll" role="group" aria-label="Dnevi">${P.days.map((d) => {
    const x = dayParts(d);
    return `<button type="button" class="chip day${d === today ? " today" : ""}" data-act="${act}" data-val="${d}" aria-pressed="${selected.has(d)}" aria-label="${esc(dayLong(d))}"><small>${x.wd}</small><b>${x.d}.</b></button>`;
  }).join("")}</div>`;
}

function timeSelect(id, label, val, emptyLabel) {
  return `<label>${label}<select id="${id}" data-act="time"><option value="">${emptyLabel}</option>${TIMES.map((t) => `<option ${t === val ? "selected" : ""} value="${t}">${t.replace(":", ".")}</option>`).join("")}${id === "do" ? `<option value="23:59" ${val === "23:59" ? "selected" : ""}>do konca dneva</option>` : ""}</select></label>`;
}

function casControls() {
  return `
  <fieldset class="fgroup"><legend>1. Kateri dan? <span class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">(lahko več; brez izbire = vsi dnevi)</span></legend>${dayChips(D.d, "day")}</fieldset>
  <fieldset class="fgroup" style="margin-top:14px"><legend>2. Kdaj imaš čas?</legend>
    <div class="timepick">
      ${timeSelect("od", "Od", D.od, "kadarkoli")}
      ${timeSelect("do", "Do", D.do, "kadarkoli")}
      <div class="btn-row">
        <button type="button" class="btn btn-soft btn-small" data-act="preset" data-od="17:30" data-do="23:59">Zvečer</button>
        <button type="button" class="btn btn-soft btn-small" data-act="preset" data-od="13:00" data-do="18:00">Popoldne</button>
        <button type="button" class="btn btn-soft btn-small" data-act="preset" data-od="" data-do="">Ves dan</button>
      </div>
    </div>
  </fieldset>`;
}

let secInfoOpen = false;

function filterControls() {
  const nMore = D.v.size;
  const active = [];
  for (const s of D.sec) { const name = P.sections.find((x) => slug(x) === s); if (name) active.push(["sek", s, name]); }
  if (D.tab !== "cas") for (const d of D.d) active.push(["d", d, dayShort(d)]);
  for (const v of D.v) active.push(["v", v, venueShort(v)]);
  if (D.tab !== "cas" && (D.od || D.do)) active.push(["time", "", `začetek ${D.od ? "od " + D.od.replace(":", ".") : ""}${D.do ? " do " + D.do.replace(":", ".") : ""}`]);
  const info = P.section_info || {};
  const count = (sec) => P.films.filter((f) => f.section === sec).length;
  const infoBtn = (label) => `<button type="button" class="linkbtn secinfo-btn" data-act="secinfo" aria-expanded="${secInfoOpen}" aria-controls="secinfo">${label}</button>`;
  const secBlock = `
      <div class="chips chips-sec">${P.sections.map((s) => `<button type="button" class="chip" data-act="sec" data-val="${slug(s)}" aria-pressed="${D.sec.has(slug(s))}" title="${esc(info[s] || "")}"><span class="dot" style="--c:${secColor(s)}"></span>${esc(s)}</button>`).join("")}</div>
      <div id="secinfo" class="secinfo" ${secInfoOpen ? "" : "hidden"}>
        <dl>${P.sections.map((s) => `<div><dt><button type="button" class="linkbtn" data-act="sec" data-val="${slug(s)}" aria-pressed="${D.sec.has(slug(s))}"><span class="dot" style="--c:${secColor(s)}"></span>${esc(s)}</button> <span class="muted small">${count(s)} ${plural(count(s), "film", "filma", "filmi", "filmov")}</span></dt><dd>${esc(info[s] || "")}</dd></div>`).join("")}</dl>
        <p class="small muted">Kratki opisi so naši. Uradni opisi sekcij: <a href="https://www.liffe.si/sl/program/festivalske-sekcije" target="_blank" rel="noopener">liffe.si</a>.</p>
      </div>`;
  // Pri »Imam prost čas« sta dan in ura že zgoraj, sekcija in dvorana pa zloženi.
  const secHtml = D.tab === "cas"
    ? `<details class="filters" data-key="sekcija" ${D.sec.size ? "open" : ""}>
      <summary>Sekcija${D.sec.size ? ` <span class="badge">${D.sec.size}</span>` : ""}</summary>
      <div class="filters-body"><p>${infoBtn("Kaj pomeni katera sekcija?")}</p>${secBlock}</div>
    </details>`
    : `<fieldset class="fgroup"><legend>${ic("film")} Sekcija ${infoBtn("Kaj pomeni katera?")}</legend>${secBlock}</fieldset>`;
  return `
  <div class="filterbox">
    ${D.tab !== "cas" ? `
    <div class="fg-row">
      <fieldset class="fgroup"><legend>${ic("cal")} Dan</legend>${dayChips(D.d, "day")}</fieldset>
      <fieldset class="fgroup fg-time"><legend>${ic("clock")} Začetek</legend><div class="timepick">${timeSelect("od", "Od", D.od, "kadarkoli")}${timeSelect("do", "Do", D.do, "kadarkoli")}</div></fieldset>
    </div>` : ""}
    ${secHtml}
    <details class="filters" data-key="dvorana" ${nMore ? "open" : ""}>
      <summary>Dvorana${nMore ? ` <span class="badge">${nMore}</span>` : ""}</summary>
      <div class="filters-body"><div class="chips">${P.venues.map((v) => `<button type="button" class="chip" data-act="venue" data-val="${v.id}" aria-pressed="${D.v.has(v.id)}">${esc(venueShort(v.id))}</button>`).join("")}</div></div>
    </details>
    <div class="fb-foot"><button type="button" class="btn btn-small" data-act="toresults" id="fb-count">Pokaži rezultate ${ic("chev")}</button></div>
  </div>
  ${active.length ? `<div class="active-filters"><span class="muted">Izbrano:</span>${active.map(([k, v, label]) => `<button type="button" class="chip" data-act="unset" data-key="${k}" data-val="${esc(v)}" aria-label="Odstrani filter ${esc(label)}">${esc(label)} ${ic("x")}</button>`).join("")}<button type="button" class="linkbtn small" data-act="clear">Počisti vse</button></div>` : ""}`;
}

function filmPasses(f) {
  if (D.q) {
    const words = norm(D.q).split(" ").filter(Boolean);
    const hay = haystack(f);
    if (!words.every((w) => hay.includes(w))) return false;
  }
  if (D.sec.size && !D.sec.has(slug(f.section))) return false;
  return true;
}

// Vrne null (izpade) ali {fit: 'yes'|'late'|'unknown'|null}
function screeningCheck(s) {
  if (D.d.size && !D.d.has(s.date)) return null;
  if (D.v.size && !D.v.has(s.venue)) return null;
  const st = startMin(s);
  const from = D.od ? toMin(D.od) : 0;
  const to = D.do ? toMin(D.do) : 48 * 60;
  if (D.tab === "cas") {
    if (st < from || st >= to) return null;
    const e = endMin(s, P);
    if (e == null) return { fit: "unknown" };
    if (!D.do) return { fit: null };
    return { fit: e <= to ? "yes" : "late" };
  }
  if (st < from || st > to) return null;
  return { fit: null };
}

const screeningFilterActive = () => D.d.size || D.v.size || D.od || D.do || D.tab === "cas";

function renderDiscoverResults() {
  const box = document.getElementById("results");
  if (!box) return;
  const films = P.films.filter(filmPasses);
  const filmIds = new Set(films.map((f) => f.id));
  const viewSwitch = D.tab === "filmi" ? `<div class="seg" role="group" aria-label="Prikaz">
      <button type="button" class="seg-btn" data-act="view" data-val="filmi" aria-pressed="${D.view === "filmi"}">${ic("film")}Filmi</button>
      <button type="button" class="seg-btn" data-act="view" data-val="termini" aria-pressed="${D.view === "termini"}">${ic("cal")}Termini</button>
    </div>` : "";
  if (D.tab === "filmi" && D.view === "filmi") {
    const hits = new Map();
    for (const s of P.screenings) if (filmIds.has(s.film_id) && screeningCheck(s)) {
      if (!hits.has(s.film_id)) hits.set(s.film_id, []);
      hits.get(s.film_id).push(s.id);
    }
    let list = screeningFilterActive() ? films.filter((f) => hits.has(f.id)) : films;
    const coll = new Intl.Collator("sl");
    if (D.sort === "sek") list.sort((a, b) => P.sections.indexOf(a.section) - P.sections.indexOf(b.section) || coll.compare(a.title_sl, b.title_sl));
    else if (D.sort === "prvi") list.sort((a, b) => firstScreeningKey(a) - firstScreeningKey(b));
    else list.sort((a, b) => coll.compare(a.title_sl, b.title_sl));
    const head = `<div class="result-meta"><p><b>${list.length}</b> ${plural(list.length, "film", "filma", "filmi", "filmov")}</p>
      <div class="result-tools">${viewSwitch}<label class="check">Razvrsti <select data-act="sort" id="sort"><option value="abc" ${D.sort === "abc" ? "selected" : ""}>po abecedi</option><option value="sek" ${D.sort === "sek" ? "selected" : ""}>po sekcijah</option><option value="prvi" ${D.sort === "prvi" ? "selected" : ""}>po prvem terminu</option></select></label></div></div>`;
    setJump(list.length, "film", "filma", "filme", "filmov");
    if (!list.length) { box.innerHTML = head + noResults(); return; }
    let html = "";
    if (D.sort === "sek") {
      for (const sec of P.sections) {
        const part = list.filter((f) => f.section === sec);
        if (part.length) html += `<h2 class="section-head" style="margin-top:28px;font-size:1.6rem"><span><span class="section-tag" style="font-size:.9rem"><span class="dot" style="--c:${secColor(sec)}"></span></span> ${esc(sec)}</span></h2><div class="grid">${part.map((f) => filmCard(f, hits.get(f.id))).join("")}</div>`;
      }
    } else html = `<div class="grid">${list.map((f) => filmCard(f, hits.get(f.id))).join("")}</div>`;
    box.innerHTML = head + html;
    return;
  }

  // termini in prost čas
  const rows = [];
  let hiddenLate = 0;
  for (const s of P.screenings) {
    if (!filmIds.has(s.film_id)) continue;
    const c = screeningCheck(s);
    if (!c) continue;
    if (c.fit === "late" && !D.late) { hiddenLate++; continue; }
    rows.push([s, c]);
  }
  const lateToggle = D.tab === "cas" && D.do ? `<label class="check"><input type="checkbox" data-act="late" ${D.late ? "checked" : ""}> Pokaži tudi filme, ki se končajo po ${D.do === "23:59" ? "polnoči" : D.do.replace(":", ".")}${hiddenLate ? ` (${hiddenLate})` : ""}</label>` : "";
  const head = `<div class="result-meta"><p><b>${rows.length}</b> ${plural(rows.length, "projekcija", "projekciji", "projekcije", "projekcij")}${D.tab === "cas" && D.do ? " se v celoti izide v tvojem oknu" + (D.late ? " ali se začne v njem" : "") : ""}</p>${viewSwitch || lateToggle}</div>`;
  setJump(rows.length, "projekcijo", "projekciji", "projekcije", "projekcij");
  if (!rows.length) { box.innerHTML = head + noResults(hiddenLate); return; }
  let html = "";
  for (const day of P.days) {
    const part = rows.filter(([s]) => s.date === day);
    if (!part.length) continue;
    html += `<section class="day-block"><div class="day-head"><h2>${esc(dayLong(day))}</h2><span class="count">${part.length}</span></div><ul class="rows">${part.map(([s, c]) => rowHtml(s, c.fit)).join("")}</ul></section>`;
  }
  const note = D.tab === "cas" ? `<p class="small muted" style="margin-top:14px">Konec je izračunan iz uradnega trajanja filma. Morebitnih uvodov, pogovorov z ustvarjalci in poti med dvoranami ne poznamo – računaj z rezervo.</p>` : "";
  box.innerHTML = head + html + note;
}

// gumb na dnu filtrov (viden le na ozkem zaslonu): sproti pove, koliko je zadetkov
function setJump(n, ...forms) {
  const b = document.getElementById("fb-count");
  if (b) b.innerHTML = n ? `Pokaži ${n} ${plural(n, ...forms)} ${ic("chev")}` : `Ni zadetkov – poglej namige ${ic("chev")}`;
}

function firstScreeningKey(f) {
  const s = (P.screeningsByFilm.get(f.id) || [])[0];
  return s ? Number(s.date.replace(/-/g, "")) * 10000 + startMin(s) : Infinity;
}

function plural(n, one, two, few, many) {
  const m = n % 100;
  if (m === 1) return one;
  if (m === 2) return two;
  if (m === 3 || m === 4) return few;
  return many;
}

function noResults(hiddenLate = 0) {
  const tips = [];
  if (hiddenLate) tips.push(`<button type="button" class="btn btn-small" data-act="late-on">Pokaži ${hiddenLate} ${plural(hiddenLate, "film, ki se konča", "filma, ki se končata", "filme, ki se končajo", "filmov, ki se končajo")} pozneje</button>`);
  if (D.od || D.do) tips.push(`<button type="button" class="btn btn-small btn-ghost" data-act="widen">Razširi časovno okno</button>`);
  if (D.d.size) tips.push(`<button type="button" class="btn btn-small btn-ghost" data-act="alldays">Vsi dnevi</button>`);
  tips.push(`<button type="button" class="btn btn-small btn-ghost" data-act="clear">Počisti filtre</button>`);
  return emptyBox({ title: "Tu je tema kot v kinodvorani", text: "Za te pogoje ni nobene projekcije. Poskusi s širšim oknom ali drugim dnem.", actions: tips.join(""), motif: "eye" });
}

// Povezave na odzive (vrstni red kot povsod: IMDb → Metacritic → Letterboxd); same ocene ostanejo na teh straneh.
function reviewLinks(f) {
  const ls = ["IMDb", "Metacritic", "Letterboxd"].map((n) => f.links.find((l) => l.site === n)).filter(Boolean);
  if (!ls.length) return "";
  return `<div class="reviews"><span class="reviews-label">Poglej odzive publike in kritikov</span><div class="reviews-links">${ls.map((l) =>
    `<a class="rv rv-${l.site.toLowerCase()}${l.search ? " search" : ""}" href="${esc(l.url)}" target="_blank" rel="noopener" title="${l.search ? `Iskanje na ${l.site}` : `Film na ${l.site}`}" aria-label="${esc(l.site)}${l.search ? ", iskanje" : ""} (odpre se v novem zavihku)">${esc(l.site)} ${ic(l.search ? "search" : "ext")}</a>`).join("")}</div></div>`;
}

// Ali gre LuMa na kakšno projekcijo filma / ali je film med Zihercami
const lumaGoesFilm = (fid) => L.skupne.some((r) => { const s = P.screeningById.get(r.screening_id); return s && s.film_id === fid; });
const isZiherca = (fid) => L.ziherce.some((z) => z.film_id === fid);

function filmCard(f, hitIds, { extra = "", reviews = false, zih = true } = {}) {
  const t = titleBits(f);
  const ss = P.screeningsByFilm.get(f.id) || [];
  const hit = new Set(hitIds || []);
  const rec = lumaRec(f.id);
  const terms = ss.map((s) => {
    const cls = store.inPlan(s.id) ? "planned" : hit.has(s.id) && screeningFilterActive() ? "hit" : "";
    const [wd, ...dm] = dayShort(s.date).split(" ");
    const label = `${dayLong(s.date)}, ${fmtMin(startMin(s))}, ${venueShort(s.venue)}${lumaGoes(s.id) ? ", gre tudi LuMa" : ""}`;
    return `<a class="term ${cls}" href="#/film/${f.id}" data-film="${f.id}" data-sid="${s.id}" title="${esc(venueLabel(P.venueById.get(s.venue)))}" aria-label="${esc(`${label}${cls === "planned" ? ", v tvojem planu" : ""} – odpri termin`)}">${lumaGoes(s.id) ? `<span class="term-luma" title="Na to projekcijo greva midva">${ic("people")}</span>` : ""}<b>${esc(wd)}</b> ${esc(dm.join(" "))} · ${fmtMin(startMin(s))} · ${esc(venueShort(s.venue))}</a>`;
  }).join("");
  return `
  <article class="card">
    <a class="card-link" href="#/film/${f.id}" data-film="${f.id}">
      ${art(f)}
      <div class="card-body">
        ${rec || lumaGoesFilm(f.id) || (zih && isZiherca(f.id)) ? `<span class="card-flags">${rec ? `<span class="luma-flag">${ic("star")} LuMa priporoča</span>` : ""}${lumaGoesFilm(f.id) ? `<span class="tag-goes">${ic("people")} LuMa gre gledat</span>` : ""}${zih && isZiherca(f.id) ? `<span class="tag-zih">${ic("check")} Ziherca</span>` : ""}</span>` : ""}
        <h3 class="card-title">${t.main}</h3>
        ${t.alt ? `<p class="alt-title">${t.alt}</p>` : ""}
        <p class="meta">${metaLine(f)}</p>
        ${extra}
      </div>
    </a>
    ${editor ? `<div class="card-body" style="padding-top:0;flex:0;position:relative;z-index:2">${idTag("film_id", f.id)}</div>` : ""}
    ${favBtn(f.id)}
    <div class="card-body" style="padding-top:0;flex:0">${cardMore(f, terms, ss.filter((s) => hit.has(s.id)).length, !!hitIds && screeningFilterActive())}${reviews ? reviewLinks(f) : ""}</div>
  </article>`;
}

// Opis in termini na kartici: skrita za gumboma »Opis« in »Termini«; odprti ostanejo odprti tudi po ponovnem izrisu.
const openMore = { opis: new Set(), termini: new Set() };
let moreSeq = 0;
function termsNote(f, nHit, filtered) {
  if ((P.screeningsByFilm.get(f.id) || []).some((s) => store.inPlan(s.id))) return `<span class="more-note"><span class="sr">, </span>${ic("check")}v planu</span>`;
  return filtered ? `<span class="more-note hit"><span class="sr">, </span>${nHit} ${plural(nHit, "ustreza", "ustrezata", "ustrezajo", "ustreza")}</span>` : "";
}
function cardMore(f, terms, nHit, filtered) {
  const n = (P.screeningsByFilm.get(f.id) || []).length;
  const part = (kind, label, body) => {
    const on = openMore[kind].has(f.id);
    const id = `${kind}-${++moreSeq}`;
    return { btn: `<button type="button" class="desc-toggle" data-act="more" data-kind="${kind}" data-id="${f.id}" aria-expanded="${on}" aria-controls="${id}">${label} ${ic("chev")}</button>`,
      panel: `<div class="more-panel${on ? " open" : ""}" id="${id}"><div>${body}</div></div>` };
  };
  const parts = [
    f.summary ? part("opis", "Opis", `<p class="card-sum">${esc(f.summary)}</p>`) : null,
    n ? part("termini", `Termini · ${n}${termsNote(f, nHit, filtered).replace("<span", `<span data-hit="${nHit}" data-filtered="${filtered ? 1 : 0}"`)}`, `<div class="card-terms">${terms}</div>`) : null,
  ].filter(Boolean);
  if (!parts.length) return "";
  return `<div class="card-more"><div class="more-btns">${parts.map((x) => x.btn).join("")}</div>${parts.map((x) => x.panel).join("")}</div>`;
}

function rowHtml(s, fit = null) {
  const f = P.filmById.get(s.film_id);
  const t = titleBits(f, { withAlt: false });
  const r = timeRange(s);
  const goes = lumaGoes(s.id);
  let fitHtml = "";
  if (fit === "yes") fitHtml = `<span class="fit yes">${ic("check")} Konec ob ${r.end}</span>`;
  else if (fit === "late") fitHtml = `<span class="fit late">${ic("clock")} Konec ob ${r.end} – po tvojem oknu</span>`;
  else if (fit === "unknown") fitHtml = `<span class="fit unknown">Trajanje ni znano</span>`;
  return `
  <li class="row">
    <div class="row-time"><b>${r.start}</b>${r.end ? `<span>do ${r.end}</span>` : `<span>konec ni znan</span>`}</div>
    <div class="row-main">
      <a class="row-title" href="#/film/${f.id}" data-film="${f.id}">${t.main}</a>${goes ? `<span class="with-luma">${ic("people")} z LuMa</span>` : ""}
      <p class="row-sub">${esc(venueShort(s.venue))} · ${esc(f.section)}${f.runtime ? ` · ${f.runtime} min` : ""}</p>
      ${fitHtml}${idTag("screening_id", s.id)}
    </div>
    <div class="row-actions">${planBtn(s.id)}</div>
  </li>`;
}

/* ================================================================ film */

function viewFilm(id) {
  const f = P.filmById.get(id);
  if (!f) return viewNotFound("Tega filma ni v ljubljanskem programu", "Morda je bil umaknjen ali ima le projekcije izven Ljubljane.");
  const t = titleBits(f);
  const ss = P.screeningsByFilm.get(f.id) || [];
  const rec = lumaRec(f.id);
  const facts = [
    ["Režija", f.director], ["Država", f.countries?.join(", ")], ["Leto", f.year], ["Trajanje", f.runtime ? `${f.runtime} min` : "ni podatka"],
    ["Jezik", f.language], ["Podnapisi", f.subtitles], ["Sekcija", f.section],
  ].filter(([, v]) => v);
  const altTitles = [];
  if (f.title_en) altTitles.push(`<span>${esc(f.title_en)}</span>`);
  if (f.title_orig) altTitles.push(`<span lang="">${esc(f.title_orig)}</span> <span class="muted small">(izvirni naslov)</span>`);
  return `
  <a class="back" href="#/odkrij" data-act="back">${ic("back")} Nazaj</a>
  <article>
    <div class="film-top">
      <div>${art(f, true)}</div>
      <div class="film-titles">
        <p class="section-tag"><a href="#/odkrij?sek=${slug(f.section)}" title="${esc((P.section_info || {})[f.section] || "")}"><span class="dot" style="--c:${secColor(f.section)}"></span>${esc(f.section)}</a></p>
        ${(P.section_info || {})[f.section] ? `<p class="small muted sec-desc">${esc(P.section_info[f.section])}</p>` : ""}
        <h1 style="margin-top:8px">${esc(f.title_sl || f.title_en)}</h1>
        ${idTag("film_id", f.id)}
        ${altTitles.length ? `<p class="alt-title">${altTitles.join(" · ")}</p>` : ""}
        <dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
        <div class="btn-row" style="margin-top:16px">
          ${favBtn(f.id).replace('class="iconbtn fav"', 'class="iconbtn"')}
          <span class="small muted" style="align-self:center">${store.isFav(f.id) ? "Med filmi, ki te zanimajo" : "Zanima me – shrani film"}</span>
        </div>
      </div>
    </div>

    <div class="section stack" style="margin-top:28px">
      ${f.summary ? `<p class="summary">${esc(f.summary)}</p>` : f.summary_status === "preveri" ? `<div class="notice">${ic("warn")}<p>Uradni opis tega filma na LIFFe je trenutno videti napačen (enak opisu drugega filma), zato povzetka ne prikazujemo. Preveri na strani LIFFe.</p></div>` : ""}
      ${f.why ? `<div class="why"><b>Zakaj je zanimiv?</b>${esc(f.why)}</div>` : ""}
      <p><a href="${esc(f.liffe_url)}" target="_blank" rel="noopener"><b>Celoten opis na LIFFe</b> ${ic("ext")}</a> ${f.summary ? `<span class="draft">· Kratek povzetek je naš, napisan po uradnem opisu.</span>` : ""}</p>
      ${rec ? `<div class="luma-note"><p class="kicker">${ic("star")} LuMa priporoča ${seenTag(rec)}</p>${rec.komentar ? `<blockquote>${esc(rec.komentar)}</blockquote>` : ""}</div>` : ""}
    </div>

    <section class="section">
      <h2 style="margin-bottom:12px">Projekcije v Ljubljani</h2>
      ${ss.length ? `<div class="screens">${ss.map((s) => screenCard(s)).join("")}</div>` : `<p class="muted">Ni projekcij v Ljubljani.</p>`}
      <p class="small muted" style="margin-top:10px">»Dodaj v moj LIFFe plan« si termin le zapomni v tem brskalniku. Vstopnico kupiš posebej – gumb »Vstopnice« odpre uradno prodajo Cankarjevega doma.</p>
    </section>

    <section class="section">
      <h2 style="margin-bottom:12px">Več o filmu</h2>
      ${extLinks(f)}
    </section>
  </article>`;
}

function screenCard(s) {
  const r = timeRange(s);
  const v = P.venueById.get(s.venue);
  const goes = lumaGoes(s.id);
  return `
  <div class="screen ${store.inPlan(s.id) ? "planned" : ""}" data-sid="${s.id}">
    <div>
      <p class="screen-when">${esc(dayLong(s.date))}, ${r.start}${r.end ? ` <span class="muted">– ${r.end}</span>` : ""}${goes ? `<a class="with-luma" href="#/skupaj">${ic("people")} gre tudi LuMa</a>` : ""}</p>
      <p class="screen-where">${esc(venueLabel(v))} · <a href="${esc(v.map_url)}" target="_blank" rel="noopener">zemljevid</a></p>
      ${idTag("screening_id", s.id)}
    </div>
    <div class="screen-actions">
      ${planBtn(s.id)}
      ${store.inPlan(s.id) ? ticketBtn(s.id) : ""}
      ${store.inPlan(s.id) && tickets.has(s.id) ? "" : ticketLink(s)}
    </div>
    ${exportTag(s.id)}
  </div>`;
}

// Posamezen termin v koledar: Google (povezava), Apple in drugi (.ics). Izvoz se le zabeleži.
function calButtons(s, f) {
  const t = esc(f.title_sl);
  return `<details class="cal-menu"><summary class="iconbtn cal-btn" aria-label="${t}: dodaj v koledar" title="Dodaj v koledar">${ic("cal")}</summary>
    <div class="cal-pop" role="group" aria-label="Dodaj ${t} v koledar"><p>Dodaj v koledar</p>
      <a href="${esc(gcalUrl(s, P))}" target="_blank" rel="noopener" data-act="gcal" data-id="${s.id}">Google Koledar ${ic("ext")}</a>
      <button type="button" data-act="ics1" data-id="${s.id}">Apple Koledar</button>
      <button type="button" data-act="ics1" data-id="${s.id}">Drug koledar (.ics)</button>
    </div></details>`;
}

// Le dejstvo, da je bil izvoz narejen – ne trdimo, da je dogodek v koledarju.
function exportTag(sid) {
  const x = exported.get(sid);
  if (!x) return "";
  return `<p class="exported">${ic("check")}<span>${x.how === "google" ? "Odprto v Google Koledarju" : "Izvoženo v koledar"}</span></p>`;
}

function extLinks(f) {
  const names = { IMDb: "s-imdb", LIFFe: "s-liffe", Metacritic: "s-metacritic", Letterboxd: "s-letterboxd" };
  const anySearch = f.links.some((l) => l.search);
  return `<div class="extlinks">${f.links.map((l) => `<a class="ext ${names[l.site]}${l.search ? " search" : ""}" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.site)}${l.search ? " <small>iskanje</small>" : ""} ${ic(l.search ? "search" : "ext")}</a>`).join("")}</div>
  ${anySearch ? `<p class="small muted" style="margin-top:8px">Črtkane povezave so iskanja, ker točne strani filma nismo mogli zanesljivo potrditi.</p>` : ""}
  ${f.program ? `<p class="small muted" style="margin-top:8px">To je sklop več kratkih filmov, zato v zunanjih bazah nima ene strani.</p>` : ""}`;
}

/* ================================================================ Moj LIFFe */

function viewMine(params) {
  const { fav, plan } = store.get();
  const valid = plan.filter((id) => P.screeningById.has(id));
  const missing = plan.filter((id) => !P.screeningById.has(id));
  const favFilms = fav.map((id) => P.filmById.get(id)).filter(Boolean);
  const unscheduled = favFilms.filter((f) => !(P.screeningsByFilm.get(f.id) || []).some((s) => store.inPlan(s.id)));
  const head = (lede) => banner({ c: "coral", icon: "cal", kicker: "Tvoj festival na enem mestu", title: "Moj LIFFe", lede });
  if (!valid.length && !missing.length && !favFilms.length) {
    return `${head("Filmi, ki te zanimajo, in termini, ki jih nameravaš obiskati.")}
    ${emptyBox({ title: "Tvoj LIFFe je še prazno platno", text: "Ko te kak film zamika, klikni srček – shrani se sem. Ko izbereš termin z gumbom »Dodaj v moj LIFFe plan«, se pojavi v koledarju. Vse ostane samo v tem brskalniku – brez registracije.", actions: `<a class="btn" href="#/ziherce">${ic("star")}<span>Poglej ziherce</span></a><a class="btn btn-ghost" href="#/odkrij">Brskaj po filmih</a>`, motif: "eye" })}`;
  }
  const clash = overlaps(valid, P);
  const notExp = valid.filter((id) => !exported.get(id));
  const nTix = valid.filter((id) => tickets.has(id)).length;
  const listView = params.get("pogled") === "seznam";
  const summary = [
    valid.length ? `${valid.length} ${plural(valid.length, "termin", "termina", "termini", "terminov")} v planu${nTix ? `, ${nTix} z vstopnico` : ""}${clash.size ? ` – <b>${clash.size} se prekrivajo</b>` : ""}` : "",
    unscheduled.length ? `${unscheduled.length} ${plural(unscheduled.length, "film", "filma", "filmi", "filmov")} še brez termina` : "",
  ].filter(Boolean).join(" · ");

  // seznam: le čas, naslov, dvorana (in vstopnica / prekrivanje), vse drugo je v predogledu filma
  const byDay = new Map();
  for (const id of valid) { const s = P.screeningById.get(id); if (!byDay.has(s.date)) byDay.set(s.date, []); byDay.get(s.date).push(s); }
  const listHtml = [...byDay.keys()].sort().map((d) => {
    const list = byDay.get(d).sort((a, b) => startMin(a) - startMin(b));
    return `<section class="mlist-day"><h3>${esc(dayLong(d))} <span class="count">${list.length} ${plural(list.length, "film", "filma", "filmi", "filmov")}</span></h3><ul class="mlist">${list.map((s) => {
      const f = P.filmById.get(s.film_id);
      const r = timeRange(s);
      const tix = tickets.has(s.id), cl = (clash.get(s.id) || []).length > 0;
      return `<li class="mitem${tix ? " tix" : ""}${cl ? " clash" : ""}">
        <span class="mi-time"><b>${r.start}</b>${r.end ? `<small>do ${r.end}</small>` : ""}</span>
        <span class="mi-main">
          <a class="mi-title" href="#/film/${f.id}" data-film="${f.id}" data-sid="${s.id}">${esc(f.title_sl)}</a>
          <span class="mi-meta">${esc(venueShort(s.venue))}${lumaGoes(s.id) ? `<span class="with-luma">${ic("people")} gre tudi LuMa</span>` : ""}${tix ? ticketTag(s.id) : ""}${cl ? `<span class="mrow-clash">${ic("warn")} prekrivanje</span>` : ""}</span>
        </span>
        ${calButtons(s, f)}
      </li>`;
    }).join("")}</ul></section>`;
  }).join("");

  // filmi s srčkom brez izbranega termina: kompaktno, klik odpre predogled s termini
  const favRows = unscheduled.map((f) => {
    const n = (P.screeningsByFilm.get(f.id) || []).length;
    return `<li class="frow"><a class="frow-main" href="#/film/${f.id}" data-film="${f.id}">${f.img ? `<img src="${esc(f.img.s)}" alt="" width="96" height="40" loading="lazy" decoding="async">` : ""}<span><b>${esc(f.title_sl)}</b><small>${esc(f.section)} · ${n} ${plural(n, "termin", "termina", "termini", "terminov")}</small></span><span class="frow-go">Izberi termin ${ic("arrow")}</span></a>${favBtn(f.id)}</li>`;
  }).join("");

  return `
  ${head(`${summary}. Shranjeno samo v tem brskalniku.`)}
  ${missing.length ? `<div class="notice" style="margin-bottom:14px">${ic("warn")}<div><p><b>${missing.length} ${plural(missing.length, "izbran termin ni", "izbrana termina nista", "izbrani termini niso", "izbranih terminov ni")} več v uradnem urniku.</b> Morda je LIFFe projekcijo prestavil ali odpovedal. Preveri na <a href="https://urnik.liffe.si/urnik.aspx" target="_blank" rel="noopener">urnik.liffe.si</a>.</p><button type="button" class="linkbtn small" data-act="dropmissing">Odstrani jih iz plana</button></div></div>` : ""}

  <section class="mine-sec" aria-labelledby="plan-h">
    <div class="mine-sec-head">
      <h2 id="plan-h">${ic("cal")} Moj plan</h2>
      ${valid.length ? `<div class="seg" role="group" aria-label="Prikaz plana">
        <a class="seg-btn" href="#/moj" ${listView ? "" : 'aria-current="true"'}>${ic("cal")}Koledar</a>
        <a class="seg-btn" href="#/moj?pogled=seznam" ${listView ? 'aria-current="true"' : ""}>${ic("film")}Seznam</a>
      </div>` : ""}
    </div>
    ${valid.length ? (listView ? listHtml : timelineHtml(valid, clash, params.get("zanima") === "1"))
      : `<div class="empty empty-mini">${ic("cal", "motif")}<p><b>V planu še ni terminov.</b> Pri filmu izberi termin z gumbom »Dodaj v moj LIFFe plan«${unscheduled.length ? " – na primer pri filmih spodaj" : ""}.</p></div>`}
    ${valid.length ? `<div class="toolbar mine-tools">
      ${notExp.length === valid.length ? `<button type="button" class="btn btn-small btn-ghost" data-act="icsall">${ic("cal")}<span>Izvozi vse v koledar</span></button>`
        : notExp.length ? `<button type="button" class="btn btn-small btn-ghost" data-act="icsnew">${ic("cal")}<span>Izvozi ${notExp.length} ${plural(notExp.length, "nov termin", "nova termina", "nove termine", "novih terminov")}</span></button>`
        : `<button type="button" class="btn btn-small btn-ghost" data-act="icsall">${ic("cal")}<span>Izvozi vse znova</span></button>`}
      <button type="button" class="btn btn-small btn-ghost" data-act="share">${ic("share")}<span>Deli moj LIFFe</span></button>
    </div>
    ${listView ? "" : `<p class="small muted" style="margin-top:8px">Posamezen termin dodaš v Google ali Apple koledar v pogledu <a href="#/moj?pogled=seznam">Seznam</a>.</p>`}
    <div id="share-out"></div>` : ""}
  </section>

  <section class="mine-sec" aria-labelledby="fav-h">
    <div class="mine-sec-head"><h2 id="fav-h">${ic("heart")} Zanima me – še brez termina${unscheduled.length ? ` <span class="count">${unscheduled.length}</span>` : ""}</h2></div>
    ${unscheduled.length ? `<ul class="frows">${favRows}</ul>`
      : `<p class="small muted">${favFilms.length ? "Vsi filmi, ki te zanimajo, že imajo termin v planu." : "Ko te kak film zamika, klikni srček – shrani se sem, da ga ne izgubiš med ostalimi."}</p>`}
  </section>

  <p class="small muted" style="margin-top:28px">Klikni film za podrobnosti: tam termin dodaš ali odstraniš in označiš, da že imaš vstopnico. Izvoz prenese datoteko za Apple Koledar, Google Koledar ali Outlook (časovni pas Europe/Ljubljana); dogodek v koledarju ni vstopnica.</p>
  <p class="small" style="margin-top:10px">${valid.length ? `<button type="button" class="linkbtn" data-act="wipeplan">Počisti plan</button>` : ""}${valid.length && favFilms.length ? " · " : ""}${favFilms.length ? `<button type="button" class="linkbtn" data-act="wipefav">Počisti »Zanima me«</button>` : ""}</p>`;
}

/* ---------------------------------------------------------------- časovnica */

// Vsi festivalski dnevi kot stolpci od leve proti desni, čas navpično: vidi se, kje so prosti dnevi in pavze.
// Po želji še termini filmov iz »Zanima me«, ki še niso v koledarju (črtkano), da najdeš, kaj zapolni luknjo.
let tlLeft = null; // vodoravni položaj časovnice ostane med osvežitvami
const fmtDur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);

function timelineHtml(valid, clash, withFav) {
  const span = (s) => { const a = startMin(s), e = endMin(s, P); return { a, b: e ?? a + 90, known: e != null }; };
  const items = valid.map((id) => ({ s: P.screeningById.get(id), ghost: false }));
  const favFilms = store.get().fav.map((id) => P.filmById.get(id)).filter(Boolean);
  if (withFav) for (const f of favFilms) for (const s of P.screeningsByFilm.get(f.id) || []) if (!store.inPlan(s.id)) items.push({ s, ghost: true });
  for (const it of items) Object.assign(it, span(it.s));
  const lo = Math.floor(Math.min(17 * 60, ...items.map((it) => it.a)) / 60) * 60;
  const hi = Math.ceil(Math.max(23 * 60, ...items.map((it) => it.b)) / 60) * 60;
  const today = ljNow().date;
  const pos = (it) => `top:calc(${(it.a - lo) / 60} * var(--hour));height:calc(${(it.b - it.a) / 60} * var(--hour));left:calc(${(it.lane * 100) / it.lanes}% + 2px);width:calc(${100 / it.lanes}% - 4px)`;

  const cols = P.days.map((d) => {
    const day = items.filter((it) => it.s.date === d).sort((x, y) => x.a - y.a || x.b - y.b);
    // vzporedni termini (prekrivanja) dobijo vsak svoj pas
    let cluster = [], end = -Infinity;
    const flush = () => { const lanes = []; for (const it of cluster) { let i = lanes.findIndex((e) => e <= it.a); if (i < 0) { i = lanes.length; lanes.push(0); } lanes[i] = it.b; it.lane = i; } for (const it of cluster) it.lanes = lanes.length; cluster = []; };
    for (const it of day) { if (cluster.length && it.a >= end) { flush(); end = -Infinity; } cluster.push(it); end = Math.max(end, it.b); }
    if (cluster.length) flush();
    const blocks = day.map((it) => {
      const f = P.filmById.get(it.s.film_id);
      const r = timeRange(it.s);
      const cls = (it.ghost ? "ghost" : (clash.get(it.s.id) || []).length ? "clash" : "") + (!it.ghost && tickets.has(it.s.id) ? " ticket" : "");
      const label = `${dayLong(d)}, ${r.start}${r.end ? `–${r.end}` : ""}, ${f.title_sl}, ${venueShort(it.s.venue)}${it.ghost ? " – termin filma, ki te zanima, ni v planu" : `${cls.includes("clash") ? " – prekriva se z drugim terminom" : ""}${tickets.has(it.s.id) ? " – vstopnico imaš" : ""}`}`;
      return `<a class="tl-item ${cls}${it.known ? "" : " unknown"}" href="#/film/${f.id}" data-film="${f.id}" data-sid="${it.s.id}" style="${pos(it)}" aria-label="${esc(label)}" title="${esc(label)}">${it.ghost ? "" : cls.includes("clash") ? `<span class="tl-badge warn" aria-hidden="true">!</span>` : tickets.has(it.s.id) ? `<span class="tl-badge ok" aria-hidden="true">${ic("check")}</span>` : ""}<span class="tl-t">${r.start}${r.end ? `–${r.end}` : ""}</span><span class="tl-n">${esc(f.title_sl)}</span>${it.ghost ? "" : `<span class="tl-v">${esc(venueShort(it.s.venue))}</span>`}</a>`;
    }).join("");
    // pavze med zaporednimi termini v koledarju
    const mine = day.filter((it) => !it.ghost);
    let gaps = "";
    for (let i = 0; i + 1 < mine.length; i++) {
      const a = mine[i], b = mine[i + 1], g = b.a - a.b;
      if (g <= 0) continue;
      const other = a.s.venue !== b.s.venue;
      const tight = g < 20 || (other && g < 30);
      const what = tight ? `le ${g} min${other ? " · druga dvorana" : ""}` : `pavza ${fmtDur(g)}`;
      gaps += `<div class="tl-gap${tight ? " tight" : ""}" style="top:calc(${(a.b - lo) / 60} * var(--hour));height:calc(${g / 60} * var(--hour))" title="${esc(what)}" aria-hidden="true"><span>${tight ? `le ${g} min` : g >= 45 ? `pavza ${fmtDur(g)}` : `${g} min`}</span></div>`;
    }
    const x = dayParts(d);
    const has = mine.length > 0;
    return `<div class="tl-day${has ? " has" : ""}${d === today ? " today" : ""}" role="listitem" aria-label="${esc(dayLong(d))}: ${has ? `${mine.length} ${plural(mine.length, "termin", "termina", "termini", "terminov")}` : "prosto"}">
      <div class="tl-head"><b>${x.wd}</b> ${x.d}. ${x.m}.</div>
      <div class="tl-body">${blocks}${gaps}${!has && !day.length ? `<span class="tl-free">prosto</span>` : ""}</div>
    </div>`;
  }).join("");
  const hours = [];
  for (let h = lo; h < hi; h += 60) hours.push(`<span style="top:calc(${(h - lo) / 60} * var(--hour))">${(h / 60) % 24}</span>`);
  const daysWith = new Set(valid.map((id) => P.screeningById.get(id).date)).size;
  const free = P.days.length - daysWith;
  const nTicket = valid.filter((id) => tickets.has(id)).length;
  const nPlanOnly = valid.length - nTicket;
  const nClash = valid.filter((id) => (clash.get(id) || []).length).length;
  const nGhost = items.filter((it) => it.ghost).length;
  return `<section class="tl" aria-label="Časovnica koledarja">
    <p class="tl-sum">Filmi v ${daysWith} od ${P.days.length} festivalskih dni${free ? `, ${free} ${plural(free, "dan je prost", "dneva sta prosta", "dnevi so prosti", "dni je prostih")}` : ""}. Klikni termin za podrobnosti.</p>
    <ul class="tl-key" aria-label="Pomen oznak">
      <li><i class="sw sw-plan"></i><span><b>V planu</b> – vstopnice še nimaš</span><em>${nPlanOnly}</em></li>
      <li><i class="sw sw-ticket">${ic("check")}</i><span><b>Vstopnica kupljena</b></span><em>${nTicket}</em></li>
      ${nClash ? `<li><i class="sw sw-clash">!</i><span><b>Prekrivanje</b> – rdeča obroba</span><em>${nClash}</em></li>` : ""}
      ${withFav ? `<li><i class="sw sw-ghost"></i><span><b>Zanima me</b> – drug možen termin</span><em>${nGhost}</em></li>` : ""}
    </ul>
    ${favFilms.length ? `<label class="check tl-toggle"><input type="checkbox" data-act="tlfav" ${withFav ? "checked" : ""}> Pokaži tudi termine filmov iz »Zanima me« (črtkano)</label>` : ""}
    <div class="tl-scroll" tabindex="0">
      <div class="tl-grid" role="list" style="--n:${P.days.length};--span:${(hi - lo) / 60}">
        <div class="tl-axis" aria-hidden="true"><div class="tl-head"></div><div class="tl-body">${hours.join("")}</div></div>
        ${cols}
      </div>
    </div>
    <p class="tl-legend"><span><i class="lg-gap"></i>pavza med filmoma (rdeče: tesno)</span></p>
  </section>`;
}

/* ================================================================ deljeno */

function viewShared(params) {
  const { plan, fav } = parseShare(params);
  const vPlan = plan.filter((id) => P.screeningById.has(id));
  const vFav = fav.filter((id) => P.filmById.has(id));
  const lost = plan.length - vPlan.length + fav.length - vFav.length;
  if (!vPlan.length && !vFav.length) {
    return `${banner({ c: "coral", icon: "share", kicker: "Deljena povezava", title: "Deljen LIFFe" })}${emptyBox({ title: "Ta povezava je prazna", text: "V deljeni povezavi ni terminov ali filmov, ki bi bili v trenutnem programu.", actions: `<a class="btn" href="#/odkrij">Brskaj po filmih</a>` })}`;
  }
  const sorted = vPlan.map((id) => P.screeningById.get(id)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const days = [...new Set(sorted.map((s) => s.date))];
  const already = vPlan.filter((id) => store.inPlan(id)).length;
  return `
  ${banner({ c: "coral", icon: "share", kicker: "Deljena povezava", title: "Deljen LIFFe", lede: `Nekdo je s tabo delil svoj festivalski koledar: ${vPlan.length} ${plural(vPlan.length, "termin", "termina", "termine", "terminov")}${vFav.length ? ` in ${vFav.length} ${plural(vFav.length, "film", "filma", "filme", "filmov")}, ki ga zanimajo` : ""}. V povezavi so le ID-ji projekcij – nobenih imen ali osebnih podatkov.` })}
  <div class="toolbar">
    <button type="button" class="btn" data-act="mergeshared" data-plan="${vPlan.join(",")}" data-fav="${vFav.join(",")}">${ic("plus")}<span>Dodaj v moj LIFFe</span></button>
    <a class="btn btn-ghost" href="#/moj">Moj LIFFe</a>
  </div>
  <p class="small muted">Tvoje obstoječe izbire ostanejo; dodamo le, česar še nimaš.${already ? ` ${already} od teh terminov že imaš.` : ""}</p>
  ${lost ? `<div class="notice" style="margin-top:12px">${ic("warn")}<p>${lost} ${plural(lost, "izbira ni", "izbiri nista", "izbire niso", "izbir ni")} več v programu (morda spremenjen termin).</p></div>` : ""}
  ${days.map((d) => `<section class="day-block"><div class="day-head"><h2>${esc(dayLong(d))}</h2></div><ul class="rows">${sorted.filter((s) => s.date === d).map((s) => rowHtml(s)).join("")}</ul></section>`).join("")}
  ${vFav.length ? `<section class="section"><h2 style="margin-bottom:12px">Zanimajo ga/jo</h2><div class="grid">${vFav.map((id) => filmCard(P.filmById.get(id))).join("")}</div></section>` : ""}`;
}

/* ================================================================ LuMa */

// Ziherce: uredniški izbor LuMa (Sheet »luma_ziherce«) – brez številk tretjih virov.
// Ocene IMDb, Metascore ipd. sta pogledala sami zase; na strani je le njun izbor in vrstni red.
const ZIHERCE_IS = "Ziherce so filmi, pri katerih je najmanj možnosti, da usekaš mimo: novi filmi, ki so jih gledalci in kritiki najbolje sprejeli, nagrajenci velikih festivalov in preverjene klasike.";
const ZVIEWS = [
  ["ocene", "people", "Ocene publike in kritikov", "Ocene", "Novi filmi, ki so jih gledalci in kritiki najbolje sprejeli."],
  ["festivali", "star", "Odmevni filmi velikih festivalov", "Festivali", "Letošnji nagrajenci Cannesa, Benetk, Berlina, San Sebastiána, Locarna in Sundancea."],
  ["starejsi", "film", "Starejše klasike", "Klasike", "Priljubljeni starejši filmi iz retrospektiv in posvetil – preverjeni, a niso festivalske novosti."],
];

function zihercaList(razlog) {
  return L.ziherce.filter((z) => z.razlog === razlog && P.filmById.has(z.film_id));
}

function viewZiherce(params) {
  const avail = ZVIEWS.filter(([k]) => zihercaList(k).length);
  const want = params.get("pogled");
  const view = (avail.find(([k]) => k === want) || avail[0] || ZVIEWS[0])[0];
  const meta = ZVIEWS.find(([k]) => k === view);
  const sw = avail.length > 1 ? `<div class="zswitch" role="group" aria-label="Vrsta ziherc" style="--n:${avail.length}">
      ${avail.map(([k, icon, label, short, hint]) => `<a href="#/ziherce?pogled=${k}" class="zopt" ${k === view ? 'aria-current="true"' : ""}><b>${ic(icon)} <span class="zl">${label}</span><span class="zs">${short}</span></b><span class="zh">${hint}</span></a>`).join("")}
    </div>` : "";
  const list = zihercaList(view);
  const body = list.length ? `<div class="grid grid-wide">${list.map((z) => {
    const f = P.filmById.get(z.film_id);
    const extra = z.nagrada ? `<p class="award">${ic("star")} ${esc(z.nagrada)}</p>` : "";
    return filmCard(f, null, { extra, reviews: true, zih: false });
  }).join("")}</div>` : "";
  const none = !avail.length && !lumaReady ? lumaWait() : !avail.length ? emptyBox({ title: "Ziherce še nastajajo", text: "Brskava po programu in izbirava. Filmi bodo tu, ko jih objaviva – brez izmišljenih seznamov do takrat.", actions: `<a class="btn" href="#/odkrij">Medtem: brskaj po filmih</a>`, motif: "eye" }) : "";
  // Kako je seznam nastal: nad seznamom, da je logika jasna, preden začneš brati.
  const how = view === "ocene" ? "Vrstni red temelji na ocenah gledalcev in kritikov (IMDb, Metacritic), ki sva jih pregledala sama. Filmom z malo glasovi sva zaupala manj. Številk ne objavljava – pri vsakem filmu je povezava do pravih ocen."
    : view === "festivali" ? "Nagrade so preverjene v uradnih opisih LIFFe in poročilih festivalov."
    : "Izbor ni festivalska novost: to so preverjeni starejši filmi, ki jih LIFFe vrti v retrospektivah in posvetilih.";
  const anyRec = list.some((z) => lumaRec(z.film_id));
  const note = `<p class="zhow">${esc(how)}${anyRec ? ` <span class="zlegend"><span class="luma-flag">${ic("star")} LuMa priporoča</span> pomeni, da film priporočava midva osebno.</span>` : ""}</p>`;
  return `
  ${banner({ c: "pink", icon: "star", kicker: "Za prvi LIFFe in vse naslednje", title: "Ziherce", lede: `${ZIHERCE_IS} Brez garancije, seveda – ampak nekje je treba začet.` })}
  ${sw}
  <div class="section" style="margin-top:22px">
    ${avail.length ? `<p class="zhint">${ic(meta[1])} ${esc(meta[4])}</p>${note}` : ""}
    ${body}${none}
  </div>`;
}

// Skupni ogled: kompaktna vrstica – datum, ura in dvorana, naslov, dejanja. Podrobnosti so v predogledu filma.
function tgCard(r) {
  const s = P.screeningById.get(r.screening_id);
  const f = P.filmById.get(s.film_id);
  const x = dayParts(s.date);
  const tr = timeRange(s);
  const joined = L.pridruzeni.filter((j) => j.screening_id === s.id);
  const url = rsvpUrl(r);
  const now = ljNow();
  const past = s.date < now.date || (s.date === now.date && startMin(s) < now.min);
  return `<article class="tg${past ? " past" : ""}">
    <div class="tg-date"><small>${x.wdLong}</small><b>${x.d}. ${x.m}.</b></div>
    <div class="tg-main">
      <p class="tg-time">${tr.start}${tr.end ? `–${tr.end}` : ""} · ${esc(venueShort(s.venue))}</p>
      <h3 class="tg-title"><a href="#/film/${f.id}" data-film="${f.id}" data-sid="${s.id}">${titleBits(f, { withAlt: false }).main}</a></h3>
      ${r.povabilo ? `<p class="tg-invite">${esc(r.povabilo)}</p>` : ""}
      ${r.zbirno_mesto ? `<p class="small"><b>Dobimo se:</b> ${esc(r.zbirno_mesto)}</p>` : ""}
      ${joined.length ? `<div class="joined"><span class="muted" style="background:none;padding:0">Pridružijo se:</span>${joined.map((j) => `<span>${esc(j.vzdevek)}</span>`).join("")}</div>` : ""}
      ${past ? `<p class="small muted">Ta projekcija je že mimo.</p>` : `<div class="tg-actions">
        ${rsvpForm() ? rsvpBox(s) : url ? `<a class="btn btn-small btn-mustard" href="${esc(url)}" target="_blank" rel="noopener">${ic("people")}<span>Pridem tudi jaz</span> ${ic("ext")}</a>` : ""}
        ${planBtn(s.id)}
        ${ticketLink(s)}
      </div>`}
    </div>
  </article>`;
}

function rsvpBox(s) {
  const done = rsvpLog.get(s.id);
  return `<details class="rsvp">
    <summary class="btn btn-small ${done ? "btn-soft" : "btn-mustard"}">${ic(done ? "check" : "people")}<span>${done ? `Prijava poslana: ${esc(done.name)}` : "Pridem tudi jaz"}</span></summary>
    <form class="rsvp-form" data-form="rsvp" data-sid="${s.id}" novalidate>
      <label class="rsvp-label" for="rn-${s.id}">Tvoje ime ali vzdevek</label>
      <input id="rn-${s.id}" name="name" class="input" required maxlength="40" autocomplete="nickname" value="${esc(done ? done.name : "")}">
      <label class="check"><input type="checkbox" name="publish" ${done && done.publish ? "checked" : ""}> Drugi lahko vidijo, da pridem (ime pokaževa pri tej projekciji)</label>
      <div class="btn-row">
        <button type="submit" class="btn" value="Pridem">${ic("check")}<span>Pošlji</span></button>
        ${done ? `<button type="submit" class="btn btn-ghost btn-small" value="Odjava">Ne morem priti (odjava)</button>` : ""}
      </div>
      <p class="rsvp-status small" role="status" aria-live="polite"></p>
      <p class="small muted">Prijavo vidiva samo midva. Ime pokaževa na strani le, če to označiš, in šele ko ga pregledava. E-naslova ne potrebujeva.</p>
    </form>
  </details>`;
}

function viewTogether() {
  const rows = L.skupne.filter((r) => P.screeningById.has(r.screening_id))
    .sort((a, b) => { const x = P.screeningById.get(a.screening_id), y = P.screeningById.get(b.screening_id); return (x.date + x.time).localeCompare(y.date + y.time); });
  const unknown = L.skupne.length - rows.length;
  return `
  ${banner({ c: "teal", icon: "people", kicker: "Vabljeni v kino z nama", title: "Z LuMa v kino", lede: "Natanko te projekcije bova obiskala. Če ti termin ustreza, pridi zraven in se lahko malo podružimo pred ali po filmu. Vstopnico kupi vsak sam." })}
  <div class="section">
    ${rows.length ? `<div class="together">${rows.map(tgCard).join("")}</div>` : !lumaReady ? lumaWait() : emptyBox({ title: "Skupni ogledi še niso razpisani", text: "Ko izbereva projekcije, na katere greva, bodo tukaj – z datumom, uro, dvorano in povabilom.", actions: `<a class="btn" href="#/ziherce">Ziherce</a><a class="btn btn-ghost" href="#/odkrij">Brskaj po filmih</a>`, motif: "people" })}
    ${unknown ? `<p class="small muted" style="margin-top:12px">${unknown} ${plural(unknown, "vrstica se ne ujema", "vrstici se ne ujemata", "vrstice se ne ujemajo", "vrstic se ne ujema")} z nobeno projekcijo (preveri screening_id v Sheetu ali morebitno spremembo termina).</p>` : ""}
  </div>`;
}

/* ================================================================ o strani */

function viewAbout() {
  const n = P.notes;
  return `
  ${banner({ c: "paper", icon: "eye", kicker: "Neuradni vodič LuMa film kluba", title: "O strani" })}
  <div class="prose">
    <p class="lede">LuMa × LIFFe 2026 je <b>neuradni, nepridobitni festivalski vodič LuMa film kluba</b>. Z LIFFe in Cankarjevim domom ni povezan. Za uradne informacije, nakup vstopnic in spremembe velja <a href="https://www.liffe.si/sl/">liffe.si</a>.</p>
    <h2>Od kod so podatki</h2>
    <ul>
      <li>Filmi, sekcije, trajanja in projekcije: uradni program na <a href="${esc(P.source.films)}">urnik.liffe.si</a>, uvožen ${esc(fmtStamp(P.source.imported_at))}. Vsaka projekcija je preverjena tudi v <a href="${esc(P.source.schedule)}">uradnem urniku</a>.</li>
      <li>Prikazujemo samo fizične projekcije v Ljubljani (${P.venues.map((v) => esc(v.name)).join(", ")}). Izpuščenih je ${n.excluded_screenings_outside_ljubljana} projekcij v Mariboru, Celju in Novem mestu ter spletni (VOD) program${n.excluded_films.length ? ` (${n.excluded_films.map((x) => esc(x.title_sl)).join(", ")})` : ""}.</li>
      <li>Kratki povzetki so naši, napisani po uradnih opisih; celoten opis je vedno na strani LIFFe. »Zakaj je zanimiv?« navaja le dejstva iz uradnega opisa (npr. nagrade).</li>
      <li>Povezave na IMDb in Letterboxd so potrjene prek IMDb identifikatorja (ujemanje naslova, leta in režiserja v uradnem IMDb naboru podatkov). Kjer ujemanja ni bilo mogoče potrditi, je povezava iskanje in je tako označena. Metacritic je vedno iskanje.</li>
      <li>Fotografije filmov so uradne slike LIFFe oziroma distributerjev filmov.</li>
      <li>Ocen ne prikazujemo, ker pogoji IMDb, Letterboxda in Metacritica tega ne dovolijo. »Ziherce« izbereva midva iz LuMa, tudi po ocenah, ki sva jih pregledala zase; nagrade festivalov so preverjene v uradnih opisih LIFFe in poročilih festivalov.</li>
      <li>Če se kaj ne ujema z uradnim programom, velja uradni program.</li>
    </ul>
    <h2>Zasebnost</h2>
    <ul>
      <li>Za Moj LIFFe ne potrebuješ računa. Izbire ostanejo v tvojem brskalniku (localStorage) in ne pridejo do nas.</li>
      <li>Deljena povezava vsebuje samo ID-je projekcij in filmov – nobenih imen ali e-naslovov.</li>
      <li>»Pridem tudi jaz« pošlje ime ali vzdevek v najin Google obrazec. Javno ga pokaževa le, če to izrecno označiš, in šele po ročnem pregledu. Odgovori obrazca niso javni.</li>
      <li>Pisave nalaga Google Fonts; stran ne uporablja analitike ali piškotkov za sledenje.</li>
    </ul>
    <h2>Kako uporabljati</h2>
    <ul>
      <li><b>Imam prost čas</b>: izberi dan in okno, npr. petek od 18.00 do 22.30. »Konec« je izračunan iz uradnega trajanja; uvodov, pogovorov in poti med dvoranami ne poznamo.</li>
      <li><b>Srček</b> = film te zanima. <b>Dodaj v moj LIFFe plan</b> = izbran konkreten termin. Oboje najdeš v <b>Mojem LIFFu</b>: termine v koledarju (ali kot seznam), filme brez termina pod »Zanima me«. To nista rezervaciji.</li>
      <li><b>Moj LIFFe</b> pokaže prekrivanja in pavze med filmi, prost dan, oznako »Imam vstopnico«, izvoz v Apple, Google ali Outlook koledar in deljenje s povezavo.</li>
      <li><b>Ziherce</b> so filmi z dobrimi možnostmi, da ti bodo všeč; <b>Z LuMa v kino</b> so projekcije, na katere greva midva – pridruži se.</li>
    </ul>
  </div>`;
}

function viewNotFound(title = "Te strani ni", text = "Morda je povezava zastarela.") {
  return `<h1 class="sr">${esc(title)}</h1>` + emptyBox({ title, text, actions: `<a class="btn" href="#/">Domov</a><a class="btn btn-ghost" href="#/odkrij">Vsi filmi</a>`, motif: "eye" });
}

/* ================================================================ predogled filma */

const $modal = document.getElementById("film-modal");
let modalFilm = null;
let modalPicked = null; // termin, s katerim je bil predogled odprt (ostane poudarjen)
let modalOpener = null;
let skipPop = false;
let modalPageY = 0; // položaj seznama pod predogledom
// Položaj strani ureja aplikacija sama; brskalnik naj ga ob »Nazaj« ne prestavlja.
try { history.scrollRestoration = "manual"; } catch (_) {}

function filmModalHtml(f) {
  const ss = P.screeningsByFilm.get(f.id) || [];
  const rec = lumaRec(f.id);
  const alt = [f.title_orig, f.title_en].filter(Boolean).map(esc).join(" · ");
  const info = (P.section_info || {})[f.section];
  const hasPhoto = !!(CONFIG.showPosters && f.img);
  return `
  <div class="modal-bar">
    <span class="modal-grip" aria-hidden="true"></span>
    <button type="button" class="iconbtn modal-close" data-act="closemodal" aria-label="Zapri predogled">${ic("x")}</button>
  </div>
  <div class="modal-inner">
    ${hasPhoto ? `<div class="modal-hero">${art(f, true)}</div>` : ""}
    <div class="modal-top${hasPhoto ? " solo" : ""}">
      ${hasPhoto ? "" : art(f, true)}
      <div class="modal-head">
        <p class="section-tag" title="${esc(info || "")}"><span class="dot" style="--c:${secColor(f.section)}"></span>${esc(f.section)}</p>
        <h2 id="fm-title" tabindex="-1">${esc(f.title_sl || f.title_en)}</h2>
        ${alt ? `<p class="alt-title">${alt}</p>` : ""}
        <p class="meta">${metaLine(f)}</p>
        <div class="btn-row" style="margin-top:12px">
          ${favBtn(f.id).replace('class="iconbtn fav"', 'class="iconbtn"')}
          <span class="small muted" style="align-self:center">${store.isFav(f.id) ? "Med filmi, ki te zanimajo" : "Zanima me"}</span>
        </div>
      </div>
    </div>
    ${f.summary ? `<p class="summary">${esc(f.summary)}</p>` : f.summary_status === "preveri" ? `<div class="notice">${ic("warn")}<p>Uradni opis na LIFFe je videti napačen, zato povzetka ne prikazujemo.</p></div>` : ""}
    ${f.why ? `<div class="why"><b>Zakaj je zanimiv?</b>${esc(f.why)}</div>` : ""}
    ${rec ? `<div class="luma-note"><p class="kicker">${ic("star")} LuMa priporoča ${seenTag(rec)}</p>${rec.komentar ? `<blockquote>${esc(rec.komentar)}</blockquote>` : ""}</div>` : ""}
    <p><a href="${esc(f.liffe_url)}" target="_blank" rel="noopener"><b>Preberi celoten opis na LIFFu</b> ${ic("ext")}</a></p>
    <h3 class="modal-h">Projekcije v Ljubljani</h3>
    ${ss.length ? `<div class="screens">${ss.map((s) => screenCard(s)).join("")}</div>` : `<p class="muted">Ni projekcij v Ljubljani.</p>`}
    <p class="small muted">»Dodaj v moj LIFFe plan« si termin le zapomni v tem brskalniku; vstopnico kupiš posebej.</p>
    <h3 class="modal-h">Več o filmu</h3>
    ${extLinks(f)}
    <p class="small" style="margin-top:16px"><a href="#/film/${f.id}">Odpri na svoji strani</a> <span class="muted">(za deljenje povezave)</span></p>
  </div>`;
}

function openFilm(id, opener, sid) {
  const f = P.filmById.get(id);
  if (!f) return;
  modalFilm = id;
  modalOpener = opener || document.activeElement;
  $modal.innerHTML = filmModalHtml(f);
  if (!$modal.open) {
    modalPageY = window.scrollY;
    $modal.showModal();
    document.documentElement.classList.add("modal-open");
    history.pushState({ lumaModal: id }, "", location.href); // »Nazaj« na telefonu zapre predogled
  }
  $modal.scrollTop = 0;
  modalPicked = sid || null;
  const scr = sid && $modal.querySelector(`.screen[data-sid="${sid}"]`);
  if (scr) {
    // s termina na kartici: pokaži prav ta termin in postavi fokus na »Dodaj v moj LIFFe plan«
    scr.classList.add("picked");
    requestAnimationFrame(() => scr.scrollIntoView({ block: "center" }));
    scr.querySelector('[data-act="plan"]').focus({ preventScroll: true });
  } else $modal.querySelector("#fm-title").focus({ preventScroll: true });
}

function refreshModal(btn) {
  if (!$modal.open || !modalFilm) return;
  const sel = btn && btn.dataset.id ? `[data-act="${btn.dataset.act}"][data-id="${btn.dataset.id}"]` : null;
  const y = $modal.scrollTop;
  $modal.innerHTML = filmModalHtml(P.filmById.get(modalFilm));
  if (modalPicked) $modal.querySelector(`.screen[data-sid="${modalPicked}"]`)?.classList.add("picked");
  $modal.scrollTop = y;
  if (sel) $modal.querySelector(sel)?.focus({ preventScroll: true });
}

// Zapiranje je takojšnje (gumb, Escape, ozadje, »Nazaj«); dogodek »close« je le varovalka.
function closeModal() {
  if ($modal.open) $modal.close();
  modalClosed();
}
function modalClosed() {
  if (!document.documentElement.classList.contains("modal-open")) return;
  document.documentElement.classList.remove("modal-open");
  const op = modalOpener;
  modalFilm = null;
  modalPicked = null;
  modalOpener = null;
  if (history.state && history.state.lumaModal) { skipPop = true; history.back(); }
  window.scrollTo(0, modalPageY);
  // brskalnik po zaprtju sam vrne fokus; nato ga postavimo na kartico, s katere je bil predogled odprt
  setTimeout(() => { if (op && document.contains(op)) op.focus({ preventScroll: true }); }, 0);
}
$modal.addEventListener("close", modalClosed);
$modal.addEventListener("cancel", (e) => { e.preventDefault(); closeModal(); }); // tipka Escape
// klik na zatemnjeno ozadje zapre predogled
$modal.addEventListener("click", (e) => { if (e.target === $modal) closeModal(); });
window.addEventListener("popstate", () => {
  if (skipPop) { skipPop = false; window.scrollTo(0, modalPageY); return; }
  if ($modal.open) closeModal();
});

/* ================================================================ dogodki */

function refreshDiscover() {
  const c = document.getElementById("controls");
  if (c) {
    // zložljivi filtri ostanejo odprti, če jih je obiskovalec odprl
    const open = [...c.querySelectorAll("details[data-key]")].filter((d) => d.open).map((d) => d.dataset.key);
    c.innerHTML = filterControls();
    for (const k of open) { const d = c.querySelector(`details[data-key="${k}"]`); if (d) d.open = true; }
  }
  const cc = document.getElementById("cas-controls");
  if (cc) cc.innerHTML = casControls();
  syncUrl();
  renderDiscoverResults();
}

function toggleIn(set, v) { set.has(v) ? set.delete(v) : set.add(v); }

function refreshAfterStore(btn) {
  const { parts } = parseRoute();
  const r = parts[0];
  if (r === "moj" || r === "zanima" || r === "skupaj" || r === "luma" || r === "ziherce" || r === "film" || r === "deljeno") {
    const inModal = btn && $modal.contains(btn);
    const focusSel = btn && btn.dataset.id ? `[data-act="${btn.dataset.act}"][data-id="${btn.dataset.id}"]` : null;
    render(true);
    if (focusSel && !inModal) $main.querySelector(focusSel)?.focus({ preventScroll: true });
    if (inModal) refreshModal(btn);
  } else {
    // seznami: osveži samo gumbe, da ostane fokus in položaj
    document.querySelectorAll(`[data-act="plan"]`).forEach((b) => {
      const on = store.inPlan(b.dataset.id);
      b.setAttribute("aria-pressed", on);
      b.innerHTML = `${ic(on ? "check" : "plus")}<span>${on ? "V mojem LIFFe planu" : "Dodaj v moj LIFFe plan"}</span>`;
    });
    // gumb »Termini«: oznaka »v planu« sledi spremembam
    $main.querySelectorAll('[data-act="more"][data-kind="termini"]').forEach((b) => {
      const f = P.filmById.get(b.dataset.id);
      const old = b.querySelector(".more-note");
      const nHit = old ? Number(old.dataset.hit || 0) : 0, filtered = old ? old.dataset.filtered === "1" : false;
      if (old) old.remove();
      const note = termsNote(f, nHit, filtered);
      if (note) b.querySelector("svg:last-of-type").insertAdjacentHTML("beforebegin", note.replace("<span", `<span data-hit="${nHit}" data-filtered="${filtered ? 1 : 0}"`));
    });
    // termini na karticah (obarvani, če so v koledarju)
    $main.querySelectorAll("a.term[data-sid]").forEach((t) => {
      const on = store.inPlan(t.dataset.sid);
      if (on !== t.classList.contains("planned")) {
        t.classList.toggle("planned", on);
        if (on) t.classList.remove("hit");
        t.setAttribute("aria-label", t.getAttribute("aria-label").replace(/(, v tvojem planu)? – odpri termin$/, `${on ? ", v tvojem planu" : ""} – odpri termin`));
      }
    });
    document.querySelectorAll(`[data-act="fav"]`).forEach((b) => {
      const on = store.isFav(b.dataset.id);
      b.setAttribute("aria-pressed", on);
      b.setAttribute("aria-label", on ? "Odstrani iz »Zanima me«" : "Zanima me");
      b.innerHTML = ic(on ? "heart-f" : "heart");
    });
    if ($modal.open) refreshModal(btn && $modal.contains(btn) ? btn : null);
  }
}

// po izvozu osveži oznake (po kliku, da se povezava na Google še odpre)
function afterExport(el) {
  setTimeout(() => {
    const r = parseRoute().parts[0];
    if (r === "moj" || r === "film") render(true);
    if ($modal.open) refreshModal($modal.contains(el) ? el : null);
  }, 0);
}

function updateBadge() {
  // koliko filmov je v Mojem LIFFu (s srčkom ali z izbranim terminom)
  const { fav, plan } = store.get();
  const films = new Set([...fav.filter((id) => P && P.filmById.has(id)), ...plan.filter((id) => P && P.screeningById.has(id)).map((id) => P.screeningById.get(id).film_id)]);
  const b = document.getElementById("plan-badge");
  b.hidden = !films.size;
  b.textContent = films.size;
}

async function onClick(e) {
  const fl = e.target.closest("a[data-film]");
  if (fl && e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) {
    e.preventDefault(); // ⌘/Ctrl + klik še vedno odpre film v novem zavihku
    openFilm(fl.dataset.film, fl, fl.dataset.sid);
    return;
  }
  const el = e.target.closest("[data-act]");
  if (!el || el.tagName === "SELECT" || el.tagName === "INPUT") return;
  const act = el.dataset.act;
  const id = el.dataset.id;
  switch (act) {
    case "plan": {
      e.preventDefault();
      const was = store.inPlan(id);
      store.togglePlan(id);
      const s = P.screeningById.get(id);
      const f = s && P.filmById.get(s.film_id);
      const when = s ? `${dayLong(s.date)}, ${fmtMin(startMin(s))}` : "";
      toast(was && tickets.has(id) ? `Odstranjeno iz plana (${when}). Za ta termin imaš označeno vstopnico.` : was ? (exported.get(id) ? `Odstranjeno iz plana (${when}). Termin je bil izvožen – izbriši ga še v Google/Apple koledarju.` : `Odstranjeno iz plana: ${when}`) : `Dodano v moj LIFFe plan: ${f ? f.title_sl : ""}, ${when} (vstopnico kupiš posebej)`);
      refreshAfterStore(el);
      break;
    }
    case "fav": {
      e.preventDefault();
      const was = store.isFav(id);
      store.toggleFav(id);
      toast(was ? "Odstranjeno iz »Zanima me«" : "Shranjeno v Moj LIFFe ♡");
      refreshAfterStore(el);
      break;
    }
    case "back":
      if (navCount > 1) { e.preventDefault(); history.back(); }
      break;
    case "sec": toggleIn(D.sec, el.dataset.val); refreshDiscover(); break;
    case "view": D.view = el.dataset.val; syncUrl(); renderDiscoverResults(); break;
    case "more": {
      const panel = document.getElementById(el.getAttribute("aria-controls"));
      const on = !panel.classList.contains("open");
      panel.classList.toggle("open", on);
      el.setAttribute("aria-expanded", String(on));
      const set = openMore[el.dataset.kind];
      if (on) set.add(id); else set.delete(id);
      break;
    }
    case "secinfo": {
      secInfoOpen = !secInfoOpen;
      const box = document.getElementById("secinfo");
      if (box) box.hidden = !secInfoOpen;
      el.setAttribute("aria-expanded", String(secInfoOpen));
      break;
    }
    case "day": toggleIn(D.d, el.dataset.val); refreshDiscover(); break;
    case "venue": toggleIn(D.v, el.dataset.val); refreshDiscover(); break;
    case "preset": D.od = el.dataset.od; D.do = el.dataset.do; refreshDiscover(); break;
    case "late-on": D.late = true; refreshDiscover(); break;
    case "widen": D.od = ""; D.do = ""; refreshDiscover(); break;
    case "alldays": D.d.clear(); refreshDiscover(); break;
    case "unset": {
      const k = el.dataset.key, v = el.dataset.val;
      if (k === "sek") D.sec.delete(v);
      if (k === "d") D.d.delete(v);
      if (k === "v") D.v.delete(v);
      if (k === "time") { D.od = ""; D.do = ""; }
      refreshDiscover();
      break;
    }
    case "clear": {
      D.sec.clear(); D.d.clear(); D.v.clear(); D.od = ""; D.do = ""; D.q = "";
      const q = document.getElementById("q"); if (q) q.value = "";
      refreshDiscover();
      break;
    }
    case "ics1": downloadIcs([id], P, `liffe-${id}.ics`); exported.mark([id], "ics"); toast("Datoteka je prenesena – odpri jo, da se termin doda v koledar"); afterExport(el); break;
    case "gcal": exported.mark([id], "google"); afterExport(el); break; // povezava se odpre sama
    case "icsall":
    case "icsnew": {
      let ids = store.get().plan.filter((x) => P.screeningById.has(x));
      if (act === "icsnew") ids = ids.filter((x) => !exported.get(x));
      downloadIcs(ids, P);
      exported.mark(ids, "ics");
      toast(`${ids.length} ${plural(ids.length, "termin je izvožen", "termina sta izvožena", "termini so izvoženi", "terminov je izvoženih")} – odpri datoteko s koledarjem`);
      afterExport(el);
      break;
    }
    case "share": {
      const { fav, plan } = store.get();
      const url = shareUrl(fav.filter((x) => P.filmById.has(x)), plan.filter((x) => P.screeningById.has(x)));
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        try { await navigator.share({ title: "Moj LIFFe 2026", text: "Moj plan za LIFFe 2026", url }); return; } catch (_) { /* preklic */ }
      }
      const out = document.getElementById("share-out");
      out.innerHTML = `<div class="share-box"><label class="sr" for="share-url">Povezava za deljenje</label><input id="share-url" class="input" readonly value="${esc(url)}"><button type="button" class="btn btn-small" data-act="copy">Kopiraj</button></div><p class="small muted" style="margin-top:6px">Povezava vsebuje le ID-je izbranih projekcij in filmov. Prejemnik jih lahko doda k svojim izbiram.</p>`;
      const inp = document.getElementById("share-url"); inp.focus(); inp.select();
      try { await navigator.clipboard.writeText(url); toast("Povezava je kopirana"); } catch (_) {}
      break;
    }
    case "copy": {
      const inp = document.getElementById("share-url");
      try { await navigator.clipboard.writeText(inp.value); toast("Povezava je kopirana"); } catch (_) { inp.select(); document.execCommand && document.execCommand("copy"); toast("Povezava je kopirana"); }
      break;
    }
    case "wipeplan":
      if (confirm("Odstranim vse termine iz plana? Filmi pod »Zanima me« ostanejo. Dogodkov, ki so že v tvojem Google/Apple koledarju, to ne izbriše.")) { store.clearPlan(); exported.clear(); tickets.clear(); toast("Plan je počiščen"); render(); }
      break;
    case "wipefav":
      if (confirm("Odstranim vse filme s seznama »Zanima me«? Termini v planu ostanejo.")) { store.clearFav(); toast("Seznam je počiščen"); render(); }
      break;
    case "dropmissing": {
      const keep = store.get().plan.filter((x) => P.screeningById.has(x));
      store.get().plan.filter((x) => !P.screeningById.has(x)).forEach((x) => store.togglePlan(x));
      toast(`V planu ostane ${keep.length} terminov`);
      render();
      break;
    }
    case "swapopen": {
      const list = document.getElementById(el.getAttribute("aria-controls"));
      const open = list.hidden;
      list.hidden = !open;
      el.setAttribute("aria-expanded", String(open));
      if (open) list.querySelector("button")?.focus();
      break;
    }
    case "ticket": {
      const on = tickets.toggle(id);
      toast(on ? "Označeno: vstopnico imaš" : "Oznaka vstopnice je odstranjena");
      refreshAfterStore(el);
      break;
    }
    case "closemodal": closeModal(); break;
    case "toresults": document.getElementById("results")?.scrollIntoView({ block: "start" }); break;
    case "copyid":
      try { await navigator.clipboard.writeText(el.dataset.val); toast(`Kopirano: ${el.dataset.val}`); } catch (_) { toast(el.dataset.val); }
      break;
    case "editoroff": setEditor(false); history.replaceState(null, "", location.hash.replace(/[?&]urednik(=[^&]*)?/, "")); render(); break;
    case "swap": store.swap(el.dataset.from, el.dataset.to); toast(tickets.has(el.dataset.from) ? "Termin zamenjan. Za stari termin imaš vstopnico – preveri, ali jo lahko zamenjaš." : exported.get(el.dataset.from) ? "Termin zamenjan. Starega izbriši še v Google/Apple koledarju in izvozi novega." : "Termin zamenjan"); render(); break;
    case "mergeshared": {
      const plan = el.dataset.plan ? el.dataset.plan.split(",") : [];
      const fav = el.dataset.fav ? el.dataset.fav.split(",") : [];
      const newP = plan.filter((x) => !store.inPlan(x)).length;
      const newF = fav.filter((x) => !store.isFav(x)).length;
      if (!newP && !newF) { toast("Vse to že imaš v svojem LIFFu"); break; }
      if (confirm(`Dodam ${newP} ${plural(newP, "termin", "termina", "termine", "terminov")} in ${newF} ${plural(newF, "film", "filma", "filme", "filmov")} k tvojim izbiram? Obstoječe izbire ostanejo.`)) {
        store.merge(fav, plan);
        toast("Dodano v Moj LIFFe");
        location.hash = "#/moj";
      }
      break;
    }
  }
}
$main.addEventListener("click", onClick);
// meni »Dodaj v koledar« se zapre ob kliku drugam (ali ob Escape)
document.addEventListener("click", (e) => { document.querySelectorAll(".cal-menu[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; }); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") document.querySelectorAll(".cal-menu[open]").forEach((d) => { d.open = false; d.querySelector("summary").focus(); }); });
$modal.addEventListener("click", onClick);

$main.addEventListener("submit", async (e) => {
  const form = e.target.closest('form[data-form="rsvp"]');
  if (!form) return;
  e.preventDefault();
  const sid = form.dataset.sid;
  const status = form.querySelector(".rsvp-status");
  const input = form.querySelector('input[name="name"]');
  const name = input.value.trim().replace(/\s+/g, " ").slice(0, 40);
  const action = (e.submitter && e.submitter.value) || "Pridem";
  if (!name) { status.textContent = "Vpiši ime ali vzdevek."; input.focus(); return; }
  const publish = form.querySelector('input[name="publish"]').checked;
  const buttons = form.querySelectorAll("button");
  buttons.forEach((b) => (b.disabled = true));
  status.textContent = "Pošiljam …";
  try {
    const val = rsvpForm().values;
    await sendRsvp({ screening: sid, name, publish: publish ? val.yes : val.no, action: action === "Odjava" ? val.cancel : val.come });
    if (action === "Odjava") {
      rsvpLog.set(sid, null);
      toast("Odjava je poslana");
    } else {
      rsvpLog.set(sid, { name, publish, at: new Date().toISOString() });
      toast(`Hvala, ${name}! Se vidimo v kinu.`);
      if (!store.inPlan(sid)) store.togglePlan(sid);
    }
    render(true);
  } catch (err) {
    console.warn("Prijava ni bila poslana:", err);
    status.textContent = "Pošiljanje ni uspelo. Preveri povezavo in poskusi znova.";
    buttons.forEach((b) => (b.disabled = false));
  }
});

$main.addEventListener("input", (e) => {
  if (e.target.id === "q") {
    clearTimeout(refreshDiscover._t);
    refreshDiscover._t = setTimeout(() => { D.q = e.target.value.trim(); refreshDiscover(); }, 140);
  }
});

$main.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.act === "time") { D[t.id] = t.value; refreshDiscover(); }
  if (t.dataset.act === "sort") { D.sort = t.value; syncUrl(); renderDiscoverResults(); }
  if (t.dataset.act === "late") { D.late = t.checked; syncUrl(); renderDiscoverResults(); }
  if (t.dataset.act === "tlfav") { history.replaceState(null, "", `#/moj${t.checked ? "?zanima=1" : ""}`); render(true); }
});

// Povabilo v LuMa film klub: pokaže se le, ko je v config.js vpisan Instagram profil.
function showClub() {
  const h = (CONFIG.club && CONFIG.club.instagram || "").replace(/^@/, "").trim();
  if (!h) return;
  const a = document.getElementById("club-link");
  a.href = `https://www.instagram.com/${encodeURIComponent(h)}/`;
  a.textContent = `@${h}`;
  a.setAttribute("aria-label", `@${h} na Instagramu (odpre se v novem zavihku)`);
  document.getElementById("club").hidden = false;
}

/* ================================================================ zagon */

async function boot() {
  store.init();
  try {
    P = await loadProgram();
  } catch (err) {
    $main.innerHTML = emptyBox({ title: "Programa ni bilo mogoče naložiti", text: "Preveri povezavo in osveži stran. Uradni urnik je vedno na urnik.liffe.si.", actions: `<a class="btn" href="https://urnik.liffe.si/urnik.aspx">Uradni urnik</a>` });
    console.error(err);
    return;
  }
  document.getElementById("data-stamp").innerHTML =
    `Podatki preverjeni z uradnim programom: <b>${esc(fmtStamp(P.source.imported_at))}</b> · zadnja sprememba programa: ${esc(fmtStamp(P.source.changed_at || P.source.imported_at))} · vir: <a href="${esc(P.source.schedule)}">urnik.liffe.si</a> · fotografije: LIFFe`;
  showClub();
  store.onChange(updateBadge);
  store.onExternalChange(() => render(true)); // plan, spremenjen v drugem zavihku (osveži tudi predogled)
  updateBadge();
  try { const h = sessionStorage.getItem("luma-odkrij"); if (h && h.startsWith("#/odkrij")) rememberDiscover(h); } catch (_) {}
  render();
  window.addEventListener("hashchange", render);
  // LuMa podatki pridejo naknadno: najprej posnetek s strežnika strani, nato sveže iz Sheeta.
  const same = (a, b) => ["priporocila", "skupne", "pridruzeni", "ziherce"].every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
  const live = await loadLuma((snap) => { L = snap; lumaReady = true; render(true); });
  if (!same(live, L)) { L = live; render(true); }
}

boot();
