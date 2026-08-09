-- 0006 added these two notification_type values, but migration history was
-- repaired (marked applied) without the SQL actually running against this
-- database — notify_course_students() has been failing with 22P02 for every
-- material/lecture upload. Add them for real; idempotent like 0006.
alter type notification_type add value if not exists 'material_published';
alter type notification_type add value if not exists 'lecture_published';
