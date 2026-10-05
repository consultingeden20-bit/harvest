# PC BASTOS HARVEST MANAGEMENT SYSTEM
## System Architecture & Technical Specifications

```
+---------------------------------------------------------------------------------+
|                                 CLIENT TIER                                     |
|  +---------------------+   +---------------------+   +-----------------------+  |
|  |   Collection Desk   |   | Group Authority Desk|   | Cash Verification Desk|  |
|  |   (Fast Workflow)   |   |   (Scoped Portal)   |   |   & Admin Controls    |  |
|  +---------------------+   +---------------------+   +-----------------------+  |
|               |                       |                          |              |
|  +---------------------------------------------------------------------------+  |
|  |        IndexedDB Local Storage & Outbox Queue (Offline-First Engine)      |  |
|  |      - Cached Contributors, Sessions, Categories, Products, Outbox Tx    |  |
|  +---------------------------------------------------------------------------+  |
+----------------------------------------|----------------------------------------+
                                         | HTTP / JSON (JWT Auth, CORS, X-Terminal)
                                         v
+---------------------------------------------------------------------------------+
|                                BACKEND TIER                                     |
|  +---------------------------------------------------------------------------+  |
|  |             Express.js RESTful API & Security Middleware Layer            |  |
|  |  - JWT Authentication, bcrypt Password Hashing, RBAC & Group Scoping     |  |
|  +---------------------------------------------------------------------------+  |
|     |           |              |              |              |             |    |
|  +------+  +---------+  +------------+  +-----------+  +------------+  +-----+  |
|  | Auth |  | Contrib |  | Financial  |  | Cash      |  | Analytics  |  |Sync |  |
|  | Svc  |  | Service |  | Engine     |  | Reconcile |  | & Reports  |  | Svc |  |
|  +------+  +---------+  +------------+  +-----------+  +------------+  +-----+  |
|     |           |              |              |              |             |    |
|  +---------------------------------------------------------------------------+  |
|  |                Immutable Central Audit Logger (audit_logs)                |  |
|  +---------------------------------------------------------------------------+  |
+----------------------------------------|----------------------------------------+
                                         | ACID / WAL Mode / Parameterized SQL
                                         v
+---------------------------------------------------------------------------------+
|                               DATABASE TIER                                     |
|  +---------------------------------------------------------------------------+  |
|  |                     SQLite Relational Engine (WAL Mode)                   |  |
|  |  - Exact Integer FCFA Currency (No float roundoff)                        |  |
|  |  - Foreign Key Constraints & Cascades Enabled                             |  |
|  |  - Unique Indexes for Idempotent Client UUIDs                             |  |
|  +---------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------+
```

### Key Technical Attributes:
1. **Financial Integrity**:
   - Zero IEEE-754 float arithmetic; integer FCFA throughout.
   - One Person = One Persistent Identity across multiple group memberships.
   - Distinct separation of Church-Wide single-counted totals vs Multi-Group analytical allocations.
2. **Offline-First Synchronization**:
   - Client UUIDs (`client_tx_id`) enforce 100% idempotency during network interruptions and sync re-pushes.
   - Master data cached in browser `IndexedDB`.
3. **Security & RBAC Scoping**:
   - Group Financial Authorities are restricted at the database query level (`WHERE gm.group_id IN (...)`).
   - Forced password change on first login.
4. **Bilingual Localization**:
   - Full English and French language engine with client persistence.
