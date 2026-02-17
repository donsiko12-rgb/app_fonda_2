// State - Now synced from Supabase
let tables = [];
let activeOrders = [];
let salesLog = []; // We won't fetch full sales log to avoid heavy load, only for report if needed or recent. Actually for V1 report lets fetch all for day.

let currentOrderId = null;
let currentOrderType = 'table';
let currentCategory = DATA.categories[0];

// Temp Storage for Customer
let tempCustomer = {};

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

// Checkout DOM
const checkoutModal = document.getElementById('checkout-modal');
const closeCheckoutBtn = document.getElementById('close-checkout-btn');
const checkoutTableTitle = document.getElementById('checkout-table-id');
const checkoutTotalEl = document.getElementById('checkout-total-amount');

// Customer DOM
const customerModal = document.getElementById('customer-modal');
const closeCustomerBtn = document.getElementById('close-customer-btn');
const customerForm = document.getElementById('customer-form');

// Report DOM
const reportModal = document.getElementById('report-modal');
const closeReportBtn = document.getElementById('close-report-btn');
const reportBody = document.getElementById('report-body');
const resetDayBtn = document.getElementById('reset-day-btn');

// Print DOM
const printArea = document.getElementById('print-area');

// Initialization
async function init() {
    renderCategories();
    renderProducts(currentCategory);
    setupEventListeners();

    // Initial Fetch
    await fetchTables();
    await fetchActiveOrders();
    // await fetchSalesLog(); // Only fetch when report opened

    // Realtime Subscriptions
    setupRealtime();
}

// ---------------- SUPABASE ACTIONS ----------------

async function fetchTables() {
    const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('id', { ascending: true });

    if (error) console.error('Error fetching tables:', error);
    if (data) {
        // Map DB columns to our App structure
        tables = data.map(t => ({
            id: t.id,
            status: t.status,
            order: t.order_json || [],
            notes: t.notes || ''
        }));
        renderTables();
    }
}

async function fetchActiveOrders() {
    const { data, error } = await supabase
        .from('active_orders')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) console.error('Error fetching active orders:', error);
    if (data) {
        activeOrders = data.map(o => ({
            id: o.id,
            type: o.type,
            status: o.status,
            order: o.order_json || [],
            customer: o.customer_json || {},
            notes: o.notes || '',
            timestamp: new Date(o.created_at).getTime()
        }));
        renderActiveOrders();
    }
}

function setupRealtime() {
    supabase.channel('public:tables')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, payload => {
            console.log('Table Change received!', payload);
            fetchTables(); // Re-fetch all to be safe and simple
        })
        .subscribe();

    supabase.channel('public:active_orders')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'active_orders' }, payload => {
            console.log('Order Change received!', payload);
            fetchActiveOrders();
        })
        .subscribe();
}

// ---------------- RENDER ----------------

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
            actionBtn = `<button class="btn btn-secondary" style="margin-top:0.5rem" onclick="event.stopPropagation(); openCheckout(${table.id}, 'table')">üí∞ Cobrar</button>`;
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
        const icon = order.type === 'delivery' ? 'üõµ' : 'ü•°';
        const title = order.type === 'delivery' ? order.customer.name : 'Para Llevar';

        card.innerHTML = `
            <div class="order-header">
                <span>${icon} ${title}</span>
                <span>$${total.toFixed(2)}</span>
            </div>
            <div class="order-details">
                ${order.order.length} productos ‚Ä¢ ${new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <button class="btn btn-secondary" style="width:100%; margin-top:0.5rem" onclick="event.stopPropagation(); openCheckout('${order.id}', '${order.type}')">üí∞ Cobrar</button>
        `;
        activeOrdersList.appendChild(card);
    });
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
            <div class="product-icon">${product.icon || 'üçΩÔ∏è'}</div>
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

    // Update Total
    const total = orderItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
    orderTotalEl.textContent = `$${total.toFixed(2)}`;
}

// ---------------- LOGIC ----------------

function getOrderData() {
    if (currentOrderType === 'table') {
        return tables.find(t => t.id === currentOrderId);
    } else {
        return activeOrders.find(o => o.id === currentOrderId);
    }
}

// -- Tables --
function openTable(id) {
    currentOrderId = id;
    currentOrderType = 'table';
    modalTitle.textContent = `Mesa ${id}`;

    const table = tables.find(t => t.id === id);
    if (!table) return; // Should not happen

    orderNotes.value = table.notes || '';

    currentCategory = DATA.categories[0];
    renderCategories();
    renderProducts(currentCategory);
    renderOrderList();

    openOrderModal();
}

