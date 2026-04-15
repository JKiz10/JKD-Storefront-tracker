// components.js — UI renderers

const STATUS_META = {
  review: { label: 'Under Review', color: 'var(--status-review)', icon: '👁️' },
  ordered: { label: 'Ordered', color: 'var(--status-ordered)', icon: '📦' },
  shot: { label: 'Shot', color: 'var(--status-shot)', icon: '📸' },
  returned: { label: 'Returned', color: 'var(--status-returned)', icon: '↩️' },
};

const STATUS_ORDER = ['review', 'ordered', 'shot', 'returned'];
const VALID_STATUSES = STATUS_ORDER;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Login Screen ──

function renderLoginScreen() {
  return `
    <div class="login-screen" role="main">
      <div class="login-card">
        <div class="login-logo">
          <img src="assets/logo-primary.svg" alt="Jennifer Kizzee Design" class="login-logo-img" />
        </div>
        <div class="login-divider" aria-hidden="true"></div>
        <h2 class="login-title">Storefront Tracker</h2>
        <p class="login-subtitle" id="login-desc">Enter your passkey to continue</p>
        <form class="login-form" data-action="login-form" onsubmit="return false;" aria-describedby="login-desc">
          <div class="login-input-wrap">
            <label for="passkey-input" class="sr-only">Passkey</label>
            <input type="password" id="passkey-input" class="login-input" placeholder="Passkey" autocomplete="off" autofocus aria-required="true" />
          </div>
          <div id="login-error" class="login-error" role="alert" aria-live="assertive"></div>
          <button type="submit" class="btn btn-primary login-btn" data-action="login-submit">
            Enter
          </button>
        </form>
        <div class="login-footer" aria-hidden="true">
          <img src="assets/logo-monogram.svg" alt="" class="login-monogram" />
        </div>
      </div>
    </div>
  `;
}

// ── Dashboard ──

function renderDashboard(projects, stats) {
  return `
    <header class="app-header" role="banner">
      <div class="header-left">
        <img src="assets/logo-monogram.svg" alt="" class="header-monogram" aria-hidden="true" />
        <h1 class="app-title">Storefront Tracker</h1>
        <span class="header-tag" aria-label="Amazon Storefront mode">Amazon Storefront</span>
      </div>
      <div class="header-right">
        <div class="global-stats" role="status" aria-label="Global product status">
          <span class="stat-pill stat-review" aria-label="${stats.review} under review">${stats.review} review</span>
          <span class="stat-pill stat-ordered" aria-label="${stats.ordered} ordered">${stats.ordered} ordered</span>
          <span class="stat-pill stat-shot" aria-label="${stats.shot} shot">${stats.shot} shot</span>
          <span class="stat-pill stat-returned" aria-label="${stats.returned} returned">${stats.returned} returned</span>
        </div>
        <span id="sync-indicator" class="sync-dot sync-local" role="status" aria-label="Local only — Supabase not connected"></span>
        <button class="btn-icon" data-action="open-settings" title="Data management" aria-label="Data management">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
        </button>
        <button class="btn-icon btn-logout" data-action="logout" title="Sign out" aria-label="Sign out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        </button>
      </div>
    </header>

    <nav class="dashboard-toolbar" aria-label="Dashboard actions">
      <div class="search-wrap" role="search">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <label for="global-search-input" class="sr-only">Search all products</label>
        <input type="text" id="global-search-input" class="search-input" placeholder="Search all products..." data-action="global-search" autocomplete="off" />
      </div>
      <button class="btn btn-primary" data-action="new-project">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
        New Project
      </button>
    </nav>

    <div class="search-results" id="search-results" role="listbox" aria-label="Search results" style="display:none;"></div>

    <section class="projects-grid" id="projects-grid" aria-label="Projects">
      ${projects.length === 0
        ? `<div class="empty-state" role="status">
            <div class="empty-icon" aria-hidden="true">📋</div>
            <h3>No projects yet</h3>
            <p>Create your first project to start tracking staging items.</p>
          </div>`
        : projects.map((p) => renderProjectCard(p)).join('')}
    </section>
  `;
}

