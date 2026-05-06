-- =========================================================================
-- Phlo AI Ops - one-off spelling fix for Khushboo Patel
--
-- The seed had "Khusboo" (one S); update to the canonical "Khushboo".
-- Email stays as-is so auth/profile links don't break.
-- =========================================================================

update public.people
   set display_name = 'Khushboo Patel',
       updated_at   = now()
 where lower(email) = 'khusboo.patel@wearephlo.com'
   and display_name = 'Khusboo Patel';
