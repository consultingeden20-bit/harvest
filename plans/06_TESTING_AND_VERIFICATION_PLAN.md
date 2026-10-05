# PC BASTOS HARVEST MANAGEMENT SYSTEM
## Testing and Verification Plan

### Test Suites to Implement and Execute:

1. **Financial Test Case**:
   - Contributor target = ₣3,000,000
   - Payment 1: ₣200,000
   - Payment 2: ₣500,000
   - Payment 3: ₣300,000
   - Assert: Paid = ₣1,000,000; Balance = ₣2,000,000; Completion = 33.33%
   - Test overpayment (e.g. additional ₣2,500,000 -> Paid: ₣3,500,000, Balance: 0 / ₣-500,000, Completion: 116.67%)
   - Test reversals/corrections.

2. **Multi-Group Attribution Test Case**:
   - Contributor: Peter belongs to `CMF`, `CYF`, `CCI`.
   - Contribution: ₣3,000,000.
   - Assert:
     - Church-wide total = ₣3,000,000 (NOT ₣9,000,000).
     - CMF group analytical total = ₣3,000,000.
     - CYF group analytical total = ₣3,000,000.
     - CCI group analytical total = ₣3,000,000.

3. **Security & Scope Test Case**:
   - User: `CMF Financial Authority`.
   - Assert:
     - Can query CMF members & transactions.
     - Cannot query CYF members or CCI transactions.
     - Cannot execute Admin operations or church-wide reports.
     - Direct API manipulation fails with 403 Forbidden.

4. **Offline & Sync Idempotency Test Case**:
   - Create 3 transactions offline.
   - Restart/reload application -> transactions still preserved in IndexedDB/local queue.
   - Trigger Sync -> All 3 committed to central database.
   - Trigger Sync again -> 0 duplicates created (idempotency verified).

5. **Multi-Terminal Concurrency Test Case**:
   - Terminal A & Terminal B simultaneously record payments for different (or same) contributors.
   - Assert: Both transactions stored with distinct UUIDs and correct operator/terminal attribution.

6. **Reconciliation Test Case**:
   - Total recorded transactions in session = ₣18,450,000.
   - Physical count entered = ₣18,450,000 -> Status: `RECONCILED`, Discrepancy: `₣0`.
   - Discrepancy count entered = ₣18,400,000 -> Status: `DISCREPANCY`, Discrepancy: `-₣50,000` recorded with audit trail.
