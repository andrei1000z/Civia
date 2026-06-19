import { NextResponse } from "next/server";

/**
 * GET /api/v2/open311/services.json — list of service types (categories).
 *
 * Spec: http://wiki.open311.org/GeoReport_v2/#get-service-list
 */

const SERVICES = [
  { service_code: "groapa", service_name: "Groapă în carosabil", description: "Gropi pe drum public, periculoase pentru trafic." },
  { service_code: "trotuar", service_name: "Trotuar degradat", description: "Plăci sparte, borduri lipsă, denivelări." },
  { service_code: "stalpisori", service_name: "Stâlpișori anti-parcare lipsă", description: "Mașini parcate pe trotuar din lipsa elementelor de protecție." },
  { service_code: "parcare", service_name: "Parcare ilegală", description: "Vehicule parcate neregulamentar." },
  { service_code: "iluminat", service_name: "Iluminat public defect", description: "Becuri arse, stâlpi nefuncționali." },
  { service_code: "copac", service_name: "Copac periculos", description: "Ramuri uscate sau instabile, risc de cădere." },
  { service_code: "gunoi", service_name: "Gunoi / salubritate", description: "Containere supraîncărcate, gunoi împrăștiat." },
  { service_code: "canalizare", service_name: "Canalizare / inundații", description: "Capace lipsă, guri de scurgere înfundate." },
  { service_code: "semafor", service_name: "Semafor defect", description: "Sisteme de semaforizare nefuncționale." },
  { service_code: "semaforizare", service_name: "Semaforizare lipsă", description: "Cerere de montare semafor la intersecție sau trecere de pietoni nesemaforizată." },
  { service_code: "pietonal", service_name: "Traversare pietonală", description: "Treceri de pietoni periculoase." },
  { service_code: "graffiti", service_name: "Vandalism / graffiti", description: "Inscripții neautorizate pe clădiri publice." },
  { service_code: "mobilier", service_name: "Mobilier stradal", description: "Bănci, coșuri de gunoi, stații deteriorate." },
  { service_code: "zgomot", service_name: "Zgomot excesiv", description: "Depășire limite legale conform Ordinului 119/2014." },
  { service_code: "animale", service_name: "Câini comunitari", description: "Animale agresive sau haite periculoase." },
  { service_code: "transport", service_name: "Transport public", description: "Probleme STB / Metrorex / vehicule, stații." },
  { service_code: "afisaj", service_name: "Afișaj ilegal", description: "Publicitate neautorizată conform Legii 185/2013." },
  { service_code: "banda_transport", service_name: "Bandă transport public lipsă", description: "Lipsă bandă dedicată autobuz." },
  { service_code: "trecere_pietoni", service_name: "Trecere pietoni lipsă", description: "Lipsă trecere amenajată în zonă cu trafic pieton." },
  { service_code: "rampa_acces", service_name: "Rampă acces (Legea 448/2006)", description: "Lipsă rampă pentru persoane cu mobilitate redusă." },
  { service_code: "colectare_selectiva", service_name: "Colectare selectivă", description: "Lipsa infrastructurii conform Legii 211/2011." },
  { service_code: "fumat_interzis", service_name: "Fumat în spațiu public (Legea 15/2016)", description: "Fumat în zone unde e interzis." },
  { service_code: "altele", service_name: "Altele", description: "Orice altă problemă civică care nu se încadrează în categoriile de mai sus." },
];

export async function GET() {
  const services = SERVICES.map((s) => ({
    ...s,
    type: "realtime",
    keywords: s.service_code,
    metadata: false,
  }));
  return NextResponse.json(services, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
