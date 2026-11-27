CREATE TABLE file_objects (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  storage_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,
  CONSTRAINT file_objects_tenant_key_prefix CHECK (storage_key = tenant_id::text || '/' || id::text)
);

CREATE UNIQUE INDEX file_objects_tenant_id_id_key ON file_objects(tenant_id, id);
ALTER TABLE file_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_objects FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON file_objects TO educore36_tenant;

CREATE POLICY file_objects_tenant ON file_objects TO educore36_tenant
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
