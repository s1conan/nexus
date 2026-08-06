-- 0. Infrastructure: User Profiles and RBAC
CREATE TABLE role_permissions (
  role TEXT PRIMARY KEY, -- Role name is the key (e.g., 'admin', 'staff', 'accounting')
  permissions JSONB NOT NULL
);

-- Seed Default Role Permissions
INSERT INTO role_permissions (role, permissions) VALUES
('admin', '{
    "companies": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
    "products": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
    "vehicles": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
    "funders": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
    "quotation": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
    "purchase-order": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
    "delivery-order": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
    "deposit": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
    "invoice": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
    "payments": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
    "shipments": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
    "users": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
    "settings": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
    "component-test": {"view": true, "insert": true, "edit": true, "delete": true, "print": true}
  }'),
('manager', '{
    "companies": {"view": true, "insert": true, "edit": true, "delete": false, "print": true},
    "products": {"view": true, "insert": true, "edit": true, "delete": false, "print": true},
    "vehicles": {"view": true, "insert": true, "edit": true, "delete": false, "print": true},
    "funders": {"view": true, "insert": true, "edit": true, "delete": false, "print": true},
    "quotation": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
    "purchase-order": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
    "delivery-order": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
    "deposit": {"view": true, "insert": true, "edit": true, "delete": true, "print": true},
    "invoice": {"view": true, "insert": false, "edit": false, "delete": false, "print": true},
    "payments": {"view": true, "insert": false, "edit": false, "delete": false, "print": true},
    "shipments": {"view": true, "insert": true, "edit": true, "delete": false, "print": true},
    "users": {"view": true, "insert": false, "edit": false, "delete": false, "print": false},
    "settings": {"view": true, "insert": false, "edit": false, "delete": false, "print": false}
  }'),
('staff', '{
    "companies": {"view": true, "insert": false, "edit": false, "delete": false, "print": false},
    "products": {"view": true, "insert": false, "edit": false, "delete": false, "print": false},
    "vehicles": {"view": true, "insert": false, "edit": false, "delete": false, "print": false},
    "funders": {"view": true, "insert": false, "edit": false, "delete": false, "print": false},
    "quotation": {"view": true, "insert": true, "edit": false, "delete": false, "print": true},
    "purchase-order": {"view": true, "insert": true, "edit": false, "delete": false, "print": true},
    "delivery-order": {"view": true, "insert": true, "edit": false, "delete": false, "print": true},
    "deposit": {"view": true, "insert": true, "edit": false, "delete": false, "print": true},
    "invoice": {"view": false, "insert": false, "edit": false, "delete": false, "print": false},
    "payments": {"view": false, "insert": false, "edit": false, "delete": false, "print": false},
    "shipments": {"view": true, "insert": false, "edit": false, "delete": false, "print": true}
  }');

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  role TEXT REFERENCES role_permissions(role) DEFAULT 'staff',
  permissions JSONB,
  is_active BOOLEAN DEFAULT false,
  last_login TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_perms JSONB;
  user_role TEXT;
  user_name TEXT;
BEGIN
  -- 1. Determine Username
  user_name := COALESCE(new.raw_user_meta_data->>'username', SPLIT_PART(new.email, '@', 1));
  
  -- 2. Determine Role
  -- If first user, make admin, otherwise staff
  IF NOT EXISTS (SELECT 1 FROM public.profiles) THEN
    user_role := 'admin';
  ELSE
    user_role := COALESCE(new.raw_user_meta_data->>'role', 'staff');
  END IF;

  -- 3. Fetch default permissions for that role
  SELECT permissions INTO default_perms 
  FROM public.role_permissions 
  WHERE role = user_role;

  -- 4. Insert Profile with Conflict Handling
  INSERT INTO public.profiles (
    id, 
    username, 
    email, 
    full_name, 
    phone, 
    role, 
    permissions, 
    is_active
  )
  VALUES (
    new.id, 
    LOWER(user_name),
    new.email, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'phone',
    user_role, 
    COALESCE(default_perms, '{}'::jsonb), 
    (user_role = 'admin') -- Only auto-activate if admin
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone;

  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to break RLS recursion for admin checks
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_access BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  ) INTO has_access;
  RETURN has_access;
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean re-apply)
DROP POLICY IF EXISTS "Profile Access Policy" ON public.profiles;
DROP POLICY IF EXISTS "Profile Update Policy" ON public.profiles;

