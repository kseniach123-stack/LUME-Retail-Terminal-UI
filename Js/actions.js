LumeTerminal.actions.isScanning = false;

LumeTerminal.actions.addToCart = function(itemId) {
    try {
        if (!LumeTerminal.state || !LumeTerminal.state.inventory) {
            console.error('Invalid state or inventory');
            return;
        }

        const item = LumeTerminal.state.inventory.find(i => i.id === itemId);
        if (!item) {
            console.warn(`Item with ID ${itemId} not found`);
            return;
        }

        const cartItem = LumeTerminal.state.cart.find(i => i.id === itemId);
        if (cartItem) {
            cartItem.quantity++;
        } else {
            LumeTerminal.state.cart.push({ ...item, quantity: 1 });
        }

        LumeTerminal.ui.updateCartUI();
    } catch (error) {
        console.error('Error adding item to cart:', error);
    }
};

LumeTerminal.actions.search = function(query) {
    const suggestionsBox = document.getElementById('search-suggestions');
    const searchTerm = query.toLowerCase().trim();

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
        suggestionsBox.innerHTML = '<div style="padding: 15px; color: #888; font-size: 0.8rem;">No products found</div>';
        suggestionsBox.classList.remove('hidden');
    }
};

LumeTerminal.actions.completeTransaction = function() {
    try {
        if (!LumeTerminal.state.cart || LumeTerminal.state.cart.length === 0) {
            alert('Cart is empty!');
            return;
        }

        const total = LumeTerminal.state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const transaction = {
            name: `${LumeTerminal.state.cart.length} items purchased`,
            price: total,
            time: new Date().toLocaleTimeString(),
            date: new Date().toLocaleDateString()
        };

        LumeTerminal.state.sales.push(transaction);
        localStorage.setItem('lume_vault', JSON.stringify(LumeTerminal.state.sales));

        LumeTerminal.state.cart = [];
        LumeTerminal.ui.updateCartUI();
        LumeTerminal.ui.toggleCart();

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

const scannerActions = {
    scanInterval: null,
    stream: null,
    currentFacingMode: 'environment', 

    async openScanner() {
        const video = document.getElementById('video-feed');
        const cameraUI = document.getElementById('camera-module');
        
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        try {
            const constraints = { 
                video: { 
                    facingMode: this.currentFacingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = this.stream;
            video.setAttribute("playsinline", true); 
            video.play();

            cameraUI.classList.remove('hidden');
            LumeTerminal.actions.isScanning = true;

            
            if (!this.scanInterval) {
                this.startScanningLoop();
            }
        } catch (err) { 
            alert("Camera Access Error: " + err.message); 
        }
    },

    switchCamera() {
        this.currentFacingMode = (this.currentFacingMode === "environment") ? "user" : "environment";
        this.openScanner(); 
    },

    startScanningLoop() {
        this.scanInterval = setInterval(() => {
            if (!LumeTerminal.actions.isScanning) return;

            const inventory = LumeTerminal.state.inventory;
            if (!inventory || inventory.length === 0) return;

            const randomItem = inventory[Math.floor(Math.random() * inventory.length)];
            LumeTerminal.actions.addToCart(randomItem.id);

            // Play beep sound using Web Audio API
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = 800;
                oscillator.type = 'sine';
                gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.1);
            } catch (e) {
                console.warn('Audio playback not available');
            }

            const counter = document.getElementById('scan-counter');
            if (counter) {
                counter.innerText = "Items in cart: " + LumeTerminal.state.cart.length;
                counter.classList.add('scan-counter-active');
                setTimeout(() => {
                    counter.classList.remove('scan-counter-active');
                }, 200);
            }
        }, 2500);
    },

    finishScanning() {
        LumeTerminal.actions.isScanning = false; 
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        const video = document.getElementById('video-feed');
        if (video) video.srcObject = null;
        document.getElementById('camera-module').classList.add('hidden');
    }
};

LumeTerminal.actions.closeAll = function() {
    try {
        document.body.classList.remove('sidebar-open', 'cart-open');

        if (LumeTerminal.actions.isScanning) {
            scannerActions.finishScanning();
        }

        setTimeout(() => {
            const cartPanel = document.getElementById('cart-panel');
            if (cartPanel && !document.body.classList.contains('cart-open')) {
                cartPanel.classList.add('hidden');
            }
        }, 500);
    } catch (error) {
        console.error('Error closing all panels:', error);
    }
};

Object.assign(LumeTerminal.actions, scannerActions);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') LumeTerminal.actions.closeAll();
});
document.addEventListener('mousedown', (e) => {
    const cart = document.getElementById('cart-panel');
    const sidebar = document.querySelector('.sidebar');
    const burger = document.querySelector('.burger-btn');
    const cartTrigger = document.getElementById('cart-trigger');

    if (document.body.classList.contains('cart-open') || document.body.classList.contains('sidebar-open')) {
        if (!cart.contains(e.target) && !sidebar.contains(e.target) && !burger.contains(e.target) && !cartTrigger.contains(e.target)) {
            LumeTerminal.actions.closeAll();
        }
    }
});
