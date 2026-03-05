// ============================================
// UI RENDERING MODULE
// ============================================

/**
 * Handles all DOM manipulation and visual updates
 * Separated from business logic (actions.js) for clean architecture
 */
LumeTerminal.ui = {
    /**
     * Initialize authentication flow
     * 
     * Design: Simple login screen before accessing terminal
     * No actual auth backend - just visual gate for demo
     */
    init() {
        const authForm = document.getElementById('auth-form');
        if (authForm) {
            authForm.onsubmit = (e) => {
                e.preventDefault();
                // Hide login, show main app
                document.getElementById('auth-screen').classList.add('hidden');
                document.getElementById('terminal-app').classList.remove('hidden');
                document.body.classList.add('app-active');
                
                // Initial render of all sections
                this.renderGrid(LumeTerminal.state.inventory);
                this.updateCartUI(); 
                this.renderOperations();
                this.renderAnalytics(); 
            };
        }
    },

    /**
     * Toggle sidebar menu
     * Close cart if open (only one panel at a time)
     */
    toggleMenu() {
        document.body.classList.remove('cart-open');
        document.body.classList.toggle('sidebar-open');
    },

    /**
     * Toggle shopping cart panel
     * Close sidebar if open, refresh cart contents
     */
    toggleCart() {
        document.body.classList.remove('sidebar-open');
        document.body.classList.toggle('cart-open');
        if (document.body.classList.contains('cart-open')) {
            this.updateCartUI();
        }
    },

    /**
     * Close all panels (used by ESC key and click-outside)
     */
    closeAll() {
        document.body.classList.remove('sidebar-open', 'cart-open');
    },

    /**
     * Switch between dashboard tabs
     * @param {string} tabId - 'dashboard', 'operations', or 'analytics'
     * 
     * Pattern: Hide all sections, show target, update nav
     */
    switchTab(tabId) {
        // Hide all sections
        document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
        // Show target section
        const targetSection = document.getElementById(`sec-${tabId}`);
        if (targetSection) targetSection.classList.remove('hidden');
        
        // Highlight active nav item
        const navItem = document.querySelector(`[data-tab="${tabId}"]`);
        if (navItem) navItem.classList.add('active');

        // Auto-close sidebar on mobile after tab switch
        document.body.classList.remove('sidebar-open');
        
        // Lazy render: only update data when tab becomes visible
        if(tabId === 'analytics') this.renderAnalytics();
        if(tabId === 'operations') this.renderOperations();
        if(tabId === 'dashboard') this.renderGrid(LumeTerminal.state.inventory);
    },

    /**
     * Render product grid
     * @param {Array} items - Inventory items to display
     * 
     * Performance: Using template literals and join() instead of
     * creating DOM nodes individually (faster for large lists)
     */
    renderGrid(items) {
        const container = document.getElementById('grid-container');
        if (!container) return; 
        
        container.innerHTML = items.map(item => `
            <div class="product-card">
                <img src="${item.img}" alt="${item.name}">
                <div class="p-name">${item.name}</div>
                <div class="p-price">£${item.price.toFixed(2)}</div>
                <button class="btn-sell" onclick="LumeTerminal.actions.addToCart(${item.id})">Add</button>
            </div>
        `).join('');
    },

    /**
     * Render transaction history (Operations tab)
     * 
     * Features:
     * - Shows all past transactions
     * - Reverse chronological order (newest first)
     * - Empty state handling
     */
    renderOperations() {
        try {
            const log = document.getElementById('ops-list');
            if (!log) return;

            const sales = LumeTerminal.state.sales || [];

            // Show empty state if no transactions
            if (sales.length === 0) {
                log.innerHTML = '<div class="ops-empty">No Records</div>';
                return;
            }

            // Reverse array to show newest first (non-mutating)
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

    /**
     * Update shopping cart UI
     * 
     * Responsibilities:
     * - Render all cart items with quantities
     * - Calculate and display totals
     * - Update badge counter
     * 
     * Called after: adding to cart, completing transaction, opening cart panel
     */
    updateCartUI() {
        try {
            const countBadge = document.getElementById('cart-count-badge');
            const list = document.getElementById('cart-items-list');
            const totalDisp = document.getElementById('cart-total-price');

            if (!list) return;

            let total = 0;
            let totalItemsCount = 0;

            // Render each cart item
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

            // Update counter badge (total quantity, not unique items)
            if (countBadge) {
                countBadge.innerText = totalItemsCount;
            }
            
            // Update total price
            if (totalDisp) {
                totalDisp.innerText = `£${total.toFixed(2)}`;
            }
        } catch (error) {
            console.error('Error updating cart UI:', error);
        }
    },

    /**
     * Render analytics dashboard
     * 
     * Metrics calculated:
     * - Total revenue (sum of all transactions)
     * - Average transaction value (ATV)
     * - Total order count
     * - Total items sold
     * 
     * Design decision: Simple metrics suitable for small retail
     * (could expand to: peak hours, top products, daily trends)
     */
    renderAnalytics() {
        try {
            const sales = LumeTerminal.state.sales || [];
            
            // Calculate key metrics
            const totalRevenue = sales.reduce((sum, s) => sum + Number(s.price || 0), 0);
            const totalOrders = sales.length;
            const averageValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

            // Map metrics to DOM elements
            const statElements = {
                'stat-revenue': `£${totalRevenue.toFixed(2)}`,
                'stat-atv': `£${averageValue.toFixed(2)}`,
                'stat-count': totalOrders,
                'stat-items-total': totalOrders
            };

            // Update all stat displays
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
