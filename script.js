// Import Firebase functions
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, doc, setDoc, getDocs, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// --- FIREBASE SETUP ---
const firebaseConfig = {
    apiKey: "AIzaSyCJnref7x3qqdtlFGtt-c6lZjUcmlfYK0I",
    authDomain: "herbal-pansar.firebaseapp.com",
    projectId: "herbal-pansar",
    storageBucket: "herbal-pansar.appspot.com",
    messagingSenderId: "983071124936",
    appId: "1:983071124936:web:48a7cdd989a0d94d77e4fd",
    measurementId: "G-CR0L1L84WP"
};

// Initialize Firebase and Services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- PERFORMANCE OPTIMIZATIONS ---
// Debounce function for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Document fragment for better DOM performance
function createDocumentFragment() {
    return document.createDocumentFragment();
}

// --- STATE MANAGEMENT ---
let allProducts = [];
let cart = [];
let lastViewedCategory = 'home';
let currentUser = null;
let desktopSlideIndex = 1;
let desktopSlideInterval;
let mobileSlideIndex = 0;
let lastScrollY = 0;
let tooltipShown = false; // Track if appointment tooltip has been shown

// --- CACHED DOM ELEMENTS ---
const elements = {
    pages: document.querySelectorAll('.page'),
    cartTotalHeaderEl: document.getElementById('cart-total-header'),
    cartItemCountBadgeEl: document.querySelector('.cart-item-count-badge'),
    cartViewContainerEl: document.getElementById('cart-view-container'),
    checkoutFormEl: document.getElementById('checkout-form-element'),
    productDetailContentEl: document.getElementById('product-detail-content'),
    searchInputEl: document.getElementById('search-input'),
    mobileSearchInputEl: document.getElementById('mobile-search-input'),
    authControlsEl: document.getElementById('auth-controls'),
    loginFormEl: document.getElementById('login-form'),
    signupFormEl: document.getElementById('signup-form'),
    ordersListEl: document.getElementById('orders-list'),
    appointmentsListEl: document.getElementById('appointments-list'),
    addProductFormEl: document.getElementById('add-product-form'),
    appointmentFormEl: document.getElementById('appointment-form'),
    modalEl: document.getElementById('custom-modal'),
    modalMessageEl: document.getElementById('modal-message'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    mainHeader: document.getElementById('main-header'),
    mobileSearchOverlay: document.getElementById('mobile-search-overlay'),
    mobileMenuOverlay: document.getElementById('mobile-menu-overlay'),
    mobileMenuSidebar: document.getElementById('mobile-menu-sidebar'),
    appointmentTooltip: document.getElementById('appointment-tooltip')
};

// --- APPOINTMENT TOOLTIP FUNCTIONS ---
function showAppointmentTooltip() {
    if (!tooltipShown && elements.appointmentTooltip) {
        elements.appointmentTooltip.classList.add('show');
        tooltipShown = true;
        
        // Auto-hide after 8 seconds
        setTimeout(() => {
            if (elements.appointmentTooltip.classList.contains('show')) {
                closeAppointmentTooltip();
            }
        }, 8000);
    }
}

window.closeAppointmentTooltip = function() {
    if (elements.appointmentTooltip) {
        elements.appointmentTooltip.classList.remove('show');
        // Mark as permanently dismissed
        localStorage.setItem('appointmentTooltipDismissed', 'true');
    }
}

// Check if tooltip should be shown on page load
function checkAppointmentTooltip() {
    const dismissed = localStorage.getItem('appointmentTooltipDismissed');
    if (!dismissed) {
        // Show tooltip after 3 seconds on page load
        setTimeout(() => {
            showAppointmentTooltip();
        }, 3000);
    }
}

// --- MOBILE FUNCTIONALITY ---
// Mobile header scroll behavior with requestAnimationFrame for better performance
function handleScroll() {
    if (window.innerWidth <= 768) {
        requestAnimationFrame(() => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY && currentScrollY > 100) {
                elements.mainHeader.classList.add('hidden-mobile');
            } else {
                elements.mainHeader.classList.remove('hidden-mobile');
            }
            lastScrollY = currentScrollY;
        });
    }
}

