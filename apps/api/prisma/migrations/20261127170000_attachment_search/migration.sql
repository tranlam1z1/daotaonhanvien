ALTER TABLE file_objects ADD COLUMN search_text TEXT;
GRANT UPDATE (search_text) ON file_objects TO educore36_tenant;
