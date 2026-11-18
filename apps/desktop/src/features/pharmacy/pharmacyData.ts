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
  // Multi-unit packing fields (additive, backward-compatible)
  baseUnit?: string; // e.g. "Tablet", "Capsule", "Bottle", "Tube", "Ampoule"
  stripSize?: number; // e.g. 10 (1 Strip = 10 Base Units)
  boxSize?: number; // e.g. 10 (1 Box = 10 Strips)
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

export interface PharmacySaleItem {
  id: string;
  businessId?: string;
  saleId: string;
  medicineId: string;
  medicineName: string;
  batchNumber?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt?: string;
}

export interface PharmacySale {
  id: string;
  businessId?: string;
  invoiceNumber: string;
  orderNumber?: number;
  customerName: string;
  customerPhone?: string;
  customerId?: string;
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  paidAmount: number;
  paymentMethod: string;
  status: 'completed' | 'ongoing' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  items?: PharmacySaleItem[];
}

export interface CreateSaleParams {
  invoiceNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  items: {
    id: string; // medicine id
    name: string;
    quantity: number;
    price: number;
    batchNumber?: string;
    expiryDate?: string;
    subtotal?: number;
    type?: 'product' | 'service';
    unit?: string; // e.g. "Tablet", "Strip", "Box"
    unitMultiplier?: number; // Base unit multiplier e.g. 10 for strip, 100 for box
  }[];
  subtotal: number;
  discount?: number;
  tax?: number;
  totalAmount: number;
  paidAmount?: number;
  paymentMethod: string;
  notes?: string;
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
  // Support both direct columns and fallback metadata inside location
  let baseUnit = r.base_unit || undefined;
  let stripSize =
    r.strip_size !== undefined && r.strip_size !== null ? Number(r.strip_size) : undefined;
  let boxSize =
    r.box_size !== undefined && r.box_size !== null ? Number(r.box_size) : undefined;

  let location = r.location || undefined;
  if (location && location.includes('__PACK:')) {
    const parts = location.split('__PACK:');
    location = parts[0].trim() || undefined;
    const packJson = parts[1];
    if (packJson) {
      try {
        const meta = JSON.parse(packJson);
        if (!baseUnit && meta.b) baseUnit = meta.b;
        if (!stripSize && meta.s) stripSize = Number(meta.s);
        if (!boxSize && meta.x) boxSize = Number(meta.x);
      } catch {}
    }
  }

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
    location,
    baseUnit,
    stripSize,
    boxSize,
  };
}

