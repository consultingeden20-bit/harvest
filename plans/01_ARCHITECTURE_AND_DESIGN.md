# PC BASTOS HARVEST MANAGEMENT SYSTEM
## System Architecture & Technical Specifications

### 1. Architectural Overview
The PC Bastos Harvest Management System is designed for high-concurrency, offline-resilient, multi-terminal financial operations during Harvest campaigns (e.g., Harvest 2026, 2027, etc.).

#### Key Architectural Pillars:
1. **Financial Integrity & Double-Counting Prevention**:
   - Currency: Central African CFA Franc (FCFA / XAF / ₣), stored and computed as exact integers (`INTEGER` / BigInt) to prevent floating-point rounding errors.
   - **One Person = One Persistent Identity**: Contributors have a permanent UUID and identifier (`H26-XXXX`), linked to multiple groups (e.g., CMF, CYF, CCI, Session, Choirs).
   - **Church Total vs Group Analytics**: A single contribution of ₣3,000,000 made by a member belonging to 3 groups counts **exactly once (₣3,000,000)** in Church Totals, while appearing in full (₣3,000,000) under each individual group's analytical performance. Group totals are never summed to derive church income.

2. **Offline-First & Multi-Terminal Synchronization**:
   - Client-side persistence using **IndexedDB** (`harvest_offline_db`).
   - All mutations (payments, garden sales, new contributors, anonymous donations) generate a client UUID (`idempotency_key` / `client_tx_id`) and are recorded in a persistent `outbox_queue`.
   - Automatic and manual background synchronization with exponential backoff and instant status indicators (Online/Offline, Pending Uploads, Sync Failures, Conflict Count).
   - Central backend provides atomic batch sync endpoint with transactional idempotency, conflict detection, and server-versioned download feeds.

3. **Role & Scope-Based Access Control (RBAC)**:
   - **Administrator**: Full church-wide access, user management, system configuration, global reports, audit logs, reconciliation.
   - **Group Financial Authority (CMF, CYF, CCI, etc.)**: Strict scoped access—can only view, search, and report on members belonging to their authorized group(s). Backend API strictly validates scope on every query and export.
   - **Collector**: Rapid payment recording terminal scoped by assignment or active desk.
   - **Finance / Verification**: Cash verification, physical vs system reconciliation.
   - **Leadership / Reporting**: Read-only authorized analytics.

4. **Security & Auditability**:
   - Passwords hashed with `bcrypt` (12 rounds).
   - Initial temporary passwords require immediate password change on first login.
   - Every state-changing action writes an immutable row to `audit_logs` capturing `user_id`, `terminal_id`, `action`, `entity_type`, `record_id`, `old_values`, `new_values`, `ip_address`, and `timestamp`.
   - Session timeouts, CSRF/token verification, and parameterized SQL queries to prevent SQL injection and IDOR.

5. **Internationalization (i18n)**:
   - Complete bilingual support: **English (EN)** and **French (FR)** with instant toggle and persistent language preference in `localStorage`.
   - All UI labels, financial terms, report exports, notifications, validation errors, and statuses are translated.

6. **Visual Identity & Design System**:
   - Palette: Harvest Green (`#1b5e20`, `#2e7d32`, `#4caf50`), Purple Accent (`#6b21a8`, `#7c3aed`), Charcoal/Slate (`#0f172a`, `#1e293b`, `#334155`), Clean Neutral Backgrounds (`#f8fafc`, `#ffffff`), Status Amber (`#d97706`), Red (`#dc2626`).
   - Clean, rapid-entry keyboard-friendly collection terminal: **Search -> Select -> See Target/Balance -> Record -> Confirm -> Next** in <3 seconds.