// -- External Orders --
async function startTakeout() {
    const newId = 'T-' + Math.floor(Date.now() / 1000).toString().slice(-6);
    const newOrder = {
        id: newId,
        type: 'takeout',
        status: 'pending',
        customer_json: {},
        order_json: [],
        notes: ''
    };

    // Optimistic UI Update
    // activeOrders.push({ ...newOrder, order: [], customer: {} }); 
    // renderActiveOrders();

    // DB Insert
    const { error } = await supabase.from('active_orders').insert([newOrder]);
    if (error) {
        alert("Error creando pedido: " + error.message);
        return;
    }

    // Rely on Realtime to update UI or manual trigger? 
    // Realtime is best, but for UX responsiveness let's wait a bit or open immediately?
    // Let's wait for the fetch triggered by realtime to be safe, OR force open with local data.
    // For V1, let's wait 500ms then open.
    setTimeout(() => openExistingOrder(newId), 500);
}

window.startTakeout = startTakeout; // Expose

window.openCustomerForm = function () {
    document.getElementById('cust-name').value = '';
    document.getElementById('cust-phone').value = '';
    document.getElementById('cust-address').value = '';
    customerModal.classList.remove('hidden');
    setTimeout(() => customerModal.classList.add('active'), 10);
};

customerForm.onsubmit = async function (e) {
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
        customer_json: customer,
        order_json: [],
        notes: ''
    };

    const { error } = await supabase.from('active_orders').insert([newOrder]);
    if (error) {
        alert("Error: " + error.message);
        return;
    }

    customerModal.classList.remove('active');
    setTimeout(() => customerModal.classList.add('hidden'), 300);

    setTimeout(() => openExistingOrder(newId), 500);
};

function openExistingOrder(id) {
    // If called from realtime delay, id might not be in activeOrders list yet if fetchTables hasn't finished?
    // We'll try finding it, if not found, we fetch.
    let order = activeOrders.find(o => o.id === id);
    if (!order) {
        // try fetching again?
        return;
    }

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


// -- Shared Order Logic --
function openOrderModal() {
    orderModal.classList.remove('hidden');
    setTimeout(() => orderModal.classList.add('active'), 10);
}

async function closeOrderModal() {
    const data = getOrderData();
    if (data) {
        data.notes = orderNotes.value;
        await saveOrderState(data);
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
    // Debounce save? For simplicity, save immediately for sync feeling.
    saveOrderState(data);
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
        saveOrderState(data);
    }
};

async function sendOrder() {
    const data = getOrderData();
    if (!data || data.order.length === 0) {
        alert("Agrega productos antes de enviar.");
        return;
    }

    data.notes = orderNotes.value;

    if (currentOrderType === 'table') {
        data.status = 'busy';
    }

    await saveOrderState(data);

    const title = currentOrderType === 'delivery' ? 'DOMICILIO' :
        currentOrderType === 'takeout' ? 'PARA LLEVAR' : 'COMANDA MESA';

    printTicket(data, title);
    closeOrderModal();
}

// -- Database Saver --
async function saveOrderState(data) {
    if (currentOrderType === 'table') {
        // Update Table
        await supabase.from('tables').update({
            status: data.status,
            order_json: data.order,
            notes: data.notes
        }).eq('id', data.id);
    } else {
        // Update Active Order
        await supabase.from('active_orders').update({
            order_json: data.order,
            notes: data.notes
        }).eq('id', data.id);
    }
}

// -- Checkout --
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

window.processPayment = async function (method) {
    let data;
    if (currentOrderType === 'table') {
        data = tables.find(t => t.id === currentOrderId);
    } else {
        data = activeOrders.find(o => o.id === currentOrderId);
    }

    if (!data) return;

    const total = data.order.reduce((sum, item) => sum + (item.price * item.qty), 0);

    // 1. Insert into Sales Log
    const { error: saleError } = await supabase.from('sales_log').insert([{
        ref_id: String(data.id),
        type: currentOrderType,
        total: total,
        method: method,
        items_json: data.order
    }]);

    if (saleError) {
        alert('Error registrando venta: ' + saleError.message);
        return;
    }

    // Print Customer Ticket
    printTicket(data, 'TICKET DE VENTA', method, total);

    // 2. Reset/Delete
    if (currentOrderType === 'table') {
        await supabase.from('tables').update({
            status: 'available',
            order_json: [],
            notes: ''
        }).eq('id', data.id);
    } else {
        // Update to 'paid' or delete? Let's delete from active_orders to keep it clean.
        // Or update status to 'completed' if we want history?
        // Plan said: "Migrate activeOrders state". Let's update status to 'completed' effectively removing from "active" query.
        await supabase.from('active_orders').update({
            status: 'completed'
        }).eq('id', data.id);
    }

    // UI will update automatically via Realtime

    // Close Modal
    checkoutModal.classList.remove('active');
    setTimeout(() => checkoutModal.classList.add('hidden'), 300);
};

// -- Printing --
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

    const finalTotal = isInternal
        ? ''
        : `
            <div class="ticket-total">
                TOTAL: $${total.toFixed(2)}
            </div>
            <div style="text-align:center; font-size:0.8rem; margin-top:0.5rem">
                Pago: ${method}
            </div>
        `;

    const notesHtml = data.notes
        ? `<div class="ticket-notes">NOTAS: ${data.notes}</div>`
        : '';

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
                <h2>EL TR√âBOL</h2>
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
                <p>¬°Gracias por su preferencia!</p>
            </div>
        </div>
    `;

    setTimeout(() => window.print(), 100);
}

// -- Reports --
window.openReport = async function () {
    // Fetch today's sales
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
        .from('sales_log')
        .select('*')
        .gte('created_at', startOfDay.toISOString());

    if (error) {
        alert("Error cargando reporte: " + error.message);
        return;
    }

    salesLog = data; // use this data for report

    const totalSales = salesLog.reduce((sum, s) => sum + s.total, 0);
    const totalOrders = salesLog.length;

    const cashSales = salesLog.filter(s => s.method === 'Efectivo').reduce((sum, s) => sum + s.total, 0);
    const cardSales = salesLog.filter(s => s.method === 'Tarjeta').reduce((sum, s) => sum + s.total, 0);

    const productStats = {};
    salesLog.forEach(sale => {
        // parse JSON if needed, but supabase client auto parses json types
        const items = sale.items_json || [];
        items.forEach(item => {
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
                <h3>Ventas Totales</h3>
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
            <h3>Productos M√°s Vendidos (Hoy)</h3>
            <ul style="margin-top:0.5rem; padding-left:1.5rem">
                ${topProducts || '<li>Sin ventas a√∫n</li>'}
            </ul>
        </div>
    `;

    reportModal.classList.remove('hidden');
    setTimeout(() => reportModal.classList.add('active'), 10);
};

