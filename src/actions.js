import { Html5Qrcode } from 'html5-qrcode';
import {
    LumeTerminal,
    SALES_KEY,
    OUTBOX_KEY,
    LAST_SYNC_KEY,
    safeJsonParse,
    updateSyncStatusUI,
} from './app.js';
import { showToast } from './toast.js';

// ============================================
// CART MANAGEMENT
// ============================================

// Track scanner state globally to prevent duplicate scans
LumeTerminal.actions.isScanning = false;
LumeTerminal.actions._searchListActiveIndex = -1;

/**
 * Add item to shopping cart
 * @param {number} itemId - Product ID from inventory
 * 
 * Logic:
 * - Find item in inventory by ID
 * - If already in cart, increment quantity
 * - If new item, add with quantity = 1
 * - Update UI to reflect changes
 */
LumeTerminal.actions.addToCart = function(itemId, evt) {
    try {
        // Validate state exists before accessing
        if (!LumeTerminal.state || !LumeTerminal.state.inventory) {
            console.error('Invalid state or inventory');
            return;
        }

        // Find product in inventory
        const item = LumeTerminal.state.inventory.find(i => i.id === itemId);
        if (!item) {
            console.warn(`Item with ID ${itemId} not found`);
            return;
        }

        // Check if item already exists in cart
        const cartItem = LumeTerminal.state.cart.find(i => i.id === itemId);
        if (cartItem) {
            // Increment quantity for existing item
            cartItem.quantity++;
        } else {
            // Add new item with quantity = 1 (spread operator creates copy)
            LumeTerminal.state.cart.push({ ...item, quantity: 1 });
        }

        // Refresh cart UI with updated data
        LumeTerminal.ui.updateCartUI();

        // Visual feedback: button press + cart badge pulse
        const btn = evt && evt.currentTarget ? evt.currentTarget : null;
        if (btn && btn.classList) {
            btn.classList.remove('btn-added');
            // restart animation if user clicks quickly
            void btn.offsetWidth;
            btn.classList.add('btn-added');
            setTimeout(() => btn.classList.remove('btn-added'), 450);
        }

        const badge = document.getElementById('cart-count-badge');
        if (badge && badge.classList) {
            badge.classList.remove('cart-badge-bump');
            void badge.offsetWidth;
            badge.classList.add('cart-badge-bump');
            setTimeout(() => badge.classList.remove('cart-badge-bump'), 450);
        }
    } catch (error) {
        console.error('Error adding item to cart:', error);
    }
};

// ============================================
// SEARCH & AUTOCOMPLETE
// ============================================

/**
 * Real-time product search with autocomplete suggestions
 * @param {string} query - User input from search bar
 * 
 * Features:
 * - Case-insensitive search
 * - Live filtering as user types
 * - Clickable suggestions that add to cart
 * - Auto-hide when empty
 */
LumeTerminal.actions.search = function(query) {
    const suggestionsBox = document.getElementById('search-suggestions');
    const input = document.getElementById('inventory-search');

    if (!suggestionsBox) {
        console.warn('Search suggestions box not found');
        return;
    }

    LumeTerminal.actions._searchListActiveIndex = -1;
    if (input) input.removeAttribute('aria-activedescendant');

    const searchTerm = query.toLowerCase().trim();
    LumeTerminal.state.dashboardSearchQuery = searchTerm;
    if (LumeTerminal.ui?.refreshDashboardGrid) {
        LumeTerminal.ui.refreshDashboardGrid();
    }

    if (searchTerm.length === 0) {
        suggestionsBox.classList.add('hidden');
        suggestionsBox.innerHTML = '';
        return;
    }

    const matches = LumeTerminal.state.inventory.filter(item =>
        item.name.toLowerCase().includes(searchTerm)
    );

    if (matches.length > 0) {
        suggestionsBox.classList.remove('hidden');
        suggestionsBox.innerHTML = matches.map((item, i) => `
            <div class="suggestion-item"
                 role="option"
                 id="search-opt-${i}"
                 data-item-id="${item.id}"
                 aria-selected="false"
                 onclick="LumeTerminal.actions.selectSuggestion(${item.id})">
                <img src="${item.img}" alt="${item.name}">
                <div class="suggestion-item-content">
                    <div class="suggestion-item-name">${item.name}</div>
                    <div class="suggestion-item-price">£${item.price.toFixed(2)}</div>
                </div>
                <span>+</span>
            </div>
        `).join('');
    } else {
        suggestionsBox.innerHTML =
            '<div class="suggestion-item suggestion-item--empty" role="status">No products found</div>';
        suggestionsBox.classList.remove('hidden');
    }
};