// Mobile search functions
window.openMobileSearch = function () {
    elements.mobileSearchOverlay.style.display = 'block';
    elements.mobileSearchInputEl.focus();
}

window.closeMobileSearch = function () {
    elements.mobileSearchOverlay.style.display = 'none';
    elements.mobileSearchInputEl.value = '';
    document.getElementById('mobile-search-results-grid').innerHTML = '';
}

// Mobile menu functions
window.openMobileMenu = function () {
    elements.mobileMenuOverlay.style.display = 'block';
    setTimeout(() => {
        elements.mobileMenuSidebar.classList.add('open');
    }, 10);
}

window.closeMobileMenu = function () {
    elements.mobileMenuSidebar.classList.remove('open');
    setTimeout(() => {
        elements.mobileMenuOverlay.style.display = 'none';
    }, 300);
}

// Optimized mobile search with debouncing
const handleMobileSearch = debounce(() => {
    const query = elements.mobileSearchInputEl.value.toLowerCase().trim();
    const resultsGrid = document.getElementById('mobile-search-results-grid');

    if (query.length === 0) {
        resultsGrid.innerHTML = '';
        return;
    }

    const results = allProducts.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
    );

    renderProducts(results, 'mobile-search-results-grid');
}, 300);

// --- APPOINTMENT FUNCTIONS ---
// Set minimum date to tomorrow
function setMinimumAppointmentDate() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];
    document.getElementById('appointment-date').setAttribute('min', minDate);
}

// Render appointments in admin panel
function renderAppointments(appointments) {
    if (!elements.appointmentsListEl) return;
    
    if (appointments.length === 0) {
        elements.appointmentsListEl.innerHTML = '<p>No appointments booked yet.</p>';
        return;
    }

    // Sort appointments by date and time
    appointments.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA - dateB;
    });

    const fragment = createDocumentFragment();
    appointments.forEach(appointment => {
        const appointmentElement = document.createElement('div');
        appointmentElement.className = 'appointment-record';
        
        const appointmentDate = new Date(`${appointment.date}T${appointment.time}`);
        const formattedDate = appointmentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = appointmentDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const status = appointment.status || 'pending';

        appointmentElement.innerHTML = `
            <h4>Appointment with: ${appointment.name}</h4>
            <p><strong>Date & Time:</strong> ${formattedDate} at ${formattedTime}</p>
            <p><strong>Phone:</strong> ${appointment.phone}</p>
            ${appointment.email ? `<p><strong>Email:</strong> ${appointment.email}</p>` : ''}
            ${appointment.concern ? `<p><strong>Health Concern:</strong> ${appointment.concern}</p>` : ''}
            <p><strong>Booking ID:</strong> ${appointment.id}</p>
            <p><strong>Booked on:</strong> ${new Date(appointment.createdAt).toLocaleDateString()}</p>
            <p><strong>Status:</strong> <span class="appointment-status ${status}">${status}</span></p>
            <button 
                class="btn-fulfillment ${status === 'completed' ? 'fulfilled' : ''}" 
                data-appointment-id="${appointment.id}" 
                data-current-status="${status}"
                ${status === 'completed' ? 'disabled' : ''}>
                ${status === 'pending' ? 'Mark as Confirmed' : 
                  status === 'confirmed' ? 'Mark as Completed' : 
                  'Completed'}
            </button>
        `;
        
        fragment.appendChild(appointmentElement);
    });
    
    elements.appointmentsListEl.innerHTML = '';
    elements.appointmentsListEl.appendChild(fragment);
}

