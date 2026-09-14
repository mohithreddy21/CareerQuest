# CareerQuest — Developer Runbook & Engineering Guide

Welcome to **CareerQuest**. This document is the definitive operational runbook for developers and AI coding agents working on this codebase. It documents the real, current state of the repository, how to set up and run the application locally, how to execute tests and verification suites, and the architectural principles governing implementation.

---

## 1. Project Overview

CareerQuest is an **AI-powered job-search workspace** engineered to empower job seekers through intelligent automation, grounded resume tailoring, application tracking, and secure job discovery.

### Core Lifecycle
```
Discover
  → Parse & Normalize
  → Analyze
  → Match & Rank
  → Prioritize
  → Tailor Resume
  → Prepare Application
  → Review
  → Apply
  → Track
  → Learn
```

### Core Product Philosophy
> *"Automate the tedious parts of job hunting, not the candidate's judgment."*

- **Candidate in Control**: CareerQuest is **NOT** an autonomous mass-application bot. It does not blindly submit spam applications across the web.
- **Truthful Grounding**: Resume tailoring and applications are strictly grounded in the candidate's verified **Knowledge Bank**. CareerQuest never fabricates candidate experience, skills, or metrics.
- **Data Boundary & Safety**: External job postings are treated strictly as untrusted input. Prompt-injection instructions inside job postings are parsed as inert string data and never executed.

---

