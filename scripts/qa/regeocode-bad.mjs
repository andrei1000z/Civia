const UA = { "User-Agent": "CivicRomania/1.0 (civia.ro)" };
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
async function geo(q){
  await sleep(1200);
  const url=`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=ro&limit=1&addressdetails=1&accept-language=ro`;
  try{ const r=await fetch(url,{headers:UA}); const a=await r.json(); const h=a[0];
    if(!h) return null;
    const lat=parseFloat(h.lat),lng=parseFloat(h.lon);
    if(lat<43.5||lat>48.3||lng<20.2||lng>29.7) return {bad:true,lat,lng,name:h.display_name};
    return {lat,lng,name:h.display_name};
  }catch{return null;}
}
const TARGETS = [
  { code:"00032", q:"Șoseaua Morarilor, Sector 2, București, România" },
  { code:"00033", q:"Piața Constituției, București, România" },
  { code:"00041", q:"Bulevardul Națiunilor Unite, București, România" },
  { code:"00065", q:"Cartierul Troianu, Roșiorii de Vede, România" },
  { code:"00065b", q:"Troianu, România" },
  { code:"00071", q:"NULL — troleibuz linia 69 (vehicul mobil, fără locație fixă)" },
];
for (const t of TARGETS){
  if (t.q.startsWith("NULL")) { console.log(`${t.code}: ${t.q}`); continue; }
  const r = await geo(t.q);
  console.log(`${t.code}: "${t.q}"`);
  console.log(`   → ${r ? `${r.lat.toFixed(4)},${r.lng.toFixed(4)} ${r.bad?'⚠️OUT-OF-RO':''} | ${r.name.slice(0,70)}` : 'NULL (negăsit)'}`);
}
