-- New notification kinds for course content.
--
-- Deliberately alone in its own migration: Postgres refuses to *use* an enum
-- value in the same transaction that added it, and each migration file runs in
-- one transaction. 0007 references both of these, so they have to land first.

alter type notification_type add value if not exists 'material_published';
alter type notification_type add value if not exists 'lecture_published';