// --- OPTIMIZED RENDER FUNCTIONS ---
function renderAllGrids() {
    // Use requestIdleCallback for non-critical rendering
    const grids = [
        { products: allProducts, id: 'all-products-grid' },
        { products: allProducts.filter(p => p.category === 'dry-fruits'), id: 'dry-fruits-grid' },
        { products: allProducts.filter(p => p.category === 'herbal-tea'), id: 'herbal-tea-grid' },
        { products: allProducts.filter(p => p.category === 'honey'), id: 'honey-grid' },
        { products: allProducts.filter(p => p.category === 'seeds'), id: 'seeds-grid' },
        { products: allProducts.filter(p => p.category === 'supplements'), id: 'supplements-grid' },
        { products: allProducts.filter(p => p.category === 'capsules'), id: 'capsules-grid' },
        { products: allProducts.filter(p => p.category === 'cold-pressed-oil'), id: 'cold-pressed-oil-grid' },
        { products: allProducts.filter(p => p.category === 'essential-oils'), id: 'essential-oils-grid' },
        { products: allProducts.filter(p => p.category === 'deals'), id: 'deals-grid' }
    ];

    // Render critical grids first
    renderProducts(grids[0].products, grids[0].id);

    // Use requestIdleCallback for other grids
    if (window.requestIdleCallback) {
        window.requestIdleCallback(() => {
            grids.slice(1).forEach(grid => {
                renderProducts(grid.products, grid.id);
            });
        });
    } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
            grids.slice(1).forEach(grid => {
                renderProducts(grid.products, grid.id);
            });
        }, 0);
    }
}

