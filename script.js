// Import Firebase functions from the latest SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, doc, setDoc, getDocs, updateDoc, deleteDoc, writeBatch, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- CONSTANTS ---
const DISCOUNT_RATE = 0.07;
const SUPER_ADMIN_EMAIL = 'superadmin@gmail.com';
const SUPER_ADMIN_PASSWORD = 'superadmin123';

// --- URL ROUTER ---
class Router {
    constructor() {
        this.routes = {
            '/': () => this.showHome(),
            '/category/:category': (params) => this.showCategory(params.category),
            '/product/:category/:id': (params) => this.showProduct(params.category, params.id),
            '/cart': () => showPage('cart'),
            '/checkout': () => showPage('checkout'),
            '/appointment': () => showPage('appointment'),
            '/login': () => showPage('login'),
            '/admin': () => showPage('admin'),
            '/search': () => this.handleSearch()
        };
        
        window.addEventListener('popstate', () => this.handleRoute());
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-route]')) {
                e.preventDefault();
                this.navigate(e.target.getAttribute('data-route'));
            }
        });
    }

    navigate(path, replace = false) {
        if (replace) {
            window.history.replaceState({}, '', path);
        } else {
            window.history.pushState({}, '', path);
        }
        this.handleRoute();
    }

    handleRoute() {
        const path = window.location.pathname;
        const queryParams = new URLSearchParams(window.location.search);
        
        // Try to match route
        for (const [route, handler] of Object.entries(this.routes)) {
            const params = this.matchRoute(route, path);
            if (params) {
                handler(params);
                return;
            }
        }
        
        // 404 - redirect to home
        this.navigate('/', true);
    }

    matchRoute(route, path) {
        const routeParts = route.split('/').filter(p => p);
        const pathParts = path.split('/').filter(p => p);
        
        if (routeParts.length !== pathParts.length) return null;
        
        const params = {};
        for (let i = 0; i < routeParts.length; i++) {
            if (routeParts[i].startsWith(':')) {
                params[routeParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
            } else if (routeParts[i] !== pathParts[i]) {
                return null;
            }
        }
        
        return params;
    }

    showHome() {
        showPage('home');
    }

    showCategory(category) {
        showPage(category);
    }

    showProduct(category, id) {
        const product = allProducts.find(p => p.id === id);
        if (product) {
            renderProductDetailPage(product);
            showPage('product-detail');
        } else {
            this.navigate('/', true);
        }
    }

    handleSearch() {
        const query = new URLSearchParams(window.location.search).get('q');
        if (query) {
            elements.searchInputEl.value = query;
            performSearch(query);
        }
    }
}

const router = new Router();

// --- ADMIN HIERARCHY SYSTEM ---
class AdminSystem {
    constructor() {
        this.superAdmin = null;
        this.admins = [];
        this.activityLog = [];
        this.categories = [];
    }

    async initialize() {
        await this.loadAdmins();
        await this.loadCategories();
        await this.loadActivityLog();
    }

    async loadAdmins() {
        try {
            const adminsSnapshot = await getDocs(collection(db, "admins"));
            this.admins = adminsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error loading admins:", error);
        }
    }

    async loadCategories() {
        try {
            const categoriesSnapshot = await getDocs(collection(db, "categories"));
            this.categories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error loading categories:", error);
            // Set default categories if none exist
            this.categories = [
                { id: 'dry-fruits', name: 'Dry Fruits', slug: 'dry-fruits' },
                { id: 'herbal-tea', name: 'Herbal Tea', slug: 'herbal-tea' },
                { id: 'honey', name: 'Honey', slug: 'honey' },
                { id: 'seeds', name: 'Seeds', slug: 'seeds' },
                { id: 'supplements', name: 'Supplements', slug: 'supplements' },
                { id: 'custom-formula', name: 'Custom Formula', slug: 'custom-formula' },
                { id: 'cold-pressed-oil', name: 'Cold Pressed Oil', slug: 'cold-pressed-oil' },
                { id: 'essential-oils', name: 'Essential Oils', slug: 'essential-oils' },
                { id: 'herbs', name: 'Herbs', slug: 'herbs' }
            ];
        }
    }

    async loadActivityLog() {
        try {
            const activityQuery = query(
                collection(db, "activity_log"),
                orderBy("timestamp", "desc")
            );
            const snapshot = await getDocs(activityQuery);
            this.activityLog = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error("Error loading activity log:", error);
        }
    }