function renderProjectCard(project) {
  const stats = {
    total: project.products.length,
    review: project.products.filter((p) => p.status === 'review').length,
    ordered: project.products.filter((p) => p.status === 'ordered').length,
    shot: project.products.filter((p) => p.status === 'shot').length,
    returned: project.products.filter((p) => p.status === 'returned').length,
  };

  const progressTotal = stats.total || 1;
  const reviewPct = (stats.review / progressTotal) * 100;
  const orderedPct = (stats.ordered / progressTotal) * 100;
  const shotPct = (stats.shot / progressTotal) * 100;
  const returnedPct = (stats.returned / progressTotal) * 100;

  return `
    <article class="project-card" data-action="open-project" data-project-id="${project.id}" role="button" tabindex="0" aria-label="Open project: ${escapeHtml(project.name)}, ${stats.total} items">
      <div class="card-header">
        <h3 class="card-title">${escapeHtml(project.name)}</h3>
        <button class="card-menu-btn" data-action="project-menu" data-project-id="${project.id}" title="More options" aria-label="More options for ${escapeHtml(project.name)}" aria-haspopup="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="6" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="18" r="1.5"/></svg>
        </button>
      </div>
      <div class="card-stats">
        <span class="card-stat">${stats.total} item${stats.total !== 1 ? 's' : ''}</span>
        <span class="card-date">${project.createdAt}</span>
      </div>
      <div class="progress-bar" role="progressbar" aria-label="Project status breakdown" aria-valuenow="${stats.shot + stats.returned}" aria-valuemin="0" aria-valuemax="${stats.total}">
        <div class="progress-segment progress-review" style="width:${reviewPct}%"></div>
        <div class="progress-segment progress-ordered" style="width:${orderedPct}%"></div>
        <div class="progress-segment progress-shot" style="width:${shotPct}%"></div>
        <div class="progress-segment progress-returned" style="width:${returnedPct}%"></div>
      </div>
      <div class="card-status-row">
        <span class="mini-stat"><span class="dot dot-review"></span>${stats.review}</span>
        <span class="mini-stat"><span class="dot dot-ordered"></span>${stats.ordered}</span>
        <span class="mini-stat"><span class="dot dot-shot"></span>${stats.shot}</span>
        <span class="mini-stat"><span class="dot dot-returned"></span>${stats.returned}</span>
      </div>
    </article>
  `;
}

// ── Project Detail ──

