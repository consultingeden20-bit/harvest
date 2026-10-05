# PC BASTOS HARVEST MANAGEMENT SYSTEM
## Administrator & Operations Guide

This guide is intended for Church Administrators, IT Officers, and Financial Leadership of PC Bastos.

---

### 1. System Deployment & Startup

#### Prerequisites
- Node.js (v18 or higher; tested on v24)
- Port 3000 available (or configured via `PORT` environment variable)

#### Quick Start Commands
```powershell
# Install dependencies (if fresh clone)
npm install

# Initialize schema and seed default data
npm run seed

# Run automated verification test suite
npm test

# Start production server
npm start
```

Default access URL: `http://localhost:3000`

---

### 2. Default Administrative Accounts

| Role | Username | Password | Purpose | Scope |
|---|---|---|---|---|
| **Administrator** | `admin` | `Admin123!` | System Configuration & Church-Wide Control | Unrestricted |
| **CMF Fin Sec** | `cmf_fin_sec` | `Cmf1234!` | CMF Group Ledger | `CMF` Group Only |
| **CYF Fin Sec** | `cyf_fin_sec` | `Cyf1234!` | CYF Group Ledger | `CYF` Group Only |
| **CCI Fin Sec** | `cci_fin_sec` | `Cci1234!` | CCI Children Ministry | `CCI` Group Only |
| **Desk Collector** | `collector1` | `Collector123!` | Collection Desk Operator | Assigned Desks |
| **Cash Verifier** | `verifier1` | `Verifier123!` | Session Reconciliation Desk | Verification & Reports |

---

### 3. User Management & Temporary Password Flow

#### Creating New Operators:
1. Navigate to **Admin & Users** tab.
2. Click **+ Create New User**.
3. Fill in Username, Full Name, Email, and select their Role.
4. If assigning a Group Financial Authority, select their authorized group scopes (e.g. CWF, Choir, CMF).
5. Enter a **Temporary Password** (e.g., `Harvest2026!`).
6. Click **Create User**.

#### Forced Password Change Policy:
- When a user signs in with a temporary password, the system detects `force_password_change = 1`.
- A mandatory modal forces them to choose a permanent secure password before accessing any financial records.
- All password changes are logged in the immutable audit trail.

#### Resetting Passwords:
- In the User list, click **Reset Pass**.
- The Administrator specifies a new temporary password. The user is flagged to change it on their next login.

---

### 4. Multi-Year Harvest Configuration

The system is designed to work seamlessly across multiple Harvest years without code modifications:
- Create Harvest Campaigns (e.g., `Harvest 2026`, `Harvest 2027`, `Harvest 2028`).
- Configure custom session names and dates (Launch Sunday, Session 1, Session 2, Main Harvest, Thanksgiving).
- Configure categories and pledge thresholds (Legacy ₣3M+, Diamond ₣1M+, Gold ₣500K+, Silver ₣200K+, Bronze ₣100K+, General).

---

### 5. Financial Principles & Zero Double-Counting

#### Single Church-Wide Count:
- Each financial transaction is recorded once with a globally unique UUID and sequential transaction code (e.g., `TX-2026-000001`).
- Church Total = direct sum of individual transaction rows.

#### Multi-Group Attribution:
- Contributor Peter N. belongs to `CMF`, `CYF`, and `Session`.
- Peter pays ₣3,000,000.
- Church Total = **₣3,000,000** (counted once).
- CMF Analytical Total includes ₣3,000,000.
- CYF Analytical Total includes ₣3,000,000.
- Session Analytical Total includes ₣3,000,000.
- **Rule**: Summing group reports never defines church income. The reporting dashboard explicitly separates Church Totals from Group Analytics.

---

### 6. Audit Trail & Investigation

Every sensitive action records an immutable row in the `audit_logs` table:
- Logins (Successful & Failed)
- Payments recorded, reversed, or corrected
- Contributor registrations & updates
- User creation & password resets
- Cash reconciliations & signed discrepancies
- CSV and financial data exports

Administrators can search and filter the audit log by Actor, Action, Entity, or Date range.