// Start
init();
 
 / /   . . .   e x i s t i n g   c o d e   . . .  
  
 / /   - - -   D E B U G   H E L P E R   - - -  
 w i n d o w . t e s t C o n n e c t i o n   =   a s y n c   f u n c t i o n   ( )   {  
         a l e r t ( " I n i c i a n d o   p r u e b a   d e   c o n e x i √ ≥ n . . . \ n U R L :   "   +   S U P A B A S E _ U R L ) ;  
  
         / /   C h e c k   1 :   T a b l e s  
         c o n s t   {   d a t a :   t a b l e s D a t a ,   e r r o r :   t a b l e s E r r o r   }   =   a w a i t   s u p a b a s e . f r o m ( ' t a b l e s ' ) . s e l e c t ( ' * ' ) ;  
         i f   ( t a b l e s E r r o r )   {  
                 a l e r t ( " ‚ ù R  E r r o r   b u s c a n d o   m e s a s :   "   +   J S O N . s t r i n g i f y ( t a b l e s E r r o r ) ) ;  
         }   e l s e   {  
                 a l e r t ( " ‚ S&   M e s a s   e n c o n t r a d a s :   "   +   t a b l e s D a t a . l e n g t h   +   " \ n "   +   J S O N . s t r i n g i f y ( t a b l e s D a t a ) ) ;  
                 i f   ( t a b l e s D a t a . l e n g t h   = = =   0 )   {  
                         a l e r t ( " ‚ a† Ô ∏ è   L a   c o n e x i √ ≥ n   f u n c i o n a   p e r o   N O   H A Y   D A T O S   e n   l a   t a b l a   m e s a . \ n E j e c u t a   e l   s c r i p t   S Q L   ' I N S E R T '   d e   n u e v o . " ) ;  
                 }  
         }  
  
         / /   C h e c k   2 :   A c t i v e   O r d e r s  
         c o n s t   {   d a t a :   o r d e r s D a t a ,   e r r o r :   o r d e r s E r r o r   }   =   a w a i t   s u p a b a s e . f r o m ( ' a c t i v e _ o r d e r s ' ) . s e l e c t ( ' * ' ) ;  
         i f   ( o r d e r s E r r o r )   {  
                 a l e r t ( " ‚ ù R  E r r o r   b u s c a n d o   p e d i d o s :   "   +   J S O N . s t r i n g i f y ( o r d e r s E r r o r ) ) ;  
         }   e l s e   {  
                 a l e r t ( " ‚ S&   P e d i d o s   e n c o n t r a d o s :   "   +   o r d e r s D a t a . l e n g t h ) ;  
         }  
 } ;  
 