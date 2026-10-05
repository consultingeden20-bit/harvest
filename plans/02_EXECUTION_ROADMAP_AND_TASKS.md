# PC BASTOS HARVEST MANAGEMENT SYSTEM
## Execution Roadmap & Task Tracking

This document contains the complete master task list for building and deploying the PC Bastos Harvest Management System. Any developer or agent can read this file and know exactly what is completed, in-progress, or remaining.

---

### Master Task Status Table

| # | Task Area | Status | Priority | Notes |
|---|---|---|---|---|
| **01** | Database Schema & Migrations | Complete | Critical | SQLite schema with foreign keys, indexes, triggers, exact integer amounts, audit logs |
| **02** | Backend Core & Database Layer | Complete | Critical | SQLite wrapper with WAL mode, transactions, prepared statements, migration runner |
| **03** | Auth & RBAC Scope Enforcement | Complete | Critical | JWT auth, temporary password enforcement, role & group-scope middleware |
| **04** | Master Data & Harvest Config API | Complete | High | Harvest years, sessions, categories, groups, contributor types, income sources, payment methods |
| **05** | Contributor Management API | Complete | High | Permanent identity, code generator (`H26-XXXX`), multi-group memberships, targets, case-insensitive duplicate check |
| **06** | Financial Transactions API | Complete | Critical | Multi-payment records, payment edit with diff tracking, recalculation engine, garden sales, anonymous |
| **07** | Offline-First & Sync Engine API | Complete | Critical | Idempotent batch sync endpoint, conflict resolution, download sync feed, CSV backup & batch upload |
| **08** | Cash Reconciliation & Verification | Complete | High | Collector-by-collector 2-party verification, physical count vs system total, verifier privacy, admin final approval |
| **09** | Reporting & Analytics Engine | Complete | High | Dynamic filters, church totals vs group analytical performance, CSV/Excel/Print export |
| **10** | Comprehensive Audit Logging | Complete | High | Centralized audit logger recording actor, terminal, diffs (old vs new amount), reason, timestamp |
| **11** | Frontend Design System & Assets | Complete | High | Harvest palette (green/purple/charcoal), modern UI components, responsive layout |
| **12** | Bilingual i18n Localization (EN/FR)| Complete | High | Complete dictionary for English and French, language switcher, formatters |
| **13** | Frontend Offline Sync & IndexedDB | Complete | Critical | IndexedDB storage, mutation queue, automatic background sync, online/offline toast |
| **14** | Collector Terminal UI (Fast Workflow)| Complete | Critical | Ultra-fast search, contributor card, default session selection, flexible garden price, receipt slip |
| **15** | Group Authority Portal | Complete | High | Scoped dashboard, member list, group target vs collected, scoped reports |
| **16** | Admin Dashboard & Full Controls | Complete | High | Groups CRUD, Sessions CRUD, Categories CRUD, Income Sources CRUD, Garden Products CRUD, Season Target |
| **17** | Automated Test Suite | Complete | Critical | Unit tests, financial test case, payment edit test, multi-group, security, sync, verifier privacy, reconciliation |
| **18** | Backup & Power Failure Resilience | Complete | Critical | Continuous local persistence, 1-click full database export/import, CSV offline backup & batch upload |
| **19** | Documentation & Runbook | Complete | Medium | Setup guide, operator manual, administrator guide, sync architecture |

---

### Detailed Task Breakdown

#### Phase 1: Database & Core Backend Infrastructure
- [x] 1.1: Build robust SQLite database manager with WAL mode, foreign keys enabled, and migration engine (`src/backend/db.js` + migrations).
- [x] 1.2: Define all tables: `roles`, `permissions`, `role_permissions`, `users`, `user_group_assignments`, `contributor_types`, `contributors`, `groups`, `group_memberships`, `harvests`, `harvest_categories`, `harvest_sessions`, `commitment_targets`, `income_sources`, `payment_methods`, `transactions`, `garden_products`, `garden_sales`, `reconciliations`, `collector_verifications`, `terminals`, `sync_records`, `audit_logs`.
- [x] 1.3: Create automated seed data script (`src/backend/seed.js`) with default roles, admin user, group financial secretaries (CMF, CYF, CCI), collectors, income sources, payment methods, sample contributors with multi-group links, and Harvest 2026 config.

