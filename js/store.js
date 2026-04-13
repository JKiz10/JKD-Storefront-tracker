// store.js — localStorage CRUD + data model
const STORAGE_KEY = 'jkd_storefront_tracker';

const Store = {
  _data: null,

  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  _today() {
    return new Date().toISOString().slice(0, 10);
  },

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this._data = raw ? JSON.parse(raw) : null;
    } catch {
      this._data = null;
    }
    if (!this._data || !Array.isArray(this._data.projects)) {
      this._data = { projects: [] };
    }
    return this._data;
  },

  save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
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
    this.save();
    return project;
  },

  updateProject(id, updates) {
    this._data.projects = this._data.projects.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    );
    this.save();
  },

  deleteProject(id) {
    this._data.projects = this._data.projects.filter((p) => p.id !== id);
    this.save();
  },

  // ── Products ──

  getProducts(projectId) {
    const project = this.getProject(projectId);
    return project ? [...project.products] : [];
  },

  addProduct(projectId, product) {
    const newProduct = {
      id: this._generateId(),
      name: product.name?.trim() || '',
      description: product.description?.trim() || '',
      amazonUrl: product.amazonUrl?.trim() || '',
      imageUrl: product.imageUrl?.trim() || '',
      price: product.price?.trim() || '',
      category: product.category || 'Uncategorized',
      status: product.status || 'ordered',
      dateAdded: this._today(),
      dateStatusChanged: this._today(),
    };
    this._data.projects = this._data.projects.map((p) =>
      p.id === projectId
        ? { ...p, products: [...p.products, newProduct] }
        : p
    );
    this.save();
    return newProduct;
  },

  updateProduct(projectId, productId, updates) {
    const statusChanged =
      updates.status !== undefined &&
      this.getProduct(projectId, productId)?.status !== updates.status;

    const finalUpdates = statusChanged
      ? { ...updates, dateStatusChanged: this._today() }
      : updates;

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
    this.save();
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
    this.save();
  },

  bulkAddProducts(projectId, products) {
    const newProducts = products.map((product) => ({
      id: this._generateId(),
      name: product.name?.trim() || '',
      description: product.description?.trim() || '',
      amazonUrl: product.amazonUrl?.trim() || '',
      imageUrl: product.imageUrl?.trim() || '',
      price: product.price?.trim() || '',
      category: product.category || 'Uncategorized',
      status: product.status || 'ordered',
      dateAdded: this._today(),
      dateStatusChanged: this._today(),
    }));
    this._data.projects = this._data.projects.map((p) =>
      p.id === projectId
        ? { ...p, products: [...p.products, ...newProducts] }
        : p
    );
    this.save();
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
    this._data = { projects: [] };
    this.save();
  },
};

export default Store;