    async logActivity(action, details, performedBy) {
        try {
            await addDoc(collection(db, "activity_log"), {
                action,
                details,
                performedBy: performedBy || (currentUser ? currentUser.email : 'system'),
                timestamp: serverTimestamp(),
                date: new Date().toISOString()
            });
            await this.loadActivityLog();
        } catch (error) {
            console.error("Error logging activity:", error);
        }
    }

    async addAdmin(email, name, password) {
        if (this.admins.length >= 4) {
            throw new Error("Maximum 4 admins allowed");
        }
        
        try {
            const newAdmin = {
                email,
                name,
                password,
                role: 'admin',
                addedBy: currentUser.email,
                addedAt: new Date().toISOString(),
                active: true
            };
            
            const docRef = await addDoc(collection(db, "admins"), newAdmin);
            await this.logActivity('ADMIN_ADDED', `Admin ${name} (${email}) was added`, currentUser.email);
            await this.loadAdmins();
            return docRef.id;
        } catch (error) {
            console.error("Error adding admin:", error);
            throw error;
        }
    }

    async removeAdmin(adminId) {
        try {
            const admin = this.admins.find(a => a.id === adminId);
            await deleteDoc(doc(db, "admins", adminId));
            await this.logActivity('ADMIN_REMOVED', `Admin ${admin.name} (${admin.email}) was removed`, currentUser.email);
            await this.loadAdmins();
        } catch (error) {
            console.error("Error removing admin:", error);
            throw error;
        }
    }

    async toggleAdminStatus(adminId, active) {
        try {
            const admin = this.admins.find(a => a.id === adminId);
            await updateDoc(doc(db, "admins", adminId), { active });
            await this.logActivity(
                active ? 'ADMIN_ACTIVATED' : 'ADMIN_DEACTIVATED',
                `Admin ${admin.name} was ${active ? 'activated' : 'deactivated'}`,
                currentUser.email
            );
            await this.loadAdmins();
        } catch (error) {
            console.error("Error toggling admin status:", error);
            throw error;
        }
    }

    async addCategory(name, slug) {
        try {
            const newCategory = { name, slug, addedAt: new Date().toISOString() };
            const docRef = await addDoc(collection(db, "categories"), newCategory);
            await this.logActivity('CATEGORY_ADDED', `Category "${name}" was added`, currentUser.email);
            await this.loadCategories();
            return docRef.id;
        } catch (error) {
            console.error("Error adding category:", error);
            throw error;
        }
    }

    async deleteCategory(categoryId) {
        try {
            const category = this.categories.find(c => c.id === categoryId);
            await deleteDoc(doc(db, "categories", categoryId));
            await this.logActivity('CATEGORY_DELETED', `Category "${category.name}" was deleted`, currentUser.email);
            await this.loadCategories();
        } catch (error) {
            console.error("Error deleting category:", error);
            throw error;
        }
    }

    async assignOrderToAdmin(orderId, adminEmail) {
        try {
            await updateDoc(doc(db, "orders", orderId), {
                assignedTo: adminEmail,
                assignedAt: new Date().toISOString(),
                assignedBy: currentUser.email
            });
            await this.logActivity('ORDER_ASSIGNED', `Order ${orderId} assigned to ${adminEmail}`, currentUser.email);
        } catch (error) {
            console.error("Error assigning order:", error);
            throw error;
        }
    }

    isSuperAdmin() {
        return currentUser && currentUser.email === SUPER_ADMIN_EMAIL;
    }

    isAdmin() {
        return currentUser && (this.isSuperAdmin() || this.admins.some(a => a.email === currentUser.email && a.active));
    }
}

const adminSystem = new AdminSystem();

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
    bulkAddFormEl: document.getElementById('bulk-add-form'),
    csvFileInputEl: document.getElementById('csv-file-input'),
    bulkUploadStatusEl: document.getElementById('bulk-upload-status'),
    appointmentTooltip: document.getElementById('appointment-tooltip'),
};

// --- UTILITY FUNCTIONS ---
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

function createDocumentFragment() {
    return document.createDocumentFragment();
}