#### Phase 2: Authentication, RBAC & Group Scoping
- [x] 2.1: Authentication service with bcrypt (12 rounds) and JWT token signing.
- [x] 2.2: First-login force password change flag & workflow.
- [x] 2.3: Role and group-scope authorization middleware (`requireAuth`, `requireRole`, `requireGroupScope`).
- [x] 2.4: Admin user management endpoints (create user, assign role/group, assign groups to collectors, reset temporary password).
- [x] 2.5: Verifier privacy enforcement (anonymize personal donor names/phone numbers for `VERIFIER` role).

#### Phase 3: Financial, Contributor & Config Business Logic
- [x] 3.1: Contributor CRUD with unique persistent ID, phone, email, multi-group assignment, category target, and case-insensitive duplicate name check (`checkDuplicateName`).
- [x] 3.2: Transaction engine supporting multiple sequential payments per contributor with running totals, balance, completion %, and unique transaction UUIDs.
- [x] 3.3: Payment edit endpoint (`PUT /api/transactions/:id`) with old amount vs new amount audit tracking.
- [x] 3.4: Anonymous transaction support (anonymous flag, session, operator, payment method).
- [x] 3.5: Flexible Garden sales tracking (admin manages products, collector enters negotiated selling price).
- [x] 3.6: Admin configuration CRUD for Groups, Harvest Sessions, Categories, Season Global Targets, and Income Sources.
- [x] 3.7: Default Harvest session configuration automatically pre-selected on collection desks.
- [x] 3.8: Collector-by-collector verification workflow and final Admin session approval.

#### Phase 4: Offline-First Synchronization & Emergency Backup Engine
- [x] 4.1: Server-side sync endpoint `/api/sync` accepting batch uploads with idempotency keys.
- [x] 4.2: Client-side IndexedDB database layer for offline caching and outbox queue.
- [x] 4.3: Collector CSV Template Export & Batch CSV Upload endpoint for offline Excel bookkeeping and emergency backup.
- [x] 4.4: 1-Click Full System Backup & Restore endpoints (`/api/backup/export`, `/api/backup/restore`).

#### Phase 5: Reporting Engine & Analytics
- [x] 5.1: Church-wide vs Group Analytics query builder ensuring zero double-counting in church totals.
- [x] 5.2: Multi-filter reporting API (by harvest, session, group, category, payment method, source, date range).
- [x] 5.3: Export engine generating formatted CSV and clean printable financial summaries with audit trail.

#### Phase 6: Frontend UI / UX & Bilingual Localization
- [x] 6.1: Master HTML5 / Single Page Application structure with modular views (Login, Dashboard, Collection Desk, Contributor Directory, Group Portal, Garden Desk, Reconciliation, Reports, Admin Config, Audit Logs, Backup/Restore).
- [x] 6.2: Full EN/FR i18n dictionary and seamless language toggle.
- [x] 6.3: High-speed Collector Terminal UI optimized for keyboard workflow (default session auto-selection, instant duplicate warning popup, payment edit modal, receipt slip).
- [x] 6.4: Two-party verification interface (Verifier inspects collector desks -> Admin final sign-off).
- [x] 6.5: Responsive styling adhering to the design system (Harvest Green `#1b5e20`, Purple `#6b21a8`, Charcoal `#0f172a`, Off-white `#f8fafc`).

#### Phase 7: Verification, Automated Testing & Documentation
- [x] 7.1: Automated test suite (`tests/financial.test.js`, `tests/security.test.js`, `tests/multigroup.test.js`, `tests/sync.test.js`, `tests/reconciliation.test.js`, `tests/e2e_api.test.js`).
- [x] 7.2: End-to-end verification of all mandatory test scenarios.
- [x] 7.3: Complete system documentation (`docs/USER_GUIDE.md`, `docs/ADMIN_GUIDE.md`, `docs/ARCHITECTURE.md`).
