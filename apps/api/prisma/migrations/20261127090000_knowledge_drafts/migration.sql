CREATE TYPE "KnowledgeStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "KnowledgeAudience" AS ENUM ('TENANT', 'DEPARTMENTS', 'POSITIONS');

CREATE TABLE knowledge_categories (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID,
  deleted_at TIMESTAMPTZ(3),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, parent_id) REFERENCES knowledge_categories(tenant_id, id) ON UPDATE CASCADE
);

CREATE TABLE knowledge_tags (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE,
  name TEXT NOT NULL,
  deleted_at TIMESTAMPTZ(3)
);
CREATE INDEX knowledge_tags_tenant_id_idx ON knowledge_tags(tenant_id);

CREATE TABLE knowledge_items (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE,
  created_by UUID NOT NULL,
  UNIQUE (tenant_id, id)
);

CREATE TABLE knowledge_versions (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE,
  item_id UUID NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  status "KnowledgeStatus" NOT NULL DEFAULT 'DRAFT',
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body_html TEXT NOT NULL,
  category_id UUID,
  tag_ids UUID[] NOT NULL DEFAULT '{}',
  audience "KnowledgeAudience" NOT NULL,
  department_ids UUID[] NOT NULL DEFAULT '{}',
  position_ids UUID[] NOT NULL DEFAULT '{}',
  video_url TEXT,
  updated_at TIMESTAMPTZ(3) NOT NULL,
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, item_id, revision),
  FOREIGN KEY (tenant_id, item_id) REFERENCES knowledge_items(tenant_id, id) ON UPDATE CASCADE,
  FOREIGN KEY (tenant_id, category_id) REFERENCES knowledge_categories(tenant_id, id) ON UPDATE CASCADE,
  CHECK (
    (audience = 'TENANT' AND cardinality(department_ids) = 0 AND cardinality(position_ids) = 0)
    OR (audience = 'DEPARTMENTS' AND cardinality(department_ids) > 0 AND cardinality(position_ids) = 0)
    OR (audience = 'POSITIONS' AND cardinality(position_ids) > 0 AND cardinality(department_ids) = 0)
  )
);

CREATE TABLE knowledge_attachments (
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON UPDATE CASCADE,
  version_id UUID NOT NULL,
  file_id UUID NOT NULL,
  video BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id, version_id, file_id),
  FOREIGN KEY (tenant_id, version_id) REFERENCES knowledge_versions(tenant_id, id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (tenant_id, file_id) REFERENCES file_objects(tenant_id, id) ON UPDATE CASCADE
);
CREATE UNIQUE INDEX knowledge_attachments_single_video ON knowledge_attachments(tenant_id, version_id) WHERE video;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['knowledge_categories', 'knowledge_tags', 'knowledge_items', 'knowledge_versions', 'knowledge_attachments'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON %I TO educore36_tenant', table_name);
    EXECUTE format('CREATE POLICY knowledge_tenant ON %I TO educore36_tenant USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)', table_name);
    EXECUTE format('CREATE TRIGGER immutable_tenant BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION immutable_tenant_id()', table_name);
  END LOOP;
END $$;
GRANT DELETE ON knowledge_attachments TO educore36_tenant;
