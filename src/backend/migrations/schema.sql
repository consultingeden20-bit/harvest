-- PC Bastos Harvest Management System
-- Production SQLite Relational Schema
-- Exact Integer FCFA currency, Foreign Keys, Indexes, Audit Log Support

PRAGMA foreign_keys = ON;

-- 1. Roles
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  description TEXT
);

-- 2. Permissions
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  description TEXT
);

-- 3. Role-Permission Links
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 4. Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id),
  is_active INTEGER DEFAULT 1,
  force_password_change INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 5. Groups (e.g. CMF, CYF, CCI, Session, Choirs, Women's Guild, etc.)
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 6. User Group Assignments (for Scoped Group Financial Authorities & Scoped Collectors)
CREATE TABLE IF NOT EXISTS user_group_assignments (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  assigned_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, group_id)
);

-- 7. Contributor Types (e.g., Member, Communicant, Elder, Pastor, Visitor, Corporate)
CREATE TABLE IF NOT EXISTS contributor_types (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL
);

-- 8. Contributors (One Person = One Persistent Identity)
CREATE TABLE IF NOT EXISTS contributors (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL, -- e.g. H26-0001
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  type_id TEXT REFERENCES contributor_types(id),
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 9. Group Memberships (Many-to-Many: One person can belong to CMF, CYF, Session, etc.)
CREATE TABLE IF NOT EXISTS group_memberships (
  contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (contributor_id, group_id)
);

-- 10. Harvest Campaigns (e.g., Harvest 2026, 2027)
CREATE TABLE IF NOT EXISTS harvests (
  id TEXT PRIMARY KEY,
  year INTEGER UNIQUE NOT NULL,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  target_amount INTEGER DEFAULT 0, -- Overall season target pledge
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 11. Harvest Categories (e.g. Legacy ₣3M+, Diamond ₣1M+, Gold ₣500K+, Silver ₣200K+, Bronze ₣100K+, General)
CREATE TABLE IF NOT EXISTS harvest_categories (
  id TEXT PRIMARY KEY,
  harvest_id TEXT NOT NULL REFERENCES harvests(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  min_target INTEGER DEFAULT 0, -- Stored as integer FCFA
  display_order INTEGER DEFAULT 0,
  UNIQUE(harvest_id, code)
);

-- 12. Harvest Sessions (e.g. Launch Sunday, Session 1, Session 2, Main Harvest, Thanksgiving)
CREATE TABLE IF NOT EXISTS harvest_sessions (
  id TEXT PRIMARY KEY,
  harvest_id TEXT NOT NULL REFERENCES harvests(id) ON DELETE CASCADE,
  session_code TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  session_date TEXT NOT NULL,
  is_default INTEGER DEFAULT 0, -- Default session auto-selected at collection desks
  is_active INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(harvest_id, session_code)
);

-- 13. Commitment Targets (Per Contributor per Harvest Year)
CREATE TABLE IF NOT EXISTS commitment_targets (
  id TEXT PRIMARY KEY,
  harvest_id TEXT NOT NULL REFERENCES harvests(id) ON DELETE CASCADE,
  contributor_id TEXT NOT NULL REFERENCES contributors(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES harvest_categories(id),
  target_amount INTEGER NOT NULL DEFAULT 0, -- Stored as integer FCFA
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(harvest_id, contributor_id)
);

-- 14. Income Sources (e.g. Harvest Commitment, Special Levy, Freewill Gift, Thanksgiving)
CREATE TABLE IF NOT EXISTS income_sources (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0
);

-- 15. Payment Methods (e.g. Cash, MTN Mobile Money, Orange Money, Cheque, Bank Transfer)
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  display_order INTEGER DEFAULT 0
);

-- 16. Transactions (Financial Records)
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  tx_code TEXT UNIQUE NOT NULL, -- e.g. TX-2026-0001
  client_tx_id TEXT UNIQUE, -- Client-generated UUID for idempotency in offline sync
  harvest_id TEXT NOT NULL REFERENCES harvests(id),
  session_id TEXT NOT NULL REFERENCES harvest_sessions(id),
  contributor_id TEXT REFERENCES contributors(id), -- NULL if anonymous
  is_anonymous INTEGER DEFAULT 0,
  amount INTEGER NOT NULL, -- Stored as exact integer FCFA
  original_amount INTEGER, -- Populated if payment was edited/corrected
  edit_reason TEXT, -- Reason for amount/details modification
  payment_method_id TEXT NOT NULL REFERENCES payment_methods(id),
  income_source_id TEXT NOT NULL REFERENCES income_sources(id),
  notes TEXT,
  status TEXT DEFAULT 'COMPLETED', -- COMPLETED, REVERSED, CORRECTED
  reversal_reason TEXT,
  operator_id TEXT NOT NULL REFERENCES users(id),
  terminal_id TEXT,
  is_offline INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'SYNCED', -- SYNCED, PENDING, CONFLICT
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 17. Garden Products (e.g. Plantain, Yam, Rooster, Honey, Palm Oil, Goat)
CREATE TABLE IF NOT EXISTS garden_products (
  id TEXT PRIMARY KEY,
  harvest_id TEXT NOT NULL REFERENCES harvests(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_fr TEXT NOT NULL,
  unit_price INTEGER DEFAULT 0, -- Suggested/Default Integer FCFA
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(harvest_id, code)
);

-- 18. Garden Sales (Item-level sales tracking with flexible price)
CREATE TABLE IF NOT EXISTS garden_sales (
  id TEXT PRIMARY KEY,
  harvest_id TEXT NOT NULL REFERENCES harvests(id),
  session_id TEXT NOT NULL REFERENCES harvest_sessions(id),
  product_id TEXT REFERENCES garden_products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER NOT NULL, -- Actual Integer FCFA selling price
  total_amount INTEGER NOT NULL, -- Integer FCFA
  payment_method_id TEXT NOT NULL REFERENCES payment_methods(id),
  operator_id TEXT NOT NULL REFERENCES users(id),
  terminal_id TEXT,
  buyer_name TEXT,
  client_sale_id TEXT UNIQUE,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 19. Cash Reconciliation Records (Session Physical vs System Count)
CREATE TABLE IF NOT EXISTS reconciliations (
  id TEXT PRIMARY KEY,
  harvest_id TEXT NOT NULL REFERENCES harvests(id),
  session_id TEXT NOT NULL REFERENCES harvest_sessions(id),
  verified_by_user_id TEXT NOT NULL REFERENCES users(id),
  physical_cash INTEGER DEFAULT 0,
  physical_cheque INTEGER DEFAULT 0,
  physical_transfer INTEGER DEFAULT 0,
  physical_momo INTEGER DEFAULT 0,
  physical_total INTEGER NOT NULL,
  system_cash INTEGER DEFAULT 0,
  system_cheque INTEGER DEFAULT 0,
  system_transfer INTEGER DEFAULT 0,
  system_momo INTEGER DEFAULT 0,
  system_total INTEGER NOT NULL,
  discrepancy INTEGER NOT NULL, -- physical_total - system_total
  status TEXT NOT NULL, -- RECONCILED, DISCREPANCY, PENDING_REVIEW
  notes TEXT,
  admin_approved INTEGER DEFAULT 0,
  admin_approved_by TEXT REFERENCES users(id),
  admin_approved_at TEXT,
  verified_at TEXT DEFAULT (datetime('now'))
);

-- 20. Collector Desk Verifications (Two-Party Sign-Off per Collector)
CREATE TABLE IF NOT EXISTS collector_verifications (
  id TEXT PRIMARY KEY,
  harvest_id TEXT NOT NULL REFERENCES harvests(id),
  session_id TEXT NOT NULL REFERENCES harvest_sessions(id),
  collector_id TEXT NOT NULL REFERENCES users(id),
  verifier_id TEXT NOT NULL REFERENCES users(id),
  total_transactions INTEGER NOT NULL DEFAULT 0,
  total_cash INTEGER NOT NULL DEFAULT 0,
  total_other INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'APPROVED', -- PENDING, APPROVED, REJECTED
  verifier_notes TEXT,
  verified_at TEXT DEFAULT (datetime('now'))
);

-- 21. Terminals
CREATE TABLE IF NOT EXISTS terminals (
  id TEXT PRIMARY KEY,
  terminal_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  ip_address TEXT,
  last_seen_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 22. Synchronization Audit Logs
CREATE TABLE IF NOT EXISTS sync_records (
  id TEXT PRIMARY KEY,
  terminal_id TEXT,
  operator_id TEXT,
  sync_type TEXT NOT NULL, -- PUSH, PULL, CSV_UPLOAD, RESTORE
  batch_size INTEGER DEFAULT 0,
  uploaded_count INTEGER DEFAULT 0,
  downloaded_count INTEGER DEFAULT 0,
  conflicts_count INTEGER DEFAULT 0,
  status TEXT NOT NULL, -- SUCCESS, PARTIAL, FAILED
  error_details TEXT,
  synced_at TEXT DEFAULT (datetime('now'))
);

-- 23. Central Immutable Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  user_name TEXT,
  terminal_id TEXT,
  action TEXT NOT NULL, -- PAYMENT_RECORDED, PAYMENT_EDITED, PAYMENT_REVERSED, USER_CREATED, RECONCILIATION_DONE, etc.
  entity_type TEXT NOT NULL,
  record_id TEXT,
  old_values TEXT, -- JSON representation of previous state (including old_amount)
  new_values TEXT, -- JSON representation of updated state (including new_amount)
  reason TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_contributors_code ON contributors(code);
CREATE INDEX IF NOT EXISTS idx_contributors_name ON contributors(name);
CREATE INDEX IF NOT EXISTS idx_contributors_phone ON contributors(phone);
CREATE INDEX IF NOT EXISTS idx_group_memberships_contributor ON group_memberships(contributor_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_group ON group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_transactions_harvest ON transactions(harvest_id);
CREATE INDEX IF NOT EXISTS idx_transactions_session ON transactions(session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_contributor ON transactions(contributor_id);
CREATE INDEX IF NOT EXISTS idx_transactions_operator ON transactions(operator_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_client_tx ON transactions(client_tx_id);
CREATE INDEX IF NOT EXISTS idx_commitment_targets_contributor ON commitment_targets(contributor_id);
CREATE INDEX IF NOT EXISTS idx_garden_sales_session ON garden_sales(session_id);
CREATE INDEX IF NOT EXISTS idx_reconciliations_session ON reconciliations(session_id);
CREATE INDEX IF NOT EXISTS idx_collector_verifications_session ON collector_verifications(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
