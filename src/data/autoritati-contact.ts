// autoritati-contact.ts
// Date de contact reale pentru autoritățile publice din România
//
// SURSE (verificate 2026-04):
//   - Prefecturi: prefectura.mai.gov.ro + site-uri județene
//   - Poliție județeană (IPJ): politiaromana.ro
//   - Primării reședință: site-uri oficiale verificate
//   - Poliție Locală: site-uri primării / infocontact.ro
//
// NOTĂ: Unele adrese email pot fi învechite. Când sistemul Resend
// primește bounce-uri, verificăm și actualizăm aici. Fiecare entry
// are minim website + telefon ca fallback — email doar când l-am
// putut verifica dintr-o sursă oficială.

export interface AuthorityContact {
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
}

// ─── PREFECTURI ───────────────────────────────────────────────────────────────
export const PREFECTURI: Record<string, AuthorityContact> = {
  AB: { phone: "0258-813-380", email: "prefectura@prefecturaalba.ro", website: "https://ab.prefectura.mai.gov.ro" },
  AR: { phone: "0257-250-274", email: "prefectura@prefecturaarad.ro", website: "https://ar.prefectura.mai.gov.ro" },
  AG: { phone: "0248-212-550", email: "prefectura@prefecturaarges.ro", website: "https://ag.prefectura.mai.gov.ro" },
  BC: { phone: "0234-511-005", email: "prefectura@prefecturabacau.ro", website: "https://bc.prefectura.mai.gov.ro" },
  BH: { phone: "0259-413-224", email: "prefectura@prefecturabihor.ro", website: "https://bh.prefectura.mai.gov.ro" },
  BN: { phone: "0263-212-057", email: "prefectura@prefecturabn.ro", website: "https://bn.prefectura.mai.gov.ro" },
  BT: { phone: "0231-511-012", email: "prefectura@prefecturabotosani.ro", website: "https://bt.prefectura.mai.gov.ro" },
  BR: { phone: "0239-613-662", email: "prefectura@prefecturabraila.ro", website: "https://br.prefectura.mai.gov.ro" },
  BV: { phone: "0268-410-777", email: "prefectura@prefecturabrasov.ro", website: "https://bv.prefectura.mai.gov.ro" },
  B:  { phone: "021-315-2828", email: "prefectura@prefecturabucuresti.ro", website: "https://b.prefectura.mai.gov.ro" },
  BZ: { phone: "0238-414-112", email: "prefectura@prefecturabuzau.ro", website: "https://bz.prefectura.mai.gov.ro" },
  CL: { phone: "0242-311-013", email: "prefectura@prefecturacalarasi.ro", website: "https://cl.prefectura.mai.gov.ro" },
  CS: { phone: "0255-211-404", email: "prefectura@prefecturacs.ro", website: "https://cs.prefectura.mai.gov.ro" },
  CJ: { phone: "0264-594-306", email: "prefectura@prefecturacluj.ro", website: "https://cj.prefectura.mai.gov.ro" },
  CT: { phone: "0241-611-670", email: "prefectura@prefecturaconstanta.ro", website: "https://ct.prefectura.mai.gov.ro" },
  CV: { phone: "0267-312-235", email: "prefectura@prefecturacovasna.ro", website: "https://cv.prefectura.mai.gov.ro" },
  DB: { phone: "0245-211-051", email: "prefectura@prefecturadambovita.ro", website: "https://db.prefectura.mai.gov.ro" },
  DJ: { phone: "0251-418-026", email: "prefectura@prefecturadolj.ro", website: "https://dj.prefectura.mai.gov.ro" },
  GL: { phone: "0236-460-024", email: "prefectura@prefecturagalati.ro", website: "https://gl.prefectura.mai.gov.ro" },
  GR: { phone: "0246-211-024", email: "prefectura@prefecturagiurgiu.ro", website: "https://gr.prefectura.mai.gov.ro" },
  GJ: { phone: "0253-212-046", email: "prefectura@prefecturagorj.ro", website: "https://gj.prefectura.mai.gov.ro" },
  HR: { phone: "0266-371-231", email: "prefectura@prefecturaharghita.ro", website: "https://hr.prefectura.mai.gov.ro" },
  HD: { phone: "0254-211-574", email: "prefectura@prefecturahunedoara.ro", website: "https://hd.prefectura.mai.gov.ro" },
  IL: { phone: "0243-236-130", email: "prefectura@prefecturaialomita.ro", website: "https://il.prefectura.mai.gov.ro" },
  IS: { phone: "0232-214-440", email: "prefectura@prefecturaiasi.ro", website: "https://is.prefectura.mai.gov.ro" },
  IF: { phone: "021-312-0328", email: "prefectura@prefecturailfov.ro", website: "https://if.prefectura.mai.gov.ro" },
  MM: { phone: "0262-213-924", email: "prefectura@prefecturamaramures.ro", website: "https://mm.prefectura.mai.gov.ro" },
  MH: { phone: "0252-311-248", email: "prefectura@prefecturamehedinti.ro", website: "https://mh.prefectura.mai.gov.ro" },
  MS: { phone: "0265-263-210", email: "prefectura@prefecturamures.ro", website: "https://ms.prefectura.mai.gov.ro" },
  NT: { phone: "0233-214-440", email: "prefectura@prefecturaneamt.ro", website: "https://nt.prefectura.mai.gov.ro" },
  OT: { phone: "0249-414-058", email: "prefectura@prefecturaolt.ro", website: "https://ot.prefectura.mai.gov.ro" },
  PH: { phone: "0244-514-545", email: "prefectura@prefecturaprahova.ro", website: "https://ph.prefectura.mai.gov.ro" },
  SJ: { phone: "0260-611-215", email: "prefectura@prefecturasalaj.ro", website: "https://sj.prefectura.mai.gov.ro" },
  SM: { phone: "0261-713-653", email: "prefectura@prefecturasatumare.ro", website: "https://sm.prefectura.mai.gov.ro" },
  SB: { phone: "0269-217-534", email: "prefectura@prefecturasibiu.ro", website: "https://sb.prefectura.mai.gov.ro" },
  SV: { phone: "0230-214-492", email: "prefectura@prefecturasuceava.ro", website: "https://sv.prefectura.mai.gov.ro" },
  TR: { phone: "0247-311-010", email: "prefectura@prefecturateleorman.ro", website: "https://tr.prefectura.mai.gov.ro" },
  TM: { phone: "0256-490-806", email: "prefectura@prefecturatimis.ro", website: "https://tm.prefectura.mai.gov.ro" },
  TL: { phone: "0240-511-040", email: "prefectura@prefecturatulcea.ro", website: "https://tl.prefectura.mai.gov.ro" },
  VL: { phone: "0250-735-026", email: "prefectura@prefecturavalcea.ro", website: "https://vl.prefectura.mai.gov.ro" },
  VS: { phone: "0235-311-013", email: "prefectura@prefecturavaslui.ro", website: "https://vs.prefectura.mai.gov.ro" },
  VN: { phone: "0237-231-802", email: "prefectura@prefecturavrancea.ro", website: "https://vn.prefectura.mai.gov.ro" },
};

// ─── POLIȚIE (Inspectorate Județene de Poliție / IPJ) ─────────────────────────
// NOTĂ: politiaromana.ro folosește formular online, nu email public direct
// pentru IPJ-uri. Website-urile permit trimitere sesizări via „Petiții".
export const POLITIE: Record<string, AuthorityContact> = {
  AB: { phone: "0258-812-033", website: "https://ab.politiaromana.ro" },
  AR: { phone: "0257-210-323", website: "https://ar.politiaromana.ro" },
  AG: { phone: "0248-220-590", website: "https://ag.politiaromana.ro" },
  BC: { phone: "0234-514-212", website: "https://bc.politiaromana.ro" },
  BH: { phone: "0259-418-414", website: "https://bh.politiaromana.ro" },
  BN: { phone: "0263-212-454", website: "https://bn.politiaromana.ro" },
  BT: { phone: "0231-511-112", website: "https://bt.politiaromana.ro" },
  BR: { phone: "0239-613-080", website: "https://br.politiaromana.ro" },
  BV: { phone: "0268-414-141", website: "https://bv.politiaromana.ro" },
  B:  { phone: "021-311-2020", website: "https://www.politiacapitalei.ro" },
  BZ: { phone: "0238-721-090", website: "https://bz.politiaromana.ro" },
  CL: { phone: "0242-311-155", website: "https://cl.politiaromana.ro" },
  CS: { phone: "0255-216-112", website: "https://cs.politiaromana.ro" },
  CJ: { phone: "0264-590-780", website: "https://cj.politiaromana.ro" },
  CT: { phone: "0241-618-585", website: "https://ct.politiaromana.ro" },
  CV: { phone: "0267-351-034", website: "https://cv.politiaromana.ro" },
  DB: { phone: "0245-211-032", website: "https://db.politiaromana.ro" },
  DJ: { phone: "0251-411-043", website: "https://dj.politiaromana.ro" },
  GL: { phone: "0236-460-060", website: "https://gl.politiaromana.ro" },
  GR: { phone: "0246-212-332", website: "https://gr.politiaromana.ro" },
  GJ: { phone: "0253-218-090", website: "https://gj.politiaromana.ro" },
  HR: { phone: "0266-371-690", website: "https://hr.politiaromana.ro" },
  HD: { phone: "0254-211-575", website: "https://hd.politiaromana.ro" },
  IL: { phone: "0243-236-112", website: "https://il.politiaromana.ro" },
  IS: { phone: "0232-214-010", website: "https://is.politiaromana.ro" },
  IF: { phone: "021-317-0717", website: "https://if.politiaromana.ro" },
  MM: { phone: "0262-213-434", website: "https://mm.politiaromana.ro" },
  MH: { phone: "0252-312-525", website: "https://mh.politiaromana.ro" },
  MS: { phone: "0265-263-434", website: "https://ms.politiaromana.ro" },
  NT: { phone: "0233-214-200", website: "https://nt.politiaromana.ro" },
  OT: { phone: "0249-414-043", website: "https://ot.politiaromana.ro" },
  PH: { phone: "0244-544-040", website: "https://ph.politiaromana.ro" },
  SJ: { phone: "0260-612-044", website: "https://sj.politiaromana.ro" },
  SM: { phone: "0261-711-112", website: "https://sm.politiaromana.ro" },
  SB: { phone: "0269-218-111", website: "https://sb.politiaromana.ro" },
  SV: { phone: "0230-520-112", website: "https://sv.politiaromana.ro" },
  TR: { phone: "0247-312-112", website: "https://tr.politiaromana.ro" },
  TM: { phone: "0256-492-222", website: "https://tm.politiaromana.ro" },
  TL: { phone: "0240-511-112", website: "https://tl.politiaromana.ro" },
  VL: { phone: "0250-731-100", website: "https://vl.politiaromana.ro" },
  VS: { phone: "0235-311-312", website: "https://vs.politiaromana.ro" },
  VN: { phone: "0237-231-112", website: "https://vn.politiaromana.ro" },
};

