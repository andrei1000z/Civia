-- Co-semnare reală pentru ANONIMI (fara user, fara email).
--
-- Bug raportat 19 mai 2026: utilizatorii apăsau „Trimite și tu" dar
-- counter-ul rămânea la 1 pentru că ruta de cosign nu insera rândul
-- când body-ul nu avea email + user_id. Cetățenii anonimi fără email
-- nu erau înregistrați deloc, doar timeline-ul primea eveniment.
--
-- Fix:
--   1. Adăugăm INDEX UNIQUE pe (sesizare_id, ip_hash) WHERE user_id IS
--      NULL AND email IS NULL — permite cosign anonim cu dedup pe IP.
--   2. NU sparge dedup-ul vechi (user/email) — INDEX-urile coexistă.
--
-- Riscuri:
--   - Două persoane in spatele aceluiași NAT pot da cosign doar o data
--     impreuna. Acceptabil — preferam asta in loc de spam de pe acelasi
--     IP. Userii care vor sa co-semneze concomitent oricum se logheaza
--     sau dau email.

CREATE UNIQUE INDEX IF NOT EXISTS idx_cosigners_ip_sesizare_anon
  ON public.sesizare_cosigners (sesizare_id, ip_hash)
  WHERE user_id IS NULL AND email IS NULL AND ip_hash IS NOT NULL;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 051 aplicata: dedup anonim pe ip_hash.' AS status;