function renderProducts(productsToRender, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (productsToRender.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #888; padding: 20px 0;">No products found in this category.</p>';
        return;
    }

    const fragment = createDocumentFragment();
    
    productsToRender.forEach(p => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <div class="product-image" onclick="showProductPage('${p.id}')">
                <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/ccc/ffffff?text=Image+Not+Found';">
            </div>
            <div class="product-info">
                <h3 onclick="showProductPage('${p.id}')">${p.name}</h3>
                <div class="product-price">
                    ${p.originalPrice ? `<span class="price-original">Rs.${p.originalPrice.toFixed(2)}</span>` : ''}
                    Rs.${p.price.toFixed(2)}
                </div>
                <div class="quantity-controls" data-product-id="${p.id}">
                    <button class="quantity-btn">-</button>
                    <input type="number" class="quantity-input" value="1" min="1">
                    <button class="quantity-btn">+</button>
                </div>
                <button class="btn-primary add-to-cart-btn" data-product-id="${p.id}">ADD TO CART</button>
            </div>
        `;
        fragment.appendChild(productCard);
    });
    
    container.innerHTML = '';
    container.appendChild(fragment);
}

function renderProductDetailPage(product) {
    if (!product) {
        elements.productDetailContentEl.innerHTML = '<p>Product not found.</p>';
        return;
    }
    
    elements.productDetailContentEl.innerHTML = `
        <a href="#" onclick="showPage(lastViewedCategory)" class="back-link">&larr; Back to products</a>
        <div class="product-detail-container">
            <div class="product-detail-image">
                <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/400x400/ccc/ffffff?text=Image+Not+Found';">
            </div>
            <div class="product-detail-info">
                <h1>${product.name}</h1>
                <div class="product-price">
                    ${product.originalPrice ? `<span class="price-original">Rs.${product.originalPrice.toFixed(2)}</span>` : ''}
                    Rs.${product.price.toFixed(2)}
                </div>
                <p>${product.description || 'No description available.'}</p>
                <div class="quantity-controls" data-product-id="${product.id}">
                    <button class="quantity-btn">-</button>
                    <input type="number" class="quantity-input" value="1" min="1">
                    <button class="quantity-btn">+</button>
                </div>
                <button class="btn-primary add-to-cart-btn" data-product-id="${product.id}" style="margin-top: 20px; width: auto;">ADD TO CART</button>
            </div>
        </div>
    `;
}

// Render admin products list for management
function renderAdminProductsList() {
    const adminProductsListEl = document.getElementById('admin-products-list');
    if (!adminProductsListEl) return;

    if (allProducts.length === 0) {
        adminProductsListEl.innerHTML = '<p>No products found.</p>';
        return;
    }

    const fragment = createDocumentFragment();
    allProducts.forEach(product => {
        const productItem = document.createElement('div');
        productItem.className = 'admin-product-item';
        productItem.innerHTML = `
            <div class="admin-product-info">
                <h4>${product.name}</h4>
                <p>Price: Rs.${product.price.toFixed(2)} | Category: ${product.category}</p>
                <p>ID: ${product.id}</p>
            </div>
            <div class="admin-product-actions">
                <button class="btn-delete" onclick="deleteProduct('${product.id}')">Delete</button>
            </div>
        `;
        fragment.appendChild(productItem);
    });
    
    adminProductsListEl.innerHTML = '';
    adminProductsListEl.appendChild(fragment);
}

// --- PAGE NAVIGATION ---
window.showPage = function (pageId) {
    // Use requestAnimationFrame for smoother transitions
    requestAnimationFrame(() => {
        elements.pages.forEach(page => page.classList.add('hidden'));
        const targetPage = document.getElementById(pageId + '-page');
        if (targetPage) {
            targetPage.classList.remove('hidden');
            if (!['cart', 'checkout', 'product-detail', 'order-success', 'login', 'admin', 'search-results', 'appointment'].includes(pageId)) {
                lastViewedCategory = pageId;
            }
        }
        window.scrollTo(0, 0);

        if (pageId === 'checkout') renderCheckoutPage();
        if (pageId === 'admin') renderAdminPanel();
        if (pageId === 'appointment') setMinimumAppointmentDate();

        // Close mobile overlays when navigating
        closeMobileSearch();
        closeMobileMenu();
        
        // Hide appointment tooltip when navigating to appointment page
        if (pageId === 'appointment') {
            closeAppointmentTooltip();
        }
    });
}

window.showProductPage = function (productId) {
    const product = allProducts.find(p => p.id === productId);
    renderProductDetailPage(product);
    showPage('product-detail');
}

// --- SLIDER LOGIC ---
// Desktop Slider
window.plusSlides = function (n) {
    showSlides(desktopSlideIndex += n);
    resetDesktopSlideInterval();
}

window.currentSlideDot = function (n) {
    showSlides(desktopSlideIndex = n);
    resetDesktopSlideInterval();
}

function showSlides(n) {
    const sliderEl = document.getElementById('desktop-slider');
    if (!sliderEl) return;

    const slides = sliderEl.getElementsByClassName("slide");
    const dots = sliderEl.getElementsByClassName("dot");
    if (slides.length === 0) return;

    if (n > slides.length) { desktopSlideIndex = 1 }
    if (n < 1) { desktopSlideIndex = slides.length }

    // Use forEach for better performance
    Array.from(slides).forEach(slide => slide.style.display = "none");
    Array.from(dots).forEach(dot => dot.classList.remove("active-dot"));
    
    slides[desktopSlideIndex - 1].style.display = "block";
    dots[desktopSlideIndex - 1].classList.add("active-dot");
}

function resetDesktopSlideInterval() {
    clearInterval(desktopSlideInterval);
    desktopSlideInterval = setInterval(() => plusSlides(1), 5000);
}

// Mobile Slider (Auto-rotating)
function rotateMobileSlides() {
    const sliderEl = document.getElementById('mobile-slider');
    if (!sliderEl) return;
    const slides = sliderEl.getElementsByClassName("slide");
    if (slides.length === 0) return;

    Array.from(slides).forEach(slide => slide.style.display = "none");
    mobileSlideIndex++;
    if (mobileSlideIndex > slides.length) { mobileSlideIndex = 1 }
    slides[mobileSlideIndex - 1].style.display = "block";
}

// --- CART LOGIC ---
function addToCart(productId, quantity) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({ ...product, quantity: quantity });
    }
    updateCartDisplay();
    showAlert(`${product.name} added to cart!`);
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartDisplay();
}

function updateCartDisplay() {
    renderCartPage();
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    elements.cartTotalHeaderEl.textContent = total.toFixed(2);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    elements.cartItemCountBadgeEl.textContent = totalItems;
}

function renderCartPage() {
    if (!elements.cartViewContainerEl) return;
    
    if (cart.length === 0) {
        elements.cartViewContainerEl.innerHTML = '<p class="cart-empty-message">Your cart is currently empty.</p>';
        return;
    }
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartItemsHtml = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-details">
                <div class="cart-item-image">
                    <img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/60x60/ccc/ffffff?text=N/A';">
                </div>
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p class="cart-item-price">Rs.${item.price.toFixed(2)} x ${item.quantity}</p>
                </div>
            </div>
            <div class="cart-item-actions">
                <strong>Rs.${(item.price * item.quantity).toFixed(2)}</strong>
                <button class="remove-from-cart-btn" data-product-id="${item.id}">Remove</button>
            </div>
        </div>
    `).join('');
    
    elements.cartViewContainerEl.innerHTML = `
        <div class="cart-container">
            <div class="cart-items">${cartItemsHtml}</div>
            <div class="cart-summary">
                <h3>Order Summary</h3>
                <p><span>Subtotal</span> <span>Rs.${total.toFixed(2)}</span></p>
                <p><span>Shipping</span> <span>${total >= 2000 ? 'Free' : 'Rs.200'}</span></p>
                <hr>
                <p class="total"><span>Total</span> <span>Rs.${(total + (total < 2000 ? 200 : 0)).toFixed(2)}</span></p>
                <button class="btn-primary" onclick="showPage('checkout')">Proceed to Checkout</button>
            </div>
        </div>
    `;
}

