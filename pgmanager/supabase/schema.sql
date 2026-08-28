-- ============================================================
-- PG Manager — Complete Supabase Schema
-- Run this ONE file in Supabase SQL Editor to set up everything
-- ============================================================

-- ─── ENUMS ─────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('ADMIN', 'MANAGER', 'ACCOUNTANT', 'STAFF');
CREATE TYPE tenant_status AS ENUM ('ACTIVE', 'NOTICE_PERIOD', 'CHECKED_OUT', 'INACTIVE');
CREATE TYPE rent_status AS ENUM ('PAID', 'PARTIAL', 'DUE', 'OVERDUE', 'ADVANCE');
CREATE TYPE payment_method AS ENUM ('UPI', 'BANK_TRANSFER', 'CASH', 'CARD', 'CHEQUE', 'OTHER');
CREATE TYPE txn_type AS ENUM ('CREDIT', 'DEBIT');
CREATE TYPE txn_status AS ENUM ('UNMATCHED', 'MATCHED', 'MANUAL_MATCHED', 'IGNORED', 'DUPLICATE');
CREATE TYPE expense_category AS ENUM (
  'ELECTRICITY', 'WATER', 'INTERNET', 'MAINTENANCE', 'CLEANING',
  'REPAIRS', 'SALARY', 'RENT', 'SUPPLIES', 'OTHER'
);
CREATE TYPE notification_type AS ENUM ('INFO', 'WARNING', 'URGENT', 'SUCCESS');

-- ─── USERS & AUTH ──────────────────────────────────────────

