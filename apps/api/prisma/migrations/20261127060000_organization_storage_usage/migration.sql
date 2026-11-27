ALTER TABLE tenants
  ADD COLUMN storage_used_bytes BIGINT NOT NULL DEFAULT 0,
  ADD CONSTRAINT tenant_storage_usage_nonnegative CHECK (storage_used_bytes >= 0);
