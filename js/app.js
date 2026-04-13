// app.js — Main controller, routing, event delegation
import Store from './store.js';
import Auth from './auth.js';
import { SEED_PROJECT_NAME, SEED_PRODUCTS, CATEGORIES } from './data.js';
import {
  renderLoginScreen,
  renderDashboard,
  renderProjectDetail,
  renderProductModal,
  renderNewProjectModal,
  renderAmazonLinkModal,
  renderConfirmModal,
  renderSearchResults,
  STATUS_ORDER,
} from './components.js';

const app = document.getElementById('app');
const modalContainer = document.getElementById('modal-container');

if (!app || !modalContainer) {
  document.body.innerHTML = '<div style="padding:40px;color:#e74c3c;font-family:sans-serif"><h1>Error</h1><p>App container not found. Check index.html has #app and #modal-container.</p></div>';
  throw new Error('Missing #app or #modal-container');
}

let currentView = 'login'; // 'login' | 'dashboard' | 'project'
let currentProjectId = null;
let filters = { status: 'all', category: 'all', sort: 'date-desc' };
let searchDebounce = null;

// ── Init ──

function init() {
  Store.load();

  if (Store.isFirstRun()) {
    const project = Store.createProject(SEED_PROJECT_NAME);
    Store.bulkAddProducts(project.id, SEED_PRODUCTS);
  }

  if (Auth.isAuthenticated()) {
    currentView = 'dashboard';
    app.classList.add('animate-in');
    setTimeout(() => app.classList.remove('animate-in'), 800);
  }

  // Listen for storage save errors
  window.addEventListener('store-save-error', () => {
    showToast('Failed to save — storage may be full');
  });

  renderView();
  bindGlobalEvents();
}

// ── Routing ──

function renderView() {
  if (currentView === 'login') {
    app.innerHTML = renderLoginScreen();
  } else if (currentView === 'dashboard') {
    renderDashboardView();
  } else if (currentView === 'project' && currentProjectId) {
    renderProjectView();
  }
}

function renderDashboardView() {
  const projects = Store.getProjects();
  const stats = Store.getGlobalStats();
  app.innerHTML = renderDashboard(projects, stats);
}

function renderProjectView() {
  const project = Store.getProject(currentProjectId);
  if (!project) {
    navigateTo('dashboard');
    return;
  }

  let products = [...project.products];

  if (filters.status !== 'all') {
    products = products.filter((p) => p.status === filters.status);
  }
  if (filters.category !== 'all') {
    products = products.filter((p) => p.category === filters.category);
  }

  switch (filters.sort) {
    case 'date-desc':
      products.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
      break;
    case 'date-asc':
      products.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
      break;
    case 'name-asc':
      products.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'name-desc':
      products.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case 'status':
      products.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
      break;
  }

  app.innerHTML = renderProjectDetail(project, products, filters);
}

function navigateTo(view, projectId = null) {
  closeAllDropdowns();
  closeStatusMenus();
  closeContextMenus();

  currentView = view;
  currentProjectId = projectId;
  filters = { status: 'all', category: 'all', sort: 'date-desc' };
  renderView();
  // Play entry animations only on navigation, not on filter/status re-renders
  app.classList.add('animate-in');
  setTimeout(() => app.classList.remove('animate-in'), 800);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Event Delegation ──

function bindGlobalEvents() {
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('change', handleChange);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('keydown', handleKeydown);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.status-dropdown-wrap') && !e.target.closest('.status-dropdown-floating')) {
      closeAllDropdowns();
      closeStatusMenus();
    }
    if (!e.target.closest('.context-menu') && !e.target.closest('[data-action="project-menu"]')) {
      closeContextMenus();
    }
  });
}

function handleClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;

  switch (action) {
    case 'login-submit':
      e.preventDefault();
      handleLogin();
      break;

    case 'logout':
      Auth.logout();
      currentView = 'login';
      renderView();
      break;

    case 'new-project':
      showModal(renderNewProjectModal());
      break;

    case 'open-project':
      navigateTo('project', target.dataset.projectId);
      break;

    case 'back-to-dashboard':
      navigateTo('dashboard');
      break;

    case 'add-from-amazon': {
      showModal(renderAmazonLinkModal(target.dataset.projectId));
      break;
    }

    case 'import-seed': {
      const pid = target.dataset.projectId;
      const added = Store.bulkAddProducts(pid, SEED_PRODUCTS);
      if (added.length === 0) {
        showToast('All items already imported');
      } else {
        showToast(`${added.length} items imported`);
      }
      renderView();
      break;
    }

    case 'delete-project': {
      const pid = target.dataset.projectId;
      Store.deleteProject(pid);
      closeModal();
      navigateTo('dashboard');
      break;
    }

    case 'confirm-delete-project': {
      const pid = target.dataset.projectId;
      const project = Store.getProject(pid);
      showModal(
        renderConfirmModal(
          `Delete "${project?.name || 'this project'}" and all its products? This cannot be undone.`,
          'delete-project',
          { 'project-id': pid }
        )
      );
      break;
    }

    case 'edit-product': {
      const pid = target.dataset.projectId;
      const prodId = target.dataset.productId;
      const product = Store.getProduct(pid, prodId);
      if (product) {
        showModal(renderProductModal(product, pid, CATEGORIES));
      }
      break;
    }

    case 'delete-product': {
      const pid = target.dataset.projectId;
      const prodId = target.dataset.productId;
      Store.deleteProduct(pid, prodId);
      renderView();
      break;
    }

    case 'toggle-status-dropdown': {
      e.stopPropagation();
      closeAllDropdowns();
      closeStatusMenus();

      const prodId = target.dataset.productId;
      const inlineDropdown = document.getElementById(`status-dropdown-${prodId}`);
      if (!inlineDropdown) break;

      const rect = target.getBoundingClientRect();
      const menu = document.createElement('div');
      menu.className = 'status-dropdown status-dropdown-floating';
      menu.innerHTML = inlineDropdown.innerHTML;
      menu.style.position = 'fixed';
      menu.style.top = `${rect.bottom + 6}px`;
      menu.style.right = `${document.documentElement.clientWidth - rect.right}px`;
      document.body.appendChild(menu);
      break;
    }

    case 'set-status': {
      const pid = target.dataset.projectId;
      const prodId = target.dataset.productId;
      const status = target.dataset.status;
      Store.updateProduct(pid, prodId, { status });
      closeAllDropdowns();
      closeStatusMenus();
      closeContextMenus();
      renderView();
      break;
    }

    case 'project-menu': {
      e.stopPropagation();
      const pid = target.dataset.projectId;
      closeContextMenus();
      const rect = target.getBoundingClientRect();
      const menu = document.createElement('div');
      menu.className = 'context-menu';
      menu.style.position = 'fixed';
      menu.style.top = `${rect.bottom + 4}px`;
      menu.style.left = `${rect.right - 140}px`;
      menu.innerHTML = `
        <button class="context-menu-item" data-action="open-project" data-project-id="${pid}">Open</button>
        <button class="context-menu-item context-menu-danger" data-action="confirm-delete-project" data-project-id="${pid}">Delete</button>
      `;
      document.body.appendChild(menu);
      break;
    }

    case 'close-modal':
      closeModal();
      break;
  }
}

async function handleLogin() {
  const input = document.getElementById('passkey-input');
  const error = document.getElementById('login-error');
  const card = document.querySelector('.login-card');
  if (!input) return;

  const passkey = input.value.trim();
  if (!passkey) {
    if (error) {
      error.textContent = 'Please enter a passkey';
      error.style.display = 'block';
    }
    input.focus();
    return;
  }

  try {
    const valid = await Auth.login(passkey);
    if (valid) {
      currentView = 'dashboard';
      app.classList.add('animate-in');
      setTimeout(() => app.classList.remove('animate-in'), 800);
      renderView();
    } else {
      if (error) {
        error.textContent = 'Incorrect passkey. Try again.';
        error.style.display = 'block';
      }
      input.value = '';
      input.focus();
      if (card) {
        card.classList.add('shake');
        setTimeout(() => card.classList.remove('shake'), 500);
      }
    }
  } catch (err) {
    if (error) {
      error.textContent = 'Authentication error. Please try again.';
      error.style.display = 'block';
    }
  }
}

