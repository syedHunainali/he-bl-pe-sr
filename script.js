// Import Firebase functions from the latest SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, doc, setDoc, getDocs, updateDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- FIREBASE SETUP ---
// Your provided Firebase config
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

// --- CONSTANTS ---
const DISCOUNT_RATE = 0.14; // 14% discount

// --- PERFORMANCE OPTIMIZATIONS ---
// Debounce function to limit the rate at which a function gets called.
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

// Function to create a document fragment for efficient DOM manipulation
function createDocumentFragment() {
    return document.createDocumentFragment();
}

// --- STATE MANAGEMENT ---
let allProducts = [];
let cart = [];
let customFormula = [];
let lastViewedCategory = 'home';
let currentUser = null;
let desktopSlideIndex = 1;
let desktopSlideInterval;
let mobileSlideIndex = 0;
let lastScrollY = 0;

// --- CACHED DOM ELEMENTS ---
// Caching DOM elements for faster access
const elements = {
    pages: document.querySelectorAll('.page'),
    cartTotalHeaderEl: document.getElementById('cart-total-header'),
    cartItemCountBadgeEl: document.querySelector('.cart-item-count-badge'),
    cartViewContainerEl: document.getElementById('cart-view-container'),
    checkoutFormEl: document.getElementById('checkout-form-element'),
    productDetailContentEl: document.getElementById('product-detail-content'),
    searchInputEl: document.getElementById('search-input'),
    mobileSearchInputEl: document.getElementById('mobile-search-input'),
    authControlsDesktopEl: document.getElementById('auth-controls-desktop'),
    authControlsMobileEl: document.getElementById('auth-controls-mobile'),
    loginFormEl: document.getElementById('login-form'),
    signupFormEl: document.getElementById('signup-form'),
    ordersListEl: document.getElementById('orders-list'),
    appointmentsListEl: document.getElementById('appointments-list'),
    addProductFormEl: document.getElementById('add-product-form'),
    appointmentFormEl: document.getElementById('appointment-form'),
    modalEl: document.getElementById('custom-modal'),
    modalMessageEl: document.getElementById('modal-message'),
    modalCloseBtn: document.getElementById('modal-close-btn'),
    confirmModalEl: document.getElementById('confirm-modal'),
    confirmMessageEl: document.getElementById('confirm-message'),
    confirmYesBtn: document.getElementById('confirm-yes-btn'),
    confirmNoBtn: document.getElementById('confirm-no-btn'),
    editProductModalEl: document.getElementById('edit-product-modal'),
    editProductFormEl: document.getElementById('edit-product-form'),
    editModalCloseBtn: document.getElementById('edit-modal-close-btn'),
    mainHeader: document.getElementById('main-header'),
    mobileSearchOverlay: document.getElementById('mobile-search-overlay'),
    mobileMenuOverlay: document.getElementById('mobile-menu-overlay'),
    mobileMenuSidebar: document.getElementById('mobile-menu-sidebar'),
    herbNameInput: document.getElementById('herb-name'),
    herbQuantityInput: document.getElementById('herb-quantity'),
    addHerbBtn: document.getElementById('add-herb-btn'),
    herbSuggestionsEl: document.getElementById('herb-suggestions'),
    formulaItemsListEl: document.getElementById('formula-items-list'),
    formulaTotalEl: document.getElementById('formula-total'),
    totalWeightEl: document.getElementById('total-weight'),
    totalPriceEl: document.getElementById('total-price'),
    addFormulaToCartBtn: document.getElementById('add-formula-to-cart-btn'),
    herbFormEl: document.getElementById('herb-form'),
    // Elements for bulk upload
    bulkAddFormEl: document.getElementById('bulk-add-form'),
    csvFileInputEl: document.getElementById('csv-file-input'),
    bulkUploadStatusEl: document.getElementById('bulk-upload-status'),
};

// --- MOBILE FUNCTIONALITY ---
// Hides header on scroll down on mobile for better visibility
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
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    elements.mobileSearchInputEl.focus();
}

