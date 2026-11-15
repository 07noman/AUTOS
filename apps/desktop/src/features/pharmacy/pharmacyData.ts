/**
 * Pharmacy Data Store & CRUD Helpers
 * Direct Supabase PostgreSQL Cloud Persistence with Multi-Tenant RLS Isolation
 * NO localStorage fallback for live persistent data.
 */

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  category: string;
  subcategory?: string;
  manufacturer: string;
  dosageForm: 'Tablet' | 'Capsule' | 'Syrup' | 'Injection' | 'Suspension' | 'Ointment' | 'Drops';
  strength: string; // e.g. "500mg", "20ml"
  purchasePrice: number;
  sellingPrice: number;
  barcode: string;
  sku: string;
  batchNumber: string;
  stock: number;
  minStockLevel: number;
  mfgDate: string;
  expiryDate: string;
  location?: string; // Shelf / Rack
}

export interface BatchRecord {
  id: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
  quantity: number;
  purchaseCost: number;
  sellingPrice: number;
  supplierName: string;
  status: 'active' | 'near-expiry' | 'expired' | 'disposed';
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  outstandingBalance: number;
  totalPurchases: number;
}

export interface PurchaseItem {
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
  quantity: number;
  unitCost: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  items: PurchaseItem[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  paymentStatus: 'paid' | 'partial' | 'unpaid';
  notes?: string;
}

export interface PharmacyCustomer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  outstandingBalance: number;
  totalSpent: number;
  prescriptionNotes?: string;
  lastVisit: string;
}

export interface PharmacyAccountRecord {
  id: string;
  date: string;
  type: 'Customer Payment' | 'Vendor Payment' | 'Cash In' | 'Cash Out' | 'Expense';
  category: string;
  amount: number;
  method: 'Cash' | 'Bank Transfer' | 'Cheque';
  reference: string;
  notes: string;
}

export interface PharmacyExpense {
  id: string;
  date: string;
  category: 'Salary' | 'Electricity/Utility' | 'Rent' | 'Maintenance' | 'Refrigeration' | 'Packaging' | 'Other';
  amount: number;
  method: 'Cash' | 'Bank';
  notes: string;
  loggedBy: string;
}

export interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Pharmacist' | 'Cashier';
  phone: string;
  status: 'Active' | 'Inactive';
  lastLogin: string;
}

export interface DisposalLog {
  id: string;
  medicineName: string;
  batch: string;
  qty: number;
  reason: string;
  date: string;
}

export interface PharmacySettingsConfig {
  pharmacyName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  drugLicenseNumber: string;
  taxRegistrationNumber: string;
  currency: string;
  taxRatePercent: number;
  receiptHeader: string;
  receiptFooter: string;
  printerType: 'thermal_80mm' | 'thermal_58mm' | 'a4';
  autoPrintReceipt: boolean;
}

export const DEFAULT_SETTINGS: PharmacySettingsConfig = {
  pharmacyName: 'My Pharmacy',
  tagline: 'Licensed Medical Store & Pharmacy',
  phone: '',
  email: '',
  address: '',
  drugLicenseNumber: '',
  taxRegistrationNumber: '',
  currency: 'Rs.',
  taxRatePercent: 0,
  receiptHeader: 'PHARMACY STORE\nLicensed Medical Store',
  receiptFooter: 'Thank you for your visit!\nMedicines cannot be refunded without original receipt.',
  printerType: 'thermal_80mm',
  autoPrintReceipt: true,
};

// ── Helpers & UUID Validation ────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toValidUUID(id?: string | null): string {
  if (id && UUID_REGEX.test(id)) return id;
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback RFC4122 v4 UUID generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retrieves authenticated user's ID as business_id.
 * Never trusts frontend input, URL params, or unverified storage.
 */
export async function getAuthBusinessId(): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase client is not configured. Please check environment variables.');
  }
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) {
    throw new Error('User is not authenticated. Please log in to continue.');
  }
  return data.user.id;
}

// ── Mappers: DB Rows <-> Domain Objects ───────────────────────────────────────

