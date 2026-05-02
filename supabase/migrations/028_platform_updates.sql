-- ============================================================
-- Migration 028: Platform updates / changelog
-- ============================================================
-- Public-facing changelog of major platform versions (V1, V2, ...).
-- Admin posts a new entry whenever there's something worth telling
-- users about; the page lives at /updateuri and is linked from the
-- footer ("Despre Civia" column).
--
-- One row per VERSION. Body is markdown-ish (paragraphs + bullets +
-- bold via **) — same conventions the AI synthesis uses, so the same
-- renderer can be reused if we ever want to share components.

create table if not exists public.platform_updates (
  id uuid primary key default gen_random_uuid(),
  -- Version label as displayed (e.g. "V1", "V2", "V2.5"). Free text
  -- so we can do "V1.1 — hotfix" if needed. Unique so we can't
  -- accidentally publish two V1's.
  version text not null unique,
  -- Short, scannable headline. Shown in the version card header.
  title text not null,
  -- Long-form description of what changed. Markdown subset:
  -- paragraphs separated by blank lines, lists with "- ", **bold**,
  -- ## Section headings. Rendered by a simple parser on the page —
  -- not full markdown to avoid a lib dependency.
  body text not null,
  -- When the version went live. Defaults to insert time but admin
  -- can backfill historical entries with an explicit date.
  published_at timestamptz not null default now(),
  -- Audit trail
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pupd_published on public.platform_updates(published_at desc);

comment on table public.platform_updates is
  'Changelog of major Civia platform versions. One row per version. Public listing at /updateuri, managed via /admin/updateuri.';

-- updated_at maintenance
create or replace function public.set_platform_updates_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pupd_updated_at on public.platform_updates;
create trigger trg_pupd_updated_at
  before update on public.platform_updates
  for each row execute function public.set_platform_updates_updated_at();

-- RLS: public can READ, only admin can write.
alter table public.platform_updates enable row level security;

drop policy if exists pupd_read_all on public.platform_updates;
create policy pupd_read_all on public.platform_updates
  for select using (true);

drop policy if exists pupd_admin_write on public.platform_updates;
create policy pupd_admin_write on public.platform_updates
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- ============================================================
-- Seed: V1 — current platform state at launch
-- ============================================================
insert into public.platform_updates (version, title, body, published_at)
values (
  'V1',
  'Lansarea publică a Civia.ro',
  $$Prima versiune publică a platformei Civia. Toate funcționalitățile de mai jos sunt live pentru toate cele 42 de județe.

## Sesizări către primărie

- Generator de scrisori formale cu temei legal (OG 27/2002)
- Detectare automată a autorității competente (primărie / Poliția Locală / Garda de Mediu / prefectură) după tip + locație
- Atașare foto, GPS, rescriere în limbaj formal
- Trimitere directă în aplicația ta de email (Gmail Android, iOS Mail, Outlook) prin deep links — fără confuzia browser-mai-tab
- Sesizare publică opțional pe platformă + co-semnare de către alți cetățeni (multipli emailuri formali la aceeași autoritate = presiune mai mare)

## Hărți live (42 județe)

- Piste de bicicletă, spații pietonale, transport public, drumuri
- Calitatea aerului în timp real cu senzori reali din comunitate (Sensor.Community + OpenAQ + WAQI)
- Date din OpenStreetMap, refresh la fiecare vizită

## Întreruperi programate

- Apă, căldură, gaz, curent, lucrări la stradă
- Scrape automat din surse oficiale (Apa Nova, Termoenergetica, E-Distribuție, Distrigaz)
- Listă pe județ + sector, cu listă de blocuri afectate când e disponibilă

## Petiții civice

- Agregator petiții active de pe Declic, Avaaz, petitie.civica.ro
- Sinteză structurată automat ("Pe scurt", "Ce cere", "Cifre", "Context", "De ce contează")
- Click → semnezi pe site-ul oficial (Civia nu colectează date despre semnătură)

## Știri locale + naționale

- 30+ surse verificate (Digi24, HotNews, G4Media, PressOne, Recorder etc.)
- Presa locală din 25+ județe
- Sinteză automată pe fiecare articol — citești esența în 30 sec
- Self-healing fetch: refresh automat când vizitezi /știri

## Ghiduri civice

- Cum scrii o sesizare eficientă
- Drepturi cetățean (Legea 544/2001, OG 27/2002)
- Cum contești o amendă
- Ghid biciclist, ghid transport public
- Ce faci la cutremur, ghid vară
- Ghid dezbatere publică, ghid pentru ONG-uri

## Statistici per județ

- Populație, accidente rutiere, spații verzi, buget local
- Primar curent + istoric complet primari (toate județele)
- Catalog autorități cu contact verificat (primării, prefecturi, Poliția Locală, garda de mediu)
- Comparator între două județe

## Tehnic

- **100% gratuit, mereu** — fără reclame, fără tracking publicitar
- **Open data** sub licență CC BY 4.0 — orice jurnalist sau cercetător poate folosi datele
- **PWA** instalabilă pe telefon cu Web Share Target API (camera roll → share → Civia)
- **Google News compatible** — sitemap dedicat + JSON-LD NewsArticle + RSS feed
- **Accesibilitate** WCAG 2.1 AA (contrast, navigare cu tastatura, screen readers)
- **Responsive** mobile-first, optimizat și pentru desktop$$,
  '2026-05-03 00:00:00+00'
)
on conflict (version) do nothing;

select 'Migration 028 (platform_updates) aplicată.' as status;
