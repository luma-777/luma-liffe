// Nastavitve strani. To je edina datoteka, ki jo je treba urediti ob objavi.
export const CONFIG = {
  // Uradne slike filmov z liffe.si. Izklopljeno, dokler LIFFe ne potrdi,
  // da jih smemo uporabljati; stran ima tipografske nadomestke.
  showPosters: false,

  // LuMa uredniški Google Sheet (samo neobčutljivi podatki).
  // sheetId = del povezave med /d/ in /edit. Sheet mora biti deljen kot
  // »Kdor koli s povezavo: ogledovalec«. Prazno = stran bere samo data/luma.json.
  luma: {
    sheetId: "15VJlwoEo1KPfKAyiwHojf7GvGDcZEVlBYMMTJHgPOi8",
    tabs: {
      priporocila: "luma_priporocila",
      skupne: "luma_skupne_projekcije",
      pridruzeni: "luma_potrjeni_pridruzeni",
    },
  },

  // Neobvezno: Google Form za »Pridem tudi jaz«. Če je nastavljen, gumb
  // samodejno predizpolni ID projekcije. Povezava v stolpcu prijava_url
  // v Sheetu ima prednost.
  //   formUrl:        https://docs.google.com/forms/d/e/…/viewform
  //   screeningEntry: entry.123456789  (polje »ID projekcije«)
  rsvp: { formUrl: "", screeningEntry: "" },

  // Kontakt za odjavo/izbris vzdevka (prikazan pri prijavah).
  contactEmail: "",
};