function slugify(text) {
    return text.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

// --- NAVIGATION FUNCTIONS ---
window.navigateTo = function(path) {
    router.navigate(path);
};

window.showPage = function(pageId) {
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
};

window.showProductPage = function(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (product) {
        router.navigate(`/product/${product.category}/${product.id}`);
    }
};

// --- RENDER FUNCTIONS ---
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
        productCard.innerHTML = `
            <div class="product-image" onclick="navigateTo('/product/${p.category}/${p.id}')">
                <img src="${p.image}" alt="${p.name}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/300x300/ccc/ffffff?text=Image+Not+Found';">
                <div class="discount-badge">${(DISCOUNT_RATE * 100).toFixed(0)}% OFF</div>
            </div>
            <div class="product-info">
                <h3 onclick="navigateTo('/product/${p.category}/${p.id}')">${p.name}${weightDisplay}</h3>
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

function renderProductDetailPage(product) {
    if (!product) {
        elements.productDetailContentEl.innerHTML = '<p>Product not found.</p>';
        return;
    }
    
    const weightDisplay = product.weight ? `<span class="product-weight">(${product.weight}g)</span>` : '';

    elements.productDetailContentEl.innerHTML = `
        <a href="#" onclick="navigateTo('/category/${product.category}')" class="back-link">&larr; Back to ${product.category}</a>
        <div class="product-detail-container">
            <div class="product-detail-image">
                <img src="${product.image}" alt="${product.name}" loading="lazy" onerror="this.onerror=null;this.src='https://placehold.co/400x400/ccc/ffffff?text=Image+Not+Found';">
            </div>
            <div class="product-detail-info">
                <h1>${product.name}${weightDisplay}</h1>
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

// Update navigation links to use new router
function updateNavigationLinks() {
    document.querySelectorAll('a[onclick*="showPage"]').forEach(link => {
        const match = link.getAttribute('onclick').match(/showPage\('([^']+)'\)/);
        if (match) {
            const page = match[1];
            if (page === 'home') {
                link.setAttribute('data-route', '/');
            } else if (['dry-fruits', 'herbal-tea', 'honey', 'seeds', 'supplements', 'custom-formula', 'cold-pressed-oil', 'essential-oils', 'herbs'].includes(page)) {
                link.setAttribute('data-route', `/category/${page}`);
            } else {
                link.setAttribute('data-route', `/${page}`);
            }
            link.removeAttribute('onclick');
        }
    });
}

// Enhanced search with URL
function performSearch(query) {
    const results = allProducts.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.description.toLowerCase().includes(query.toLowerCase())
    );
    
    renderProducts(results, 'search-results-grid');
    showPage('search-results');
    document.getElementById('search-results-title').textContent = `Results for "${query}"`;
}

const handleSearch = debounce(() => {
    const query = elements.searchInputEl.value.trim();
    if (query.length > 0) {
        router.navigate(`/search?q=${encodeURIComponent(query)}`);
    }
}, 300);

// Render Admin Panel with new hierarchy
async function renderAdminPanel() {
    if (!currentUser || !adminSystem.isAdmin()) {
        showAlert("You do not have permission to view this page.");
        router.navigate('/');
        return;
    }
    
    const isSuperAdmin = adminSystem.isSuperAdmin();
    
    // Show/hide tabs based on role
    const adminTabsContainer = document.querySelector('.admin-tabs');
    if (isSuperAdmin) {
        // Super admin sees all tabs
        adminTabsContainer.innerHTML = `
            <div class="admin-tab active" onclick="showAdminContent('orders')">Orders</div>
            <div class="admin-tab" onclick="showAdminContent('appointments')">Appointments</div>
            <div class="admin-tab" onclick="showAdminContent('products')">Add Product</div>
            <div class="admin-tab" onclick="showAdminContent('manage')">Manage Products</div>
            <div class="admin-tab" onclick="showAdminContent('admins')">Manage Admins</div>
            <div class="admin-tab" onclick="showAdminContent('categories')">Manage Categories</div>
            <div class="admin-tab" onclick="showAdminContent('activity')">Activity Log</div>
        `;
    } else {
        // Regular admin sees limited tabs
        adminTabsContainer.innerHTML = `
            <div class="admin-tab active" onclick="showAdminContent('orders')">My Orders</div>
            <div class="admin-tab" onclick="showAdminContent('appointments')">Appointments</div>
            <div class="admin-tab" onclick="showAdminContent('products')">Add Product</div>
            <div class="admin-tab" onclick="showAdminContent('manage')">Manage Products</div>
        `;
    }
    
    // Load orders
    const ordersQuery = isSuperAdmin 
        ? query(collection(db, "orders"))
        : query(collection(db, "orders"), where("assignedTo", "==", currentUser.email));
        
    onSnapshot(ordersQuery, (querySnapshot) => {
        const orders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderOrders(orders, isSuperAdmin);
    });

    // Load appointments
    const appointmentsQuery = query(collection(db, "appointments"));
    onSnapshot(appointmentsQuery, (querySnapshot) => {
        const appointments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAppointments(appointments);
    });

    renderAdminProductsList();
    
    if (isSuperAdmin) {
        renderAdminManagement();
        renderCategoryManagement();
        renderActivityLog();
    }
}

