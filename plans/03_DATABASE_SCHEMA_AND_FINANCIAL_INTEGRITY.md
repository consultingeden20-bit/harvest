# PC BASTOS HARVEST MANAGEMENT SYSTEM
## Database Schema & Financial Integrity Specification

### 1. Financial Principles & Data Types
1. **Zero Float Usage**: All amounts are represented as integer FCFA amounts (e.g. `200000` = ₣200,000). Calculations (sum, balance, % completion) are computed with strict integer arithmetic to avoid IEEE-754 floating-point inaccuracies.
2. **Transaction-First Record Keeping**: Every payment is an immutable transaction record with a UUID, timestamp, session ID, contributor ID, payment method ID, income source ID, operator ID, and terminal ID.
3. **One Person = One Persistent Identity**:
   - Contributor table holds permanent identification (`id`, `contributor_code`, `name`, `phone`, `email`, `contributor_type_id`, `created_at`).
   - Group memberships are stored in a many-to-many join table `group_memberships(contributor_id, group_id, joined_at)`.
   - Yearly targets are stored in `commitment_targets(id, contributor_id, harvest_id, category_id, target_amount, notes)`.
4. **Church Total vs Group Analytics**:
   - Church Total Query: `SELECT SUM(amount) FROM transactions WHERE harvest_id = ? AND status = 'COMPLETED'`. (Every transaction is counted once).
   - Group Analytics Query: `SELECT g.name, SUM(t.amount) FROM transactions t JOIN group_memberships gm ON t.contributor_id = gm.contributor_id JOIN groups g ON gm.group_id = g.id WHERE t.harvest_id = ? GROUP BY g.id`. (Allows multi-group members' contributions to reflect across each of their constituent groups without inflating the church-wide total).

---

### 2. Relational Entity Details

```
users (id, username, full_name, email, password_hash, role_id, is_active, force_password_change, created_at, updated_at)
roles (id, code, name_en, name_fr, description)
permissions (id, code, description)
role_permissions (role_id, permission_id)
user_group_assignments (user_id, group_id)

groups (id, code, name_en, name_fr, description, is_active)
contributor_types (id, code, name_en, name_fr)
contributors (id, code, name, phone, email, type_id, is_active, created_at, updated_at)
group_memberships (contributor_id, group_id, created_at)

harvests (id, year, name_en, name_fr, start_date, end_date, is_active, created_at)
harvest_categories (id, harvest_id, code, name_en, name_fr, min_target, display_order)
harvest_sessions (id, harvest_id, session_code, name_en, name_fr, session_date, is_active, created_at)
commitment_targets (id, harvest_id, contributor_id, category_id, target_amount, created_at, updated_at)

income_sources (id, code, name_en, name_fr, is_active)
payment_methods (id, code, name_en, name_fr, is_active)

transactions (
  id, tx_code, harvest_id, session_id, contributor_id, is_anonymous, 
  amount, payment_method_id, income_source_id, notes, status, 
  operator_id, terminal_id, is_offline, sync_status, created_at, updated_at
)

garden_products (id, harvest_id, name_en, name_fr, unit_price, is_active, created_at)
garden_sales (id, harvest_id, session_id, product_id, product_name, quantity, unit_price, total_amount, payment_method_id, operator_id, terminal_id, buyer_name, created_at)

reconciliations (
  id, harvest_id, session_id, verified_by_user_id, physical_cash, physical_cheque, 
  physical_transfer, physical_total, system_cash, system_cheque, system_transfer, 
  system_total, discrepancy, status, notes, verified_at
)

terminals (id, terminal_code, name, description, last_seen_at, created_at)
sync_records (id, terminal_id, sync_type, batch_size, uploaded_count, downloaded_count, conflicts_count, status, details, synced_at)
audit_logs (id, user_id, terminal_id, action, entity_type, record_id, old_values, new_values, reason, ip_address, created_at)
```
