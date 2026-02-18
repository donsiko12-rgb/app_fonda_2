// ========================================
// FONDA APP - PURE LOCALSTORAGE VERSION
// No database, no external dependencies
// ========================================

// State Variables
let tables = [];
let activeOrders = [];
let salesLog = [];
let currentOrderId = null;
let currentOrderType = 'table';
let currentCategory = DATA.categories[0];

// DOM Elements
const tablesGrid = document.getElementById('tables-grid');
const activeOrdersList = document.getElementById('active-orders-list');
const orderModal = document.getElementById('order-modal');
const modalTitle = document.getElementById('modal-title');
const closeModalBtn = document.getElementById('close-modal-btn');
const orderList = document.getElementById('order-list');
const orderTotalEl = document.getElementById('order-total');
const sendOrderBtn = document.getElementById('send-order-btn');
const categoryTabs = document.getElementById('category-tabs');
const productsGrid = document.getElementById('products-grid');
const orderNotes = document.getElementById('order-notes');
const checkoutModal = document.getElementById('checkout-modal');
const closeCheckoutBtn = document.getElementById('close-checkout-btn');
const checkoutTableTitle = document.getElementById('checkout-table-id');
const checkoutTotalEl = document.getElementById('checkout-total-amount');
const customerModal = document.getElementById('customer-modal');
const closeCustomerBtn = document.getElementById('close-customer-btn');
const customerForm = document.getElementById('customer-form');
const reportModal = document.getElementById('report-modal');
const closeReportBtn = document.getElementById('close-report-btn');
const reportBody = document.getElementById('report-body');
const resetDayBtn = document.getElementById('reset-day-btn');
const printArea = document.getElementById('print-area');

// ========================================
// INITIALIZATION
// ========================================

function init() {
    fetchTables();
    fetchActiveOrders();
    fetchSalesLog();
    renderCategories();
    renderProducts(currentCategory);
    setupEventListeners();
    setupRealtimeSubscriptions();
}

async function fetchTables() {
    const { data, error } = await db.from('tables').select('*').order('id');
    if (error) { console.error('Error fetching tables:', error); return; }
    tables = data.map(t => ({ id: t.id, status: t.status, order: t.order_json || [], notes: t.notes || '' }));
    renderTables();
}

async function fetchActiveOrders() {
    const { data, error } = await db.from('active_orders').select('*').order('timestamp', { ascending: false });
    if (error) { console.error('Error fetching orders:', error); return; }
    activeOrders = data.map(o => ({ id: o.id, type: o.type, status: o.status, delivery_status: o.delivery_status || 'pending', customer: o.customer_json || {}, order: o.order_json || [], notes: o.notes || '', timestamp: o.timestamp }));
    renderActiveOrders();
}

async function fetchSalesLog() {
    const { data, error } = await db.from('sales_log').select('*').order('id', { ascending: false });
    if (error) { console.error('Error fetching sales:', error); return; }
    salesLog = data.map(s => ({ id: s.id, ref_id: s.ref_id, type: s.type, total: parseFloat(s.total), method: s.method, items: s.items_json || [], date: s.date }));
}

async function saveTable(tableData) {
    const { error } = await db.from('tables').update({ status: tableData.status, order_json: tableData.order, notes: tableData.notes }).eq('id', tableData.id);
    if (error) console.error('Error saving table:', error);
}

async function saveActiveOrder(orderData) {
    const { error } = await db.from('active_orders').upsert({ id: orderData.id, type: orderData.type, status: orderData.status, customer_json: orderData.customer, order_json: orderData.order, notes: orderData.notes, timestamp: orderData.timestamp });
    if (error) console.error('Error saving order:', error);
}

async function deleteActiveOrder(orderId) {
    const { error } = await db.from('active_orders').delete().eq('id', orderId);
    if (error) console.error('Error deleting order:', error);
}

async function saveSale(saleData) {
    const { error } = await db.from('sales_log').insert({ id: saleData.id, ref_id: saleData.ref_id, type: saleData.type, total: saleData.total, method: saleData.method, items_json: saleData.items, date: saleData.date });
    if (error) console.error('Error saving sale:', error);
}