function handleInput(e) {
  const target = e.target;

  if (target.dataset.action === 'global-search') {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      const query = target.value.trim();
      const resultsEl = document.getElementById('search-results');
      if (!resultsEl) return;

      if (query.length < 2) {
        resultsEl.style.display = 'none';
        resultsEl.innerHTML = '';
        return;
      }

      const results = Store.searchProducts(query);
      resultsEl.innerHTML = renderSearchResults(results);
      resultsEl.style.display = 'block';
    }, 200);
  }

  if (target.dataset.action === 'edit-project-name') {
    clearTimeout(target._saveTimeout);
    target._saveTimeout = setTimeout(() => {
      const name = target.textContent.trim();
      if (name) {
        Store.updateProject(target.dataset.projectId, { name });
      }
    }, 500);
  }
}

function handleChange(e) {
  const target = e.target;
  const action = target.dataset.action;

  if (action === 'filter-status') {
    filters.status = target.value;
    renderView();
  } else if (action === 'filter-category') {
    filters.category = target.value;
    renderView();
  } else if (action === 'sort') {
    filters.sort = target.value;
    renderView();
  }
}

function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const action = form.dataset.action;

  if (action === 'login-form') {
    handleLogin();
    return;
  }

  if (action === 'create-project') {
    const name = form.projectName.value.trim();
    if (!name) return;
    const seedData = form.seedData?.checked;
    const project = Store.createProject(name);
    if (seedData) {
      Store.bulkAddProducts(project.id, SEED_PRODUCTS);
    }
    closeModal();
    navigateTo('project', project.id);
  }

  if (action === 'save-amazon-link') {
    const pid = form.dataset.projectId;
    const data = {
      name: form.name.value.trim(),
      description: form.description.value.trim(),
      amazonUrl: form.amazonUrl.value.trim(),
      imageUrl: form.imageUrl?.value.trim() || '',
      price: form.price.value.trim(),
      category: form.category.value,
      status: 'review',
    };

    if (!data.name || !data.amazonUrl) return;

    Store.addProduct(pid, data);
    closeModal();
    renderView();
    showToast('Product added from Amazon link');
    return;
  }

  if (action === 'save-product') {
    const pid = form.dataset.projectId;
    const prodId = form.dataset.productId;
    const data = {
      name: form.name.value.trim(),
      description: form.description.value.trim(),
      amazonUrl: form.amazonUrl.value.trim(),
      imageUrl: form.imageUrl.value.trim(),
      price: form.price.value.trim(),
      category: form.category.value,
      status: form.status.value,
    };

    if (!data.name) return;

    if (prodId) {
      Store.updateProduct(pid, prodId, data);
    } else {
      Store.addProduct(pid, data);
    }

    closeModal();
    renderView();
  }
}

function handleKeydown(e) {
  // Login enter key
  if (e.key === 'Enter' && e.target.id === 'passkey-input') {
    e.preventDefault();
    handleLogin();
    return;
  }

  if (e.key === 'Enter' && e.target.dataset.action === 'quick-add') {
    const name = e.target.value.trim();
    if (!name) return;
    const pid = e.target.dataset.projectId;
    Store.addProduct(pid, { name, status: 'review', category: 'Uncategorized' });
    e.target.value = '';
    renderView();

    requestAnimationFrame(() => {
      const input = document.querySelector('[data-action="quick-add"]');
      if (input) input.focus();
    });
  }

  if (e.key === 'Escape') {
    closeModal();
    closeAllDropdowns();
    closeContextMenus();
    closeStatusMenus();
  }
}

// ── Toast Notifications ──

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('toast-visible'), 10);
  setTimeout(() => {
    toast.classList.remove('toast-visible');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ── Modal Management ──

function showModal(html) {
  modalContainer.innerHTML = html;
  requestAnimationFrame(() => {
    const input = modalContainer.querySelector('input, textarea, select');
    if (input) input.focus();
  });
}

function closeModal() {
  modalContainer.innerHTML = '';
}

// ── Dropdown / Menu Helpers ──

function closeAllDropdowns() {
  document.querySelectorAll('.status-dropdown').forEach((el) => {
    el.style.display = 'none';
  });
}

function closeContextMenus() {
  document.querySelectorAll('.context-menu').forEach((el) => el.remove());
}

function closeStatusMenus() {
  document.querySelectorAll('.status-dropdown-floating').forEach((el) => el.remove());
}

// ── Go ──

init();
