-- ============================================================
-- Migration 036: Permite video uploads pe sesizari-photos
-- ============================================================
-- Bucketul a fost configurat inițial pentru imagini de sesizări
-- (5 MB cap, image/* MIME). Aftermath proteste are nevoie de video
-- uploads (max 50 MB MP4/WebM/MOV) și de poze mai mari (iPhone HEIC
-- după conversie poate fi 6-8 MB).
--
-- User a raportat 5/4/2026: „Eroare upload: mime type video/mp4 is
-- not supported" la /proteste/[slug]/cum-a-fost/edit. Cauză: Supabase
-- Storage filtrează la bucket-level, înainte ca request-ul să ajungă
-- la RLS sau la cod-ul nostru.

update storage.buckets
set
  file_size_limit = 52428800,  -- 50 MB
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/pdf'
  ]
where id = 'sesizari-photos';

select 'Migration 036 (storage video MIME + 50MB cap) aplicată.' as status;