function setupRealtimeSubscriptions() {
    db.channel('tables-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => fetchTables())
        .subscribe();
    db.channel('orders-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'active_orders' }, () => fetchActiveOrders())
        .subscribe();
    console.log('✅ Real-time subscriptions active');
}

function setupEventListeners() {
    closeModalBtn.onclick = closeOrderModal;
    closeCheckoutBtn.onclick = () => {
        checkoutModal.classList.remove('active');
        setTimeout(() => checkoutModal.classList.add('hidden'), 300);
    };
    sendOrderBtn.onclick = sendOrder;
    closeCustomerBtn.onclick = () => {
        customerModal.classList.remove('active');
        setTimeout(() => customerModal.classList.add('hidden'), 300);
    };
    closeReportBtn.onclick = () => {
        reportModal.classList.remove('active');
        setTimeout(() => reportModal.classList.add('hidden'), 300);
    };
    resetDayBtn.onclick = () => {
        if (confirm('¿Seguro que quieres cerrar el día?')) {
            salesLog = [];
            openReport();
        }
    };
}

// ========================================
// RENDER FUNCTIONS
// ========================================

function renderTables() {
    tablesGrid.innerHTML = '';
    tables.forEach(table => {
        const card = document.createElement('div');
        card.className = `table-card ${table.status}`;
        card.onclick = () => openTable(table.id);

        const itemCount = table.order.reduce((sum, item) => sum + item.qty, 0);
        const total = table.order.reduce((sum, item) => sum + (item.price * item.qty), 0);

        let actionBtn = '';
        if (table.status === 'busy') {
            actionBtn = `<button class="btn btn-secondary" style="margin-top:0.5rem" onclick="event.stopPropagation(); openCheckout(${table.id}, 'table')">💰 Cobrar</button>`;
        }

        card.innerHTML = `
            <h2>Mesa ${table.id}</h2>
            <div class="table-status">
                ${table.status === 'available' ? 'Disponible' : 'Ocupada'}
            </div>
            ${itemCount > 0 ? `<p style="margin-top:0.5rem; font-weight:bold; color:var(--text-secondary)">$${total.toFixed(2)} (${itemCount})</p>` : ''}
            ${actionBtn}
        `;
        tablesGrid.appendChild(card);
    });
}

function renderActiveOrders() {
    activeOrdersList.innerHTML = '';
    if (activeOrders.length === 0) {
        activeOrdersList.innerHTML = '<p style="text-align:center; color:#999; margin-top:2rem;">Sin pedidos activos</p>';
        return;
    }

    activeOrders.forEach(order => {
        const card = document.createElement('div');
        card.className = `order-card-item ${order.type}`;
        card.onclick = () => openExistingOrder(order.id);

        const total = order.order.reduce((sum, item) => sum + (item.price * item.qty), 0);

        let icon, title;
        if (order.type === 'delivery') { icon = '🛵'; title = order.customer.name; }
        else if (order.type === 'online') { icon = '📱'; title = order.customer.name || 'Pedido Online'; }
        else { icon = '🥡'; title = 'Para Llevar'; }

        // Status dot for online orders
        const isSent = order.delivery_status === 'sent';
        const statusDot = order.type === 'online'
            ? `<span class="status-dot ${isSent ? 'sent' : 'pending'}" title="${isSent ? 'Enviado' : 'Pendiente de envío'}"></span>`
            : '';

        // Mark as sent button for online orders
        const sentBtn = order.type === 'online' && !isSent
            ? `<button class="btn btn-sent" onclick="event.stopPropagation(); markAsSent('${order.id}')">✅ Marcar enviado</button>`
            : '';

        card.innerHTML = `
            <div class="order-header">
                <span>${statusDot}${icon} ${title}</span>
                <span>$${total.toFixed(2)}</span>
            </div>
            <div class="order-details">
                ${order.order.length} productos • ${new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            ${sentBtn}
            <button class="btn btn-secondary" style="width:100%; margin-top:0.5rem" onclick="event.stopPropagation(); openCheckout('${order.id}', '${order.type}')">💰 Cobrar</button>
        `;
        activeOrdersList.appendChild(card);
    });
}

async function markAsSent(orderId) {
    const { error } = await db.from('active_orders').update({ delivery_status: 'sent' }).eq('id', orderId);
    if (error) { console.error('Error marking as sent:', error); return; }
    const order = activeOrders.find(o => o.id === orderId);
    if (order) order.delivery_status = 'sent';
    renderActiveOrders();
}

function renderCategories() {
    categoryTabs.innerHTML = '';
    DATA.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${cat === currentCategory ? 'active' : ''}`;
        btn.textContent = cat;
        btn.onclick = () => {
            currentCategory = cat;
            renderCategories();
            renderProducts(cat);
        };
        categoryTabs.appendChild(btn);
    });
}

function renderProducts(category) {
    productsGrid.innerHTML = '';
    const products = DATA.products.filter(p => p.category === category);

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.onclick = () => addToOrder(product);
        card.innerHTML = `
            <div class="product-icon">${product.icon || '🍽️'}</div>
            <h4>${product.name}</h4>
            <div class="price">$${product.price}</div>
        `;
        productsGrid.appendChild(card);
    });
}

function renderOrderList() {
    const orderData = getOrderData();
    if (!orderData) return;

    orderList.innerHTML = '';
    const orderItems = orderData.order || [];

    if (orderItems.length === 0) {
        orderList.innerHTML = `
            <div class="empty-state">
                <i class="ph ph-receipt"></i>
                <p>Sin productos</p>
            </div>
        `;
        sendOrderBtn.disabled = true;
        sendOrderBtn.style.opacity = 0.5;
    } else {
        orderItems.forEach(item => {
            const el = document.createElement('div');
            el.className = 'order-item';
            el.innerHTML = `
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <div class="price">$${(item.price * item.qty).toFixed(2)}</div>
                </div>
                <div class="item-controls">
                    <button class="qty-btn" onclick="updateQty('${item.id}', -1)">-</button>
                    <span>${item.qty}</span>
                    <button class="qty-btn" onclick="updateQty('${item.id}', 1)">+</button>
                </div>
            `;
            orderList.appendChild(el);
        });
        sendOrderBtn.disabled = false;
        sendOrderBtn.style.opacity = 1;
    }

    const total = orderItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
    orderTotalEl.textContent = `$${total.toFixed(2)}`;
}

// ========================================
// ORDER LOGIC
// ========================================

function getOrderData() {
    if (currentOrderType === 'table') {
        return tables.find(t => t.id === currentOrderId);
    } else {
        return activeOrders.find(o => o.id === currentOrderId);
    }
}

function openTable(id) {
    currentOrderId = id;
    currentOrderType = 'table';
    modalTitle.textContent = `Mesa ${id}`;

    const table = tables.find(t => t.id === id);
    if (!table) return;

    orderNotes.value = table.notes || '';
    currentCategory = DATA.categories[0];
    renderCategories();
    renderProducts(currentCategory);
    renderOrderList();
    openOrderModal();
}

function startTakeout() {
    const newId = 'T-' + Math.floor(Date.now() / 1000).toString().slice(-6);
    const newOrder = {
        id: newId,
        type: 'takeout',
        status: 'pending',
        customer: {},
        order: [],
        notes: '',
        timestamp: Date.now()
    };

    activeOrders.push(newOrder);
    saveActiveOrder(newOrder);
    renderActiveOrders();
    openExistingOrder(newId);
}

window.startTakeout = startTakeout;

window.openCustomerForm = function () {
    document.getElementById('cust-name').value = '';
    document.getElementById('cust-phone').value = '';
    document.getElementById('cust-address').value = '';
    customerModal.classList.remove('hidden');
    setTimeout(() => customerModal.classList.add('active'), 10);
};

customerForm.onsubmit = function (e) {
    e.preventDefault();
    const name = document.getElementById('cust-name').value;
    const phone = document.getElementById('cust-phone').value;
    const address = document.getElementById('cust-address').value;

    const newId = 'D-' + Math.floor(Date.now() / 1000).toString().slice(-6);
    const customer = { name, phone, address };

    const newOrder = {
        id: newId,
        type: 'delivery',
        status: 'pending',
        customer: customer,
        order: [],
        notes: '',
        timestamp: Date.now()
    };

    activeOrders.push(newOrder);
    saveActiveOrder(newOrder);
    renderActiveOrders();

    customerModal.classList.remove('active');
    setTimeout(() => customerModal.classList.add('hidden'), 300);
    openExistingOrder(newId);
};

function openExistingOrder(id) {
    let order = activeOrders.find(o => o.id === id);
    if (!order) return;

    currentOrderId = id;
    currentOrderType = order.type;

    const title = order.type === 'delivery' ? `Domicilio: ${order.customer.name}` : `Pedido: ${id}`;
    modalTitle.textContent = title;
    orderNotes.value = order.notes || '';

    currentCategory = DATA.categories[0];
    renderCategories();
    renderProducts(currentCategory);
    renderOrderList();
    openOrderModal();
}

function openOrderModal() {
    orderModal.classList.remove('hidden');
    setTimeout(() => orderModal.classList.add('active'), 10);
}

function closeOrderModal() {
    const data = getOrderData();
    if (data) {
        data.notes = orderNotes.value;
        if (currentOrderType === 'table') { saveTable(data); } else { saveActiveOrder(data); }
    }

    orderModal.classList.remove('active');
    setTimeout(() => {
        orderModal.classList.add('hidden');
        currentOrderId = null;
    }, 300);
}

function addToOrder(product) {
    const data = getOrderData();
    if (!data) return;

    const existing = data.order.find(i => i.id === product.id);
    if (existing) {
        existing.qty++;
    } else {
        data.order.push({ ...product, qty: 1 });
    }

    renderOrderList();
    if (currentOrderType === 'table') { saveTable(data); } else { saveActiveOrder(data); }
}

window.updateQty = function (productId, change) {
    const data = getOrderData();
    if (!data) return;

    const itemIndex = data.order.findIndex(i => i.id === productId);
    if (itemIndex > -1) {
        data.order[itemIndex].qty += change;
        if (data.order[itemIndex].qty <= 0) {
            data.order.splice(itemIndex, 1);
        }
        renderOrderList();
        if (currentOrderType === 'table') { saveTable(data); } else { saveActiveOrder(data); }
    }
};

function sendOrder() {
    const data = getOrderData();
    if (!data || data.order.length === 0) {
        alert("Agrega productos antes de enviar.");
        return;
    }

    data.notes = orderNotes.value;

    if (currentOrderType === 'table') {
        data.status = 'busy';
        saveTable(data);
    } else {
        saveActiveOrder(data);
    }

    const title = currentOrderType === 'delivery' ? 'DOMICILIO' :
        currentOrderType === 'takeout' ? 'PARA LLEVAR' : 'COMANDA MESA';

    printTicket(data, title);

    if (currentOrderType === 'table') {
        renderTables();
    }
    closeOrderModal();
}

// ========================================
// CHECKOUT
// ========================================

window.openCheckout = function (id, type) {
    currentOrderId = id;
    currentOrderType = type;

    let data;
    if (type === 'table') {
        data = tables.find(t => t.id === id);
    } else {
        data = activeOrders.find(o => o.id === id);
    }

    if (!data) return;

    const total = data.order.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const displayId = type === 'table' ? `Mesa ${id}` :
        type === 'delivery' ? data.customer.name : id;

    checkoutTableTitle.textContent = displayId;
    checkoutTotalEl.textContent = `$${total.toFixed(2)}`;

    checkoutModal.classList.remove('hidden');
    setTimeout(() => checkoutModal.classList.add('active'), 10);
};

window.processPayment = function (method) {
    let data;
    if (currentOrderType === 'table') {
        data = tables.find(t => t.id === currentOrderId);
    } else {
        data = activeOrders.find(o => o.id === currentOrderId);
    }

    if (!data) return;

    const total = data.order.reduce((sum, item) => sum + (item.price * item.qty), 0);

    const sale = {
        id: Date.now(),
        ref_id: String(data.id),
        type: currentOrderType,
        total: total,
        method: method,
        items: [...data.order],
        date: new Date().toISOString()
    };

    salesLog.push(sale);
    saveSale(sale);
    printTicket(data, 'TICKET DE VENTA', method, total);

    if (currentOrderType === 'table') {
        data.status = 'available';
        data.order = [];
        data.notes = '';
        saveTable(data);
        renderTables();
    } else {
        const idx = activeOrders.findIndex(o => o.id === data.id);
        if (idx > -1) activeOrders.splice(idx, 1);
        deleteActiveOrder(data.id);
        renderActiveOrders();
    }

    checkoutModal.classList.remove('active');
    setTimeout(() => checkoutModal.classList.add('hidden'), 300);
};

// ========================================
// PRINTING
// ========================================

function printTicket(data, type, method = '', total = 0) {
    const date = new Date().toLocaleString();

    let itemsHtml = '';
    data.order.forEach(item => {
        itemsHtml += `
            <div class="ticket-item">
                <span>${item.qty} x ${item.name}</span>
                <span>$${(item.price * item.qty).toFixed(2)}</span>
            </div>
        `;
    });

    const isInternal = !method;
    const finalTotal = isInternal ? '' : `
        <div class="ticket-total">
            TOTAL: $${total.toFixed(2)}
        </div>
        <div style="text-align:center; font-size:0.8rem; margin-top:0.5rem">
            Pago: ${method}
        </div>
    `;

    const notesHtml = data.notes ? `<div class="ticket-notes">NOTAS: ${data.notes}</div>` : '';

    let customerHtml = '';
    if (data.type === 'delivery' && data.customer) {
        customerHtml = `
            <div class="ticket-info" style="text-align:left; border-bottom:1px solid black;">
                <p><strong>CLIENTE:</strong> ${data.customer.name}</p>
                <p><strong>TEL:</strong> ${data.customer.phone}</p>
                <p><strong>DIR:</strong> ${data.customer.address}</p>
            </div>
        `;
    }

    const headerText = data.type === 'table' ? `Mesa: ${data.id}` :
        data.type === 'delivery' ? 'A DOMICILIO' : 'PARA LLEVAR';

    printArea.innerHTML = `
        <div class="ticket">
            <div class="ticket-header">
                <h2>EL TRÉBOL</h2>
                <p>RFC: XAXX010101000</p>
                <h3>${type}</h3>
            </div>
            <div class="ticket-info">
                <p>Fecha: ${date}</p>
                <p>${headerText}</p>
                ${data.id && data.type !== 'table' ? `<p>Folio: ${data.id}</p>` : ''}
            </div>
            ${customerHtml}
            <div class="ticket-items">
                ${itemsHtml}
            </div>
            ${finalTotal}
            ${notesHtml}
            <div class="ticket-footer">
                <p>¡Gracias por su preferencia!</p>
            </div>
        </div>
    `;

    setTimeout(() => window.print(), 100);
}

// ========================================
// REPORTS
// ========================================

window.openReport = function () {
    const today = new Date().toDateString();
    const dailySales = salesLog.filter(s => {
        const d = new Date(s.date);
        return d.toDateString() === today;
    });

    const totalSales = dailySales.reduce((sum, s) => sum + s.total, 0);
    const totalOrders = dailySales.length;
    const cashSales = dailySales.filter(s => s.method === 'Efectivo').reduce((sum, s) => sum + s.total, 0);
    const cardSales = dailySales.filter(s => s.method === 'Tarjeta').reduce((sum, s) => sum + s.total, 0);

    const productStats = {};
    dailySales.forEach(sale => {
        sale.items.forEach(item => {
            if (!productStats[item.name]) productStats[item.name] = 0;
            productStats[item.name] += item.qty;
        });
    });

    const topProducts = Object.entries(productStats)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([name, qty]) => `<li>${name}: ${qty}</li>`).join('');

    reportBody.innerHTML = `
        <div class="report-grid">
            <div class="report-card">
                <h3>Ventas Hoy</h3>
                <div class="value">$${totalSales.toFixed(2)}</div>
            </div>
            <div class="report-card">
                <h3>Pedidos</h3>
                <div class="value">${totalOrders}</div>
            </div>
            <div class="report-card">
                <h3>Efectivo</h3>
                <div class="value">$${cashSales.toFixed(2)}</div>
            </div>
            <div class="report-card">
                <h3>Tarjeta</h3>
                <div class="value">$${cardSales.toFixed(2)}</div>
            </div>
        </div>
        <div style="width:100%">
            <h3>Productos Más Vendidos</h3>
            <ul style="margin-top:0.5rem; padding-left:1.5rem">
                ${topProducts || '<li>Sin ventas aún</li>'}
            </ul>
        </div>
    `;

    reportModal.classList.remove('hidden');
    setTimeout(() => reportModal.classList.add('active'), 10);
};

// Start the app
init();