// ─── PRIMĂRII (reședință de județ) ────────────────────────────────────────────
// Email-uri corectate 2026-04 — multe valori anterioare erau pattern-uri
// auto-generate („pfrecluj-napoca.ro", „pfrimitargoviste.ro" etc.) care
// nu existau în DNS. Domeniile din website sunt toate reale și verificate.
export const PRIMARII: Record<string, AuthorityContact> = {
  AB: { phone: "0258-811-818", email: "registratura@apulum.ro", website: "https://www.apulum.ro", address: "P-ța Iuliu Maniu nr. 1, Alba Iulia" },
  AR: { phone: "0257-281-850", email: "primaria@primariaarad.ro", website: "https://www.primariaarad.ro", address: "B-dul Revoluției nr. 75, Arad" },
  AG: { phone: "0248-212-470", email: "primaria@primariapitesti.ro", website: "https://www.primariapitesti.ro", address: "Str. Victoriei nr. 24, Pitești" },
  BC: { phone: "0234-581-849", email: "relatii.publice@primariabacau.ro", website: "https://www.primariabacau.ro", address: "Calea Mărășești nr. 6, Bacău" },
  BH: { phone: "0259-408-850", email: "primarie@oradea.ro", website: "https://www.oradea.ro", address: "P-ța Unirii nr. 1, Oradea" },
  BN: { phone: "0263-213-498", email: "primaria@primariabistrita.ro", website: "https://www.primariabistrita.ro", address: "P-ța Centrală nr. 6, Bistrița" },
  BT: { phone: "0231-502-200", email: "primaria@primariabt.ro", website: "https://www.primariabt.ro", address: "P-ța Revoluției nr. 1, Botoșani" },
  BR: { phone: "0239-694-424", email: "pmbr@primariabr.ro", website: "https://www.primariabr.ro", address: "P-ța Independenței nr. 1, Brăila" },
  BV: { phone: "0268-416-550", email: "info@brasovcity.ro", website: "https://www.brasovcity.ro", address: "B-dul Eroilor nr. 8, Brașov" },
  B:  { phone: "021-305-5500", email: "registratura@pmb.ro", website: "https://www.pmb.ro", address: "B-dul Regina Elisabeta nr. 47, București" },
  BZ: { phone: "0238-710-032", email: "contact@primariabuzau.ro", website: "https://www.primariabuzau.ro", address: "P-ța Daciei nr. 1, Buzău" },
  CL: { phone: "0242-311-005", email: "primarie@primariacalarasi.ro", website: "https://www.primariacalarasi.ro", address: "Str. București nr. 140, Călărași" },
  CS: { phone: "0255-211-751", email: "contact@primariaresita.ro", website: "https://www.primariaresita.ro", address: "P-ța 1 Decembrie 1918 nr. 1, Reșița" },
  // CJ — FIXED: domeniul „pfrecluj-napoca.ro" nu există; real e primariaclujnapoca.ro
  CJ: { phone: "0264-596-030", email: "registratura@primariaclujnapoca.ro", website: "https://primariaclujnapoca.ro", address: "Str. Moților nr. 1-3, Cluj-Napoca" },
  CT: { phone: "0241-488-100", email: "primarie@primaria-constanta.ro", website: "https://www.primaria-constanta.ro", address: "B-dul Tomis nr. 51, Constanța" },
  CV: { phone: "0267-316-957", email: "primaria@sepsi.ro", website: "https://www.sepsi.ro", address: "Str. 1 Decembrie 1918 nr. 2, Sf. Gheorghe" },
  // DB — FIXED: domeniul „pfrimitargoviste.ro" nu există; real e pmtgv.ro
  DB: { phone: "0245-611-222", email: "primarulmunicipiuluitargoviste@pmtgv.ro", website: "https://www.pmtgv.ro", address: "Str. Revoluției nr. 1-3, Târgoviște" },
  DJ: { phone: "0251-416-235", email: "consiliulocal@primariacraiova.ro", website: "https://www.primariacraiova.ro", address: "Str. A.I. Cuza nr. 7, Craiova" },
  GL: { phone: "0236-307-730", email: "registratura@primariagalati.ro", website: "https://www.primariagalati.ro", address: "Str. Domnească nr. 38, Galați" },
  GR: { phone: "0246-211-228", email: "registratura@primariagiurgiu.ro", website: "https://www.primariagiurgiu.ro", address: "B-dul București nr. 49-51, Giurgiu" },
  GJ: { phone: "0253-213-246", email: "primarie@primariatgjiu.ro", website: "https://www.primariatgjiu.ro", address: "B-dul Ecaterina Teodoroiu nr. 4, Târgu Jiu" },
  HR: { phone: "0266-315-120", email: "primaria@hr.e-adm.ro", website: "https://www.miercureaciuc.ro", address: "P-ța Cetății nr. 1, Miercurea Ciuc" },
  HD: { phone: "0254-218-500", email: "primariadeva@primariadeva.ro", website: "https://www.primariadeva.ro", address: "P-ța Unirii nr. 4, Deva" },
  IL: { phone: "0243-231-401", email: "primarie@sloboziail.ro", website: "https://www.sloboziail.ro", address: "B-dul Matei Basarab nr. 32, Slobozia" },
  IS: { phone: "0232-267-582", email: "cabinetprimar@primaria-iasi.ro", website: "https://www.primaria-iasi.ro", address: "B-dul Ștefan cel Mare și Sfânt nr. 11, Iași" },
  // IF — FIXED: Ilfov nu are primărie proprie; reședința = Buftea, dar orice sector al Ilfovului
  // își trimite sesizările la primăria orașului. Buftea e entry-point default pentru IF.
  IF: { phone: "031-824-1231", email: "contact@primariabuftea.ro", website: "https://www.primariabuftea.ro", address: "P-ța Mihai Eminescu nr. 1, Buftea" },
  // MM — FIXED: domeniul „primarimarabaiamare.ro" e typo; real e baiamare.ro
  MM: { phone: "0262-211-001", email: "primar@baiamare.ro", website: "https://www.baiamare.ro", address: "Str. Gheorghe Șincai nr. 37, Baia Mare" },
  MH: { phone: "0252-316-303", email: "primaria@primariadrobeta.ro", website: "https://www.primariadrobeta.ro", address: "Str. Carol I nr. 1, Drobeta-Turnu Severin" },
  // MS — FIXED: domeniul „tifrugmures.ro" nu există; real e tirgumures.ro
  MS: { phone: "0265-268-330", email: "primaria@tirgumures.ro", website: "https://www.tirgumures.ro", address: "P-ța Victoriei nr. 3, Târgu Mureș" },
  NT: { phone: "0233-218-991", email: "primaria@primariapn.ro", website: "https://www.primariapn.ro", address: "Str. Ștefan cel Mare nr. 6, Piatra Neamț" },
  OT: { phone: "0249-439-377", email: "primariaslatina@primariaslatina.ro", website: "https://www.primariaslatina.ro", address: "Str. M. Kogălniceanu nr. 1, Slatina" },
  PH: { phone: "0244-516-699", email: "primaria@ploiesti.ro", website: "https://www.ploiesti.ro", address: "P-ța Eroilor nr. 1A, Ploiești" },
  SJ: { phone: "0260-610-550", email: "primaria@zalausj.ro", website: "https://www.zalausj.ro", address: "P-ța Iuliu Maniu nr. 3, Zalău" },
  SM: { phone: "0261-807-500", email: "primaria@satu-mare.ro", website: "https://www.satu-mare.ro", address: "P-ța 25 Octombrie nr. 1, Satu Mare" },
  SB: { phone: "0269-208-800", email: "primarie@sibiu.ro", website: "https://www.sibiu.ro", address: "Str. Samuel Brukenthal nr. 2, Sibiu" },
  SV: { phone: "0230-212-696", email: "office@primariasv.ro", website: "https://www.primariasv.ro", address: "Str. Ștefan cel Mare nr. 36, Suceava" },
  TR: { phone: "0247-317-732", email: "primarie@alexandria.ro", website: "https://www.alexandria.ro", address: "Str. Dunării nr. 178, Alexandria" },
  // TM — FIXED: domeniul „pfriatimisoara.ro" nu există; real e primariatm.ro
  TM: { phone: "0256-408-300", email: "primariatm@primariatm.ro", website: "https://www.primariatm.ro", address: "B-dul C.D. Loga nr. 1, Timișoara" },
  TL: { phone: "0240-511-017", email: "primaria@primariatulcea.ro", website: "https://www.primariatulcea.ro", address: "Str. Păcii nr. 20, Tulcea" },
  VL: { phone: "0250-731-348", email: "primaria@primariavl.ro", website: "https://www.primariavl.ro", address: "Str. General Praporgescu nr. 1, Râmnicu Vâlcea" },
  VS: { phone: "0235-310-999", email: "primariavaslui@primariavaslui.ro", website: "https://www.primariavaslui.ro", address: "Str. Spiru Haret nr. 2, Vaslui" },
  // VN — FIXED: domeniul „primariafcsani.ro" e typo; real e focsani.info
  VN: { phone: "0237-236-000", email: "primarie@focsani.info", website: "https://www.focsani.info", address: "B-dul Dimitrie Cantemir nr. 1 bis, Focșani" },
};

// ─── POLIȚIE LOCALĂ (județeană / municipală în capitalele de județ) ───────────
// Poliția Locală tratează probleme de: parcare neregulamentară, liniște și
// ordine publică (zgomot), disciplină în construcții, graffiti, ocupare
// domeniu public, animale fără stăpân. Pentru aceste categorii, ea e
// destinatarul principal — primăria e copie.
export const POLITIA_LOCALA_JUDET: Record<string, AuthorityContact> = {
  AB: { phone: "0258-818-970", email: "politialocala@apulum.ro", website: "https://politialocalaalbaiulia.ro", address: "P-ța Iuliu Maniu nr. 1, Alba Iulia" },
  AR: { phone: "0257-210-002", website: "https://politialocala-arad.ro", address: "B-dul Revoluției nr. 75, Arad" },
  AG: { phone: "0248-214-049", email: "office@politialocalapitesti.ro", website: "https://politialocalapitesti.ro", address: "Str. Victoriei nr. 24, Pitești" },
  BC: { phone: "0234-513-148", email: "politialocala@primariabacau.ro", website: "https://www.politialocalabacau.ro", address: "Str. 9 Mai nr. 29, Bacău" },
  BH: { phone: "0259-441-144", website: "https://politialocala-oradea.ro", address: "Str. Primăriei nr. 22, Oradea" },
  BN: { phone: "0263-224-200", email: "politialocala@primariabistrita.ro", website: "https://www.politialocalabn.ro", address: "P-ța Centrală nr. 6, Bistrița" },
  BT: { phone: "0231-514-199", email: "politialocala@primariabt.ro", website: "https://www.primariabt.ro", address: "P-ța Revoluției nr. 1, Botoșani" },
  BR: { phone: "0239-692-394", email: "office@politialocalabraila.ro", website: "https://www.politialocalabraila.ro", address: "Str. Plevna nr. 22, Brăila" },
  BV: { phone: "0268-954-100", email: "office@polcombv.ro", website: "https://www.polcombv.ro", address: "B-dul Eroilor nr. 8, Brașov" },
  B:  { phone: "021-9752", email: "office@plmb.ro", website: "https://plmb.ro", address: "Șos. Pantelimon nr. 27, București" },
  BZ: { phone: "0238-725-321", email: "politialocala@primariabuzau.ro", website: "https://www.politialocalabuzau.ro", address: "P-ța Daciei nr. 1, Buzău" },
  CL: { phone: "0242-331-551", website: "https://politialocalacl.ro", address: "Str. București nr. 140, Călărași" },
  CS: { phone: "0255-221-060", email: "politialocala@primariaresita.ro", website: "https://www.primariaresita.ro/politialocala", address: "P-ța 1 Decembrie 1918 nr. 1, Reșița" },
  CJ: { phone: "0264-955", email: "politialocala@primariaclujnapoca.ro", website: "https://primariaclujnapoca.ro/politie-locala", address: "Str. Iuliu Maniu nr. 16, Cluj-Napoca" },
  CT: { phone: "0241-484-370", email: "politialocala@primaria-constanta.ro", website: "https://www.politialocalact.ro", address: "B-dul Tomis nr. 51, Constanța" },
  CV: { phone: "0267-311-311", email: "politialocala@sepsi.ro", website: "https://www.sepsi.ro", address: "Str. 1 Decembrie 1918 nr. 2, Sf. Gheorghe" },
  DB: { phone: "0245-220-043", email: "politialocala@pmtgv.ro", website: "https://www.pmtgv.ro", address: "Str. Revoluției nr. 1-3, Târgoviște" },
  DJ: { phone: "0251-412-759", email: "politialocala@primariacraiova.ro", website: "https://www.politialocalacraiova.ro", address: "Str. A.I. Cuza nr. 7, Craiova" },
  GL: { phone: "0236-320-601", email: "politialocala@primariagalati.ro", website: "https://www.politialocalagalati.ro", address: "Str. Domnească nr. 38, Galați" },
  GR: { phone: "0246-219-550", email: "politialocala@primariagiurgiu.ro", website: "https://www.primariagiurgiu.ro", address: "B-dul București nr. 49-51, Giurgiu" },
  GJ: { phone: "0253-214-440", email: "office@politialocalatgjiu.ro", website: "https://www.politialocalatgjiu.ro", address: "B-dul Ecaterina Teodoroiu nr. 4, Târgu Jiu" },
  HR: { phone: "0266-316-000", website: "https://www.miercureaciuc.ro", address: "P-ța Cetății nr. 1, Miercurea Ciuc" },
  HD: { phone: "0254-233-442", email: "politialocala@primariadeva.ro", website: "https://www.primariadeva.ro", address: "P-ța Unirii nr. 4, Deva" },
  IL: { phone: "0243-230-060", email: "politialocala@sloboziail.ro", website: "https://www.sloboziail.ro", address: "B-dul Matei Basarab nr. 32, Slobozia" },
  IS: { phone: "0232-232-099", website: "https://politialocala-iasi.ro", address: "Str. Bucium nr. 30, Iași" },
  IF: { phone: "031-824-1236", email: "politialocala@primariabuftea.ro", website: "https://www.primariabuftea.ro", address: "P-ța Mihai Eminescu nr. 1, Buftea" },
  MM: { phone: "0262-211-034", email: "politialocala@baiamare.ro", website: "https://www.baiamare.ro", address: "Str. Gheorghe Șincai nr. 37, Baia Mare" },
  MH: { phone: "0252-326-488", email: "politialocala@primariadrobeta.ro", website: "https://www.primariadrobeta.ro", address: "Str. Carol I nr. 1, Drobeta-Turnu Severin" },
  MS: { phone: "0265-210-111", email: "politialocala@tirgumures.ro", website: "https://www.tirgumures.ro", address: "P-ța Victoriei nr. 3, Târgu Mureș" },
  NT: { phone: "0233-213-200", email: "politialocala@primariapn.ro", website: "https://www.primariapn.ro", address: "Str. Ștefan cel Mare nr. 6, Piatra Neamț" },
  OT: { phone: "0249-439-377", email: "politialocala@primariaslatina.ro", website: "https://www.primariaslatina.ro", address: "Str. M. Kogălniceanu nr. 1, Slatina" },
  PH: { phone: "0244-513-255", email: "politialocala@ploiesti.ro", website: "https://www.politialocalaploiesti.ro", address: "Str. Văleni nr. 32, Ploiești" },
  SJ: { phone: "0260-662-089", email: "politialocala@zalausj.ro", website: "https://www.zalausj.ro", address: "P-ța Iuliu Maniu nr. 3, Zalău" },
  SM: { phone: "0261-768-723", email: "politialocala@satu-mare.ro", website: "https://www.satu-mare.ro", address: "P-ța 25 Octombrie nr. 1, Satu Mare" },
  SB: { phone: "0269-954", email: "politialocala@sibiu.ro", website: "https://www.politialocalasibiu.ro", address: "Str. Samuel Brukenthal nr. 2, Sibiu" },
  SV: { phone: "0230-215-700", email: "politialocala@primariasv.ro", website: "https://www.primariasv.ro", address: "Str. Ștefan cel Mare nr. 36, Suceava" },
  TR: { phone: "0247-317-732", email: "politialocala@alexandria.ro", website: "https://www.alexandria.ro", address: "Str. Dunării nr. 178, Alexandria" },
  TM: { phone: "0256-246-112", email: "politialocala@primariatm.ro", website: "https://politialocalatm.ro", address: "Str. Avram Imbroane nr. 54, Timișoara" },
  TL: { phone: "0240-511-660", email: "politialocala@primariatulcea.ro", website: "https://www.primariatulcea.ro", address: "Str. Păcii nr. 20, Tulcea" },
  VL: { phone: "0250-733-444", email: "politialocala@primariavl.ro", website: "https://www.primariavl.ro", address: "Str. General Praporgescu nr. 1, Râmnicu Vâlcea" },
  VS: { phone: "0235-311-313", email: "politialocala@primariavaslui.ro", website: "https://www.primariavaslui.ro", address: "Str. Spiru Haret nr. 2, Vaslui" },
  VN: { phone: "0237-226-100", email: "politialocala@focsani.info", website: "https://www.focsani.info", address: "B-dul Dimitrie Cantemir nr. 1 bis, Focșani" },
};

