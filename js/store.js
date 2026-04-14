// store.js — localStorage CRUD + data model
const STORAGE_KEY = 'jkd_storefront_tracker';
const SCHEMA_VERSION = 2;
const VALID_STATUSES = ['review', 'ordered', 'shot', 'returned'];
const MAX_NAME_LENGTH = 200;
const MAX_URL_LENGTH = 2048;
const MAX_DESC_LENGTH = 1000;
const MAX_PRODUCTS_PER_PROJECT = 500;

const Store = {
  _data: null,
  _saveQueued: false,

  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  _today() {
    return new Date().toISOString().slice(0, 10);
  },

  _validateStatus(status) {
    return VALID_STATUSES.includes(status) ? status : 'review';
  },

  _truncate(str, max) {
    return typeof str === 'string' ? str.slice(0, max) : '';
  },

  _sanitizeProduct(product) {
    return {
      name: this._truncate(product.name?.trim(), MAX_NAME_LENGTH) || '',
      description: this._truncate(product.description?.trim(), MAX_DESC_LENGTH) || '',
      amazonUrl: this._truncate(product.amazonUrl?.trim(), MAX_URL_LENGTH) || '',
      imageUrl: this._truncate(product.imageUrl?.trim(), MAX_URL_LENGTH) || '',
      price: this._truncate(product.price?.trim(), 50) || '',
      category: this._truncate(product.category?.trim(), 100) || 'Uncategorized',
      status: this._validateStatus(product.status),
    };
  },

  _migrateData(data) {
    if (!data || !Array.isArray(data.projects)) {
      return { projects: [], schemaVersion: SCHEMA_VERSION };
    }

    const migrated = {
      ...data,
      schemaVersion: SCHEMA_VERSION,
      projects: data.projects.map((project) => ({
        id: project.id || this._generateId(),
        name: this._truncate(project.name, MAX_NAME_LENGTH) || 'Untitled Project',
        createdAt: project.createdAt || this._today(),
        products: (project.products || []).map((prod) => ({
          id: prod.id || this._generateId(),
          name: this._truncate(prod.name, MAX_NAME_LENGTH) || '',
          description: this._truncate(prod.description, MAX_DESC_LENGTH) || '',
          amazonUrl: this._truncate(prod.amazonUrl, MAX_URL_LENGTH) || '',
          imageUrl: this._truncate(prod.imageUrl, MAX_URL_LENGTH) || '',
          price: this._truncate(prod.price, 50) || '',
          category: this._truncate(prod.category, 100) || 'Uncategorized',
          status: this._validateStatus(prod.status),
          dateAdded: prod.dateAdded || this._today(),
          dateStatusChanged: prod.dateStatusChanged || this._today(),
        })),
      })),
    };

    return migrated;
  },

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      this._data = this._migrateData(parsed);
    } catch (err) {
      console.error('[Store] Failed to load data from localStorage:', err);
      this._data = { projects: [], schemaVersion: SCHEMA_VERSION };
    }
    return this._data;
  },

  _save() {
    try {
      const json = JSON.stringify(this._data);
      localStorage.setItem(STORAGE_KEY, json);
      return true;
    } catch (err) {
      console.error('[Store] Failed to save:', err);
      window.dispatchEvent(new CustomEvent('store-save-error', { detail: err.message }));
      return false;
    }
  },

  // Debounced save for rapid updates (e.g., inline title editing)
  _debouncedSave() {
    if (this._saveQueued) return;
    this._saveQueued = true;
    requestAnimationFrame(() => {
      this._save();
      this._saveQueued = false;
    });
  },

  isFirstRun() {
    return localStorage.getItem(STORAGE_KEY) === null;
  },

  // ── Projects ──

  getProjects() {
    return [...this._data.projects].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  },

  getProject(id) {
    if (!id) return null;
    return this._data.projects.find((p) => p.id === id) || null;
  },

  createProject(name) {
    const safeName = this._truncate(name?.trim(), MAX_NAME_LENGTH);
    if (!safeName) return null;

    const project = {
      id: this._generateId(),
      name: safeName,
      createdAt: this._today(),
      products: [],
    };
    this._data = {
      ...this._data,
      projects: [...this._data.projects, project],
    };
    this._save();
    return project;
  },

  updateProject(id, updates) {
    if (!this.getProject(id)) return;

    const safeUpdates = {};
    if (updates.name !== undefined) {
      safeUpdates.name = this._truncate(updates.name?.trim(), MAX_NAME_LENGTH) || undefined;
      if (!safeUpdates.name) return; // Don't allow empty names
    }

    this._data = {
      ...this._data,
      projects: this._data.projects.map((p) =>
        p.id === id ? { ...p, ...safeUpdates } : p
      ),
    };
    this._debouncedSave();
  },

  deleteProject(id) {
    if (!this.getProject(id)) return;
    this._data = {
      ...this._data,
      projects: this._data.projects.filter((p) => p.id !== id),
    };
    this._save();
  },

  // ── Products ──

  getProducts(projectId) {
    const project = this.getProject(projectId);
    return project ? [...project.products] : [];
  },

  addProduct(projectId, product) {
    const project = this.getProject(projectId);
    if (!project) return null;

    if (project.products.length >= MAX_PRODUCTS_PER_PROJECT) {
      window.dispatchEvent(new CustomEvent('store-save-error', {
        detail: `Maximum ${MAX_PRODUCTS_PER_PROJECT} products per project`,
      }));
      return null;
    }

    const sanitized = this._sanitizeProduct(product);
    if (!sanitized.name) return null;

    const newProduct = {
      ...sanitized,
      id: this._generateId(),
      dateAdded: this._today(),
      dateStatusChanged: this._today(),
    };

    this._data = {
      ...this._data,
      projects: this._data.projects.map((p) =>
        p.id === projectId
          ? { ...p, products: [...p.products, newProduct] }
          : p
      ),
    };
    this._save();
    return newProduct;
  },

  updateProduct(projectId, productId, updates) {
    const existing = this.getProduct(projectId, productId);
    if (!existing) return;

    const statusChanged =
      updates.status !== undefined && existing.status !== updates.status;

    const finalUpdates = {};

    // Only copy valid update fields
    if (updates.name !== undefined) finalUpdates.name = this._truncate(updates.name?.trim(), MAX_NAME_LENGTH);
    if (updates.description !== undefined) finalUpdates.description = this._truncate(updates.description?.trim(), MAX_DESC_LENGTH);
    if (updates.amazonUrl !== undefined) finalUpdates.amazonUrl = this._truncate(updates.amazonUrl?.trim(), MAX_URL_LENGTH);
    if (updates.imageUrl !== undefined) finalUpdates.imageUrl = this._truncate(updates.imageUrl?.trim(), MAX_URL_LENGTH);
    if (updates.price !== undefined) finalUpdates.price = this._truncate(updates.price?.trim(), 50);
    if (updates.category !== undefined) finalUpdates.category = this._truncate(updates.category?.trim(), 100);
    if (updates.status !== undefined) finalUpdates.status = this._validateStatus(updates.status);
    if (statusChanged) finalUpdates.dateStatusChanged = this._today();

    this._data = {
      ...this._data,
      projects: this._data.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              products: p.products.map((prod) =>
                prod.id === productId ? { ...prod, ...finalUpdates } : prod
              ),
            }
          : p
      ),
    };
    this._save();
  },

  getProduct(projectId, productId) {
    const project = this.getProject(projectId);
    return project?.products.find((p) => p.id === productId) || null;
  },

  deleteProduct(projectId, productId) {
    if (!this.getProduct(projectId, productId)) return;
    this._data = {
      ...this._data,
      projects: this._data.projects.map((p) =>
        p.id === projectId
          ? { ...p, products: p.products.filter((prod) => prod.id !== productId) }
          : p
      ),
    };
    this._save();
  },

  bulkAddProducts(projectId, products) {
    const project = this.getProject(projectId);
    if (!project) return [];

    const existing = project.products;
    const existingNames = new Set(
      existing.map((p) => p.name.toLowerCase().replace(/\s+/g, ' ').trim())
    );

    const remaining = MAX_PRODUCTS_PER_PROJECT - existing.length;
    const unique = products
      .filter((p) => {
        const normalized = (p.name?.trim() || '').toLowerCase().replace(/\s+/g, ' ');
        return normalized && !existingNames.has(normalized);
      })
      .slice(0, remaining);

    if (unique.length === 0) return [];

    const newProducts = unique.map((product) => {
      const sanitized = this._sanitizeProduct(product);
      return {
        ...sanitized,
        id: this._generateId(),
        dateAdded: this._today(),
        dateStatusChanged: this._today(),
      };
    });

    this._data = {
      ...this._data,
      projects: this._data.projects.map((p) =>
        p.id === projectId
          ? { ...p, products: [...p.products, ...newProducts] }
          : p
      ),
    };
    this._save();
    return newProducts;
  },

  // ── Bulk Status Update ──

  bulkUpdateStatus(projectId, productIds, newStatus) {
    const validStatus = this._validateStatus(newStatus);
    const idSet = new Set(productIds);
    const today = this._today();

    this._data = {
      ...this._data,
      projects: this._data.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              products: p.products.map((prod) =>
                idSet.has(prod.id) && prod.status !== validStatus
                  ? { ...prod, status: validStatus, dateStatusChanged: today }
                  : prod
              ),
            }
          : p
      ),
    };
    this._save();
  },

  // ── Stats ──

  getProjectStats(projectId) {
    const products = this.getProducts(projectId);
    return {
      total: products.length,
      review: products.filter((p) => p.status === 'review').length,
      ordered: products.filter((p) => p.status === 'ordered').length,
      shot: products.filter((p) => p.status === 'shot').length,
      returned: products.filter((p) => p.status === 'returned').length,
    };
  },

  getGlobalStats() {
    const all = this._data.projects.flatMap((p) => p.products);
    return {
      total: all.length,
      review: all.filter((p) => p.status === 'review').length,
      ordered: all.filter((p) => p.status === 'ordered').length,
      shot: all.filter((p) => p.status === 'shot').length,
      returned: all.filter((p) => p.status === 'returned').length,
      projects: this._data.projects.length,
    };
  },

  // ── Search (improved with word-boundary matching) ──

  searchProducts(query, projectId = null) {
    const q = query.toLowerCase().trim();
    if (!q || q.length < 2) return [];

    const terms = q.split(/\s+/).filter(Boolean);
    const projects = projectId
      ? [this.getProject(projectId)].filter(Boolean)
      : this._data.projects;

    const results = [];
    for (const project of projects) {
      for (const product of project.products) {
        const searchable = `${product.name} ${product.description} ${product.category} ${product.price}`.toLowerCase();
        const matches = terms.every((term) => searchable.includes(term));
        if (matches) {
          results.push({ ...product, projectId: project.id, projectName: project.name });
        }
      }
    }

    // Sort: exact name matches first, then by date
    return results.sort((a, b) => {
      const aExact = a.name.toLowerCase().includes(q) ? 0 : 1;
      const bExact = b.name.toLowerCase().includes(q) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return new Date(b.dateAdded) - new Date(a.dateAdded);
    });
  },

  // ── Export / Import / Reset ──

  exportData() {
    return JSON.stringify(this._data, null, 2);
  },

  importData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || !Array.isArray(parsed.projects)) {
        return { success: false, error: 'Invalid data format — expected { projects: [...] }' };
      }
      this._data = this._migrateData(parsed);
      this._save();
      return { success: true, projectCount: this._data.projects.length };
    } catch (err) {
      return { success: false, error: `Parse error: ${err.message}` };
    }
  },

  resetData() {
    this._data = { projects: [], schemaVersion: SCHEMA_VERSION };
    this._save();
  },

  // ── Storage Info ──

  getStorageInfo() {
    try {
      const json = JSON.stringify(this._data);
      const bytes = new Blob([json]).size;
      const kb = (bytes / 1024).toFixed(1);
      const productCount = this._data.projects.reduce((sum, p) => sum + p.products.length, 0);
      return {
        sizeKb: kb,
        sizeBytes: bytes,
        projectCount: this._data.projects.length,
        productCount,
      };
    } catch {
      return { sizeKb: '0', sizeBytes: 0, projectCount: 0, productCount: 0 };
    }
  },
};

export default Store;