function renderProjectDetail(project, products, filters) {
  const stats = {
    total: project.products.length,
    review: project.products.filter((p) => p.status === 'review').length,
    ordered: project.products.filter((p) => p.status === 'ordered').length,
    shot: project.products.filter((p) => p.status === 'shot').length,
    returned: project.products.filter((p) => p.status === 'returned').length,
  };

  const categories = [...new Set(project.products.map((p) => p.category))].sort();

  return `
    <header class="detail-header" role="banner">
      <button class="btn btn-ghost" data-action="back-to-dashboard" aria-label="Back to dashboard">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back
      </button>
      <div class="detail-title-wrap">
        <h1 class="detail-title" contenteditable="true" spellcheck="false" data-action="edit-project-name" data-project-id="${project.id}">${escapeHtml(project.name)}</h1>
      </div>
      <div class="detail-actions">
        <button class="btn btn-ghost btn-sm" data-action="import-seed" data-project-id="${project.id}" title="Import storefront items">Import Items</button>
        <button class="btn btn-ghost btn-sm btn-danger" data-action="confirm-delete-project" data-project-id="${project.id}">Delete</button>
      </div>
    </header>

    <div class="stats-bar" role="group" aria-label="Product statistics">
      <div class="stat-card">
        <span class="stat-number">${stats.total}</span>
        <span class="stat-label">Total</span>
      </div>
      <div class="stat-card stat-card-review">
        <span class="stat-number">${stats.review}</span>
        <span class="stat-label">Review</span>
      </div>
      <div class="stat-card stat-card-ordered">
        <span class="stat-number">${stats.ordered}</span>
        <span class="stat-label">Ordered</span>
      </div>
      <div class="stat-card stat-card-shot">
        <span class="stat-number">${stats.shot}</span>
        <span class="stat-label">Shot</span>
      </div>
      <div class="stat-card stat-card-returned">
        <span class="stat-number">${stats.returned}</span>
        <span class="stat-label">Returned</span>
      </div>
    </div>

    <nav class="detail-toolbar" aria-label="Product actions">
      <div class="quick-add-wrap">
        <label for="quick-add-input" class="sr-only">Quick add product</label>
        <input type="text" id="quick-add-input" class="quick-add-input" placeholder="Quick add product name..." data-action="quick-add" data-project-id="${project.id}" autocomplete="off" />
        <kbd class="kbd-hint" aria-hidden="true">↵</kbd>
      </div>
      <button class="btn btn-ghost btn-sm" data-action="add-from-amazon" data-project-id="${project.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        Add from Link
      </button>
      <div class="filter-controls">
        <select class="filter-select" data-action="filter-status">
          <option value="all" ${filters.status === 'all' ? 'selected' : ''}>All Status</option>
          <option value="review" ${filters.status === 'review' ? 'selected' : ''}>Under Review</option>
          <option value="ordered" ${filters.status === 'ordered' ? 'selected' : ''}>Ordered</option>
          <option value="shot" ${filters.status === 'shot' ? 'selected' : ''}>Shot</option>
          <option value="returned" ${filters.status === 'returned' ? 'selected' : ''}>Returned</option>
        </select>
        <select class="filter-select" data-action="filter-category">
          <option value="all" ${filters.category === 'all' ? 'selected' : ''}>All Categories</option>
          ${categories.map((c) => `<option value="${escapeHtml(c)}" ${filters.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
        </select>
        <select class="filter-select" data-action="sort">
          <option value="date-desc" ${filters.sort === 'date-desc' ? 'selected' : ''}>Newest</option>
          <option value="date-asc" ${filters.sort === 'date-asc' ? 'selected' : ''}>Oldest</option>
          <option value="name-asc" ${filters.sort === 'name-asc' ? 'selected' : ''}>A → Z</option>
          <option value="name-desc" ${filters.sort === 'name-desc' ? 'selected' : ''}>Z → A</option>
          <option value="status" ${filters.sort === 'status' ? 'selected' : ''}>By Status</option>
        </select>
      </div>
    </nav>

    <div class="product-list" id="product-list" role="list" aria-label="Products (${products.length} shown)">
      ${products.length === 0
        ? `<div class="empty-state" role="status">
            <div class="empty-icon" aria-hidden="true">🏷️</div>
            <h3>No products yet</h3>
            <p>Use the quick-add input above or import storefront items.</p>
          </div>`
        : products.map((p) => renderProductRow(p, project.id)).join('')}
    </div>
  `;
}

function renderProductRow(product, projectId) {
  const meta = STATUS_META[product.status] ?? STATUS_META['review'];
  const hasUrl = product.amazonUrl && product.amazonUrl.startsWith('http');
  const hasImage = product.imageUrl && product.imageUrl.startsWith('http');

  const categoryIcons = {
    'Plants & Trees': '🌿',
    'Rugs': '🟫',
    'Loloi Rugs': '🟫',
    'Throw Pillows': '🛋️',
    'Vases': '🏺',
    'Throw Blankets': '🧶',
    'Baskets & Trays': '🧺',
    'Accent Pieces': '✨',
    'Lighting': '💡',
    'Mirrors': '🪞',
    'Wall Art': '🖼️',
    'Furniture': '🪑',
    'Uncategorized': '📦',
  };

  const fallbackIcon = categoryIcons[product.category] || '📦';

  return `
    <div class="product-row" data-product-id="${product.id}" role="listitem">
      <div class="product-thumb" aria-hidden="true">
        ${hasImage
          ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" class="thumb-img" loading="lazy" />`
          : `<div class="thumb-placeholder">${fallbackIcon}</div>`}
      </div>
      <div class="product-main">
        <div class="product-name-wrap">
          ${hasUrl
            ? `<a href="${escapeHtml(product.amazonUrl)}" target="_blank" rel="noopener" class="product-name product-link">${escapeHtml(product.name)}<svg class="external-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg></a>`
            : `<span class="product-name">${escapeHtml(product.name)}</span>`}
          <span class="category-tag">${escapeHtml(product.category)}</span>
        </div>
        ${product.description ? `<p class="product-desc">${escapeHtml(product.description)}</p>` : ''}
      </div>
      <div class="product-meta">
        <span class="product-price">${escapeHtml(product.price)}</span>
        <div class="status-dropdown-wrap">
          <button class="status-badge status-${product.status}" data-action="toggle-status-dropdown" data-product-id="${product.id}" aria-haspopup="listbox" aria-label="Status: ${meta.label}. Click to change">
            ${meta.label}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          <div class="status-dropdown" id="status-dropdown-${product.id}" style="display:none;">
            ${STATUS_ORDER.map((s) => `
              <button class="status-option ${s === product.status ? 'active' : ''}" data-action="set-status" data-project-id="${projectId}" data-product-id="${product.id}" data-status="${s}">
                <span class="dot dot-${s}"></span>${STATUS_META[s].label}
              </button>
            `).join('')}
          </div>
        </div>
        <div class="product-actions">
          <button class="btn-icon" data-action="edit-product" data-project-id="${projectId}" data-product-id="${product.id}" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon btn-icon-danger" data-action="delete-product" data-project-id="${projectId}" data-product-id="${product.id}" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

// ── Modals ──

function renderProductModal(product = null, projectId = '', categories = []) {
  const isEdit = product !== null;
  return `
    <div class="modal-overlay" data-action="close-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title-product">
      <div class="modal" data-modal-body>
        <div class="modal-header">
          <h2 id="modal-title-product">${isEdit ? 'Edit Product' : 'Add Product'}</h2>
          <button class="btn-icon" data-action="close-modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form class="modal-form" data-action="save-product" data-project-id="${projectId}" data-product-id="${isEdit ? product.id : ''}">
          <div class="form-group">
            <label>Product Name *</label>
            <input type="text" name="name" value="${isEdit ? escapeHtml(product.name) : ''}" required autofocus />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea name="description" rows="2">${isEdit ? escapeHtml(product.description) : ''}</textarea>
          </div>
          <div class="form-group">
            <label>Amazon URL</label>
            <input type="url" name="amazonUrl" value="${isEdit ? escapeHtml(product.amazonUrl) : ''}" placeholder="https://amazon.com/..." />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Image URL</label>
              <input type="url" name="imageUrl" value="${isEdit ? escapeHtml(product.imageUrl || '') : ''}" placeholder="https://m.media-amazon.com/..." />
            </div>
            <div class="form-group">
              <label>Price</label>
              <input type="text" name="price" value="${isEdit ? escapeHtml(product.price) : ''}" placeholder="$20–$40" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Category</label>
              <select name="category">
                ${categories.map((c) => `<option value="${escapeHtml(c)}" ${isEdit && product.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
                <option value="Uncategorized" ${isEdit && product.category === 'Uncategorized' ? 'selected' : ''}>Uncategorized</option>
              </select>
            </div>
            <div class="form-group">
              <label>Status</label>
              <select name="status">
                ${STATUS_ORDER.map((s) => `<option value="${s}" ${isEdit && product.status === s ? 'selected' : ''}>${STATUS_META[s].label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">${isEdit ? 'Save Changes' : 'Add Product'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderNewProjectModal() {
  return `
    <div class="modal-overlay" data-action="close-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title-newproject">
      <div class="modal modal-sm" data-modal-body>
        <div class="modal-header">
          <h2 id="modal-title-newproject">New Project</h2>
          <button class="btn-icon" data-action="close-modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form class="modal-form" data-action="create-project">
          <div class="form-group">
            <label>Project Name</label>
            <input type="text" name="projectName" required autofocus placeholder="e.g., Boucher Living Room" />
          </div>
          <div class="form-check">
            <label><input type="checkbox" name="seedData" checked /> Pre-load Amazon Storefront items (26 items)</label>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Create Project</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderAmazonLinkModal(projectId, categories = []) {
  const allCats = [...new Set([...categories, 'Plants & Trees', 'Rugs', 'Throw Pillows', 'Vases', 'Throw Blankets', 'Baskets & Trays', 'Accent Pieces', 'Lighting', 'Mirrors', 'Wall Art', 'Furniture'])].sort();

  return `
    <div class="modal-overlay" data-action="close-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title-amazon">
      <div class="modal" data-modal-body>
        <div class="modal-header">
          <h2 id="modal-title-amazon">Add from Amazon</h2>
          <button class="btn-icon" data-action="close-modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <form class="modal-form" data-action="save-amazon-link" data-project-id="${projectId}">
          <div class="form-group">
            <label>Amazon URL</label>
            <div class="url-input-row">
              <input type="url" name="amazonUrl" id="amazon-url-input" required autofocus placeholder="Paste Amazon product link..." class="url-input" />
              <button type="button" class="btn btn-ghost btn-sm btn-fetch" data-action="fetch-amazon" title="Auto-fill from link">
                <svg class="fetch-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/><polyline points="21 3 21 9 15 9"/></svg>
                <span class="fetch-text">Scan</span>
                <span class="fetch-loading" style="display:none">Scanning...</span>
              </button>
            </div>
            <div id="fetch-status" class="fetch-status"></div>
          </div>

          <div id="amazon-preview" class="amazon-preview" style="display:none">
            <img id="amazon-preview-img" class="amazon-preview-img" src="" alt="" />
          </div>

          <div class="form-group">
            <label>Product Name *</label>
            <input type="text" name="name" id="amazon-name" required placeholder="Auto-fills when you scan..." />
          </div>
          <div class="form-group">
            <label>Image URL</label>
            <input type="url" name="imageUrl" id="amazon-image" placeholder="Auto-fills when you scan..." />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Price</label>
              <input type="text" name="price" id="amazon-price" placeholder="Auto-fills..." />
            </div>
            <div class="form-group">
              <label>Category</label>
              <div class="category-select-wrap">
                <select name="category" id="amazon-category">
                  ${allCats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
                  <option value="__new__">+ New Category...</option>
                </select>
              </div>
            </div>
          </div>
          <div id="new-category-group" class="form-group" style="display:none">
            <label>New Category Name</label>
            <input type="text" id="new-category-input" placeholder="e.g., Mirrors, Wall Art, Lighting..." />
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea name="description" id="amazon-desc" rows="2" placeholder="Brand, size, color, why you like it..."></textarea>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Add Product</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderConfirmModal(message, action, data = {}) {
  const dataAttrs = Object.entries(data)
    .map(([k, v]) => `data-${k}="${escapeHtml(v)}"`)
    .join(' ');

  return `
    <div class="modal-overlay" data-action="close-modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-title-confirm">
      <div class="modal modal-sm" data-modal-body>
        <div class="modal-header">
          <h2 id="modal-title-confirm">Confirm</h2>
        </div>
        <div class="modal-body">
          <p>${message}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" data-action="close-modal">Cancel</button>
          <button class="btn btn-danger" data-action="${action}" ${dataAttrs}>Delete</button>
        </div>
      </div>
    </div>
  `;
}

function renderSearchResults(results) {
  if (results.length === 0) {
    return '<div class="search-empty" role="status">No products found</div>';
  }
  return results
    .map(
      (r) => {
        const safeStatus = VALID_STATUSES.includes(r.status) ? r.status : 'review';
        const meta = STATUS_META[safeStatus] ?? STATUS_META['review'];
        return `
    <div class="search-result-item" data-action="open-project" data-project-id="${escapeHtml(r.projectId)}" role="option" tabindex="0">
      <span class="search-result-name">${escapeHtml(r.name)}</span>
      <span class="search-result-project">${escapeHtml(r.projectName)}</span>
      <span class="status-badge status-${safeStatus} status-sm">${meta.label}</span>
    </div>
  `;
      }
    )
    .join('');
}

// ── Project Menu Dropdown ──

function renderSettingsModal(storageInfo) {
  return `
    <div class="modal-overlay" data-action="close-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title-settings">
      <div class="modal" data-modal-body>
        <div class="modal-header">
          <h2 id="modal-title-settings">Data Management</h2>
          <button class="btn-icon" data-action="close-modal" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="modal-form">
          <div class="settings-info">
            <div class="settings-stat-row">
              <span class="settings-stat-label">Projects</span>
              <span class="settings-stat-value">${storageInfo.projectCount}</span>
            </div>
            <div class="settings-stat-row">
              <span class="settings-stat-label">Total Products</span>
              <span class="settings-stat-value">${storageInfo.productCount}</span>
            </div>
            <div class="settings-stat-row">
              <span class="settings-stat-label">Storage Used</span>
              <span class="settings-stat-value">${storageInfo.sizeKb} KB</span>
            </div>
            <div class="settings-stat-row">
              <span class="settings-stat-label">Cloud Sync</span>
              <span class="settings-stat-value ${storageInfo.connected ? 'sync-status-on' : 'sync-status-off'}">${storageInfo.connected ? '● Connected' : '○ Local Only'}</span>
            </div>
          </div>

          <div class="settings-actions">
            <button class="btn btn-ghost" data-action="export-data" style="width:100%">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              Export Data (JSON)
            </button>
            <label class="btn btn-ghost import-label" style="width:100%;cursor:pointer;justify-content:center" tabindex="0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
              Import Data (JSON)
              <input type="file" accept=".json,application/json" data-action="import-data" class="sr-only" />
            </label>
          </div>

          <div id="settings-status" class="settings-status" role="status" aria-live="polite"></div>

          <div class="settings-danger-zone">
            <p class="danger-zone-label">Danger Zone</p>
            <button class="btn btn-danger" data-action="confirm-reset-data" style="width:100%">
              Reset All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderProjectMenu(projectId) {
  return `
    <div class="context-menu" id="project-menu-${projectId}">
      <button class="context-menu-item" data-action="open-project" data-project-id="${projectId}">Open</button>
      <button class="context-menu-item context-menu-danger" data-action="confirm-delete-project" data-project-id="${projectId}">Delete</button>
    </div>
  `;
}

export {
  renderLoginScreen,
  renderDashboard,
  renderProjectCard,
  renderProjectDetail,
  renderProductRow,
  renderProductModal,
  renderNewProjectModal,
  renderAmazonLinkModal,
  renderConfirmModal,
  renderSearchResults,
  renderSettingsModal,
  renderProjectMenu,
  STATUS_META,
  STATUS_ORDER,
};
