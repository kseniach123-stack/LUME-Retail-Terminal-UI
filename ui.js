// ============================================
// UI RENDERING MODULE
// ============================================

/**
 * Handles all DOM manipulation and visual updates
 * Separated from business logic (actions.js) for clean architecture
 */
LumeTerminal.ui = {
    auth: {
        currentUserKey: 'lume_current_user_v1',
        getCurrentUser() {
            return localStorage.getItem(this.currentUserKey) || '';
        },
        setCurrentUser(username) {
            localStorage.setItem(this.currentUserKey, username);
        },
        clearCurrentUser() {
            localStorage.removeItem(this.currentUserKey);
        }
    },
    analytics: {
        selectedUser: null
    },
    filters: {
        from: null,
        to: null
    },
    focusMemory: {},
    rememberFocus(key) {
        const el = document.activeElement;
        if (el && el !== document.body) this.focusMemory[key] = el;
    },
    restoreFocus(key) {
        const el = this.focusMemory[key];
        if (el && typeof el.focus === 'function' && document.contains(el)) {
            try { el.focus(); } catch (_) {}
        }
        delete this.focusMemory[key];
    },
        /**
         * Log out and return to login page
         */
        logout() {
            document.getElementById('terminal-app').classList.add('hidden');
            document.getElementById('auth-screen').classList.remove('hidden');
            document.body.classList.remove('app-active');
            this.auth.clearCurrentUser();
        },
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
                const usernameInput = authForm.querySelector('input[type="text"]');
                const usernameRaw = usernameInput ? usernameInput.value : '';
                const username = String(usernameRaw || '').trim() || 'staff';
                this.auth.setCurrentUser(username);
                this.analytics.selectedUser = username;

                // One-time legacy migration: if all records have no user, assign to first logged-in user
                try {
                    const sales = Array.isArray(LumeTerminal.state.sales) ? LumeTerminal.state.sales : [];
                    if (sales.length) {
                        const hasAnyUser = sales.some(s => s && typeof s.user === 'string' && s.user.trim().length);
                        if (!hasAnyUser) {
                            const migrated = sales.map(s => ({ ...s, user: username }));
                            LumeTerminal.state.sales = migrated;
                            localStorage.setItem((typeof SALES_KEY !== 'undefined') ? SALES_KEY : 'lume_vault', JSON.stringify(migrated));
                        }
                    }
                } catch (_) {}

                // Hide login, show main app
                document.getElementById('auth-screen').classList.add('hidden');
                document.getElementById('terminal-app').classList.remove('hidden');
                document.body.classList.add('app-active');
                
                this.initAnalyticsRangeUI();
                this.initAnalyticsUserPickerUI();

                // Initial render of all sections
                this.renderGrid(LumeTerminal.state.inventory);
                this.updateCartUI(); 
                this.renderOperations();
                this.renderAnalytics(); 
            };
        }
    },

    initAnalyticsRangeUI() {
        const fromEl = document.getElementById('analytics-from');
        const toEl = document.getElementById('analytics-to');
        const clearEl = document.getElementById('analytics-clear');
        const closeEl = document.getElementById('analytics-close');
        const triggerEl = document.getElementById('analytics-range-trigger');
        const popoverEl = document.getElementById('analytics-range-popover');
        const summaryEl = document.getElementById('analytics-range-summary');
        const userEl = document.getElementById('analytics-user');
        const presetEls = Array.from(document.querySelectorAll('.analytics-preset'));

        const username = this.auth.getCurrentUser() || '—';
        if (userEl) userEl.textContent = username;

        const toYmd = (d) => {
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        };

        const setActivePreset = (preset) => {
            presetEls.forEach(b => b.classList.toggle('is-active', b.dataset.preset === preset));
        };

        const setSummary = () => {
            if (!summaryEl) return;
            const from = fromEl && fromEl.value ? fromEl.value : null;
            const to = toEl && toEl.value ? toEl.value : null;
            const active = presetEls.find(b => b.classList.contains('is-active'))?.dataset?.preset;

            if (!from && !to) {
                summaryEl.textContent = 'All time';
                return;
            }
            if (active === 'today') summaryEl.textContent = 'Today';
            else if (active === '7d') summaryEl.textContent = 'Last 7 days';
            else if (active === 'mtd') summaryEl.textContent = 'This month';
            else if (from && to) summaryEl.textContent = `${from} → ${to}`;
            else if (from && !to) summaryEl.textContent = `From ${from}`;
            else summaryEl.textContent = `To ${to}`;
        };

        const openPopover = () => {
            if (!popoverEl || !triggerEl) return;
            popoverEl.classList.remove('hidden');
            triggerEl.setAttribute('aria-expanded', 'true');
        };

        const closePopover = () => {
            if (!popoverEl || !triggerEl) return;
            popoverEl.classList.add('hidden');
            triggerEl.setAttribute('aria-expanded', 'false');
            setSummary();
        };

        const apply = () => {
            this.filters.from = fromEl && fromEl.value ? fromEl.value : null;
            this.filters.to = toEl && toEl.value ? toEl.value : null;
            setActivePreset(null);
            setSummary();
            this.renderOperations(); // date filter still applies to Transactions (for logged-in user)
            this.renderAnalytics();
        };

        if (fromEl) fromEl.onchange = apply;
        if (toEl) toEl.onchange = apply;
        if (clearEl) clearEl.onclick = () => {
            if (fromEl) fromEl.value = '';
            if (toEl) toEl.value = '';
            setActivePreset(null);
            apply();
        };

        if (triggerEl) {
            triggerEl.onclick = () => {
                if (!popoverEl) return;
                const isOpen = !popoverEl.classList.contains('hidden');
                if (isOpen) closePopover();
                else openPopover();
            };
        }

        if (closeEl) closeEl.onclick = closePopover;

        presetEls.forEach(btn => {
            btn.onclick = () => {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                if (btn.dataset.preset === 'today') {
                    if (fromEl) fromEl.value = toYmd(today);
                    if (toEl) toEl.value = toYmd(today);
                    setActivePreset('today');
                }

                if (btn.dataset.preset === '7d') {
                    const from = new Date(today);
                    from.setDate(from.getDate() - 6); // inclusive: today + previous 6 days
                    if (fromEl) fromEl.value = toYmd(from);
                    if (toEl) toEl.value = toYmd(today);
                    setActivePreset('7d');
                }

                if (btn.dataset.preset === 'mtd') {
                    const from = new Date(today.getFullYear(), today.getMonth(), 1);
                    if (fromEl) fromEl.value = toYmd(from);
                    if (toEl) toEl.value = toYmd(today);
                    setActivePreset('mtd');
                }

                this.filters.from = fromEl && fromEl.value ? fromEl.value : null;
                this.filters.to = toEl && toEl.value ? toEl.value : null;
                setSummary();
                this.renderOperations();
                this.renderAnalytics();
            };
        });

        // Initial state
        setSummary();
        closePopover();

        // Default: Today
        try {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (fromEl) fromEl.value = toYmd(today);
            if (toEl) toEl.value = toYmd(today);
            setActivePreset('today');
            this.filters.from = fromEl && fromEl.value ? fromEl.value : null;
            this.filters.to = toEl && toEl.value ? toEl.value : null;
            setSummary();
        } catch (_) {}

        // Close on click-outside / Esc (scoped to analytics popover)
        document.addEventListener('mousedown', (e) => {
            if (!popoverEl || !triggerEl) return;
            if (popoverEl.classList.contains('hidden')) return;
            if (popoverEl.contains(e.target) || triggerEl.contains(e.target)) return;
            closePopover();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (!popoverEl || popoverEl.classList.contains('hidden')) return;
            closePopover();
        });
    },

    initAnalyticsUserPickerUI() {
        const pill = document.getElementById('analytics-user-pill');
        const pop = document.getElementById('analytics-user-popover');
        const list = document.getElementById('analytics-user-list');
        const userEl = document.getElementById('analytics-user');

        if (!pill || !pop || !list) return;

        const open = () => {
            pop.classList.remove('hidden');
            pill.setAttribute('aria-expanded', 'true');
        };
        const close = () => {
            pop.classList.add('hidden');
            pill.setAttribute('aria-expanded', 'false');
        };
        const toggle = () => {
            const isOpen = !pop.classList.contains('hidden');
            if (isOpen) close();
            else open();
        };

        const renderUsers = () => {
            const sales = Array.isArray(LumeTerminal.state.sales) ? LumeTerminal.state.sales : [];
            const users = Array.from(new Set(sales.map(s => String(s?.user || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
            const current = this.analytics.selectedUser || this.auth.getCurrentUser();

            if (userEl) userEl.textContent = current || '—';
            list.innerHTML = users.map(u => `
                <button type="button" class="analytics-user-option ${u === current ? 'is-active' : ''}" data-user="${u}">
                    ${u}
                </button>
            `).join('') || '<div class="tx-empty">No users found.</div>';

            list.querySelectorAll('.analytics-user-option').forEach(btn => {
                btn.onclick = () => {
                    const u = btn.getAttribute('data-user');
                    this.analytics.selectedUser = u;
                    if (userEl) userEl.textContent = u;
                    renderUsers();
                    this.renderAnalytics();
                    close();
                };
            });
        };

        pill.onclick = toggle;
        pill.onkeypress = (e) => { if (e.key === 'Enter') toggle(); };

        // Close on outside / Esc
        document.addEventListener('mousedown', (e) => {
            if (pop.classList.contains('hidden')) return;
            if (pop.contains(e.target) || pill.contains(e.target)) return;
            close();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (pop.classList.contains('hidden')) return;
            close();
        });

        renderUsers();
        close();
    },

    parseTxTime(tx) {
        if (tx && tx.createdAt) {
            const t = Date.parse(tx.createdAt);
            if (!Number.isNaN(t)) return t;
        }
        // Fallback for legacy date/time strings
        const dateStr = tx?.date || '';
        const timeStr = tx?.time || '';
        const combined = `${dateStr} ${timeStr}`.trim();
        const t2 = Date.parse(combined);
        if (!Number.isNaN(t2)) return t2;
        return 0;
    },

    getFilteredSalesForAnalytics() {
        const username = this.analytics.selectedUser || this.auth.getCurrentUser();
        const sales = Array.isArray(LumeTerminal.state.sales) ? LumeTerminal.state.sales : [];
        const mine = sales.filter(s => (s?.user || '') === username);

        const from = this.filters.from ? Date.parse(this.filters.from) : null;
        const to = this.filters.to ? Date.parse(this.filters.to) : null;
        const toEnd = (to != null) ? (to + 24 * 60 * 60 * 1000 - 1) : null;

        return mine.filter(s => {
            const ts = this.parseTxTime(s);
            if (from != null && ts < from) return false;
            if (toEnd != null && ts > toEnd) return false;
            return true;
        });
    },

    getFilteredSalesForOperations() {
        // Transactions should always show only the logged-in user's activity
        const username = this.auth.getCurrentUser();
        const sales = Array.isArray(LumeTerminal.state.sales) ? LumeTerminal.state.sales : [];
        const mine = sales.filter(s => (s?.user || '') === username);

        const from = this.filters.from ? Date.parse(this.filters.from) : null;
        const to = this.filters.to ? Date.parse(this.filters.to) : null;
        const toEnd = (to != null) ? (to + 24 * 60 * 60 * 1000 - 1) : null;

        return mine.filter(s => {
            const ts = this.parseTxTime(s);
            if (from != null && ts < from) return false;
            if (toEnd != null && ts > toEnd) return false;
            return true;
        });
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
        const cartPanel = document.getElementById('cart-panel');
        const trigger = document.getElementById('cart-trigger');
        const closeBtn = document.getElementById('cart-close-btn');

        document.body.classList.remove('sidebar-open');

        const willOpen = !document.body.classList.contains('cart-open');
        if (willOpen) {
            this.rememberFocus('cart');
            if (cartPanel) cartPanel.classList.remove('hidden');
            document.body.classList.add('cart-open');
            if (trigger) trigger.setAttribute('aria-expanded', 'true');
            this.updateCartUI();
            queueMicrotask(() => {
                if (closeBtn) closeBtn.focus();
                else if (cartPanel) cartPanel.focus();
            });
        } else {
            document.body.classList.remove('cart-open');
            if (trigger) trigger.setAttribute('aria-expanded', 'false');
            // Let transition run; then hide and restore focus
            setTimeout(() => {
                if (cartPanel) cartPanel.classList.add('hidden');
                this.restoreFocus('cart');
            }, 450);
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
        document.querySelectorAll('.nav-item').forEach(n => {
            n.classList.remove('active');
            n.setAttribute('aria-selected', 'false');
            n.setAttribute('tabindex', '-1');
        });
    
        // Show target section
        const targetSection = document.getElementById(`sec-${tabId}`);
        if (targetSection) targetSection.classList.remove('hidden');
        
        // Highlight active nav item
        const navItem = document.querySelector(`[data-tab="${tabId}"]`);
        if (navItem) {
            navItem.classList.add('active');
            navItem.setAttribute('aria-selected', 'true');
            navItem.setAttribute('tabindex', '0');
        }

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
                <button class="btn-sell" onclick="LumeTerminal.actions.addToCart(${item.id}, event)">Add</button>
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

            const sales = this.getFilteredSalesForOperations();

            // Show empty state if no transactions
            if (sales.length === 0) {
                log.innerHTML = '<div class="ops-empty">No Records</div>';
                return;
            }

            // Reverse array to show newest first (non-mutating)
            log.innerHTML = sales.slice().reverse().map((s, idx) => {
                const key = String(s.id || `legacy_${idx}`);
                return `
                <div class="transaction-row" role="button" tabindex="0" aria-expanded="false"
                     onclick="LumeTerminal.ui.toggleTransactionDetails('${key}')"
                     onkeypress="if(event.key==='Enter')LumeTerminal.ui.toggleTransactionDetails('${key}')">
                    <div class="transaction-row-main">
                        <span class="transaction-row-name">
                            ${s.name || 'Order Processed'}
                            ${s.syncStatus === 'pending' ? '<span style="margin-left:8px;font-size:11px;padding:2px 8px;border-radius:999px;background:#111;color:#fff;opacity:0.85;">Pending</span>' : ''}
                        </span>
                        <span class="transaction-row-time">${s.date || ''} — ${s.time}</span>
                    </div>
                    <div class="row-price">
                        £${Number(s.price).toFixed(2)}
                    </div>
                </div>
                <div class="transaction-details hidden" id="tx-${key}">
                    ${Array.isArray(s.items) && s.items.length ? s.items.map(it => `
                        <div class="tx-item">
                            <img class="tx-item-img" src="${it.img || ''}" alt="${it.name || 'Item'}">
                            <div class="tx-item-meta">
                                <div class="tx-item-name">${it.name || ''}</div>
                                <div class="tx-item-sub">
                                    <span>£${Number(it.price || 0).toFixed(2)}</span>
                                    ${it.quantity ? `<span class="tx-item-qty">× ${it.quantity}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('') : '<div class="tx-empty">No item details for this transaction.</div>'}
                </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error rendering operations:', error);
        }
    },

    toggleTransactionDetails(txId) {
        try {
            if (!txId) return;
            const details = document.getElementById(`tx-${txId}`);
            if (!details) return;

            // Close others
            document.querySelectorAll('.transaction-details').forEach(el => {
                if (el !== details) el.classList.add('hidden');
            });
            document.querySelectorAll('.transaction-row[aria-expanded="true"]').forEach(row => {
                row.setAttribute('aria-expanded', 'false');
            });

            const willOpen = details.classList.contains('hidden');
            details.classList.toggle('hidden');

            const row = details.previousElementSibling;
            if (row && row.classList && row.classList.contains('transaction-row')) {
                row.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            }
        } catch (error) {
            console.error('Error toggling transaction details:', error);
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
            const sales = this.getFilteredSalesForAnalytics();
            const totalRevenue = sales.reduce((sum, s) => sum + Number(s.price || 0), 0);
            const totalOrders = sales.length;
            const averageValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
            const totalItems = sales.reduce((sum, s) => {
                if (Array.isArray(s.items)) {
                    return sum + s.items.reduce((sub, it) => sub + Number(it.quantity || 0), 0);
                }
                return sum;
            }, 0);

            // Update Total Sales and ATV (now both in the same card)
            const statRevenue = document.getElementById('stat-revenue');
            if (statRevenue) statRevenue.innerText = `£${totalRevenue.toFixed(2)}`;
            const statATV = document.getElementById('stat-atv');
            if (statATV) statATV.innerText = `£${averageValue.toFixed(2)}`;

            // Update other stats as before
            const statCount = document.getElementById('stat-count');
            if (statCount) statCount.innerText = totalOrders;
            const statItems = document.getElementById('stat-items-total');
            if (statItems) statItems.innerText = totalItems;
        } catch (error) {
            console.error('Error rendering analytics:', error);
        }
    }
}
