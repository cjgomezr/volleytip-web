-- Siembra la barra de anuncios con los textos del mockup (FR-001).
-- PRD: docs/prd/w3-navegacion-home-paginas-de-apoyo.md, RF-4.
-- Forma de `settings.announcement_bar`: lista de hasta tres mensajes, cada
-- uno `{"text": {"es": "...", "en": "..."}}`. El español es obligatorio; el
-- inglés puede faltar o ir vacío y entonces sale el español. Lo edita W10a.
-- No pisa un valor que el admin ya haya cambiado.

insert into public.settings (key, value)
values (
  'announcement_bar',
  '[
    {"text": {"es": "En vivo: nuevo tip cada semana", "en": "Live: a new tip every week"}},
    {"text": {"es": "Volleyball Camp · próximamente", "en": "Volleyball Camp · coming soon"}},
    {"text": {"es": "Envío gratis en Colombia desde $200.000", "en": "Free shipping in Colombia from COP 200,000"}}
  ]'::jsonb
)
on conflict (key) do nothing;
