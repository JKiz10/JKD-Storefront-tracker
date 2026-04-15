-- ═══════════════════════════════════════════════════
-- JKD Storefront Tracker — Supabase Setup
-- Run this once in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- Projects table
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at DATE DEFAULT CURRENT_DATE NOT NULL
);

-- Products table
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT '',
  amazon_url TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  price TEXT DEFAULT '',
  category TEXT DEFAULT 'Uncategorized',
  status TEXT DEFAULT 'review' CHECK (status IN ('review', 'ordered', 'shot', 'returned')),
  date_added DATE DEFAULT CURRENT_DATE NOT NULL,
  date_status_changed DATE DEFAULT CURRENT_DATE NOT NULL
);

-- Index for fast product lookups by project
CREATE INDEX idx_products_project_id ON products(project_id);

-- Enable Row Level Security (passkey is the auth layer, so anon gets full access)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on products" ON products FOR ALL USING (true) WITH CHECK (true);

-- Enable real-time for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