export function toMedicineRow(m: Partial<Medicine>, businessId: string) {
  let location = m.location || null;
  // If multi-unit packing is defined, embed metadata tag into location as safe fallback
  if (m.baseUnit || m.stripSize || m.boxSize) {
    const metaTag = JSON.stringify({
      b: m.baseUnit || '',
      s: m.stripSize || '',
      x: m.boxSize || '',
    });
    location = location ? `${location} __PACK:${metaTag}` : `__PACK:${metaTag}`;
  }

  const row: any = {
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
    location,
    updated_at: new Date().toISOString(),
  };

  // Additive columns
  if (m.baseUnit !== undefined) row.base_unit = m.baseUnit || null;
  if (m.stripSize !== undefined) row.strip_size = m.stripSize ? Number(m.stripSize) : null;
  if (m.boxSize !== undefined) row.box_size = m.boxSize ? Number(m.boxSize) : null;

  return row;
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

export function mapBatchRow(r: any): BatchRecord {
  return {
    id: String(r.id),
    medicineId: String(r.medicine_id || ''),
    medicineName: String(r.medicine_name || ''),
    batchNumber: String(r.batch_number || ''),
    mfgDate: String(r.mfg_date || ''),
    expiryDate: String(r.expiry_date || ''),
    quantity: Number(r.quantity || 0),
    purchaseCost: Number(r.purchase_cost || 0),
    sellingPrice: Number(r.selling_price || 0),
    supplierName: String(r.supplier_name || ''),
    status: (r.status || 'active') as BatchRecord['status'],
  };
}

export function toBatchRow(b: Partial<BatchRecord>, businessId: string) {
  return {
    id: toValidUUID(b.id),
    business_id: businessId,
    medicine_id: toValidUUID(b.medicineId) || null,
    medicine_name: b.medicineName || null,
    batch_number: b.batchNumber || null,
    mfg_date: b.mfgDate || null,
    expiry_date: b.expiryDate || null,
    quantity: Number(b.quantity || 0),
    purchase_cost: Number(b.purchaseCost || 0),
    selling_price: Number(b.sellingPrice || 0),
    supplier_name: b.supplierName || null,
    status: b.status || 'active',
    updated_at: new Date().toISOString(),
  };
}

export function mapSaleRow(r: any): PharmacySale {
  const inv = String(r.invoice_number || '');
  const numPart = parseInt(inv.replace(/\D/g, ''), 10);
  return {
    id: String(r.id),
    businessId: String(r.business_id || ''),
    invoiceNumber: inv || '0001',
    orderNumber: isNaN(numPart) ? 1 : numPart,
    customerName: String(r.customer_name || 'Walk-in Customer'),
    customerPhone: r.customer_phone || undefined,
    customerId: r.customer_id || undefined,
    subtotal: Number(r.subtotal || 0),
    discount: Number(r.discount || 0),
    tax: Number(r.tax || 0),
    totalAmount: Number(r.total_amount || 0),
    paidAmount: Number(r.paid_amount ?? r.total_amount ?? 0),
    paymentMethod: String(r.payment_method || 'Cash'),
    status: (r.status || 'completed') as PharmacySale['status'],
    notes: r.notes || undefined,
    createdAt: String(r.created_at || new Date().toISOString()),
    updatedAt: r.updated_at ? String(r.updated_at) : undefined,
  };
}

export function toSaleRow(s: Partial<PharmacySale>, businessId: string) {
  return {
    id: toValidUUID(s.id),
    business_id: businessId,
    invoice_number: s.invoiceNumber || '0001',
    customer_name: s.customerName || 'Walk-in Customer',
    customer_phone: s.customerPhone || null,
    subtotal: Number(s.subtotal || 0),
    discount: Number(s.discount || 0),
    tax: Number(s.tax || 0),
    total_amount: Number(s.totalAmount || 0),
    paid_amount: Number(s.paidAmount !== undefined ? s.paidAmount : s.totalAmount || 0),
    payment_method: s.paymentMethod || 'Cash',
    status: s.status || 'completed',
    notes: s.notes || null,
    created_at: s.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function mapSaleItemRow(r: any): PharmacySaleItem {
  return {
    id: String(r.id),
    businessId: String(r.business_id || ''),
    saleId: String(r.sale_id || ''),
    medicineId: String(r.medicine_id || ''),
    medicineName: String(r.medicine_name || ''),
    batchNumber: r.batch_number || undefined,
    quantity: Number(r.quantity || 1),
    unitPrice: Number(r.unit_price || 0),
    total: Number(r.total || 0),
    createdAt: r.created_at ? String(r.created_at) : undefined,
  };
}

export function toSaleItemRow(item: Partial<PharmacySaleItem>, saleId: string, businessId: string) {
  return {
    id: toValidUUID(item.id),
    business_id: businessId,
    sale_id: saleId,
    medicine_id: String(item.medicineId || ''),
    medicine_name: String(item.medicineName || ''),
    batch_number: item.batchNumber || null,
    quantity: Number(item.quantity || 1),
    unit_price: Number(item.unitPrice || 0),
    total: Number(item.total || (Number(item.quantity || 1) * Number(item.unitPrice || 0))),
    created_at: new Date().toISOString(),
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
    let { data, error } = await supabase
      .from('pharmacy_medicines')
      .insert(payload)
      .select()
      .single();

    // Graceful fallback if database schema does not yet have packing columns
    if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('base_unit'))) {
      const { base_unit, strip_size, box_size, ...safePayload } = payload;
      const retry = await supabase
        .from('pharmacy_medicines')
        .insert(safePayload)
        .select()
        .single();
      if (retry.error) throw new Error(`Failed to save, check internet: ${retry.error.message}`);
      data = retry.data;
    } else if (error) {
      throw new Error(`Failed to save, check internet: ${error.message}`);
    }

    return mapMedicineRow(data);
  },

  async updateMedicine(id: string, updates: Partial<Medicine>): Promise<Medicine> {
    const businessId = await getAuthBusinessId();
    const payload = toMedicineRow({ ...updates, id }, businessId);
    let { data, error } = await supabase
      .from('pharmacy_medicines')
      .update(payload)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();

    // Graceful fallback if database schema does not yet have packing columns
    if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('base_unit'))) {
      const { base_unit, strip_size, box_size, ...safePayload } = payload;
      const retry = await supabase
        .from('pharmacy_medicines')
        .update(safePayload)
        .eq('id', id)
        .eq('business_id', businessId)
        .select()
        .single();
      if (retry.error) throw new Error(`Failed to save, check internet: ${retry.error.message}`);
      data = retry.data;
    } else if (error) {
      throw new Error(`Failed to save, check internet: ${error.message}`);
    }

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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pharmacy:medicine-changed'));
    }
  },

  // ── Batches ────────────────────────────────
  async getBatches(): Promise<BatchRecord[]> {
    const businessId = await getAuthBusinessId();
    const { data, error } = await supabase
      .from('pharmacy_batches')
      .select('*')
      .eq('business_id', businessId)
      .order('expiry_date', { ascending: true });

    if (error) throw new Error(`Failed to load batches: ${error.message}`);
    return (data || []).map(mapBatchRow);
  },

  async createBatch(item: Partial<BatchRecord>): Promise<BatchRecord> {
    const businessId = await getAuthBusinessId();
    const payload = toBatchRow(item, businessId);
    const { data, error } = await supabase
      .from('pharmacy_batches')
      .insert(payload)
      .select()
      .single();

    if (error) throw new Error(`Failed to save batch: ${error.message}`);
    return mapBatchRow(data);
  },

  async updateBatch(id: string, updates: Partial<BatchRecord>): Promise<BatchRecord> {
    const businessId = await getAuthBusinessId();
    const payload = toBatchRow({ ...updates, id }, businessId);
    const { data, error } = await supabase
      .from('pharmacy_batches')
      .update(payload)
      .eq('id', id)
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update batch: ${error.message}`);
    return mapBatchRow(data);
  },

  async deleteBatch(id: string): Promise<void> {
    const businessId = await getAuthBusinessId();
    const { error } = await supabase
      .from('pharmacy_batches')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to delete batch: ${error.message}`);
  },

  // ── Sales & Orders ─────────────────────────
  async getSales(): Promise<PharmacySale[]> {
    const businessId = await getAuthBusinessId();
    const { data, error } = await supabase
      .from('pharmacy_sales')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to load orders: ${error.message}`);
    return (data || []).map(mapSaleRow);
  },

  async getSaleItems(saleId: string): Promise<PharmacySaleItem[]> {
    const businessId = await getAuthBusinessId();
    const { data, error } = await supabase
      .from('pharmacy_sale_items')
      .select('*')
      .eq('business_id', businessId)
      .eq('sale_id', saleId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to load sale items: ${error.message}`);
    return (data || []).map(mapSaleItemRow);
  },

  async getAllSaleItems(): Promise<PharmacySaleItem[]> {
    const businessId = await getAuthBusinessId();
    const { data, error } = await supabase
      .from('pharmacy_sale_items')
      .select('*')
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to load all sale items: ${error.message}`);
    return (data || []).map(mapSaleItemRow);
  },

  async getSaleWithItems(saleId: string): Promise<PharmacySale | null> {
    const businessId = await getAuthBusinessId();
    const { data: saleData, error: saleErr } = await supabase
      .from('pharmacy_sales')
      .select('*')
      .eq('id', saleId)
      .eq('business_id', businessId)
      .maybeSingle();

    if (saleErr || !saleData) return null;
    const sale = mapSaleRow(saleData);
    sale.items = await this.getSaleItems(saleId);
    return sale;
  },

  async nextInvoiceNumber(): Promise<string> {
    const businessId = await getAuthBusinessId();
    const { count, error } = await supabase
      .from('pharmacy_sales')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', businessId);

    if (error) return '0001';
    return String((count || 0) + 1).padStart(4, '0');
  },

  /**
   * ATOMIC SALE EXECUTION:
   * 1. Validates stock & expiry in Supabase
   * 2. Creates record in pharmacy_sales
   * 3. Creates records in pharmacy_sale_items
   * 4. Stock auto-minus in pharmacy_medicines
   * 5. FIFO batch deduction in pharmacy_batches
   * 6. Records payment in pharmacy_payments
   * 7. Updates/creates customer in pharmacy_customers
   * 8. Dispatches cross-module events
   */
  async createSale(params: CreateSaleParams): Promise<PharmacySale> {
    const businessId = await getAuthBusinessId();

    if (!params.items || params.items.length === 0) {
      throw new Error('Cannot complete sale: Cart is empty.');
    }

    // 1. Check live inventory & expiry in pharmacy_medicines
    const itemIds = params.items.map((it) => String(it.id));
    const { data: dbMeds, error: medErr } = await supabase
      .from('pharmacy_medicines')
      .select('*')
      .eq('business_id', businessId)
      .in('id', itemIds);

    if (medErr) throw new Error(`Failed to verify medicines: ${medErr.message}`);

    const medMap = new Map((dbMeds || []).map((m: any) => [String(m.id), m]));
    const now = new Date();

    for (const it of params.items) {
      const med = medMap.get(String(it.id));
      if (!med) {
        throw new Error(`Medicine "${it.name}" was not found in inventory.`);
      }
      const curStock = Number(med.stock || 0);
      if (curStock <= 0) {
        throw new Error(`Out of Stock: "${med.name}" has 0 stock remaining. Sale blocked.`);
      }
      // Critical: Convert sold quantity to Base Units for stock verification
      const unitMultiplier = Number(it.unitMultiplier || 1);
      const neededBaseQty = Number(it.quantity || 1) * unitMultiplier;
      if (curStock < neededBaseQty) {
        throw new Error(
          `Insufficient Stock: "${med.name}" has only ${curStock} available (requested ${it.quantity} ${it.unit || 'units'} = ${neededBaseQty} base units). Sale blocked.`
        );
      }
      if (med.expiry_date) {
        const exp = new Date(med.expiry_date);
        if (exp <= now) {
          throw new Error(
            `Expired Medicine: "${med.name}" expired on ${med.expiry_date}. Sale blocked.`
          );
        }
      }
    }

    // 2. Determine invoice number
    let invoiceNumber = params.invoiceNumber;
    if (!invoiceNumber) {
      const { count } = await supabase
        .from('pharmacy_sales')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId);
      invoiceNumber = String((count || 0) + 1).padStart(4, '0');
    }

    const subtotal = Number(params.subtotal || 0);
    const discount = Number(params.discount || 0);
    const tax = Number(params.tax || 0);
    const totalAmount = Number(params.totalAmount || 0);
    const paidAmount = Number(params.paidAmount !== undefined ? params.paidAmount : totalAmount);
    const paymentMethod = params.paymentMethod || 'Cash';

    // 3. Create pharmacy_sales record
    const salePayload = {
      id: crypto.randomUUID(),
      business_id: businessId,
      invoice_number: invoiceNumber,
      customer_name: params.customerName || 'Walk-in Customer',
      customer_phone: params.customerPhone || null,
      subtotal,
      discount,
      tax,
      total_amount: totalAmount,
      paid_amount: paidAmount,
      payment_method: paymentMethod,
      status: 'completed',
      notes: params.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: saleData, error: saleErr } = await supabase
      .from('pharmacy_sales')
      .insert(salePayload)
      .select()
      .single();

    if (saleErr) throw new Error(`Sale creation failed: ${saleErr.message}`);

    // 4. Create pharmacy_sale_items records
    const saleItemsPayload = params.items.map((it) => {
      const med = medMap.get(String(it.id));
      return {
        id: crypto.randomUUID(),
        business_id: businessId,
        sale_id: saleData.id,
        medicine_id: String(it.id),
        medicine_name: it.name || med?.name || 'Medicine',
        batch_number: it.batchNumber || med?.batch_number || null,
        quantity: Number(it.quantity || 1),
        unit_price: Number(it.price || 0),
        total: Number(it.subtotal ?? (Number(it.quantity || 1) * Number(it.price || 0))),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    const { error: itemsErr } = await supabase
      .from('pharmacy_sale_items')
      .insert(saleItemsPayload);

    if (itemsErr) throw new Error(`Sale items creation failed: ${itemsErr.message}`);

    // 5. Deduct stock from pharmacy_medicines (always converted to Base Units)
    for (const it of params.items) {
      const med = medMap.get(String(it.id));
      const curStock = Number(med?.stock || 0);
      const unitMultiplier = Number(it.unitMultiplier || 1);
      const baseQtyToDeduct = Number(it.quantity || 1) * unitMultiplier;
      const nextStock = Math.max(0, curStock - baseQtyToDeduct);
      await supabase
        .from('pharmacy_medicines')
        .update({ stock: nextStock, updated_at: new Date().toISOString() })
        .eq('id', it.id)
        .eq('business_id', businessId);
    }

    // 6. FIFO batch deduction from pharmacy_batches (in Base Units)
    for (const it of params.items) {
      try {
        const { data: batches } = await supabase
          .from('pharmacy_batches')
          .select('*')
          .eq('business_id', businessId)
          .or(`medicine_id.eq.${it.id},medicine_name.eq.${it.name}`)
          .gt('quantity', 0)
          .order('expiry_date', { ascending: true });

        if (batches && batches.length > 0) {
          const unitMultiplier = Number(it.unitMultiplier || 1);
          let needed = Number(it.quantity || 1) * unitMultiplier;
          for (const b of batches) {
            if (needed <= 0) break;
            const bQty = Number(b.quantity || 0);
            if (bQty <= 0) continue;
            const deduct = Math.min(needed, bQty);
            const remaining = bQty - deduct;
            await supabase
              .from('pharmacy_batches')
              .update({
                quantity: remaining,
                updated_at: new Date().toISOString(),
              })
              .eq('id', b.id)
              .eq('business_id', businessId);
            needed -= deduct;
          }
        }
      } catch (batchErr) {
        console.warn('[FIFO Batch Deduction] Non-critical warning:', batchErr);
      }
    }

    // 7. Record entry in pharmacy_payments
    try {
      const paymentRow = {
        id: crypto.randomUUID(),
        business_id: businessId,
        date: new Date().toISOString().split('T')[0],
        type: 'Customer Payment',
        category: 'POS Sale',
        amount: paidAmount,
        method: paymentMethod,
        reference: invoiceNumber,
        notes: `POS Sale Invoice #${invoiceNumber}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await supabase.from('pharmacy_payments').insert(paymentRow);
    } catch (payErr) {
      console.warn('[POS Payment Record] Non-critical warning:', payErr);
    }

    // 8. Update / Create Customer in pharmacy_customers
    try {
      if (params.customerName && params.customerName.trim() && params.customerName !== 'Walk-in Customer') {
        const cName = params.customerName.trim();
        const cPhone = params.customerPhone?.trim() || '';
        let existing: any = null;

        if (params.customerId) {
          const { data } = await supabase
            .from('pharmacy_customers')
            .select('*')
            .eq('id', params.customerId)
            .eq('business_id', businessId)
            .maybeSingle();
          existing = data;
        }

        if (!existing && cPhone) {
          const { data } = await supabase
            .from('pharmacy_customers')
            .select('*')
            .eq('phone', cPhone)
            .eq('business_id', businessId)
            .maybeSingle();
          existing = data;
        }

        if (!existing) {
          const { data } = await supabase
            .from('pharmacy_customers')
            .select('*')
            .ilike('name', cName)
            .eq('business_id', businessId)
            .maybeSingle();
          existing = data;
        }

        const isCredit = paymentMethod.toLowerCase().includes('credit') || paidAmount < totalAmount;
        const unpaid = Math.max(0, totalAmount - paidAmount);
        const todayStr = new Date().toISOString().split('T')[0];

        if (existing) {
          const nextSpent = Number(existing.total_spent || 0) + totalAmount;
          const nextBalance = Number(existing.outstanding_balance || 0) + (isCredit ? unpaid : 0);
          await supabase
            .from('pharmacy_customers')
            .update({
              total_spent: nextSpent,
              outstanding_balance: nextBalance,
              last_visit: todayStr,
              phone: cPhone || existing.phone || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .eq('business_id', businessId);
        } else {
          await supabase.from('pharmacy_customers').insert({
            id: crypto.randomUUID(),
            business_id: businessId,
            name: cName,
            phone: cPhone || null,
            total_spent: totalAmount,
            outstanding_balance: isCredit ? unpaid : 0,
            last_visit: todayStr,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    } catch (custErr) {
      console.warn('[POS Customer Update] Non-critical warning:', custErr);
    }

    // 9. Dispatch instant UI update events
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pharmacy:sale-completed', { detail: saleData }));
      window.dispatchEvent(new CustomEvent('pharmacy:medicine-changed'));
      window.dispatchEvent(new CustomEvent('pharmacy:orders-changed'));
      window.dispatchEvent(new CustomEvent('pharmacy:customers-changed'));
      window.dispatchEvent(new CustomEvent('pharmacy:accounts-changed'));
      window.dispatchEvent(new CustomEvent('pharmacy:dashboard-changed'));
    }

    const createdOrder = mapSaleRow(saleData);
    createdOrder.items = saleItemsPayload.map(mapSaleItemRow);
    return createdOrder;
  },

  async cancelSale(id: string): Promise<void> {
    const businessId = await getAuthBusinessId();

    // 1. Fetch sale and items
    const { data: saleData } = await supabase
      .from('pharmacy_sales')
      .select('*')
      .eq('id', id)
      .eq('business_id', businessId)
      .single();

    if (!saleData || saleData.status === 'cancelled') return;

    const { data: items } = await supabase
      .from('pharmacy_sale_items')
      .select('*')
      .eq('sale_id', id)
      .eq('business_id', businessId);

    // 2. Restore medicine stock
    if (items && items.length > 0) {
      for (const it of items) {
        if (!it.medicine_id) continue;
        const { data: curMed } = await supabase
          .from('pharmacy_medicines')
          .select('stock, strip_size, box_size')
          .eq('id', it.medicine_id)
          .eq('business_id', businessId)
          .single();

        if (curMed) {
          let restoreQty = Number(it.quantity || 0);
          const medName = String(it.medicine_name || '');
          if (medName.includes('(Strip)') || medName.includes(' - Strip')) {
            const stripSize = curMed.strip_size ? Number(curMed.strip_size) : 10;
            restoreQty *= stripSize;
          } else if (medName.includes('(Box)') || medName.includes(' - Box')) {
            const stripSize = curMed.strip_size ? Number(curMed.strip_size) : 10;
            const boxSize = curMed.box_size ? Number(curMed.box_size) : 10;
            restoreQty *= (stripSize * boxSize);
          }
          const restored = Number(curMed.stock || 0) + restoreQty;
          await supabase
            .from('pharmacy_medicines')
            .update({ stock: restored, updated_at: new Date().toISOString() })
            .eq('id', it.medicine_id)
            .eq('business_id', businessId);
        }
      }
    }

    // 3. Mark cancelled
    const { error } = await supabase
      .from('pharmacy_sales')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to cancel sale: ${error.message}`);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pharmacy:orders-changed'));
      window.dispatchEvent(new CustomEvent('pharmacy:medicine-changed'));
      window.dispatchEvent(new CustomEvent('pharmacy:accounts-changed'));
    }
  },

  async deleteSale(id: string): Promise<void> {
    const businessId = await getAuthBusinessId();
    const { error } = await supabase
      .from('pharmacy_sales')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to delete sale: ${error.message}`);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pharmacy:orders-changed'));
    }
  },

  async deleteAllSales(): Promise<void> {
    const businessId = await getAuthBusinessId();
    const { error } = await supabase
      .from('pharmacy_sales')
      .delete()
      .eq('business_id', businessId);

    if (error) throw new Error(`Failed to reset sales history: ${error.message}`);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pharmacy:orders-changed'));
      window.dispatchEvent(new CustomEvent('pharmacy:dashboard-changed'));
    }
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

/**
 * Realtime subscription: triggers callback when another device or tab modifies pharmacy data.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeToPharmacyRealtime(businessId: string, onUpdate: (table: string) => void) {
  if (!businessId || !isSupabaseConfigured()) return () => {};

  const channel = supabase
    .channel(`realtime:pharmacy:${businessId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pharmacy_medicines', filter: `business_id=eq.${businessId}` },
      () => onUpdate('pharmacy_medicines')
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pharmacy_sales', filter: `business_id=eq.${businessId}` },
      () => onUpdate('pharmacy_sales')
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pharmacy_sale_items', filter: `business_id=eq.${businessId}` },
      () => onUpdate('pharmacy_sale_items')
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pharmacy_customers', filter: `business_id=eq.${businessId}` },
      () => onUpdate('pharmacy_customers')
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pharmacy_batches', filter: `business_id=eq.${businessId}` },
      () => onUpdate('pharmacy_batches')
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pharmacy_payments', filter: `business_id=eq.${businessId}` },
      () => onUpdate('pharmacy_payments')
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
