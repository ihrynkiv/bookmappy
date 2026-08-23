/**
 * Authors frequently carry a `country of citizenship` (P27) that no longer exists,
 * so it has no ISO code and cannot be painted on a present-day map.
 *
 * `successor` is the modern country we attribute the author to.
 * `preferBirthplace` marks states whose territory split across several modern
 * countries — for those, resolving the author's place of birth (P19) gives a far
 * better answer than the successor, which is only a last resort. Kafka is
 * "Czechoslovakia", but he was born in Prague, so he belongs to CZ not SK.
 */
export type HistoricalState = { successor: string; preferBirthplace: boolean };

export const HISTORICAL_STATES: Record<string, HistoricalState> = {
  Q15180: { successor: "RU", preferBirthplace: true }, // Soviet Union
  Q34266: { successor: "RU", preferBirthplace: true }, // Russian Empire
  Q28513: { successor: "AT", preferBirthplace: true }, // Austria-Hungary
  Q131964: { successor: "AT", preferBirthplace: true }, // Austrian Empire
  Q533534: { successor: "AT", preferBirthplace: true }, // Cisleithania
  Q33946: { successor: "CZ", preferBirthplace: true }, // Czechoslovakia
  Q42585: { successor: "CZ", preferBirthplace: true }, // Kingdom of Bohemia
  Q36704: { successor: "RS", preferBirthplace: true }, // Yugoslavia
  Q83286: { successor: "RS", preferBirthplace: true }, // SFR Yugoslavia
  Q12560: { successor: "TR", preferBirthplace: true }, // Ottoman Empire
  Q80702: { successor: "ES", preferBirthplace: true }, // Spanish Empire
  Q193714: { successor: "IL", preferBirthplace: true }, // Mandatory Palestine
  Q174193: { successor: "GB", preferBirthplace: true }, // UK of GB and Ireland
  Q27306: { successor: "DE", preferBirthplace: true }, // Kingdom of Prussia
  Q170174: { successor: "IT", preferBirthplace: true }, // Papal States

  // Unambiguous successors — the territory maps cleanly onto one modern country.
  Q7318: { successor: "DE", preferBirthplace: false }, // Nazi Germany
  Q41304: { successor: "DE", preferBirthplace: false }, // Weimar Republic
  Q16957: { successor: "DE", preferBirthplace: false }, // East Germany
  Q713750: { successor: "DE", preferBirthplace: false }, // West Germany
  Q2415901: { successor: "DE", preferBirthplace: false }, // Allied-occupied Germany
  Q161885: { successor: "GB", preferBirthplace: false }, // Kingdom of Great Britain
  Q172579: { successor: "IT", preferBirthplace: false }, // Kingdom of Italy
  Q207272: { successor: "PL", preferBirthplace: false }, // Second Polish Republic
  Q29999: { successor: "NL", preferBirthplace: false }, // Kingdom of the Netherlands

  // Antiquity and early-modern states. Authors from these periods have no
  // ISO-coded citizenship at all, so without these entries they never reach the
  // map. Empires that spanned many modern countries prefer birthplace.
  Q11772: { successor: "GR", preferBirthplace: true }, // Ancient Greece
  Q844930: { successor: "GR", preferBirthplace: false }, // Classical Athens
  Q1568260: { successor: "GR", preferBirthplace: true }, // Ionian League
  Q1747689: { successor: "IT", preferBirthplace: true }, // Ancient Rome
  Q17167: { successor: "IT", preferBirthplace: true }, // Roman Republic
  Q2277: { successor: "IT", preferBirthplace: true }, // Roman Empire
  Q4948: { successor: "IT", preferBirthplace: false }, // Republic of Venice
  Q148540: { successor: "IT", preferBirthplace: false }, // Republic of Florence
  Q12544: { successor: "TR", preferBirthplace: true }, // Byzantine Empire
  Q11768: { successor: "EG", preferBirthplace: false }, // Ancient Egypt
  Q389688: { successor: "IR", preferBirthplace: true }, // Achaemenid Empire
  Q70972: { successor: "FR", preferBirthplace: false }, // Kingdom of France
  Q71084: { successor: "FR", preferBirthplace: false }, // First French Empire
  Q179876: { successor: "GB", preferBirthplace: false }, // Kingdom of England
  Q129286: { successor: "IN", preferBirthplace: true }, // British Raj
  Q153136: { successor: "AT", preferBirthplace: true }, // Habsburg monarchy
  Q172107: { successor: "PL", preferBirthplace: true }, // Polish-Lithuanian Commonwealth
  Q191077: { successor: "RS", preferBirthplace: true }, // Kingdom of Yugoslavia
  Q8733: { successor: "CN", preferBirthplace: true }, // Qing dynasty
  Q29520: { successor: "CN", preferBirthplace: true }, // China (historical)
  Q13426199: { successor: "TW", preferBirthplace: true }, // Republic of China
  Q912068: { successor: "CN", preferBirthplace: false }, // Wu (ancient state)
  Q837855: { successor: "CN", preferBirthplace: false }, // Qi (ancient state)
};
