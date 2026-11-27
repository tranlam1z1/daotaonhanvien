
ALTER TABLE users
  ADD COLUMN failed_logins INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN locked_until TIMESTAMPTZ(3);

CREATE TYPE "AuthCredentialKind" AS ENUM ('SESSION', 'RESET', 'INVITE');
CREATE TABLE auth_credentials (
  digest TEXT PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE ON UPDATE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  kind "AuthCredentialKind" NOT NULL,
  expires_at TIMESTAMPTZ(3) NOT NULL,
  FOREIGN KEY (tenant_id, user_id) REFERENCES users(tenant_id, id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX auth_credentials_user_id_kind_idx ON auth_credentials(user_id, kind);
CREATE INDEX auth_credentials_tenant_id_idx ON auth_credentials(tenant_id);

-- The regular tenant role keeps its existing scope, including for platform sessions.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore36_auth') THEN
    CREATE ROLE educore36_auth NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
GRANT educore36_auth TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO educore36_auth;
GRANT SELECT ON tenants, users TO educore36_auth;
GRANT UPDATE (failed_logins, locked_until, password_hash, status, updated_at)
  ON users TO educore36_auth;
GRANT INSERT, SELECT ON audit_logs TO educore36_auth;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_credentials TO educore36_auth;

CREATE POLICY auth_user_scope ON users TO educore36_auth
  USING (
    current_setting('app.tenant_id', true) IS NOT NULL
    AND tenant_id IS NOT DISTINCT FROM NULLIF(current_setting('app.tenant_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.tenant_id', true) IS NOT NULL
    AND tenant_id IS NOT DISTINCT FROM NULLIF(current_setting('app.tenant_id', true), '')::uuid
  );

CREATE POLICY auth_audit_scope ON audit_logs TO educore36_auth
  USING (tenant_id IS NOT DISTINCT FROM NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id IS NOT DISTINCT FROM NULLIF(current_setting('app.tenant_id', true), '')::uuid);

ALTER TABLE auth_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_credentials FORCE ROW LEVEL SECURITY;
CREATE POLICY auth_credential_scope ON auth_credentials TO educore36_auth
  USING (tenant_id IS NOT DISTINCT FROM NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (
    tenant_id IS NOT DISTINCT FROM NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND EXISTS (SELECT 1 FROM users u WHERE u.id = user_id
      AND u.tenant_id IS NOT DISTINCT FROM auth_credentials.tenant_id)
  );
CREATE TRIGGER immutable_tenant BEFORE UPDATE ON auth_credentials FOR EACH ROW
  EXECUTE FUNCTION immutable_tenant_id();

CREATE FUNCTION auth_phone(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog AS $$
  SELECT regexp_replace(regexp_replace(value, '[[:space:].()-]', '', 'g'), '^\+84', '0')
$$;
CREATE INDEX auth_users_email_lookup ON users(lower(email)) WHERE deleted_at IS NULL;
CREATE INDEX auth_users_phone_lookup ON users(auth_phone(phone)) WHERE deleted_at IS NULL;

-- Before a session exists, return only the matching identity needed to enter RLS.
-- The migration role owns these functions and must be able to read FORCE RLS tables.
CREATE FUNCTION auth_find_identity(identifier text, by_phone boolean, company_code text)
RETURNS TABLE ("id" uuid, "tenantId" uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT u.id, u.tenant_id
  FROM public.users u
  LEFT JOIN public.tenants t ON t.id = u.tenant_id
  WHERE u.deleted_at IS NULL
    AND (
      (by_phone AND public.auth_phone(u.phone) = identifier)
      OR (NOT by_phone AND lower(u.email) = identifier)
    )
    AND (company_code IS NULL OR t.login_code = company_code)
  LIMIT 2
$$;
REVOKE ALL ON FUNCTION auth_find_identity(text, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_find_identity(text, boolean, text) TO educore36_auth;

CREATE FUNCTION auth_find_credential(secret_digest text, credential_kind public."AuthCredentialKind")
RETURNS TABLE ("id" uuid, "tenantId" uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT c.user_id, c.tenant_id FROM public.auth_credentials c
  WHERE c.digest = secret_digest AND c.kind = credential_kind
$$;
REVOKE ALL ON FUNCTION auth_find_credential(text, public."AuthCredentialKind") FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_find_credential(text, public."AuthCredentialKind") TO educore36_auth;
