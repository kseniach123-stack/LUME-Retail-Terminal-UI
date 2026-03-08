// ============================================
// CART MANAGEMENT
// ============================================

// Track scanner state globally to prevent duplicate scans
LumeTerminal.actions.isScanning = false;

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
LumeTerminal.actions.addToCart = function(itemId) {
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
    
    // Null check for DOM element
    if (!suggestionsBox) {
        console.warn('Search suggestions box not found');
        return;
    }
    
    const searchTerm = query.toLowerCase().trim();

    // Hide suggestions if search is empty
    if (searchTerm.length === 0) {
        suggestionsBox.classList.add('hidden');
        suggestionsBox.innerHTML = '';
        return;
    }

    // Filter inventory by partial name match
    const matches = LumeTerminal.state.inventory.filter(item =>
        item.name.toLowerCase().includes(searchTerm)
    );

    if (matches.length > 0) {
        // Show dropdown with matching products
        suggestionsBox.classList.remove('hidden');
        suggestionsBox.innerHTML = matches.map(item => `
            <div class="suggestion-item"
                 onclick="LumeTerminal.actions.addToCart(${item.id}); document.getElementById('inventory-search').value=''; document.getElementById('search-suggestions').classList.add('hidden');">
                <img src="${item.img}" alt="${item.name}">
                <div class="suggestion-item-content">
                    <div class="suggestion-item-name">${item.name}</div>
                    <div class="suggestion-item-price">£${item.price.toFixed(2)}</div>
                </div>
                <span>+</span>
            </div>
        `).join('');
    } else {
        // Show "no results" message
        suggestionsBox.innerHTML = '<div style="padding: 15px; color: #888; font-size: 0.8rem;">No products found</div>';
        suggestionsBox.classList.remove('hidden');
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
            alert('Cart is empty!');
            return;
        }

        // Calculate total: price × quantity for each item
        const total = LumeTerminal.state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Create transaction record with metadata
        const transaction = {
            name: `${LumeTerminal.state.cart.length} items purchased`,
            price: total,
            time: new Date().toLocaleTimeString(),
            date: new Date().toLocaleDateString()
        };

        // Persist to localStorage for offline functionality
        LumeTerminal.state.sales.push(transaction);
        localStorage.setItem('lume_vault', JSON.stringify(LumeTerminal.state.sales));

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

        alert('Transaction completed successfully!');
    } catch (error) {
        console.error('Error completing transaction:', error);
        alert('Error completing transaction');
    }
};

// ============================================
// BARCODE SCANNER (Camera Integration)
// ============================================

/**
 * Scanner module using Web APIs
 * 
 * Technical decisions:
 * - MediaDevices API for camera access
 * - Simulated barcode scanning (real implementation would use ML library)
 * - Web Audio API for beep feedback (no external audio files needed)
 * - Support for front/back camera switching
 */
const scannerActions = {
    scanInterval: null,
    stream: null,
    currentFacingMode: 'environment', // 'environment' = back camera, 'user' = front camera

    /**
     * Open camera and start scanning
     * 
     * Challenges solved:
     * - Handle permission denials gracefully
     * - Stop previous stream before starting new one (prevents memory leaks)
     * - Use 'playsinline' attribute for iOS compatibility
     */
    async openScanner() {
        const video = document.getElementById('video-feed');
        const cameraUI = document.getElementById('camera-module');
        
        // Null checks for DOM elements
        if (!video || !cameraUI) {
            console.error('Scanner UI elements not found');
            return;
        }
        
        // Stop existing stream to prevent multiple camera instances
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        try {
            // Request camera with HD resolution and specified facing mode
            const constraints = { 
                video: { 
                    facingMode: this.currentFacingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = this.stream;
            video.setAttribute("playsinline", true); // Critical for iOS Safari
            video.play();

            cameraUI.classList.remove('hidden');
            LumeTerminal.actions.isScanning = true;

            // Start simulated scanning loop
            if (!this.scanInterval) {
                this.startScanningLoop();
            }
        } catch (err) { 
            // Handle permission denial or camera unavailable
            alert("Camera Access Error: " + err.message); 
        }
    },

    /**
     * Toggle between front and back camera
     * 
     * Implementation: Restart scanner with new facing mode
     */
    switchCamera() {
        this.currentFacingMode = (this.currentFacingMode === "environment") ? "user" : "environment";
        this.openScanner(); // Re-initialize with new camera
    },

    /**
     * Simulated barcode scanning loop
     * 
     * NOTE: Real implementation would use:
     * - ML library (e.g., ZXing, Quagga.js) for actual barcode detection
     * - Canvas element to capture video frames
     * - Image processing to detect barcode patterns
     * 
     * Current implementation: Random item selection every 2.5s for demo purposes
     * 
     * Audio feedback: Web Audio API (no external files needed)
     * - Creates sine wave oscillator at 800Hz
     * - 0.1s duration with exponential fade-out
     * - Fallback: Silent fail if AudioContext unavailable
     */
    startScanningLoop() {
        this.scanInterval = setInterval(() => {
            if (!LumeTerminal.actions.isScanning) return;

            const inventory = LumeTerminal.state.inventory;
            if (!inventory || inventory.length === 0) return;

            // Simulate barcode scan: pick random item
            const randomItem = inventory[Math.floor(Math.random() * inventory.length)];
            LumeTerminal.actions.addToCart(randomItem.id);

            // Generate beep sound using Web Audio API (no external files)
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = 800; // 800Hz frequency
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.1);
            } catch (e) {
                // Silent fail if audio unavailable (e.g., unsupported browser)
                console.warn('Audio playback not available');
            }

            // Visual feedback: flash counter
            const counter = document.getElementById('scan-counter');
            if (counter) {
                counter.innerText = "Items in cart: " + LumeTerminal.state.cart.length;
                counter.classList.add('scan-counter-active');
                setTimeout(() => {
                    counter.classList.remove('scan-counter-active');
                }, 200);
            }
        }, 2500); // Scan every 2.5 seconds
    },

    /**
     * Clean up scanner resources
     * 
     * Critical for performance:
     * - Clear interval to stop scanning loop
     * - Stop media stream tracks to release camera
     * - Remove video source to free memory
     */
    finishScanning() {
        LumeTerminal.actions.isScanning = false; 
        
        // Stop scanning loop
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
        
        // Release camera hardware
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        // Clear video element
        const video = document.getElementById('video-feed');
        if (video) video.srcObject = null;
        
        // Hide camera UI
        const cameraUI = document.getElementById('camera-module');
        if (cameraUI) cameraUI.classList.add('hidden');
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
        // Remove CSS classes that control panel visibility
        document.body.classList.remove('sidebar-open', 'cart-open');

        // Stop scanner if active
        if (LumeTerminal.actions.isScanning) {
            scannerActions.finishScanning();
        }

        // Delay cart hide to allow CSS transition to complete
        setTimeout(() => {
            const cartPanel = document.getElementById('cart-panel');
            if (cartPanel && !document.body.classList.contains('cart-open')) {
                cartPanel.classList.add('hidden');
            }
        }, 500); // Match CSS transition duration
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
    if (e.key === 'Escape') LumeTerminal.actions.closeAll();
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
