-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('Admin', 'Recruiter');
-- CreateEnum
CREATE TYPE "RolePriority" AS ENUM ('High', 'Medium', 'Low');
-- CreateEnum
CREATE TYPE "RoleStatus" AS ENUM ('Active', 'OnHold', 'Inactive', 'Closed');
-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('InternalResdex', 'InternalLinkedIn', 'Reference', 'Agency');
-- CreateEnum
CREATE TYPE "MappingStatus" AS ENUM ('Submitted', 'R1', 'R2', 'ClientRound', 'Selected', 'Offered', 'Accepted', 'Onboarding', 'Rejected', 'CandidateWithdrawn');
-- CreateEnum
CREATE TYPE "RejectionReason" AS ENUM ('BudgetMismatch', 'PoorCommunication', 'TechnicalRejection', 'CandidateNotInterested', 'OfferDeclined', 'PositionClosed', 'Other');
-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('Candidate', 'Role', 'Client', 'Mapping', 'Margin');
-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('Created', 'Updated', 'Deleted');
-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "supabase_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'Recruiter',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pocs" TEXT[],
    "emails" TEXT[],
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "budget" DECIMAL(15,2),
    "openings" INTEGER NOT NULL DEFAULT 1,
    "locations" TEXT[],
    "jd" TEXT,
    "priority" "RolePriority" NOT NULL DEFAULT 'Medium',
    "status" "RoleStatus" NOT NULL DEFAULT 'Active',
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "role_recruiters" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "recruiter_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_recruiters_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "current_ctc" DECIMAL(15,2),
    "expected_ctc" DECIMAL(15,2),
    "offers_in_hand" BOOLEAN NOT NULL DEFAULT false,
    "offer_amount" DECIMAL(15,2),
    "current_location" TEXT,
    "preferred_locations" TEXT[],
    "source" "CandidateSource" NOT NULL DEFAULT 'InternalLinkedIn',
    "notes" TEXT,
    "resume_url" TEXT,
    "resume_file_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "candidate_role_mappings" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "recruiter_id" TEXT NOT NULL,
    "client_poc" TEXT,
    "submission_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "MappingStatus" NOT NULL DEFAULT 'Submitted',
    "rejection_reason" "RejectionReason",
    "rejection_custom_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "candidate_role_mappings_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "margin_calculations" (
    "id" TEXT NOT NULL,
    "mapping_id" TEXT,
    "ectc" DECIMAL(15,2) NOT NULL,
    "contingency_percentage" DECIMAL(5,2) NOT NULL,
    "contingency_amount" DECIMAL(15,2) NOT NULL,
    "agency_markup_percentage" DECIMAL(5,2) NOT NULL DEFAULT 7,
    "agency_markup_amount" DECIMAL(15,2) NOT NULL,
    "avkalan_markup_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "avkalan_markup_amount" DECIMAL(15,2) NOT NULL,
    "pass_through" DECIMAL(10,2) NOT NULL DEFAULT 200,
    "pass_through_amount" DECIMAL(15,2) NOT NULL,
    "buyout" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(15,2) NOT NULL,
    "daily_rate" DECIMAL(15,2) NOT NULL,
    "monthly_rate" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "margin_calculations_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "entity_type" "EntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "action_type" "ActionType" NOT NULL,
    "description" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE UNIQUE INDEX "users_supabase_id_key" ON "users"("supabase_id");
-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
-- CreateIndex
CREATE UNIQUE INDEX "clients_client_id_key" ON "clients"("client_id");
-- CreateIndex
CREATE UNIQUE INDEX "roles_role_id_key" ON "roles"("role_id");
-- CreateIndex
CREATE UNIQUE INDEX "role_recruiters_role_id_recruiter_id_key" ON "role_recruiters"("role_id", "recruiter_id");
-- CreateIndex
CREATE UNIQUE INDEX "candidates_candidate_id_key" ON "candidates"("candidate_id");
-- CreateIndex
CREATE UNIQUE INDEX "candidates_email_key" ON "candidates"("email");
-- CreateIndex
CREATE UNIQUE INDEX "candidate_role_mappings_candidate_id_role_id_key" ON "candidate_role_mappings"("candidate_id", "role_id");
-- CreateIndex
CREATE UNIQUE INDEX "margin_calculations_mapping_id_key" ON "margin_calculations"("mapping_id");
-- CreateIndex
CREATE INDEX "activity_logs_entity_type_entity_id_idx" ON "activity_logs"("entity_type", "entity_id");
-- CreateIndex
CREATE INDEX "activity_logs_timestamp_idx" ON "activity_logs"("timestamp");
-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "role_recruiters" ADD CONSTRAINT "role_recruiters_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "role_recruiters" ADD CONSTRAINT "role_recruiters_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "candidate_role_mappings" ADD CONSTRAINT "candidate_role_mappings_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "candidate_role_mappings" ADD CONSTRAINT "candidate_role_mappings_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "candidate_role_mappings" ADD CONSTRAINT "candidate_role_mappings_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "margin_calculations" ADD CONSTRAINT "margin_calculations_mapping_id_fkey" FOREIGN KEY ("mapping_id") REFERENCES "candidate_role_mappings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
