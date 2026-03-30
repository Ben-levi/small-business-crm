-- Run this in the Neon SQL editor after creating your project

CREATE TABLE admins (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE customers (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255) UNIQUE,
  phone      VARCHAR(50),
  address    TEXT,
  notes      TEXT,
  source     VARCHAR(50) DEFAULT 'manual',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
  id          SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),
  status      VARCHAR(20) DEFAULT 'pending'
                CHECK (status IN ('pending','processing','shipped','delivered')),
  items       JSONB,
  total       NUMERIC(10,2),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

-- Index for fast customer search
CREATE INDEX idx_customers_name  ON customers USING gin(to_tsvector('english', name));
CREATE INDEX idx_customers_email ON customers (email);

-- Index for order filters
CREATE INDEX idx_orders_status      ON orders (status);
CREATE INDEX idx_orders_customer_id ON orders (customer_id);
CREATE INDEX idx_orders_created_at  ON orders (created_at);

-- Seed first admin (password: admin123  — change immediately after first login!)
-- Generate your own hash with: node -e "const b=require('bcryptjs');b.hash('yourpassword',10).then(console.log)"
INSERT INTO admins (email, password_hash)
VALUES ('admin@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi');