// --- CHECKOUT LOGIC ---
function renderCheckoutPage() {
    const guestEmailGroup = document.getElementById('guest-email-group');
    const emailInput = document.getElementById('email');

    if (!currentUser) {
        guestEmailGroup.classList.remove('hidden');
        emailInput.required = true;
    } else {
        guestEmailGroup.classList.add('hidden');
        emailInput.required = false;
    }

    const summaryContainer = document.getElementById('checkout-summary-container');
    if (!summaryContainer) return;
    
    if (cart.length === 0) {
        showAlert("Your cart is empty. Add items before checking out.");
        showPage('cart');
        return;
    }
    
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = subtotal >= 2000 ? 0 : 200;
    const total = subtotal + shipping;
    
    const summaryItemsHtml = cart.map(item => `
        <div class="summary-item">
            <span>${item.name} (x${item.quantity})</span>
            <span>Rs.${(item.price * item.quantity).toFixed(2)}</span>
        </div>
    `).join('');
    
    summaryContainer.innerHTML = `
        ${summaryItemsHtml}
        <div class="summary-item" style="margin-top: 10px;">
            <span>Subtotal</span>
            <span>Rs.${subtotal.toFixed(2)}</span>
        </div>
        <div class="summary-item">
            <span>Shipping</span>
            <span>Rs.${shipping.toFixed(2)}</span>
        </div>
        <div class="summary-total">
            <span>Total</span>
            <span>Rs.${total.toFixed(2)}</span>
        </div>
    `;
}

