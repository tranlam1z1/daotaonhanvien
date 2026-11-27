ALTER TABLE users ADD COLUMN invitation_required BOOLEAN NOT NULL DEFAULT false;

GRANT UPDATE (invitation_required) ON users TO educore36_auth;
GRANT SELECT, DELETE ON auth_credentials TO educore36_tenant;
CREATE POLICY tenant_employee_credentials ON auth_credentials
  FOR SELECT TO educore36_tenant
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
CREATE POLICY tenant_employee_revoke ON auth_credentials
  FOR DELETE TO educore36_tenant
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- Only the platform role can resolve notification recipients outside a tenant.
CREATE FUNCTION employee_quota_platform_recipients() RETURNS TABLE (email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT DISTINCT u.email
  FROM public.users u
  JOIN public.user_roles r ON r.user_id = u.id
  WHERE u.tenant_id IS NULL AND r.tenant_id IS NULL AND r.role = 'QTNT'
    AND u.status = 'ACTIVE' AND u.deleted_at IS NULL AND r.deleted_at IS NULL
$$;
REVOKE ALL ON FUNCTION employee_quota_platform_recipients() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION employee_quota_platform_recipients() TO educore36_platform;
