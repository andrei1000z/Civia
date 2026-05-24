-- 2026-05-24: stocăm adresa cetățeanului în sesizări ca să o putem
-- folosi în textul formal („Mă numesc X, locuiesc în Y") atât la
-- afișare cât și la re-generare ulterioară. Înainte, adresa era doar
-- input la /api/ai/improve (folosită o dată la generare apoi pierdută).

ALTER TABLE sesizari ADD COLUMN IF NOT EXISTS author_address text;
