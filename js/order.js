// ========================================
// ORDER.JS - Customer Order Page Logic
// ========================================

let cart = [];
let currentCategory = DATA.categories[0];
let cartOpen = false;

// Init
function init() {
    renderCategoryTabs();
    renderProducts(currentCategory);
    updateCartUI();
}

// Render category tabs
function renderCategoryTabs() {
    const tabs = document.getElementById('order-category-tabs');
    tabs.innerHTML = '';
    DATA.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `tab-btn ${cat === currentCategory ? 'active' : ''}`;
        btn.textContent = cat;
        btn.onclick = () => {
            currentCategory = cat;
            renderCategoryTabs();
            renderProducts(cat);
        };
        tabs.appendChild(btn);
    });
}

// Render products
function renderProducts(category) {
    const grid = document.getElementById('order-products-grid');
    grid.innerHTML = '';
    DATA.products.filter(p => p.category === category).forEach(product => {
        const cartItem = cart.find(i => i.id === product.id);
        const qty = cartItem ? cartItem.qty : 0;

        const card = document.createElement('div');
        card.className = `order-product-card ${qty > 0 ? 'in-cart' : ''}`;
        card.onclick = () => addToCart(product);
        card.innerHTML = `
            ${qty > 0 ? `<div class="qty-badge">${qty}</div>` : ''}
            <div class="product-emoji">${product.icon || '🍽️'}</div>
            <h4>${product.name}</h4>
            <div class="price">$${product.price}</div>
        `;
        grid.appendChild(card);
    });
}

// Add to cart
function addToCart(product) {
    const existing = cart.find(i => i.id === product.id);
    if (existing) {
        existing.qty++;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    renderProducts(currentCategory);
    updateCartUI();

    // Auto-open cart when first item added
    if (cart.length === 1 && !cartOpen) {
        toggleCart();
    }
}

// Update cart quantity
function updateCartQty(productId, change) {
    const idx = cart.findIndex(i => i.id === productId);
    if (idx > -1) {
        cart[idx].qty += change;
        if (cart[idx].qty <= 0) cart.splice(idx, 1);
    }
    renderProducts(currentCategory);
    updateCartUI();
}

// Toggle cart open/closed
function toggleCart() {
    cartOpen = !cartOpen;
    const itemsEl = document.getElementById('cart-items');
    const footerEl = document.getElementById('cart-footer');
    const chevron = document.getElementById('cart-chevron');

    if (cartOpen) {
        itemsEl.classList.add('open');
        footerEl.classList.add('open');
        chevron.className = 'ph ph-caret-down';
    } else {
        itemsEl.classList.remove('open');
        footerEl.classList.remove('open');
        chevron.className = 'ph ph-caret-up';
    }
    renderCartItems();
}

// Render cart items list
function renderCartItems() {
    const el = document.getElementById('cart-items');
    if (cart.length === 0) {
        el.innerHTML = '<p style="text-align:center;color:#999;padding:1rem;">Sin productos</p>';
        return;
    }
    el.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <div class="price">$${(item.price * item.qty).toFixed(2)}</div>
            </div>
            <div class="cart-item-controls">
                <button class="qty-ctrl-btn" onclick="updateCartQty('${item.id}', -1)">−</button>
                <span style="font-weight:700;min-width:20px;text-align:center">${item.qty}</span>
                <button class="qty-ctrl-btn" onclick="updateCartQty('${item.id}', 1)">+</button>
            </div>
        </div>
    `).join('');
}

// Update cart summary UI
function updateCartUI() {
    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);

    document.getElementById('cart-count').textContent = totalQty;
    document.getElementById('cart-total-mini').textContent = `$${total.toFixed(2)}`;
    document.getElementById('cart-total').textContent = `$${total.toFixed(2)}`;

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = cart.length === 0;

    if (cartOpen) renderCartItems();
}

// Submit order to Supabase
async function submitOrder() {
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const notes = document.getElementById('order-notes-online').value.trim();

    if (!name) {
        alert('Por favor escribe tu nombre.');
        document.getElementById('cust-name').focus();
        return;
    }
    if (cart.length === 0) {
        alert('Agrega al menos un producto.');
        return;
    }

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    const orderData = {
        type: 'online',
        status: 'pending',
        delivery_status: 'pending',
        customer_json: { name, phone, address },
        order_json: cart,
        notes: notes,
        timestamp: Date.now()
    };

    const { error } = await db.from('active_orders').insert(orderData);

    if (error) {
        console.error('Error submitting order:', error);
        alert('Hubo un error al enviar tu pedido. Intenta de nuevo.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="ph ph-paper-plane-tilt"></i> Enviar Pedido';
        return;
    }

    // Show success screen
    document.getElementById('success-screen').classList.remove('hidden');
    document.getElementById('success-order-id').textContent = `Tu pedido fue recibido. ¡Gracias ${name}!`;

}

// Reset for new order
function resetOrder() {
    cart = [];
    document.getElementById('cust-name').value = '';
    document.getElementById('cust-phone').value = '';
    document.getElementById('cust-address').value = '';
    document.getElementById('order-notes-online').value = '';
    document.getElementById('success-screen').classList.add('hidden');
    cartOpen = false;
    document.getElementById('cart-items').classList.remove('open');
    document.getElementById('cart-footer').classList.remove('open');
    document.getElementById('cart-chevron').className = 'ph ph-caret-up';
    renderProducts(currentCategory);
    updateCartUI();
}

// Start
init();