export function mapMedicineRow(r: any): Medicine {
  return {
    id: String(r.id),
    name: String(r.name || ''),
    genericName: String(r.generic_name || ''),
    category: String(r.category || 'General'),
    subcategory: r.subcategory || undefined,
    manufacturer: String(r.manufacturer || ''),
    dosageForm: (r.dosage_form || 'Tablet') as Medicine['dosageForm'],
    strength: String(r.strength || ''),
    purchasePrice: Number(r.purchase_price || 0),
    sellingPrice: Number(r.selling_price || 0),
    barcode: String(r.barcode || ''),
    sku: String(r.sku || ''),
    batchNumber: String(r.batch_number || ''),
    stock: Number(r.stock || 0),
    minStockLevel: Number(r.min_stock_level || 0),
    mfgDate: String(r.mfg_date || ''),
    expiryDate: String(r.expiry_date || ''),
    location: r.location || undefined,
  };
}

export function toMedicineRow(m: Partial<Medicine>, businessId: string) {
  return {
    id: toValidUUID(m.id),
    business_id: businessId,
    name: m.name || '',
    generic_name: m.genericName || null,
    category: m.category || null,
    subcategory: m.subcategory || null,
    manufacturer: m.manufacturer || null,
    dosage_form: m.dosageForm || 'Tablet',
    strength: m.strength || null,
    purchase_price: Number(m.purchasePrice || 0),
    selling_price: Number(m.sellingPrice || 0),
    barcode: m.barcode || '',
    sku: m.sku || '',
    batch_number: m.batchNumber || null,
    stock: Number(m.stock || 0),
    min_stock_level: Number(m.minStockLevel || 0),
    mfg_date: m.mfgDate || null,
    expiry_date: m.expiryDate || null,
    location: m.location || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapSupplierRow(r: any): Supplier {
  return {
    id: String(r.id),
    name: String(r.name || ''),
    contactPerson: String(r.contact_person || ''),
    phone: String(r.phone || ''),
    email: String(r.email || ''),
    address: String(r.address || ''),
    outstandingBalance: Number(r.outstanding_balance || 0),
    totalPurchases: Number(r.total_purchases || 0),
  };
}

export function toSupplierRow(s: Partial<Supplier>, businessId: string) {
  return {
    id: toValidUUID(s.id),
    business_id: businessId,
    name: s.name || '',
    contact_person: s.contactPerson || null,
    phone: s.phone || null,
    email: s.email || null,
    address: s.address || null,
    outstanding_balance: Number(s.outstandingBalance || 0),
    total_purchases: Number(s.totalPurchases || 0),
    updated_at: new Date().toISOString(),
  };
}

export function mapCustomerRow(r: any): PharmacyCustomer {
  return {
    id: String(r.id),
    name: String(r.name || ''),
    phone: String(r.phone || ''),
    email: r.email || undefined,
    address: r.address || undefined,
    outstandingBalance: Number(r.outstanding_balance || 0),
    totalSpent: Number(r.total_spent || 0),
    prescriptionNotes: r.prescription_notes || undefined,
    lastVisit: String(r.last_visit || ''),
  };
}

export function toCustomerRow(c: Partial<PharmacyCustomer>, businessId: string) {
  return {
    id: toValidUUID(c.id),
    business_id: businessId,
    name: c.name || '',
    phone: c.phone || null,
    email: c.email || null,
    address: c.address || null,
    outstanding_balance: Number(c.outstandingBalance || 0),
    total_spent: Number(c.totalSpent || 0),
    prescription_notes: c.prescriptionNotes || null,
    last_visit: c.lastVisit || new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
  };
}

export function mapExpenseRow(r: any): PharmacyExpense {
  return {
    id: String(r.id),
    date: String(r.date || ''),
    category: (r.category || 'Other') as PharmacyExpense['category'],
    amount: Number(r.amount || 0),
    method: (r.method || 'Cash') as PharmacyExpense['method'],
    notes: String(r.notes || ''),
    loggedBy: String(r.logged_by || ''),
  };
}

export function toExpenseRow(e: Partial<PharmacyExpense>, businessId: string) {
  return {
    id: toValidUUID(e.id),
    business_id: businessId,
    date: e.date || new Date().toISOString().split('T')[0],
    category: e.category || 'Other',
    amount: Number(e.amount || 0),
    method: e.method || 'Cash',
    notes: e.notes || null,
    logged_by: e.loggedBy || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapAccountRow(r: any): PharmacyAccountRecord {
  return {
    id: String(r.id),
    date: String(r.date || ''),
    type: (r.type || 'Customer Payment') as PharmacyAccountRecord['type'],
    category: String(r.category || 'General'),
    amount: Number(r.amount || 0),
    method: (r.method || 'Cash') as PharmacyAccountRecord['method'],
    reference: String(r.reference || ''),
    notes: String(r.notes || ''),
  };
}

export function toAccountRow(a: Partial<PharmacyAccountRecord>, businessId: string) {
  return {
    id: toValidUUID(a.id),
    business_id: businessId,
    date: a.date || new Date().toISOString().split('T')[0],
    type: a.type || 'Customer Payment',
    category: a.category || 'General',
    amount: Number(a.amount || 0),
    method: a.method || 'Cash',
    reference: a.reference || null,
    notes: a.notes || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapStaffRow(r: any): StaffUser {
  return {
    id: String(r.id),
    name: String(r.name || ''),
    email: String(r.email || ''),
    role: (r.role || 'Pharmacist') as StaffUser['role'],
    phone: String(r.phone || ''),
    status: (r.status || 'Active') as StaffUser['status'],
    lastLogin: String(r.last_login || ''),
  };
}

export function toStaffRow(st: Partial<StaffUser>, businessId: string) {
  return {
    id: toValidUUID(st.id),
    business_id: businessId,
    name: st.name || '',
    email: st.email || null,
    role: st.role || 'Pharmacist',
    phone: st.phone || null,
    status: st.status || 'Active',
    last_login: st.lastLogin || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapPurchaseRow(r: any): PurchaseOrder {
  return {
    id: String(r.id),
    poNumber: String(r.po_number || ''),
    supplierId: String(r.supplier_id || ''),
    supplierName: String(r.supplier_name || ''),
    date: String(r.date || ''),
    items: Array.isArray(r.items) ? r.items : [],
    subtotal: Number(r.subtotal || 0),
    discount: Number(r.discount || 0),
    total: Number(r.total || 0),
    paidAmount: Number(r.paid_amount || 0),
    paymentStatus: (r.payment_status || 'unpaid') as PurchaseOrder['paymentStatus'],
    notes: r.notes || undefined,
  };
}

export function toPurchaseRow(p: Partial<PurchaseOrder>, businessId: string) {
  return {
    id: toValidUUID(p.id),
    business_id: businessId,
    po_number: p.poNumber || `PO-${Date.now().toString().slice(-6)}`,
    supplier_id: p.supplierId || null,
    supplier_name: p.supplierName || null,
    date: p.date || new Date().toISOString().split('T')[0],
    subtotal: Number(p.subtotal || 0),
    discount: Number(p.discount || 0),
    total: Number(p.total || 0),
    paid_amount: Number(p.paidAmount || 0),
    payment_status: p.paymentStatus || 'unpaid',
    notes: p.notes || null,
    items: Array.isArray(p.items) ? p.items : [],
    updated_at: new Date().toISOString(),
  };
}

export function mapSettingsRow(r: any): PharmacySettingsConfig {
  return {
    pharmacyName: String(r.pharmacy_name || DEFAULT_SETTINGS.pharmacyName),
    tagline: String(r.tagline || DEFAULT_SETTINGS.tagline),
    phone: String(r.phone || ''),
    email: String(r.email || ''),
    address: String(r.address || ''),
    drugLicenseNumber: String(r.drug_license_number || ''),
    taxRegistrationNumber: String(r.tax_registration_number || ''),
    currency: String(r.currency || 'Rs.'),
    taxRatePercent: Number(r.tax_rate_percent || 0),
    receiptHeader: String(r.receipt_header || DEFAULT_SETTINGS.receiptHeader),
    receiptFooter: String(r.receipt_footer || DEFAULT_SETTINGS.receiptFooter),
    printerType: (r.printer_type || 'thermal_80mm') as PharmacySettingsConfig['printerType'],
    autoPrintReceipt: Boolean(r.auto_print_receipt ?? true),
  };
}

export function toSettingsRow(s: Partial<PharmacySettingsConfig>, businessId: string) {
  return {
    business_id: businessId,
    pharmacy_name: s.pharmacyName ?? DEFAULT_SETTINGS.pharmacyName,
    tagline: s.tagline ?? DEFAULT_SETTINGS.tagline,
    phone: s.phone ?? null,
    email: s.email ?? null,
    address: s.address ?? null,
    drug_license_number: s.drugLicenseNumber ?? null,
    tax_registration_number: s.taxRegistrationNumber ?? null,
    currency: s.currency ?? 'Rs.',
    tax_rate_percent: Number(s.taxRatePercent ?? 0),
    receipt_header: s.receiptHeader ?? DEFAULT_SETTINGS.receiptHeader,
    receipt_footer: s.receiptFooter ?? DEFAULT_SETTINGS.receiptFooter,
    printer_type: s.printerType ?? 'thermal_80mm',
    auto_print_receipt: Boolean(s.autoPrintReceipt ?? true),
    updated_at: new Date().toISOString(),
  };
}

export function mapDisposalRow(r: any): DisposalLog {
  return {
    id: String(r.id),
    medicineName: String(r.medicine_name || ''),
    batch: String(r.batch || ''),
    qty: Number(r.qty || 0),
    reason: String(r.reason || ''),
    date: String(r.date || ''),
  };
}

export function toDisposalRow(d: Partial<DisposalLog>, businessId: string) {
  return {
    id: toValidUUID(d.id),
    business_id: businessId,
    medicine_name: d.medicineName || '',
    batch: d.batch || '',
    qty: Number(d.qty || 0),
    reason: d.reason || '',
    date: d.date || new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
  };
}

// ── Pharmacy Database Repository (Supabase Only) ─────────────────────────────

export const pharmacyDb = {
  // ── Medicines ─────────────────────────────
  async getMedicines(): Promise<Medicine[]> {
    const businessId = await getAuthBusinessId();
    const { data, error } = await supabase
      .from('pharmacy_medicines')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return (data || []).map(mapMedicineRow);
  },

  async createMedicine(item: Partial<Medicine>): Promise<Medicine> {
    const businessId = await getAuthBusinessId();
    const payload = toMedicineRow(item, businessId);
    const { data, error } = await supabase
      .from('pharmacy_medicines')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return mapMedicineRow(data);
  },

  async updateMedicine(id: string, updates: Partial<Medicine>): Promise<Medicine> {
    const businessId = await getAuthBusinessId();
    const payload = toMedicineRow({ ...updates, id }, businessId);
    const { data, error } = await supabase
      .from('pharmacy_medicines')
      .update(payload)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return mapMedicineRow(data);
  },

  async deleteMedicine(id: string): Promise<void> {
    const businessId = await getAuthBusinessId();
    const { error } = await supabase
      .from('pharmacy_medicines')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
  },

  // ── Suppliers (Vendors) ───────────────────
  async getSuppliers(): Promise<Supplier[]> {
    const businessId = await getAuthBusinessId();
    const { data, error } = await supabase
      .from('pharmacy_vendors')
      .select('*')
      .eq('business_id', businessId)
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return (data || []).map(mapSupplierRow);
  },

  async createSupplier(item: Partial<Supplier>): Promise<Supplier> {
    const businessId = await getAuthBusinessId();
    const payload = toSupplierRow(item, businessId);
    const { data, error } = await supabase
      .from('pharmacy_vendors')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return mapSupplierRow(data);
  },

  async updateSupplier(id: string, updates: Partial<Supplier>): Promise<Supplier> {
    const businessId = await getAuthBusinessId();
    const payload = toSupplierRow({ ...updates, id }, businessId);
    const { data, error } = await supabase
      .from('pharmacy_vendors')
      .update(payload)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return mapSupplierRow(data);
  },

  async deleteSupplier(id: string): Promise<void> {
    const businessId = await getAuthBusinessId();
    const { error } = await supabase
      .from('pharmacy_vendors')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
  },

  // ── Customers ─────────────────────────────
  async getCustomers(): Promise<PharmacyCustomer[]> {
    const businessId = await getAuthBusinessId();
    const { data, error } = await supabase
      .from('pharmacy_customers')
      .select('*')
      .eq('business_id', businessId)
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return (data || []).map(mapCustomerRow);
  },

  async createCustomer(item: Partial<PharmacyCustomer>): Promise<PharmacyCustomer> {
    const businessId = await getAuthBusinessId();
    const payload = toCustomerRow(item, businessId);
    const { data, error } = await supabase
      .from('pharmacy_customers')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return mapCustomerRow(data);
  },

  async updateCustomer(id: string, updates: Partial<PharmacyCustomer>): Promise<PharmacyCustomer> {
    const businessId = await getAuthBusinessId();
    const payload = toCustomerRow({ ...updates, id }, businessId);
    const { data, error } = await supabase
      .from('pharmacy_customers')
      .update(payload)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return mapCustomerRow(data);
  },

  async deleteCustomer(id: string): Promise<void> {
    const businessId = await getAuthBusinessId();
    const { error } = await supabase
      .from('pharmacy_customers')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
  },

  // ── Expenses ──────────────────────────────
  async getExpenses(): Promise<PharmacyExpense[]> {
    const businessId = await getAuthBusinessId();
    const { data, error } = await supabase
      .from('pharmacy_expenses')
      .select('*')
      .eq('business_id', businessId)
      .order('date', { ascending: false });

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return (data || []).map(mapExpenseRow);
  },

  async createExpense(item: Partial<PharmacyExpense>): Promise<PharmacyExpense> {
    const businessId = await getAuthBusinessId();
    const payload = toExpenseRow(item, businessId);
    const { data, error } = await supabase
      .from('pharmacy_expenses')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return mapExpenseRow(data);
  },

  async deleteExpense(id: string): Promise<void> {
    const businessId = await getAuthBusinessId();
    const { error } = await supabase
      .from('pharmacy_expenses')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
  },

  // ── Staff ─────────────────────────────────
  async getStaff(): Promise<StaffUser[]> {
    const businessId = await getAuthBusinessId();
    const { data, error } = await supabase
      .from('pharmacy_staff')
      .select('*')
      .eq('business_id', businessId)
      .order('name', { ascending: true });

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return (data || []).map(mapStaffRow);
  },

  async createStaff(item: Partial<StaffUser>): Promise<StaffUser> {
    const businessId = await getAuthBusinessId();
    const payload = toStaffRow(item, businessId);
    const { data, error } = await supabase
      .from('pharmacy_staff')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return mapStaffRow(data);
  },

  async updateStaff(id: string, updates: Partial<StaffUser>): Promise<StaffUser> {
    const businessId = await getAuthBusinessId();
    const payload = toStaffRow({ ...updates, id }, businessId);
    const { data, error } = await supabase
      .from('pharmacy_staff')
      .update(payload)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return mapStaffRow(data);
  },

  async deleteStaff(id: string): Promise<void> {
    const businessId = await getAuthBusinessId();
    const { error } = await supabase
      .from('pharmacy_staff')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
  },

  // ── Purchases ─────────────────────────────
  async getPurchases(): Promise<PurchaseOrder[]> {
    const businessId = await getAuthBusinessId();
    const { data, error } = await supabase
      .from('pharmacy_purchases')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return (data || []).map(mapPurchaseRow);
  },

  async createPurchase(item: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    const businessId = await getAuthBusinessId();
    const payload = toPurchaseRow(item, businessId);
    const { data, error } = await supabase
      .from('pharmacy_purchases')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return mapPurchaseRow(data);
  },

  async deletePurchase(id: string): Promise<void> {
    const businessId = await getAuthBusinessId();
    const { error } = await supabase
      .from('pharmacy_purchases')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
  },

  // ── Accounts / Payments ───────────────────
  async getAccounts(): Promise<PharmacyAccountRecord[]> {
    const businessId = await getAuthBusinessId();
    const { data, error } = await supabase
      .from('pharmacy_payments')
      .select('*')
      .eq('business_id', businessId)
      .order('date', { ascending: false });

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return (data || []).map(mapAccountRow);
  },

  async createAccount(item: Partial<PharmacyAccountRecord>): Promise<PharmacyAccountRecord> {
    const businessId = await getAuthBusinessId();
    const payload = toAccountRow(item, businessId);
    const { data, error } = await supabase
      .from('pharmacy_payments')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return mapAccountRow(data);
  },

  async deleteAccount(id: string): Promise<void> {
    const businessId = await getAuthBusinessId();
    const { error } = await supabase
      .from('pharmacy_payments')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
  },

  // ── Disposals ─────────────────────────────
  async getDisposalLogs(): Promise<DisposalLog[]> {
    const businessId = await getAuthBusinessId();
    const { data, error } = await supabase
      .from('pharmacy_disposals')
      .select('*')
      .eq('business_id', businessId)
      .order('date', { ascending: false });

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return (data || []).map(mapDisposalRow);
  },

  async createDisposalLog(item: Partial<DisposalLog>): Promise<DisposalLog> {
    const businessId = await getAuthBusinessId();
    const payload = toDisposalRow(item, businessId);
    const { data, error } = await supabase
      .from('pharmacy_disposals')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return mapDisposalRow(data);
  },

  // ── Settings ──────────────────────────────
  async getSettings(): Promise<PharmacySettingsConfig> {
    const businessId = await getAuthBusinessId();
    const { data, error } = await supabase
      .from('pharmacy_settings')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    if (!data) return DEFAULT_SETTINGS;
    return mapSettingsRow(data);
  },

  async saveSettings(config: PharmacySettingsConfig): Promise<PharmacySettingsConfig> {
    const businessId = await getAuthBusinessId();
    const payload = toSettingsRow(config, businessId);
    const { data, error } = await supabase
      .from('pharmacy_settings')
      .upsert(payload, { onConflict: 'business_id' })
      .select()
      .single();

    if (error) throw new Error(`Failed to save, check internet: ${error.message}`);
    return mapSettingsRow(data);
  },
};

// ── One-Time Safe Local Data Migration ───────────────────────────────────────

export const MIGRATION_BACKUP_KEY = 'pharmacy_migrated_backup';

export async function migrateLocalDataIfNeeded(): Promise<number> {
  if (typeof window === 'undefined') return 0;

  try {
    if (localStorage.getItem(MIGRATION_BACKUP_KEY)) {
      return 0; // Already migrated previously
    }

    let businessId: string;
    try {
      businessId = await getAuthBusinessId();
    } catch {
      return 0; // Not authenticated yet, retry upon login
    }

    // Inspect localStorage for existing pharmacy keys
    const rawMeds = localStorage.getItem('genx:pharmacy:medicines');
    const rawSups = localStorage.getItem('genx:pharmacy:suppliers');
    const rawCusts = localStorage.getItem('genx:pharmacy:customers');
    const rawExps = localStorage.getItem('genx:pharmacy:expenses');
    const rawStaff = localStorage.getItem('genx:pharmacy:staff');
    const rawSettings = localStorage.getItem('genx:pharmacy:settings');
    const rawPurchases = localStorage.getItem('genx:pharmacy:purchases');
    const rawAccounts = localStorage.getItem('genx:pharmacy:accounts');
    const rawDisposals = localStorage.getItem('genx:pharmacy:disposals');

    const hasAnyLocal = Boolean(
      (rawMeds && rawMeds !== '[]') ||
      (rawSups && rawSups !== '[]') ||
      (rawCusts && rawCusts !== '[]') ||
      (rawExps && rawExps !== '[]') ||
      (rawStaff && rawStaff !== '[]') ||
      (rawPurchases && rawPurchases !== '[]') ||
      (rawAccounts && rawAccounts !== '[]') ||
      (rawDisposals && rawDisposals !== '[]') ||
      rawSettings
    );

    if (!hasAnyLocal) {
      return 0;
    }

    // Check if Supabase already has data for this business_id
    const { count, error } = await supabase
      .from('pharmacy_medicines')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);

    if (error) {
      console.warn('[Pharmacy Migration] Remote check error:', error.message);
      return 0;
    }

    if (count && count > 0) {
      console.log('[Pharmacy Migration] Supabase already has data for this business. Skipping local migration.');
      return 0;
    }

    let totalMigrated = 0;
    const backupObject: Record<string, any> = { migratedAt: new Date().toISOString() };

    // 1. Medicines
    if (rawMeds) {
      const parsed: Medicine[] = JSON.parse(rawMeds);
      backupObject.medicines = parsed;
      if (parsed.length > 0) {
        const rows = parsed.map((m) => toMedicineRow(m, businessId));
        const { error: insErr } = await supabase.from('pharmacy_medicines').insert(rows);
        if (insErr) throw insErr;
        totalMigrated += rows.length;
      }
    }

    // 2. Suppliers
    if (rawSups) {
      const parsed: Supplier[] = JSON.parse(rawSups);
      backupObject.suppliers = parsed;
      if (parsed.length > 0) {
        const rows = parsed.map((s) => toSupplierRow(s, businessId));
        const { error: insErr } = await supabase.from('pharmacy_vendors').insert(rows);
        if (insErr) throw insErr;
        totalMigrated += rows.length;
      }
    }

    // 3. Customers
    if (rawCusts) {
      const parsed: PharmacyCustomer[] = JSON.parse(rawCusts);
      backupObject.customers = parsed;
      if (parsed.length > 0) {
        const rows = parsed.map((c) => toCustomerRow(c, businessId));
        const { error: insErr } = await supabase.from('pharmacy_customers').insert(rows);
        if (insErr) throw insErr;
        totalMigrated += rows.length;
      }
    }

    // 4. Expenses
    if (rawExps) {
      const parsed: PharmacyExpense[] = JSON.parse(rawExps);
      backupObject.expenses = parsed;
      if (parsed.length > 0) {
        const rows = parsed.map((e) => toExpenseRow(e, businessId));
        const { error: insErr } = await supabase.from('pharmacy_expenses').insert(rows);
        if (insErr) throw insErr;
        totalMigrated += rows.length;
      }
    }

    // 5. Staff
    if (rawStaff) {
      const parsed: StaffUser[] = JSON.parse(rawStaff);
      backupObject.staff = parsed;
      if (parsed.length > 0) {
        const rows = parsed.map((st) => toStaffRow(st, businessId));
        const { error: insErr } = await supabase.from('pharmacy_staff').insert(rows);
        if (insErr) throw insErr;
        totalMigrated += rows.length;
      }
    }

    // 6. Purchases
    if (rawPurchases) {
      const parsed: PurchaseOrder[] = JSON.parse(rawPurchases);
      backupObject.purchases = parsed;
      if (parsed.length > 0) {
        const rows = parsed.map((p) => toPurchaseRow(p, businessId));
        const { error: insErr } = await supabase.from('pharmacy_purchases').insert(rows);
        if (insErr) throw insErr;
        totalMigrated += rows.length;
      }
    }

    // 7. Accounts
    if (rawAccounts) {
      const parsed: PharmacyAccountRecord[] = JSON.parse(rawAccounts);
      backupObject.accounts = parsed;
      if (parsed.length > 0) {
        const rows = parsed.map((a) => toAccountRow(a, businessId));
        const { error: insErr } = await supabase.from('pharmacy_payments').insert(rows);
        if (insErr) throw insErr;
        totalMigrated += rows.length;
      }
    }

    // 8. Disposals
    if (rawDisposals) {
      const parsed: DisposalLog[] = JSON.parse(rawDisposals);
      backupObject.disposals = parsed;
      if (parsed.length > 0) {
        const rows = parsed.map((d) => toDisposalRow(d, businessId));
        const { error: insErr } = await supabase.from('pharmacy_disposals').insert(rows);
        if (insErr) throw insErr;
        totalMigrated += rows.length;
      }
    }

    // 9. Settings
    if (rawSettings) {
      const parsed: PharmacySettingsConfig = JSON.parse(rawSettings);
      backupObject.settings = parsed;
      const row = toSettingsRow(parsed, businessId);
      const { error: insErr } = await supabase
        .from('pharmacy_settings')
        .upsert(row, { onConflict: 'business_id' });
      if (insErr) throw insErr;
      totalMigrated += 1;
    }

    // Save backup and remove legacy keys ONLY after ALL uploads succeeded
    localStorage.setItem(MIGRATION_BACKUP_KEY, JSON.stringify(backupObject));
    localStorage.removeItem('genx:pharmacy:medicines');
    localStorage.removeItem('genx:pharmacy:suppliers');
    localStorage.removeItem('genx:pharmacy:customers');
    localStorage.removeItem('genx:pharmacy:expenses');
    localStorage.removeItem('genx:pharmacy:staff');
    localStorage.removeItem('genx:pharmacy:settings');
    localStorage.removeItem('genx:pharmacy:purchases');
    localStorage.removeItem('genx:pharmacy:accounts');
    localStorage.removeItem('genx:pharmacy:disposals');

    console.log(`[Pharmacy Migration] Completed: safely uploaded ${totalMigrated} items to Supabase.`);
    return totalMigrated;
  } catch (err) {
    console.error('[Pharmacy Migration] Error during migration. Original data kept intact:', err);
    return 0;
  }
}