// Render orders with assignment capability
function renderOrders(orders, isSuperAdmin) {
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
        const assignedTo = order.assignedTo || 'Unassigned';
        let orderItemsHtml = '';
        if (order.items && Array.isArray(order.items)) {
            orderItemsHtml = order.items.map(item => `<li>${item.name} (x${item.quantity})</li>`).join('');
        }

        let assignmentHtml = '';
        if (isSuperAdmin) {
            assignmentHtml = `
                <p><strong>Assigned To:</strong> ${assignedTo}</p>
                <select class="assign-order-select" data-order-id="${order.id}">
                    <option value="">Assign to Admin...</option>
                    ${adminSystem.admins.filter(a => a.active).map(admin => 
                        `<option value="${admin.email}" ${order.assignedTo === admin.email ? 'selected' : ''}>${admin.name} (${admin.email})</option>`
                    ).join('')}
                </select>
            `;
        }

        orderElement.innerHTML = `
            <h4>Order from: ${order.customer.name}</h4>
            <p><strong>Order ID:</strong> ${order.id}</p>
            <p><strong>Date:</strong> ${new Date(order.date).toLocaleString()}</p>
            <p><strong>Contact:</strong> ${order.customer.email} | ${order.customer.phone}</p>
            <p><strong>Address:</strong> ${order.customer.address}</p>
            <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
            <p><strong>Total:</strong> Rs. ${order.total.toFixed(2)}</p>
            ${assignmentHtml}
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

// Render admin management (super admin only)
function renderAdminManagement() {
    const adminManagementContent = document.getElementById('admin-admins-content');
    if (!adminManagementContent) {
        // Create the content area if it doesn't exist
        const adminContent = document.querySelector('.admin-panel');
        const newContent = document.createElement('div');
        newContent.className = 'admin-content hidden';
        newContent.id = 'admin-admins-content';
        adminContent.appendChild(newContent);
    }
    
    const content = document.getElementById('admin-admins-content');
    content.innerHTML = `
        <h3>Manage Admins (${adminSystem.admins.length}/4)</h3>
        <div class="admin-section">
            <h4>Add New Admin</h4>
            <form id="add-admin-form">
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" id="new-admin-name" required>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="new-admin-email" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" id="new-admin-password" required>
                </div>
                <button type="submit" class="btn-primary" ${adminSystem.admins.length >= 4 ? 'disabled' : ''}>
                    Add Admin
                </button>
            </form>
        </div>
        <div class="admin-section">
            <h4>Current Admins</h4>
            <div id="admins-list"></div>
        </div>
    `;
    
    const adminsList = document.getElementById('admins-list');
    if (adminSystem.admins.length === 0) {
        adminsList.innerHTML = '<p>No admins added yet.</p>';
    } else {
        adminsList.innerHTML = adminSystem.admins.map(admin => `
            <div class="admin-item">
                <div class="admin-info">
                    <h4>${admin.name}</h4>
                    <p>Email: ${admin.email}</p>
                    <p>Status: <span class="admin-status ${admin.active ? 'active' : 'inactive'}">${admin.active ? 'Active' : 'Inactive'}</span></p>
                    <p>Added: ${new Date(admin.addedAt).toLocaleDateString()}</p>
                </div>
                <div class="admin-actions">
                    <button class="btn-toggle-admin" data-admin-id="${admin.id}" data-active="${admin.active}">
                        ${admin.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button class="btn-delete" data-admin-id="${admin.id}">Remove</button>
                </div>
            </div>
        `).join('');
    }
    
    // Add form handler
    document.getElementById('add-admin-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-admin-name').value;
        const email = document.getElementById('new-admin-email').value;
        const password = document.getElementById('new-admin-password').value;
        
        try {
            await adminSystem.addAdmin(email, name, password);
            showAlert('Admin added successfully!');
            renderAdminManagement();
        } catch (error) {
            showAlert(error.message);
        }
    });
}

// Render category management (super admin only)
function renderCategoryManagement() {
    const categoryManagementContent = document.getElementById('admin-categories-content');
    if (!categoryManagementContent) {
        const adminContent = document.querySelector('.admin-panel');
        const newContent = document.createElement('div');
        newContent.className = 'admin-content hidden';
        newContent.id = 'admin-categories-content';
        adminContent.appendChild(newContent);
    }
    
    const content = document.getElementById('admin-categories-content');
    content.innerHTML = `
        <h3>Manage Categories</h3>
        <div class="admin-section">
            <h4>Add New Category</h4>
            <form id="add-category-form">
                <div class="form-group">
                    <label>Category Name</label>
                    <input type="text" id="new-category-name" required>
                </div>
                <div class="form-group">
                    <label>Category Slug (URL)</label>
                    <input type="text" id="new-category-slug" required placeholder="e.g., herbal-tea">
                </div>
                <button type="submit" class="btn-primary">Add Category</button>
            </form>
        </div>
        <div class="admin-section">
            <h4>Current Categories</h4>
            <div id="categories-list">
                ${adminSystem.categories.map(cat => `
                    <div class="category-item">
                        <div class="category-info">
                            <h4>${cat.name}</h4>
                            <p>Slug: ${cat.slug}</p>
                        </div>
                        <button class="btn-delete" data-category-id="${cat.id}">Delete</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Auto-generate slug from name
    document.getElementById('new-category-name')?.addEventListener('input', (e) => {
        document.getElementById('new-category-slug').value = slugify(e.target.value);
    });
    
    // Add form handler
    document.getElementById('add-category-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('new-category-name').value;
        const slug = document.getElementById('new-category-slug').value;
        
        try {
            await adminSystem.addCategory(name, slug);
            showAlert('Category added successfully!');
            renderCategoryManagement();
            await initializeStore(true);
        } catch (error) {
            showAlert('Failed to add category');
        }
    });
}

// Render activity log
function renderActivityLog() {
    const activityLogContent = document.getElementById('admin-activity-content');
    if (!activityLogContent) {
        const adminContent = document.querySelector('.admin-panel');
        const newContent = document.createElement('div');
        newContent.className = 'admin-content hidden';
        newContent.id = 'admin-activity-content';
        adminContent.appendChild(newContent);
    }
    
    const content = document.getElementById('admin-activity-content');
    content.innerHTML = `
        <h3>Activity Log</h3>
        <div class="activity-log">
            ${adminSystem.activityLog.length === 0 ? '<p>No activities yet.</p>' : ''}
            ${adminSystem.activityLog.map(activity => {
                let icon = '📝';
                if (activity.action.includes('ADMIN')) icon = '👤';
                else if (activity.action.includes('PRODUCT')) icon = '📦';
                else if (activity.action.includes('ORDER')) icon = '🛍️';
                else if (activity.action.includes('CATEGORY')) icon = '📂';
                
                return `
                    <div class="activity-item">
                        <div class="activity-icon">${icon}</div>
                        <div class="activity-details">
                            <strong>${activity.action.replace(/_/g, ' ')}</strong>
                            <p>${activity.details}</p>
                            <small>By: ${activity.performedBy} | ${new Date(activity.date).toLocaleString()}</small>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

window.showAdminContent = function(contentType) {
    document.querySelectorAll('.admin-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`admin-${contentType}-content`)?.classList.remove('hidden');
    document.querySelectorAll('.admin-tab').forEach(el => el.classList.remove('active'));
    document.querySelector(`.admin-tab[onclick="showAdminContent('${contentType}')"]`)?.classList.add('active');

    if (contentType === 'manage') {
        renderAdminProductsList();
    }
};

// Enhanced login with admin check
elements.loginFormEl.addEventListener('submit', async function (e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    // Check super admin
    if (email === SUPER_ADMIN_EMAIL && password === SUPER_ADMIN_PASSWORD) {
        currentUser = { name: 'Super Admin', email: SUPER_ADMIN_EMAIL, role: 'superadmin' };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateAuthControls();
        router.navigate('/admin');
        elements.loginFormEl.reset();
        return;
    }

    // Check regular admins
    const admin = adminSystem.admins.find(a => a.email === email && a.password === password && a.active);
    if (admin) {
        currentUser = { name: admin.name, email: admin.email, role: 'admin' };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateAuthControls();
        router.navigate('/admin');
        elements.loginFormEl.reset();
        return;
    }

    // Check regular users
    const users = JSON.parse(localStorage.getItem('users')) || [];
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateAuthControls();
        router.navigate('/');
        elements.loginFormEl.reset();
    } else {
        showAlert("Invalid email or password.");
    }
});

// Enhanced product form to log activity
elements.addProductFormEl.addEventListener('submit', async function (e) {
    e.preventDefault();
    const newProduct = {
        name: document.getElementById('product-name').value,
        price: parseFloat(document.getElementById('product-price').value),
        weight: parseFloat(document.getElementById('product-weight').value),
        category: document.getElementById('product-category').value,
        description: document.getElementById('product-description').value,
        image: `/images/${document.getElementById('product-image-filename').value}`,
        addedBy: currentUser.email,
        addedAt: new Date().toISOString()
    };

    try {
        const docRef = await addDoc(collection(db, "products"), newProduct);
        await adminSystem.logActivity('PRODUCT_ADDED', `Product "${newProduct.name}" was added`, currentUser.email);
        showAlert("Product added successfully!");
        elements.addProductFormEl.reset();
        await initializeStore(true);
    } catch (error) {
        console.error("Error adding product: ", error);
        showAlert(`Failed to add product. Error: ${error.message}`);
    }
});

// Enhanced edit product to log activity
elements.editProductFormEl.addEventListener('submit', async function(e) {
    e.preventDefault();
    const productId = document.getElementById('edit-product-id').value;
    const updatedData = {
        name: document.getElementById('edit-product-name').value,
        price: parseFloat(document.getElementById('edit-product-price').value),
        weight: parseFloat(document.getElementById('edit-product-weight').value),
        category: document.getElementById('edit-product-category').value,
        description: document.getElementById('edit-product-description').value,
        image: `/images/${document.getElementById('edit-product-image-filename').value}`,
        updatedBy: currentUser.email,
        updatedAt: new Date().toISOString()
    };

    try {
        await updateDoc(doc(db, "products", productId), updatedData);
        await adminSystem.logActivity('PRODUCT_UPDATED', `Product "${updatedData.name}" was updated`, currentUser.email);
        showAlert("Product updated successfully!");
        elements.editProductModalEl.classList.add('hidden');
        await initializeStore(true);
    } catch (error) {
        console.error("Error updating product: ", error);
        showAlert("Failed to update product.");
    }
});

// Enhanced delete product
window.deleteProduct = async function (productId) {
    const product = allProducts.find(p => p.id === productId);
    showConfirm('Are you sure you want to delete this product?', async () => {
        try {
            await deleteDoc(doc(db, "products", productId));
            await adminSystem.logActivity('PRODUCT_DELETED', `Product "${product.name}" was deleted`, currentUser.email);
            await initializeStore(true);
            showAlert("Product deleted successfully!");
        } catch (error) {
            console.error("Error deleting product: ", error);
            showAlert("Failed to delete product. Please try again.");
        }
    });
};

// Event listeners for admin actions
document.addEventListener('click', async function (e) {
    // Existing click handlers...
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
        if (e.target.dataset.productId) {
            deleteProduct(e.target.dataset.productId);
        } else if (e.target.dataset.adminId) {
            showConfirm('Are you sure you want to remove this admin?', async () => {
                try {
                    await adminSystem.removeAdmin(e.target.dataset.adminId);
                    showAlert('Admin removed successfully!');
                    renderAdminManagement();
                } catch (error) {
                    showAlert('Failed to remove admin');
                }
            });
        } else if (e.target.dataset.categoryId) {
            showConfirm('Are you sure you want to delete this category?', async () => {
                try {
                    await adminSystem.deleteCategory(e.target.dataset.categoryId);
                    showAlert('Category deleted successfully!');
                    renderCategoryManagement();
                    await initializeStore(true);
                } catch (error) {
                    showAlert('Failed to delete category');
                }
            });
        }
    }

    if (e.target.classList.contains('btn-edit')) {
        const product = allProducts.find(p => p.id === e.target.dataset.productId);
        if (product) openEditModal(product);
    }

    if (e.target.classList.contains('btn-toggle-admin')) {
        const adminId = e.target.dataset.adminId;
        const currentActive = e.target.dataset.active === 'true';
        try {
            await adminSystem.toggleAdminStatus(adminId, !currentActive);
            showAlert(`Admin ${!currentActive ? 'activated' : 'deactivated'} successfully!`);
            renderAdminManagement();
        } catch (error) {
            showAlert('Failed to update admin status');
        }
    }

    if (e.target.classList.contains('remove-herb-btn')) {
        removeHerbFromFormula(parseInt(e.target.dataset.index));
    }
    
    if (e.target.classList.contains('btn-fulfillment') && !e.target.disabled) {
        if (e.target.dataset.orderId) {
            const orderId = e.target.dataset.orderId;
            try {
                await updateDoc(doc(db, "orders", orderId), { 
                    status: "fulfilled",
                    fulfilledBy: currentUser.email,
                    fulfilledAt: new Date().toISOString()
                });
                await adminSystem.logActivity('ORDER_FULFILLED', `Order ${orderId} marked as fulfilled`, currentUser.email);
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

    // Order assignment handler
    if (e.target.classList.contains('assign-order-select')) {
        const orderId = e.target.dataset.orderId;
        const adminEmail = e.target.value;
        if (adminEmail) {
            try {
                await adminSystem.assignOrderToAdmin(orderId, adminEmail);
                showAlert('Order assigned successfully!');
            } catch (error) {
                showAlert('Failed to assign order');
            }
        }
    }
});

// Rest of the existing code (cart, checkout, search, etc.)
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
                <button class="btn-primary" onclick="navigateTo('/checkout')">Proceed to Checkout</button>
            </div>
        </div>
    `;
}

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
        router.navigate('/cart');
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
};

function updateAuthControls() {
    let welcomeMessage = '';
    const defaultLogin = `<a data-route="/login">Login</a>`;

    if (currentUser) {
        welcomeMessage = `<span>Welcome, ${currentUser.name}</span>`;
        if (adminSystem.isAdmin()) {
            welcomeMessage += ` <a data-route="/admin">Admin Panel</a>`;
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
    router.navigate('/');
    showAlert("You have been logged out.");
};

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

// Additional helper functions
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
        
        const addedBy = product.addedBy || 'Unknown';
        const isNewProduct = product.addedAt && (new Date() - new Date(product.addedAt)) < 24 * 60 * 60 * 1000;
        
        productItem.innerHTML = `
            <div class="admin-product-info">
                <img src="${product.image}" alt="${product.name}" class="admin-product-thumbnail" onerror="this.onerror=null;this.style.display='none';">
                <div>
                    <h4>${product.name} ${isNewProduct ? '<span class="new-badge">NEW</span>' : ''}</h4>
                    <p>Price: Rs.${product.originalPrice.toFixed(2)} | Category: ${product.category}</p>
                    <p>Added by: ${addedBy} | ID: ${product.id}</p>
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

function renderAppointments(appointments) {
    if (!elements.appointmentsListEl) return;
    
    if (appointments.length === 0) {
        elements.appointmentsListEl.innerHTML = '<p>No appointments booked yet.</p>';
        return;
    }

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

function renderAllGrids() {
    const grids = [
        { products: allProducts, id: 'all-products-grid' },
        ...adminSystem.categories.map(cat => ({
            products: allProducts.filter(p => p.category === cat.slug),
            id: `${cat.slug}-grid`
        }))
    ];

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

function setMinimumAppointmentDate() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];
    document.getElementById('appointment-date').setAttribute('min', minDate);
}

// Initialize store
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

    await adminSystem.initialize();

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
        updateNavigationLinks();
        router.handleRoute();
    }
}

// Event listeners
elements.searchInputEl.addEventListener('input', handleSearch);
elements.modalCloseBtn.addEventListener('click', () => elements.modalEl.classList.add('hidden'));
elements.confirmNoBtn.addEventListener('click', () => elements.confirmModalEl.classList.add('hidden'));
elements.editModalCloseBtn.addEventListener('click', () => elements.editProductModalEl.classList.add('hidden'));

// Checkout form submission
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
        status: 'pending',
        assignedTo: null
    };

    try {
        await addDoc(collection(db, "orders"), newOrder);
        router.navigate('/order-success');
        cart = [];
        updateCartDisplay();
        elements.checkoutFormEl.reset();
    } catch (error) {
        console.error("Error adding order to Firestore: ", error);
        showAlert('There was a problem placing your order. Please try again.');
    }
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
        router.navigate('/');
    } catch (error) {
        console.error("Error booking appointment: ", error);
        showAlert("Failed to book appointment. Please try again.");
    }
});

// Mobile functions
window.openMobileSearch = function () {
    elements.mobileSearchOverlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    elements.mobileSearchInputEl.focus();
};

window.closeMobileSearch = function () {
    elements.mobileSearchOverlay.style.display = 'none';
    document.body.style.overflow = '';
    elements.mobileSearchInputEl.value = '';
    document.getElementById('mobile-search-results-grid').innerHTML = '';
};

window.openMobileMenu = function () {
    elements.mobileMenuOverlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
        elements.mobileMenuSidebar.classList.add('open');
    }, 10);
};

window.closeMobileMenu = function () {
    elements.mobileMenuSidebar.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => {
        elements.mobileMenuOverlay.style.display = 'none';
    }, 300);
};

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

elements.mobileSearchInputEl.addEventListener('input', handleMobileSearch);

window.closeAppointmentTooltip = function () {
    if (elements.appointmentTooltip) {
        elements.appointmentTooltip.classList.remove('show');
    }
};

// Slider functions
window.plusSlides = function (n) {
    showSlides(desktopSlideIndex += n);
    resetDesktopSlideInterval();
};

window.currentSlideDot = function (n) {
    showSlides(desktopSlideIndex = n);
    resetDesktopSlideInterval();
};

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

// Custom formula functions
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

    const herbProduct = allProducts.find(p => p.name.toLowerCase() === name.toLowerCase() && p.pricePerGram > 0);
    
    let pricePerGram = 0;
    let displayName = name;

    if (herbProduct) {
        pricePerGram = herbProduct.pricePerGram;
        displayName = herbProduct.name;
    }

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
    
    const description = `Form: ${selectedForm}. Ingredients: ` + customFormula.map(item => {
        const priceNote = item.pricePerGram === 0 ? ' (Custom/Price TBD)' : '';
        return `${item.name} (${item.quantity}g)${priceNote}`;
    }).join(', ');

    const formulaProduct = {
        id: `custom-formula-${Date.now()}`,
        name: `Custom Formula (${selectedForm})`,
        description: description,
        salePrice: totalPrice,
        originalPrice: totalPrice,
        quantity: 1,
        image: '/images/collection-5.png'
    };

    cart.push(formulaProduct);
    updateCartDisplay();
    showAlert('Custom formula added to cart!');
    
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

elements.herbNameInput.addEventListener('input', showHerbSuggestions);
elements.addHerbBtn.addEventListener('click', addHerbToFormula);
elements.addFormulaToCartBtn.addEventListener('click', addFormulaToCart);

// Signup form
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

window.toggleAuthForms = function () {
    elements.loginFormEl.classList.toggle('hidden');
    elements.signupFormEl.classList.toggle('hidden');
    elements.loginFormEl.reset();
    elements.signupFormEl.reset();
};

// Scroll handling
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

// Bulk upload CSV
elements.bulkAddFormEl?.addEventListener('submit', function (e) {
    e.preventDefault();
    const file = elements.csvFileInputEl.files[0];
    if (!file) {
        showAlert('Please select a CSV file to upload.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(event) {
        const csvText = event.target.result;
        const lines = csvText.trim().split(/\r?\n/);
        
        if (lines.length < 2) {
            elements.bulkUploadStatusEl.textContent = "CSV file is empty or has no data rows.";
            elements.bulkUploadStatusEl.style.color = 'red';
            return;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const products = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            if (values.length !== headers.length) continue;
            
            const product = {};
            for (let j = 0; j < headers.length; j++) {
                product[headers[j]] = values[j].trim();
            }
            products.push(product);
        }

        if (products.length === 0) {
            elements.bulkUploadStatusEl.textContent = "No valid products found in the file.";
            elements.bulkUploadStatusEl.style.color = 'red';
            return;
        }

        elements.bulkUploadStatusEl.textContent = `Processing ${products.length} products...`;
        elements.bulkUploadStatusEl.style.color = 'blue';

        try {
            const batch = writeBatch(db);
            let productsAdded = 0;

            products.forEach(p => {
                const newProductRef = doc(collection(db, "products"));
                const productData = {
                    name: p.name,
                    price: parseFloat(p.price) || 0,
                    weight: parseInt(p.weight) || 0,
                    category: p.category,
                    description: p.description,
                    image: `/images/${p.image_filename}`,
                    addedBy: currentUser.email,
                    addedAt: new Date().toISOString()
                };

                if (productData.name && productData.price > 0 && productData.category) {
                    batch.set(newProductRef, productData);
                    productsAdded++;
                }
            });

            await batch.commit();
            await adminSystem.logActivity('BULK_PRODUCTS_ADDED', `${productsAdded} products added via CSV`, currentUser.email);
            
            elements.bulkUploadStatusEl.textContent = `${productsAdded} products added successfully!`;
            elements.bulkUploadStatusEl.style.color = 'green';
            elements.bulkAddFormEl.reset();
            await initializeStore(true);

        } catch (error) {
            console.error("Error adding products in bulk: ", error);
            elements.bulkUploadStatusEl.textContent = "An error occurred during the upload.";
            elements.bulkUploadStatusEl.style.color = 'red';
            showAlert("Failed to add products from CSV. Check console for details.");
        }
    };

    reader.readAsText(file);
});

// Initialize on load
document.addEventListener('DOMContentLoaded', async () => {
    await initializeStore();

    // Show slider
    showSlides(desktopSlideIndex);
    resetDesktopSlideInterval();
    rotateMobileSlides();
    setInterval(rotateMobileSlides, 5000);

    // Show appointment tooltip
    if (elements.appointmentTooltip) {
        setTimeout(() => {
            elements.appointmentTooltip.classList.add('show');
            setTimeout(() => {
                elements.appointmentTooltip.classList.remove('show');
            }, 14000);
        }, 2000);
    }
});