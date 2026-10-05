# PC BASTOS HARVEST MANAGEMENT SYSTEM
## Offline-First Architecture & Synchronization Engine

### 1. Offline Philosophy & Guarantee
During a busy Harvest Sunday, internet or local LAN connections may drop without warning.
The PC Bastos Harvest system is architected as **offline-first**:
1. All master data (Contributors, Targets, Sessions, Groups, Categories, Payment Methods) is synchronized into local browser storage (**IndexedDB**).
2. When offline, collectors can search contributors, view current balance, and record payments instantly without network latency.
3. Every payment recorded offline is stored with:
   - Client-side generated UUID (`tx_id`)
   - Client timestamp
   - Terminal identifier (`terminal_code` or `terminal_id`)
   - Operator credentials / session state
   - Status: `PENDING_SYNC`
4. When connectivity resumes (or via manual "SYNC NOW" button):
   - The queue is batched and sent to `/api/sync/push`.
   - The backend checks for duplicate `tx_id` (idempotency). If already processed, it acknowledges without double-recording.
   - Central database registers the transaction and returns a success receipt.
   - Client updates local record status to `SYNCED`.
   - Server returns newly committed remote transactions so the terminal receives updates from other terminals.

### 2. Conflict Resolution
- Contributor Targets: Server timestamp wins (configured by Admin).
- Financial Transactions: All valid client transaction UUIDs are additive and unique; they cannot overwrite each other. Concurrency is preserved across all terminals.
