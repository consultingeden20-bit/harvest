const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { getDb, run, get, exec } = require('./db');
const { runMigrations } = require('./migrations/migrate');

const SALT_ROUNDS = 12;

function uuid() {
  return crypto.randomUUID();
}

async function seed(customDb = null) {
  await runMigrations(customDb);

  // Clear data in reverse dependency order for a clean repeatable seed
  await exec(`
    DELETE FROM audit_logs;
    DELETE FROM sync_records;
    DELETE FROM collector_verifications;
    DELETE FROM reconciliations;
    DELETE FROM garden_sales;
    DELETE FROM garden_products;
    DELETE FROM transactions;
    DELETE FROM commitment_targets;
    DELETE FROM harvest_sessions;
    DELETE FROM harvest_categories;
    DELETE FROM harvests;
    DELETE FROM group_memberships;
    DELETE FROM contributors;
    DELETE FROM user_group_assignments;
    DELETE FROM users;
    DELETE FROM role_permissions;
    DELETE FROM permissions;
    DELETE FROM roles;
    DELETE FROM groups;
    DELETE FROM contributor_types;
    DELETE FROM income_sources;
    DELETE FROM payment_methods;
    DELETE FROM terminals;
  `, customDb);

  // 1. Roles
  const roles = [
    { id: 'role-admin', code: 'ADMIN', name_en: 'Administrator', name_fr: 'Administrateur', description: 'Full system control and church-wide access' },
    { id: 'role-group-fin', code: 'GROUP_FIN_SEC', name_en: 'Group Financial Authority', name_fr: 'Secrétaire Financier de Groupe', description: 'Restricted financial access scoped to assigned group(s)' },
    { id: 'role-collector', code: 'COLLECTOR', name_en: 'Collector', name_fr: 'Collecteur', description: 'Desk collection terminal operator' },
    { id: 'role-verifier', code: 'VERIFIER', name_en: 'Finance / Verifier', name_fr: 'Vérificateur Financier', description: 'Physical cash and session reconciliation (no access to donor private names)' },
    { id: 'role-viewer', code: 'VIEWER', name_en: 'Leadership / Viewer', name_fr: 'Dirigeant / Lecteur', description: 'Read-only access to authorized reporting' }
  ];

  for (const r of roles) {
    await run(
      `INSERT INTO roles (id, code, name_en, name_fr, description) VALUES (?, ?, ?, ?, ?)`,
      [r.id, r.code, r.name_en, r.name_fr, r.description],
      customDb
    );
  }

  // 2. Permissions
  const permissions = [
    { id: 'perm-manage-users', code: 'MANAGE_USERS', description: 'Create and manage user accounts and roles' },
    { id: 'perm-manage-config', code: 'MANAGE_CONFIG', description: 'Configure harvests, sessions, categories, and targets' },
    { id: 'perm-record-payment', code: 'RECORD_PAYMENT', description: 'Record contributor payments and gifts' },
    { id: 'perm-edit-payment', code: 'EDIT_PAYMENT', description: 'Edit or correct payment amounts with audit tracking' },
    { id: 'perm-reverse-payment', code: 'REVERSE_PAYMENT', description: 'Reverse or correct erroneous transactions' },
    { id: 'perm-view-all-reports', code: 'VIEW_ALL_REPORTS', description: 'View church-wide financial reports and statistics' },
    { id: 'perm-view-group-reports', code: 'VIEW_GROUP_REPORTS', description: 'View assigned group reports' },
    { id: 'perm-reconcile-cash', code: 'RECONCILE_CASH', description: 'Perform cash and payment reconciliation' },
    { id: 'perm-view-audit-logs', code: 'VIEW_AUDIT_LOGS', description: 'View immutable system audit logs' },
    { id: 'perm-manage-contributors', code: 'MANAGE_CONTRIBUTORS', description: 'Create and update contributor profiles' },
    { id: 'perm-manage-garden', code: 'MANAGE_GARDEN', description: 'Record and manage garden product sales' }
  ];

  for (const p of permissions) {
    await run(
      `INSERT INTO permissions (id, code, description) VALUES (?, ?, ?)`,
      [p.id, p.code, p.description],
      customDb
    );
  }

  // Role Permissions
  const rolePermMap = {
    'role-admin': permissions.map(p => p.id),
    'role-group-fin': ['perm-view-group-reports', 'perm-manage-contributors', 'perm-record-payment', 'perm-edit-payment'],
    'role-collector': ['perm-record-payment', 'perm-edit-payment', 'perm-manage-garden', 'perm-manage-contributors'],
    'role-verifier': ['perm-reconcile-cash', 'perm-view-all-reports'],
    'role-viewer': ['perm-view-group-reports']
  };

  for (const [roleId, permIds] of Object.entries(rolePermMap)) {
    for (const permId of permIds) {
      await run(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
        [roleId, permId],
        customDb
      );
    }
  }

  // 3. Groups
  const groups = [
    { id: 'grp-cmf', code: 'CMF', name_en: 'Christian Men Fellowship (CMF)', name_fr: 'Mouvement des Hommes Chrétiens (CMF)', display_order: 1 },
    { id: 'grp-cwf', code: 'CWF', name_en: 'Christian Women Fellowship (CWF)', name_fr: 'Mouvement des Femmes Chrétiennes (CWF)', display_order: 2 },
    { id: 'grp-cyf', code: 'CYF', name_en: 'Christian Youth Fellowship (CYF)', name_fr: 'Jeunesse Chrétienne (CYF)', display_order: 3 },
    { id: 'grp-cci', code: 'CCI', name_en: 'Christian Children Infilling (CCI)', name_fr: 'Enfants Chrétiens (CCI)', display_order: 4 },
    { id: 'grp-session', code: 'SESSION', name_en: 'Kirk Session / Elders', name_fr: 'Conseil des Anciens', display_order: 5 },
    { id: 'grp-choir', code: 'CHOIR', name_en: 'Church Choirs', name_fr: 'Chœurs et Chorales', display_order: 6 }
  ];

  for (const g of groups) {
    await run(
      `INSERT INTO groups (id, code, name_en, name_fr, display_order) VALUES (?, ?, ?, ?, ?)`,
      [g.id, g.code, g.name_en, g.name_fr, g.display_order],
      customDb
    );
  }

  // 4. Users
  const users = [
    {
      id: 'usr-admin',
      username: 'admin',
      full_name: 'PC Bastos Administrator',
      email: 'admin@pcbastos.org',
      role_id: 'role-admin',
      password_hash: await bcrypt.hash('Admin123!', SALT_ROUNDS),
      force_password_change: 0
    },
    {
      id: 'usr-cmf-sec',
      username: 'cmf_fin_sec',
      full_name: 'CMF Financial Secretary',
      email: 'cmf.finance@pcbastos.org',
      role_id: 'role-group-fin',
      password_hash: await bcrypt.hash('Cmf1234!', SALT_ROUNDS),
      force_password_change: 0,
      groups: ['grp-cmf']
    },
    {
      id: 'usr-cyf-sec',
      username: 'cyf_fin_sec',
      full_name: 'CYF Financial Secretary',
      email: 'cyf.finance@pcbastos.org',
      role_id: 'role-group-fin',
      password_hash: await bcrypt.hash('Cyf1234!', SALT_ROUNDS),
      force_password_change: 0,
      groups: ['grp-cyf']
    },
    {
      id: 'usr-cci-sec',
      username: 'cci_fin_sec',
      full_name: 'CCI Financial Secretary',
      email: 'cci.finance@pcbastos.org',
      role_id: 'role-group-fin',
      password_hash: await bcrypt.hash('Cci1234!', SALT_ROUNDS),
      force_password_change: 0,
      groups: ['grp-cci']
    },
    {
      id: 'usr-collector-1',
      username: 'collector1',
      full_name: 'Desk Collector 1 (Central)',
      email: 'collector1@pcbastos.org',
      role_id: 'role-collector',
      password_hash: await bcrypt.hash('Collector123!', SALT_ROUNDS),
      force_password_change: 0
    },
    {
      id: 'usr-collector-cmf',
      username: 'collector_cmf',
      full_name: 'CMF Desk Collector',
      email: 'collector_cmf@pcbastos.org',
      role_id: 'role-collector',
      password_hash: await bcrypt.hash('Collector123!', SALT_ROUNDS),
      force_password_change: 0,
      groups: ['grp-cmf'] // Scoped to CMF
    },
    {
      id: 'usr-verifier-1',
      username: 'verifier1',
      full_name: 'Session Cash Verifier',
      email: 'verifier1@pcbastos.org',
      role_id: 'role-verifier',
      password_hash: await bcrypt.hash('Verifier123!', SALT_ROUNDS),
      force_password_change: 0
    },
    {
      id: 'usr-temp-user',
      username: 'temp_user',
      full_name: 'New Assigned Operator',
      email: 'temp@pcbastos.org',
      role_id: 'role-collector',
      password_hash: await bcrypt.hash('Temp1234!', SALT_ROUNDS),
      force_password_change: 1
    }
  ];

  for (const u of users) {
    await run(
      `INSERT INTO users (id, username, full_name, email, role_id, password_hash, force_password_change) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [u.id, u.username, u.full_name, u.email, u.role_id, u.password_hash, u.force_password_change],
      customDb
    );

    if (u.groups) {
      for (const grpId of u.groups) {
        await run(
          `INSERT INTO user_group_assignments (user_id, group_id) VALUES (?, ?)`,
          [u.id, grpId],
          customDb
        );
      }
    }
  }

  // 5. Contributor Types
  const contributorTypes = [
    { id: 'type-member', code: 'MEMBER', name_en: 'Church Member', name_fr: 'Membre d’Église' },
    { id: 'type-elder', code: 'ELDER', name_en: 'Ruling Elder', name_fr: 'Ancien d’Église' },
    { id: 'type-pastor', code: 'PASTOR', name_en: 'Pastor / Clergy', name_fr: 'Pasteur / Membre du Clergé' },
    { id: 'type-visitor', code: 'VISITOR', name_en: 'Visitor / Friend', name_fr: 'Visiteur / Ami' },
    { id: 'type-corporate', code: 'CORPORATE', name_en: 'Corporate / Family', name_fr: 'Entreprise / Famille' }
  ];

  for (const ct of contributorTypes) {
    await run(
      `INSERT INTO contributor_types (id, code, name_en, name_fr) VALUES (?, ?, ?, ?)`,
      [ct.id, ct.code, ct.name_en, ct.name_fr],
      customDb
    );
  }

  // 6. Income Sources
  const incomeSources = [
    { id: 'src-commitment', code: 'HARVEST_COMMITMENT', name_en: 'Harvest Commitment', name_fr: 'Engagement de Moisson', display_order: 1 },
    { id: 'src-freewill', code: 'FREEWILL_OFFERING', name_en: 'Freewill Offering', name_fr: 'Don Volontaire', display_order: 2 },
    { id: 'src-special-levy', code: 'SPECIAL_LEVY', name_en: 'Special Harvest Levy', name_fr: 'Cotisation Spéciale', display_order: 3 },
    { id: 'src-thanksgiving', code: 'THANKSGIVING', name_en: 'Thanksgiving Envelope', name_fr: 'Action de Grâce', display_order: 4 },
    { id: 'src-garden', code: 'GARDEN_SALES', name_en: 'Garden Product Sales', name_fr: 'Vente du Jardin', display_order: 5 }
  ];

  for (const s of incomeSources) {
    await run(
      `INSERT INTO income_sources (id, code, name_en, name_fr, display_order) VALUES (?, ?, ?, ?, ?)`,
      [s.id, s.code, s.name_en, s.name_fr, s.display_order],
      customDb
    );
  }

  // 7. Payment Methods
  const paymentMethods = [
    { id: 'pm-cash', code: 'CASH', name_en: 'Cash', name_fr: 'Espèces', display_order: 1 },
    { id: 'pm-mtn-momo', code: 'MTN_MOMO', name_en: 'MTN Mobile Money', name_fr: 'MTN Mobile Money', display_order: 2 },
    { id: 'pm-orange-money', code: 'ORANGE_MONEY', name_en: 'Orange Money', name_fr: 'Orange Money', display_order: 3 },
    { id: 'pm-cheque', code: 'CHEQUE', name_en: 'Cheque', name_fr: 'Chèque Bancaire', display_order: 4 },
    { id: 'pm-transfer', code: 'BANK_TRANSFER', name_en: 'Bank Transfer', name_fr: 'Virement Bancaire', display_order: 5 }
  ];

  for (const pm of paymentMethods) {
    await run(
      `INSERT INTO payment_methods (id, code, name_en, name_fr, display_order) VALUES (?, ?, ?, ?, ?)`,
      [pm.id, pm.code, pm.name_en, pm.name_fr, pm.display_order],
      customDb
    );
  }

  // 8. Harvest 2026 Campaign (with Season Global Target)
  const harvestId = 'hrv-2026';
  await run(
    `INSERT INTO harvests (id, year, name_en, name_fr, target_amount, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [harvestId, 2026, 'Harvest 2026 - Abundant Grace', 'Moisson 2026 - Grâce Abondante', 50000000, '2026-08-01', '2026-12-31', 1],
    customDb
  );

  // 9. Harvest Categories
  const categories = [
    { id: 'cat-legacy', harvest_id: harvestId, code: 'LEGACY', name_en: 'Legacy', name_fr: 'Héritage', min_target: 3000000, display_order: 1 },
    { id: 'cat-diamond', harvest_id: harvestId, code: 'DIAMOND', name_en: 'Diamond', name_fr: 'Diamant', min_target: 1000000, display_order: 2 },
    { id: 'cat-gold', harvest_id: harvestId, code: 'GOLD', name_en: 'Gold', name_fr: 'Or', min_target: 500000, display_order: 3 },
    { id: 'cat-silver', harvest_id: harvestId, code: 'SILVER', name_en: 'Silver', name_fr: 'Argent', min_target: 200000, display_order: 4 },
    { id: 'cat-bronze', harvest_id: harvestId, code: 'BRONZE', name_en: 'Bronze', name_fr: 'Bronze', min_target: 100000, display_order: 5 },
    { id: 'cat-general', harvest_id: harvestId, code: 'GENERAL', name_en: 'General / Joyful', name_fr: 'Général / Joyeux', min_target: 25000, display_order: 6 }
  ];

  for (const cat of categories) {
    await run(
      `INSERT INTO harvest_categories (id, harvest_id, code, name_en, name_fr, min_target, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [cat.id, cat.harvest_id, cat.code, cat.name_en, cat.name_fr, cat.min_target, cat.display_order],
      customDb
    );
  }

  // 10. Harvest Sessions (Launch Sunday marked as Default active)
  const sessions = [
    { id: 'sess-launch', harvest_id: harvestId, session_code: 'LAUNCH_SUNDAY', name_en: 'Launch Sunday', name_fr: 'Dimanche de Lancement', session_date: '2026-08-02', is_default: 1, display_order: 1 },
    { id: 'sess-1', harvest_id: harvestId, session_code: 'SESSION_1', name_en: 'First Session', name_fr: 'Première Session', session_date: '2026-09-06', is_default: 0, display_order: 2 },
    { id: 'sess-2', harvest_id: harvestId, session_code: 'SESSION_2', name_en: 'Second Session', name_fr: 'Deuxième Session', session_date: '2026-10-04', is_default: 0, display_order: 3 },
    { id: 'sess-main', harvest_id: harvestId, session_code: 'MAIN_HARVEST', name_en: 'Main Harvest Sunday', name_fr: 'Grand Dimanche de Moisson', session_date: '2026-11-01', is_default: 0, display_order: 4 },
    { id: 'sess-thanksgiving', harvest_id: harvestId, session_code: 'THANKSGIVING', name_en: 'Thanksgiving Sunday', name_fr: 'Dimanche d’Action de Grâce', session_date: '2026-12-06', is_default: 0, display_order: 5 }
  ];

  for (const s of sessions) {
    await run(
      `INSERT INTO harvest_sessions (id, harvest_id, session_code, name_en, name_fr, session_date, is_default, display_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.harvest_id, s.session_code, s.name_en, s.name_fr, s.session_date, s.is_default, s.display_order],
      customDb
    );
  }

  // 11. Garden Products
  const gardenProducts = [
    { id: 'prod-plantain', harvest_id: harvestId, code: 'PLANTAIN', name_en: 'Plantain Bunch', name_fr: 'Régime de Plantain', unit_price: 5000 },
    { id: 'prod-yam', harvest_id: harvestId, code: 'YAM', name_en: 'Yam Tuber', name_fr: 'Tubercule d’Igname', unit_price: 4000 },
    { id: 'prod-rooster', harvest_id: harvestId, code: 'ROOSTER', name_en: 'Farm Rooster', name_fr: 'Coq Fermier', unit_price: 10000 },
    { id: 'prod-goat', harvest_id: harvestId, code: 'GOAT', name_en: 'Live Goat', name_fr: 'Chèvre / Bouc', unit_price: 45000 },
    { id: 'prod-honey', harvest_id: harvestId, code: 'HONEY', name_en: 'Pure Organic Honey (1L)', name_fr: 'Miel Pur Bio (1L)', unit_price: 6000 },
    { id: 'prod-oil', harvest_id: harvestId, code: 'PALM_OIL', name_en: 'Virgin Palm Oil (5L)', name_fr: 'Huile de Palme (5L)', unit_price: 8000 }
  ];

  for (const p of gardenProducts) {
    await run(
      `INSERT INTO garden_products (id, harvest_id, code, name_en, name_fr, unit_price) VALUES (?, ?, ?, ?, ?, ?)`,
      [p.id, p.harvest_id, p.code, p.name_en, p.name_fr, p.unit_price],
      customDb
    );
  }

  // 12. Terminals
  const terminals = [
    { id: 'term-cmf-1', terminal_code: 'TERM-CMF-01', name: 'CMF Desk Terminal', description: 'CMF dedicated collection desk', ip_address: '192.168.1.101' },
    { id: 'term-cyf-1', terminal_code: 'TERM-CYF-01', name: 'CYF Desk Terminal', description: 'CYF dedicated collection desk', ip_address: '192.168.1.102' },
    { id: 'term-central-1', terminal_code: 'TERM-CENTRAL-01', name: 'Central Hall Terminal 1', description: 'Main auditorium desk', ip_address: '192.168.1.100' },
    { id: 'term-verify-1', terminal_code: 'TERM-VERIFY-01', name: 'Cash Verification Terminal', description: 'Finance office counter', ip_address: '192.168.1.150' }
  ];

  for (const t of terminals) {
    await run(
      `INSERT INTO terminals (id, terminal_code, name, description, ip_address) VALUES (?, ?, ?, ?, ?)`,
      [t.id, t.terminal_code, t.name, t.description, t.ip_address],
      customDb
    );
  }

  // 13. Contributors & Multi-Group Memberships
  const contributors = [
    {
      id: 'cnt-peter-n',
      code: 'H26-004582',
      name: 'Peter N.',
      phone: '+237 677 123 456',
      email: 'peter.n@example.org',
      type_id: 'type-member',
      groups: ['grp-cmf', 'grp-cyf', 'grp-session'],
      category_id: 'cat-legacy',
      target: 3000000,
      payments: [
        { tx_code: 'TX-2026-000001', session_id: 'sess-launch', amount: 200000, method: 'pm-cash', source: 'src-commitment', op: 'usr-collector-1', term: 'term-central-1', date: '2026-08-02 10:15:00' },
        { tx_code: 'TX-2026-000002', session_id: 'sess-1', amount: 500000, method: 'pm-mtn-momo', source: 'src-commitment', op: 'usr-cmf-sec', term: 'term-cmf-1', date: '2026-09-06 11:30:00' },
        { tx_code: 'TX-2026-000003', session_id: 'sess-2', amount: 300000, method: 'pm-cash', source: 'src-commitment', op: 'usr-collector-1', term: 'term-central-1', date: '2026-10-04 12:05:00' }
      ]
    },
    {
      id: 'cnt-marie-t',
      code: 'H26-001024',
      name: 'Marie T.',
      phone: '+237 699 234 567',
      email: 'marie.t@example.org',
      type_id: 'type-member',
      groups: ['grp-cwf', 'grp-choir'],
      category_id: 'cat-diamond',
      target: 1000000,
      payments: [
        { tx_code: 'TX-2026-000004', session_id: 'sess-launch', amount: 300000, method: 'pm-orange-money', source: 'src-commitment', op: 'usr-collector-1', term: 'term-central-1', date: '2026-08-02 11:00:00' },
        { tx_code: 'TX-2026-000005', session_id: 'sess-1', amount: 300000, method: 'pm-cash', source: 'src-commitment', op: 'usr-collector-1', term: 'term-central-1', date: '2026-09-06 12:00:00' }
      ]
    },
    {
      id: 'cnt-jean-paul-k',
      code: 'H26-002340',
      name: 'Jean-Paul K.',
      phone: '+237 675 345 678',
      email: 'jp.k@example.org',
      type_id: 'type-member',
      groups: ['grp-cmf'],
      category_id: 'cat-gold',
      target: 500000,
      payments: [
        { tx_code: 'TX-2026-000006', session_id: 'sess-1', amount: 500000, method: 'pm-transfer', source: 'src-commitment', op: 'usr-cmf-sec', term: 'term-cmf-1', date: '2026-09-06 10:45:00' }
      ]
    },
    {
      id: 'cnt-grace-e',
      code: 'H26-003112',
      name: 'Grace E.',
      phone: '+237 694 456 789',
      email: 'grace.e@example.org',
      type_id: 'type-member',
      groups: ['grp-cyf'],
      category_id: 'cat-silver',
      target: 200000,
      payments: [
        { tx_code: 'TX-2026-000007', session_id: 'sess-2', amount: 150000, method: 'pm-mtn-momo', source: 'src-commitment', op: 'usr-cyf-sec', term: 'term-cyf-1', date: '2026-10-04 11:20:00' }
      ]
    },
    {
      id: 'cnt-emmanuel-f',
      code: 'H26-000015',
      name: 'Elder Emmanuel F.',
      phone: '+237 671 567 890',
      email: 'elder.ef@example.org',
      type_id: 'type-elder',
      groups: ['grp-session', 'grp-cmf'],
      category_id: 'cat-legacy',
      target: 3000000,
      payments: [
        { tx_code: 'TX-2026-000008', session_id: 'sess-launch', amount: 1500000, method: 'pm-cheque', source: 'src-commitment', op: 'usr-admin', term: 'term-central-1', date: '2026-08-02 09:30:00' },
        { tx_code: 'TX-2026-000009', session_id: 'sess-main', amount: 2000000, method: 'pm-transfer', source: 'src-commitment', op: 'usr-admin', term: 'term-central-1', date: '2026-11-01 10:00:00' }
      ]
    },
    {
      id: 'cnt-junior-b',
      code: 'H26-005001',
      name: 'Junior B.',
      phone: '+237 650 678 901',
      email: 'junior.b@example.org',
      type_id: 'type-member',
      groups: ['grp-cci'],
      category_id: 'cat-general',
      target: 50000,
      payments: [
        { tx_code: 'TX-2026-000010', session_id: 'sess-launch', amount: 25000, method: 'pm-cash', source: 'src-commitment', op: 'usr-cci-sec', term: 'term-central-1', date: '2026-08-02 11:45:00' }
      ]
    }
  ];

  for (const c of contributors) {
    await run(
      `INSERT INTO contributors (id, code, name, phone, email, type_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [c.id, c.code, c.name, c.phone, c.email, c.type_id],
      customDb
    );

    for (const gId of c.groups) {
      await run(
        `INSERT INTO group_memberships (contributor_id, group_id) VALUES (?, ?)`,
        [c.id, gId],
        customDb
      );
    }

    await run(
      `INSERT INTO commitment_targets (id, harvest_id, contributor_id, category_id, target_amount) VALUES (?, ?, ?, ?, ?)`,
      [uuid(), harvestId, c.id, c.category_id, c.target],
      customDb
    );

    if (c.payments) {
      for (const p of c.payments) {
        await run(
          `INSERT INTO transactions (
            id, tx_code, client_tx_id, harvest_id, session_id, contributor_id, 
            is_anonymous, amount, payment_method_id, income_source_id, notes, 
            status, operator_id, terminal_id, is_offline, sync_status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuid(), p.tx_code, uuid(), harvestId, p.session_id, c.id,
            0, p.amount, p.method, p.source, 'Regular commitment payment',
            'COMPLETED', p.op, p.term, 0, 'SYNCED', p.date
          ],
          customDb
        );
      }
    }
  }

  // 14. Anonymous Transactions
  await run(
    `INSERT INTO transactions (
      id, tx_code, client_tx_id, harvest_id, session_id, contributor_id,
      is_anonymous, amount, payment_method_id, income_source_id, notes,
      status, operator_id, terminal_id, is_offline, sync_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(), 'TX-2026-009001', uuid(), harvestId, 'sess-1', null,
      1, 250000, 'pm-cash', 'src-freewill', 'Anonymous Thanksgiving donation at altar',
      'COMPLETED', 'usr-collector-1', 'term-central-1', 0, 'SYNCED', '2026-09-06 12:30:00'
    ],
    customDb
  );

  // 15. Garden Sales
  const gardenSales = [
    { id: uuid(), harvest_id: harvestId, session_id: 'sess-1', product_id: 'prod-rooster', product_name: 'Farm Rooster', quantity: 2, unit_price: 10000, total_amount: 20000, payment_method_id: 'pm-cash', operator_id: 'usr-collector-1', terminal_id: 'term-central-1', buyer_name: 'Mr. Paul Manga', client_sale_id: uuid(), created_at: '2026-09-06 13:00:00' },
    { id: uuid(), harvest_id: harvestId, session_id: 'sess-1', product_id: 'prod-plantain', product_name: 'Plantain Bunch', quantity: 3, unit_price: 5000, total_amount: 15000, payment_method_id: 'pm-mtn-momo', operator_id: 'usr-collector-1', terminal_id: 'term-central-1', buyer_name: 'Mrs. Claire Fondan', client_sale_id: uuid(), created_at: '2026-09-06 13:15:00' }
  ];

  for (const s of gardenSales) {
    await run(
      `INSERT INTO garden_sales (
        id, harvest_id, session_id, product_id, product_name, quantity,
        unit_price, total_amount, payment_method_id, operator_id, terminal_id,
        buyer_name, client_sale_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id, s.harvest_id, s.session_id, s.product_id, s.product_name, s.quantity,
        s.unit_price, s.total_amount, s.payment_method_id, s.operator_id, s.terminal_id,
        s.buyer_name, s.client_sale_id, s.created_at
      ],
      customDb
    );
  }

  // 16. Audit Log Entry
  await run(
    `INSERT INTO audit_logs (id, user_id, user_name, terminal_id, action, entity_type, record_id, new_values, reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid(), 'usr-admin', 'PC Bastos Administrator', 'term-central-1',
      'SYSTEM_INITIALIZED', 'system', 'system',
      JSON.stringify({ harvest: 'Harvest 2026', seeded: true }),
      'Initial system provisioning and seed loading'
    ],
    customDb
  );

  console.log('Seed process completed successfully!');
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}

module.exports = { seed };