window.showPaymentContent = function (method) {
    document.querySelectorAll('.payment-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`${method}-content`).classList.remove('hidden');
    document.querySelectorAll('.payment-tab').forEach(el => el.classList.remove('active'));
    document.querySelector(`.payment-tab[onclick="showPaymentContent('${method}')"]`).classList.add('active');
}

// --- PRODUCT MANAGEMENT ---
window.deleteProduct = async function (productId) {
    if (!confirm('Are you sure you want to delete this product?')) {
        return;
    }

    try {
        await deleteDoc(doc(db, "products", productId));
        allProducts = allProducts.filter(p => p.id !== productId);
        renderAllGrids();
        renderAdminProductsList();
        showAlert("Product deleted successfully!");
    } catch (error) {
        console.error("Error deleting product: ", error);
        showAlert("Failed to delete product. Please try again.");
    }
}

// --- AUTHENTICATION & ADMIN (LOCAL STORAGE) ---
window.toggleAuthForms = function () {
    elements.loginFormEl.classList.toggle('hidden');
    elements.signupFormEl.classList.toggle('hidden');
    elements.loginFormEl.reset();
    elements.signupFormEl.reset();
}

function updateAuthControls() {
    if (currentUser) {
        let welcomeMessage = `Welcome, ${currentUser.name}`;
        if (currentUser.role === 'admin') {
            welcomeMessage += ` | <a href="#" onclick="showPage('admin')">Admin Panel</a>`;
        }
        welcomeMessage += ` | <a href="#" onclick="logout()">Logout</a>`;
        elements.authControlsEl.innerHTML = welcomeMessage;
    } else {
        elements.authControlsEl.innerHTML = `<a href="#" onclick="showPage('login')">Login</a>`;
    }
}

window.logout = function () {
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateAuthControls();
    showPage('home');
    showAlert("You have been logged out.");
}

function renderAdminPanel() {
    if (!currentUser || currentUser.role !== 'admin') {
        showAlert("You do not have permission to view this page.");
        showPage('home');
        return;
    }
    
    // Firestore listener for orders
    const ordersQuery = query(collection(db, "orders"));
    onSnapshot(ordersQuery, (querySnapshot) => {
        const orders = [];
        querySnapshot.forEach((doc) => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        renderOrders(orders);
    });

    // Firestore listener for appointments
    const appointmentsQuery = query(collection(db, "appointments"));
    onSnapshot(appointmentsQuery, (querySnapshot) => {
        const appointments = [];
        querySnapshot.forEach((doc) => {
            appointments.push({ id: doc.id, ...doc.data() });
        });
        renderAppointments(appointments);
    });

    // Render products list for management
    renderAdminProductsList();
}

window.showAdminContent = function (contentType) {
    document.querySelectorAll('.admin-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`admin-${contentType}-content`).classList.remove('hidden');
    document.querySelectorAll('.admin-tab').forEach(el => el.classList.remove('active'));
    document.querySelector(`.admin-tab[onclick="showAdminContent('${contentType}')"]`).classList.add('active');

    if (contentType === 'manage') {
        renderAdminProductsList();
    }
}

function renderOrders(orders) {
    if (orders.length === 0) {
        elements.ordersListEl.innerHTML = '<p>No orders received yet.</p>';
        return;
    }
    
    // Sort orders by date, newest first
    orders.sort((a, b) => new Date(b.date) - new Date(a.date));

    const fragment = createDocumentFragment();
    orders.forEach(order => {
        const orderElement = document.createElement('div');
        orderElement.className = 'order-record';
        
        const isFulfilled = order.status === 'fulfilled';
        let orderItemsHtml = '';
        if (order.items && Array.isArray(order.items)) {
            orderItemsHtml = order.items.map(item => `<li>${item.name} (x${item.quantity})</li>`).join('');
        }

        orderElement.innerHTML = `
            <h4>Order from: ${order.customer.name}</h4>
            <p><strong>Order ID:</strong> ${order.id}</p>
            <p><strong>Date:</strong> ${new Date(order.date).toLocaleString()}</p>
            <p><strong>Contact:</strong> ${order.customer.email} | ${order.customer.phone}</p>
            <p><strong>Address:</strong> ${order.customer.address}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
            <p><strong>Total:</strong> Rs. ${order.total.toFixed(2)}</p>
            <details>
                <summary>View Items (${order.items.length})</summary>
                <ul>${orderItemsHtml}</ul>
            </details>
            <button 
                class="btn-fulfillment ${isFulfilled ? 'fulfilled' : ''}" 
                data-order-id="${order.id}" 
                ${isFulfilled ? 'disabled' : ''}>
                ${isFulfilled ? 'Fulfilled' : 'Mark as Fulfilled'}
            </button>
        `;
        
        fragment.appendChild(orderElement);
    });
    
    elements.ordersListEl.innerHTML = '';
    elements.ordersListEl.appendChild(fragment);
}

// --- MODAL & SEARCH ---
function showAlert(message) {
    elements.modalMessageEl.textContent = message;
    elements.modalEl.classList.remove('hidden');
}

// Debounced search function for better performance
const handleSearch = debounce(() => {
    const query = elements.searchInputEl.value.toLowerCase().trim();
    if (query.length === 0) {
        showPage(lastViewedCategory || 'home');
        return;
    }
    
    const results = allProducts.filter(p => 
        p.name.toLowerCase().includes(query) || 
        p.description.toLowerCase().includes(query)
    );
    
    renderProducts(results, 'search-results-grid');
    showPage('search-results');
    document.getElementById('search-results-title').textContent = `Results for "${query}"`;
}, 300);

// --- OPTIMIZED EVENT LISTENERS ---
// Use event delegation for better performance
document.addEventListener('click', async function (e) {
    // Handle add to cart buttons
    if (e.target.classList.contains('add-to-cart-btn')) {
        const productId = e.target.dataset.productId;
        const controls = e.target.closest('.product-info, .product-detail-info');
        const quantity = parseInt(controls.querySelector('.quantity-input').value);
        addToCart(productId, quantity);
    }
    
    // Handle quantity buttons
    if (e.target.classList.contains('quantity-btn')) {
        const input = e.target.parentNode.querySelector('.quantity-input');
        let value = parseInt(input.value);
        if (e.target.textContent === '+') value++;
        else if (value > 1) value--;
        input.value = value;
    }
    
    // Handle remove from cart buttons
    if (e.target.classList.contains('remove-from-cart-btn')) {
        const productId = e.target.dataset.productId;
        removeFromCart(productId);
    }
    
    // Order fulfillment button listener
    if (e.target.classList.contains('btn-fulfillment') && !e.target.disabled && e.target.dataset.orderId) {
        const orderId = e.target.dataset.orderId;
        const orderRef = doc(db, "orders", orderId);
        try {
            await updateDoc(orderRef, { status: "fulfilled" });
            showAlert(`Order ${orderId} marked as fulfilled.`);
        } catch (error) {
            console.error("Error updating order status: ", error);
            showAlert("Failed to update order status.");
        }
    }
    
    // Appointment status button listener
    if (e.target.classList.contains('btn-fulfillment') && !e.target.disabled && e.target.dataset.appointmentId) {
        const appointmentId = e.target.dataset.appointmentId;
        const currentStatus = e.target.dataset.currentStatus;
        let newStatus;
        
        if (currentStatus === 'pending') {
            newStatus = 'confirmed';
        } else if (currentStatus === 'confirmed') {
            newStatus = 'completed';
        } else {
            return; // Already completed
        }

        const appointmentRef = doc(db, "appointments", appointmentId);
        try {
            await updateDoc(appointmentRef, { status: newStatus });
            showAlert(`Appointment ${appointmentId} marked as ${newStatus}.`);
        } catch (error) {
            console.error("Error updating appointment status: ", error);
            showAlert("Failed to update appointment status.");
        }
    }
});

// Close mobile overlays when clicking outside
elements.mobileSearchOverlay.addEventListener('click', (e) => {
    if (e.target === elements.mobileSearchOverlay) {
        closeMobileSearch();
    }
});

elements.mobileMenuOverlay.addEventListener('click', (e) => {
    if (e.target === elements.mobileMenuOverlay) {
        closeMobileMenu();
    }
});

// Modal event listeners
elements.modalCloseBtn.addEventListener('click', () => elements.modalEl.classList.add('hidden'));
elements.modalEl.addEventListener('click', (e) => { 
    if (e.target === elements.modalEl) elements.modalEl.classList.add('hidden'); 
});

// Search event listeners with debouncing
elements.searchInputEl.addEventListener('input', handleSearch);
elements.mobileSearchInputEl.addEventListener('input', handleMobileSearch);

// Add scroll listener for mobile header with throttling
let ticking = false;
function throttledScrollHandler() {
    if (!ticking) {
        requestAnimationFrame(() => {
            handleScroll();
            ticking = false;
        });
        ticking = true;
    }
}
window.addEventListener('scroll', throttledScrollHandler, { passive: true });

// Handle window resize
window.addEventListener('resize', debounce(() => {
    if (window.innerWidth > 768) {
        elements.mainHeader.classList.remove('hidden-mobile');
        closeMobileSearch();
        closeMobileMenu();
    }
}, 250));

// Form event listeners
elements.loginFormEl.addEventListener('submit', function (e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (email === 'admin@gmail.com' && password === 'admin123') {
        currentUser = { name: 'Admin', email: 'admin@gmail.com', role: 'admin' };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateAuthControls();
        showPage('admin');
        elements.loginFormEl.reset();
        return;
    }

    const users = JSON.parse(localStorage.getItem('users')) || [];
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateAuthControls();
        showPage('home');
        elements.loginFormEl.reset();
    } else {
        showAlert("Invalid email or password.");
    }
});

elements.signupFormEl.addEventListener('submit', function (e) {
    e.preventDefault();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    
    let users = JSON.parse(localStorage.getItem('users')) || [];
    if (users.some(u => u.email === email)) {
        showAlert("An account with this email already exists.");
        return;
    }
    
    const newUser = { name, email, password, role: 'customer' };
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    showAlert("Signup successful! Please login.");
    toggleAuthForms();
});

// Appointment form submission
elements.appointmentFormEl.addEventListener('submit', async function (e) {
    e.preventDefault();

    const formData = {
        name: document.getElementById('appointment-name').value,
        phone: document.getElementById('appointment-phone').value,
        email: document.getElementById('appointment-email').value,
        date: document.getElementById('appointment-date').value,
        time: document.getElementById('appointment-time').value,
        concern: document.getElementById('appointment-concern').value,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    // Validate date is not in the past
    const appointmentDateTime = new Date(`${formData.date}T${formData.time}`);
    const now = new Date();
    if (appointmentDateTime <= now) {
        showAlert("Please select a future date and time for your appointment.");
        return;
    }

    try {
        const docRef = await addDoc(collection(db, "appointments"), formData);
        showAlert(`Appointment booked successfully! Your booking reference is: ${docRef.id.substring(0, 8).toUpperCase()}`);
        elements.appointmentFormEl.reset();
        setMinimumAppointmentDate(); // Reset minimum date
        showPage('home');
    } catch (error) {
        console.error("Error booking appointment: ", error);
        showAlert("Failed to book appointment. Please try again.");
    }
});

elements.checkoutFormEl.addEventListener('submit', async function (e) {
    e.preventDefault();

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = subtotal >= 2000 ? 0 : 200;
    const total = subtotal + shipping;

    const newOrder = {
        date: new Date().toISOString(),
        customer: {
            name: document.getElementById('fullName').value,
            email: currentUser ? currentUser.email : document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            address: document.getElementById('address').value,
        },
        items: cart,
        paymentMethod: document.querySelector('.payment-tab.active').textContent,
        total: total,
        status: 'pending'
    };

    try {
        const docRef = await addDoc(collection(db, "orders"), newOrder);
        console.log("Order written with ID: ", docRef.id);
        showPage('order-success');
        cart = [];
        updateCartDisplay();
        elements.checkoutFormEl.reset();
    } catch (error) {
        console.error("Error adding order to Firestore: ", error);
        showAlert('There was a problem placing your order. Please try again.');
    }
});

elements.addProductFormEl.addEventListener('submit', async function (e) {
    e.preventDefault();
    const submitButton = elements.addProductFormEl.querySelector('button[type="submit"]');

    const name = document.getElementById('product-name').value;
    const price = parseFloat(document.getElementById('product-price').value);
    const category = document.getElementById('product-category').value;
    const description = document.getElementById('product-description').value;
    const imageFilename = document.getElementById('product-image-filename').value;

    if (!imageFilename) {
        showAlert("Please enter the image filename.");
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Adding...';

    try {
        const imageUrl = `images/${imageFilename}`;
        const newProduct = {
            id: String(Date.now()),
            name,
            price,
            category,
            description,
            image: imageUrl,
        };

        await setDoc(doc(db, "products", newProduct.id), newProduct);

        showAlert("Product added successfully!");
        allProducts.push(newProduct);
        renderAllGrids();
        renderAdminProductsList();
        elements.addProductFormEl.reset();
    } catch (error) {
        console.error("Error adding product: ", error);
        showAlert(`Failed to add product. Error: ${error.message}`);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Add Product';
    }
});

// --- INITIALIZATION ---
async function initializeStore() {
    // Load user from local storage
    try {
        const loggedInUser = JSON.parse(localStorage.getItem('currentUser'));
        if (loggedInUser) {
            currentUser = loggedInUser;
        }
    } catch (error) {
        console.error("Could not parse user from local storage:", error);
        localStorage.removeItem('currentUser');
    }
    updateAuthControls();

    // Fetch products from Firestore
    try {
        const productsCollection = collection(db, "products");
        const productSnapshot = await getDocs(productsCollection);

        if (productSnapshot.empty) {
            console.log("No products found in Firestore.");
            allProducts = [];
        } else {
            allProducts = productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
        renderAllGrids();
    } catch (error) {
        console.error("Error fetching products from Firestore: ", error);
        showAlert("Could not load products. Please check your connection and Firebase setup.");
    }

    // Initial UI setup
    updateCartDisplay();
    
    // Start Desktop Slider
    showSlides(desktopSlideIndex);
    resetDesktopSlideInterval();
    
    // Start Mobile Slider
    rotateMobileSlides();
    setInterval(rotateMobileSlides, 5000);
    
    // Check and show appointment tooltip
    checkAppointmentTooltip();
}

// Run the store on DOMContentLoaded for better performance
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeStore);
} else {
    initializeStore();
}
            