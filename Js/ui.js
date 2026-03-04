LumeTerminal.ui = {
    init() {
        const authForm = document.getElementById('auth-form');
        if (authForm) {
            authForm.onsubmit = (e) => {
                e.preventDefault();
                document.getElementById('auth-screen').classList.add('hidden');
                document.getElementById('terminal-app').classList.remove('hidden');
                document.body.classList.add('app-active');
                
                this.renderGrid(LumeTerminal.state.inventory);
                this.updateCartUI(); 
                this.renderOperations();
                this.renderAnalytics(); 
            };
        }
    },

    toggleMenu() {
        document.body.classList.remove('cart-open');
        document.body.classList.toggle('sidebar-open');
    },

    toggleCart() {
        document.body.classList.remove('sidebar-open');
        document.body.classList.toggle('cart-open');
        if (document.body.classList.contains('cart-open')) {
            this.updateCartUI();
        }
    },

   
    closeAll() {
        document.body.classList.remove('sidebar-open', 'cart-open');
    },

    switchTab(tabId) {
        document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
        const targetSection = document.getElementById(`sec-${tabId}`);
        if (targetSection) targetSection.classList.remove('hidden');
        
        const navItem = document.querySelector(`[data-tab="${tabId}"]`);
        if (navItem) navItem.classList.add('active');

        
        document.body.classList.remove('sidebar-open');
        
      
        if(tabId === 'analytics') this.renderAnalytics();
        if(tabId === 'operations') this.renderOperations();
        if(tabId === 'dashboard') this.renderGrid(LumeTerminal.state.inventory);
    },

    renderGrid(items) {
        const container = document.getElementById('grid-container');
        if (!container) return; 
        container.innerHTML = items.map(item => `
            <div class="product-card">
                <img src="${item.img}" alt="${item.name}">
                <div class="p-name">${item.name}</div>
                <div class="p-price">£${item.price.toFixed(2)}</div>
                <button class="btn-sell" onclick="LumeTerminal.actions.addToCart(${item.id})">Add to cart</button>
            </div>
        `).join('');
    },

    renderOperations() {
        try {
            const log = document.getElementById('ops-list');
            if (!log) return;

            const sales = LumeTerminal.state.sales || [];

            if (sales.length === 0) {
                log.innerHTML = '<div class="ops-empty">No Records</div>';
                return;
            }

            log.innerHTML = sales.slice().reverse().map(s => `
                <div class="transaction-row">
                    <div class="transaction-row-main">
                        <span class="transaction-row-name">${s.name || 'Order Processed'}</span>
                        <span class="transaction-row-time">${s.date || ''} — ${s.time}</span>
                    </div>
                    <div class="row-price">
                        £${Number(s.price).toFixed(2)}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Error rendering operations:', error);
        }
    },

    updateCartUI() {
        try {
            const countBadge = document.getElementById('cart-count-badge');
            const list = document.getElementById('cart-items-list');
            const totalDisp = document.getElementById('cart-total-price');

            if (!list) return;

            let total = 0;
            let totalItemsCount = 0;

            list.innerHTML = LumeTerminal.state.cart.map(item => {
                const itemTotal = item.price * item.quantity;
                total += itemTotal;
                totalItemsCount += item.quantity;
                return `
                    <div class="cart-item-wrapper">
                        <div class="cart-item-img-container">
                            <img src="${item.img}" alt="${item.name}" class="cart-item-img">
                            <div class="cart-item-info">
                                <div class="cart-item-name">${item.name}</div>
                                <div class="cart-item-quantity">${item.quantity} x £${item.price.toFixed(2)}</div>
                            </div>
                        </div>
                        <span class="cart-item-price">£${itemTotal.toFixed(2)}</span>
                    </div>`;
            }).join('');

            if (countBadge) {
                countBadge.innerText = totalItemsCount;
            }
            if (totalDisp) {
                totalDisp.innerText = `£${total.toFixed(2)}`;
            }
        } catch (error) {
            console.error('Error updating cart UI:', error);
        }
    },

    renderAnalytics() {
        try {
            const sales = LumeTerminal.state.sales || [];
            const totalRevenue = sales.reduce((sum, s) => sum + Number(s.price || 0), 0);
            const totalOrders = sales.length;
            const averageValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

            const statElements = {
                'stat-revenue': `£${totalRevenue.toFixed(2)}`,
                'stat-atv': `£${averageValue.toFixed(2)}`,
                'stat-count': totalOrders,
                'stat-items-total': totalOrders
            };

            Object.entries(statElements).forEach(([id, value]) => {
                const el = document.getElementById(id);
                if (el) {
                    el.innerText = value;
                }
            });
        } catch (error) {
            console.error('Error rendering analytics:', error);
        }
    }
}
