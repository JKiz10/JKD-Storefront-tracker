// store.js — localStorage CRUD + Supabase real-time sync
// Architecture: optimistic local writes (instant UI) + background Supabase push
// If Supabase is unreachable or unconfigured, falls back to localStorage only.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const STORAGE_KEY = 'jkd_storefront_tracker';
const SCHEMA_VERSION = 2;
const VALID_STATUSES = ['review', 'ordered', 'shot', 'returned'];
const MAX_NAME_LENGTH = 200;
const MAX_URL_LENGTH = 2048;
const MAX_DESC_LENGTH = 1000;
const MAX_PRODUCTS_PER_PROJECT = 500;

const Store = {
  _data: null,
  _sb: null,
  _channel: null,
  _connected: false,
  _onSync: null,
  _onConnectionChange: null,
  _saveQueued: false,

  // ── ID & Date helpers ──

  _generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
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

  // ── Column mapping: camelCase (JS) ↔ snake_case (Postgres) ──

  _productToDb(product, projectId) {
    return {
      id: product.id,
      project_id: projectId,
      name: product.name || '',
      description: product.description || '',
      amazon_url: product.amazonUrl || '',
      image_url: product.imageUrl || '',
      price: product.price || '',
      category: product.category || 'Uncategorized',
      status: product.status || 'review',
      date_added: product.dateAdded || this._today(),
      date_status_changed: product.dateStatusChanged || this._today(),
    };
  },

  _productFromDb(row) {
    return {
      id: row.id,
      name: row.name || '',
      description: row.description || '',
      amazonUrl: row.amazon_url || '',
      imageUrl: row.image_url || '',
      price: row.price || '',
      category: row.category || 'Uncategorized',
      status: this._validateStatus(row.status),
      dateAdded: row.date_added || this._today(),
      dateStatusChanged: row.date_status_changed || this._today(),
    };
  },

  _projectToDb(project) {
    return {
      id: project.id,
      name: project.name,
      created_at: project.createdAt || this._today(),
    };
  },

  _projectFromDb(row) {
    return {
      id: row.id,
      name: row.name || 'Untitled Project',
      createdAt: row.created_at || this._today(),
      products: (row.products || []).map((p) => this._productFromDb(p)),
    };
  },

  // ── localStorage layer ──

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

  _loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      this._data = this._migrateData(parsed);
    } catch (err) {
      console.error('[Store] Failed to load localStorage:', err);
      this._data = { projects: [], schemaVersion: SCHEMA_VERSION };
    }
    return this._data;
  },

  _saveLocal() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
      return true;
    } catch (err) {
      console.error('[Store] Failed to save localStorage:', err);
      window.dispatchEvent(new CustomEvent('store-save-error', { detail: err.message }));
      return false;
    }
  },

  _debouncedSaveLocal() {
    if (this._saveQueued) return;
    this._saveQueued = true;
    requestAnimationFrame(() => {
      this._saveLocal();
      this._saveQueued = false;
    });
  },

  // ══════════════════════════════════════════════
  // SUPABASE SYNC LAYER
  // ══════════════════════════════════════════════

  async init() {
    // 1. Load localStorage immediately (instant first paint)
    this._loadLocal();

    // 2. Try to connect to Supabase
    if (!SUPABASE_URL || SUPABASE_URL.includes('YOUR_')) {
      console.info('[Store] Supabase not configured — localStorage only mode');
      return;
    }

    try {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      this._sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

      // 3. Fetch remote data
      const remote = await this._fetchAll();

      if (remote.projects.length === 0 && this._data.projects.length > 0) {
        // Migration: local data exists but Supabase is empty — push everything up
        console.info('[Store] Migrating localStorage data to Supabase...');
        await this._pushAll();
      } else if (remote.projects.length > 0) {
        // Use Supabase as source of truth
        this._data = remote;
        this._saveLocal();
      }
      // If both empty, let the caller seed data

      this._connected = true;
      this._notifyConnection(true);

      // 4. Start real-time subscription
      this._subscribe();
    } catch (err) {
      console.warn('[Store] Supabase unavailable, using localStorage only:', err.message);
      this._connected = false;
    }
  },

  // Fetch all projects with nested products from Supabase
  async _fetchAll() {
    const { data, error } = await this._sb
      .from('projects')
      .select('*, products(*)');

    if (error) throw error;

    return {
      projects: (data || []).map((p) => this._projectFromDb(p)),
      schemaVersion: SCHEMA_VERSION,
    };
  },

  // Push all localStorage data up to Supabase (one-time migration)
  async _pushAll() {
    for (const project of this._data.projects) {
      const { error: pErr } = await this._sb
        .from('projects')
        .upsert(this._projectToDb(project));
      if (pErr) console.warn('[Store] Push project failed:', pErr.message);

      if (project.products.length > 0) {
        const rows = project.products.map((p) => this._productToDb(p, project.id));
        const { error: prodErr } = await this._sb
          .from('products')
          .upsert(rows);
        if (prodErr) console.warn('[Store] Push products failed:', prodErr.message);
      }
    }
  },

  // Real-time Postgres Changes subscription
  _subscribe() {
    if (!this._sb) return;

    this._channel = this._sb
      .channel('tracker-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => this._onRemoteChange())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => this._onRemoteChange())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.info('[Store] Real-time subscription active');
        }
      });
  },

  // When another client changes data, re-fetch everything and re-render
  async _onRemoteChange() {
    if (!this._sb) return;
    try {
      const remote = await this._fetchAll();
      this._data = remote;
      this._saveLocal();
      if (this._onSync) this._onSync();
    } catch (err) {
      console.warn('[Store] Real-time sync failed:', err.message);
    }
  },

  // ── Fire-and-forget remote push helpers ──

  _pushProjectRemote(project) {
    if (!this._sb) return;
    this._sb.from('projects').upsert(this._projectToDb(project))
      .then(({ error }) => { if (error) console.warn('[Store] Sync project:', error.message); });
  },

  _pushProductRemote(projectId, product) {
    if (!this._sb) return;
    this._sb.from('products').upsert(this._productToDb(product, projectId))
      .then(({ error }) => { if (error) console.warn('[Store] Sync product:', error.message); });
  },

  _pushProductsRemote(projectId, products) {
    if (!this._sb || products.length === 0) return;
    const rows = products.map((p) => this._productToDb(p, projectId));
    this._sb.from('products').upsert(rows)
      .then(({ error }) => { if (error) console.warn('[Store] Sync products:', error.message); });
  },

  _removeProjectRemote(id) {
    if (!this._sb) return;
    this._sb.from('projects').delete().eq('id', id)
      .then(({ error }) => { if (error) console.warn('[Store] Remove project:', error.message); });
  },

  _removeProductRemote(id) {
    if (!this._sb) return;
    this._sb.from('products').delete().eq('id', id)
      .then(({ error }) => { if (error) console.warn('[Store] Remove product:', error.message); });
  },

  _removeProductsRemote(ids) {
    if (!this._sb || ids.length === 0) return;
    this._sb.from('products').delete().in('id', ids)
      .then(({ error }) => { if (error) console.warn('[Store] Remove products:', error.message); });
  },

  // ── Callbacks ──

  onSync(cb) { this._onSync = cb; },
  onConnectionChange(cb) { this._onConnectionChange = cb; },
  _notifyConnection(state) {
    this._connected = state;
    if (this._onConnectionChange) this._onConnectionChange(state);
  },
  isConnected() { return this._connected; },

  // ══════════════════════════════════════════════
  // PUBLIC API (unchanged signatures — optimistic local + background push)
  // ══════════════════════════════════════════════

  isFirstRun() {
    return this._data.projects.length === 0;
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
    this._saveLocal();
    this._pushProjectRemote(project);
    return project;
  },

  updateProject(id, updates) {
    if (!this.getProject(id)) return;

    const safeUpdates = {};
    if (updates.name !== undefined) {
      safeUpdates.name = this._truncate(updates.name?.trim(), MAX_NAME_LENGTH) || undefined;
      if (!safeUpdates.name) return;
    }

    this._data = {
      ...this._data,
      projects: this._data.projects.map((p) =>
        p.id === id ? { ...p, ...safeUpdates } : p
      ),
    };
    this._debouncedSaveLocal();

    // Push updated project to Supabase
    const updated = this.getProject(id);
    if (updated) this._pushProjectRemote(updated);
  },

  deleteProject(id) {
    if (!this.getProject(id)) return;
    this._data = {
      ...this._data,
      projects: this._data.projects.filter((p) => p.id !== id),
    };
    this._saveLocal();
    this._removeProjectRemote(id); // cascade deletes products in Supabase
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
    this._saveLocal();
    this._pushProductRemote(projectId, newProduct);
    return newProduct;
  },

  updateProduct(projectId, productId, updates) {
    const existing = this.getProduct(projectId, productId);
    if (!existing) return;

    const statusChanged =
      updates.status !== undefined && existing.status !== updates.status;

    const finalUpdates = {};
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
    this._saveLocal();

    const updated = this.getProduct(projectId, productId);
    if (updated) this._pushProductRemote(projectId, updated);
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
    this._saveLocal();
    this._removeProductRemote(productId);
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
    this._saveLocal();
    this._pushProductsRemote(projectId, newProducts);
    return newProducts;
  },

  bulkUpdateStatus(projectId, productIds, newStatus) {
    const validStatus = this._validateStatus(newStatus);
    const idSet = new Set(productIds);
    const today = this._today();
    const changed = [];

    this._data = {
      ...this._data,
      projects: this._data.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              products: p.products.map((prod) => {
                if (idSet.has(prod.id) && prod.status !== validStatus) {
                  const updated = { ...prod, status: validStatus, dateStatusChanged: today };
                  changed.push(updated);
                  return updated;
                }
                return prod;
              }),
            }
          : p
      ),
    };
    this._saveLocal();
    this._pushProductsRemote(projectId, changed);
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
      this._saveLocal();

      // Push imported data to Supabase
      if (this._sb) {
        this._pushAll().catch((err) =>
          console.warn('[Store] Import sync failed:', err.message)
        );
      }

      return { success: true, projectCount: this._data.projects.length };
    } catch (err) {
      return { success: false, error: `Parse error: ${err.message}` };
    }
  },

  resetData() {
    // Clear Supabase first (delete all projects — cascade deletes products)
    if (this._sb) {
      this._sb.from('products').delete().neq('id', '')
        .then(() => this._sb.from('projects').delete().neq('id', ''))
        .catch((err) => console.warn('[Store] Reset sync failed:', err.message));
    }

    this._data = { projects: [], schemaVersion: SCHEMA_VERSION };
    this._saveLocal();
  },

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
        connected: this._connected,
      };
    } catch {
      return { sizeKb: '0', sizeBytes: 0, projectCount: 0, productCount: 0, connected: false };
    }
  },
};

export default Store;