window.closeMobileSearch = function () {
    elements.mobileSearchOverlay.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
    elements.mobileSearchInputEl.value = '';
    document.getElementById('mobile-search-results-grid').innerHTML = '';
}

// Mobile menu functions
window.openMobileMenu = function () {
    elements.mobileMenuOverlay.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
    setTimeout(() => {
        elements.mobileMenuSidebar.classList.add('open');
    }, 10);
}

window.closeMobileMenu = function () {
    elements.mobileMenuSidebar.classList.remove('open');
    document.body.style.overflow = ''; // Restore scrolling
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
// Set minimum appointment date to tomorrow to prevent booking for past dates
function setMinimumAppointmentDate() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];
    document.getElementById('appointment-date').setAttribute('min', minDate);
}

// Renders appointments in the admin panel
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
// Renders all product grids efficiently
function renderAllGrids() {
    const grids = [
        { products: allProducts, id: 'all-products-grid' },
        { products: allProducts.filter(p => p.category === 'dry-fruits'), id: 'dry-fruits-grid' },
        { products: allProducts.filter(p => p.category === 'herbal-tea'), id: 'herbal-tea-grid' },
        { products: allProducts.filter(p => p.category === 'honey'), id: 'honey-grid' },
        { products: allProducts.filter(p => p.category === 'seeds'), id: 'seeds-grid' },
        { products: allProducts.filter(p => p.category === 'supplements'), id: 'supplements-grid' },
        { products: allProducts.filter(p => p.category === 'cold-pressed-oil'), id: 'cold-pressed-oil-grid' },
        { products: allProducts.filter(p => p.category === 'essential-oils'), id: 'essential-oils-grid' },
        { products: allProducts.filter(p => p.category === 'herbs'), id: 'herbs-grid' }
    ];

    // Use requestIdleCallback for non-critical rendering to avoid blocking the main thread
    if (window.requestIdleCallback) {
        grids.forEach(grid => {
            window.requestIdleCallback(() => {
                renderProducts(grid.products, grid.id);
            });
        });
    } else {
        grids.forEach(grid => {
            setTimeout(() => renderProducts(grid.products, grid.id), 0);
        });
    }
}

// Renders a list of products into a specified container
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
        const weightDisplay = p.weight ? `<span class="product-weight">(${p.weight}g)</span>` : '';
        // Display original price and discounted sale price
        productCard.innerHTML = `
            <div class="product-image" onclick="showProductPage('${p.id}')">
                <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/ccc/ffffff?text=Image+Not+Found';">
                <div class="discount-badge">${(DISCOUNT_RATE * 100).toFixed(0)}% OFF</div>
            </div>
            <div class="product-info">
                <h3 onclick="showProductPage('${p.id}')">${p.name}${weightDisplay}</h3>
                <div class="product-price">
                    <span class="price-sale">Rs.${p.salePrice.toFixed(2)}</span>
                    <span class="price-original">Rs.${p.originalPrice.toFixed(2)}</span>
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

// Renders the product detail page
function renderProductDetailPage(product) {
    if (!product) {
        elements.productDetailContentEl.innerHTML = '<p>Product not found.</p>';
        return;
    }
    
    const weightDisplay = product.weight ? `<span class="product-weight">(${product.weight}g)</span>` : '';

    elements.productDetailContentEl.innerHTML = `
        <a href="#" onclick="showPage('home')" class="back-link">&larr; Back to Home</a>
        <div class="product-detail-container">
            <div class="product-detail-image">
                <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/400x400/ccc/ffffff?text=Image+Not+Found';">
            </div>
            <div class="product-detail-info">
                <h1>${product.name}${weightDisplay},</h1>
                <div class="product-price">
                     <span class="price-sale">Rs.${product.salePrice.toFixed(2)}</span>
                     <span class="price-original">Rs.${product.originalPrice.toFixed(2)}</span>
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

