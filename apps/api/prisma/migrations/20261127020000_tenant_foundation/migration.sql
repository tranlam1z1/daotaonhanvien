-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'HANDOVER', 'DISABLED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('QTNT', 'ADM', 'PTDT', 'PD', 'NV');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "max_accounts" INTEGER NOT NULL,
    "storage_gb" INTEGER NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "cycle" "BillingCycle" NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "tax_code" TEXT,
    "address" TEXT,
    "logo" TEXT,
    "login_code" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "billable_accounts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paid_at" TIMESTAMPTZ(3) NOT NULL,
    "notes" TEXT,
    "recorded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "employee_code" TEXT,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "department_id" UUID,
    "position_id" UUID,
    "manager_id" UUID,
    "joined_at" DATE,
    "left_at" DATE,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "department_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "object_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" VARCHAR(45),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_tenant_id_key" ON "tenants"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_login_code_key" ON "tenants"("login_code");

-- CreateIndex
CREATE INDEX "tenants_tenant_id_idx" ON "tenants"("tenant_id");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_idx" ON "subscriptions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_tenant_id_id_key" ON "subscriptions"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_idx" ON "payments"("tenant_id");

-- CreateIndex
CREATE INDEX "departments_tenant_id_idx" ON "departments"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_tenant_id_id_key" ON "departments"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "positions_tenant_id_idx" ON "positions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "positions_tenant_id_id_key" ON "positions"("tenant_id", "id");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_id_key" ON "users"("tenant_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_employee_code_key" ON "users"("tenant_id", "employee_code");

-- CreateIndex
CREATE INDEX "user_roles_tenant_id_idx" ON "user_roles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_key" ON "user_roles"("user_id", "role");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenant_id_subscription_id_fkey" FOREIGN KEY ("tenant_id", "subscription_id") REFERENCES "subscriptions"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_parent_id_fkey" FOREIGN KEY ("tenant_id", "parent_id") REFERENCES "departments"("tenant_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_department_id_fkey" FOREIGN KEY ("tenant_id", "department_id") REFERENCES "departments"("tenant_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_position_id_fkey" FOREIGN KEY ("tenant_id", "position_id") REFERENCES "positions"("tenant_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_manager_id_fkey" FOREIGN KEY ("tenant_id", "manager_id") REFERENCES "users"("tenant_id", "id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Runtime always switches to this non-owner role, including with local superuser URLs.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'educore36_tenant') THEN
    CREATE ROLE educore36_tenant NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
ALTER ROLE educore36_tenant NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT educore36_tenant TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO educore36_tenant;
GRANT SELECT ON plans TO educore36_tenant;
ALTER TABLE tenants ADD CONSTRAINT tenant_identity CHECK (tenant_id = id);
ALTER TABLE plans ADD CONSTRAINT plan_limits CHECK (max_accounts > 0 AND storage_gb > 0 AND price >= 0);
ALTER TABLE subscriptions ADD CONSTRAINT subscription_dates CHECK (ends_at > starts_at AND billable_accounts >= 0);
ALTER TABLE payments ADD CONSTRAINT payment_amount CHECK (amount > 0);
CREATE UNIQUE INDEX platform_user_email ON users (email) WHERE tenant_id IS NULL;
ALTER TABLE users ADD CONSTRAINT platform_user_fields CHECK (
  tenant_id IS NOT NULL OR (department_id IS NULL AND position_id IS NULL AND manager_id IS NULL)
);
ALTER TABLE user_roles ADD CONSTRAINT platform_role CHECK (
  (tenant_id IS NULL AND role = 'QTNT' AND cardinality(department_ids) = 0)
  OR (tenant_id IS NOT NULL AND role <> 'QTNT')
);
-- Composite FKs protect tenant-owned references even when the referenced ID is known.
ALTER TABLE user_roles ADD CONSTRAINT role_user_tenant_fk FOREIGN KEY (tenant_id, user_id) REFERENCES users (tenant_id, id);
-- NULL-tenant users are reserved for platform administration. No tenant RLS policy exposes them.
-- Validate the nullable platform link and the UUID array department scope at the database boundary.
CREATE FUNCTION validate_role_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND tenant_id IS NOT DISTINCT FROM NEW.tenant_id) THEN
    RAISE EXCEPTION 'Role user must belong to the same tenant' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(NEW.department_ids) AS scope(id)
    WHERE NOT EXISTS (SELECT 1 FROM departments d WHERE d.id = scope.id AND d.tenant_id = NEW.tenant_id)) THEN
    RAISE EXCEPTION 'Role scope must belong to the same tenant' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER role_scope_check BEFORE INSERT OR UPDATE ON user_roles
FOR EACH ROW EXECUTE FUNCTION validate_role_scope();

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenants
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants TO educore36_tenant;

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON subscriptions
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions TO educore36_tenant;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON payments
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON payments TO educore36_tenant;

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON departments
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON departments TO educore36_tenant;

ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON positions
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON positions TO educore36_tenant;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO educore36_tenant;

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_roles
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON user_roles TO educore36_tenant;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_logs
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_logs TO educore36_tenant;

CREATE FUNCTION immutable_tenant_id() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Tenant identity cannot be changed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER immutable_tenant BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION immutable_tenant_id();
CREATE TRIGGER immutable_tenant BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION immutable_tenant_id();
CREATE TRIGGER immutable_tenant BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION immutable_tenant_id();
CREATE TRIGGER immutable_tenant BEFORE UPDATE ON departments FOR EACH ROW EXECUTE FUNCTION immutable_tenant_id();
CREATE TRIGGER immutable_tenant BEFORE UPDATE ON positions FOR EACH ROW EXECUTE FUNCTION immutable_tenant_id();
CREATE TRIGGER immutable_tenant BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION immutable_tenant_id();
CREATE TRIGGER immutable_tenant BEFORE UPDATE ON user_roles FOR EACH ROW EXECUTE FUNCTION immutable_tenant_id();
CREATE TRIGGER immutable_tenant BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION immutable_tenant_id();

-- Actors may be QTNT or a user of the same tenant, never another customer's user.
CREATE FUNCTION validate_tenant_actor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor_id uuid;
BEGIN
  actor_id := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
  IF actor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM users u WHERE u.id = actor_id
      AND (u.tenant_id IS NULL OR u.tenant_id = NEW.tenant_id)
  ) THEN
    RAISE EXCEPTION 'Actor must be a platform user or belong to the same tenant' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_actor BEFORE INSERT OR UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION validate_tenant_actor('recorded_by');
CREATE TRIGGER audit_actor BEFORE INSERT OR UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION validate_tenant_actor('user_id');
