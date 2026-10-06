-- Auto-care tables migration
-- Generated 2024-10-05

CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID,
    customer_name VARCHAR(255),
    make VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INTEGER NOT NULL,
    license_plate VARCHAR(50) NOT NULL,
    vin VARCHAR(100),
    color VARCHAR(50),
    mileage INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vehicles_tenant_idx ON vehicles (tenant_id);

CREATE TABLE IF NOT EXISTS auto_care_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    labor_rate NUMERIC(12,2) NOT NULL DEFAULT 80,
    estimated_hours NUMERIC(6,2) NOT NULL DEFAULT 1,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auto_care_services_tenant_idx ON auto_care_services (tenant_id);

CREATE TABLE IF NOT EXISTS service_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    job_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id UUID,
    customer_name VARCHAR(255) NOT NULL,
    vehicle_id UUID,
    vehicle_summary VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    priority VARCHAR(50) NOT NULL DEFAULT 'normal',
    mechanic_id UUID,
    mechanic_name VARCHAR(255),
    estimated_hours NUMERIC(6,2),
    actual_hours NUMERIC(6,2),
    notes TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_jobs_tenant_idx ON service_jobs (tenant_id);
CREATE INDEX IF NOT EXISTS service_jobs_number_idx ON service_jobs (job_number);

CREATE TABLE IF NOT EXISTS service_job_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES service_jobs(id),
    type VARCHAR(20) NOT NULL DEFAULT 'part',
    product_id UUID,
    service_id UUID,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(12,2) NOT NULL,
    discount NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_job_items_job_idx ON service_job_items (job_id);

CREATE TABLE IF NOT EXISTS auto_care_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    job_id UUID,
    job_number VARCHAR(50),
    customer_id UUID,
    customer_name VARCHAR(255) NOT NULL,
    vehicle_summary VARCHAR(255),
    items TEXT NOT NULL DEFAULT '[]',
    subtotal NUMERIC(12,2) NOT NULL,
    discount NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
    status VARCHAR(20) NOT NULL DEFAULT 'paid',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auto_care_invoices_tenant_idx ON auto_care_invoices (tenant_id);
CREATE INDEX IF NOT EXISTS auto_care_invoices_number_idx ON auto_care_invoices (invoice_number);