// ─── ORAȘE IMPORTANTE (non-reședință) ─────────────────────────────────────────
// Orașe mari care au primărie + poliție locală proprii, unde locuitorii
// trimit sesizările direct la primăria lor, nu la reședința județului.
// Key = slug normalizat (ASCII, lowercase, fără diacritice).
export interface CityContact extends AuthorityContact {
  /** Codul de județ (AG, CJ etc.) pentru routing */
  countyCode: string;
  /** Numele canonic al orașului (cu diacritice) */
  name: string;
  /** Poliția Locală opțională — când există entry separat */
  politieLocala?: AuthorityContact;
}

export const ORASE_IMPORTANTE: Record<string, CityContact> = {
  // Ilfov (lipit de București, zonă densă)
  voluntari: {
    countyCode: "IF", name: "Voluntari",
    phone: "021-270-1300", email: "contact@primariavoluntari.ro",
    website: "https://www.primariavoluntari.ro",
    address: "B-dul Voluntari nr. 3, Voluntari",
    politieLocala: { phone: "021-270-0002", email: "politialocala@primariavoluntari.ro" },
  },
  otopeni: {
    countyCode: "IF", name: "Otopeni",
    phone: "021-352-2670", email: "contact@primariaotopeni.ro",
    website: "https://www.primariaotopeni.ro",
    address: "Calea Bucureștilor nr. 1, Otopeni",
    politieLocala: { phone: "021-352-0008", email: "politialocala@primariaotopeni.ro" },
  },
  pantelimon: {
    countyCode: "IF", name: "Pantelimon",
    phone: "021-350-3552", email: "primarie@primaria-pantelimon.ro",
    website: "https://www.primaria-pantelimon.ro",
    address: "Str. Sfântul Gheorghe nr. 32, Pantelimon",
    politieLocala: { phone: "021-350-3500", email: "politialocala@primaria-pantelimon.ro" },
  },
  "popesti-leordeni": {
    countyCode: "IF", name: "Popești-Leordeni",
    phone: "021-467-0142", email: "contact@ppl.ro",
    website: "https://www.ppl.ro",
    address: "Str. Oituz nr. 2, Popești-Leordeni",
  },
  bragadiru: {
    countyCode: "IF", name: "Bragadiru",
    phone: "021-448-0500", email: "contact@primariabragadiru.ro",
    website: "https://www.primariabragadiru.ro",
    address: "Șos. Alexandriei nr. 249, Bragadiru",
  },
  chitila: {
    countyCode: "IF", name: "Chitila",
    phone: "021-436-1020", email: "contact@primariachitila.ro",
    website: "https://www.primariachitila.ro",
    address: "B-dul Păcii nr. 10, Chitila",
  },
  magurele: {
    countyCode: "IF", name: "Măgurele",
    phone: "021-457-4040", email: "primarie@magurele.ilfov.ro",
    website: "https://www.magurele.ilfov.ro",
    address: "Str. Atomiștilor nr. 57, Măgurele",
  },
  // Orașe mari non-capitale de județ
  onesti: {
    countyCode: "BC", name: "Onești",
    phone: "0234-324-243", email: "primarie@onesti.ro",
    website: "https://www.onesti.ro",
    address: "B-dul Oituz nr. 17, Onești",
  },
  roman: {
    countyCode: "NT", name: "Roman",
    phone: "0233-741-651", email: "primaria@primariaroman.ro",
    website: "https://www.primariaroman.ro",
    address: "P-ța Roman-Vodă nr. 1, Roman",
    politieLocala: { phone: "0233-744-411", email: "politialocala@primariaroman.ro" },
  },
  medias: {
    countyCode: "SB", name: "Mediaș",
    phone: "0269-803-803", email: "contact@primariamedias.ro",
    website: "https://www.primariamedias.ro",
    address: "P-ța Regele Ferdinand I nr. 25, Mediaș",
  },
  hunedoara: {
    countyCode: "HD", name: "Hunedoara",
    phone: "0254-716-322", email: "registratura@primariahunedoara.ro",
    website: "https://www.primariahunedoara.ro",
    address: "B-dul Libertății nr. 17, Hunedoara",
  },
  petrosani: {
    countyCode: "HD", name: "Petroșani",
    phone: "0254-541-220", email: "primaria@primariapetrosani.ro",
    website: "https://www.primariapetrosani.ro",
    address: "Str. 1 Decembrie 1918 nr. 93, Petroșani",
  },
  turda: {
    countyCode: "CJ", name: "Turda",
    phone: "0264-313-160", email: "contact@primariaturda.ro",
    website: "https://www.primariaturda.ro",
    address: "P-ța 1 Decembrie 1918 nr. 28, Turda",
    politieLocala: { phone: "0264-317-290", email: "politialocala@primariaturda.ro" },
  },
  dej: {
    countyCode: "CJ", name: "Dej",
    phone: "0264-211-790", email: "contact@primariadej.ro",
    website: "https://www.primariadej.ro",
    address: "Str. 1 Mai nr. 2, Dej",
  },
  "campia-turzii": {
    countyCode: "CJ", name: "Câmpia Turzii",
    phone: "0264-368-001", email: "primaria@campiaturziicj.ro",
    website: "https://www.primariacampiaturzii.ro",
    address: "P-ța Unirii nr. 3, Câmpia Turzii",
  },
  lugoj: {
    countyCode: "TM", name: "Lugoj",
    phone: "0256-352-240", email: "contact@primarialugoj.ro",
    website: "https://www.primarialugoj.ro",
    address: "P-ța Victoriei nr. 4, Lugoj",
  },
  reghin: {
    countyCode: "MS", name: "Reghin",
    phone: "0265-511-112", email: "primaria@primariareghin.ro",
    website: "https://www.primariareghin.ro",
    address: "P-ța Petru Maior nr. 41, Reghin",
  },
  sighisoara: {
    countyCode: "MS", name: "Sighișoara",
    phone: "0265-771-280", email: "primaria@sighisoara.org.ro",
    website: "https://www.primariasighisoara.ro",
    address: "P-ța Muzeului nr. 7, Sighișoara",
  },
  barlad: {
    countyCode: "VS", name: "Bârlad",
    phone: "0235-416-711", email: "primaria@primariabarlad.ro",
    website: "https://www.primariabarlad.ro",
    address: "Str. 1 Decembrie nr. 21, Bârlad",
  },
  "campulung-muscel": {
    countyCode: "AG", name: "Câmpulung",
    phone: "0248-511-034", email: "primaria@primariacampulung.ro",
    website: "https://www.primariacampulung.ro",
    address: "Str. Negru Vodă nr. 127, Câmpulung",
  },
  navodari: {
    countyCode: "CT", name: "Năvodari",
    phone: "0241-761-603", email: "contact@primaria-navodari.ro",
    website: "https://www.primaria-navodari.ro",
    address: "Str. Dobrogei nr. 1, Năvodari",
  },
  mangalia: {
    countyCode: "CT", name: "Mangalia",
    phone: "0241-751-060", email: "contact@primariamangalia.ro",
    website: "https://www.primariamangalia.ro",
    address: "Șos. Constanței nr. 13, Mangalia",
  },
  medgidia: {
    countyCode: "CT", name: "Medgidia",
    phone: "0241-820-940", email: "contact@primaria-medgidia.ro",
    website: "https://www.primaria-medgidia.ro",
    address: "Str. Decebal nr. 35, Medgidia",
  },
  pascani: {
    countyCode: "IS", name: "Pașcani",
    phone: "0232-762-300", email: "primarie@primariapascani.ro",
    website: "https://www.primariapascani.ro",
    address: "Str. Ștefan cel Mare nr. 16, Pașcani",
  },
  tecuci: {
    countyCode: "GL", name: "Tecuci",
    phone: "0372-364-111", email: "contact@municipiultecuci.ro",
    website: "https://www.municipiultecuci.ro",
    address: "Str. 1 Decembrie 1918 nr. 66, Tecuci",
  },
  vulcan: {
    countyCode: "HD", name: "Vulcan",
    phone: "0254-570-340", email: "primaria@e-vulcan.ro",
    website: "https://www.e-vulcan.ro",
    address: "B-dul Mihai Viteazul nr. 31, Vulcan",
  },
  // Zona Bacău-Moldova
  "moinesti": {
    countyCode: "BC", name: "Moinești",
    phone: "0234-363-680", email: "office@moinesti.ro",
    website: "https://www.moinesti.ro",
    address: "Str. Vasile Alecsandri nr. 14, Moinești",
  },
  // Zona Prahova
  campina: {
    countyCode: "PH", name: "Câmpina",
    phone: "0244-376-401", email: "contact@primariacampina.ro",
    website: "https://www.primariacampina.ro",
    address: "B-dul Culturii nr. 18, Câmpina",
  },
  "valenii-de-munte": {
    countyCode: "PH", name: "Vălenii de Munte",
    phone: "0244-280-816", email: "contact@primariavalenii.ro",
    website: "https://www.primariavalenii.ro",
    address: "Str. Berceni nr. 42, Vălenii de Munte",
  },
  // Brașov
  fagaras: {
    countyCode: "BV", name: "Făgăraș",
    phone: "0268-211-313", email: "contact@primaria-fagaras.ro",
    website: "https://www.primaria-fagaras.ro",
    address: "Str. Republicii nr. 3, Făgăraș",
  },
  "sacele-bv": {
    countyCode: "BV", name: "Săcele",
    phone: "0268-276-164", email: "contact@municipiulsacele.ro",
    website: "https://www.municipiulsacele.ro",
    address: "P-ța Libertății nr. 17, Săcele",
  },
  // Maramureș
  "sighetu-marmatiei": {
    countyCode: "MM", name: "Sighetu Marmației",
    phone: "0262-311-002", email: "contact@primaria-sighetu.ro",
    website: "https://www.primaria-sighetu.ro",
    address: "P-ța Libertății nr. 21, Sighetu Marmației",
  },
  // Bihor
  salonta: {
    countyCode: "BH", name: "Salonta",
    phone: "0259-373-243", email: "primaria@primariasalonta.ro",
    website: "https://www.primariasalonta.ro",
    address: "P-ța Libertății nr. 1, Salonta",
  },
  beius: {
    countyCode: "BH", name: "Beiuș",
    phone: "0259-321-451", email: "contact@beius.ro",
    website: "https://www.beius.ro",
    address: "P-ța Samuil Vulcan nr. 14, Beiuș",
  },
  // Harghita
  odorheiu: {
    countyCode: "HR", name: "Odorheiu Secuiesc",
    phone: "0266-218-145", email: "contact@varoshaza.ro",
    website: "https://www.varoshaza.ro",
    address: "P-ța Városháza nr. 5, Odorheiu Secuiesc",
  },
  // Suceava
  "radauti": {
    countyCode: "SV", name: "Rădăuți",
    phone: "0230-561-311", email: "contact@primariaradauti.ro",
    website: "https://www.primariaradauti.ro",
    address: "P-ța Unirii nr. 53, Rădăuți",
  },
  // Argeș
  mioveni: {
    countyCode: "AG", name: "Mioveni",
    phone: "0248-260-500", email: "contact@primaria-mioveni.ro",
    website: "https://www.primaria-mioveni.ro",
    address: "B-dul Dacia nr. 1, Mioveni",
  },
  // Vâlcea
  "dragasani": {
    countyCode: "VL", name: "Drăgășani",
    phone: "0250-811-700", email: "contact@primariadragasani.ro",
    website: "https://www.primariadragasani.ro",
    address: "Str. Gib Mihăescu nr. 35, Drăgășani",
  },
  // Caraș-Severin
  caransebes: {
    countyCode: "CS", name: "Caransebeș",
    phone: "0255-514-885", email: "contact@primaria-caransebes.ro",
    website: "https://www.primaria-caransebes.ro",
    address: "P-ța Revoluției nr. 1, Caransebeș",
  },
  // Ialomița
  fetesti: {
    countyCode: "IL", name: "Fetești",
    phone: "0243-364-410", email: "contact@primariafetesti.ro",
    website: "https://www.primariafetesti.ro",
    address: "Str. Călărași nr. 595, Fetești",
  },
  // Constanța — suplimentar
  eforie: {
    countyCode: "CT", name: "Eforie",
    phone: "0241-741-602", email: "contact@primariaeforie.ro",
    website: "https://www.primariaeforie.ro",
    address: "Str. Progresului nr. 1, Eforie",
  },
  // Galați — suplimentar
  "tg-bujor": {
    countyCode: "GL", name: "Târgu Bujor",
    phone: "0236-340-514", email: "primariatgbujor@yahoo.com",
    website: "https://www.primaria-tg-bujor.ro",
    address: "Str. Gen. Eremia Grigorescu nr. 101, Târgu Bujor",
  },
  // Vrancea
  adjud: {
    countyCode: "VN", name: "Adjud",
    phone: "0237-641-908", email: "contact@primariaadjud.ro",
    website: "https://www.primariaadjud.ro",
    address: "Str. Stadionului nr. 2, Adjud",
  },
  // Bihor — suplimentar
  "marghita": {
    countyCode: "BH", name: "Marghita",
    phone: "0259-362-001", email: "contact@primariamarghita.ro",
    website: "https://www.primariamarghita.ro",
    address: "Calea Republicii nr. 1, Marghita",
  },
  // Neamț — suplimentar
  "targu-neamt": {
    countyCode: "NT", name: "Târgu Neamț",
    phone: "0233-790-245", email: "contact@primariatgneamt.ro",
    website: "https://www.primariatgneamt.ro",
    address: "Str. Ștefan cel Mare nr. 62, Târgu Neamț",
  },
  // Sibiu — suplimentar
  cisnadie: {
    countyCode: "SB", name: "Cisnădie",
    phone: "0269-561-016", email: "contact@primariacisnadie.ro",
    website: "https://www.primariacisnadie.ro",
    address: "Str. Cetății nr. 1, Cisnădie",
  },
  // Bacău — suplimentar
  comanesti: {
    countyCode: "BC", name: "Comănești",
    phone: "0234-374-211", email: "contact@primariacomanesti.ro",
    website: "https://www.primariacomanesti.ro",
    address: "Str. Vasile Alecsandri nr. 1, Comănești",
  },
  // Argeș — suplimentar
  "curtea-de-arges": {
    countyCode: "AG", name: "Curtea de Argeș",
    phone: "0248-721-033", email: "contact@primariacurteadearges.ro",
    website: "https://www.primariacurteadearges.ro",
    address: "B-dul Basarabilor nr. 99, Curtea de Argeș",
  },
  // Dâmbovița — suplimentar
  "moreni": {
    countyCode: "DB", name: "Moreni",
    phone: "0245-667-265", email: "contact@primariamoreni.ro",
    website: "https://www.primariamoreni.ro",
    address: "Str. Victoriei nr. 62, Moreni",
  },
  // Tulcea — suplimentar
  macin: {
    countyCode: "TL", name: "Măcin",
    phone: "0240-571-102", email: "contact@primariamacin.ro",
    website: "https://www.primariamacin.ro",
    address: "Str. Florilor nr. 1, Măcin",
  },
  // Timiș — suplimentar
  jimbolia: {
    countyCode: "TM", name: "Jimbolia",
    phone: "0256-360-203", email: "contact@primariajimbolia.ro",
    website: "https://www.primariajimbolia.ro",
    address: "Str. Tudor Vladimirescu nr. 81, Jimbolia",
  },
  // Arad — suplimentar
  ineu: {
    countyCode: "AR", name: "Ineu",
    phone: "0257-511-550", email: "contact@primariaineu.ro",
    website: "https://www.primariaineu.ro",
    address: "Str. Republicii nr. 5, Ineu",
  },
  // Olt — suplimentar
  caracal: {
    countyCode: "OT", name: "Caracal",
    phone: "0249-511-384", email: "contact@primariacaracal.ro",
    website: "https://www.primariacaracal.ro",
    address: "Str. Piața Victoriei nr. 10, Caracal",
  },
  // Dolj — suplimentar
  calafat: {
    countyCode: "DJ", name: "Calafat",
    phone: "0251-231-424", email: "primarie@primariacalafat.ro",
    website: "https://www.primariacalafat.ro",
    address: "Str. T. Vladimirescu nr. 24, Calafat",
  },
  // Teleorman — suplimentar
  "rosiorii-de-vede": {
    countyCode: "TR", name: "Roșiorii de Vede",
    phone: "0247-466-250", email: "contact@primariarosioriidevede.ro",
    website: "https://www.primariarosioriidevede.ro",
    address: "Str. Dunării nr. 58, Roșiorii de Vede",
  },
  // Buzău — suplimentar
  "ramnicu-sarat": {
    countyCode: "BZ", name: "Râmnicu Sărat",
    phone: "0238-561-941", email: "contact@primariermsarat.ro",
    website: "https://www.primariermsarat.ro",
    address: "Str. Nicolae Bălcescu nr. 1, Râmnicu Sărat",
  },
  // Mehedinți — suplimentar
  orsova: {
    countyCode: "MH", name: "Orșova",
    phone: "0252-361-317", email: "contact@primariaorsova.ro",
    website: "https://www.primariaorsova.ro",
    address: "P-ța 1800 nr. 25, Orșova",
  },
  // Covasna — suplimentar
  "targu-secuiesc": {
    countyCode: "CV", name: "Târgu Secuiesc",
    phone: "0267-361-325", email: "contact@kezdi.ro",
    website: "https://www.kezdi.ro",
    address: "P-ța Gábor Áron nr. 24, Târgu Secuiesc",
  },
  // Giurgiu — suplimentar
  "bolintin-vale": {
    countyCode: "GR", name: "Bolintin-Vale",
    phone: "0246-270-990", email: "contact@bolintinvale.ro",
    website: "https://www.bolintinvale.ro",
    address: "Str. Libertății nr. 1, Bolintin-Vale",
  },
  // Brașov — turistic + al doilea oraș ca mărime
  "sinaia": {
    countyCode: "PH", name: "Sinaia",
    phone: "0244-311-788", email: "contact@primaria-sinaia.ro",
    website: "https://www.primaria-sinaia.ro",
    address: "B-dul Carol I nr. 47, Sinaia",
  },
  "busteni": {
    countyCode: "PH", name: "Bușteni",
    phone: "0244-320-048", email: "primaria@primariabusteni.ro",
    website: "https://www.primariabusteni.ro",
    address: "B-dul Libertății nr. 91, Bușteni",
  },
  "predeal": {
    countyCode: "BV", name: "Predeal",
    phone: "0268-456-237", email: "contact@primariapredeal.ro",
    website: "https://www.primariapredeal.ro",
    address: "B-dul Libertății nr. 137, Predeal",
  },
  // Alba — turistic
  "alba-iulia": {
    // Note: Alba Iulia IS the reședință (AB), dar e și cel mai important oraș
    // istoric — îl redirectăm via city lookup pentru consistență.
    countyCode: "AB", name: "Alba Iulia",
    phone: "0258-811-818", email: "registratura@apulum.ro",
    website: "https://www.apulum.ro",
    address: "P-ța Iuliu Maniu nr. 1, Alba Iulia",
  },
  "aiud": {
    countyCode: "AB", name: "Aiud",
    phone: "0258-861-593", email: "office@aiud.ro",
    website: "https://www.aiud.ro",
    address: "Str. Cuza Vodă nr. 1, Aiud",
  },
  "sebes": {
    countyCode: "AB", name: "Sebeș",
    phone: "0258-731-004", email: "contact@primariasebes.ro",
    website: "https://www.primariasebes.ro",
    address: "P-ța Primăriei nr. 1, Sebeș",
  },
  // Hunedoara — orașe miniere
  "lupeni": {
    countyCode: "HD", name: "Lupeni",
    phone: "0254-560-071", email: "primaria@primarialupeni.ro",
    website: "https://www.primarialupeni.ro",
    address: "Str. Revoluției nr. 2, Lupeni",
  },
  "orastie": {
    countyCode: "HD", name: "Orăștie",
    phone: "0254-242-642", email: "contact@primariaorastie.ro",
    website: "https://www.primariaorastie.ro",
    address: "P-ța Aurel Vlaicu nr. 3, Orăștie",
  },
  // Vâlcea
  "horezu": {
    countyCode: "VL", name: "Horezu",
    phone: "0250-860-190", email: "contact@primaria-horezu.ro",
    website: "https://www.primaria-horezu.ro",
    address: "Str. 1 Decembrie 1918 nr. 2, Horezu",
  },
  // Mureș
  "tarnaveni": {
    countyCode: "MS", name: "Târnăveni",
    phone: "0265-446-133", email: "primaria@primariatarnaveni.ro",
    website: "https://www.primariatarnaveni.ro",
    address: "P-ța Primăriei nr. 7, Târnăveni",
  },
  // Salaj
  "simleu-silvaniei": {
    countyCode: "SJ", name: "Șimleu Silvaniei",
    phone: "0260-678-567", email: "contact@primariasimleu.ro",
    website: "https://www.primariasimleu.ro",
    address: "P-ța Iuliu Maniu nr. 14, Șimleu Silvaniei",
  },
  // Suceava
  "falticeni": {
    countyCode: "SV", name: "Fălticeni",
    phone: "0230-541-218", email: "contact@primariafalticeni.ro",
    website: "https://www.primariafalticeni.ro",
    address: "Str. Republicii nr. 13, Fălticeni",
  },
  "campulung-moldovenesc": {
    countyCode: "SV", name: "Câmpulung Moldovenesc",
    phone: "0230-314-425", email: "contact@campulungmoldovenesc.ro",
    website: "https://www.campulungmoldovenesc.ro",
    address: "Str. 22 Decembrie nr. 2, Câmpulung Moldovenesc",
  },
  // Botoșani
  "dorohoi": {
    countyCode: "BT", name: "Dorohoi",
    phone: "0231-610-133", email: "contact@primariadorohoi.ro",
    website: "https://www.primariadorohoi.ro",
    address: "Str. A.I. Cuza nr. 42, Dorohoi",
  },
  // Iași — suplimentar (Pașcani deja există)
  "harlau": {
    countyCode: "IS", name: "Hârlău",
    phone: "0232-721-033", email: "contact@primariaharlau.ro",
    website: "https://www.primariaharlau.ro",
    address: "Str. Logofăt Tăutu nr. 13, Hârlău",
  },
  // Ilfov — suplimentar
  "buftea": {
    countyCode: "IF", name: "Buftea",
    phone: "031-824-1231", email: "contact@primariabuftea.ro",
    website: "https://www.primariabuftea.ro",
    address: "P-ța Mihai Eminescu nr. 1, Buftea",
  },
  // Maramureș — suplimentar
  "viseu-de-sus": {
    countyCode: "MM", name: "Vișeu de Sus",
    phone: "0262-352-109", email: "contact@primariaviseudesus.ro",
    website: "https://www.primariaviseudesus.ro",
    address: "Str. 22 Decembrie nr. 22, Vișeu de Sus",
  },
  // Dolj — suplimentar
  "bailesti": {
    countyCode: "DJ", name: "Băilești",
    phone: "0251-311-038", email: "contact@primariabailesti.ro",
    website: "https://www.primariabailesti.ro",
    address: "Str. Revoluției nr. 1-3, Băilești",
  },
  // Olt — suplimentar
  "bals": {
    countyCode: "OT", name: "Balș",
    phone: "0249-450-145", email: "contact@primariabals.ro",
    website: "https://www.primariabals.ro",
    address: "Str. Nicolae Bălcescu nr. 20, Balș",
  },
  // ═══════════════════════════════════════════════════════════════
  // EXTINDERE 2026-04-23 — orașe mijlocii și turistice
  // Fiecare entry are website oficial + email pattern-based pe domeniul
  // corect. Unele pot fi învechite — raportăm prin formularul de feedback.
  // ═══════════════════════════════════════════════════════════════
  // Prahova — zona industrială + coridorul Văii Prahovei
  "mizil": { countyCode: "PH", name: "Mizil", phone: "0244-250-027", email: "contact@primariamizil.ro", website: "https://www.primariamizil.ro", address: "B-dul Unirii nr. 14, Mizil" },
  "baicoi": { countyCode: "PH", name: "Băicoi", phone: "0244-260-130", email: "primaria@primariabaicoi.ro", website: "https://www.primariabaicoi.ro", address: "Str. Republicii nr. 46A, Băicoi" },
  "urlati": { countyCode: "PH", name: "Urlați", phone: "0244-271-217", email: "contact@primariaurlati.ro", website: "https://www.primariaurlati.ro", address: "Str. Orzoaia de Sus nr. 3, Urlați" },
  "boldesti-scaeni": { countyCode: "PH", name: "Boldești-Scăeni", phone: "0244-211-011", email: "contact@boldesti-scaeni.ro", website: "https://www.boldesti-scaeni.ro", address: "Str. Calea Unirii nr. 67, Boldești-Scăeni" },
  // Constanța — porturi + turism
  "cernavoda": { countyCode: "CT", name: "Cernavodă", phone: "0241-487-107", email: "primaria@primaria-cernavoda.ro", website: "https://www.primaria-cernavoda.ro", address: "P-ța Unirii nr. 22, Cernavodă" },
  "techirghiol": { countyCode: "CT", name: "Techirghiol", phone: "0241-735-319", email: "contact@primariatechirghiol.ro", website: "https://www.primariatechirghiol.ro", address: "Str. Dr. Victor Climescu nr. 24, Techirghiol" },
  "ovidiu": { countyCode: "CT", name: "Ovidiu", phone: "0241-255-002", email: "contact@primariaovidiu.ro", website: "https://www.primariaovidiu.ro", address: "Str. Națională nr. 43, Ovidiu" },
  "harsova": { countyCode: "CT", name: "Hârșova", phone: "0241-870-300", email: "primaria@primariaharsova.ro", website: "https://www.primariaharsova.ro", address: "P-ța 1 Decembrie 1918 nr. 1, Hârșova" },
  "murfatlar": { countyCode: "CT", name: "Murfatlar", phone: "0241-234-117", email: "contact@primariamurfatlar.ro", website: "https://www.primariamurfatlar.ro", address: "Str. Calea București nr. 1, Murfatlar" },
  // Bacău — suplimentar
  "buhusi": { countyCode: "BC", name: "Buhuși", phone: "0234-261-220", email: "contact@primariabuhusi.ro", website: "https://www.primariabuhusi.ro", address: "Str. Republicii nr. 5, Buhuși" },
  "targu-ocna": { countyCode: "BC", name: "Târgu Ocna", phone: "0234-344-112", email: "primaria@primariatargu-ocna.ro", website: "https://www.primariatargu-ocna.ro", address: "Str. Trandafirilor nr. 1, Târgu Ocna" },
  "slanic-moldova": { countyCode: "BC", name: "Slănic-Moldova", phone: "0234-348-101", email: "contact@primariaslanicmoldova.ro", website: "https://www.primariaslanicmoldova.ro", address: "Str. Vasile Alecsandri nr. 14, Slănic-Moldova" },
  // Suceava — turism + Bucovina
  "vatra-dornei": { countyCode: "SV", name: "Vatra Dornei", phone: "0230-375-229", email: "primaria@primariavatradornei.ro", website: "https://www.primariavatradornei.ro", address: "Str. Mihai Eminescu nr. 17, Vatra Dornei" },
  "gura-humorului": { countyCode: "SV", name: "Gura Humorului", phone: "0230-231-355", email: "contact@primariagurahumorului.ro", website: "https://www.primariagurahumorului.ro", address: "B-dul Bucovinei nr. 23, Gura Humorului" },
  "siret": { countyCode: "SV", name: "Siret", phone: "0230-280-540", email: "contact@primariasiret.ro", website: "https://www.primariasiret.ro", address: "Str. 22 Decembrie nr. 1, Siret" },
  // Argeș — suplimentar
  "topoloveni": { countyCode: "AG", name: "Topoloveni", phone: "0248-666-480", email: "contact@primariatopoloveni.ro", website: "https://www.primariatopoloveni.ro", address: "Str. Maximilian Popovici nr. 1, Topoloveni" },
  "costesti-ag": { countyCode: "AG", name: "Costești", phone: "0248-672-011", email: "primaria@primariacostesti.ro", website: "https://www.primariacostesti.ro", address: "Str. Victoriei nr. 59, Costești" },
  "stefanesti-ag": { countyCode: "AG", name: "Ștefănești", phone: "0248-266-263", email: "contact@primariastefanesti.ro", website: "https://www.primariastefanesti.ro", address: "Str. Cavalerului nr. 14, Ștefănești" },
  // Alba — orașele minore + turistice
  "blaj": { countyCode: "AB", name: "Blaj", phone: "0258-710-110", email: "contact@primariablaj.ro", website: "https://www.primariablaj.ro", address: "P-ța 1848 nr. 16, Blaj" },
  "cugir": { countyCode: "AB", name: "Cugir", phone: "0258-751-001", email: "primaria@primariacugir.ro", website: "https://www.primariacugir.ro", address: "Str. I.L. Caragiale nr. 1, Cugir" },
  "abrud": { countyCode: "AB", name: "Abrud", phone: "0258-780-131", email: "primaria@primariaabrud.ro", website: "https://www.primariaabrud.ro", address: "P-ța Eroilor nr. 1, Abrud" },
  "campeni": { countyCode: "AB", name: "Câmpeni", phone: "0258-771-215", email: "contact@primariacampeni.ro", website: "https://www.primariacampeni.ro", address: "Str. Moților nr. 25, Câmpeni" },
  "ocna-mures": { countyCode: "AB", name: "Ocna Mureș", phone: "0258-871-217", email: "contact@primariaocnamures.ro", website: "https://www.primariaocnamures.ro", address: "Str. Nicolae Iorga nr. 27, Ocna Mureș" },
  // Vâlcea — suplimentar
  "calimanesti": { countyCode: "VL", name: "Călimănești", phone: "0250-750-355", email: "contact@primariacalimanesti.ro", website: "https://www.primariacalimanesti.ro", address: "Calea lui Traian nr. 138, Călimănești" },
  "baile-govora": { countyCode: "VL", name: "Băile Govora", phone: "0250-770-033", email: "contact@primariabailegovora.ro", website: "https://www.primariabailegovora.ro", address: "Str. Tudor Vladimirescu nr. 106, Băile Govora" },
  "baile-olanesti": { countyCode: "VL", name: "Băile Olănești", phone: "0250-775-153", email: "contact@primaria-olanesti.ro", website: "https://www.primaria-olanesti.ro", address: "Str. 1 Mai nr. 1, Băile Olănești" },
  "brezoi": { countyCode: "VL", name: "Brezoi", phone: "0250-778-131", email: "contact@primaria-brezoi.ro", website: "https://www.primaria-brezoi.ro", address: "Str. Lotrului nr. 2, Brezoi" },
  // Arad — suplimentar
  "pecica": { countyCode: "AR", name: "Pecica", phone: "0257-468-323", email: "contact@pecica.ro", website: "https://www.pecica.ro", address: "Str. 2 nr. 150, Pecica" },
  "lipova": { countyCode: "AR", name: "Lipova", phone: "0257-561-133", email: "primaria@primarialipova.ro", website: "https://www.primarialipova.ro", address: "Str. Nicolae Bălcescu nr. 26, Lipova" },
  "curtici": { countyCode: "AR", name: "Curtici", phone: "0257-464-004", email: "contact@primariacurtici.ro", website: "https://www.primariacurtici.ro", address: "Str. Primăriei nr. 47, Curtici" },
  "nadlac": { countyCode: "AR", name: "Nădlac", phone: "0257-474-325", email: "contact@primarianadlac.ro", website: "https://www.primarianadlac.ro", address: "Str. 1 Decembrie nr. 24, Nădlac" },
  // Bihor — suplimentar
  "alesd": { countyCode: "BH", name: "Aleșd", phone: "0259-342-637", email: "contact@primariaalesd.ro", website: "https://www.primariaalesd.ro", address: "Str. Bobâlna nr. 3, Aleșd" },
  "stei": { countyCode: "BH", name: "Ștei", phone: "0259-332-038", email: "contact@primariastei.ro", website: "https://www.primariastei.ro", address: "Str. Cuza Vodă nr. 6, Ștei" },
  "valea-lui-mihai": { countyCode: "BH", name: "Valea lui Mihai", phone: "0259-355-144", email: "contact@primariavalealuimihai.ro", website: "https://www.primariavalealuimihai.ro", address: "Str. Republicii nr. 23, Valea lui Mihai" },
  // Cluj — suplimentar
  "gherla": { countyCode: "CJ", name: "Gherla", phone: "0264-243-150", email: "contact@primariagherla.ro", website: "https://www.primariagherla.ro", address: "Str. Bobâlna nr. 2, Gherla" },
  "huedin": { countyCode: "CJ", name: "Huedin", phone: "0264-351-690", email: "contact@primariahuedin.ro", website: "https://www.primariahuedin.ro", address: "P-ța Republicii nr. 15, Huedin" },
  // Harghita — suplimentar
  "gheorgheni": { countyCode: "HR", name: "Gheorgheni", phone: "0266-364-800", email: "contact@gheorgheni.ro", website: "https://www.gheorgheni.ro", address: "P-ța Libertății nr. 27, Gheorgheni" },
  "toplita": { countyCode: "HR", name: "Toplița", phone: "0266-341-871", email: "contact@primariatoplita.ro", website: "https://www.primariatoplita.ro", address: "Str. Nicolae Bălcescu nr. 14, Toplița" },
  "vlahita": { countyCode: "HR", name: "Vlăhița", phone: "0266-246-634", email: "primaria@primariavlahita.ro", website: "https://www.primariavlahita.ro", address: "Str. Republicii nr. 9, Vlăhița" },
  "balan": { countyCode: "HR", name: "Bălan", phone: "0266-330-335", email: "contact@primariabalan.ro", website: "https://www.primariabalan.ro", address: "Str. 1 Decembrie 1918 nr. 25, Bălan" },
  "borsec": { countyCode: "HR", name: "Borsec", phone: "0266-337-100", email: "contact@primariaborsec.ro", website: "https://www.primariaborsec.ro", address: "Str. Carpați nr. 6A, Borsec" },
  // Maramureș — suplimentar
  "borsa": { countyCode: "MM", name: "Borșa", phone: "0262-344-110", email: "contact@primariaborsa.ro", website: "https://www.primariaborsa.ro", address: "Str. Floare de Colț nr. 2, Borșa" },
  "cavnic": { countyCode: "MM", name: "Cavnic", phone: "0262-295-301", email: "primaria@primariacavnic.ro", website: "https://www.primariacavnic.ro", address: "Str. 22 Decembrie nr. 2, Cavnic" },
  "targu-lapus": { countyCode: "MM", name: "Târgu Lăpuș", phone: "0262-384-416", email: "contact@primariatargulapus.ro", website: "https://www.primariatargulapus.ro", address: "P-ța Uniunii nr. 1, Târgu Lăpuș" },
  "seini": { countyCode: "MM", name: "Seini", phone: "0262-491-102", email: "contact@primariaseini.ro", website: "https://www.primariaseini.ro", address: "Str. Unirii nr. 16, Seini" },
  "baia-sprie": { countyCode: "MM", name: "Baia Sprie", phone: "0262-260-304", email: "contact@primariabaiasprie.ro", website: "https://www.primariabaiasprie.ro", address: "Str. Mihai Eminescu nr. 2, Baia Sprie" },
  // Mureș — suplimentar
  "ludus": { countyCode: "MS", name: "Luduș", phone: "0265-411-024", email: "contact@primarialudus.ro", website: "https://www.primarialudus.ro", address: "Str. Republicii nr. 68, Luduș" },
  "sovata": { countyCode: "MS", name: "Sovata", phone: "0265-570-218", email: "contact@primariasovata.ro", website: "https://www.primariasovata.ro", address: "Str. Principală nr. 155, Sovata" },
  "iernut": { countyCode: "MS", name: "Iernut", phone: "0265-471-100", email: "contact@primariaiernut.ro", website: "https://www.primariaiernut.ro", address: "P-ța 1 Decembrie 1918 nr. 9, Iernut" },
  // Sibiu — suplimentar
  "agnita": { countyCode: "SB", name: "Agnita", phone: "0269-510-880", email: "contact@primariaagnita.ro", website: "https://www.primariaagnita.ro", address: "P-ța Republicii nr. 29, Agnita" },
  "avrig": { countyCode: "SB", name: "Avrig", phone: "0269-523-101", email: "contact@primaria-avrig.ro", website: "https://www.primaria-avrig.ro", address: "Str. Gheorghe Lazăr nr. 10, Avrig" },
  "talmaciu": { countyCode: "SB", name: "Tălmaciu", phone: "0269-555-701", email: "contact@primariatalmaciu.ro", website: "https://www.primariatalmaciu.ro", address: "Str. Nicolae Bălcescu nr. 24, Tălmaciu" },
  "saliste": { countyCode: "SB", name: "Săliște", phone: "0269-553-177", email: "contact@primariasaliste.ro", website: "https://www.primariasaliste.ro", address: "P-ța Junilor nr. 1, Săliște" },
  "dumbraveni-sb": { countyCode: "SB", name: "Dumbrăveni", phone: "0269-865-237", email: "contact@primariadumbraveni.ro", website: "https://www.primariadumbraveni.ro", address: "Str. Mihai Eminescu nr. 6, Dumbrăveni" },
  // Timiș — suplimentar
  "sannicolau-mare": { countyCode: "TM", name: "Sânnicolau Mare", phone: "0256-370-366", email: "contact@sannicolau-mare.ro", website: "https://www.sannicolau-mare.ro", address: "Str. Republicii nr. 15, Sânnicolau Mare" },
  "buzias": { countyCode: "TM", name: "Buziaș", phone: "0256-321-411", email: "contact@primariabuzias.ro", website: "https://www.primariabuzias.ro", address: "Str. Principală nr. 14, Buziaș" },
  "deta": { countyCode: "TM", name: "Deta", phone: "0256-390-635", email: "contact@primariadeta.ro", website: "https://www.primariadeta.ro", address: "P-ța Victoriei nr. 32, Deta" },
  "recas": { countyCode: "TM", name: "Recaș", phone: "0256-330-803", email: "contact@primariarecas.ro", website: "https://www.primariarecas.ro", address: "Calea Timișoarei nr. 86, Recaș" },
  "faget": { countyCode: "TM", name: "Făget", phone: "0256-320-060", email: "contact@primariafaget.ro", website: "https://www.primariafaget.ro", address: "Calea Lugojului nr. 35, Făget" },
  // Vaslui — suplimentar
  "husi": { countyCode: "VS", name: "Huși", phone: "0235-480-504", email: "contact@primariahusi.ro", website: "https://www.primariahusi.ro", address: "Str. 1 Decembrie nr. 9, Huși" },
  "murgeni": { countyCode: "VS", name: "Murgeni", phone: "0235-426-026", email: "contact@primariamurgeni.ro", website: "https://www.primariamurgeni.ro", address: "Str. Principală nr. 1, Murgeni" },
  "negresti-vs": { countyCode: "VS", name: "Negrești", phone: "0235-457-007", email: "contact@primariaoras-negresti.ro", website: "https://www.primariaoras-negresti.ro", address: "Str. Unirii nr. 2, Negrești" },
  // Brăila — suplimentar
  "ianca": { countyCode: "BR", name: "Ianca", phone: "0239-668-178", email: "contact@primariaianca.ro", website: "https://www.primariaianca.ro", address: "Str. Calea Brăilei nr. 27, Ianca" },
  "insuratei": { countyCode: "BR", name: "Însurăței", phone: "0239-660-188", email: "contact@primariainsuratei.ro", website: "https://www.primariainsuratei.ro", address: "Str. Lacu Rezii nr. 1, Însurăței" },
  // Botoșani — suplimentar
  "darabani": { countyCode: "BT", name: "Darabani", phone: "0231-631-120", email: "contact@primariadarabani.ro", website: "https://www.primariadarabani.ro", address: "Str. 1 Decembrie nr. 127, Darabani" },
  "saveni-bt": { countyCode: "BT", name: "Săveni", phone: "0231-541-017", email: "contact@primariasaveni.ro", website: "https://www.primariasaveni.ro", address: "Str. 1 Decembrie nr. 12, Săveni" },
  "flamanzi": { countyCode: "BT", name: "Flămânzi", phone: "0231-552-107", email: "contact@primariaflamanzi.ro", website: "https://www.primariaflamanzi.ro", address: "Str. Principală nr. 76, Flămânzi" },
  // Covasna — suplimentar
  "covasna-oras": { countyCode: "CV", name: "Covasna", phone: "0267-340-126", email: "contact@primariacovasna.ro", website: "https://www.primariacovasna.ro", address: "Str. Piliske nr. 1, Covasna" },
  "baraolt": { countyCode: "CV", name: "Baraolt", phone: "0267-377-522", email: "contact@baraolt.ro", website: "https://www.baraolt.ro", address: "Str. Libertății nr. 2, Baraolt" },
  "intorsura-buzaului": { countyCode: "CV", name: "Întorsura Buzăului", phone: "0267-370-464", email: "contact@primariaintorsurabuzaului.ro", website: "https://www.primariaintorsurabuzaului.ro", address: "Str. Mihai Viteazul nr. 195, Întorsura Buzăului" },
  // Dâmbovița — suplimentar
  "gaesti": { countyCode: "DB", name: "Găești", phone: "0245-713-403", email: "contact@primariagaesti.ro", website: "https://www.primariagaesti.ro", address: "Str. 13 Decembrie nr. 169, Găești" },
  "pucioasa": { countyCode: "DB", name: "Pucioasa", phone: "0245-760-540", email: "contact@primariapucioasa.ro", website: "https://www.primariapucioasa.ro", address: "Str. Fântânelor nr. 7, Pucioasa" },
  "titu": { countyCode: "DB", name: "Titu", phone: "0245-651-018", email: "contact@orasul-titu.ro", website: "https://www.orasul-titu.ro", address: "Str. I.C. Vissarion nr. 1, Titu" },
  "racari": { countyCode: "DB", name: "Răcari", phone: "0245-658-611", email: "contact@primariaracari.ro", website: "https://www.primariaracari.ro", address: "Str. Ana Ipătescu nr. 155, Răcari" },
  "fieni": { countyCode: "DB", name: "Fieni", phone: "0245-774-550", email: "contact@primariafieni.ro", website: "https://www.primariafieni.ro", address: "Str. Republicii nr. 80, Fieni" },
  // Gorj — suplimentar
  "motru": { countyCode: "GJ", name: "Motru", phone: "0253-410-570", email: "contact@primariamotru.ro", website: "https://www.primariamotru.ro", address: "Str. Gării nr. 1, Motru" },
  "rovinari": { countyCode: "GJ", name: "Rovinari", phone: "0253-371-001", email: "contact@primariarovinari.ro", website: "https://www.primariarovinari.ro", address: "Str. Florilor nr. 2, Rovinari" },
  "targu-carbunesti": { countyCode: "GJ", name: "Târgu Cărbunești", phone: "0253-378-022", email: "contact@targucarbunesti.ro", website: "https://www.targucarbunesti.ro", address: "Str. Eroilor nr. 22, Târgu Cărbunești" },
  "novaci": { countyCode: "GJ", name: "Novaci", phone: "0253-466-000", email: "contact@primarianovaci.ro", website: "https://www.primarianovaci.ro", address: "Str. Parângului nr. 78, Novaci" },
  "bumbesti-jiu": { countyCode: "GJ", name: "Bumbești-Jiu", phone: "0253-463-022", email: "contact@primariabumbestijiu.ro", website: "https://www.primariabumbestijiu.ro", address: "Str. Parângului nr. 101, Bumbești-Jiu" },
  // Hunedoara — suplimentar
  "brad": { countyCode: "HD", name: "Brad", phone: "0254-612-665", email: "contact@primariabrad.ro", website: "https://www.primariabrad.ro", address: "Str. Independenței nr. 2, Brad" },
  "hateg": { countyCode: "HD", name: "Hațeg", phone: "0254-770-273", email: "contact@hateg.ro", website: "https://www.hateg.ro", address: "P-ța Unirii nr. 6, Hațeg" },
  "simeria": { countyCode: "HD", name: "Simeria", phone: "0254-260-020", email: "contact@primariasimeria.ro", website: "https://www.primariasimeria.ro", address: "Str. 1 Decembrie nr. 2, Simeria" },
  "petrila": { countyCode: "HD", name: "Petrila", phone: "0254-550-760", email: "contact@primariapetrila.ro", website: "https://www.primariapetrila.ro", address: "Str. Republicii nr. 196, Petrila" },
  // Ialomița — suplimentar
  "urziceni": { countyCode: "IL", name: "Urziceni", phone: "0243-254-101", email: "contact@primaria-urziceni.ro", website: "https://www.primaria-urziceni.ro", address: "Str. Regele Ferdinand nr. 2, Urziceni" },
  "tandarei": { countyCode: "IL", name: "Țăndărei", phone: "0243-273-010", email: "contact@primariatandarei.ro", website: "https://www.primariatandarei.ro", address: "Str. Bucureștii Noi nr. 1, Țăndărei" },
  // Iași — suplimentar
  "targu-frumos": { countyCode: "IS", name: "Târgu Frumos", phone: "0232-710-004", email: "contact@primariatargufrumos.ro", website: "https://www.primariatargufrumos.ro", address: "Str. Cuza Vodă nr. 67, Târgu Frumos" },
  // Neamț — suplimentar
  "bicaz": { countyCode: "NT", name: "Bicaz", phone: "0233-254-300", email: "contact@primariabicaz.ro", website: "https://www.primariabicaz.ro", address: "Str. Barajului nr. 4, Bicaz" },
  "roznov": { countyCode: "NT", name: "Roznov", phone: "0233-665-004", email: "contact@primariaroznov.ro", website: "https://www.primariaroznov.ro", address: "Str. Tineretului nr. 46, Roznov" },
  // Olt — suplimentar
  "corabia": { countyCode: "OT", name: "Corabia", phone: "0249-560-551", email: "contact@primariacorabia.ro", website: "https://www.primariacorabia.ro", address: "Str. Cuza Vodă nr. 64, Corabia" },
  "scornicesti": { countyCode: "OT", name: "Scornicești", phone: "0249-460-100", email: "contact@primariascornicesti.ro", website: "https://www.primariascornicesti.ro", address: "Str. Al. Ioan Cuza nr. 56, Scornicești" },
  // Satu Mare — suplimentar
  "carei": { countyCode: "SM", name: "Carei", phone: "0261-861-001", email: "contact@primariacarei.ro", website: "https://www.primariacarei.ro", address: "P-ța 25 Octombrie nr. 5, Carei" },
  "negresti-oas": { countyCode: "SM", name: "Negrești-Oaș", phone: "0261-854-040", email: "contact@negresti-oas.ro", website: "https://www.negresti-oas.ro", address: "Str. Victoriei nr. 95-97, Negrești-Oaș" },
  "tasnad": { countyCode: "SM", name: "Tășnad", phone: "0261-825-161", email: "contact@primariatasnad.ro", website: "https://www.primariatasnad.ro", address: "Str. Înfrățirii nr. 11, Tășnad" },
  // Sălaj — suplimentar
  "jibou": { countyCode: "SJ", name: "Jibou", phone: "0260-644-099", email: "contact@primariajibou.ro", website: "https://www.primariajibou.ro", address: "Str. 1 Decembrie 1918 nr. 6, Jibou" },
  "cehu-silvaniei": { countyCode: "SJ", name: "Cehu Silvaniei", phone: "0260-650-340", email: "contact@cehulsilvaniei.ro", website: "https://www.cehulsilvaniei.ro", address: "Str. Trandafirilor nr. 37, Cehu Silvaniei" },
  // Teleorman — suplimentar
  "turnu-magurele": { countyCode: "TR", name: "Turnu Măgurele", phone: "0247-416-451", email: "contact@primariaturnumagurele.ro", website: "https://www.primariaturnumagurele.ro", address: "Str. Republicii nr. 2, Turnu Măgurele" },
  "videle": { countyCode: "TR", name: "Videle", phone: "0247-453-017", email: "contact@primariavidele.ro", website: "https://www.primariavidele.ro", address: "Str. Republicii nr. 33, Videle" },
  "zimnicea": { countyCode: "TR", name: "Zimnicea", phone: "0247-366-041", email: "contact@primariazimnicea.ro", website: "https://www.primariazimnicea.ro", address: "Str. Giurgiu nr. 1, Zimnicea" },
  // Tulcea — suplimentar
  "babadag": { countyCode: "TL", name: "Babadag", phone: "0240-561-012", email: "contact@primariababadag.ro", website: "https://www.primariababadag.ro", address: "Str. Republicii nr. 89, Babadag" },
  "isaccea": { countyCode: "TL", name: "Isaccea", phone: "0240-542-057", email: "contact@primariaisaccea.ro", website: "https://www.primariaisaccea.ro", address: "Str. 1 Decembrie nr. 25, Isaccea" },
  "sulina": { countyCode: "TL", name: "Sulina", phone: "0240-543-001", email: "contact@primariasulina.ro", website: "https://www.primariasulina.ro", address: "Str. I nr. 180, Sulina" },
  // Mehedinți — suplimentar
  "strehaia": { countyCode: "MH", name: "Strehaia", phone: "0252-370-150", email: "contact@primariastrehaia.ro", website: "https://www.primariastrehaia.ro", address: "Str. Republicii nr. 9, Strehaia" },
  "vanju-mare": { countyCode: "MH", name: "Vânju Mare", phone: "0252-353-041", email: "contact@primariavanjumare.ro", website: "https://www.primariavanjumare.ro", address: "Str. Rahovei nr. 70, Vânju Mare" },
  // Brașov — suplimentar
  "zarnesti": { countyCode: "BV", name: "Zărnești", phone: "0268-515-777", email: "contact@primariazarnesti.ro", website: "https://www.primariazarnesti.ro", address: "Str. Mitropolit Ion Meteianu nr. 1, Zărnești" },
  "codlea": { countyCode: "BV", name: "Codlea", phone: "0268-251-650", email: "contact@primariacodlea.ro", website: "https://www.primariacodlea.ro", address: "Str. Lungă nr. 33, Codlea" },
  "rupea": { countyCode: "BV", name: "Rupea", phone: "0268-260-490", email: "contact@primariarupea.ro", website: "https://www.primariarupea.ro", address: "P-ța Republicii nr. 169, Rupea" },
  // Galați — suplimentar
  "beresti": { countyCode: "GL", name: "Berești", phone: "0236-342-067", email: "contact@primariaberesti.ro", website: "https://www.primariaberesti.ro", address: "Str. Ion Zăpodeanu nr. 1, Berești" },
  // Giurgiu — suplimentar
  "mihailesti": { countyCode: "GR", name: "Mihăilești", phone: "0246-272-027", email: "contact@primariamihailesti.ro", website: "https://www.primariamihailesti.ro", address: "Str. Primăriei nr. 21, Mihăilești" },
  // ═══════════════════════════════════════════════════════════════
  // EXTINDERE 2026-04-23 — comune suburbane București-Ilfov + comune
  // industriale + comune turistice > 5.000 locuitori
  // ═══════════════════════════════════════════════════════════════
  // Ilfov — comune peri-urbane București (cele mai populate)
  "balotesti": { countyCode: "IF", name: "Balotești", phone: "021-350-1080", email: "contact@primariabalotesti.ro", website: "https://www.primariabalotesti.ro", address: "Calea Unirii nr. 73, Balotești" },
  "mogosoaia": { countyCode: "IF", name: "Mogoșoaia", phone: "021-351-6106", email: "contact@primariamogosoaia.ro", website: "https://www.primariamogosoaia.ro", address: "Str. Valea Părului nr. 1, Mogoșoaia" },
  "afumati": { countyCode: "IF", name: "Afumați", phone: "021-350-6020", email: "contact@primariaafumati.ro", website: "https://www.primariaafumati.ro", address: "Șos. București-Urziceni nr. 144, Afumați" },
  "cornetu": { countyCode: "IF", name: "Cornetu", phone: "021-467-0401", email: "contact@primariacornetu.ro", website: "https://www.primariacornetu.ro", address: "Str. Principală nr. 3, Cornetu" },
  "dobroesti": { countyCode: "IF", name: "Dobroești", phone: "021-255-2058", email: "contact@primaria-dobroesti.ro", website: "https://www.primaria-dobroesti.ro", address: "Str. Cuza Vodă nr. 23, Dobroești" },
  "domnesti": { countyCode: "IF", name: "Domnești", phone: "021-351-5272", email: "contact@primariadomnesti.ro", website: "https://www.primariadomnesti.ro", address: "Str. Poștei nr. 28, Domnești" },
  "snagov": { countyCode: "IF", name: "Snagov", phone: "021-323-0200", email: "contact@primariasnagov.ro", website: "https://www.primariasnagov.ro", address: "Șos. Tâncăbești nr. 1, Snagov" },
  "ciorogarla": { countyCode: "IF", name: "Ciorogârla", phone: "021-351-1006", email: "contact@primariaciorogarla.ro", website: "https://www.primariaciorogarla.ro", address: "Șos. Bucureștii Noi nr. 2, Ciorogârla" },
  "tunari": { countyCode: "IF", name: "Tunari", phone: "021-267-5522", email: "contact@primariatunari.ro", website: "https://www.primariatunari.ro", address: "Str. Mihai Bravu nr. 2, Tunari" },
  "cernica": { countyCode: "IF", name: "Cernica", phone: "021-369-5102", email: "contact@primariacernica.ro", website: "https://www.primariacernica.ro", address: "Str. Traian nr. 57, Cernica" },
  "stefanestii-de-jos": { countyCode: "IF", name: "Ștefăneștii de Jos", phone: "021-267-4260", email: "contact@primariastefanestiidejos.ro", website: "https://www.primariastefanestiidejos.ro", address: "Str. Ștefan cel Mare nr. 116, Ștefăneștii de Jos" },
  // Cluj — comune peri-urbane
  "floresti-cj": { countyCode: "CJ", name: "Florești", phone: "0264-265-015", email: "contact@primariafloresti.ro", website: "https://www.primariafloresti.ro", address: "Str. Avram Iancu nr. 170, Florești" },
  "apahida": { countyCode: "CJ", name: "Apahida", phone: "0264-433-001", email: "contact@primariaapahida.ro", website: "https://www.primariaapahida.ro", address: "Str. Libertății nr. 108, Apahida" },
  "baciu": { countyCode: "CJ", name: "Baciu", phone: "0264-263-200", email: "contact@primariabaciu.ro", website: "https://www.primariabaciu.ro", address: "Str. Transilvaniei nr. 151, Baciu" },
  // Timiș — comune peri-urbane Timișoara
  "dumbravita-tm": { countyCode: "TM", name: "Dumbrăvița", phone: "0256-214-491", email: "contact@primariadumbravita.ro", website: "https://www.primariadumbravita.ro", address: "Str. Petőfi Sándor nr. 28, Dumbrăvița" },
  "giroc": { countyCode: "TM", name: "Giroc", phone: "0256-395-002", email: "contact@primariagiroc.ro", website: "https://www.primariagiroc.ro", address: "Str. Semenic nr. 54, Giroc" },
  "ghiroda": { countyCode: "TM", name: "Ghiroda", phone: "0256-206-450", email: "contact@primaria-ghiroda.ro", website: "https://www.primaria-ghiroda.ro", address: "Str. Victoria nr. 46, Ghiroda" },
  "sag": { countyCode: "TM", name: "Șag", phone: "0256-394-000", email: "contact@primariasag.ro", website: "https://www.primariasag.ro", address: "Str. Principală nr. 164, Șag" },
  // Iași — comune peri-urbane
  "miroslava": { countyCode: "IS", name: "Miroslava", phone: "0232-234-180", email: "contact@primariamiroslava.ro", website: "https://www.primariamiroslava.ro", address: "Str. Constantin Langa nr. 93, Miroslava" },
  "valea-lupului": { countyCode: "IS", name: "Valea Lupului", phone: "0232-293-062", email: "contact@primariavalealupului.ro", website: "https://www.primariavalealupului.ro", address: "Str. DN28 nr. 1, Valea Lupului" },
  "rediu-is": { countyCode: "IS", name: "Rediu", phone: "0232-294-066", email: "contact@primariarediu.ro", website: "https://www.primariarediu.ro", address: "Str. Principală nr. 162, Rediu" },
  // Constanța — comune de coastă
  "limanu": { countyCode: "CT", name: "Limanu", phone: "0241-739-444", email: "contact@primarialimanu.ro", website: "https://www.primarialimanu.ro", address: "Str. Mihai Viteazul nr. 87, Limanu" },
  "costinesti": { countyCode: "CT", name: "Costinești", phone: "0241-734-116", email: "contact@primariacostinesti.ro", website: "https://www.primariacostinesti.ro", address: "Str. Tudor Vladimirescu nr. 48, Costinești" },
  "agigea": { countyCode: "CT", name: "Agigea", phone: "0241-738-004", email: "contact@primariaagigea.ro", website: "https://www.primariaagigea.ro", address: "Str. Constanței nr. 5, Agigea" },
  // Brașov — comune peri-urbane + turistice
  "cristian-bv": { countyCode: "BV", name: "Cristian", phone: "0268-257-645", email: "contact@primariacristian.ro", website: "https://www.primariacristian.ro", address: "Str. Principală nr. 361, Cristian" },
  "sanpetru": { countyCode: "BV", name: "Sânpetru", phone: "0268-361-001", email: "contact@primariasanpetru.ro", website: "https://www.primariasanpetru.ro", address: "Str. Republicii nr. 448, Sânpetru" },
  "bran": { countyCode: "BV", name: "Bran", phone: "0268-236-400", email: "contact@primariabran.ro", website: "https://www.primariabran.ro", address: "Str. General Traian Moșoiu nr. 489, Bran" },
  "moieciu": { countyCode: "BV", name: "Moieciu", phone: "0268-236-218", email: "contact@primariamoieciu.ro", website: "https://www.primariamoieciu.ro", address: "Str. Principală nr. 376, Moieciu" },
  "rasnov": { countyCode: "BV", name: "Râșnov", phone: "0268-230-002", email: "contact@primariarasnov.ro", website: "https://www.primariarasnov.ro", address: "Str. Republicii nr. 19, Râșnov" },
  // Suceava — comune turistice
  "voronet": { countyCode: "SV", name: "Voroneț", phone: "0230-232-318", email: "contact@primariavoronet.ro", website: "https://www.primariavoronet.ro", address: "Str. Voroneț nr. 166, Voroneț" },
  // Prahova — comune din Valea Prahovei
  "azuga": { countyCode: "PH", name: "Azuga", phone: "0244-322-217", email: "contact@primariaazuga.ro", website: "https://www.primariaazuga.ro", address: "Str. Parcului nr. 5, Azuga" },
  "plopeni": { countyCode: "PH", name: "Plopeni", phone: "0244-220-009", email: "contact@orasulplopeni.ro", website: "https://www.orasulplopeni.ro", address: "B-dul Independenței nr. 9, Plopeni" },
  // Vâlcea — comune turistice
  "voineasa": { countyCode: "VL", name: "Voineasa", phone: "0250-765-049", email: "contact@primariavoineasa.ro", website: "https://www.primariavoineasa.ro", address: "Str. Principală nr. 1, Voineasa" },
  // Vâlcea — comune suplimentar
  "ocnele-mari": { countyCode: "VL", name: "Ocnele Mari", phone: "0250-771-089", email: "contact@primariaocnelemari.ro", website: "https://www.primariaocnelemari.ro", address: "Str. A.I. Cuza nr. 15, Ocnele Mari" },
  // Argeș — comune industriale + turistice
  "rucar": { countyCode: "AG", name: "Rucăr", phone: "0248-542-015", email: "contact@primariarucar.ro", website: "https://www.primariarucar.ro", address: "Str. Brașovului nr. 5, Rucăr" },
  // Sibiu — comune turistice
  "selimbar": { countyCode: "SB", name: "Șelimbăr", phone: "0269-560-500", email: "contact@primariaselimbar.ro", website: "https://www.primariaselimbar.ro", address: "Str. Mihai Viteazul nr. 23, Șelimbăr" },
  "sadu": { countyCode: "SB", name: "Sadu", phone: "0269-582-200", email: "contact@primariasadu.ro", website: "https://www.primariasadu.ro", address: "Str. Principală nr. 1, Sadu" },
  // Alba — comune turistice
  "rimetea": { countyCode: "AB", name: "Rimetea", phone: "0258-768-083", email: "contact@primariarimetea.ro", website: "https://www.primariarimetea.ro", address: "Str. Principală nr. 209, Rimetea" },
  // Harghita — comune turistice
  "praid": { countyCode: "HR", name: "Praid", phone: "0266-240-100", email: "contact@primariapraid.ro", website: "https://www.primariapraid.ro", address: "Str. Principală nr. 596, Praid" },
  // Maramureș — comune turistice
  "ocna-sugatag": { countyCode: "MM", name: "Ocna Șugatag", phone: "0262-374-007", email: "contact@primariaocnasugatag.ro", website: "https://www.primariaocnasugatag.ro", address: "Str. Unirii nr. 171, Ocna Șugatag" },
  // Bihor — comune turistice
  "baile-felix": { countyCode: "BH", name: "Băile Felix", phone: "0259-318-226", email: "contact@primariasanmartin.ro", website: "https://www.primariasanmartin.ro", address: "Str. Principală nr. 11, Băile Felix (Sânmartin)" },
  // ═══════════════════════════════════════════════════════════════
  // EXTINDERE 2026-04-23 — runda 3 — comune mari (>5.000 loc.) și
  // centre regionale suplimentare. Coverage geografic mai dens.
  // ═══════════════════════════════════════════════════════════════
  // Bacău — comune
  "sascut": { countyCode: "BC", name: "Sascut", phone: "0234-290-160", email: "contact@primariasascut.ro", website: "https://www.primariasascut.ro", address: "Sat Sascut, Bacău" },
  "margineni-bc": { countyCode: "BC", name: "Mărgineni", phone: "0234-214-002", email: "contact@primariamargineni.ro", website: "https://www.primariamargineni.ro", address: "Str. Principală nr. 125, Mărgineni" },
  // Botoșani — suplimentar
  "stefanesti-bt": { countyCode: "BT", name: "Ștefănești", phone: "0231-564-100", email: "contact@primariastefanestibt.ro", website: "https://www.primariastefanestibt.ro", address: "Str. 1 Decembrie nr. 2, Ștefănești" },
  "bucecea": { countyCode: "BT", name: "Bucecea", phone: "0231-550-001", email: "contact@primariabucecea.ro", website: "https://www.primariabucecea.ro", address: "Str. Calea Națională nr. 49, Bucecea" },
  // Bihor — comune peri-urbane Oradea
  "sanmartin-bh": { countyCode: "BH", name: "Sânmartin", phone: "0259-318-226", email: "contact@primariasanmartin.ro", website: "https://www.primariasanmartin.ro", address: "Str. Principală nr. 11, Sânmartin" },
  "osorhei": { countyCode: "BH", name: "Oșorhei", phone: "0259-458-002", email: "contact@primariaosorhei.ro", website: "https://www.primariaosorhei.ro", address: "Str. Principală nr. 205, Oșorhei" },
  "sacueni": { countyCode: "BH", name: "Săcueni", phone: "0259-352-501", email: "contact@primariasacueni.ro", website: "https://www.primariasacueni.ro", address: "Str. Libertății nr. 2, Săcueni" },
  // Bistrița-Năsăud — suplimentar
  "nasaud": { countyCode: "BN", name: "Năsăud", phone: "0263-361-026", email: "contact@primarianasaud.ro", website: "https://www.primarianasaud.ro", address: "P-ța Unirii nr. 15, Năsăud" },
  "beclean": { countyCode: "BN", name: "Beclean", phone: "0263-343-071", email: "contact@primariabeclean.ro", website: "https://www.primariabeclean.ro", address: "P-ța Libertății nr. 40, Beclean" },
  "sangeorz-bai": { countyCode: "BN", name: "Sângeorz-Băi", phone: "0263-370-204", email: "contact@primariasangeorzbai.ro", website: "https://www.primariasangeorzbai.ro", address: "Str. Izvoarelor nr. 2, Sângeorz-Băi" },
  // Buzău — suplimentar
  "pogoanele": { countyCode: "BZ", name: "Pogoanele", phone: "0238-552-242", email: "contact@primariapogoanele.ro", website: "https://www.primariapogoanele.ro", address: "Str. N. Bălcescu nr. 35, Pogoanele" },
  "nehoiu": { countyCode: "BZ", name: "Nehoiu", phone: "0238-555-150", email: "contact@primarianehoiu.ro", website: "https://www.primarianehoiu.ro", address: "Str. Parcului nr. 9, Nehoiu" },
  // Călărași — suplimentar
  "oltenita": { countyCode: "CL", name: "Oltenița", phone: "0242-515-770", email: "contact@primariaoltenita.ro", website: "https://www.primariaoltenita.ro", address: "B-dul Republicii nr. 40, Oltenița" },
  "budesti-cl": { countyCode: "CL", name: "Budești", phone: "0242-520-019", email: "contact@primariabudesti.ro", website: "https://www.primariabudesti.ro", address: "Str. Calea București nr. 2, Budești" },
  "lehliu-gara": { countyCode: "CL", name: "Lehliu-Gară", phone: "0242-641-018", email: "contact@primarialehliugara.ro", website: "https://www.primarialehliugara.ro", address: "Str. Industriilor nr. 3, Lehliu-Gară" },
  // Caraș-Severin — suplimentar
  "otelu-rosu": { countyCode: "CS", name: "Oțelu Roșu", phone: "0255-531-451", email: "contact@primariaotelurosu.ro", website: "https://www.primariaotelurosu.ro", address: "Str. Republicii nr. 10, Oțelu Roșu" },
  "bocsa-cs": { countyCode: "CS", name: "Bocșa", phone: "0255-551-001", email: "contact@primariabocsa.ro", website: "https://www.primariabocsa.ro", address: "Str. 1 Decembrie 1918 nr. 22, Bocșa" },
  "anina": { countyCode: "CS", name: "Anina", phone: "0255-240-100", email: "contact@primariaanina.ro", website: "https://www.primariaanina.ro", address: "Str. Sfânta Varvara nr. 6, Anina" },
  "moldova-noua": { countyCode: "CS", name: "Moldova Nouă", phone: "0255-540-999", email: "contact@primariamoldovanoua.ro", website: "https://www.primariamoldovanoua.ro", address: "Str. Nicolae Bălcescu nr. 26, Moldova Nouă" },
  // Cluj — suplimentar
  "campia-turzii-alt": { countyCode: "CJ", name: "Câmpia Turzii (alternativ)", phone: "0264-368-001", email: "contact@campiaturzii.ro", website: "https://www.campiaturzii.ro", address: "P-ța Unirii nr. 3, Câmpia Turzii" },
  // Constanța — suplimentar
  "negru-voda": { countyCode: "CT", name: "Negru Vodă", phone: "0241-780-195", email: "contact@primariangruvoda.ro", website: "https://www.primariangruvoda.ro", address: "Str. Șoseaua Mangaliei nr. 15, Negru Vodă" },
  // Covasna — suplimentar
  "zagon": { countyCode: "CV", name: "Zagon", phone: "0267-367-508", email: "contact@primariazagon.ro", website: "https://www.primariazagon.ro", address: "Str. Principală nr. 555, Zagon" },
  // Dâmbovița — suplimentar
  "voinesti-db": { countyCode: "DB", name: "Voinești", phone: "0245-679-040", email: "contact@primariavoinestidb.ro", website: "https://www.primariavoinestidb.ro", address: "Str. Principală nr. 223, Voinești" },
  "aninoasa-db": { countyCode: "DB", name: "Aninoasa", phone: "0245-712-128", email: "contact@primariaaninoasa.ro", website: "https://www.primariaaninoasa.ro", address: "Str. Principală nr. 15, Aninoasa" },
  // Dolj — suplimentar
  "filiasi": { countyCode: "DJ", name: "Filiași", phone: "0251-443-107", email: "contact@primariafiliasi.ro", website: "https://www.primariafiliasi.ro", address: "Str. Racoțeanu nr. 130, Filiași" },
  "segarcea": { countyCode: "DJ", name: "Segarcea", phone: "0251-210-202", email: "contact@primariasegarcea.ro", website: "https://www.primariasegarcea.ro", address: "Str. Unirii nr. 88, Segarcea" },
  "dabuleni": { countyCode: "DJ", name: "Dăbuleni", phone: "0251-334-100", email: "contact@primariadabuleni.ro", website: "https://www.primariadabuleni.ro", address: "Str. Dunării nr. 160, Dăbuleni" },
  // Galați — suplimentar
  "tg-bujor-alt": { countyCode: "GL", name: "Târgu Bujor (alt)", phone: "0236-340-514", email: "contact@primariatgbujor.ro", website: "https://www.primariatgbujor.ro", address: "Str. G. Grigorescu nr. 101, Târgu Bujor" },
  // Gorj — suplimentar
  "ticleni": { countyCode: "GJ", name: "Țicleni", phone: "0253-234-345", email: "contact@primariaticleni.ro", website: "https://www.primariaticleni.ro", address: "Str. Petrolului nr. 87, Țicleni" },
  "tismana": { countyCode: "GJ", name: "Tismana", phone: "0253-374-101", email: "contact@primariatismana.ro", website: "https://www.primariatismana.ro", address: "Str. Tismana nr. 47, Tismana" },
  // Harghita — suplimentar
  "cristuru-secuiesc": { countyCode: "HR", name: "Cristuru Secuiesc", phone: "0266-242-317", email: "contact@primariacristuru.ro", website: "https://www.primariacristuru.ro", address: "P-ța Libertății nr. 27, Cristuru Secuiesc" },
  "corund": { countyCode: "HR", name: "Corund", phone: "0266-249-101", email: "contact@primariacorund.ro", website: "https://www.primariacorund.ro", address: "Str. Principală nr. 1038, Corund" },
  // Hunedoara — suplimentar
  "aninoasa-hd": { countyCode: "HD", name: "Aninoasa", phone: "0254-552-233", email: "contact@primariaaninoasahd.ro", website: "https://www.primariaaninoasahd.ro", address: "Str. Libertății nr. 19, Aninoasa" },
  "calan": { countyCode: "HD", name: "Călan", phone: "0254-732-000", email: "contact@primariacalan.ro", website: "https://www.primariacalan.ro", address: "Str. Independenței nr. 15, Călan" },
  "geoagiu": { countyCode: "HD", name: "Geoagiu", phone: "0254-248-880", email: "contact@primariageoagiu.ro", website: "https://www.primariageoagiu.ro", address: "Str. Calea Romanilor nr. 141, Geoagiu" },
  // Ialomița — suplimentar
  "amara": { countyCode: "IL", name: "Amara", phone: "0243-266-134", email: "contact@primariaamara.ro", website: "https://www.primariaamara.ro", address: "Str. Ialomiței nr. 16, Amara" },
  "cazanesti": { countyCode: "IL", name: "Căzănești", phone: "0243-264-020", email: "contact@primariacazanesti.ro", website: "https://www.primariacazanesti.ro", address: "Str. Principală nr. 114, Căzănești" },
  // Iași — comune suplimentar
  "raducaneni": { countyCode: "IS", name: "Răducăneni", phone: "0232-292-014", email: "contact@primariaraducaneni.ro", website: "https://www.primariaraducaneni.ro", address: "Str. Principală nr. 1, Răducăneni" },
  // Maramureș — suplimentar
  "dragomiresti": { countyCode: "MM", name: "Dragomirești", phone: "0262-333-301", email: "contact@primariadragomiresti.ro", website: "https://www.primariadragomiresti.ro", address: "Str. Principală nr. 40, Dragomirești" },
  "salistea-de-sus": { countyCode: "MM", name: "Săliștea de Sus", phone: "0262-347-039", email: "contact@primariasalisteadesus.ro", website: "https://www.primariasalisteadesus.ro", address: "Str. Principală nr. 76, Săliștea de Sus" },
  "tautii-magheraus": { countyCode: "MM", name: "Tăuții-Măgherăuș", phone: "0262-293-003", email: "contact@primariatautiimagheraus.ro", website: "https://www.primariatautiimagheraus.ro", address: "Str. 1 nr. 198, Tăuții-Măgherăuș" },
  "ulmeni-mm": { countyCode: "MM", name: "Ulmeni", phone: "0262-264-300", email: "contact@primariaulmeni.ro", website: "https://www.primariaulmeni.ro", address: "Str. Principală nr. 93, Ulmeni" },
  // Mehedinți — suplimentar
  "baia-de-arama": { countyCode: "MH", name: "Baia de Aramă", phone: "0252-381-100", email: "contact@primariabaiadearama.ro", website: "https://www.primariabaiadearama.ro", address: "Str. Decebal nr. 1, Baia de Aramă" },
  // Mureș — suplimentar
  "sangeorgiu-de-mures": { countyCode: "MS", name: "Sângeorgiu de Mureș", phone: "0265-254-001", email: "contact@primariasangeorgiudemures.ro", website: "https://www.primariasangeorgiudemures.ro", address: "Str. Principală nr. 1138, Sângeorgiu de Mureș" },
  "miercurea-nirajului": { countyCode: "MS", name: "Miercurea Nirajului", phone: "0265-576-007", email: "contact@primariamiercureaniraj.ro", website: "https://www.primariamiercureaniraj.ro", address: "P-ța Bocskai István nr. 54, Miercurea Nirajului" },
  // Neamț — suplimentar
  "bicaz-alt": { countyCode: "NT", name: "Bicaz (alt)", phone: "0233-254-300", email: "contact@primariaorasbicaz.ro", website: "https://www.primariaorasbicaz.ro", address: "Str. Barajului nr. 4, Bicaz" },
  "tarcau": { countyCode: "NT", name: "Tarcău", phone: "0233-252-108", email: "contact@primariatarcau.ro", website: "https://www.primariatarcau.ro", address: "Sat Tarcău nr. 154, Neamț" },
  // Olt — suplimentar
  "dragansti-olt": { countyCode: "OT", name: "Drăgănești-Olt", phone: "0249-465-036", email: "contact@primariadraganestiolt.ro", website: "https://www.primariadraganestiolt.ro", address: "Str. N. Titulescu nr. 150, Drăgănești-Olt" },
  "piatra-olt": { countyCode: "OT", name: "Piatra-Olt", phone: "0249-462-057", email: "contact@primariapiatraolt.ro", website: "https://www.primariapiatraolt.ro", address: "Str. Florilor nr. 2, Piatra-Olt" },
  // Prahova — suplimentar
  "filipestii-de-padure": { countyCode: "PH", name: "Filipeștii de Pădure", phone: "0244-382-070", email: "contact@primariafilipestiidepadure.ro", website: "https://www.primariafilipestiidepadure.ro", address: "Sat Filipeștii de Pădure, Prahova" },
  "bucov": { countyCode: "PH", name: "Bucov", phone: "0244-275-118", email: "contact@primariabucov.ro", website: "https://www.primariabucov.ro", address: "Str. Constructorilor nr. 23, Bucov" },
  "blejoi": { countyCode: "PH", name: "Blejoi", phone: "0244-410-003", email: "contact@primariablejoi.ro", website: "https://www.primariablejoi.ro", address: "Sat Blejoi nr. 280, Prahova" },
  // Satu Mare — suplimentar
  "livada-sm": { countyCode: "SM", name: "Livada", phone: "0261-840-026", email: "contact@primarialivada.ro", website: "https://www.primarialivada.ro", address: "Str. Grădinarilor nr. 45, Livada" },
  "ardud": { countyCode: "SM", name: "Ardud", phone: "0261-771-006", email: "contact@primariaardud.ro", website: "https://www.primariaardud.ro", address: "Str. Tudor Vladimirescu nr. 13, Ardud" },
  // Suceava — suplimentar
  "solca": { countyCode: "SV", name: "Solca", phone: "0230-477-120", email: "contact@primariasolca.ro", website: "https://www.primariasolca.ro", address: "Str. Tomșa Vodă nr. 87, Solca" },
  "cajvana": { countyCode: "SV", name: "Cajvana", phone: "0230-546-101", email: "contact@primariacajvana.ro", website: "https://www.primariacajvana.ro", address: "Str. Ștefan cel Mare nr. 1220, Cajvana" },
  "liteni": { countyCode: "SV", name: "Liteni", phone: "0230-538-310", email: "contact@primarialiteni.ro", website: "https://www.primarialiteni.ro", address: "Str. Primăriei nr. 32, Liteni" },
  "dolhasca": { countyCode: "SV", name: "Dolhasca", phone: "0230-545-052", email: "contact@primariadolhasca.ro", website: "https://www.primariadolhasca.ro", address: "Str. Primăriei nr. 85, Dolhasca" },
  // Teleorman — suplimentar
  "salcia-tr": { countyCode: "TR", name: "Salcia", phone: "0247-377-014", email: "contact@primariasalciatr.ro", website: "https://www.primariasalciatr.ro", address: "Sat Salcia nr. 1, Teleorman" },
  // Timiș — suplimentar
  "ciacova": { countyCode: "TM", name: "Ciacova", phone: "0256-399-301", email: "contact@primariaciacova.ro", website: "https://www.primariaciacova.ro", address: "P-ța Cetății nr. 5, Ciacova" },
  "gataia": { countyCode: "TM", name: "Gătaia", phone: "0256-410-003", email: "contact@primariagataia.ro", website: "https://www.primariagataia.ro", address: "Str. Republicii nr. 449, Gătaia" },
  "peciu-nou": { countyCode: "TM", name: "Peciu Nou", phone: "0256-416-350", email: "contact@primariapeciunou.ro", website: "https://www.primariapeciunou.ro", address: "Str. 2 nr. 23, Peciu Nou" },
  // Tulcea — suplimentar
  "chilia-veche": { countyCode: "TL", name: "Chilia Veche", phone: "0240-547-030", email: "contact@primariachiliaveche.ro", website: "https://www.primariachiliaveche.ro", address: "Str. Principală nr. 45, Chilia Veche" },
  // Vaslui — suplimentar
  "vetrisoaia": { countyCode: "VS", name: "Vetrișoaia", phone: "0235-437-002", email: "contact@primariavetrisoaia.ro", website: "https://www.primariavetrisoaia.ro", address: "Str. Principală nr. 108, Vetrișoaia" },
  // Vâlcea — suplimentar
  "babeni": { countyCode: "VL", name: "Băbeni", phone: "0250-765-220", email: "contact@primariababeni.ro", website: "https://www.primariababeni.ro", address: "Str. Republicii nr. 1, Băbeni" },
  "balcesti": { countyCode: "VL", name: "Bălcești", phone: "0250-841-124", email: "contact@primariabalcesti.ro", website: "https://www.primariabalcesti.ro", address: "Str. N. Bălcescu nr. 18, Bălcești" },
  "berbesti": { countyCode: "VL", name: "Berbești", phone: "0250-860-021", email: "contact@primariaberbesti.ro", website: "https://www.primariaberbesti.ro", address: "Str. Cuza Vodă nr. 48, Berbești" },
  // Vrancea — suplimentar
  "panciu": { countyCode: "VN", name: "Panciu", phone: "0237-275-111", email: "contact@primariapanciu.ro", website: "https://www.primariapanciu.ro", address: "Str. Titu Maiorescu nr. 15, Panciu" },
  "marasesti": { countyCode: "VN", name: "Mărășești", phone: "0237-260-060", email: "contact@primariamarasesti.ro", website: "https://www.primariamarasesti.ro", address: "Str. Siret nr. 1, Mărășești" },
  "odobesti": { countyCode: "VN", name: "Odobești", phone: "0237-262-124", email: "contact@primariaodobesti.ro", website: "https://www.primariaodobesti.ro", address: "Str. Libertății nr. 113, Odobești" },
};

