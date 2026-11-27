BEGIN;

ALTER TABLE knowledge_versions
  ADD COLUMN created_by UUID,
  ADD COLUMN review_token UUID,
  ADD COLUMN rejection_reason TEXT;

ALTER TABLE knowledge_versions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items NO FORCE ROW LEVEL SECURITY;

UPDATE knowledge_versions AS version
SET created_by = item.created_by
FROM knowledge_items AS item
WHERE version.tenant_id = item.tenant_id AND version.item_id = item.id;

UPDATE knowledge_versions SET review_token = gen_random_uuid() WHERE status = 'IN_REVIEW';

ALTER TABLE knowledge_items FORCE ROW LEVEL SECURITY;
ALTER TABLE knowledge_versions FORCE ROW LEVEL SECURITY;

ALTER TABLE knowledge_versions
  ALTER COLUMN created_by SET NOT NULL,
  ADD CONSTRAINT knowledge_versions_review_token CHECK ((status = 'IN_REVIEW') = (review_token IS NOT NULL));

CREATE UNIQUE INDEX knowledge_versions_one_working_version
  ON knowledge_versions (tenant_id, item_id) WHERE status IN ('DRAFT', 'IN_REVIEW');

CREATE TABLE knowledge_rejections (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE,
  user_id UUID NOT NULL,
  version_id UUID NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON UPDATE CASCADE,
  FOREIGN KEY (tenant_id, version_id) REFERENCES knowledge_versions(tenant_id, id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX knowledge_rejections_tenant_id_user_id_created_at_idx
  ON knowledge_rejections (tenant_id, user_id, created_at);
ALTER TABLE knowledge_rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_rejections FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON knowledge_rejections TO educore36_tenant;
CREATE POLICY knowledge_tenant ON knowledge_rejections TO educore36_tenant
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE TRIGGER immutable_tenant BEFORE UPDATE ON knowledge_rejections
  FOR EACH ROW EXECUTE FUNCTION immutable_tenant_id();

COMMIT;
