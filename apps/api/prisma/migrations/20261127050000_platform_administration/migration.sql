ALTER TABLE tenants ADD COLUMN contact_name text, ADD COLUMN contact_phone text,
  ADD COLUMN initial_admin_id uuid;

CREATE UNIQUE INDEX leads_converted_tenant_key ON leads (tenant_id) WHERE tenant_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore36_platform') THEN
    CREATE ROLE educore36_platform NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
GRANT educore36_platform TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO educore36_platform;

GRANT SELECT, INSERT, UPDATE ON plans, subscriptions TO educore36_platform;
GRANT SELECT, INSERT ON payments TO educore36_platform;
GRANT SELECT (id, full_name, job_title, company_name, company_size, phone, status, notes,
  assignee_id, tenant_id, submitted_at) ON leads TO educore36_platform;
GRANT UPDATE (status, notes, assignee_id, tenant_id) ON leads TO educore36_platform;
GRANT SELECT (id, tenant_id, name, tax_code, address, contact_name, contact_phone, login_code,
  status, initial_admin_id, deleted_at, created_at) ON tenants TO educore36_platform;
GRANT INSERT (id, tenant_id, name, tax_code, address, contact_name, contact_phone, login_code,
  initial_admin_id, updated_at, created_by) ON tenants TO educore36_platform;
GRANT UPDATE (name, tax_code, address, contact_name, contact_phone, login_code, status,
  updated_at, updated_by) ON tenants TO educore36_platform;
GRANT SELECT (id, tenant_id, full_name, status, deleted_at) ON users TO educore36_platform;
GRANT INSERT (id, tenant_id, full_name, email, password_hash, status, updated_at, created_by)
  ON users TO educore36_platform;
GRANT INSERT ON user_roles, audit_logs TO educore36_platform;

CREATE POLICY platform_tenant_read ON tenants FOR SELECT TO educore36_platform
  USING (NULLIF(current_setting('app.tenant_id', true), '') IS NULL
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY platform_subscription_read ON subscriptions FOR SELECT TO educore36_platform
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY platform_payment_read ON payments FOR SELECT TO educore36_platform
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER POLICY tenant_isolation ON users TO educore36_tenant;
CREATE POLICY platform_staff_read ON users FOR SELECT TO educore36_platform
  USING (tenant_id IS NULL);
CREATE POLICY platform_first_admin ON users FOR INSERT TO educore36_platform
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND status = 'PENDING' AND EXISTS (
    SELECT 1 FROM tenants t WHERE t.id = users.tenant_id AND t.initial_admin_id = users.id
  ));
CREATE POLICY platform_first_admin_role ON user_roles FOR INSERT TO educore36_platform
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND role = 'ADM' AND cardinality(department_ids) = 0 AND EXISTS (
    SELECT 1 FROM tenants t WHERE t.id = user_roles.tenant_id AND t.initial_admin_id = user_roles.user_id
  ));

-- Non-null tenant links are enforced by role_user_tenant_fk. Nullable platform
-- links and department scopes still need the trigger.
CREATE OR REPLACE FUNCTION validate_role_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND tenant_id IS NULL) THEN
      RAISE EXCEPTION 'Role user must belong to the same tenant' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF cardinality(NEW.department_ids) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(NEW.department_ids) AS scope(id)
      WHERE NOT EXISTS (SELECT 1 FROM departments d WHERE d.id = scope.id AND d.tenant_id = NEW.tenant_id)
    ) THEN
      RAISE EXCEPTION 'Role scope must belong to the same tenant' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
-- Scope writes to the target selected by the authorized service.
CREATE POLICY platform_scoped_update ON tenants FOR UPDATE TO educore36_platform
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY platform_scoped_insert ON tenants FOR INSERT TO educore36_platform
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY platform_scoped_update ON subscriptions FOR UPDATE TO educore36_platform
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY platform_scoped_insert ON subscriptions FOR INSERT TO educore36_platform
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY platform_scoped_insert ON payments FOR INSERT TO educore36_platform
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

CREATE POLICY platform_scoped_insert ON audit_logs FOR INSERT TO educore36_platform
  WITH CHECK (tenant_id IS NOT DISTINCT FROM NULLIF(current_setting('app.tenant_id', true), '')::uuid);