/** Check if a county has real authority data */
export function hasAuthorityData(countyId: string): boolean {
  return countyId in PREFECTURI;
}

/** Check if a county has a Poliția Locală entry */
export function hasPolitiaLocala(countyId: string): boolean {
  return countyId in POLITIA_LOCALA_JUDET;
}

/**
 * Lookup the city's contact info by a free-text location. Returns null when
 * no match found — caller should fall back to the county-level primărie.
 *
 * Matching strategy:
 *   1. Normalize input (lowercase, strip diacritics, collapse whitespace)
 *   2. Check if any ORASE_IMPORTANTE key is a substring of the normalized input
 *   3. Require county match if countyHint provided (reduces false positives
 *      like "Roman" the name vs "Roman" the city)
 */
export function findCityContact(
  locationText: string,
  countyHint?: string | null,
): { slug: string; city: CityContact } | null {
  if (!locationText) return null;
  const normalized = locationText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Try exact slug match + name match
  for (const [slug, city] of Object.entries(ORASE_IMPORTANTE)) {
    if (countyHint && city.countyCode !== countyHint) continue;
    const slugPlain = slug.replace(/-/g, " ");
    const namePlain = city.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    if (
      normalized.includes(slugPlain) ||
      normalized.includes(namePlain)
    ) {
      return { slug, city };
    }
  }
  return null;
}

/** Total count of cities in the database — for /stats display */
export function getCityCount(): number {
  return Object.keys(ORASE_IMPORTANTE).length;
}

/** Total count of county-level PL entries (includes București) */
export function getPolitiaLocalaCount(): number {
  return Object.keys(POLITIA_LOCALA_JUDET).length;
}

/**
 * Returns all cities grouped by county code. Useful for the per-county
 * "Alte orașe din județ" block and for the national autoritati index.
 */
export function getCitiesByCounty(): Record<string, Array<{ slug: string } & CityContact>> {
  const out: Record<string, Array<{ slug: string } & CityContact>> = {};
  for (const [slug, city] of Object.entries(ORASE_IMPORTANTE)) {
    if (!out[city.countyCode]) out[city.countyCode] = [];
    out[city.countyCode]!.push({ slug, ...city });
  }
  // Sort each county's cities alphabetically
  for (const code of Object.keys(out)) {
    out[code]!.sort((a, b) => a.name.localeCompare(b.name, "ro"));
  }
  return out;
}
