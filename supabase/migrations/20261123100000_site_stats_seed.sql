-- Siembra las cuatro cifras de la franja de la home (FR-012) en site_texts.
-- PRD: docs/prd/w3-navegacion-home-paginas-de-apoyo.md, decisión 5 y RF-5.
-- Claves: stats.<cifra>.value y stats.<cifra>.label, una fila por idioma.
-- Si el admin ya las editó, la migración no las pisa.

insert into public.site_texts (key, locale, value)
values
  ('stats.instagram.value', 'es', '116K'),
  ('stats.instagram.value', 'en', '116K'),
  ('stats.instagram.label', 'es', 'seguidores en Instagram'),
  ('stats.instagram.label', 'en', 'Instagram followers'),
  ('stats.tiktok.value', 'es', '530K'),
  ('stats.tiktok.value', 'en', '530K'),
  ('stats.tiktok.label', 'es', 'seguidores en TikTok'),
  ('stats.tiktok.label', 'en', 'TikTok followers'),
  ('stats.views.value', 'es', 'Millones'),
  ('stats.views.value', 'en', 'Millions'),
  ('stats.views.label', 'es', 'de vistas en TikTok e Instagram'),
  ('stats.views.label', 'en', 'of views on TikTok and Instagram'),
  ('stats.region.value', 'es', 'LATAM'),
  ('stats.region.value', 'en', 'LATAM'),
  ('stats.region.label', 'es', 'desde Colombia para toda Suramérica'),
  ('stats.region.label', 'en', 'from Colombia to all of South America')
on conflict (key, locale) do nothing;