// Renders the list of products in the admin management panel
function renderAdminProductsList() {
    const adminProductsListEl = document.getElementById('admin-products-list');
    if (!adminProductsListEl) return;

    if (allProducts.length === 0) {
        adminProductsListEl.innerHTML = '<p>No products found.</p>';
        return;
    }

    const fragment = createDocumentFragment();
    allProducts.sort((a, b) => a.name.localeCompare(b.name)).forEach(product => {
        const productItem = document.createElement('div');
        productItem.className = 'admin-product-item';
        productItem.innerHTML = `
            <div class="admin-product-info">
                <img src="${product.image}" alt="${product.name}" class="admin-product-thumbnail" onerror="this.onerror=null;this.style.display='none';">
                <div>
                    <h4>${product.name}</h4>
                    <p>Price: Rs.${product.originalPrice.toFixed(2)} | Category: ${product.category}</p>
                    <p>ID: ${product.id}</p>
                </div>
            </div>
            <div class="admin-product-actions">
                <button class="btn-edit" data-product-id='${product.id}'>Edit</button>
                <button class="btn-delete" data-product-id="${product.id}">Delete</button>
            </div>
        `;
        fragment.appendChild(productItem);
    });
    
    adminProductsListEl.innerHTML = '';
    adminProductsListEl.appendChild(fragment);
}

