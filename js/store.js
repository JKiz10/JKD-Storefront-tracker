// store.js — localStorage CRUD + data model
const STORAGE_KEY = 'jkd_storefront_tracker';
const SCHEMA_VERSION = 2;
const VALID_STATUSES = ['review', 'ordered', 'shot', 'returned'];

const Store = {
  _data: null,

  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  _today() {
    return new Date().toISOString().slice(0, 10);
  },

  _validateStatus(status) {
    return VALID_STATUSES.includes(status) ? status : 'review';
  },

  _sanitizeProduct(product) {
    return {
      name: product.name?.trim() || '',
      description: product.description?.trim() || '',
      amazonUrl: product.amazonUrl?.trim() || '',
      imageUrl: product.imageUrl?.trim() || '',
      price: product.price?.trim() || '',
      category: product.category || 'Uncategorized',
      status: this._validateStatus(product.status),
    };
  },

  _migrateData(data) {
    if (!data || !Array.isArray(data.projects)) {
      return { projects: [], schemaVersion: SCHEMA_VERSION };
    }

    // Fill missing fields on all products
    const migrated = {
      ...data,
      schemaVersion: SCHEMA_VERSION,
      projects: data.projects.map((project) => ({
        id: project.id || this._generateId(),
        name: project.name || 'Untitled Project',
        createdAt: project.createdAt || this._today(),
        products: (project.products || []).map((prod) => ({
          id: prod.id || this._generateId(),
          name: prod.name || '',
          description: prod.description || '',
          amazonUrl: prod.amazonUrl || '',
          imageUrl: prod.imageUrl || '',
          price: prod.price || '',
          category: prod.category || 'Uncategorized',
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
      return true;
    } catch (err) {
      console.error('[Store] Failed to save:', err);
      // Dispatch custom event so app.js can show a toast
      window.dispatchEvent(new CustomEvent('store-save-error', { detail: err.message }));
      return false;
    }
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
    return this._data.projects.find((p) => p.id === id) || null;
  },

  createProject(name) {
    const project = {
      id: this._generateId(),
      name: name.trim(),
      createdAt: this._today(),
      products: [],
    };
    this._data.projects = [...this._data.projects, project];
    this._save();
    return project;
  },

  updateProject(id, updates) {
    if (!this.getProject(id)) return;
    this._data.projects = this._data.projects.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    );
    this._save();
  },

  deleteProject(id) {
    if (!this.getProject(id)) return;
    this._data.projects = this._data.projects.filter((p) => p.id !== id);
    this._save();
  },

  // ── Products ──

  getProducts(projectId) {
    const project = this.getProject(projectId);
    return project ? [...project.products] : [];
  },

  addProduct(projectId, product) {
    const sanitized = this._sanitizeProduct(product);
    const newProduct = {
      ...sanitized,
      id: this._generateId(),
      dateAdded: this._today(),
      dateStatusChanged: this._today(),
    };
    this._data.projects = this._data.projects.map((p) =>
      p.id === projectId
        ? { ...p, products: [...p.products, newProduct] }
        : p
    );
    this._save();
    return newProduct;
  },

  updateProduct(projectId, productId, updates) {
    const existing = this.getProduct(projectId, productId);
    if (!existing) return;

    const statusChanged =
      updates.status !== undefined && existing.status !== updates.status;

    const finalUpdates = {
      ...updates,
      ...(updates.status !== undefined && { status: this._validateStatus(updates.status) }),
      ...(statusChanged && { dateStatusChanged: this._today() }),
    };

    this._data.projects = this._data.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            products: p.products.map((prod) =>
              prod.id === productId ? { ...prod, ...finalUpdates } : prod
            ),
          }
        : p
    );
    this._save();
  },

  getProduct(projectId, productId) {
    const project = this.getProject(projectId);
    return project?.products.find((p) => p.id === productId) || null;
  },

  deleteProduct(projectId, productId) {
    this._data.projects = this._data.projects.map((p) =>
      p.id === projectId
        ? { ...p, products: p.products.filter((prod) => prod.id !== productId) }
        : p
    );
    this._save();
  },

  bulkAddProducts(projectId, products) {
    const existing = this.getProducts(projectId);
    const existingNames = new Set(
      existing.map((p) => p.name.toLowerCase().replace(/\s+/g, ' '))
    );

    const unique = products.filter(
      (p) => !existingNames.has((p.name?.trim() || '').toLowerCase().replace(/\s+/g, ' '))
    );

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

    this._data.projects = this._data.projects.map((p) =>
      p.id === projectId
        ? { ...p, products: [...p.products, ...newProducts] }
        : p
    );
    this._save();
    return newProducts;
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

  // ── Search ──

  searchProducts(query, projectId = null) {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const projects = projectId
      ? [this.getProject(projectId)].filter(Boolean)
      : this._data.projects;

    const results = [];
    for (const project of projects) {
      for (const product of project.products) {
        const searchable = `${product.name} ${product.description} ${product.category}`.toLowerCase();
        if (searchable.includes(q)) {
          results.push({ ...product, projectId: project.id, projectName: project.name });
        }
      }
    }
    return results;
  },

  // ── Export / Reset ──

  exportData() {
    return JSON.stringify(this._data, null, 2);
  },

  resetData() {
    this._data = { projects: [], schemaVersion: SCHEMA_VERSION };
    this._save();
  },
};

export default Store;
