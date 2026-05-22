-- ============================================================
-- Migration 061: actualizari (changelog versiuni Civia)
-- ============================================================
--
-- Plan 5/23/2026 — pagina /actualizari acum servită din DB (vs hardcoded
-- în src/data/actualizari.ts). Admin poate adăuga/edita/șterge versiuni
-- din /admin/actualizari fără să facă deploy.
--
-- Tabela păstrează:
--   - metadata versiune (semver, dată cu oră, titlu)
--   - flag-uri (major, minimalist, published)
--   - opțional Markdown content (pentru minimalist render — v0.0.0 genesis)
--   - opțional descriere scurtă (Markdown)
--   - schimbări[] ca JSONB (categorie + text pentru fiecare bullet)
--
-- RLS: public can SELECT published. Admin (role='admin') poate INSERT/UPDATE/DELETE.

CREATE TABLE IF NOT EXISTS public.actualizari (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Semver „X.Y.Z" — unic per versiune. NU se schimbă după publicare.
  versiune TEXT NOT NULL UNIQUE,
  -- Datetime release-ului (cu oră) — afișat ca „23 mai 2026, 12:50".
  data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Titlu scurt pentru release — ex: „Civia se naște".
  titlu TEXT NOT NULL,
  -- Descriere opțională scurtă (Markdown suportă: **bold**, *italic*, etc.).
  descriere TEXT,
  -- Lista schimbărilor — JSONB array cu objecte
  -- { categorie: "release|feature|fix|ux|perf|security", text: "..." }
  schimbari JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- True pentru release-uri majore (badge „Release major" + styling diferit)
  major BOOLEAN NOT NULL DEFAULT FALSE,
  -- True pentru render minimalist (v0.0.0 genesis — card centrat + Markdown jos)
  minimalist BOOLEAN NOT NULL DEFAULT FALSE,
  -- Conținut Markdown lung pentru render minimalist (NULL altfel).
  -- Suport: **bold**, *italic*, ~~strike~~, __underline__, ==highlight==,
  -- # heading, ## h2, ### h3, - listă, [text](url), `cod`,
  -- {color:red}text{/color}, {size:large}text{/size}.
  continut_markdown TEXT,
  -- Published gate — drafts nu apar public până nu flip.
  published BOOLEAN NOT NULL DEFAULT TRUE,
  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actualizari_data_desc
  ON public.actualizari (data DESC) WHERE published = TRUE;

CREATE INDEX IF NOT EXISTS idx_actualizari_versiune
  ON public.actualizari (versiune);

-- Auto-update `updated_at` la fiecare modificare (trigger).
CREATE OR REPLACE FUNCTION update_actualizari_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS actualizari_updated_at ON public.actualizari;
CREATE TRIGGER actualizari_updated_at
  BEFORE UPDATE ON public.actualizari
  FOR EACH ROW
  EXECUTE FUNCTION update_actualizari_updated_at();

-- RLS — public read pentru published; admin full access.
ALTER TABLE public.actualizari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "actualizari_public_read" ON public.actualizari;
CREATE POLICY "actualizari_public_read"
  ON public.actualizari
  FOR SELECT
  USING (published = TRUE);

DROP POLICY IF EXISTS "actualizari_admin_all" ON public.actualizari;
CREATE POLICY "actualizari_admin_all"
  ON public.actualizari
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ─── Seed v0.0.0 (genesis release) ────────────────────────────────
INSERT INTO public.actualizari (
  versiune, data, titlu, descriere, schimbari, major, minimalist, continut_markdown
) VALUES (
  '0.0.0',
  '2026-05-23 12:50:00+03:00',
  'Civia se naște',
  NULL,
  '[]'::jsonb,
  FALSE,
  TRUE,
  E'**Civia** este o platformă civică independentă pentru România.\n\nCetățenii pot trimite **sesizări oficiale** către primării, prefecturi, Poliția Locală sau CNAIR în **90 de secunde**, conform legii **OG 27/2002**.\n\n### Ce face Civia chiar acum:\n\n- 📸 **Camera AI** — fotografiezi problema, iar inteligența artificială detectează automat tipul și autoritatea competentă\n- ✍️ **AI scrie textul formal** cu temei legal românesc — tu doar revizuiești și apeși *Trimite*\n- 📬 **Trimitere directă** prin `sesizari@civia.ro` — fără mailto, fără atașări manuale\n- 🔔 **Urmărire automată** — când primăria răspunde, AI clasifică răspunsul și te notifică\n- 🤝 **Co-trimitere** — alți cetățeni pot apăsa *Trimite și tu* cu identitatea lor\n- 🗺️ **Acoperire națională** — 42 județe + 6 sectoare București + 220 orașe + 1500 autorități\n- 🤖 **Civic Assistant** — chatbot AI pentru drepturile tale civice\n- 📚 **Conținut educațional** — Glosar 50 termeni, ghiduri, drepturile cetățeanului\n- 📊 **Date deschise** — statistici live, API public CC BY 4.0\n- 📱 **PWA installabil** — offline, push notifications native, camera 1-tap\n\nCivia este **gratuită**, **fără reclame** și **fără cont obligatoriu**. Misiunea: democratizarea informației civice în România.'
) ON CONFLICT (versiune) DO NOTHING;

NOTIFY pgrst, 'reload schema';

SELECT 'Migration 061: actualizari tabel + seed v0.0.0 aplicata.' AS status;
