// Nastavitve strani. To je edina datoteka, ki jo je treba urediti ob objavi.
export const CONFIG = {
  // Uradne slike filmov z liffe.si. Izklopljeno, dokler LIFFe ne potrdi,
  // da jih smemo uporabljati; stran ima tipografske nadomestke.
  showPosters: false,

  // LuMa uredniški Google Sheet (samo neobčutljivi podatki). Dve možnosti:
  //  A) priporočeno – Sheet ostane zaseben, zavihki so »Objavljeni v splet« kot CSV:
  //     v csv vpiši tri povezave (Datoteka → Deli → Objavi v splet → zavihek → CSV).
  //  B) sheetId (del povezave med /d/ in /edit), Sheet deljen kot
  //     »Kdor koli s povezavo: ogledovalec«.
  // csv ima prednost. Vse prazno = stran bere samo data/luma.json.
  luma: {
    csv: {
      priporocila: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTiu_vyDoPj_2cpXRphRlZDGbcmfZ0mR7OnMFrfCVVtKO5kthiL9UM7r_hBdomeKVjtpEdb08pedqI8/pub?gid=1939340657&single=true&output=csv",
      skupne: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTiu_vyDoPj_2cpXRphRlZDGbcmfZ0mR7OnMFrfCVVtKO5kthiL9UM7r_hBdomeKVjtpEdb08pedqI8/pub?gid=450507378&single=true&output=csv",
      pridruzeni: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTiu_vyDoPj_2cpXRphRlZDGbcmfZ0mR7OnMFrfCVVtKO5kthiL9UM7r_hBdomeKVjtpEdb08pedqI8/pub?gid=775650030&single=true&output=csv",
      ziherce: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTiu_vyDoPj_2cpXRphRlZDGbcmfZ0mR7OnMFrfCVVtKO5kthiL9UM7r_hBdomeKVjtpEdb08pedqI8/pub?gid=515001&single=true&output=csv",
    },
    sheetId: "",
    tabs: {
      priporocila: "luma_priporocila",
      skupne: "luma_skupne_projekcije",
      pridruzeni: "luma_potrjeni_pridruzeni",
      ziherce: "luma_ziherce",
    },
  },

  // »Pridem tudi jaz«: obrazec na strani pošlje prijavo v Google obrazec LuMa
  // (odgovori ostanejo zasebni). Dokler polja niso izpolnjena, obrazca na strani ni.
  //   formUrl: https://docs.google.com/forms/d/e/…/viewform
  //   entries: številke polj iz »Vnaprejšnje izpolnjevanje obrazca« (entry.123…)
  //   values:  odgovori pri izbirnih vprašanjih, natanko kot so zapisani v obrazcu
  rsvp: {
    formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSc7x3zGuYuoGZuBBUMl_CxhWFhDoPWhFptjwQzi4Q1e35Km6g/viewform",
    entries: {
      screening: "entry.1791748099", // Projekcija
      name: "entry.1355861651", // Ime
      publish: "entry.1822844989", // Želiš, da drugi vedo, da prideš
      action: "entry.1455908761", // Pridem ali odjava
    },
    values: { yes: "Da", no: "Ne", come: "Pridem", cancel: "Odjavljam udeležbo :(" },
  },

  // Kontakt za odjavo/izbris vzdevka (prikazan pri prijavah).
  contactEmail: "",
};