-- 1. Profile Access Policy (Self)
CREATE POLICY "Profile Access Self" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

-- 2. Profile Access Policy (Admin)
CREATE POLICY "Profile Access Admin" 
ON public.profiles FOR SELECT 
USING (public.is_admin());

-- 3. Profile Update Policy (Self)
CREATE POLICY "Profile Update Self" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 4. Profile Update Policy (Admin)
CREATE POLICY "Profile Update Admin" 
ON public.profiles FOR UPDATE 
USING (public.is_admin());

-- 5. RPC function needs to be accessible
ALTER FUNCTION public.get_email_from_username(TEXT) OWNER TO postgres;
ALTER FUNCTION public.is_admin() OWNER TO postgres;
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- 1. Infrastructure: Dictionary Table
CREATE TABLE dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name TEXT UNIQUE NOT NULL,
  display_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Infrastructure: Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Master Data: Companies
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT[] DEFAULT '{Customer}',
  details JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Master Data: Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  base_cost NUMERIC(12,2) DEFAULT 0,
  base_price NUMERIC(12,2) DEFAULT 0,
  details JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Transaction Pipeline: Quotes
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  status TEXT DEFAULT 'Draft',
  total_value NUMERIC(12,2) DEFAULT 0,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Transaction Pipeline: Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id),
  company_id UUID REFERENCES companies(id),
  type TEXT CHECK (type IN ('Inbound', 'Outbound')),
  status TEXT DEFAULT 'Pending Fulfillment',
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Order Items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  qty NUMERIC(12,2) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Logistics: Shipments
CREATE TABLE shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  transporter_id UUID REFERENCES companies(id),
  freight_cost NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'Scheduled',
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Shipment Items
CREATE TABLE shipment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID REFERENCES shipments(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id),
  qty_loaded NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Finance: Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  amount_due NUMERIC(12,2) DEFAULT 0,
  status TEXT DEFAULT 'Unpaid',
  details JSONB DEFAULT '{}',
  content_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Finance: Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id),
  amount_paid NUMERIC(12,2) NOT NULL,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIT TRIGGER LOGIC
CREATE OR REPLACE FUNCTION audit_trigger_func() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), NULL, auth.uid());
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, NULL, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply Audit Trigger to all tables
CREATE TRIGGER audit_dictionary_trigger AFTER INSERT OR UPDATE OR DELETE ON dictionary FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_companies_trigger AFTER INSERT OR UPDATE OR DELETE ON companies FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_products_trigger AFTER INSERT OR UPDATE OR DELETE ON products FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_quotes_trigger AFTER INSERT OR UPDATE OR DELETE ON quotes FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_orders_trigger AFTER INSERT OR UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_order_items_trigger AFTER INSERT OR UPDATE OR DELETE OR DELETE ON order_items FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_shipments_trigger AFTER INSERT OR UPDATE OR DELETE ON shipments FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_shipment_items_trigger AFTER INSERT OR UPDATE OR DELETE ON shipment_items FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_invoices_trigger AFTER INSERT OR UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_payments_trigger AFTER INSERT OR UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- Seed Dictionary for Labels
INSERT INTO dictionary (key_name, display_value) VALUES 
('LABEL_COMPANY_NAME', 'Company Name'),
('LABEL_TYPE', 'Entity Type'),
('LABEL_SKU', 'SKU'),
('LABEL_PRODUCT_NAME', 'Product Name'),
('LABEL_BASE_PRICE', 'Base Price'),
('DASHBOARD_TITLE', 'Executive Dashboard'),
('TOTAL_REVENUE', 'Total Revenue'),
('ACTIVE_COMPANIES', 'Active Companies'),
('TOTAL_PRODUCTS', 'Total Products');
