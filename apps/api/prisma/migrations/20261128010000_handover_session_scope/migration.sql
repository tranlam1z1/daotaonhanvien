GRANT SELECT (tenant_id, employee_id, due_on, completed_at) ON handover_cases TO educore36_auth;
CREATE POLICY auth_handover_deadline ON handover_cases FOR SELECT TO educore36_auth
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
    AND employee_id = NULLIF(current_setting('app.auth_user_id', true), '')::uuid);
