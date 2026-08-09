-- Study material used to accept doc/docx/txt/zip/images too; narrow the
-- bucket to PDF and PowerPoint only, matching the client-side restriction in
-- uploadStudyMaterial(). octet-stream stays allowed because some browsers
-- report an empty File.type for .ppt uploads.
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/octet-stream'
]
where id = 'course-materials';