## 2. Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack, React Server Components)
- **Language**: TypeScript 5.7 (Strict mode enabled)
- **Runtime & React**: React 19.2, Node.js 20+ (developed and verified on Node.js v22.12.0)
- **Styling & UI**: Tailwind CSS v4, shadcn/ui (Radix UI primitives), Tabler Icons (`@tabler/icons-react` re-exported via `@/components/icons`)
- **Database & ORM**: PostgreSQL 15 (Docker containerized) + [Prisma ORM 6](https://www.prisma.io/)
- **Authentication**: [Clerk](https://clerk.com/) (Clerk user identity resolved server-side to canonical `Candidate`)
- **State Management & Forms**: TanStack React Query v5, TanStack Form, Nuqs (URL search params), Zustand
- **Tooling & Quality**: Oxlint (`oxlint`), Oxygene Formatter (`oxfmt`), TypeScript (`tsc --noEmit`), Husky
- **Package Manager**: **npm** (verified baseline; scripts run with `npm`)

---

## 3. Architecture & Key Boundaries

### 3.1 Domain Hierarchy
```
Candidate
  ├── Profile & Search Preferences
  ├── Knowledge Bank (KnowledgeItem, KnowledgeProvenance, ResumeIngestionBatch)
  ├── Master Resume & Tailored Versions (ResumeVersion, ResumeChange)
  ├── Applications (Application, ApplicationEvent, InterviewStage, ApplicationContact)
  ├── Documents & Exports (CandidateDocument, ResumeExportRecord)
  └── CandidateJobStates & SavedSearches (Phase 7A)

Job
  = Canonical normalized employment opportunity (shared across candidates).
  ├── JobSourceReference (External ATS listing representation; exactly one isPrimary per job)
  ├── JobAnalysis (Structured interpretation of requirements, responsibilities, skills)
  └── JobMatch (Candidate-specific alignment score; Stripe=94%, Datadog=82%, Linear=76%)
```

### 3.2 Repository Abstraction Layer
The application interacts with data storage via the `ICareerRepository` interface:
```
ICareerRepository (src/services/career-repository.interface.ts)
  ├── PrismaCareerRepository (src/services/prisma-career-repository.ts) [Production / PostgreSQL]
  └── InMemoryCareerRepository (src/services/in-memory-career-repository.ts) [Unit testing & mock fallback]
```
Access the active repository via `getCareerRepository()` from `@/services/repository-provider`.

### 3.3 Server-Side Candidate Identity
Candidate identity is **strictly server-derived**:
- Client requests authenticate via Clerk session cookies.
- Server Actions and Route Handlers resolve the authenticated candidate using `requireCandidate()` / `requireCandidateContext()` from `@/lib/auth`.
- **Client-supplied candidate IDs are NEVER trusted.** IDOR vulnerabilities are prevented by enforcing database tenant filters on `candidateId`.

---

## 4. Current Phase Status

CareerQuest is being built in strict, audited phases:

| Phase | Description | Status |
| :--- | :--- | :--- |
| **Phase 1** | Initial product transformation & workspace scaffolding | **COMPLETE** |
| **Phase 2** | Job Analysis & Match Intelligence (Stripe 94%, Datadog 82%, Linear 76%) | **COMPLETE** |
| **Phase 3A** | Candidate Knowledge Bank & Experience ingestion | **COMPLETE** |
| **Phase 3B** | Grounded resume tailoring & citation retrieval | **COMPLETE** |
| **Phase 4** | Resume templates, PDF/DOCX exports, and application prep | **COMPLETE** |
| **Phase 5** | Application tracking lifecycle, metrics, and search insights | **COMPLETE** |
| **Phase 6A–6F** | Production PostgreSQL persistence, Clerk auth, storage abstraction, data lifecycle | **COMPLETE** |
| **Phase 7A** | Job discovery data model & secure `ServerJobFetcher` core | **COMPLETE** |
| **Phase 7B** | Job adapters (Greenhouse, Lever, Generic, Manual) & normalization | **COMPLETE (PASS)** |
| **Phase 7C** | Deduplication engine & source intelligence | **PLANNED (NEXT)** |
| **Phase 7D** | Opportunity Priority & discovery ranking | **PLANNED** |
| **Phase 7E** | Candidate interaction state & saved searches execution | **PLANNED** |
| **Phase 7F** | Discovery UI experience | **PLANNED** |

---

## 5. Current Known-Good Git Checkpoint

- **Branch**: `main`
- **Commit**: `196f37adacc9753800b52de0ca8d74abc7a00266`
- **Short Hash**: `196f37a`
- **Commit Message**: `feat: complete phase 7b job ingestion and normalization`
- **Remote**: `origin/main` (`https://github.com/mohithreddy21/CareerQuest`)
- **Status**: Local and remote are 100% synchronized. Working tree is clean. This commit represents the verified baseline through Phase 7B.

---

## 6. Prerequisites

To develop, run, and test CareerQuest locally, ensure you have:

1. **Node.js**: Minimum supported `v20.x` (recommended & verified on `v22.12.0`)
2. **npm**: `v10.x` (verified on `10.9.0`)
3. **Docker Desktop**: Required to run the local PostgreSQL 15 database container.
4. **Git**: Installed and configured.

---

## 7. First-Time Setup Guide

Follow these steps sequentially to set up a fresh clone of CareerQuest:

### Step 1: Clone the Repository
```bash
git clone https://github.com/mohithreddy21/CareerQuest.git
cd CareerQuest
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Start the PostgreSQL Container
Start the local PostgreSQL container defined in `docker-compose.dev.yml`:
```bash
docker compose -f docker-compose.dev.yml up -d
```
Verify the container is healthy:
```bash
docker ps
```
*(You should see `careerquest-postgres` running on port `5432`)*

### Step 4: Configure Environment Variables
Create a local `.env.local` file by copying the template:
```bash
cp env.example.txt .env.local
```
Ensure `.env.local` includes the database connection string and your Clerk development keys:
```env
# Database (matches POSTGRES_PASSWORD in docker-compose.dev.yml)
DATABASE_URL="postgresql://postgres:<your-password>@localhost:5432/careerquest_dev?schema=public"

# Clerk Authentication (Get development keys from https://dashboard.clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Clerk Redirects
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/dashboard/overview"
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL="/dashboard/overview"

# Sentry (Optional for local development)
NEXT_PUBLIC_SENTRY_DISABLED="true"
```
> [!CAUTION]
> **NEVER commit `.env` or `.env.local` to Git.** They are strictly ignored by `.gitignore`.

### Step 5: Initialize the Database & Prisma Client
Generate the Prisma Client and apply database migrations:
```bash
npx prisma generate
npx prisma migrate dev
```

### Step 6: Seed Development Data
Populate the database with the verified candidate ("Alex Chen"), jobs, knowledge bank items, and applications:
```bash
npm run db:seed
```
*(Or `npx prisma db seed`)*

### Step 7: Start the Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 8. Database Operations & Management

The repository includes convenient npm scripts for database tasks:

| Command | Action | Notes |
| :--- | :--- | :--- |
| `npm run db:migrate` | `prisma migrate dev` | Applies pending migrations in dev |
| `npm run db:seed` | `prisma db seed` | Seeds default Alex Chen workspace |
| `npm run db:studio` | `prisma studio` | Opens Prisma GUI at `localhost:5555` |
| `npx prisma generate` | Generates `@prisma/client` | Run whenever `schema.prisma` changes |

> [!WARNING]
> **Destructive Operation**: Running `npx prisma migrate reset` drops and recreates the entire database. It should only be used in local development when rebuilding the dev schema from scratch. **NEVER run migrate reset in staging or production.**

---

## 9. Implemented Routes

The following Next.js App Router routes are currently active:

- `/dashboard/overview` — Dashboard command center (search progress, metrics, next actions)
- `/dashboard/discover` — Job discovery workspace (Phase 7 import dialog, opportunity view)
- `/dashboard/jobs/[jobId]` — Canonical Job details, analysis breakdown, and candidate match score
- `/dashboard/applications` — Application pipeline (table and kanban views)
- `/dashboard/applications/[applicationId]` — Detailed application tracking, timeline, and interviews
- `/dashboard/resume` — Master Resume and tailored versions manager
- `/dashboard/resume/tailor/[jobId]` — Grounded resume tailoring workspace
- `/dashboard/settings` — Candidate settings, documents management, and account actions
- `/dashboard/notifications` — Notification center
- `/sign-in` & `/sign-up` — Clerk authentication routes

*Note: Dynamic routes with parameters (e.g. `[jobId]`, `[applicationId]`) should be navigated to via the dashboard UI rather than guessed manually.*

---

## 10. Verification & Quality Gates

CareerQuest employs strict automated verification suites to enforce domain invariants, security bounds, and regression prevention.

### 10.1 Standard Verification Commands

```bash
# Typecheck
npm run typecheck

# Strict Lint (0 warnings tolerance)
npm run lint:strict

# Production Next.js Build
npm run build

# Phase 7B Verification (Adapters & Normalization)
npm run verify:phase7b

# Phase 7A Verification (Data Model & Security Core)
npm run verify:phase7a

# Phase 5 Regression (Application tracking, analytics, Phase 2 match scoring)
npm run verify:phase5

# Phase 6F Regression (Document storage, magic bytes, account lifecycle)
npx tsx scripts/verify-phase6f.ts
```

### 10.2 Expected Benchmark Results

- **Phase 7B**: **32 / 32 PASS** (URL normalization, source detection, content sanitization, prompt injection safety, Greenhouse/Lever/Generic/Manual adapters, SSRF enforcement, persistence, analysis/match triggers)
- **Phase 7A**: **33 / 33 PASS** (Anti-SSRF private IP filtering, DNS rebinding pinning, redirect limits, 5MB response size bounds, JobSourceReference primary invariant, CandidateJobState, SavedSearch isolation)
- **Phase 6F**: **33 / 33 PASS** (Document storage abstraction, IDOR isolation, export records, topological deletion)
- **Phase 2 Scoring Regression**:
  - **Stripe** (`job-1`): **94%**
  - **Datadog** (`job-2`): **82%**
  - **Linear** (`job-4`): **76%**
- **Typecheck**: 0 errors
- **Strict Lint**: 0 errors, 0 warnings
- **Production Build**: Exit code `0`

---

## 11. Ingestion Pipeline & Adapters (Phase 7B Architecture)

The job acquisition pipeline operates as follows:
```
External URL / Candidate Text
  │
  ├── 1. Source Detection (source-detector.ts)
  │     └── Inspects URL pattern prior to network access ('greenhouse' | 'lever' | 'generic' | 'manual')
  │
  ├── 2. URL Normalization (url-normalizer.ts)
  │     ├── Strips fragments (#...)
  │     ├── Strips tracking params (utm_*, fbclid, gclid, etc.)
  │     ├── Preserves essential ATS parameters (gh_jid, for, token, jobId)
  │     └── Normalizes default ports, host casing, and trailing slashes
  │
  ├── 3. Duplicate Detection (duplicate-detector.ts)
  │     └── Checks (source, normalizedUrl) in repository; reuses existing canonical job if present
  │
  ├── 4. Secure Fetcher (ServerJobFetcher)
  │     ├── HTTPS required (plain HTTP rejected in production)
  │     ├── Anti-SSRF: rejects private, loopback, link-local, and cloud metadata (169.254.169.254) IPs
  │     ├── Pre-connect DNS resolution and IP socket pinning (prevents DNS rebinding)
  │     ├── Redirect bound: max 3 hops, validated per hop
  │     └── Bounds: 8-second timeout, 5MB streaming response size cap
  │
  ├── 5. Source Adapter
  │     ├── GreenhouseAdapter: extracts JSON-LD JobPosting and DOM fallback
  │     ├── LeverAdapter: extracts .posting-headline, .posting-categories, regex salary
  │     ├── GenericHtmlAdapter: JSON-LD JobPosting -> meta tags -> semantic HTML
  │     └── ManualTextAdapter: parses candidate-pasted text (zero network access)
  │
  ├── 6. Sanitization & Normalization
  │     ├── Strips executable HTML (<script>, <iframe>, event handlers)
  │     ├── Prompt-injection defenses: text treated strictly as inert string DATA
  │     ├── Work arrangement: remote | hybrid | onsite | unknown
  │     └── Salary & posted dates: null when unknown (never fabricated)
  │
  └── 7. Persistence & Intelligence
        ├── Canonical Job created/updated
        ├── JobSourceReference created with isPrimary: true
        ├── Versioned JobAnalysis created
        └── Candidate JobMatch scored
```

---

## 12. Intentionally Deferred Scope (Not in Phase 7B)

The following capabilities are **explicitly NOT implemented** in Phase 7B and belong to future phases:

- ❌ **Cross-source fuzzy deduplication** (belongs to Phase 7C)
- ❌ **Duplicate clustering** (belongs to Phase 7C)
- ❌ **Opportunity Priority scoring formula** (belongs to Phase 7D)
- ❌ **Discovery ranking algorithm** (belongs to Phase 7D)
- ❌ **Keyset/cursor discovery pagination** (belongs to Phase 7D)
- ❌ **SavedSearch background execution & scheduling** (belongs to Phase 7E)
- ❌ **CandidateJobState UI components** (belongs to Phase 7F)
- ❌ **Discovery UI tabs / filter badges** (belongs to Phase 7F)
- ❌ **Background web polling / scrapers**
- ❌ **ATS webhooks**
- ❌ **Autonomous job application bots**
- ❌ **External LLM calls / Vector embeddings**

---

## 13. Git Workflow & Quality Gates

### Daily Workflow
```bash
# 1. Ensure latest upstream changes
git status
git pull origin main

# 2. Develop feature / phase
# (Make targeted changes respecting domain boundaries)

# 3. Verify before staging
npm run typecheck
npm run lint:strict
npm run build
npm run verify:phase7b
npm run verify:phase7a
npm run verify:phase5
npx tsx scripts/verify-phase6f.ts

# 4. Review staged diff
git status
git diff --stat
# Ensure NO secrets or local environment files are included!

# 5. Commit with semantic message
git commit -m "feat: implement phase 7c deduplication engine"

# 6. Push cleanly to remote
git push origin main
```

> [!IMPORTANT]
> **Safety Rules**:
> - Never force-push (`git push --force` or `--force-with-lease`).
> - Never reset or overwrite work without explicit authorization.
> - Never commit `.env` or `.env.local`.

---

## 14. Troubleshooting

### 14.1 PostgreSQL Container Not Running
**Symptom**: `PrismaClientInitializationError: Can't reach database server at localhost:5432`.
**Fix**: Ensure Docker Desktop is running and start the database:
```bash
docker compose -f docker-compose.dev.yml up -d
docker ps
```

### 14.2 Prisma Client Out of Sync
**Symptom**: Type errors referring to missing Prisma models or fields.
**Fix**: Regenerate the Prisma Client and apply migrations:
```bash
npx prisma generate
npx prisma migrate dev
```

### 14.3 Port 3000 Already in Use
**Symptom**: Next.js fails to bind to `localhost:3000`.
**Fix**: Specify another port:
```bash
npm run dev -- -p 3001
```

### 14.4 Windows PowerShell Script Execution Policy
**Symptom**: `npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled`.
**Fix**: Use `npm.cmd` explicitly in PowerShell:
```powershell
npm.cmd run dev
npm.cmd run typecheck
```

### 14.5 Git Pre-Push Hook Configuration
The pre-push hook (`.husky/pre-push`) is configured to run `npm run build` prior to pushing commits. This enforces full Next.js build verification across all developer environments using Node.js and npm without requiring Bun.

---

## 15. Instructions for AI Coding Agents

When tasked with implementing a new phase or feature in CareerQuest:

1. **Read this file (`DEVELOPMENT.md`) first.** Understand existing boundaries, models, and invariants.
2. **Inspect the actual repository.** Do not assume or hallucinate previous architecture from prompt memory. The code is the source of truth.
3. **Respect Entity Separation**:
   - `Job` = canonical opportunity.
   - `JobSourceReference` = external listing representation.
   - `JobAnalysis` = structured interpretation.
   - `JobMatch` = candidate alignment score.
   - `CandidateJobState` = candidate interaction state.
   - `Application` = application tracking lifecycle.
4. **Preserve Groundedness**: Never fabricate candidate skills or experience.
5. **Enforce Security Boundaries**: All external URL fetches **must** route through `ServerJobFetcher`. Never use raw `fetch()` or third-party HTTP clients directly in adapters.
6. **Implement Only the Requested Phase**: Do not leak future phase functionality (e.g. do not implement Phase 7C deduplication or Phase 7D ranking before they are requested).
7. **Run All Quality Gates**: Ensure typecheck, strict lint, production build, and all verification scripts pass with 100% success before concluding.
8. **Stop and Report Honestly**: Provide a complete breakdown of verification results, changes made, and explicit classification (`PASS`, `WARN`, `BLOCKER`).
