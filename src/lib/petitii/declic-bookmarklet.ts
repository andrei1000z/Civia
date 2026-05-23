/**
 * Declic auto-fill bookmarklet generator.
 *
 * User-ul își trage un bookmark personalizat în bookmark bar (1 dată).
 * Pe orice pagină Declic, click pe bookmark → JS detectează inputs și le
 * fill-uie cu datele lui Civia (firstName, lastName, email, county, phone).
 *
 * Funcționează pe TOATE sub-domeniile Declic (campaniamea, noifacem,
 * declic.ro, de-clic.ro) — script-ul folosește euristică de matching pe
 * `name` + `id` + `aria-label` + `placeholder` ca să detecteze câmpurile
 * indiferent de naming convention.
 *
 * 100% legal: user-script controlat de user, semnatura electronică tot
 * a lui rămâne (apasă „Semnează" manual). Vezi eIDAS art. 3 pct. 10.
 */

import type { QuickSignData } from "./declic-prefill";

/**
 * Returns a `javascript:` URL ready to be turned into a draggable anchor
 * for the bookmark bar. The function body inlines the user's data so the
 * bookmarklet runs offline (no Civia round-trip).
 */
export function buildDeclicBookmarklet(data: QuickSignData): string {
  // Sanitize: replace any single-quote in data so the JSON.stringify→single-quote
  // wrap doesn't break.
  const payload = JSON.stringify({
    firstName: data.firstName ?? "",
    lastName: data.lastName ?? "",
    email: data.email ?? "",
    county: data.county ?? "",
    phone: data.phone ?? "",
  });

  // Bookmarklet body: a self-contained IIFE that:
  // 1. Verifies it's running on a declic.ro domain (safety)
  // 2. Walks all inputs/selects, classifies each by name/id/aria/placeholder
  // 3. Fills value + dispatches input/change events (so Vue/React state syncs)
  // 4. Toast confirmation to the user
  const body = `
(function(){
  var d=${payload};
  if(!/declic\\.ro$/i.test(location.hostname) && !/de-clic\\.ro$/i.test(location.hostname)){
    alert("Civia: acest bookmarklet funcționează doar pe paginile declic.ro");
    return;
  }
  var countyVariants=[d.county, d.county==="BUCUREȘTI"?"București":d.county, (d.county||"").toUpperCase(), (d.county||"").toLowerCase()];
  function setVal(el, val){
    if(!val) return false;
    if(el.tagName==="SELECT"){
      var matched=null;
      for(var i=0;i<el.options.length;i++){
        var optVal=(el.options[i].value||"").toString();
        var optText=(el.options[i].text||"").toString();
        if(countyVariants.indexOf(optVal)>=0 || countyVariants.indexOf(optText)>=0){
          matched=el.options[i].value; break;
        }
      }
      if(matched===null){ for(var j=0;j<el.options.length;j++){
        if(el.options[j].text && el.options[j].text.toLowerCase().indexOf((val||"").toLowerCase())>=0){
          matched=el.options[j].value; break;
        }
      }}
      if(matched!==null){
        var setter=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,"value").set;
        setter.call(el, matched);
      } else return false;
    } else {
      var inputSetter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;
      inputSetter.call(el, val);
    }
    el.dispatchEvent(new Event("input",{bubbles:true}));
    el.dispatchEvent(new Event("change",{bubbles:true}));
    return true;
  }
  function describe(el){
    return ((el.name||"")+" "+(el.id||"")+" "+(el.getAttribute("aria-label")||"")+" "+(el.placeholder||"")+" "+(el.getAttribute("autocomplete")||"")).toLowerCase();
  }
  var filled=0, total=0;
  var all=document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]), select");
  all.forEach(function(el){
    var s=describe(el);
    var did=false;
    if(/given|first|prenume/.test(s)) did=setVal(el, d.firstName);
    else if(/family|last|surname|nume[\\s_-]*de[\\s_-]*familie|^nume$|^lastname$/.test(s)) did=setVal(el, d.lastName);
    else if(/email|e[\\s_-]?mail|mail[\\s_-]?address/.test(s)) did=setVal(el, d.email);
    else if(/county|region|judet|jude\\u021b|district|state/.test(s)) did=setVal(el, d.county);
    else if(/phone|tel|telefon|phone[\\s_-]?number/.test(s)) did=setVal(el, d.phone);
    if(did){ filled++; }
    total++;
  });
  // Toast feedback
  var t=document.createElement("div");
  t.textContent="Civia: am completat "+filled+" câmpuri";
  t.style.cssText="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#059669;color:white;padding:12px 20px;border-radius:8px;font-family:sans-serif;font-weight:600;z-index:999999;box-shadow:0 8px 24px rgba(0,0,0,0.3)";
  document.body.appendChild(t);
  setTimeout(function(){t.remove();}, 3500);
})();
  `.trim().replace(/\s+/g, " ");

  return `javascript:${encodeURIComponent(body)}`;
}