/**
 * Handle click on an autocomplete suggestion
 * Keeps inline onclick minimal to avoid token/quoting issues.
 */
LumeTerminal.actions.selectSuggestion = function(itemId) {
    try {
        LumeTerminal.actions.addToCart(itemId);
        const input = document.getElementById('inventory-search');
        if (input) {
            input.value = '';
            input.removeAttribute('aria-activedescendant');
        }
        LumeTerminal.actions._searchListActiveIndex = -1;
        const box = document.getElementById('search-suggestions');
        if (box) {
            box.classList.add('hidden');
            box.innerHTML = '';
        }
        LumeTerminal.state.dashboardSearchQuery = '';
        if (LumeTerminal.ui?.refreshDashboardGrid) {
            LumeTerminal.ui.refreshDashboardGrid();
        }
    } catch (error) {
        console.error('Error selecting suggestion:', error);
    }
};

LumeTerminal.actions.clearDashboardSearch = function() {
    const input = document.getElementById('inventory-search');
    if (input) {
        input.value = '';
        input.removeAttribute('aria-activedescendant');
    }
    LumeTerminal.state.dashboardSearchQuery = '';
    LumeTerminal.actions._searchListActiveIndex = -1;
    const box = document.getElementById('search-suggestions');
    if (box) {
        box.classList.add('hidden');
        box.innerHTML = '';
    }
    if (LumeTerminal.ui?.refreshDashboardGrid) {
        LumeTerminal.ui.refreshDashboardGrid();
    }
};

// ============================================
// TRANSACTION PROCESSING
// ============================================

/**
 * Complete checkout and save transaction
 * 
 * Flow:
 * 1. Validate cart is not empty
 * 2. Calculate total price
 * 3. Create transaction record with timestamp
 * 4. Save to localStorage for persistence
 * 5. Clear cart and update analytics
 * 
 * Design decision: Using localStorage instead of backend
 * to keep project simple and demonstrate client-side state management
 */
