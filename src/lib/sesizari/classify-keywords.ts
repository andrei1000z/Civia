/**
 * Override-uri DETERMINISTE pentru clasificarea tipului de sesizare — pentru
 * semnalele clare și ușor de confundat de modelul 8b. Rulează ÎNAINTE de AI;
 * dacă întoarce un tip, sărim apelul AI (rapid + 100% sigur). Restul → AI.
 *
 * Bug raportat (2026-06-19): „mașinile ocupă trotuarul … să pună stâlpișori" era
 * clasificat „trotuar" (modelul prindea cuvântul „trotuar" ca LOC, nu defectul).
 * Cererea de stâlpișori anti-parcare e un semnal explicit → „stalpisori".
 */
export function deterministicTip(text: string): string | null {
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const cereStalpisori = /(stalpisor|stalpi\s*anti|bolar|bollard)/.test(t);
  // Stâlpișorii anti-parcare există DOAR pe trotuar; un „gard pe linie tramvai"
  // e infrastructură de transport, nu stâlpișori.
  const eTramvai = /(tramvai|cale\s*ferata|\bsine\b|\blinia\s*\d)/.test(t);
  if (cereStalpisori && !eTramvai) return "stalpisori";

  // 2026-06-19 (feedback user numbyxix@) — CERERE de semafor NOU / semaforizarea
  // unei intersecții sau treceri de pietoni. Distincție clară față de „semafor"
  // (= semafor EXISTENT defect). „semaforizare" + verbe de instalare = semnal sigur.
  const eSemaforDefect = /semafor[a-z]*[^.!?]{0,25}(defect|stricat|\bars\b|stins|nefunction|nu (mai )?(merge|functioneaza))/.test(t);
  const cereSemafor =
    /semaforizar/.test(t) ||
    /(instal|montar|amplas|amenaj|pun|puna|monteze|instaleze|adaug)[a-z]*\s+([a-z]{1,6}\s+){0,2}semafor/.test(t) ||
    /semafor[a-z]*\s+(nou|lipseste|lipsa|necesar)/.test(t) ||
    /(nu (este|e|exista)|lipseste|lipsa de)\s*semafor/.test(t);
  if (cereSemafor && !eSemaforDefect) return "semaforizare";

  // 2026-06-20 (raport user) — loc de parcare TRASAT ILEGAL pe domeniul public
  // (marcaj neautorizat) ≠ „parcare" (mașină parcată ilegal). AI-ul prindea doar
  // „parcare…ilegal" → parcare. Semnal: verb de trasare + parcare + ilegal/singur.
  const ePeParcare = /(loc[a-z]*\s+de\s+parcare|parcare)/.test(t);
  const eTrasat = /(trasat|trasar|trasam|vopsit|vopse|desenat|pictat|delimitat|conturat)/.test(t);
  const eIlegalApropriat = /(ilegal|abuziv|neautoriz|fara drept|singur|privat|pe cont propriu|si-a facut|si-au facut|isi fac)/.test(t);
  if (ePeParcare && eTrasat && eIlegalApropriat) return "parcare_trasata";

  return null;
}
