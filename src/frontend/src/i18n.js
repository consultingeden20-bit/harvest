// PC Bastos Harvest Management System
// Complete Bilingual Localization Engine (English / Français)

const translations = {
  en: {
    appTitle: 'PC Bastos Harvest',
    appSubtitle: 'Management System 2026',
    online: 'Online',
    offlineMode: 'Offline Mode',
    syncNow: 'Sync Now',
    syncing: 'Syncing...',
    logout: 'Logout',
    
    // Tabs
    tabDashboard: 'Dashboard',
    tabCollection: 'Collection Desk',
    tabContributors: 'Contributors',
    tabGroupPortal: 'Group Portal',
    tabGarden: 'Garden Sales',
    tabAnonymous: 'Anonymous Gift',
    tabReconciliation: 'Reconciliation',
    tabReports: 'Financial Reports',
    tabAdmin: 'Admin & Users',
    tabAdminConfig: 'Campaign Settings',
    tabAudit: 'Audit Logs',
    tabBackup: 'Backup & Recovery',
    
    // KPIs
    kpiTotalHarvest: 'Total Harvest Income',
    kpiDirectCommitments: 'Direct Commitments',
    kpiGardenSales: 'Garden Sales',
    kpiAnonymous: 'Anonymous Offerings',
    kpiTotalTarget: 'Total Pledged Target',
    kpiOutstanding: 'Outstanding Balance',
    kpiCompletionRate: 'Completion Rate',
    kpiTransactionsCount: 'Total Transactions',
    
    // Collection Desk
    searchContributorPlaceholder: 'Search by Contributor ID, Name, or Phone (Ctrl + K)...',
    selectContributorPrompt: 'Select a contributor from the list or search above',
    noContributorsFound: 'No contributors found matching your search',
    recordPaymentTitle: 'Record Harvest Payment',
    contributorId: 'Contributor ID',
    fullName: 'Full Name',
    groups: 'Group Memberships',
    category: 'Category',
    target: 'Pledged Target',
    paid: 'Total Paid',
    balance: 'Outstanding Balance',
    completion: 'Completion',
    amountFcfa: 'Amount (FCFA)',
    session: 'Harvest Session',
    paymentMethod: 'Payment Method',
    incomeSource: 'Income Source',
    notesRemarks: 'Notes / Remarks (Optional)',
    btnSavePayment: 'SAVE PAYMENT',
    paymentSuccess: 'Payment recorded successfully!',
    btnEditPayment: 'Edit',
    editPaymentTitle: 'Edit / Correct Payment Record',
    editReasonPrompt: 'Reason / Justification for modification (Mandatory)',
    originalAmount: 'Original Amount',
    paymentUpdatedSuccess: 'Payment updated and audit diff trail logged!',
    
    // Duplicate Name Warning
    duplicateFoundTitle: '⚠️ Possible Duplicate Name Detected',
    duplicateNameWarning: 'A contributor with this exact name already exists. One person must only have one persistent identity in PC Bastos. Please verify before registering.',
    btnContinueAnyway: 'Proceed & Create Anyway',
    btnCancelRegistration: 'Cancel & Check Existing',
    
    // Receipt Modal
    receiptTitle: 'Official Collection Receipt',
    receiptPresbyterian: 'PRESBYTERIAN CHURCH IN CAMEROON',
    receiptCongregation: 'PC BASTOS CONGREGATION - YAOUNDE',
    receiptHarvest: 'ANNUAL HARVEST THANKSGIVING',
    receiptNumber: 'Receipt No',
    receiptDate: 'Date & Time',
    receiptContributor: 'Contributor',
    receiptAmountPaid: 'Amount Paid',
    receiptPledged: 'Pledged Target',
    receiptTotalPaidToDate: 'Total Paid to Date',
    receiptRemainingBalance: 'Remaining Balance',
    receiptOperator: 'Collector / Terminal',
    btnPrintReceipt: 'Print Receipt Slip',
    btnClose: 'Close',
    btnNextContributor: 'Next Contributor',
    
    // Anonymous desk
    anonTitle: 'Record Anonymous Altar / Freewill Contribution',
    anonSubtitle: 'Anonymous gifts do not require a member identity, but are fully audited and counted towards church totals.',
    btnSaveAnonymous: 'RECORD ANONYMOUS GIFT',
    
    // Garden Sales desk
    gardenTitle: 'Harvest Garden Sales Desk',
    gardenSubtitle: 'Live tracking of agricultural and livestock sales during Harvest sessions.',
    product: 'Product',
    unitPrice: 'Selling Price (FCFA)',
    quantity: 'Quantity',
    buyerName: 'Buyer Name (Optional)',
    btnRecordSale: 'RECORD GARDEN SALE',
    gardenSalesHistory: 'Recent Garden Sales',
    
    // Reconciliation desk
    reconciliationTitle: 'Session Cash & Financial Verification',
    reconciliationSubtitle: 'Physical money verification and automated ledger discrepancy checking.',
    physicalCash: 'Physical Cash (FCFA)',
    physicalCheque: 'Physical Cheques (FCFA)',
    physicalTransfer: 'Bank Transfers (FCFA)',
    physicalMomo: 'Mobile Money (MTN / Orange)',
    systemTotal: 'System Register Total',
    physicalTotal: 'Physical Count Total',
    discrepancy: 'Discrepancy',
    statusReconciled: 'RECONCILED (Match)',
    statusDiscrepancy: 'DISCREPANCY DETECTED',
    btnPerformReconciliation: 'SUBMIT VERIFICATION & SIGN OFF',
    reconciliationHistory: 'Reconciliation Audit Records',
    collectorDeskVerifications: 'Desk Collector Verifications (Two-Party Sign-Off)',
    btnVerifyCollector: 'Approve Collector',
    btnAdminApproveSession: 'Admin Final Sign-Off',
    
    // Reports desk
    reportsTitle: 'Financial Reports & Analytics Suite',
    churchVsGroupNote: 'Note: Church Total counts each transaction exactly once. Group analytical totals reflect the contributions of their respective members (multi-group members appear across each of their constituent groups).',
    filterBySession: 'Filter by Session',
    filterByGroup: 'Filter by Group',
    btnExportTransactionsCSV: 'Export Transactions (CSV)',
    btnExportContributorsCSV: 'Export Contributors (CSV)',
    btnDownloadCSVTemplate: '📥 Download CSV Entry Template',
    btnUploadCSVFile: '📤 Upload & Import CSV File',
    allSessions: 'All Sessions',
    allGroups: 'All Groups',
    
    // Group portal
    groupPortalTitle: 'Group Financial Authority Portal',
    groupPortalSubtitle: 'Scoped financial tracking and member ledger for your authorized group(s).',
    myGroupMembers: 'Group Members & Targets',
    
    // Admin desk
    userManagementTitle: 'User & Security Management',
    btnCreateUser: 'Create New User',
    username: 'Username',
    role: 'Role',
    assignedGroups: 'Assigned Group Scopes',
    tempPassword: 'Temporary Password',
    forcePasswordChangeNotice: 'New users will be forced to change this temporary password upon initial login.',
    btnResetPassword: 'Reset Password',
    activeStatus: 'Active',
    
    // Campaign Settings
    manageGroups: 'Church Groups Management',
    manageSessions: 'Harvest Sessions & Dates',
    manageCategories: 'Pledge Categories & Amounts',
    manageIncomeSources: 'Income Sources',
    manageGardenProducts: 'Garden Products Catalog',
    seasonTarget: 'Season Global Target Pledge',
    
    // Audit logs
    auditLogsTitle: 'Immutable System Audit Trail',
    auditSubtitle: 'Comprehensive logging of all transactions, reversals, logins, and administrative modifications.',
    action: 'Action',
    actor: 'Actor',
    timestamp: 'Timestamp',
    details: 'Details / Reason',
    
    // Backup & Recovery
    backupTitle: 'System Backup & Disaster Recovery',
    backupSubtitle: 'Export complete database snapshot or import backup in case of hardware or power failures.',
    btnExportSystemBackup: '📦 Export Complete System Snapshot (JSON)',
    btnRestoreSystemBackup: '📥 Restore Snapshot from File',
    
    // Password Change Modal
    changePasswordTitle: 'Set New Secure Password',
    changePasswordPrompt: 'You are using a temporary password. You must set a new permanent password to continue.',
    currentPassword: 'Current Password',
    newPassword: 'New Password (min 6 characters)',
    confirmPassword: 'Confirm New Password',
    btnUpdatePassword: 'Save Permanent Password',
    
    // Common
    loading: 'Loading data...',
    save: 'Save',
    cancel: 'Cancel',
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    fcfa: 'FCFA'
  },
  
  fr: {
    appTitle: 'PC Bastos Moisson',
    appSubtitle: 'Système de Gestion 2026',
    online: 'En Ligne',
    offlineMode: 'Mode Hors-Ligne',
    syncNow: 'Synchroniser',
    syncing: 'Synchronisation...',
    logout: 'Déconnexion',
    
    // Tabs
    tabDashboard: 'Tableau de Bord',
    tabCollection: 'Guichet Collecte',
    tabContributors: 'Souscripteurs',
    tabGroupPortal: 'Portail Groupes',
    tabGarden: 'Vente du Jardin',
    tabAnonymous: 'Dons Anonymes',
    tabReconciliation: 'Rapprochement',
    tabReports: 'Rapports Financiers',
    tabAdmin: 'Admin & Utilisateurs',
    tabAdminConfig: 'Configuration Campagne',
    tabAudit: 'Pistes d’Audit',
    tabBackup: 'Sauvegarde & Secours',
    
    // KPIs
    kpiTotalHarvest: 'Recettes Totales Moisson',
    kpiDirectCommitments: 'Souscriptions Directes',
    kpiGardenSales: 'Ventes du Jardin',
    kpiAnonymous: 'Offrandes Anonymes',
    kpiTotalTarget: 'Objectif Total Souscrit',
    kpiOutstanding: 'Reste à Recouvrer',
    kpiCompletionRate: 'Taux de Réalisation',
    kpiTransactionsCount: 'Nombre de Transactions',
    
    // Collection Desk
    searchContributorPlaceholder: 'Rechercher par ID, Nom ou Téléphone (Ctrl + K)...',
    selectContributorPrompt: 'Sélectionnez un souscripteur dans la liste ou recherchez ci-dessus',
    noContributorsFound: 'Aucun souscripteur trouvé pour cette recherche',
    recordPaymentTitle: 'Enregistrer un Versement de Moisson',
    contributorId: 'ID Souscripteur',
    fullName: 'Nom Complet',
    groups: 'Groupes d’Appartenance',
    category: 'Catégorie',
    target: 'Engagement Souscrit',
    paid: 'Total Versé',
    balance: 'Reste à Payer',
    completion: 'Progression',
    amountFcfa: 'Montant (FCFA)',
    session: 'Session de Moisson',
    paymentMethod: 'Mode de Paiement',
    incomeSource: 'Source de Recette',
    notesRemarks: 'Remarques / Notes (Facultatif)',
    btnSavePayment: 'ENREGISTRER LE VERSEMENT',
    paymentSuccess: 'Versement enregistré avec succès !',
    btnEditPayment: 'Modifier',
    editPaymentTitle: 'Modifier / Corriger un Versement',
    editReasonPrompt: 'Motif / Justification de la modification (Obligatoire)',
    originalAmount: 'Montant Initial',
    paymentUpdatedSuccess: 'Versement corrigé et piste d’audit enregistrée !',
    
    // Duplicate Name Warning
    duplicateFoundTitle: '⚠️ Doublon Potentiel Détecté',
    duplicateNameWarning: 'Un souscripteur portant exactement ce nom existe déjà. Une personne ne doit posséder qu’une seule identité persistante à PC Bastos.',
    btnContinueAnyway: 'Continuer et Créer quand même',
    btnCancelRegistration: 'Annuler et Vérifier l’existant',
    
    // Receipt Modal
    receiptTitle: 'Reçu Officiel de Versement',
    receiptPresbyterian: 'PRESBYTERIAN CHURCH IN CAMEROON',
    receiptCongregation: 'PAROISSE DE PC BASTOS - YAOUNDE',
    receiptHarvest: 'ACTION DE GRÂCE ANNUELLE DE MOISSON',
    receiptNumber: 'Reçu N°',
    receiptDate: 'Date et Heure',
    receiptContributor: 'Souscripteur',
    receiptAmountPaid: 'Montant Versé',
    receiptPledged: 'Engagement Souscrit',
    receiptTotalPaidToDate: 'Cumul Versé à ce Jour',
    receiptRemainingBalance: 'Reste à Payer',
    receiptOperator: 'Collecteur / Terminal',
    btnPrintReceipt: 'Imprimer le Reçu',
    btnClose: 'Fermer',
    btnNextContributor: 'Souscripteur Suivant',
    
    // Anonymous desk
    anonTitle: 'Enregistrement de Don Anonyme / Offrande Libre',
    anonSubtitle: 'Les dons anonymes ne nécessitent pas d’identité membre mais sont audités et comptabilisés dans les totaux de l’église.',
    btnSaveAnonymous: 'ENREGISTRER LE DON ANONYME',
    
    // Garden Sales desk
    gardenTitle: 'Guichet Vente du Jardin de Moisson',
    gardenSubtitle: 'Suivi des ventes de produits agricoles et bétail durant les sessions de Moisson.',
    product: 'Produit',
    unitPrice: 'Prix de Vente (FCFA)',
    quantity: 'Quantité',
    buyerName: 'Nom de l’Acheteur (Facultatif)',
    btnRecordSale: 'ENREGISTRER LA VENTE',
    gardenSalesHistory: 'Ventes Récentes du Jardin',
    
    // Reconciliation desk
    reconciliationTitle: 'Vérification et Rapprochement de Caisse',
    reconciliationSubtitle: 'Contrôle physique des espèces et vérification automatisée des écarts de caisse.',
    physicalCash: 'Espèces Physiques (FCFA)',
    physicalCheque: 'Chèques Physiques (FCFA)',
    physicalTransfer: 'Virements Bancaires (FCFA)',
    physicalMomo: 'Mobile Money (MTN / Orange)',
    systemTotal: 'Total Registre Système',
    physicalTotal: 'Total Comptage Physique',
    discrepancy: 'Écart de Caisse',
    statusReconciled: 'RAPPROCHÉ (Conforme)',
    statusDiscrepancy: 'ÉCART CONSTATÉ',
    btnPerformReconciliation: 'VALIDER LE RAPPROCHEMENT',
    reconciliationHistory: 'Historique des Rapprochements',
    collectorDeskVerifications: 'Vérification par Guichet Collecteur (Double Validation)',
    btnVerifyCollector: 'Valider le Collecteur',
    btnAdminApproveSession: 'Approbation Finale Admin',
    
    // Reports desk
    reportsTitle: 'Rapports Financiers & Statistiques',
    churchVsGroupNote: 'Note : Le Total Paroissial comptabilise chaque versement une seule fois. Les totaux analytiques des groupes reflètent les versements de leurs membres respectifs.',
    filterBySession: 'Filtrer par Session',
    filterByGroup: 'Filtrer par Groupe',
    btnExportTransactionsCSV: 'Exporter Versements (CSV)',
    btnExportContributorsCSV: 'Exporter Souscripteurs (CSV)',
    btnDownloadCSVTemplate: '📥 Télécharger Modèle CSV',
    btnUploadCSVFile: '📤 Importer Fichier CSV',
    allSessions: 'Toutes les Sessions',
    allGroups: 'Tous les Groupes',
    
    // Group portal
    groupPortalTitle: 'Portail Financier de Groupe',
    groupPortalSubtitle: 'Suivi financier restreint et liste des membres pour votre groupe assigné.',
    myGroupMembers: 'Membres du Groupe et Engagements',
    
    // Admin desk
    userManagementTitle: 'Gestion des Utilisateurs & Sécurité',
    btnCreateUser: 'Créer un Utilisateur',
    username: 'Identifiant',
    role: 'Rôle',
    assignedGroups: 'Groupes Assignés',
    tempPassword: 'Mot de Passe Provisoire',
    forcePasswordChangeNotice: 'Les nouveaux utilisateurs devront obligatoirement changer ce mot de passe à la première connexion.',
    btnResetPassword: 'Réinitialiser Mot de Passe',
    activeStatus: 'Actif',
    
    // Campaign Settings
    manageGroups: 'Gestion des Groupes d’Église',
    manageSessions: 'Sessions et Dates de Moisson',
    manageCategories: 'Catégories et Montants Minima',
    manageIncomeSources: 'Sources de Recettes',
    manageGardenProducts: 'Catalogue Produits du Jardin',
    seasonTarget: 'Objectif Global de la Campagne',
    
    // Audit logs
    auditLogsTitle: 'Piste d’Audit Système Immuable',
    auditSubtitle: 'Journal complet des versements, annulations, connexions et modifications administratives.',
    action: 'Action',
    actor: 'Auteur',
    timestamp: 'Horodatage',
    details: 'Détails / Motif',
    
    // Backup & Recovery
    backupTitle: 'Sauvegarde Système & Plan de Secours',
    backupSubtitle: 'Exportation d’instantané complet ou restauration en cas de panne de courant ou matérielle.',
    btnExportSystemBackup: '📦 Exporter Instantané Complet (JSON)',
    btnRestoreSystemBackup: '📥 Restaurer depuis un Fichier',
    
    // Password Change Modal
    changePasswordTitle: 'Définir un Nouveau Mot de Passe',
    changePasswordPrompt: 'Vous utilisez un mot de passe temporaire. Vous devez obligatoirement créer un mot de passe permanent pour continuer.',
    currentPassword: 'Mot de Passe Actuel',
    newPassword: 'Nouveau Mot de Passe (min 6 car.)',
    confirmPassword: 'Confirmer le Mot de Passe',
    btnUpdatePassword: 'Enregistrer le Mot de Passe',
    
    // Common
    loading: 'Chargement des données...',
    save: 'Enregistrer',
    cancel: 'Annuler',
    success: 'Succès',
    error: 'Erreur',
    warning: 'Avertissement',
    fcfa: 'FCFA'
  }
};

class I18nManager {
  constructor() {
    this.currentLang = localStorage.getItem('harvest_lang') || 'en';
  }

  getLang() {
    return this.currentLang;
  }

  setLang(lang) {
    if (translations[lang]) {
      this.currentLang = lang;
      localStorage.setItem('harvest_lang', lang);
      document.documentElement.lang = lang;
      this.applyTranslations();
      return true;
    }
    return false;
  }

  toggleLang() {
    const nextLang = this.currentLang === 'en' ? 'fr' : 'en';
    this.setLang(nextLang);
    return nextLang;
  }

  t(key) {
    const dict = translations[this.currentLang] || translations.en;
    return dict[key] || translations.en[key] || key;
  }

  applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = this.t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = this.t(key);
    });

    const langToggleBtn = document.getElementById('lang-toggle-btn');
    if (langToggleBtn) {
      langToggleBtn.textContent = this.currentLang === 'en' ? '🇫🇷 Français' : '🇬🇧 English';
    }
  }
}

window.i18n = new I18nManager();
