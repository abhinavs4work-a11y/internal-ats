-- Performance indexes for frequently filtered/joined columns

-- Role: filter by client and status
CREATE INDEX IF NOT EXISTS "roles_client_id_idx" ON "roles"("client_id");
CREATE INDEX IF NOT EXISTS "roles_status_idx" ON "roles"("status");

-- RoleRecruiter: reverse-lookup recruiter → roles
CREATE INDEX IF NOT EXISTS "role_recruiters_recruiter_id_idx" ON "role_recruiters"("recruiter_id");

-- CandidateRoleMapping: filter by role, recruiter, and pipeline status
CREATE INDEX IF NOT EXISTS "candidate_role_mappings_role_id_idx" ON "candidate_role_mappings"("role_id");
CREATE INDEX IF NOT EXISTS "candidate_role_mappings_recruiter_id_idx" ON "candidate_role_mappings"("recruiter_id");
CREATE INDEX IF NOT EXISTS "candidate_role_mappings_status_idx" ON "candidate_role_mappings"("status");

-- ActivityLog: filter by user
CREATE INDEX IF NOT EXISTS "activity_logs_user_id_idx" ON "activity_logs"("user_id");