CREATE TABLE users (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email        TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role         user_role DEFAULT 'STAFF',
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- ─── ROOMS & BEDS ─────────────────────────────────────────

CREATE TABLE rooms (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  number     TEXT UNIQUE NOT NULL,
  floor      INT DEFAULT 0,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE beds (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  number     TEXT NOT NULL,
  room_id    TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(room_id, number)
);

CREATE INDEX idx_beds_room ON beds(room_id);

-- ─── TENANTS ───────────────────────────────────────────────

CREATE TABLE tenants (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name             TEXT NOT NULL,
  phone            TEXT,
  email            TEXT,
  emergency_contact TEXT,
  id_type          TEXT,
  id_number        TEXT,
  notes            TEXT,
  status           tenant_status DEFAULT 'ACTIVE',
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tenant_assignments (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id        TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bed_id           TEXT NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  monthly_rent     NUMERIC(10,2) NOT NULL,
  security_deposit NUMERIC(10,2),
  joining_date     TIMESTAMPTZ NOT NULL,
  checkout_date    TIMESTAMPTZ,
  due_date         INT DEFAULT 5,
  is_active        BOOLEAN DEFAULT true,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tenant_aliases (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id  TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  alias      TEXT NOT NULL,
  source     TEXT, -- 'upi', 'bank', 'manual'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, alias)
);

CREATE INDEX idx_assignments_tenant ON tenant_assignments(tenant_id);
CREATE INDEX idx_assignments_bed ON tenant_assignments(bed_id);
CREATE INDEX idx_assignments_active ON tenant_assignments(is_active);
CREATE INDEX idx_aliases_tenant ON tenant_aliases(tenant_id);

-- ─── RENT RECORDS ──────────────────────────────────────────

CREATE TABLE rent_records (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  assignment_id TEXT NOT NULL REFERENCES tenant_assignments(id) ON DELETE CASCADE,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bed_id        TEXT NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  month         TEXT NOT NULL, -- 'YYYY-MM'
  rent_due      NUMERIC(10,2) NOT NULL,
  amount_paid   NUMERIC(10,2) DEFAULT 0,
  status        rent_status DEFAULT 'DUE',
  due_date      TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(assignment_id, month)
);

CREATE INDEX idx_rent_month ON rent_records(month);
CREATE INDEX idx_rent_tenant ON rent_records(tenant_id);
CREATE INDEX idx_rent_status ON rent_records(status);
CREATE INDEX idx_rent_assignment ON rent_records(assignment_id);

-- ─── PAYMENTS ──────────────────────────────────────────────

CREATE TABLE payments (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id           TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount              NUMERIC(10,2) NOT NULL,
  date                TIMESTAMPTZ DEFAULT now(),
  method              payment_method DEFAULT 'BANK_TRANSFER',
  purpose             TEXT,
  rent_month          TEXT, -- 'YYYY-MM'
  transaction_id      TEXT,
  bank_reference      TEXT,
  receipt_number      TEXT,
  notes               TEXT,
  is_reversed         BOOLEAN DEFAULT false,
  reversed_at         TIMESTAMPTZ,
  created_by          TEXT REFERENCES users(id),
  bank_transaction_id TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_month ON payments(rent_month);
CREATE INDEX idx_payments_date ON payments(date);
CREATE INDEX idx_payments_method ON payments(method);
CREATE INDEX idx_payments_reversed ON payments(is_reversed);

-- ─── BANK STATEMENTS ───────────────────────────────────────

CREATE TABLE import_batches (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  file_name    TEXT NOT NULL,
  file_type    TEXT NOT NULL,
  row_count    INT DEFAULT 0,
  matched_count INT DEFAULT 0,
  status       TEXT DEFAULT 'pending',
  imported_by  TEXT REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE bank_transactions (
  id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  import_batch_id      TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  sl_no                INT,
  value_date           TIMESTAMPTZ NOT NULL,
  original_description TEXT NOT NULL,
  parsed_description   TEXT,
  parsed_name          TEXT,
  amount               NUMERIC(10,2) NOT NULL,
  type                 txn_type NOT NULL,
  balance              NUMERIC(12,2),
  reference            TEXT,
  is_duplicate         BOOLEAN DEFAULT false,
  duplicate_of_id      TEXT REFERENCES bank_transactions(id),
  status               txn_status DEFAULT 'UNMATCHED',
  confidence           NUMERIC(5,2),
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_bank_txn_batch ON bank_transactions(import_batch_id);
CREATE INDEX idx_bank_txn_ref ON bank_transactions(reference);
CREATE INDEX idx_bank_txn_amount ON bank_transactions(amount);
CREATE INDEX idx_bank_txn_status ON bank_transactions(status);
CREATE INDEX idx_bank_txn_date ON bank_transactions(value_date);

-- ─── EXPENSES ──────────────────────────────────────────────

CREATE TABLE expenses (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  date           TIMESTAMPTZ DEFAULT now(),
  category       expense_category DEFAULT 'OTHER',
  description    TEXT NOT NULL,
  amount         NUMERIC(10,2) NOT NULL,
  method         payment_method DEFAULT 'BANK_TRANSFER',
  vendor         TEXT,
  reference      TEXT,
  notes          TEXT,
  attachment_url TEXT,
  created_by     TEXT REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);

-- ─── RECEIPTS ──────────────────────────────────────────────

CREATE TABLE receipts (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  receipt_number    TEXT UNIQUE NOT NULL,
  payment_id        TEXT UNIQUE NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  tenant_name       TEXT NOT NULL,
  room_number       TEXT NOT NULL,
  bed_number        TEXT NOT NULL,
  amount            NUMERIC(10,2) NOT NULL,
  payment_date      TIMESTAMPTZ NOT NULL,
  payment_method    TEXT NOT NULL,
  rent_month        TEXT NOT NULL,
  previous_balance  NUMERIC(10,2) DEFAULT 0,
  amount_paid       NUMERIC(10,2) NOT NULL,
  remaining_balance NUMERIC(10,2) DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ─── NOTIFICATIONS ─────────────────────────────────────────

CREATE TABLE notifications (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  type        notification_type DEFAULT 'INFO',
  is_read     BOOLEAN DEFAULT false,
  entity_type TEXT,
  entity_id   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notif_read ON notifications(is_read);
CREATE INDEX idx_notif_date ON notifications(created_at);

-- ─── AUDIT LOG ─────────────────────────────────────────────

CREATE TABLE audit_logs (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id        TEXT REFERENCES users(id),
  action         TEXT NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'MATCH'
  entity         TEXT NOT NULL, -- 'tenant', 'payment', 'room', etc.
  entity_id      TEXT,
  previous_value TEXT,
  new_value      TEXT,
  ip_address     TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_date ON audit_logs(created_at);
CREATE INDEX idx_audit_user ON audit_logs(user_id);

-- ─── SETTINGS ──────────────────────────────────────────────

CREATE TABLE settings (
  id    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key   TEXT UNIQUE NOT NULL,
  value TEXT
);

-- ─── DEFAULT SETTINGS ──────────────────────────────────────

INSERT INTO settings (key, value) VALUES
  ('hostel_name', 'My PG'),
  ('address', ''),
  ('contact_phone', ''),
  ('contact_email', ''),
  ('rent_due_date', '5'),
  ('currency', 'INR'),
  ('receipt_prefix', 'RCP'),
  ('pg_start_date', '');

-- ─── HELPER FUNCTIONS ──────────────────────────────────────

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables that have it
CREATE TRIGGER trg_users_updated    BEFORE UPDATE ON users           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rooms_updated    BEFORE UPDATE ON rooms           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_beds_updated     BEFORE UPDATE ON beds            FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_tenants_updated  BEFORE UPDATE ON tenants         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_assignments_updated BEFORE UPDATE ON tenant_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_rent_updated     BEFORE UPDATE ON rent_records    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON payments        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_expenses_updated BEFORE UPDATE ON expenses        FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ROW LEVEL SECURITY ────────────────────────────────────
-- Enable RLS on all tables (policies added below)

ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms              ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds               ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants            ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_aliases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rent_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches     ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings           ENABLE ROW LEVEL SECURITY;

-- For a single-user / single-account PG app, allow all authenticated access
-- Replace these with more restrictive policies if you need multi-tenant RLS

CREATE POLICY "Allow all for authenticated" ON users              FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON sessions           FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON rooms              FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON beds               FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON tenants            FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON tenant_assignments FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON tenant_aliases     FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON rent_records       FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON payments           FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON import_batches     FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON bank_transactions  FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON expenses           FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON receipts           FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON notifications      FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON audit_logs         FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated" ON settings           FOR ALL USING (true);

-- ─── DEMO DATA (optional) ──────────────────────────────────
-- Uncomment the block below to load sample data

/*
-- Demo admin user (password: admin12345)
INSERT INTO users (id, email, name, password_hash, role) VALUES
  ('demo-admin-001', 'admin@pgmanager.com', 'Admin', '$2b$10$rQEY5z8vQx8vQx8vQx8vQe.Y5z8vQx8vQx8vQx8vQx8vQx8vQx8', 'ADMIN');

-- Demo rooms
INSERT INTO rooms (id, number, floor) VALUES
  ('room-101', '101', 1),
  ('room-102', '102', 1),
  ('room-103', '103', 1),
  ('room-201', '201', 2),
  ('room-202', '202', 2);

-- Demo beds (2 per room)
INSERT INTO beds (id, number, room_id) VALUES
  ('bed-101-a', 'A', 'room-101'),
  ('bed-101-b', 'B', 'room-101'),
  ('bed-102-a', 'A', 'room-102'),
  ('bed-102-b', 'B', 'room-102'),
  ('bed-103-a', 'A', 'room-103'),
  ('bed-103-b', 'B', 'room-103'),
  ('bed-201-a', 'A', 'room-201'),
  ('bed-201-b', 'B', 'room-201'),
  ('bed-202-a', 'A', 'room-202'),
  ('bed-202-b', 'B', 'room-202');

-- Demo tenants
INSERT INTO tenants (id, name, phone, email, status) VALUES
  ('t-001', 'Sakshi Hari Ram', '9876543210', 'sakshi@email.com', 'ACTIVE'),
  ('t-002', 'Amruta Patil', '9876543211', 'amruta@email.com', 'ACTIVE'),
  ('t-003', 'Priya Sharma', '9876543212', 'priya@email.com', 'ACTIVE'),
  ('t-004', 'Neha Gupta', '9876543213', 'neha@email.com', 'ACTIVE'),
  ('t-005', 'Kajal Jain', '9876543214', 'kajal@email.com', 'ACTIVE'),
  ('t-006', 'Riya Deshmukh', '9876543215', 'riya@email.com', 'ACTIVE'),
  ('t-007', 'Sneha Kulkarni', '9876543216', 'sneha@email.com', 'NOTICE_PERIOD'),
  ('t-008', 'Pooja Verma', '9876543217', 'pooja@email.com', 'CHECKED_OUT'),
  ('t-009', 'Aisha Khan', '9876543218', 'aisha@email.com', 'ACTIVE');

-- Assign tenants to beds
INSERT INTO tenant_assignments (id, tenant_id, bed_id, monthly_rent, security_deposit, joining_date, due_date, is_active) VALUES
  ('a-001', 't-001', 'bed-101-a', 5000, 10000, '2025-01-15', 5, true),
  ('a-002', 't-002', 'bed-101-b', 5000, 10000, '2025-01-15', 5, true),
  ('a-003', 't-003', 'bed-102-a', 5500, 11000, '2025-02-01', 5, true),
  ('a-004', 't-004', 'bed-102-b', 5500, 11000, '2025-03-01', 5, true),
  ('a-005', 't-005', 'bed-103-a', 5000, 10000, '2025-04-01', 5, true),
  ('a-006', 't-006', 'bed-103-b', 5000, 10000, '2025-05-01', 5, true),
  ('a-007', 't-007', 'bed-201-a', 6000, 12000, '2025-06-01', 5, true),
  ('a-008', 't-009', 'bed-201-b', 6000, 12000, '2025-07-01', 5, true);

-- Demo aliases
INSERT INTO tenant_aliases (tenant_id, alias, source) VALUES
  ('t-001', 'SAKSHI HARI RAM', 'upi'),
  ('t-001', 'Sakshi H R', 'bank'),
  ('t-002', 'AMRUTA PATIL', 'upi'),
  ('t-003', 'PRIYA SHARMA', 'upi');

-- Demo rent records for current month
INSERT INTO rent_records (assignment_id, tenant_id, bed_id, month, rent_due, amount_paid, status) VALUES
  ('a-001', 't-001', 'bed-101-a', '2026-08', 5000, 5000, 'PAID'),
  ('a-002', 't-002', 'bed-101-b', '2026-08', 5000, 3000, 'PARTIAL'),
  ('a-003', 't-003', 'bed-102-a', '2026-08', 5500, 0, 'DUE'),
  ('a-004', 't-004', 'bed-102-b', '2026-08', 5500, 5500, 'PAID'),
  ('a-005', 't-005', 'bed-103-a', '2026-08', 5000, 0, 'OVERDUE'),
  ('a-006', 't-006', 'bed-103-b', '2026-08', 5000, 5000, 'PAID'),
  ('a-007', 't-007', 'bed-201-a', '2026-08', 6000, 6000, 'PAID'),
  ('a-008', 't-009', 'bed-201-b', '2026-08', 6000, 2000, 'PARTIAL');

-- Demo payments
INSERT INTO payments (tenant_id, amount, method, rent_month, receipt_number, created_by) VALUES
  ('t-001', 5000, 'UPI', '2026-08', 'RCP-001', 'demo-admin-001'),
  ('t-002', 3000, 'CASH', '2026-08', 'RCP-002', 'demo-admin-001'),
  ('t-004', 5500, 'BANK_TRANSFER', '2026-08', 'RCP-003', 'demo-admin-001'),
  ('t-006', 5000, 'UPI', '2026-08', 'RCP-004', 'demo-admin-001'),
  ('t-007', 6000, 'CARD', '2026-08', 'RCP-005', 'demo-admin-001'),
  ('t-009', 2000, 'UPI', '2026-08', 'RCP-006', 'demo-admin-001');

-- Demo expenses
INSERT INTO expenses (date, category, description, amount, method) VALUES
  ('2026-08-01', 'ELECTRICITY', 'August electricity bill', 8500, 'BANK_TRANSFER'),
  ('2026-08-05', 'INTERNET', 'Monthly internet', 1200, 'UPI'),
  ('2026-08-10', 'CLEANING', 'Cleaning staff salary', 6000, 'CASH'),
  ('2026-08-15', 'MAINTENANCE', 'Plumbing repair', 2500, 'CASH');

-- Set PG start date
UPDATE settings SET value = '2025-01-15' WHERE key = 'pg_start_date';
UPDATE settings SET value = 'Sunshine PG' WHERE key = 'hostel_name';
UPDATE settings SET value = '123 Main Street, Pune' WHERE key = 'address';
*/

-- ─── DONE ──────────────────────────────────────────────────
-- Schema created successfully!
-- Next steps:
--   1. Uncomment the DEMO DATA block above and run again for sample data
--   2. Or connect your Next.js app and let it create data naturally
-- ============================================================
