// PC Bastos Harvest Management System
// API Client with JWT Auth, Offline Detection, Terminal ID, and Failover

class ApiClient {
  constructor() {
    this.baseUrl = '/api';
    this.token = localStorage.getItem('harvest_jwt_token');
    this.terminalId = localStorage.getItem('harvest_terminal_id') || 'term-central-1';
    this.terminalCode = localStorage.getItem('harvest_terminal_code') || 'TERM-CENTRAL-01';

    // Auto-detect desktop environment
    if (window.electronAPI) {
      window.electronAPI.getTerminalConfig().then((cfg) => {
        if (cfg) {
          if (cfg.terminalId) this.terminalId = cfg.terminalId;
          if (cfg.terminalCode) this.terminalCode = cfg.terminalCode;
          localStorage.setItem('harvest_terminal_id', this.terminalId);
          localStorage.setItem('harvest_terminal_code', this.terminalCode);
        }
      }).catch(e => console.warn('Could not read desktop config:', e));

      // Handle electron sync triggers
      window.electronAPI.onSyncTrigger(() => {
        if (window.app && typeof window.app.triggerManualSync === 'function') {
          window.app.triggerManualSync();
        }
      });
    }
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('harvest_jwt_token', token);
    } else {
      localStorage.removeItem('harvest_jwt_token');
    }
  }

  setTerminal(terminalId, terminalCode) {
    this.terminalId = terminalId;
    this.terminalCode = terminalCode;
    localStorage.setItem('harvest_terminal_id', terminalId);
    localStorage.setItem('harvest_terminal_code', terminalCode);
    if (window.electronAPI) {
      window.electronAPI.saveTerminalConfig({ terminalId, terminalCode });
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'X-Terminal-ID': this.terminalId,
      'X-Terminal-Code': this.terminalCode
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {})
      }
    };

    try {
      const res = await fetch(url, config);
      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        if (endpoint.includes('/login') || endpoint.includes('auth/login')) {
          throw new Error(data.error || 'Invalid username or password');
        }
        this.setToken(null);
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        throw new Error('Session expired. Please log in.');
      }

      if (res.status === 403) {
        throw new Error(data.error || 'Access restricted for this user role');
      }

      if (!res.ok) {
        throw new Error(data.error || 'Server request failed');
      }

      return data;
    } catch (err) {
      if (!navigator.onLine || err.message.includes('Failed to fetch')) {
        window.dispatchEvent(new CustomEvent('network:offline'));
      }
      throw err;
    }
  }

  // Auth endpoints
  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, terminalId: this.terminalId })
    });
    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  }

  async changePassword(currentPassword, newPassword) {
    return await this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword, terminalId: this.terminalId })
    });
  }

  async getMe() {
    return await this.request('/auth/me');
  }

  // Harvest Master Config & Settings
  async getHarvestConfig(harvestId = 'hrv-2026') {
    return await this.request(`/harvest/config?harvest_id=${harvestId}`);
  }

  async updateSeasonTarget(targetAmount, harvestId = 'hrv-2026') {
    return await this.request('/harvest/target', {
      method: 'PUT',
      body: JSON.stringify({ harvest_id: harvestId, target_amount: targetAmount })
    });
  }

  // Groups CRUD
  async createGroup(data) {
    return await this.request('/harvest/groups', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateGroup(id, data) {
    return await this.request(`/harvest/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteGroup(id) {
    return await this.request(`/harvest/groups/${id}`, {
      method: 'DELETE'
    });
  }

  // Sessions CRUD
  async createSession(data) {
    return await this.request('/harvest/sessions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateSession(id, data) {
    return await this.request(`/harvest/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async setDefaultSession(id) {
    return await this.request(`/harvest/sessions/${id}/set-default`, {
      method: 'PUT'
    });
  }

  async deleteSession(id) {
    return await this.request(`/harvest/sessions/${id}`, {
      method: 'DELETE'
    });
  }

  // Categories CRUD
  async createCategory(data) {
    return await this.request('/harvest/categories', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateCategory(id, data) {
    return await this.request(`/harvest/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteCategory(id) {
    return await this.request(`/harvest/categories/${id}`, {
      method: 'DELETE'
    });
  }

  // Income Sources CRUD
  async createIncomeSource(data) {
    return await this.request('/harvest/income-sources', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateIncomeSource(id, data) {
    return await this.request(`/harvest/income-sources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteIncomeSource(id) {
    return await this.request(`/harvest/income-sources/${id}`, {
      method: 'DELETE'
    });
  }

  // Contributors
  async listContributors(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/contributors?${query}`);
  }

  async getContributor(id) {
    return await this.request(`/contributors/${id}`);
  }

  async createContributor(data) {
    return await this.request('/contributors', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async checkDuplicateContributor(name, excludeId = null) {
    const query = new URLSearchParams({ name, ...(excludeId ? { exclude_id: excludeId } : {}) }).toString();
    return await this.request(`/contributors/check-duplicate?${query}`);
  }

  // Transactions
  async recordPayment(data) {
    return await this.request('/transactions', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async editPayment(id, data) {
    return await this.request(`/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async listTransactions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/transactions?${query}`);
  }

  async getReceipt(txId) {
    return await this.request(`/transactions/${txId}/receipt`);
  }

  async reversePayment(txId, reason) {
    return await this.request(`/transactions/${txId}/reverse`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  // Garden Products & Sales
  async listGardenProducts(harvestId = 'hrv-2026') {
    return await this.request(`/garden/products?harvest_id=${harvestId}`);
  }

  async createGardenProduct(data) {
    return await this.request('/garden/products', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateGardenProduct(id, data) {
    return await this.request(`/garden/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteGardenProduct(id) {
    return await this.request(`/garden/products/${id}`, {
      method: 'DELETE'
    });
  }

  async recordGardenSale(data) {
    return await this.request('/garden/sales', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async listGardenSales(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/garden/sales?${query}`);
  }

  // Cash Reconciliation & Two-Party Verification
  async getSystemTotals(sessionId, harvestId = 'hrv-2026') {
    return await this.request(`/reconciliation/system-totals?session_id=${sessionId}&harvest_id=${harvestId}`);
  }

  async getCollectorsSummary(sessionId, harvestId = 'hrv-2026') {
    return await this.request(`/reconciliation/collectors-summary?session_id=${sessionId}&harvest_id=${harvestId}`);
  }

  async verifyCollectorDesk(data) {
    return await this.request('/reconciliation/verify-collector', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async recordReconciliation(data) {
    return await this.request('/reconciliation', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async adminApproveSession(reconId, notes = '') {
    return await this.request(`/reconciliation/${reconId}/admin-approve`, {
      method: 'POST',
      body: JSON.stringify({ notes })
    });
  }

  async listReconciliations(harvestId = 'hrv-2026') {
    return await this.request(`/reconciliation/history?harvest_id=${harvestId}`);
  }

  // Reports & Analytics
  async getChurchSummary(harvestId = 'hrv-2026') {
    return await this.request(`/reports/church-summary?harvest_id=${harvestId}`);
  }

  async getGroupAnalytics(harvestId = 'hrv-2026') {
    return await this.request(`/reports/group-analytics?harvest_id=${harvestId}`);
  }

  // Users & Admin
  async listUsers() {
    return await this.request('/users');
  }

  async createUser(data) {
    return await this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async resetUserPassword(userId, tempPassword) {
    return await this.request(`/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ temp_password: tempPassword })
    });
  }

  async updateUser(userId, data) {
    return await this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteUser(userId) {
    return await this.request(`/users/${userId}`, {
      method: 'DELETE'
    });
  }

  async toggleUserStatus(userId, isActive) {
    return await this.request(`/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive })
    });
  }

  async getAuditLogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await this.request(`/audit?${query}`);
  }

  // Sync & CSV Backup Upload
  async syncPush(payload) {
    return await this.request('/sync/push', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async syncPull(harvestId = 'hrv-2026') {
    return await this.request(`/sync/pull?harvest_id=${harvestId}`);
  }

  async uploadCSVPayments(csvData, sessionId, harvestId = 'hrv-2026') {
    return await this.request('/sync/csv-upload', {
      method: 'POST',
      body: JSON.stringify({ csvData: csvData, session_id: sessionId, harvest_id: harvestId })
    });
  }

  // Complete System Backup & Restore
  async exportSystemBackup() {
    return await this.request('/backup/export');
  }

  async restoreSystemBackup(backupData) {
    return await this.request('/backup/restore', {
      method: 'POST',
      body: JSON.stringify(backupData)
    });
  }
}

window.api = new ApiClient();