// --- PAGE NAVIGATION ---
window.showPage = function (pageId) {
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

        closeMobileSearch();
        closeMobileMenu();
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
        // Add salePrice to the cart item
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
    // Use salePrice for cart total calculation
    const total = cart.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0);
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
    
    const total = cart.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0);
    const cartItemsHtml = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-details">
                <div class="cart-item-image">
                    <img src="${item.image}" alt="${item.name}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/60x60/ccc/ffffff?text=N/A';">
                </div>
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p class="cart-item-price">Rs.${item.salePrice.toFixed(2)} x ${item.quantity}</p>
                </div>
            </div>
            <div class="cart-item-actions">
                <strong>Rs.${(item.salePrice * item.quantity).toFixed(2)}</strong>
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
    
    const subtotal = cart.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0);
    const shipping = subtotal >= 2000 ? 0 : 200;
    const total = subtotal + shipping;
    
    const summaryItemsHtml = cart.map(item => `
        <div class="summary-item">
            <span>${item.name} (x${item.quantity})</span>
            <span>Rs.${(item.salePrice * item.quantity).toFixed(2)}</span>
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

// --- CUSTOM FORMULA LOGIC ---
function renderFormulaItems() {
    if (customFormula.length === 0) {
        elements.formulaItemsListEl.innerHTML = '<p>Your formula is empty.</p>';
        elements.formulaTotalEl.classList.add('hidden');
        return;
    }

    elements.formulaItemsListEl.innerHTML = '';
    let totalWeight = 0;
    let totalPrice = 0;

    customFormula.forEach((item, index) => {
        const formulaItemEl = document.createElement('div');
        formulaItemEl.className = 'formula-item';
        // Display a note for custom herbs with no price
        const priceNote = item.pricePerGram === 0 ? ' (Custom - Price TBD)' : '';
        formulaItemEl.innerHTML = `
            <span>${item.name} - ${item.quantity}g${priceNote}</span>
            <button class="remove-herb-btn" data-index="${index}">×</button>
        `;
        elements.formulaItemsListEl.appendChild(formulaItemEl);
        totalWeight += item.quantity;
        totalPrice += item.pricePerGram * item.quantity;
    });

    elements.totalWeightEl.textContent = totalWeight;
    elements.totalPriceEl.textContent = totalPrice.toFixed(2);
    elements.formulaTotalEl.classList.remove('hidden');
}

function addHerbToFormula() {
    const name = elements.herbNameInput.value.trim();
    const quantity = parseInt(elements.herbQuantityInput.value);

    if (!name || !(quantity > 0)) {
        showAlert('Please enter an herb name and a valid quantity.');
        return;
    }

    // Try to find the product in the store
    const herbProduct = allProducts.find(p => p.name.toLowerCase() === name.toLowerCase() && p.pricePerGram > 0);
    
    let pricePerGram = 0;
    let displayName = name;

    // If found, use its data. If not, it's a custom entry with price 0.
    if (herbProduct) {
        pricePerGram = herbProduct.pricePerGram;
        displayName = herbProduct.name; // Use the canonical name from the database
    }

    // Check if the herb (by its display name) is already in the formula
    const existingHerb = customFormula.find(item => item.name.toLowerCase() === displayName.toLowerCase());
    if (existingHerb) {
        existingHerb.quantity += quantity;
    } else {
        customFormula.push({
            name: displayName,
            quantity: quantity,
            pricePerGram: pricePerGram
        });
    }

    renderFormulaItems();
    // Reset inputs
    elements.herbNameInput.value = '';
    elements.herbQuantityInput.value = '10';
    elements.herbSuggestionsEl.innerHTML = '';
    elements.herbNameInput.focus();
}

function removeHerbFromFormula(index) {
    customFormula.splice(index, 1);
    renderFormulaItems();
}

function addFormulaToCart() {
    if (customFormula.length === 0) {
        showAlert('Your formula is empty.');
        return;
    }

    const selectedForm = elements.herbFormEl.value || 'Not Specified';
    const totalPrice = customFormula.reduce((sum, item) => sum + (item.pricePerGram * item.quantity), 0);
    
    // Create a detailed description for the order
    const description = `Form: ${selectedForm}. Ingredients: ` + customFormula.map(item => {
        const priceNote = item.pricePerGram === 0 ? ' (Custom/Price TBD)' : '';
        return `${item.name} (${item.quantity}g)${priceNote}`;
    }).join(', ');

    const formulaProduct = {
        id: `custom-formula-${Date.now()}`,
        name: `Custom Formula (${selectedForm})`,
        description: description,
        salePrice: totalPrice, // This is the calculated price, may be 0 if all herbs are custom
        originalPrice: totalPrice,
        quantity: 1,
        image: 'images/collection-5.png' // Generic image for custom formulas
    };

    cart.push(formulaProduct);
    updateCartDisplay();
    showAlert('Custom formula added to cart!');
    
    // Clear the formula builder
    customFormula = [];
    renderFormulaItems();
}

function showHerbSuggestions() {
    const input = elements.herbNameInput.value.toLowerCase();
    elements.herbSuggestionsEl.innerHTML = '';
    if (input.length === 0) {
        return;
    }

    const suggestions = allProducts.filter(p => p.pricePerGram > 0 && p.name.toLowerCase().startsWith(input));
    
    suggestions.forEach(suggestion => {
        const suggestionEl = document.createElement('div');
        suggestionEl.className = 'suggestion-item';
        suggestionEl.textContent = suggestion.name;
        suggestionEl.onclick = () => {
            elements.herbNameInput.value = suggestion.name;
            elements.herbSuggestionsEl.innerHTML = '';
        };
        elements.herbSuggestionsEl.appendChild(suggestionEl);
    });
}

// --- PRODUCT MANAGEMENT (ADMIN) ---

// Opens the modal to edit a product's details
function openEditModal(product) {
    document.getElementById('edit-product-id').value = product.id;
    document.getElementById('edit-product-name').value = product.name;
    document.getElementById('edit-product-price').value = product.originalPrice; 
    document.getElementById('edit-product-weight').value = product.weight || '';
    document.getElementById('edit-product-category').value = product.category;
    document.getElementById('edit-product-description').value = product.description;
    const filename = product.image.split('/').pop();
    document.getElementById('edit-product-image-filename').value = filename;
    
    elements.editProductModalEl.classList.remove('hidden');
}

// Deletes a product after confirmation
window.deleteProduct = function (productId) {
    showConfirm('Are you sure you want to delete this product?', async () => {
        try {
            await deleteDoc(doc(db, "products", productId));
            await initializeStore(true); 
            showAlert("Product deleted successfully!");
        } catch (error) {
            console.error("Error deleting product: ", error);
            showAlert("Failed to delete product. Please try again.");
        }
    });
}

/**
 * Parses a CSV string into an array of product objects.
 * Assumes the first row is the header.
 * @param {string} csvText The raw CSV text content.
 * @returns {Array<Object>} An array of product objects.
 */
function parseCSV(csvText) {
    const products = [];
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) {
        showAlert("CSV file is empty or has no data rows.");
        return [];
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const requiredHeaders = ['name', 'price', 'weight', 'category', 'description', 'image_filename'];
    
    // Validate headers
    for (const requiredHeader of requiredHeaders) {
        if (!headers.includes(requiredHeader)) {
            showAlert(`CSV is missing required header: ${requiredHeader}`);
            return [];
        }
    }

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length !== headers.length) {
            console.warn(`Skipping row ${i + 1}: Mismatched number of columns.`);
            continue;
        }

        const product = {};
        for (let j = 0; j < headers.length; j++) {
            product[headers[j]] = values[j].trim();
        }
        
        products.push(product);
    }
    return products;
}


// --- AUTHENTICATION & ADMIN (LOCAL STORAGE) ---
window.toggleAuthForms = function () {
    elements.loginFormEl.classList.toggle('hidden');
    elements.signupFormEl.classList.toggle('hidden');
    elements.loginFormEl.reset();
    elements.signupFormEl.reset();
}

function updateAuthControls() {
    let welcomeMessage = '';
    const defaultLogin = `<a href="#" onclick="showPage('login')">Login</a>`;

    if (currentUser) {
        welcomeMessage = `<span>Welcome, ${currentUser.name}</span>`;
        if (currentUser.role === 'admin') {
            welcomeMessage += ` <a href="#" onclick="showPage('admin')">Admin Panel</a>`;
        }
        welcomeMessage += ` <a href="#" onclick="logout()">Logout</a>`;
    } else {
        welcomeMessage = defaultLogin;
    }

    if (elements.authControlsDesktopEl) {
        elements.authControlsDesktopEl.innerHTML = welcomeMessage;
    }
    if (elements.authControlsMobileEl) {
        elements.authControlsMobileEl.innerHTML = welcomeMessage;
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
    
    const ordersQuery = query(collection(db, "orders"));
    onSnapshot(ordersQuery, (querySnapshot) => {
        const orders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderOrders(orders);
    });

    const appointmentsQuery = query(collection(db, "appointments"));
    onSnapshot(appointmentsQuery, (querySnapshot) => {
        const appointments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAppointments(appointments);
    });

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

// --- MODALS & SEARCH ---
function showAlert(message) {
    elements.modalMessageEl.textContent = message;
    elements.modalEl.classList.remove('hidden');
}

function showConfirm(message, onConfirm) {
    elements.confirmMessageEl.textContent = message;
    elements.confirmModalEl.classList.remove('hidden');

    const newYesBtn = elements.confirmYesBtn.cloneNode(true);
    elements.confirmYesBtn.parentNode.replaceChild(newYesBtn, elements.confirmYesBtn);
    elements.confirmYesBtn = newYesBtn;

    elements.confirmYesBtn.onclick = () => {
        onConfirm();
        elements.confirmModalEl.classList.add('hidden');
    };
}

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

// --- EVENT LISTENERS ---
// Event delegation for dynamically created elements
document.addEventListener('click', async function (e) {
    if (e.target.classList.contains('add-to-cart-btn')) {
        const productId = e.target.dataset.productId;
        const controls = e.target.closest('.product-info, .product-detail-info');
        const quantity = parseInt(controls.querySelector('.quantity-input').value);
        addToCart(productId, quantity);
    }
    
    if (e.target.classList.contains('quantity-btn')) {
        const input = e.target.parentNode.querySelector('.quantity-input');
        let value = parseInt(input.value);
        if (e.target.textContent === '+') value++;
        else if (value > 1) value--;
        input.value = value;
    }
    
    if (e.target.classList.contains('remove-from-cart-btn')) {
        removeFromCart(e.target.dataset.productId);
    }
    
    if (e.target.classList.contains('btn-delete')) {
        deleteProduct(e.target.dataset.productId);
    }

    if (e.target.classList.contains('btn-edit')) {
        const product = allProducts.find(p => p.id === e.target.dataset.productId);
        if (product) openEditModal(product);
    }

    if (e.target.classList.contains('remove-herb-btn')) {
        removeHerbFromFormula(parseInt(e.target.dataset.index));
    }
    
    if (e.target.classList.contains('btn-fulfillment') && !e.target.disabled) {
        if (e.target.dataset.orderId) {
            const orderId = e.target.dataset.orderId;
            try {
                await updateDoc(doc(db, "orders", orderId), { status: "fulfilled" });
                showAlert(`Order ${orderId} marked as fulfilled.`);
            } catch (error) {
                console.error("Error updating order status: ", error);
                showAlert("Failed to update order status.");
            }
        } else if (e.target.dataset.appointmentId) {
            const appointmentId = e.target.dataset.appointmentId;
            const currentStatus = e.target.dataset.currentStatus;
            let newStatus = (currentStatus === 'pending') ? 'confirmed' : 'completed';
            
            try {
                await updateDoc(doc(db, "appointments", appointmentId), { status: newStatus });
                showAlert(`Appointment ${appointmentId} marked as ${newStatus}.`);
            } catch (error) {
                console.error("Error updating appointment status: ", error);
                showAlert("Failed to update appointment status.");
            }
        }
    }
});

elements.mobileSearchOverlay.addEventListener('click', (e) => {
    if (e.target === elements.mobileSearchOverlay) closeMobileSearch();
});

elements.mobileMenuOverlay.addEventListener('click', (e) => {
    if (e.target === elements.mobileMenuOverlay) closeMobileMenu();
});

elements.modalCloseBtn.addEventListener('click', () => elements.modalEl.classList.add('hidden'));
elements.modalEl.addEventListener('click', (e) => { 
    if (e.target === elements.modalEl) elements.modalEl.classList.add('hidden'); 
});

elements.confirmNoBtn.addEventListener('click', () => elements.confirmModalEl.classList.add('hidden'));
elements.editModalCloseBtn.addEventListener('click', () => elements.editProductModalEl.classList.add('hidden'));

elements.searchInputEl.addEventListener('input', handleSearch);
elements.mobileSearchInputEl.addEventListener('input', handleMobileSearch);
elements.herbNameInput.addEventListener('input', showHerbSuggestions);
elements.addHerbBtn.addEventListener('click', addHerbToFormula);
elements.addFormulaToCartBtn.addEventListener('click', addFormulaToCart);


let ticking = false;
window.addEventListener('scroll', () => {
    if (!ticking) {
        requestAnimationFrame(() => {
            handleScroll();
            ticking = false;
        });
        ticking = true;
    }
}, { passive: true });

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

    const appointmentDateTime = new Date(`${formData.date}T${formData.time}`);
    if (appointmentDateTime <= new Date()) {
        showAlert("Please select a future date and time for your appointment.");
        return;
    }

    try {
        const docRef = await addDoc(collection(db, "appointments"), formData);
        showAlert(`Appointment booked successfully! Your booking reference is: ${docRef.id.substring(0, 8).toUpperCase()}`);
        elements.appointmentFormEl.reset();
        setMinimumAppointmentDate();
        showPage('home');
    } catch (error) {
        console.error("Error booking appointment: ", error);
        showAlert("Failed to book appointment. Please try again.");
    }
});

elements.checkoutFormEl.addEventListener('submit', async function (e) {
    e.preventDefault();
    const subtotal = cart.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0);
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
        await addDoc(collection(db, "orders"), newOrder);
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
    const newProduct = {
        name: document.getElementById('product-name').value,
        price: parseFloat(document.getElementById('product-price').value),
        weight: parseFloat(document.getElementById('product-weight').value),
        category: document.getElementById('product-category').value,
        description: document.getElementById('product-description').value,
        image: `images/${document.getElementById('product-image-filename').value}`,
    };

    try {
        await addDoc(collection(db, "products"), newProduct);
        showAlert("Product added successfully!");
        elements.addProductFormEl.reset();
        await initializeStore(true);
    } catch (error) {
        console.error("Error adding product: ", error);
        showAlert(`Failed to add product. Error: ${error.message}`);
    }
});

// Handle the submission of the edit product form
elements.editProductFormEl.addEventListener('submit', async function(e) {
    e.preventDefault();
    const productId = document.getElementById('edit-product-id').value;
    const updatedData = {
        name: document.getElementById('edit-product-name').value,
        price: parseFloat(document.getElementById('edit-product-price').value),
        weight: parseFloat(document.getElementById('edit-product-weight').value),
        category: document.getElementById('edit-product-category').value,
        description: document.getElementById('edit-product-description').value,
        image: `images/${document.getElementById('edit-product-image-filename').value}`,
    };

    try {
        await updateDoc(doc(db, "products", productId), updatedData);
        showAlert("Product updated successfully!");
        elements.editProductModalEl.classList.add('hidden');
        await initializeStore(true); 
    } catch (error) {
        console.error("Error updating product: ", error);
        showAlert("Failed to update product.");
    }
});

// Handle bulk product upload via CSV
elements.bulkAddFormEl.addEventListener('submit', function (e) {
    e.preventDefault();
    const file = elements.csvFileInputEl.files[0];
    if (!file) {
        showAlert('Please select a CSV file to upload.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(event) {
        const csvText = event.target.result;
        const parsedProducts = parseCSV(csvText);

        if (parsedProducts.length === 0) {
            elements.bulkUploadStatusEl.textContent = "No valid products found in the file.";
            elements.bulkUploadStatusEl.style.color = 'red';
            return;
        }

        elements.bulkUploadStatusEl.textContent = `Processing ${parsedProducts.length} products...`;
        elements.bulkUploadStatusEl.style.color = 'blue';

        try {
            // Use a batch write for efficiency
            const batch = writeBatch(db);
            let productsAdded = 0;

            parsedProducts.forEach(p => {
                const newProductRef = doc(collection(db, "products"));
                const productData = {
                    name: p.name,
                    price: parseFloat(p.price) || 0,
                    weight: parseInt(p.weight) || 0,
                    category: p.category,
                    description: p.description,
                    image: `images/${p.image_filename}`,
                };

                // Basic validation
                if (productData.name && productData.price > 0 && productData.category) {
                    batch.set(newProductRef, productData);
                    productsAdded++;
                } else {
                    console.warn("Skipping invalid product data:", p);
                }
            });

            await batch.commit();
            
            elements.bulkUploadStatusEl.textContent = `${productsAdded} products added successfully!`;
            elements.bulkUploadStatusEl.style.color = 'green';
            elements.bulkAddFormEl.reset();
            await initializeStore(true); // Refresh store data

        } catch (error) {
            console.error("Error adding products in bulk: ", error);
            elements.bulkUploadStatusEl.textContent = "An error occurred during the upload.";
            elements.bulkUploadStatusEl.style.color = 'red';
            showAlert("Failed to add products from CSV. Check console for details.");
        }
    };

    reader.readAsText(file);
});


// --- INITIALIZATION ---
async function initializeStore(forceRefetch = false) {
    if (!forceRefetch) {
        try {
            const loggedInUser = JSON.parse(localStorage.getItem('currentUser'));
            if (loggedInUser) currentUser = loggedInUser;
        } catch (error) {
            console.error("Could not parse user from local storage:", error);
            localStorage.removeItem('currentUser');
        }
        updateAuthControls();
    }

    try {
        const productSnapshot = await getDocs(collection(db, "products"));
        allProducts = productSnapshot.docs.map(doc => {
            const data = doc.data();
            const originalPrice = data.price;
            const salePrice = originalPrice * (1 - DISCOUNT_RATE);
            const pricePerGram = (data.weight > 0) ? (originalPrice / data.weight) : 0;
            return { 
                id: doc.id, 
                ...data,
                originalPrice: originalPrice,
                salePrice: salePrice,
                pricePerGram: pricePerGram
            };
        });
        
        renderAllGrids();
        renderAdminProductsList();
    } catch (error) {
        console.error("Error fetching products from Firestore: ", error);
        showAlert("Could not load products. Please check your connection.");
    }

    if (!forceRefetch) {
        updateCartDisplay();
        showSlides(desktopSlideIndex);
        resetDesktopSlideInterval();
        rotateMobileSlides();
        setInterval(rotateMobileSlides, 5000);
    }
}

// Run the store on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => initializeStore());
