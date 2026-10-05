# PC BASTOS HARVEST MANAGEMENT SYSTEM
## User & Collector Guide (Guide de l'Utilisateur et du Collecteur)

Welcome to the **PC Bastos Harvest Management System**. This guide provides step-by-step instructions for desk collectors, group financial authorities, and verification personnel.

---

### 1. Language Switcher (Choix de la Langue)
The application fully supports **English** and **Français**.
- Click the language button in the top right header (`🇬🇧 English` / `🇫🇷 Français`) at any time.
- Your language preference is automatically saved on your computer.

---

### 2. Fast Collection Workflow (Guichet de Collecte Rapide)

Designed for ultra-fast operation during Harvest Sundays:

```
[Search Contributor (Ctrl+K)] 
          ⬇
[View Target, Paid & Outstanding Balance] 
          ⬇
[Enter Amount, Session & Payment Method] 
          ⬇
[Click SAVE PAYMENT or Press Enter] 
          ⬇
[Print Official Receipt Slip] 
          ⬇
[Click Next Contributor or Press Enter]
```

#### Step-by-Step Collection:
1. **Search Contributor**:
   - Type the contributor's Name, ID (e.g., `H26-004582`), or Phone number.
   - Shortcut: Press `Ctrl + K` anywhere to jump to the search box.
2. **Review Profile**:
   - Verify group badges (e.g., `CMF`, `CYF`, `Session`).
   - Review the Pledged Target (e.g., `₣3,000,000`), Total Paid to date, and Outstanding Balance.
3. **Record Payment**:
   - Enter the payment amount in FCFA (e.g., `500,000`).
   - Select the active **Harvest Session** (Launch Sunday, Session 1, Session 2, Main Harvest, Thanksgiving).
   - Select the **Payment Method** (Cash, MTN Mobile Money, Orange Money, Cheque, Bank Transfer).
   - Select the **Income Source** (Harvest Commitment, Special Levy, Freewill Offering).
4. **Confirm & Print Receipt**:
   - Click **SAVE PAYMENT** (or press Enter).
   - The system displays the official Presbyterian Church in Cameroon collection receipt.
   - Click **Print Receipt Slip** to send to any receipt or desktop printer.
   - Click **Next Contributor** to immediately return to search for the next person.

---

### 3. Offline Mode & Synchronization (Mode Hors-Ligne)

When internet or local LAN drops:
1. The status badge automatically turns amber: `🟠 Offline Mode`.
2. You can continue searching cached contributors and recording payments without interruption.
3. Transactions are safely stored locally in your browser's **IndexedDB** storage.
4. When connectivity returns:
   - Status badge turns green: `🟢 Online`.
   - Click the **🔄 Sync Now** button in the header.
   - The system synchronizes all queued offline transactions with the central server with zero duplicate risk.

---

### 4. Group Financial Authority Portal (Portail Financier de Groupe)
For Group Financial Secretaries (CMF, CYF, CCI, etc.):
- Sign in with your assigned group account (e.g., `cmf_fin_sec`).
- The portal automatically restricts your view to members of your authorized group.
- View Group Targets, Group Collected amount, and completion percentages.
- Export your group's ledger to CSV for executive reporting.

---

### 5. Garden Sales Desk (Vente du Jardin de Moisson)
1. Go to the **Garden Sales** tab.
2. Select the product (e.g., Plantain Bunch, Farm Rooster, Live Goat, Honey, Palm Oil).
3. Enter Quantity and Buyer Name.
4. Select Session and Payment Method.
5. Click **Record Garden Sale**.

---

### 6. Anonymous Altar Contributions (Dons Anonymes)
1. Go to the **Anonymous Gift** tab.
2. Enter the envelope amount in FCFA.
3. Select Session and Payment Method.
4. Click **Record Anonymous Gift**.
5. The transaction counts toward the Church Total while keeping donor identity private.

---

### 7. Cash Verification & Reconciliation (Rapprochement de Caisse)
1. At the end of each session, the Verification team counts physical money.
2. Go to the **Reconciliation** tab.
3. Select the Harvest Session.
4. The system automatically displays the register total (Cash, Cheques, Mobile Money, Transfers).
5. Enter the physical counted amounts.
6. The system calculates the discrepancy:
   - `₣0` = **RECONCILED** (Conforme).
   - Non-zero = **DISCREPANCY DETECTED** (Audited and flagged).
7. Enter remarks and click **Submit Verification & Sign Off**.
