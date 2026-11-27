-- A verified session can load only its own role assignments, including QTNT.
GRANT SELECT (id, user_id, tenant_id, role, department_ids, deleted_at)
  ON user_roles TO educore36_auth;

CREATE POLICY auth_session_roles ON user_roles FOR SELECT TO educore36_auth
  USING (
    user_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid
    AND tenant_id IS NOT DISTINCT FROM NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND deleted_at IS NULL
  );

-- The tenant policy originally applied to every role. Keep role reads restricted
-- to the session policy when running as educore36_auth.
ALTER POLICY tenant_isolation ON user_roles TO educore36_tenant;
