GRANT SELECT ("id", "tenant_id", "user_id", "action", "object_type", "object_id", "occurred_at", "deleted_at")
  ON "audit_logs" TO educore36_platform;
CREATE POLICY platform_staff_audit_read ON audit_logs FOR SELECT TO educore36_platform
  USING (EXISTS (
    SELECT 1 FROM users AS staff WHERE staff.id = audit_logs.user_id AND staff.tenant_id IS NULL
  ));