LumeTerminal.actions.completeTransaction = function() {
    try {
        // Validate cart exists and has items
        if (!LumeTerminal.state.cart || LumeTerminal.state.cart.length === 0) {
            showToast('Cart is empty.', { variant: 'info' });
            return;
        }

        // Calculate total: price × quantity for each item
        const total = LumeTerminal.state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Create transaction record with metadata
        const itemsSnapshot = LumeTerminal.state.cart.map(i => ({
            id: i.id,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            img: i.img
        }));

        const transaction = {
            id: (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
                ? globalThis.crypto.randomUUID()
                : `${Date.now()}_${Math.random().toString(16).slice(2)}`,
            user: (LumeTerminal.ui?.auth?.getCurrentUser && LumeTerminal.ui.auth.getCurrentUser()) || 'staff',
            createdAt: new Date().toISOString(),
            name: `${LumeTerminal.state.cart.length} items purchased`,
            price: total,
            time: new Date().toLocaleTimeString(),
            date: new Date().toLocaleDateString(),
            deviceId: String(LumeTerminal.state?.deviceId || ''),
            syncStatus: navigator.onLine ? 'synced' : 'pending',
            items: itemsSnapshot
        };

        // Persist locally (offline-first)
        LumeTerminal.state.sales.push(transaction);

        localStorage.setItem(SALES_KEY, JSON.stringify(LumeTerminal.state.sales));

        // If offline, also queue for "sync" (demo outbox)
        if (!navigator.onLine) {
            const existing = safeJsonParse(localStorage.getItem(OUTBOX_KEY), []);
            const outbox = Array.isArray(existing) ? existing : [];
            outbox.push({ id: transaction.id, createdAt: new Date().toISOString(), deviceId: transaction.deviceId });
            localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
        } else {
            localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
        }

        updateSyncStatusUI();

        // Clear cart after successful transaction
        LumeTerminal.state.cart = [];
        LumeTerminal.ui.updateCartUI();
        LumeTerminal.ui.toggleCart();

        // Update analytics dashboard with new transaction data
        if (typeof LumeTerminal.ui.renderOperations === 'function') {
            LumeTerminal.ui.renderOperations();
        }
        if (typeof LumeTerminal.ui.renderAnalytics === 'function') {
            LumeTerminal.ui.renderAnalytics();
        }

        showToast(
            navigator.onLine ? 'Transaction completed successfully.' : 'Saved offline (pending sync).',
            { variant: 'success' }
        );
    } catch (error) {
        console.error('Error completing transaction:', error);
        showToast('Could not complete transaction.', { variant: 'error' });
    }
};

// ============================================
// CART UTILITIES
// ============================================

/**
 * Clear all items from cart
 */
LumeTerminal.actions.clearCart = function() {
    try {
        if (!Array.isArray(LumeTerminal.state.cart) || LumeTerminal.state.cart.length === 0) return;

        LumeTerminal.state.cart = [];
        if (LumeTerminal.ui?.updateCartUI) LumeTerminal.ui.updateCartUI();

        // Optional: small feedback on the badge
        const badge = document.getElementById('cart-count-badge');
        if (badge && badge.classList) {
            badge.classList.remove('cart-badge-bump');
            void badge.offsetWidth;
            badge.classList.add('cart-badge-bump');
            setTimeout(() => badge.classList.remove('cart-badge-bump'), 450);
        }

        // Hide search suggestions if open (keeps UI tidy)
        const suggestionsBox = document.getElementById('search-suggestions');
        if (suggestionsBox && !suggestionsBox.classList.contains('hidden')) {
            suggestionsBox.classList.add('hidden');
            suggestionsBox.innerHTML = '';
        }
    } catch (error) {
        console.error('Error clearing cart:', error);
    }
};

// ============================================
// BARCODE SCANNER (Camera Integration)
// ============================================

/**
 * Scanner module: real barcode scanning via html5-qrcode
 * - Full-screen modal with green focus frame
 * - Sidebar closes when scanner opens
 * - Add to cart only when a barcode is decoded (no random items)
 * - Done button at bottom to close
 */
const scannerActions = {
    html5QrCode: null,
    lastScannedAt: 0,
    scanCooldownMs: 1800,
    currentFacingMode: 'environment',

    beep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 800;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.12);
        } catch (_) {}
    },

    findProductByBarcode(decodedText) {
        const t = String(decodedText || '').trim();
        if (!t) return null;
        const inv = LumeTerminal.state.inventory || [];
        return inv.find(item => (item.barcode && String(item.barcode) === t) || String(item.id) === t) || null;
    },

    async openScanner() {
        const cameraUI = document.getElementById('camera-module');
        const readerEl = document.getElementById('barcode-reader');
        const closeBtn = document.getElementById('scanner-close-btn');

        if (!cameraUI || !readerEl) {
            console.error('Scanner UI elements not found');
            return;
        }

        document.body.classList.remove('sidebar-open', 'cart-open');
        cameraUI.classList.remove('hidden');
        LumeTerminal.actions.isScanning = true;

        if (LumeTerminal.ui?.rememberFocus) LumeTerminal.ui.rememberFocus('scanner');
        queueMicrotask(() => { if (closeBtn) closeBtn.focus(); else cameraUI.focus(); });

        try {
            if (this.html5QrCode && this.html5QrCode.isScanning) {
                await this.html5QrCode.stop();
            }
            if (!this.html5QrCode) this.html5QrCode = new Html5Qrcode('barcode-reader');

            const self = this;
            await this.html5QrCode.start(
                { facingMode: this.currentFacingMode },
                { fps: 8, qrbox: { width: 220, height: 120 } },
                (decodedText) => {
                    if (!LumeTerminal.actions.isScanning) return;
                    const now = Date.now();
                    if (now - self.lastScannedAt < self.scanCooldownMs) return;
                    const product = self.findProductByBarcode(decodedText);
                    if (product) {
                        self.lastScannedAt = now;
                        LumeTerminal.actions.addToCart(product.id);
                        self.beep();
                        const counter = document.getElementById('scan-counter');
                        if (counter) counter.textContent = 'In cart: ' + (LumeTerminal.state.cart.reduce((s, i) => s + i.quantity, 0));
                    }
                },
                () => {}
            );
        } catch (err) {
            showToast('Camera error: ' + (err.message || err), { variant: 'error', duration: 6000 });
            LumeTerminal.actions.finishScanning();
        }
    },

    switchCamera() {
        this.currentFacingMode = this.currentFacingMode === 'environment' ? 'user' : 'environment';
        this.openScanner();
    },

    async finishScanning() {
        LumeTerminal.actions.isScanning = false;
        if (this.html5QrCode && this.html5QrCode.isScanning) {
            try { await this.html5QrCode.stop(); } catch (_) {}
        }
        const cameraUI = document.getElementById('camera-module');
        if (cameraUI) cameraUI.classList.add('hidden');
        if (LumeTerminal.ui?.restoreFocus) LumeTerminal.ui.restoreFocus('scanner');
    }
};

