// components.js — UI renderers

const STATUS_META = {
  review: { label: 'Under Review', color: 'var(--status-review)', icon: '👁️' },
  ordered: { label: 'Ordered', color: 'var(--status-ordered)', icon: '📦' },
  shot: { label: 'Shot', color: 'var(--status-shot)', icon: '📸' },
  returned: { label: 'Returned', color: 'var(--status-returned)', icon: '↩️' },
};

const STATUS_ORDER = ['review', 'ordered', 'shot', 'returned'];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Login Screen ──

function renderLoginScreen() {
  return `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-logo">
          <img src="assets/logo-primary.svg" alt="Jennifer Kizzee Design" class="login-logo-img" />
        </div>
        <div class="login-divider"></div>
        <h2 class="login-title">Storefront Tracker</h2>
        <p class="login-subtitle">Enter your passkey to continue</p>
        <form class="login-form" data-action="login-form">
          <div class="login-input-wrap">
            <input type="password" id="passkey-input" class="login-input" placeholder="Passkey" autocomplete="off" autofocus />
          </div>
          <div id="login-error" class="login-error"></div>
          <button type="button" class="btn btn-primary login-btn" data-action="login-submit">
            Enter
          </button>
        </form>
        <div class="login-footer">
          <img src="assets/logo-monogram.svg" alt="JKD" class="login-monogram" />
        </div>
      </div>
    </div>
  `;
}

// ── Dashboard ──

function renderDashboard(projects, stats) {
  return `
    <header class="app-header">
      <div class="header-left">
        <img src="assets/logo-monogram.svg" alt="JKD" class="header-monogram" />
        <h1 class="app-title">Storefront Tracker</h1>
        <span class="header-tag">Amazon Storefront</span>
      </div>
      <div class="header-right">
        <div class="global-stats">
          <span class="stat-pill stat-review">${stats.review} review</span>
          <span class="stat-pill stat-ordered">${stats.ordered} ordered</span>
          <span class="stat-pill stat-shot">${stats.shot} shot</span>
          <span class="stat-pill stat-returned">${stats.returned} returned</span>
        </div>
        <button class="btn-icon btn-logout" data-action="logout" title="Sign out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        </button>
      </div>
    </header>

    <div class="dashboard-toolbar">
      <div class="search-wrap">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input type="text" class="search-input" placeholder="Search all products..." data-action="global-search" />
      </div>
      <button class="btn btn-primary" data-action="new-project">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
        New Project
      </button>
    </div>

    <div class="search-results" id="search-results" style="display:none;"></div>

    <section class="projects-grid" id="projects-grid">
      ${projects.length === 0
        ? `<div class="empty-state">
            <div class="empty-icon">📋</div>
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
    <article class="project-card" data-action="open-project" data-project-id="${project.id}">
      <div class="card-header">
        <h3 class="card-title">${escapeHtml(project.name)}</h3>
        <button class="card-menu-btn" data-action="project-menu" data-project-id="${project.id}" title="More options">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="6" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="18" r="1.5"/></svg>
        </button>
      </div>
      <div class="card-stats">
        <span class="card-stat">${stats.total} item${stats.total !== 1 ? 's' : ''}</span>
        <span class="card-date">${project.createdAt}</span>
      </div>
      <div class="progress-bar">
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
    <header class="detail-header">
      <button class="btn btn-ghost" data-action="back-to-dashboard">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back
      </button>
      <div class="detail-title-wrap">
        <h1 class="detail-title" contenteditable="true" spellcheck="false" data-action="edit-project-name" data-project-id="${project.id}">${escapeHtml(project.name)}</h1>
      </div>
      <div class="detail-actions">
        <button class="btn btn-ghost btn-sm" data-action="import-seed" data-project-id="${project.id}" title="Import storefront items">Import Items</button>
        <button class="btn btn-ghost btn-sm btn-danger" data-action="delete-project" data-project-id="${project.id}">Delete</button>
      </div>
    </header>

    <div class="stats-bar">
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

    <div class="detail-toolbar">
      <div class="quick-add-wrap">
        <input type="text" class="quick-add-input" placeholder="Quick add product name..." data-action="quick-add" data-project-id="${project.id}" />
        <kbd class="kbd-hint">↵</kbd>
      </div>
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
    </div>

    <div class="product-list" id="product-list">
      ${products.length === 0
        ? `<div class="empty-state">
            <div class="empty-icon">🏷️</div>
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
    'Loloi Rugs': '🟫',
    'Throw Pillows': '🛋️',
    'Vases': '🏺',
    'Throw Blankets': '🧶',
    'Baskets & Trays': '🧺',
    'Accent Pieces': '✨',
    'Uncategorized': '📦',
  };

  const fallbackIcon = categoryIcons[product.category] || '📦';

  return `
    <div class="product-row" data-product-id="${product.id}">
      <div class="product-thumb">
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
          <button class="status-badge status-${product.status}" data-action="toggle-status-dropdown" data-product-id="${product.id}">
            ${meta.label}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m6 9 6 6 6-6"/></svg>
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
    <div class="modal-overlay" data-action="close-modal">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>${isEdit ? 'Edit Product' : 'Add Product'}</h2>
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
    <div class="modal-overlay" data-action="close-modal">
      <div class="modal modal-sm" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>New Project</h2>
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

function renderConfirmModal(message, action, data = {}) {
  const dataAttrs = Object.entries(data)
    .map(([k, v]) => `data-${k}="${escapeHtml(v)}"`)
    .join(' ');

  return `
    <div class="modal-overlay" data-action="close-modal">
      <div class="modal modal-sm" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>Confirm</h2>
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
    return '<div class="search-empty">No products found</div>';
  }
  return results
    .map(
      (r) => `
    <div class="search-result-item" data-action="open-project" data-project-id="${r.projectId}">
      <span class="search-result-name">${escapeHtml(r.name)}</span>
      <span class="search-result-project">${escapeHtml(r.projectName)}</span>
      <span class="status-badge status-${r.status} status-sm">${(STATUS_META[r.status] ?? STATUS_META['review']).label}</span>
    </div>
  `
    )
    .join('');
}

// ── Project Menu Dropdown ──

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
  renderConfirmModal,
  renderSearchResults,
  renderProjectMenu,
  STATUS_META,
  STATUS_ORDER,
};
