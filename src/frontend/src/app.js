// PC Bastos Harvest Management System
// Full Single Page Application Controller

class HarvestApp {
  constructor() {
    this.currentUser = null;
    this.config = null;
    this.activeTab = 'dashboard';
    this.selectedContributor = null;
    this.isOnline = navigator.onLine;
    this.outboxCount = 0;
    this.selectedSessionId = null;
    this.pendingContributorData = null;
  }

  async init() {
    // 1. Setup Language
    window.i18n.applyTranslations();

    // 2. Setup Network Listeners
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
    window.addEventListener('auth:unauthorized', () => this.showLoginView());

    // 3. Setup Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('contributor-search-input');
        if (searchInput) searchInput.focus();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        document.getElementById('login-modal').style.display = 'flex';
        document.getElementById('app-shell').style.display = 'none';
      }
    });

    // 4. Update Header Terminal Identifier
    this.updateHeaderTerminalCode();

    // 5. Check Auth Session
    await this.checkAuthSession();

    // 6. Update Outbox Count
    await this.refreshOutboxStatus();

    // 7. Start Automated Background Sync Daemon (every 30 seconds)
    this.startAutoSyncDaemon(30);
  }

  updateHeaderTerminalCode() {
    const el = document.getElementById('header-terminal-code');
    if (el && window.api) {
      el.textContent = window.api.terminalCode || 'DESK-01';
    }
  }

  startAutoSyncDaemon(intervalSeconds = 30) {
    if (this.autoSyncTimer) clearInterval(this.autoSyncTimer);
    this.autoSyncTimer = setInterval(async () => {
      if (this.currentUser && this.isOnline) {
        try {
          await this.triggerAutoSync();
          const syncTimeEl = document.getElementById('last-sync-time');
          if (syncTimeEl) {
            syncTimeEl.textContent = new Date().toLocaleTimeString();
          }
        } catch (e) {
          console.warn('Auto-sync daemon tick warning:', e);
        }
      }
    }, intervalSeconds * 1000);
  }

  handleNetworkChange(isOnline) {
    this.isOnline = isOnline;
    const statusPill = document.getElementById('network-status-pill');
    if (statusPill) {
      statusPill.className = `status-pill ${isOnline ? 'online' : 'offline'}`;
      statusPill.innerHTML = isOnline ? `🟢 <span data-i18n="online">${window.i18n.t('online')}</span>` : `🟠 <span data-i18n="offlineMode">${window.i18n.t('offlineMode')}</span>`;
    }
    if (isOnline) {
      this.showToast(window.i18n.t('online'), 'success');
      this.triggerAutoSync();
    } else {
      this.showToast(window.i18n.t('offlineMode'), 'warning');
    }
  }

  async checkAuthSession() {
    const token = localStorage.getItem('harvest_jwt_token');
    if (!token) {
      this.showLoginView();
      return;
    }

    try {
      const data = await window.api.getMe();
      this.currentUser = data.user;
      await this.onLoginSuccess(this.currentUser);
    } catch (err) {
      console.warn('Session check failed:', err);
      this.showLoginView();
    }
  }

  showLoginView() {
    document.getElementById('login-modal').style.display = 'flex';
    document.getElementById('app-shell').style.display = 'none';
  }

  async onLoginSuccess(user) {
    this.currentUser = user;
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('app-shell').style.display = 'block';

    // Update Header
    document.getElementById('user-display-name').textContent = user.fullName;
    document.getElementById('user-role-badge').textContent = window.i18n.getLang() === 'fr' ? user.roleNameFr : user.roleNameEn;

    // Check Forced Password Change
    if (user.forcePasswordChange) {
      document.getElementById('force-password-modal').style.display = 'flex';
    }

    // Load Master Config
    try {
      this.config = await window.api.getHarvestConfig();
      await window.offlineStorage.cacheMasterData(this.config);
      
      // Determine default active session
      if (this.config && this.config.sessions && this.config.sessions.length > 0) {
        const def = this.config.sessions.find(s => s.is_default === 1);
        this.selectedSessionId = def ? def.id : this.config.sessions[0].id;
      }
    } catch (err) {
      console.warn('Loading cached config offline...');
    }

    // Adapt Navigation according to user role
    this.renderNavigationTabs();

    // Default tab based on role
    if (user.roleCode === 'COLLECTOR') {
      this.switchTab('collection');
    } else if (user.roleCode === 'GROUP_FIN_SEC') {
      this.switchTab('group-portal');
    } else if (user.roleCode === 'VERIFIER') {
      this.switchTab('reconciliation');
    } else {
      this.switchTab('dashboard');
    }
  }

  renderNavigationTabs() {
    const tabs = [
      { id: 'dashboard', i18nKey: 'tabDashboard', icon: '📊', roles: ['ADMIN', 'VERIFIER', 'VIEWER'] },
      { id: 'collection', i18nKey: 'tabCollection', icon: '⚡', roles: ['ADMIN', 'GROUP_FIN_SEC', 'COLLECTOR'] },
      { id: 'contributors', i18nKey: 'tabContributors', icon: '👥', roles: ['ADMIN', 'GROUP_FIN_SEC', 'COLLECTOR'] },
      { id: 'group-portal', i18nKey: 'tabGroupPortal', icon: '🏛️', roles: ['ADMIN', 'GROUP_FIN_SEC'] },
      { id: 'garden', i18nKey: 'tabGarden', icon: '🌾', roles: ['ADMIN', 'COLLECTOR'] },
      { id: 'anonymous', i18nKey: 'tabAnonymous', icon: '🎁', roles: ['ADMIN', 'COLLECTOR'] },
      { id: 'reconciliation', i18nKey: 'tabReconciliation', icon: '⚖️', roles: ['ADMIN', 'VERIFIER'] },
      { id: 'reports', i18nKey: 'tabReports', icon: '📈', roles: ['ADMIN', 'GROUP_FIN_SEC', 'VERIFIER', 'VIEWER'] },
      { id: 'admin', i18nKey: 'tabAdmin', icon: '👥', roles: ['ADMIN'] },
      { id: 'admin-config', i18nKey: 'tabAdminConfig', icon: '⚙️', roles: ['ADMIN'] },
      { id: 'audit', i18nKey: 'tabAudit', icon: '🛡️', roles: ['ADMIN'] },
      { id: 'backup', i18nKey: 'tabBackup', icon: '📦', roles: ['ADMIN'] }
    ];

    const navContainer = document.getElementById('nav-tabs-bar');
    navContainer.innerHTML = '';

    const userRole = this.currentUser ? this.currentUser.roleCode : 'COLLECTOR';

    tabs.forEach(tab => {
      if (tab.roles.includes(userRole) || userRole === 'ADMIN') {
        const tabEl = document.createElement('div');
        tabEl.className = `nav-tab-item ${this.activeTab === tab.id ? 'active' : ''}`;
        tabEl.id = `nav-tab-${tab.id}`;
        tabEl.innerHTML = `<span>${tab.icon}</span> <span>${window.i18n.t(tab.i18nKey)}</span>`;
        tabEl.onclick = () => this.switchTab(tab.id);
        navContainer.appendChild(tabEl);
      }
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;

    // Update Tab Styles
    document.querySelectorAll('.nav-tab-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.getElementById(`nav-tab-${tabId}`);
    if (activeEl) activeEl.classList.add('active');

    // Hide all view containers
    document.querySelectorAll('.tab-view-panel').forEach(el => el.style.display = 'none');

    // Show active view container
    const viewEl = document.getElementById(`view-${tabId}`);
    if (viewEl) {
      viewEl.style.display = 'block';
    }

    // Trigger view-specific loads
    if (tabId === 'dashboard') this.loadDashboard();
    else if (tabId === 'collection') this.loadCollectionDesk();
    else if (tabId === 'contributors') this.loadContributorsView();
    else if (tabId === 'group-portal') this.loadGroupPortal();
    else if (tabId === 'garden') this.loadGardenView();
    else if (tabId === 'anonymous') this.loadAnonymousView();
    else if (tabId === 'reconciliation') this.loadReconciliationView();
    else if (tabId === 'reports') this.loadReportsView();
    else if (tabId === 'admin') this.loadAdminView();
    else if (tabId === 'admin-config') this.loadAdminConfigView();
    else if (tabId === 'audit') this.loadAuditView();
    else if (tabId === 'backup') this.loadBackupView();
  }

  // --- DASHBOARD ---
  async loadDashboard() {
    try {
      const summaryRes = await window.api.getChurchSummary();
      const s = summaryRes.summary;

      document.getElementById('dash-total-income').textContent = `₣${s.churchTotalIncome.toLocaleString()}`;
      document.getElementById('dash-direct-commitments').textContent = `₣${s.directContributions.toLocaleString()}`;
      document.getElementById('dash-garden-sales').textContent = `₣${s.gardenSalesTotal.toLocaleString()}`;
      document.getElementById('dash-anonymous-gifts').textContent = `₣${s.anonymousTotal.toLocaleString()}`;
      document.getElementById('dash-total-target').textContent = `₣${s.totalTarget.toLocaleString()}`;
      document.getElementById('dash-outstanding').textContent = `₣${s.outstandingCommitment.toLocaleString()}`;
      document.getElementById('dash-completion-rate').textContent = `${s.globalCompletionRate}%`;
      document.getElementById('dash-total-tx').textContent = s.totalTransactions;

      // Render Sessions breakdown table
      const sessTable = document.getElementById('dash-sessions-tbody');
      if (sessTable && s.sessions) {
        sessTable.innerHTML = s.sessions.map(sess => `
          <tr>
            <td><strong>${window.i18n.getLang() === 'fr' ? sess.name_fr : sess.name_en}</strong></td>
            <td>${sess.session_date}</td>
            <td class="text-center">${sess.transaction_count}</td>
            <td class="text-right"><strong>₣${Number(sess.session_amount).toLocaleString()}</strong></td>
          </tr>
        `).join('');
      }

      // Render Category breakdown table
      const catTable = document.getElementById('dash-categories-tbody');
      if (catTable && s.categories) {
        catTable.innerHTML = s.categories.map(cat => {
          const rate = cat.total_target > 0 ? ((cat.total_collected / cat.total_target) * 100).toFixed(1) : 100;
          return `
            <tr>
              <td><span class="category-badge ${cat.code}">${cat.code}</span></td>
              <td>${window.i18n.getLang() === 'fr' ? cat.name_fr : cat.name_en}</td>
              <td class="text-center">${cat.contributor_count}</td>
              <td class="text-right">₣${Number(cat.total_target).toLocaleString()}</td>
              <td class="text-right"><strong>₣${Number(cat.total_collected).toLocaleString()}</strong></td>
              <td class="text-center"><strong>${rate}%</strong></td>
            </tr>
          `;
        }).join('');
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    }
  }

  // --- COLLECTION DESK ---
  async loadCollectionDesk() {
    this.populateSessionDropdown('collect-session-select');
    this.populatePaymentMethodsDropdown('collect-method-select');
    this.populateIncomeSourcesDropdown('collect-source-select');

    // Auto-search initial contributors
    await this.searchContributors('');
    const searchInput = document.getElementById('contributor-search-input');
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
  }

  async searchContributors(searchTerm = '') {
    const listContainer = document.getElementById('collector-search-results');
    listContainer.innerHTML = `<div style="padding:1rem;color:#64748b;text-align:center;">${window.i18n.t('loading')}</div>`;

    try {
      let contributors = [];
      if (this.isOnline) {
        const res = await window.api.listContributors({ search: searchTerm, limit: 30 });
        contributors = res.contributors;
      } else {
        contributors = await window.offlineStorage.getCachedContributors(searchTerm);
      }

      if (contributors.length === 0) {
        listContainer.innerHTML = `<div style="padding:1rem;color:#64748b;text-align:center;">${window.i18n.t('noContributorsFound')}</div>`;
        return;
      }

      listContainer.innerHTML = contributors.map(c => `
        <div class="contributor-item ${this.selectedContributor && this.selectedContributor.id === c.id ? 'selected' : ''}" onclick="app.selectContributor('${c.id}')">
          <div>
            <div class="contributor-name">${c.name}</div>
            <div class="contributor-meta">
              <span class="profile-code">${c.code}</span>
              ${(c.groups || []).map(g => `<span class="group-pill">${g.code || g}</span>`).join('')}
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.8rem;color:#64748b;">${window.i18n.t('balance')}</div>
            <div style="font-weight:700;color:var(--status-warning);">₣${Number(c.balance || 0).toLocaleString()}</div>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Search error:', err);
      listContainer.innerHTML = `<div style="padding:1rem;color:#dc2626;text-align:center;">${err.message}</div>`;
    }
  }

  async selectContributor(contributorId) {
    try {
      let contributor = null;
      if (this.isOnline) {
        const res = await window.api.getContributor(contributorId);
        contributor = res.contributor;
      } else {
        const cached = await window.offlineStorage.getCachedContributors();
        contributor = cached.find(c => c.id === contributorId);
      }

      if (!contributor) return;

      this.selectedContributor = contributor;

      // Update UI Selection
      document.querySelectorAll('.contributor-item').forEach(el => el.classList.remove('selected'));

      // Render Focus Card
      const focusCard = document.getElementById('contributor-focus-details');
      const target = Number(contributor.target_amount) || 0;
      const paid = Number(contributor.total_paid) || 0;
      const balance = Math.max(0, target - paid);
      const rate = target > 0 ? Math.min(100, Number(((paid / target) * 100).toFixed(1))) : 100;

      const groupPills = (contributor.groups || []).map(g => `<span class="group-pill">${g.code || g.name_en || g}</span>`).join(' ');

      focusCard.innerHTML = `
        <div class="profile-focus-card">
          <div class="profile-focus-header">
            <div>
              <h3 style="font-size:1.2rem;font-weight:800;color:var(--dark-slate);">${contributor.name}</h3>
              <div style="margin-top:0.35rem;display:flex;gap:0.5rem;align-items:center;">
                <span class="profile-code">${contributor.code}</span>
                <span class="category-badge ${contributor.category_code || 'GENERAL'}">${contributor.category_code || 'GENERAL'}</span>
                ${groupPills}
              </div>
            </div>
            <div style="text-align:right;">
              <span style="font-size:0.8rem;color:#64748b;">${contributor.phone || ''}</span>
            </div>
          </div>

          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${rate}%;"></div>
          </div>

          <div class="financial-progress-grid">
            <div class="progress-box">
              <div class="progress-box-label">${window.i18n.t('target')}</div>
              <div class="progress-box-value">₣${target.toLocaleString()}</div>
            </div>
            <div class="progress-box">
              <div class="progress-box-label">${window.i18n.t('paid')}</div>
              <div class="progress-box-value paid">₣${paid.toLocaleString()}</div>
            </div>
            <div class="progress-box">
              <div class="progress-box-label">${window.i18n.t('balance')}</div>
              <div class="progress-box-value balance">₣${balance.toLocaleString()}</div>
            </div>
          </div>
        </div>
      `;

      // Enable and focus payment form
      const paymentForm = document.getElementById('collector-payment-form');
      paymentForm.style.display = 'block';
      const amountInput = document.getElementById('collect-amount-input');
      amountInput.value = '';
      amountInput.focus();

      // Render payment history
      this.renderContributorPaymentHistory(contributor.payments || []);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  renderContributorPaymentHistory(payments) {
    const historyTable = document.getElementById('contributor-payment-history-tbody');
    if (!historyTable) return;

    if (!payments || payments.length === 0) {
      historyTable.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#64748b;">No payments recorded yet for this campaign</td></tr>`;
      return;
    }

    historyTable.innerHTML = payments.map(p => `
      <tr>
        <td><strong>${p.tx_code}</strong></td>
        <td>${window.i18n.getLang() === 'fr' ? p.session_name_fr : p.session_name_en}</td>
        <td><span class="group-pill">${window.i18n.getLang() === 'fr' ? p.payment_method_fr : p.payment_method_en}</span></td>
        <td>${p.created_at}</td>
        <td class="text-right">
          <strong>₣${Number(p.amount).toLocaleString()}</strong>
          ${p.original_amount && p.original_amount !== p.amount ? `<br><small style="color:#64748b;text-decoration:line-through;">₣${Number(p.original_amount).toLocaleString()}</small>` : ''}
        </td>
        <td class="text-center">
          <button class="btn btn-secondary btn-sm" style="padding:0.2rem 0.45rem;font-size:0.75rem;" onclick="app.openEditPaymentModal('${p.id}', ${p.amount})">
            ✏️ ${window.i18n.t('btnEditPayment')}
          </button>
        </td>
      </tr>
    `).join('');
  }

  openEditPaymentModal(txId, currentAmount) {
    document.getElementById('edit-payment-id').value = txId;
    document.getElementById('edit-payment-original-amount').value = `₣${Number(currentAmount).toLocaleString()} FCFA`;
    document.getElementById('edit-payment-new-amount').value = currentAmount;
    document.getElementById('edit-payment-reason').value = '';
    document.getElementById('edit-payment-modal').style.display = 'flex';
  }

  async handleSaveEditPayment() {
    const txId = document.getElementById('edit-payment-id').value;
    const newAmount = parseInt(document.getElementById('edit-payment-new-amount').value.replace(/\D/g, ''), 10);
    const reason = document.getElementById('edit-payment-reason').value;

    if (!newAmount || newAmount <= 0) {
      this.showToast('Please enter a valid corrected amount in FCFA', 'error');
      return;
    }

    if (!reason || reason.trim().length < 3) {
      this.showToast('Please provide a mandatory reason for the correction', 'error');
      return;
    }

    try {
      await window.api.editPayment(txId, {
        new_amount: newAmount,
        reason: reason.trim()
      });

      this.showToast(window.i18n.t('paymentUpdatedSuccess'), 'success');
      document.getElementById('edit-payment-modal').style.display = 'none';

      // Refresh contributor & reports
      if (this.selectedContributor) {
        await this.selectContributor(this.selectedContributor.id);
      }
      if (this.activeTab === 'reports') {
        this.filterTransactionsReport();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleSavePayment() {
    if (!this.selectedContributor) {
      this.showToast('Please select a contributor first', 'warning');
      return;
    }

    const amountInput = document.getElementById('collect-amount-input');
    const amount = parseInt(amountInput.value.replace(/\D/g, ''), 10);
    const sessionId = document.getElementById('collect-session-select').value;
    const paymentMethodId = document.getElementById('collect-method-select').value;
    const incomeSourceId = document.getElementById('collect-source-select').value;
    const notes = document.getElementById('collect-notes-input').value;

    if (!amount || amount <= 0) {
      this.showToast('Please enter a valid amount in FCFA', 'error');
      amountInput.focus();
      return;
    }

    const clientTxId = crypto.randomUUID ? crypto.randomUUID() : `tx-client-${Date.now()}`;
    const payload = {
      client_tx_id: clientTxId,
      harvest_id: 'hrv-2026',
      session_id: sessionId,
      contributor_id: this.selectedContributor.id,
      is_anonymous: 0,
      amount,
      payment_method_id: paymentMethodId,
      income_source_id: incomeSourceId,
      notes,
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    try {
      let receiptData = null;

      if (this.isOnline) {
        const res = await window.api.recordPayment(payload);
        receiptData = res.transaction;
        this.showToast(window.i18n.t('paymentSuccess'), 'success');
      } else {
        await window.offlineStorage.queueOfflineTransaction(payload);
        this.outboxCount++;
        this.updateOutboxBadge();
        receiptData = {
          tx_code: `OFFLINE-${clientTxId.substring(0, 8)}`,
          amount: payload.amount,
          created_at: payload.created_at,
          contributor_name: this.selectedContributor.name,
          contributor_code: this.selectedContributor.code,
          session_name_en: 'Current Session (Offline)',
          session_name_fr: 'Session Active (Hors-Ligne)',
          payment_method_en: 'Cash',
          payment_method_fr: 'Espèces',
          operator_name: this.currentUser ? this.currentUser.fullName : 'Desk Collector',
          terminal_name: 'Local Desk Terminal'
        };
        this.showToast('Payment safely stored offline. Ready to sync when online.', 'info');
      }

      await this.selectContributor(this.selectedContributor.id);
      this.openReceiptModal(receiptData);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  openReceiptModal(tx) {
    const target = this.selectedContributor ? Number(this.selectedContributor.target_amount || 0) : 0;
    const paid = this.selectedContributor ? Number(this.selectedContributor.total_paid || 0) : tx.amount;
    const balance = Math.max(0, target - paid);

    document.getElementById('receipt-number').textContent = tx.tx_code || tx.client_tx_id;
    document.getElementById('receipt-date').textContent = tx.created_at;
    document.getElementById('receipt-contributor-name').textContent = tx.contributor_name || (this.selectedContributor ? this.selectedContributor.name : 'Anonymous');
    document.getElementById('receipt-contributor-code').textContent = tx.contributor_code || (this.selectedContributor ? this.selectedContributor.code : '-');
    document.getElementById('receipt-amount').textContent = `₣${Number(tx.amount).toLocaleString()} FCFA`;
    document.getElementById('receipt-target').textContent = `₣${target.toLocaleString()} FCFA`;
    document.getElementById('receipt-paid-to-date').textContent = `₣${paid.toLocaleString()} FCFA`;
    document.getElementById('receipt-balance').textContent = `₣${balance.toLocaleString()} FCFA`;
    document.getElementById('receipt-operator').textContent = `${tx.operator_name || 'Desk Collector'} (${tx.terminal_name || 'Terminal'})`;

    document.getElementById('receipt-modal').style.display = 'flex';
  }

  closeReceiptModal(readyNext = false) {
    document.getElementById('receipt-modal').style.display = 'none';
    if (readyNext) {
      this.selectedContributor = null;
      document.getElementById('contributor-focus-details').innerHTML = `
        <div style="padding: 2.5rem; text-align: center; color: #64748b;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">⚡</div>
          <div style="font-weight: 600;">${window.i18n.t('selectContributorPrompt')}</div>
        </div>
      `;
      document.getElementById('collector-payment-form').style.display = 'none';
      const searchInput = document.getElementById('contributor-search-input');
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      this.searchContributors('');
    }
  }

  // --- CSV TEMPLATE & BATCH UPLOAD ---
  downloadCSVTemplate() {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "contributor_code_or_name,amount,session_code_or_name,payment_method,income_source,notes\n" +
      "H26-0001,50000,LAUNCH_SUNDAY,CASH,PERSONAL_DIRECT_PLEDGE,Sample offline desk entry\n" +
      "John Fru N.,25000,DEDICATION_SUNDAY,MOMO,PERSONAL_DIRECT_PLEDGE,Mobile money collection\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Harvest_Collection_Template_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  openCSVUploadModal() {
    this.populateSessionDropdown('csv-session-select');
    document.getElementById('csv-upload-modal').style.display = 'flex';
  }

  async handleUploadCSV() {
    const fileInput = document.getElementById('csv-file-input');
    const sessionId = document.getElementById('csv-session-select').value;

    if (!fileInput.files || fileInput.files.length === 0) {
      this.showToast('Please select a CSV file to upload', 'error');
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const res = await window.api.uploadCSVPayments(text, sessionId);
        this.showToast(`CSV Uploaded: ${res.successCount} transactions created, ${res.duplicateCount} duplicates, ${res.errorCount} errors`, 'success');
        document.getElementById('csv-upload-modal').style.display = 'none';
        if (this.activeTab === 'collection') this.loadCollectionDesk();
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    };

    reader.readAsText(file);
  }

  // --- RECONCILIATION & TWO-PARTY VERIFICATION ---
  async loadReconciliationView() {
    this.populateSessionDropdown('recon-session-select');
    await this.onReconciliationSessionChange();
    await this.loadReconciliationHistory();
  }

  async onReconciliationSessionChange() {
    const sessionId = document.getElementById('recon-session-select').value;
    if (!sessionId) return;

    try {
      // 1. Fetch System Totals
      const res = await window.api.getSystemTotals(sessionId);
      const t = res.totals;

      document.getElementById('recon-sys-cash').textContent = `₣${t.systemCash.toLocaleString()}`;
      document.getElementById('recon-sys-cheque').textContent = `₣${t.systemCheque.toLocaleString()}`;
      document.getElementById('recon-sys-momo').textContent = `₣${t.systemMomo.toLocaleString()}`;
      document.getElementById('recon-sys-transfer').textContent = `₣${t.systemTransfer.toLocaleString()}`;
      document.getElementById('recon-sys-total').textContent = `₣${t.systemTotal.toLocaleString()}`;

      this.calculateReconciliationDiscrepancy(t.systemTotal);

      // 2. Fetch Collector breakdown
      await this.loadCollectorsBreakdown(sessionId);

      // 3. Show admin approve button if user is ADMIN
      const adminBtn = document.getElementById('btn-admin-final-approve');
      if (adminBtn && this.currentUser && this.currentUser.roleCode === 'ADMIN') {
        adminBtn.style.display = 'block';
      }
    } catch (err) {
      console.error('Failed to get session system totals:', err);
    }
  }

  async loadCollectorsBreakdown(sessionId) {
    const tbody = document.getElementById('recon-collectors-tbody');
    if (!tbody) return;

    try {
      const res = await window.api.getCollectorsSummary(sessionId);
      if (!res.collectors || res.collectors.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#64748b;">No desk collectors have recorded transactions in this session yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = res.collectors.map(c => `
        <tr>
          <td><strong>${c.collector_name}</strong> <small>(${c.collector_username})</small></td>
          <td class="text-center">${c.transaction_count}</td>
          <td class="text-right"><strong>₣${Number(c.cash_amount).toLocaleString()}</strong></td>
          <td class="text-right">₣${Number(c.other_amount).toLocaleString()}</td>
          <td class="text-right" style="color:var(--primary-green);font-weight:800;">₣${Number(c.total_amount).toLocaleString()}</td>
          <td><span class="status-pill ${c.status === 'VERIFIED' ? 'online' : 'offline'}">${c.status}</span></td>
          <td>${c.verification ? `${c.verification.verifier_name} (${c.verification.verified_at})` : '-'}</td>
          <td class="text-center">
            ${c.status !== 'VERIFIED' ? `
              <button class="btn btn-primary btn-sm" onclick="app.handleVerifyCollectorDesk('${c.collector_id}', ${c.transaction_count}, ${c.cash_amount}, ${c.other_amount}, ${c.total_amount})">
                ✓ ${window.i18n.t('btnVerifyCollector')}
              </button>
            ` : `<span style="color:var(--status-success);font-weight:bold;">✓ Verified</span>`}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load collectors breakdown:', err);
    }
  }

  async handleVerifyCollectorDesk(collectorId, txCount, cash, other, total) {
    const sessionId = document.getElementById('recon-session-select').value;
    const notes = prompt('Enter verifier sign-off notes for this collector desk:', 'Counted & agreed at collection desk');
    if (notes === null) return;

    try {
      await window.api.verifyCollectorDesk({
        harvest_id: 'hrv-2026',
        session_id: sessionId,
        collector_id: collectorId,
        total_transactions: txCount,
        total_cash: cash,
        total_other: other,
        total_amount: total,
        status: 'VERIFIED',
        verifier_notes: notes
      });

      this.showToast('Desk collector verified and signed off successfully!', 'success');
      await this.loadCollectorsBreakdown(sessionId);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleAdminApproveSession() {
    const sessionId = document.getElementById('recon-session-select').value;
    const notes = prompt('Enter Admin Master Approval sign-off notes:', 'Final reconciliation verified and approved by Admin');
    if (notes === null) return;

    try {
      await window.api.recordReconciliation({
        harvest_id: 'hrv-2026',
        session_id: sessionId,
        physical_cash: parseInt(document.getElementById('recon-phys-cash').value || 0, 10),
        physical_cheque: parseInt(document.getElementById('recon-phys-cheque').value || 0, 10),
        physical_momo: parseInt(document.getElementById('recon-phys-momo').value || 0, 10),
        physical_transfer: parseInt(document.getElementById('recon-phys-transfer').value || 0, 10),
        notes: `[ADMIN APPROVED] ${notes}`
      });

      this.showToast('Harvest session signed off and locked under Admin Authority!', 'success');
      this.loadReconciliationHistory();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  calculateReconciliationDiscrepancy() {
    const sysTotalText = document.getElementById('recon-sys-total').textContent.replace(/[^\d]/g, '');
    const systemTotal = parseInt(sysTotalText, 10) || 0;

    const pCash = parseInt(document.getElementById('recon-phys-cash').value || 0, 10);
    const pCheque = parseInt(document.getElementById('recon-phys-cheque').value || 0, 10);
    const pMomo = parseInt(document.getElementById('recon-phys-momo').value || 0, 10);
    const pTransfer = parseInt(document.getElementById('recon-phys-transfer').value || 0, 10);

    const physicalTotal = pCash + pCheque + pMomo + pTransfer;
    document.getElementById('recon-phys-total').textContent = `₣${physicalTotal.toLocaleString()}`;

    const discrepancy = physicalTotal - systemTotal;
    const diffEl = document.getElementById('recon-discrepancy');
    const badgeEl = document.getElementById('recon-status-badge');

    diffEl.textContent = `₣${discrepancy.toLocaleString()}`;

    if (discrepancy === 0) {
      diffEl.style.color = 'var(--status-success)';
      badgeEl.className = 'status-pill online';
      badgeEl.textContent = window.i18n.t('statusReconciled');
    } else {
      diffEl.style.color = 'var(--status-danger)';
      badgeEl.className = 'status-pill offline';
      badgeEl.textContent = `${window.i18n.t('statusDiscrepancy')} (${discrepancy > 0 ? '+' : ''}₣${discrepancy.toLocaleString()})`;
    }
  }

  async submitReconciliation() {
    const sessionId = document.getElementById('recon-session-select').value;
    const physicalCash = parseInt(document.getElementById('recon-phys-cash').value || 0, 10);
    const physicalCheque = parseInt(document.getElementById('recon-phys-cheque').value || 0, 10);
    const physicalMomo = parseInt(document.getElementById('recon-phys-momo').value || 0, 10);
    const physicalTransfer = parseInt(document.getElementById('recon-phys-transfer').value || 0, 10);
    const notes = document.getElementById('recon-notes').value;

    try {
      await window.api.recordReconciliation({
        harvest_id: 'hrv-2026',
        session_id: sessionId,
        physical_cash: physicalCash,
        physical_cheque: physicalCheque,
        physical_momo: physicalMomo,
        physical_transfer: physicalTransfer,
        notes
      });

      this.showToast('Reconciliation recorded and audit entry logged successfully!', 'success');
      this.loadReconciliationHistory();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async loadReconciliationHistory() {
    const tbody = document.getElementById('recon-history-tbody');
    if (!tbody) return;

    try {
      const res = await window.api.listReconciliations();
      tbody.innerHTML = res.reconciliations.map(r => `
        <tr>
          <td><strong>${window.i18n.getLang() === 'fr' ? r.session_name_fr : r.session_name_en}</strong></td>
          <td class="text-right">₣${Number(r.system_total).toLocaleString()}</td>
          <td class="text-right">₣${Number(r.physical_total).toLocaleString()}</td>
          <td class="text-right" style="font-weight:700; color:${r.discrepancy === 0 ? 'var(--status-success)' : 'var(--status-danger)'};">
            ₣${Number(r.discrepancy).toLocaleString()}
          </td>
          <td><span class="status-pill ${r.status === 'RECONCILED' ? 'online' : 'offline'}">${r.status}</span></td>
          <td>${r.verifier_name}</td>
          <td>${r.verified_at}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load reconciliations:', err);
    }
  }

  // --- GROUP PORTAL ---
  async loadGroupPortal() {
    try {
      const res = await window.api.getGroupAnalytics();
      const analytics = res.groupAnalytics;

      const groupCardsContainer = document.getElementById('group-portal-cards');
      groupCardsContainer.innerHTML = analytics.map(g => `
        <div class="kpi-card purple" style="margin-bottom:1rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
            <h3 style="font-size:1.15rem;font-weight:800;color:var(--dark-slate);">${window.i18n.getLang() === 'fr' ? g.nameFr : g.nameEn}</h3>
            <span class="group-pill" style="font-size:0.85rem;padding:0.25rem 0.65rem;">${g.groupCode}</span>
          </div>
          <div class="financial-progress-grid">
            <div class="progress-box">
              <div class="progress-box-label">${window.i18n.t('target')}</div>
              <div class="progress-box-value">₣${g.targetAmount.toLocaleString()}</div>
            </div>
            <div class="progress-box">
              <div class="progress-box-label">${window.i18n.t('paid')}</div>
              <div class="progress-box-value paid">₣${g.collectedAmount.toLocaleString()}</div>
            </div>
            <div class="progress-box">
              <div class="progress-box-label">${window.i18n.t('completion')}</div>
              <div class="progress-box-value" style="color:var(--accent-purple);">${g.completionRate}%</div>
            </div>
          </div>
        </div>
      `).join('');

      // Load group members
      const memberListRes = await window.api.listContributors({ limit: 100 });
      const tbody = document.getElementById('group-members-tbody');
      if (tbody) {
        tbody.innerHTML = memberListRes.contributors.map(c => `
          <tr>
            <td><span class="profile-code">${c.code}</span></td>
            <td><strong>${c.name}</strong></td>
            <td>${c.phone || '-'}</td>
            <td><span class="category-badge ${c.category_code || 'GENERAL'}">${c.category_code || 'GENERAL'}</span></td>
            <td class="text-right">₣${Number(c.target_amount).toLocaleString()}</td>
            <td class="text-right" style="color:var(--primary-green);font-weight:700;">₣${Number(c.total_paid).toLocaleString()}</td>
            <td class="text-right" style="color:var(--status-warning);font-weight:700;">₣${Number(c.balance).toLocaleString()}</td>
            <td class="text-center"><strong>${c.completion_percentage}%</strong></td>
          </tr>
        `).join('');
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // --- GARDEN DESK ---
  async loadGardenView() {
    this.populateSessionDropdown('garden-session-select');
    this.populatePaymentMethodsDropdown('garden-method-select');

    try {
      const res = await window.api.listGardenProducts();
      const productSelect = document.getElementById('garden-product-select');
      productSelect.innerHTML = res.products.map(p => `
        <option value="${p.id}" data-price="${p.unit_price}" data-name="${window.i18n.getLang() === 'fr' ? p.name_fr : p.name_en}">
          ${window.i18n.getLang() === 'fr' ? p.name_fr : p.name_en} — Base ₣${Number(p.unit_price).toLocaleString()}
        </option>
      `).join('');

      this.onGardenProductChange();
      this.loadGardenSalesHistory();
    } catch (err) {
      console.error('Failed to load garden products:', err);
    }
  }

  onGardenProductChange() {
    const productSelect = document.getElementById('garden-product-select');
    const selectedOption = productSelect.options[productSelect.selectedIndex];
    const unitPrice = selectedOption ? parseInt(selectedOption.getAttribute('data-price') || 0, 10) : 0;
    document.getElementById('garden-unit-price-input').value = unitPrice;
    this.updateGardenTotal();
  }

  updateGardenTotal() {
    const unitPrice = parseInt(document.getElementById('garden-unit-price-input').value || 0, 10);
    const qty = parseInt(document.getElementById('garden-qty-input').value || 1, 10);
    const total = unitPrice * qty;
    document.getElementById('garden-total-amount').textContent = `₣${total.toLocaleString()} FCFA`;
  }

  async handleSaveGardenSale() {
    const productSelect = document.getElementById('garden-product-select');
    const selectedOption = productSelect.options[productSelect.selectedIndex];
    if (!selectedOption) return;

    const productId = productSelect.value;
    const productName = selectedOption.getAttribute('data-name');
    const unitPrice = parseInt(document.getElementById('garden-unit-price-input').value || 0, 10);
    const quantity = parseInt(document.getElementById('garden-qty-input').value, 10);
    const sessionId = document.getElementById('garden-session-select').value;
    const paymentMethodId = document.getElementById('garden-method-select').value;
    const buyerName = document.getElementById('garden-buyer-input').value;

    if (unitPrice <= 0) {
      this.showToast('Please enter a valid unit selling price', 'error');
      return;
    }

    const payload = {
      harvest_id: 'hrv-2026',
      session_id: sessionId,
      product_id: productId,
      product_name: productName,
      quantity,
      unit_price: unitPrice,
      payment_method_id: paymentMethodId,
      buyer_name: buyerName,
      client_sale_id: crypto.randomUUID ? crypto.randomUUID() : `sale-${Date.now()}`
    };

    try {
      if (this.isOnline) {
        await window.api.recordGardenSale(payload);
        this.showToast('Garden sale recorded successfully!', 'success');
      } else {
        await window.offlineStorage.queueOfflineGardenSale(payload);
        this.outboxCount++;
        this.updateOutboxBadge();
        this.showToast('Garden sale queued locally offline.', 'info');
      }

      document.getElementById('garden-buyer-input').value = '';
      this.loadGardenSalesHistory();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async loadGardenSalesHistory() {
    const tbody = document.getElementById('garden-sales-tbody');
    if (!tbody) return;

    try {
      const res = await window.api.listGardenSales({ limit: 20 });
      tbody.innerHTML = res.sales.map(s => `
        <tr>
          <td><strong>${s.product_name}</strong></td>
          <td class="text-center">${s.quantity}</td>
          <td class="text-right">₣${Number(s.unit_price).toLocaleString()}</td>
          <td class="text-right"><strong>₣${Number(s.total_amount).toLocaleString()}</strong></td>
          <td>${s.buyer_name || '-'}</td>
          <td>${window.i18n.getLang() === 'fr' ? s.session_name_fr : s.session_name_en}</td>
          <td>${s.created_at}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load garden sales:', err);
    }
  }

  // --- ANONYMOUS DESK ---
  async loadAnonymousView() {
    this.populateSessionDropdown('anon-session-select');
    this.populatePaymentMethodsDropdown('anon-method-select');
    this.populateIncomeSourcesDropdown('anon-source-select');
  }

  async handleSaveAnonymous() {
    const amount = parseInt(document.getElementById('anon-amount-input').value.replace(/\D/g, ''), 10);
    const sessionId = document.getElementById('anon-session-select').value;
    const paymentMethodId = document.getElementById('anon-method-select').value;
    const incomeSourceId = document.getElementById('anon-source-select').value;
    const notes = document.getElementById('anon-notes-input').value;

    if (!amount || amount <= 0) {
      this.showToast('Please enter a valid gift amount', 'error');
      return;
    }

    const payload = {
      client_tx_id: crypto.randomUUID ? crypto.randomUUID() : `tx-anon-${Date.now()}`,
      harvest_id: 'hrv-2026',
      session_id: sessionId,
      is_anonymous: 1,
      amount,
      payment_method_id: paymentMethodId,
      income_source_id: incomeSourceId,
      notes: notes || 'Altar Freewill Anonymous Offering'
    };

    try {
      const res = await window.api.recordPayment(payload);
      this.showToast('Anonymous offering recorded with audit verification!', 'success');
      document.getElementById('anon-amount-input').value = '';
      document.getElementById('anon-notes-input').value = '';
      this.openReceiptModal(res.transaction);
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // --- REPORTS ---
  async loadReportsView() {
    this.populateSessionDropdown('report-filter-session', true);
    this.populateGroupsDropdown('report-filter-group', true);
    this.filterTransactionsReport();

    // Church Summary
    try {
      const summaryRes = await window.api.getChurchSummary();
      const s = summaryRes.summary;
      document.getElementById('rpt-total-income').textContent = `₣${s.churchTotalIncome.toLocaleString()}`;
      document.getElementById('rpt-direct-contributions').textContent = `₣${s.directContributions.toLocaleString()}`;
      document.getElementById('rpt-garden-sales').textContent = `₣${s.gardenSalesTotal.toLocaleString()}`;
      document.getElementById('rpt-anonymous-total').textContent = `₣${s.anonymousTotal.toLocaleString()}`;
      document.getElementById('rpt-total-target').textContent = `₣${s.totalTarget.toLocaleString()}`;
      document.getElementById('rpt-outstanding').textContent = `₣${s.outstandingCommitment.toLocaleString()}`;
      document.getElementById('rpt-completion-rate').textContent = `${s.globalCompletionRate}%`;
    } catch (err) {
      console.error('Failed to load church summary:', err);
    }

    // Group Analytics
    try {
      const groupRes = await window.api.getGroupAnalytics();
      const tbody = document.getElementById('rpt-group-analytics-tbody');
      tbody.innerHTML = groupRes.groupAnalytics.map(g => `
        <tr>
          <td><span class="group-pill">${g.groupCode}</span> ${window.i18n.getLang() === 'fr' ? g.nameFr : g.nameEn}</td>
          <td>${g.memberCount}</td>
          <td>${g.activeContributors}</td>
          <td class="text-right">₣${g.targetAmount.toLocaleString()}</td>
          <td class="text-right" style="color:#16a34a;font-weight:600;">₣${g.collectedAmount.toLocaleString()}</td>
          <td class="text-right" style="color:#dc2626;">₣${g.balanceAmount.toLocaleString()}</td>
          <td>
            <div style="background:#e2e8f0;border-radius:4px;height:18px;overflow:hidden;min-width:80px;">
              <div style="background:${g.completionRate >= 75 ? '#16a34a' : g.completionRate >= 50 ? '#ca8a04' : '#dc2626'};height:100%;width:${Math.min(g.completionRate, 100)}%;display:flex;align-items:center;justify-content:center;font-size:0.65rem;color:#fff;font-weight:600;">
                ${g.completionRate}%
              </div>
            </div>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load group analytics:', err);
    }
  }

  async filterTransactionsReport() {
    const sessionId = document.getElementById('report-filter-session').value;
    const groupId = document.getElementById('report-filter-group').value;

    try {
      const res = await window.api.listTransactions({
        session_id: sessionId || undefined,
        group_id: groupId || undefined,
        limit: 100
      });

      document.getElementById('report-tx-total-amount').textContent = `₣${res.totalAmount.toLocaleString()} FCFA`;
      document.getElementById('report-tx-total-count').textContent = res.total;

      const tbody = document.getElementById('reports-transactions-tbody');
      tbody.innerHTML = res.transactions.map(t => `
        <tr>
          <td><strong>${t.tx_code}</strong></td>
          <td>${t.is_anonymous ? '<em>(Anonymous Offering)</em>' : `<strong>${t.contributor_name}</strong> <span class="profile-code">${t.contributor_code}</span>`}</td>
          <td class="text-right">
            <strong>₣${Number(t.amount).toLocaleString()}</strong>
            ${t.original_amount && t.original_amount !== t.amount ? `<br><small style="color:#64748b;text-decoration:line-through;">₣${Number(t.original_amount).toLocaleString()}</small>` : ''}
          </td>
          <td>${window.i18n.getLang() === 'fr' ? t.session_name_fr : t.session_name_en}</td>
          <td><span class="group-pill">${window.i18n.getLang() === 'fr' ? t.payment_method_fr : t.payment_method_en}</span></td>
          <td>${t.created_at}</td>
          <td><span class="status-pill online">${t.status}</span></td>
          <td class="text-center">
            <button class="btn btn-secondary btn-sm" style="padding:0.2rem 0.45rem;font-size:0.75rem;" onclick="app.openEditPaymentModal('${t.id}', ${t.amount})">
              ✏️ Edit
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  exportTransactionsCSV() {
    const sessionId = document.getElementById('report-filter-session').value;
    const groupId = document.getElementById('report-filter-group').value;
    const url = `/api/reports/export/transactions-csv?harvest_id=hrv-2026${sessionId ? `&session_id=${sessionId}` : ''}${groupId ? `&group_id=${groupId}` : ''}`;
    window.open(url, '_blank');
  }

  exportContributorsCSV() {
    const groupId = document.getElementById('report-filter-group').value;
    const url = `/api/reports/export/contributors-csv?harvest_id=hrv-2026${groupId ? `&group_id=${groupId}` : ''}`;
    window.open(url, '_blank');
  }

  // --- CONTRIBUTORS MANAGEMENT ---
  async loadContributorsView() {
    this.populateGroupsDropdown('contrib-filter-group', true);
    this.filterContributorsList();
  }

  async filterContributorsList() {
    const search = document.getElementById('contrib-search-input').value;
    const groupId = document.getElementById('contrib-filter-group').value;

    try {
      const res = await window.api.listContributors({ search, group_id: groupId || undefined, limit: 100 });
      const tbody = document.getElementById('contributors-table-tbody');
      tbody.innerHTML = res.contributors.map(c => `
        <tr>
          <td><span class="profile-code">${c.code}</span></td>
          <td><strong>${c.name}</strong></td>
          <td>${c.phone || '-'}</td>
          <td>${(c.groups || []).map(g => `<span class="group-pill">${g.code}</span>`).join(' ')}</td>
          <td><span class="category-badge ${c.category_code || 'GENERAL'}">${c.category_code || 'GENERAL'}</span></td>
          <td class="text-right">₣${Number(c.target_amount).toLocaleString()}</td>
          <td class="text-right" style="color:var(--primary-green);font-weight:700;">₣${Number(c.total_paid).toLocaleString()}</td>
          <td class="text-right" style="color:var(--status-warning);font-weight:700;">₣${Number(c.balance).toLocaleString()}</td>
          <td class="text-center"><strong>${c.completion_percentage}%</strong></td>
          <td class="text-center">
            <button class="btn btn-primary" style="padding:0.25rem 0.5rem;font-size:0.75rem;" onclick="app.switchTab('collection'); app.selectContributor('${c.id}');">Pay</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  openCreateContributorModal() {
    this.populateGroupsCheckboxes('new-contrib-groups-container');
    this.populateCategoriesDropdown('new-contrib-category-select');
    document.getElementById('new-contrib-name').value = '';
    document.getElementById('new-contrib-phone').value = '';
    document.getElementById('new-contrib-email').value = '';
    document.getElementById('new-contrib-target').value = '';
    document.getElementById('create-contributor-modal').style.display = 'flex';
  }

  async handleCreateContributor() {
    const name = document.getElementById('new-contrib-name').value;
    const phone = document.getElementById('new-contrib-phone').value;
    const email = document.getElementById('new-contrib-email').value;
    const categoryId = document.getElementById('new-contrib-category-select').value;
    const targetAmount = parseInt(document.getElementById('new-contrib-target').value.replace(/\D/g, '') || 0, 10);
    const checkedGroups = Array.from(document.querySelectorAll('.new-contrib-group-cb:checked')).map(cb => cb.value);

    if (!name || !name.trim()) {
      this.showToast('Contributor name is required', 'error');
      return;
    }

    const payload = {
      name: name.trim(),
      phone,
      email,
      category_id: categoryId,
      target_amount: targetAmount,
      group_ids: checkedGroups
    };

    // Case-insensitive duplicate check
    try {
      const dupRes = await window.api.checkDuplicateContributor(name.trim());
      if (dupRes.duplicateFound && dupRes.matches && dupRes.matches.length > 0) {
        this.pendingContributorData = payload;
        const match = dupRes.matches[0];
        document.getElementById('duplicate-existing-details').innerHTML = `
          <strong>Existing Record:</strong><br>
          • <strong>${match.name}</strong> (${match.code})<br>
          • Phone: ${match.phone || 'None'}<br>
          • Target: ₣${Number(match.target_amount || 0).toLocaleString()} FCFA
        `;
        document.getElementById('duplicate-warning-modal').style.display = 'flex';
        return;
      }
    } catch (e) {
      console.warn('Duplicate check warning:', e);
    }

    await this.executeContributorCreation(payload);
  }

  async confirmDuplicateRegistration() {
    document.getElementById('duplicate-warning-modal').style.display = 'none';
    if (this.pendingContributorData) {
      await this.executeContributorCreation(this.pendingContributorData);
      this.pendingContributorData = null;
    }
  }

  cancelDuplicateRegistration() {
    document.getElementById('duplicate-warning-modal').style.display = 'none';
    this.pendingContributorData = null;
  }

  async executeContributorCreation(payload) {
    try {
      await window.api.createContributor(payload);
      this.showToast('Contributor registered successfully!', 'success');
      document.getElementById('create-contributor-modal').style.display = 'none';
      this.filterContributorsList();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // --- ADMIN & USERS ---
  async loadAdminView() {
    try {
      const res = await window.api.listUsers();
      this._usersCache = res.users;
      const tbody = document.getElementById('admin-users-tbody');
      tbody.innerHTML = res.users.map(u => `
        <tr>
          <td><strong>${u.username}</strong></td>
          <td>${u.full_name}</td>
          <td><span class="user-role-tag">${u.role_code}</span></td>
          <td>${(u.assignedGroups || []).map(g => `<span class="group-pill">${g.code}</span>`).join(' ')}</td>
          <td><span class="status-pill ${u.is_active ? 'online' : 'offline'}">${u.is_active ? 'Active' : 'Disabled'}</span></td>
          <td style="white-space:nowrap;">
            <button class="btn btn-secondary" style="padding:0.25rem 0.5rem;font-size:0.75rem;" onclick="app.openEditUserModal('${u.id}')">✏️ Edit</button>
            <button class="btn btn-secondary" style="padding:0.25rem 0.5rem;font-size:0.75rem;" onclick="app.handleToggleUserStatus('${u.id}', ${u.is_active})">${u.is_active ? '🔒 Disable' : '✅ Enable'}</button>
            <button class="btn btn-secondary" style="padding:0.25rem 0.5rem;font-size:0.75rem;" onclick="app.promptResetPassword('${u.id}', '${u.username}')">🔑 Reset</button>
            <button class="btn btn-secondary" style="padding:0.25rem 0.5rem;font-size:0.75rem;color:#dc2626;" onclick="app.handleDeleteUser('${u.id}', '${u.username}')">🗑️</button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  openCreateUserModal() {
    this.populateRolesDropdown('new-user-role-select');
    this.populateGroupsCheckboxes('new-user-groups-container');
    document.getElementById('create-user-modal').style.display = 'flex';
  }

  async handleCreateUser() {
    const username = document.getElementById('new-user-username').value;
    const fullName = document.getElementById('new-user-fullname').value;
    const email = document.getElementById('new-user-email').value;
    const roleId = document.getElementById('new-user-role-select').value;
    const tempPassword = document.getElementById('new-user-temppass').value;
    const checkedGroups = Array.from(document.querySelectorAll('.new-user-group-cb:checked')).map(cb => cb.value);

    try {
      await window.api.createUser({
        username,
        full_name: fullName,
        email,
        role_id: roleId,
        temp_password: tempPassword,
        group_ids: checkedGroups
      });

      this.showToast('User created with temporary password requirement!', 'success');
      document.getElementById('create-user-modal').style.display = 'none';
      this.loadAdminView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async promptResetPassword(userId, username) {
    const tempPass = prompt(`Enter new temporary password for user '${username}':`, 'Temp1234!');
    if (!tempPass) return;

    try {
      await window.api.resetUserPassword(userId, tempPass);
      this.showToast(`Temporary password reset for ${username}. User will be forced to change password on next login.`, 'success');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  openEditUserModal(userId) {
    const user = (this._usersCache || []).find(u => u.id === userId);
    if (!user) return this.showToast('User not found', 'error');

    this.populateRolesDropdown('edit-user-role-select');
    this.populateGroupsCheckboxes('edit-user-groups-container');

    document.getElementById('edit-user-id').value = user.id;
    document.getElementById('edit-user-username').value = user.username;
    document.getElementById('edit-user-fullname').value = user.full_name;
    document.getElementById('edit-user-email').value = user.email || '';
    document.getElementById('edit-user-phone').value = user.phone || '';

    setTimeout(() => {
      document.getElementById('edit-user-role-select').value = user.role_id;
      const groupIds = (user.assignedGroups || []).map(g => g.id);
      document.querySelectorAll('.edit-user-group-cb').forEach(cb => {
        cb.checked = groupIds.includes(cb.value);
      });
    }, 50);

    document.getElementById('edit-user-modal').style.display = 'flex';
  }

  async handleEditUser() {
    const userId = document.getElementById('edit-user-id').value;
    const username = document.getElementById('edit-user-username').value;
    const fullName = document.getElementById('edit-user-fullname').value;
    const email = document.getElementById('edit-user-email').value;
    const phone = document.getElementById('edit-user-phone').value;
    const roleId = document.getElementById('edit-user-role-select').value;
    const checkedGroups = Array.from(document.querySelectorAll('.edit-user-group-cb:checked')).map(cb => cb.value);

    try {
      await window.api.updateUser(userId, {
        username,
        full_name: fullName,
        email,
        phone,
        role_id: roleId,
        group_ids: checkedGroups
      });
      this.showToast('User updated successfully!', 'success');
      document.getElementById('edit-user-modal').style.display = 'none';
      this.loadAdminView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleToggleUserStatus(userId, currentlyActive) {
    const action = currentlyActive ? 'disable' : 'enable';
    if (!confirm(`Are you sure you want to ${action} this user?`)) return;

    try {
      await window.api.toggleUserStatus(userId, !currentlyActive);
      this.showToast(`User ${action}d successfully`, 'success');
      this.loadAdminView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleDeleteUser(userId, username) {
    if (!confirm(`⚠️ Permanently delete user "${username}"? This cannot be undone.`)) return;

    try {
      await window.api.deleteUser(userId);
      this.showToast(`User "${username}" deleted`, 'success');
      this.loadAdminView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // --- CAMPAIGN CONFIGURATION (ADMIN SETTINGS) ---
  async loadAdminConfigView() {
    try {
      const config = await window.api.getHarvestConfig();
      this.config = config;

      // 1. Season Target
      if (config.harvest) {
        document.getElementById('config-season-target-input').value = config.harvest.target_amount || 0;
      }

      // 2. Groups
      const groupsTbody = document.getElementById('config-groups-tbody');
      groupsTbody.innerHTML = config.groups.map(g => `
        <tr>
          <td><span class="group-pill">${g.code}</span></td>
          <td>${g.name_en}</td>
          <td>${g.name_fr}</td>
          <td><span class="status-pill ${g.is_active ? 'online' : 'offline'}">${g.is_active ? 'Active' : 'Inactive'}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="app.openGroupModal('${g.id}', '${g.code}', '${g.name_en}', '${g.name_fr}', '${g.description || ''}')">Edit</button>
            ${g.is_active ? `<button class="btn btn-danger btn-sm" onclick="app.handleDeactivateGroup('${g.id}')">Deactivate</button>` : ''}
          </td>
        </tr>
      `).join('');

      // 3. Sessions
      const sessionsTbody = document.getElementById('config-sessions-tbody');
      sessionsTbody.innerHTML = config.sessions.map(s => `
        <tr>
          <td><strong>${s.session_code}</strong></td>
          <td>${s.name_en} (${s.name_fr})</td>
          <td>${s.session_date}</td>
          <td>${s.is_default ? '<span style="color:var(--primary-green);font-weight:bold;">⭐ Default Active</span>' : '<span style="color:#64748b;">No</span>'}</td>
          <td><span class="status-pill ${s.is_active ? 'online' : 'offline'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="app.openSessionModal('${s.id}', '${s.session_code}', '${s.name_en}', '${s.name_fr}', '${s.session_date}', ${s.is_default})">Edit</button>
            ${!s.is_default ? `<button class="btn btn-purple btn-sm" onclick="app.handleSetDefaultSession('${s.id}')">Set Default</button>` : ''}
            ${s.is_active ? `<button class="btn btn-danger btn-sm" onclick="app.handleDeactivateSession('${s.id}')">Deactivate</button>` : ''}
          </td>
        </tr>
      `).join('');

      // 4. Categories
      const catTbody = document.getElementById('config-categories-tbody');
      catTbody.innerHTML = config.categories.map(c => `
        <tr>
          <td><span class="category-badge ${c.code}">${c.code}</span></td>
          <td>${c.name_en}</td>
          <td>${c.name_fr}</td>
          <td class="text-right"><strong>₣${Number(c.min_target).toLocaleString()}</strong></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="app.openCategoryModal('${c.id}', '${c.code}', '${c.name_en}', '${c.name_fr}', ${c.min_target})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="app.handleDeleteCategory('${c.id}')">Delete</button>
          </td>
        </tr>
      `).join('');

      // 5. Income Sources
      const srcTbody = document.getElementById('config-income-sources-tbody');
      srcTbody.innerHTML = config.incomeSources.map(i => `
        <tr>
          <td><strong>${i.code}</strong></td>
          <td>${i.name_en}</td>
          <td>${i.name_fr}</td>
          <td><span class="status-pill ${i.is_active ? 'online' : 'offline'}">${i.is_active ? 'Active' : 'Inactive'}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="app.openIncomeSourceModal('${i.id}', '${i.code}', '${i.name_en}', '${i.name_fr}')">Edit</button>
            ${i.is_active ? `<button class="btn btn-danger btn-sm" onclick="app.handleDeactivateIncomeSource('${i.id}')">Deactivate</button>` : ''}
          </td>
        </tr>
      `).join('');

      // 6. Garden Products
      const prodRes = await window.api.listGardenProducts();
      const prodTbody = document.getElementById('config-garden-products-tbody');
      prodTbody.innerHTML = prodRes.products.map(p => `
        <tr>
          <td><strong>${p.code}</strong></td>
          <td>${p.name_en}</td>
          <td>${p.name_fr}</td>
          <td class="text-right"><strong>₣${Number(p.unit_price).toLocaleString()}</strong></td>
          <td><span class="status-pill ${p.is_active ? 'online' : 'offline'}">${p.is_active ? 'Active' : 'Inactive'}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="app.openGardenProductModal('${p.id}', '${p.code}', '${p.name_en}', '${p.name_fr}', ${p.unit_price})">Edit</button>
            ${p.is_active ? `<button class="btn btn-danger btn-sm" onclick="app.handleDeactivateGardenProduct('${p.id}')">Deactivate</button>` : ''}
          </td>
        </tr>
      `).join('');

    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleUpdateSeasonTarget() {
    const target = parseInt(document.getElementById('config-season-target-input').value.replace(/\D/g, ''), 10);
    if (isNaN(target) || target < 0) {
      this.showToast('Please enter a valid target amount in FCFA', 'error');
      return;
    }
    try {
      await window.api.updateSeasonTarget(target);
      this.showToast(`Season target updated to ₣${target.toLocaleString()} FCFA!`, 'success');
      this.loadAdminConfigView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // Groups
  openGroupModal(id = '', code = '', nameEn = '', nameFr = '', desc = '') {
    document.getElementById('group-modal-id').value = id;
    document.getElementById('group-modal-code').value = code;
    document.getElementById('group-modal-name-en').value = nameEn;
    document.getElementById('group-modal-name-fr').value = nameFr;
    document.getElementById('group-modal-desc').value = desc;
    document.getElementById('config-group-modal').style.display = 'flex';
  }

  async handleSaveGroup() {
    const id = document.getElementById('group-modal-id').value;
    const code = document.getElementById('group-modal-code').value.trim();
    const name_en = document.getElementById('group-modal-name-en').value.trim();
    const name_fr = document.getElementById('group-modal-name-fr').value.trim();
    const description = document.getElementById('group-modal-desc').value.trim();

    try {
      if (id) {
        await window.api.updateGroup(id, { code, name_en, name_fr, description });
      } else {
        await window.api.createGroup({ code, name_en, name_fr, description });
      }
      this.showToast('Church group saved successfully!', 'success');
      document.getElementById('config-group-modal').style.display = 'none';
      this.loadAdminConfigView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleDeactivateGroup(id) {
    if (!confirm('Are you sure you want to deactivate this group?')) return;
    try {
      await window.api.deleteGroup(id);
      this.showToast('Group deactivated', 'info');
      this.loadAdminConfigView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // Sessions
  openSessionModal(id = '', code = '', nameEn = '', nameFr = '', date = '', isDefault = false) {
    document.getElementById('session-modal-id').value = id;
    document.getElementById('session-modal-code').value = code;
    document.getElementById('session-modal-name-en').value = nameEn;
    document.getElementById('session-modal-name-fr').value = nameFr;
    document.getElementById('session-modal-date').value = date;
    document.getElementById('session-modal-default').checked = !!isDefault;
    document.getElementById('config-session-modal').style.display = 'flex';
  }

  async handleSaveSession() {
    const id = document.getElementById('session-modal-id').value;
    const session_code = document.getElementById('session-modal-code').value.trim();
    const name_en = document.getElementById('session-modal-name-en').value.trim();
    const name_fr = document.getElementById('session-modal-name-fr').value.trim();
    const session_date = document.getElementById('session-modal-date').value;
    const is_default = document.getElementById('session-modal-default').checked ? 1 : 0;

    try {
      if (id) {
        await window.api.updateSession(id, { session_code, name_en, name_fr, session_date, is_default });
      } else {
        await window.api.createSession({ harvest_id: 'hrv-2026', session_code, name_en, name_fr, session_date, is_default });
      }
      this.showToast('Harvest session saved successfully!', 'success');
      document.getElementById('config-session-modal').style.display = 'none';
      this.loadAdminConfigView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleSetDefaultSession(id) {
    try {
      await window.api.setDefaultSession(id);
      this.showToast('Default active session updated for all collection desks!', 'success');
      this.loadAdminConfigView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleDeactivateSession(id) {
    if (!confirm('Are you sure you want to deactivate this harvest date?')) return;
    try {
      await window.api.deleteSession(id);
      this.showToast('Harvest session deactivated', 'info');
      this.loadAdminConfigView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // Categories
  openCategoryModal(id = '', code = '', nameEn = '', nameFr = '', minTarget = 0) {
    document.getElementById('category-modal-id').value = id;
    document.getElementById('category-modal-code').value = code;
    document.getElementById('category-modal-name-en').value = nameEn;
    document.getElementById('category-modal-name-fr').value = nameFr;
    document.getElementById('category-modal-min-target').value = minTarget;
    document.getElementById('config-category-modal').style.display = 'flex';
  }

  async handleSaveCategory() {
    const id = document.getElementById('category-modal-id').value;
    const code = document.getElementById('category-modal-code').value.trim();
    const name_en = document.getElementById('category-modal-name-en').value.trim();
    const name_fr = document.getElementById('category-modal-name-fr').value.trim();
    const min_target = parseInt(document.getElementById('category-modal-min-target').value.replace(/\D/g, '') || 0, 10);

    try {
      if (id) {
        await window.api.updateCategory(id, { code, name_en, name_fr, min_target });
      } else {
        await window.api.createCategory({ harvest_id: 'hrv-2026', code, name_en, name_fr, min_target });
      }
      this.showToast('Category saved successfully!', 'success');
      document.getElementById('config-category-modal').style.display = 'none';
      this.loadAdminConfigView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleDeleteCategory(id) {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await window.api.deleteCategory(id);
      this.showToast('Category deleted', 'info');
      this.loadAdminConfigView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // Income Sources
  openIncomeSourceModal(id = '', code = '', nameEn = '', nameFr = '') {
    document.getElementById('income-source-modal-id').value = id;
    document.getElementById('income-source-modal-code').value = code;
    document.getElementById('income-source-modal-name-en').value = nameEn;
    document.getElementById('income-source-modal-name-fr').value = nameFr;
    document.getElementById('config-income-source-modal').style.display = 'flex';
  }

  async handleSaveIncomeSource() {
    const id = document.getElementById('income-source-modal-id').value;
    const code = document.getElementById('income-source-modal-code').value.trim();
    const name_en = document.getElementById('income-source-modal-name-en').value.trim();
    const name_fr = document.getElementById('income-source-modal-name-fr').value.trim();

    try {
      if (id) {
        await window.api.updateIncomeSource(id, { code, name_en, name_fr });
      } else {
        await window.api.createIncomeSource({ code, name_en, name_fr });
      }
      this.showToast('Income source saved successfully!', 'success');
      document.getElementById('config-income-source-modal').style.display = 'none';
      this.loadAdminConfigView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleDeactivateIncomeSource(id) {
    if (!confirm('Are you sure you want to deactivate this income source?')) return;
    try {
      await window.api.deleteIncomeSource(id);
      this.showToast('Income source deactivated', 'info');
      this.loadAdminConfigView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // Garden Products
  openGardenProductModal(id = '', code = '', nameEn = '', nameFr = '', price = 0) {
    document.getElementById('garden-product-modal-id').value = id;
    document.getElementById('garden-product-modal-code').value = code;
    document.getElementById('garden-product-modal-name-en').value = nameEn;
    document.getElementById('garden-product-modal-name-fr').value = nameFr;
    document.getElementById('garden-product-modal-price').value = price;
    document.getElementById('config-garden-product-modal').style.display = 'flex';
  }

  async handleSaveGardenProduct() {
    const id = document.getElementById('garden-product-modal-id').value;
    const code = document.getElementById('garden-product-modal-code').value.trim();
    const name_en = document.getElementById('garden-product-modal-name-en').value.trim();
    const name_fr = document.getElementById('garden-product-modal-name-fr').value.trim();
    const unit_price = parseInt(document.getElementById('garden-product-modal-price').value.replace(/\D/g, '') || 0, 10);

    try {
      if (id) {
        await window.api.updateGardenProduct(id, { code, name_en, name_fr, unit_price });
      } else {
        await window.api.createGardenProduct({ harvest_id: 'hrv-2026', code, name_en, name_fr, unit_price });
      }
      this.showToast('Garden product saved successfully!', 'success');
      document.getElementById('config-garden-product-modal').style.display = 'none';
      this.loadAdminConfigView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async handleDeactivateGardenProduct(id) {
    if (!confirm('Are you sure you want to deactivate this garden product?')) return;
    try {
      await window.api.deleteGardenProduct(id);
      this.showToast('Garden product deactivated', 'info');
      this.loadAdminConfigView();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // --- SYSTEM BACKUP & DISASTER RECOVERY ---
  loadBackupView() {
    // Renders static backup view
  }

  async exportSystemSnapshot() {
    try {
      const backupData = await window.api.exportSystemBackup();
      const jsonString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", jsonString);
      downloadAnchor.setAttribute("download", `PC_BASTOS_HARVEST_BACKUP_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      this.showToast('Complete system snapshot exported safely!', 'success');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  async restoreSystemSnapshot() {
    const fileInput = document.getElementById('backup-file-input');
    if (!fileInput.files || fileInput.files.length === 0) {
      this.showToast('Please select a valid JSON backup file', 'error');
      return;
    }

    if (!confirm('WARNING: Restoring will overwrite existing data with the snapshot contents. Are you sure you wish to proceed?')) {
      return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const backupJson = JSON.parse(e.target.result);
        const res = await window.api.restoreSystemBackup(backupJson);
        this.showToast(`System Restored Successfully! Processed ${res.restoredTables.length} tables.`, 'success');
        fileInput.value = '';
      } catch (err) {
        this.showToast(`Restore Failed: ${err.message}`, 'error');
      }
    };

    reader.readAsText(file);
  }

  // --- AUDIT LOGS ---
  async loadAuditView() {
    // Populate user filter dropdown
    try {
      const usersRes = await window.api.listUsers();
      const userSelect = document.getElementById('audit-filter-user');
      if (userSelect) {
        userSelect.innerHTML = '<option value="">All Users</option>' +
          usersRes.users.map(u => `<option value="${u.id}">${u.full_name} (${u.username})</option>`).join('');
      }
    } catch (e) { /* non-admin won't have user list */ }

    this.filterAuditLogs();
  }

  async filterAuditLogs() {
    const params = { limit: 100 };
    const userId = document.getElementById('audit-filter-user')?.value;
    const action = document.getElementById('audit-filter-action')?.value;
    const entityType = document.getElementById('audit-filter-entity')?.value;
    const search = document.getElementById('audit-filter-search')?.value;

    if (userId) params.user_id = userId;
    if (action) params.action = action;
    if (entityType) params.entity_type = entityType;
    if (search) params.search = search;

    try {
      const res = await window.api.getAuditLogs(params);
      const tbody = document.getElementById('audit-logs-tbody');
      tbody.innerHTML = res.logs.map(l => `
        <tr>
          <td><span class="profile-code">${l.action}</span></td>
          <td><strong>${l.user_name || 'System'}</strong></td>
          <td><span class="group-pill">${l.entity_type}</span></td>
          <td>${l.reason || '-'}</td>
          <td><small style="font-family:monospace;">${l.new_values ? l.new_values.substring(0, 45) + '...' : ''}</small></td>
          <td>${l.created_at}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  }

  // --- SYNC WORKER ---
  async triggerManualSync() {
    const syncBtn = document.getElementById('sync-now-btn');
    if (syncBtn) syncBtn.innerHTML = `⏳ ${window.i18n.t('syncing')}`;

    try {
      const outbox = await window.offlineStorage.getPendingOutbox();

      const pushRes = await window.api.syncPush({
        terminalId: window.api.terminalId,
        terminalCode: window.api.terminalCode,
        transactions: outbox.transactions,
        gardenSales: outbox.gardenSales,
        contributors: outbox.contributors
      });

      if (pushRes.processedTxIds) {
        await window.offlineStorage.markOutboxSynced(pushRes.processedTxIds);
      }

      const pullData = await window.api.syncPull();
      await window.offlineStorage.cacheMasterData(pullData);

      await this.refreshOutboxStatus();

      this.showToast(`✓ Sync Complete: ${pushRes.uploadedCount} uploaded, ${pushRes.duplicatesCount} acknowledged, ${pushRes.conflictsCount} conflicts`, 'success');
    } catch (err) {
      this.showToast(`Sync Failed: ${err.message}`, 'error');
    } finally {
      if (syncBtn) syncBtn.innerHTML = `🔄 ${window.i18n.t('syncNow')} ${this.outboxCount > 0 ? `(${this.outboxCount})` : ''}`;
    }
  }

  async triggerAutoSync() {
    if (!this.isOnline) return;
    try {
      const outbox = await window.offlineStorage.getPendingOutbox();
      if (outbox.totalPending > 0) {
        await this.triggerManualSync();
      }
    } catch (e) {
      console.warn('Auto-sync check:', e);
    }
  }

  async refreshOutboxStatus() {
    const outbox = await window.offlineStorage.getPendingOutbox();
    this.outboxCount = outbox.totalPending;
    this.updateOutboxBadge();
  }

  updateOutboxBadge() {
    const syncBtn = document.getElementById('sync-now-btn');
    if (syncBtn) {
      syncBtn.innerHTML = `🔄 ${window.i18n.t('syncNow')} ${this.outboxCount > 0 ? `<span style="background:#dc2626;color:#fff;padding:0.1rem 0.4rem;border-radius:9999px;font-size:0.75rem;">${this.outboxCount}</span>` : ''}`;
    }
  }

  // --- PASSWORD CHANGE FLOW ---
  async handleForcePasswordChange() {
    const currentPass = document.getElementById('force-current-pass').value;
    const newPass = document.getElementById('force-new-pass').value;
    const confirmPass = document.getElementById('force-confirm-pass').value;

    if (newPass !== confirmPass) {
      this.showToast('New passwords do not match', 'error');
      return;
    }

    try {
      await window.api.changePassword(currentPass, newPass);
      this.showToast('Permanent password saved successfully!', 'success');
      document.getElementById('force-password-modal').style.display = 'none';
      if (this.currentUser) this.currentUser.forcePasswordChange = false;
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  }

  // --- DROPDOWN HELPERS ---
  populateSessionDropdown(selectId, includeAll = false) {
    const select = document.getElementById(selectId);
    if (!select || !this.config || !this.config.sessions) return;

    select.innerHTML = (includeAll ? `<option value="">${window.i18n.t('allSessions')}</option>` : '') +
      this.config.sessions.map(s => `
        <option value="${s.id}" ${s.is_default ? 'selected' : ''}>
          ${s.is_default ? '⭐ ' : ''}${window.i18n.getLang() === 'fr' ? s.name_fr : s.name_en} (${s.session_date})
        </option>
      `).join('');
  }

  populatePaymentMethodsDropdown(selectId) {
    const select = document.getElementById(selectId);
    if (!select || !this.config || !this.config.paymentMethods) return;

    select.innerHTML = this.config.paymentMethods.map(pm => `
      <option value="${pm.id}">${window.i18n.getLang() === 'fr' ? pm.name_fr : pm.name_en}</option>
    `).join('');
  }

  populateIncomeSourcesDropdown(selectId) {
    const select = document.getElementById(selectId);
    if (!select || !this.config || !this.config.incomeSources) return;

    select.innerHTML = this.config.incomeSources.map(inc => `
      <option value="${inc.id}">${window.i18n.getLang() === 'fr' ? inc.name_fr : inc.name_en}</option>
    `).join('');
  }

  populateGroupsDropdown(selectId, includeAll = false) {
    const select = document.getElementById(selectId);
    if (!select || !this.config || !this.config.groups) return;

    select.innerHTML = (includeAll ? `<option value="">${window.i18n.t('allGroups')}</option>` : '') +
      this.config.groups.map(g => `
        <option value="${g.id}">${window.i18n.getLang() === 'fr' ? g.name_fr : g.name_en} (${g.code})</option>
      `).join('');
  }

  populateCategoriesDropdown(selectId) {
    const select = document.getElementById(selectId);
    if (!select || !this.config || !this.config.categories) return;

    select.innerHTML = this.config.categories.map(c => `
      <option value="${c.id}">${window.i18n.getLang() === 'fr' ? c.name_fr : c.name_en} (₣${Number(c.min_target).toLocaleString()}+)</option>
    `).join('');
  }

  populateRolesDropdown(selectId) {
    const select = document.getElementById(selectId);
    if (!select || !this.config || !this.config.roles) return;

    select.innerHTML = this.config.roles.map(r => `
      <option value="${r.id}">${window.i18n.getLang() === 'fr' ? r.name_fr : r.name_en} (${r.code})</option>
    `).join('');
  }

  populateGroupsCheckboxes(containerId) {
    const container = document.getElementById(containerId);
    if (!container || !this.config || !this.config.groups) return;

    const cbClass = containerId.includes('edit-user') ? 'edit-user-group-cb' : containerId.includes('user') ? 'new-user-group-cb' : 'new-contrib-group-cb';
    container.innerHTML = this.config.groups.map(g => `
      <label style="display:inline-flex;align-items:center;gap:0.4rem;margin-right:1rem;margin-bottom:0.5rem;font-size:0.85rem;cursor:pointer;">
        <input type="checkbox" class="${cbClass}" value="${g.id}">
        <strong>${g.code}</strong> (${window.i18n.getLang() === 'fr' ? g.name_fr : g.name_en})
      </label>
    `).join('');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 4000);
  }

  openTerminalSettingsModal() {
    document.getElementById('terminal-cfg-code').value = window.api.terminalCode || 'DESK-01';
    document.getElementById('terminal-cfg-url').value = window.api.baseUrl === '/api' ? window.location.origin : window.api.baseUrl;
    document.getElementById('terminal-settings-modal').style.display = 'flex';
  }

  async handleSaveTerminalSettings() {
    const code = document.getElementById('terminal-cfg-code').value.trim();
    const url = document.getElementById('terminal-cfg-url').value.trim();
    const interval = parseInt(document.getElementById('terminal-cfg-interval').value, 10) || 30;

    if (!code) {
      this.showToast('Terminal Hardware Code is required', 'error');
      return;
    }

    const termId = `term-${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    window.api.setTerminal(termId, code);

    if (url && url !== window.location.origin) {
      window.api.baseUrl = url.endsWith('/api') ? url : `${url}/api`;
    }

    this.updateHeaderTerminalCode();
    this.startAutoSyncDaemon(interval);

    this.showToast(`Terminal set to ${code}. Auto-sync configured for every ${interval}s.`, 'success');
    document.getElementById('terminal-settings-modal').style.display = 'none';
  }

  logout() {
    window.api.setToken(null);
    this.currentUser = null;
    this.showLoginView();
  }
}

window.app = new HarvestApp();
document.addEventListener('DOMContentLoaded', () => window.app.init());
