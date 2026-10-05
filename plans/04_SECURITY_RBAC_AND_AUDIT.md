# PC BASTOS HARVEST MANAGEMENT SYSTEM
## Security, RBAC & Audit Specification

### 1. Role & Permission Architecture
The system supports distinct operational tiers:

1. **ADMINISTRATOR (`ADMIN`)**:
   - Access: Full unrestricted church-wide access.
   - Capabilities: Manage users, assign group scopes, configure Harvest campaigns/categories/sessions, unlock audit trails, global reports, global financial reconciliation.

2. **GROUP FINANCIAL AUTHORITY (`GROUP_FIN_SEC`)**:
   - Access: Strict scoped authorization limited to user's assigned group(s) (e.g. CMF Financial Secretary can only access CMF members).
   - Backend Enforcement: Every API route querying contributors, transactions, or generating reports filters data by `WHERE gm.group_id IN (SELECT group_id FROM user_group_assignments WHERE user_id = :current_user_id)`.
   - Manipulation Prevention: Explicit checks prevent query manipulation via URL params or payload alteration.

3. **COLLECTOR (`COLLECTOR`)**:
   - Access: Operational payment entry desk.
   - Capabilities: Search authorized contributors, view balances, record transactions, view terminal session history, print collection slips.

4. **FINANCE / VERIFICATION (`VERIFIER`)**:
   - Access: Cash & check reconciliation desk.
   - Capabilities: Count physical cash/cheques/transfers per session, compare against system totals, flag discrepancies, produce signed reconciliation statements.

5. **LEADERSHIP / REPORTING (`VIEWER`)**:
   - Access: Read-only analytics for Church Executive / Session leadership.

---

### 2. Password Security & Session Lifecycle
- **Password Hashing**: `bcrypt` with work factor 12.
- **Initial Password Flow**: Administrator creates users with temporary passwords. `users.force_password_change` is set to `1`. The user is blocked from performing any operations until they submit a new secure password.
- **Session Tokens**: JWT containing `userId`, `role`, `assignedGroupIds`, signed with server secret, with configurable expiration (e.g., 8 hours).
- **Audit Logging**: Any credential change, role update, or sensitive data access is recorded in `audit_logs`.
