const crypto = require('crypto');
const { query, get, run } = require('../db');
const { logAudit } = require('./audit');

function uuid() {
  return crypto.randomUUID();
}

async function listProducts(harvestId = 'hrv-2026') {
  return await query(
    `SELECT * FROM garden_products WHERE harvest_id = ? AND is_active = 1 ORDER BY name_en ASC`,
    [harvestId]
  );
}

async function recordSale(payload, user, terminalId = null) {
  const harvestId = payload.harvest_id || payload.harvestId || 'hrv-2026';
  const sessionId = payload.session_id || payload.sessionId;
  const productId = payload.product_id || payload.productId || null;
  const productName = payload.product_name || payload.productName || 'Garden Product';
  const quantity = payload.quantity !== undefined ? payload.quantity : 1;
  const unitPrice = payload.unit_price !== undefined ? payload.unit_price : payload.unitPrice;
  const paymentMethodId = payload.payment_method_id || payload.paymentMethodId || 'pm-cash';
  const buyerName = payload.buyer_name || payload.buyerName || null;
  const clientSaleId = payload.client_sale_id || payload.clientSaleId || null;
  const notes = payload.notes || null;

  const qty = parseInt(quantity, 10);
  const price = parseInt(unitPrice, 10);
  if (isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
    throw new Error('Quantity and Unit Price must be positive integers');
  }

  const totalAmount = qty * price;
  const id = uuid();
  const operatorId = user ? (user.id || user.userId || 'usr-admin') : 'usr-admin';

  // Check idempotency for offline sync
  if (clientSaleId) {
    const existing = await get(`SELECT * FROM garden_sales WHERE client_sale_id = ?`, [clientSaleId]);
    if (existing) {
      return { sale: existing, isDuplicate: true };
    }
  }

  await run(
    `INSERT INTO garden_sales (
      id, harvest_id, session_id, product_id, product_name, quantity,
      unit_price, total_amount, payment_method_id, operator_id, terminal_id,
      buyer_name, client_sale_id, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      id, harvestId, sessionId, productId, productName, qty,
      price, totalAmount, paymentMethodId, operatorId,
      terminalId, buyerName, clientSaleId || uuid(), notes
    ]
  );

  await logAudit({
    userId: operatorId,
    userName: user ? (user.fullName || user.username || 'System') : 'System',
    terminalId,
    action: 'GARDEN_SALE_RECORDED',
    entityType: 'garden_sales',
    recordId: id,
    newValues: { productName, quantity: qty, unitPrice: price, totalAmount, buyerName },
    reason: `Garden sale of ${productName} (x${qty}) for ${totalAmount} FCFA`
  });

  const sale = await get(`SELECT * FROM garden_sales WHERE id = ?`, [id]);
  return { sale, isDuplicate: false };
}

async function listSales({ harvestId = 'hrv-2026', sessionId = null, limit = 50, offset = 0 }) {
  let sql = `
    SELECT 
      gs.*,
      hs.name_en as session_name_en, hs.name_fr as session_name_fr,
      pm.name_en as payment_method_en, pm.name_fr as payment_method_fr,
      u.full_name as operator_name
    FROM garden_sales gs
    JOIN harvest_sessions hs ON gs.session_id = hs.id
    JOIN payment_methods pm ON gs.payment_method_id = pm.id
    LEFT JOIN users u ON gs.operator_id = u.id
    WHERE gs.harvest_id = ?
  `;
  const params = [harvestId];

  if (sessionId) {
    sql += ` AND gs.session_id = ?`;
    params.push(sessionId);
  }

  sql += ` ORDER BY gs.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const sales = await query(sql, params);
  const totalRow = await get(
    `SELECT COUNT(*) as total_count, COALESCE(SUM(total_amount), 0) as total_revenue FROM garden_sales WHERE harvest_id = ? ${sessionId ? 'AND session_id = ?' : ''}`,
    sessionId ? [harvestId, sessionId] : [harvestId]
  );

  return {
    sales,
    totalCount: totalRow ? totalRow.total_count : 0,
    totalRevenue: totalRow ? totalRow.total_revenue : 0
  };
}

module.exports = {
  listProducts,
  recordSale,
  listSales
};