// ============================================
// UI CLOSE HANDLERS
// ============================================

/**
 * Close all open panels (sidebar, cart, scanner)
 * 
 * Use cases:
 * - ESC key press
 * - Click outside panels
 * - Programmatic cleanup
 */
LumeTerminal.actions.closeAll = function() {
    try {
        if (LumeTerminal.ui?.closeClearCartModal) {
            LumeTerminal.ui.closeClearCartModal();
        }

        const wasCartOpen = document.body.classList.contains('cart-open');
        // Remove CSS classes that control panel visibility
        document.body.classList.remove('sidebar-open');

        // Close cart via UI helper (handles focus + hidden class)
        if (wasCartOpen && LumeTerminal.ui && typeof LumeTerminal.ui.toggleCart === 'function') {
            LumeTerminal.ui.toggleCart();
        } else {
            document.body.classList.remove('cart-open');
        }

        // Stop scanner if active
        if (LumeTerminal.actions.isScanning) {
            scannerActions.finishScanning();
        }

        // Ensure cart panel is hidden if not open (fallback)
        setTimeout(() => {
            const cartPanel = document.getElementById('cart-panel');
            if (cartPanel && !document.body.classList.contains('cart-open')) cartPanel.classList.add('hidden');
        }, 550);
    } catch (error) {
        console.error('Error closing all panels:', error);
    }
};

// Merge scanner methods into main actions object
Object.assign(LumeTerminal.actions, scannerActions);

// ============================================
// KEYBOARD & CLICK HANDLERS
// ============================================

/**
 * Global ESC key handler for closing panels
 * Improves UX: users expect ESC to close overlays
 */
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const clearModal = document.getElementById('clear-cart-modal');
        if (clearModal && !clearModal.classList.contains('hidden')) {
            LumeTerminal.ui.closeClearCartModal();
            e.preventDefault();
            return;
        }
        const suggestionsBox = document.getElementById('search-suggestions');
        if (suggestionsBox && !suggestionsBox.classList.contains('hidden')) {
            suggestionsBox.classList.add('hidden');
            suggestionsBox.innerHTML = '';
            LumeTerminal.actions._searchListActiveIndex = -1;
            const inp = document.getElementById('inventory-search');
            if (inp) inp.removeAttribute('aria-activedescendant');
            e.preventDefault();
            return;
        }
        LumeTerminal.actions.closeAll();
    }
});

/**
 * Click-outside handler to close panels
 * 
 * Implementation:
 * - Check if click target is inside cart/sidebar/triggers
 * - If outside, close all panels
 * - Prevents accidental closes when clicking panel content
 */
document.addEventListener('mousedown', (e) => {
    // Search suggestions: click-outside should hide dropdown
    const suggestionsBox = document.getElementById('search-suggestions');
    const searchInput = document.getElementById('inventory-search');
    if (suggestionsBox && searchInput && !suggestionsBox.classList.contains('hidden')) {
        const clickedInsideSuggestions = suggestionsBox.contains(e.target);
        const clickedInsideInput = searchInput.contains(e.target);
        if (!clickedInsideSuggestions && !clickedInsideInput) {
            suggestionsBox.classList.add('hidden');
            suggestionsBox.innerHTML = '';
        }
    }

    const cart = document.getElementById('cart-panel');
    const sidebar = document.querySelector('.sidebar');
    const burger = document.querySelector('.burger-btn');
    const cartTrigger = document.getElementById('cart-trigger');

    // Only run if panels are open
    if (document.body.classList.contains('cart-open') || document.body.classList.contains('sidebar-open')) {
        // Check if click is outside all panel-related elements
        if (!cart.contains(e.target) && !sidebar.contains(e.target) && !burger.contains(e.target) && !cartTrigger.contains(e.target)) {
            LumeTerminal.actions.closeAll();
        }
    }
});
