# Avkalan Internal ATS

Internal Applicant Tracking System built with Next.js, Supabase, and Prisma.

## Quick Setup

### 1. Create a Supabase Project
Go to [supabase.com](https://supabase.com) → New Project → wait ~2 min.

### 2. Set Environment Variables
```bash
cp .env.example .env.local
# Fill in values from Supabase → Project Settings → API
```

| Variable | Where to find |
|----------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API |
| `DATABASE_URL` | Project Settings → Database → Transaction pooler (port 6543) |
| `DIRECT_URL` | Project Settings → Database → Session pooler (port 5432) |

### 3. Install & Migrate
```bash
npm install
npx prisma migrate dev --name init
```

### 4. Create Supabase Storage Bucket
Supabase dashboard → Storage → Create bucket → Name: `resumes` → Public

### 5. Create First User
Supabase dashboard → Authentication → Add user → email + password

### 6. Run
```bash
npm run dev
# Open http://localhost:3000
```

---

## Architecture

**Core principle**: Candidate status is NOT global — it exists per role mapping.
A candidate can be R2 for one role and Rejected for another simultaneously.

All status changes route through `PUT /api/mappings/[id]` which atomically updates
the mapping AND creates an activity log entry. TanStack Query invalidates all
related views, so Kanban → candidate timeline → dashboard stay in sync automatically.

## Modules

| Module | Route | Notes |
|--------|-------|-------|
| Dashboard | `/` | Active roles, profiles, time-to-fill |
| Clients | `/clients` | CLIENT-001 auto-IDs |
| Roles | `/roles` | TCS-001 per-client auto-IDs |
| Kanban | `/roles/[id]/kanban` | Drag-drop pipeline |
| Candidates | `/candidates` | Email-based deduplication |
| Margin Calc | `/margin-calculator` | Standalone + linkable to mapping |
| Bulk Upload | `/bulk-upload` | CSV upload with duplicate detection |
