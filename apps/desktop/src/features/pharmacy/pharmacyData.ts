/**
 * Pharmacy Data Store & CRUD Helpers
 * Persistent via localStorage for offline-first support.
 */

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

// ── Initial Mock Data ─────────────────────────────────────────────────────────

const INITIAL_MEDICINES: Medicine[] = [
  {
    id: 'med-01',
    name: 'Panadol Extra',
    genericName: 'Paracetamol + Caffeine',
    category: 'Analgesics / Antipyretic',
    manufacturer: 'GSK Consumer Healthcare',
    dosageForm: 'Tablet',
    strength: '500mg / 65mg',
    purchasePrice: 42.0,
    sellingPrice: 50.0,
    barcode: '896400012301',
    sku: 'MED-PAN-01',
    batchNumber: 'BN-2024-A1',
    stock: 240,
    minStockLevel: 50,
    mfgDate: '2024-01-10',
    expiryDate: '2027-01-10',
    location: 'Rack A-1',
  },
  {
    id: 'med-02',
    name: 'Augmentin 625mg',
    genericName: 'Amoxicillin + Clavulanic Acid',
    category: 'Antibiotics',
    manufacturer: 'GlaxoSmithKline',
    dosageForm: 'Tablet',
    strength: '625mg',
    purchasePrice: 380.0,
    sellingPrice: 450.0,
    barcode: '896400012302',
    sku: 'MED-AUG-02',
    batchNumber: 'BN-2023-B8',
    stock: 14,
    minStockLevel: 25,
    mfgDate: '2023-11-15',
    expiryDate: '2026-11-30', // Near expiry
    location: 'Rack B-3',
  },
  {
    id: 'med-03',
    name: 'Brufen 400mg',
    genericName: 'Ibuprofen',
    category: 'NSAID / Pain Relief',
    manufacturer: 'Abbott Laboratories',
    dosageForm: 'Tablet',
    strength: '400mg',
    purchasePrice: 110.0,
    sellingPrice: 135.0,
    barcode: '896400012303',
    sku: 'MED-BRU-03',
    batchNumber: 'BN-2024-C2',
    stock: 180,
    minStockLevel: 40,
    mfgDate: '2024-03-01',
    expiryDate: '2027-03-01',
    location: 'Rack A-2',
  },
  {
    id: 'med-04',
    name: 'Risek 20mg',
    genericName: 'Omeprazole',
    category: 'Gastrointestinal / PPI',
    manufacturer: 'Getz Pharma',
    dosageForm: 'Capsule',
    strength: '20mg',
    purchasePrice: 280.0,
    sellingPrice: 340.0,
    barcode: '896400012304',
    sku: 'MED-RIS-04',
    batchNumber: 'BN-2024-D5',
    stock: 85,
    minStockLevel: 30,
    mfgDate: '2024-02-12',
    expiryDate: '2027-02-12',
    location: 'Rack C-1',
  },
  {
    id: 'med-05',
    name: 'Hydryllin Syrup',
    genericName: 'Aminophylline + Diphenhydramine',
    category: 'Cough & Cold',
    manufacturer: 'Searle Company Ltd',
    dosageForm: 'Syrup',
    strength: '120ml',
    purchasePrice: 145.0,
    sellingPrice: 175.0,
    barcode: '896400012305',
    sku: 'MED-HYD-05',
    batchNumber: 'BN-2023-E1',
    stock: 6, // Low stock
    minStockLevel: 20,
    mfgDate: '2023-09-01',
    expiryDate: '2026-09-01',
    location: 'Rack D-2',
  },
  {
    id: 'med-06',
    name: 'Rigix 10mg',
    genericName: 'Cetirizine Dihydrochloride',
    category: 'Antihistamine / Allergy',
    manufacturer: 'AGP Pharma',
    dosageForm: 'Tablet',
    strength: '10mg',
    purchasePrice: 95.0,
    sellingPrice: 120.0,
    barcode: '896400012306',
    sku: 'MED-RIG-06',
    batchNumber: 'BN-2024-F4',
    stock: 120,
    minStockLevel: 30,
    mfgDate: '2024-04-10',
    expiryDate: '2027-04-10',
    location: 'Rack A-3',
  },
  {
    id: 'med-07',
    name: 'Ciprobay 500mg',
    genericName: 'Ciprofloxacin',
    category: 'Antibiotics',
    manufacturer: 'Bayer Pakistan',
    dosageForm: 'Tablet',
    strength: '500mg',
    purchasePrice: 410.0,
    sellingPrice: 495.0,
    barcode: '896400012307',
    sku: 'MED-CIP-07',
    batchNumber: 'BN-2023-X9',
    stock: 22,
    minStockLevel: 20,
    mfgDate: '2023-08-01',
    expiryDate: '2026-11-20', // Near expiry
    location: 'Rack B-4',
  },
  {
    id: 'med-08',
    name: 'Insulin Mixtard 30',
    genericName: 'Human Biphasic Isophane Insulin',
    category: 'Antidiabetic / Injectable',
    manufacturer: 'Novo Nordisk',
    dosageForm: 'Injection',
    strength: '100 IU/ml (10ml)',
    purchasePrice: 1250.0,
    sellingPrice: 1450.0,
    barcode: '896400012308',
    sku: 'MED-INS-08',
    batchNumber: 'BN-2024-Z1',
    stock: 18,
    minStockLevel: 10,
    mfgDate: '2024-01-20',
    expiryDate: '2026-12-15',
    location: 'Cold Storage / Fridge',
  },
];

const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-01',
    name: 'Premier Pharmaceuticals Distributors',
    contactPerson: 'Mr. Tariq Mehmood',
    phone: '+92 300 1234567',
    email: 'orders@premierpharma.pk',
    address: 'Warehouse #14, Industrial Estate, Karachi',
    outstandingBalance: 45000,
    totalPurchases: 320000,
  },
  {
    id: 'sup-02',
    name: 'Muller & Phipps Pakistan',
    contactPerson: 'Zubair Ahmed',
    phone: '+92 321 9876543',
    email: 'supply@mnp.com.pk',
    address: 'Plot 45-C, Korangi Creek, Karachi',
    outstandingBalance: 12500,
    totalPurchases: 540000,
  },
  {
    id: 'sup-03',
    name: 'Ali Gohar & Co Pharma Dist.',
    contactPerson: 'Kashif Ali',
    phone: '+92 333 4455667',
    email: 'sales@aligohar.pk',
    address: 'Sector I-9/2, Islamabad',
    outstandingBalance: 0,
    totalPurchases: 185000,
  },
];

const INITIAL_CUSTOMERS: PharmacyCustomer[] = [
  {
    id: 'cust-01',
    name: 'Muhammad Aslam',
    phone: '0301-5544332',
    email: 'aslam@gmail.com',
    address: 'House 12, Street 4, Sector G-10, Islamabad',
    outstandingBalance: 2400,
    totalSpent: 18500,
    prescriptionNotes: 'Diabetic patient (Mixtard 30 + Glucophage)',
    lastVisit: '2026-11-04',
  },
  {
    id: 'cust-02',
    name: 'Dr. Ayesha Siddiqui',
    phone: '0322-8877665',
    email: 'ayesha.dr@hotmail.com',
    address: 'Clinic 3B, Blue Area, Islamabad',
    outstandingBalance: 0,
    totalSpent: 42000,
    prescriptionNotes: 'Regular clinic supply purchases',
    lastVisit: '2026-11-06',
  },
  {
    id: 'cust-03',
    name: 'Mrs. Farzana Begum',
    phone: '0334-9988112',
    outstandingBalance: 650,
    totalSpent: 8900,
    prescriptionNotes: 'Hypertension (Norvasc 5mg + Lowplat 75mg)',
    lastVisit: '2026-10-29',
  },
];

const INITIAL_EXPENSES: PharmacyExpense[] = [
  {
    id: 'exp-01',
    date: '2026-11-01',
    category: 'Rent',
    amount: 45000,
    method: 'Bank',
    notes: 'Pharmacy shop monthly rent for November',
    loggedBy: 'Admin',
  },
  {
    id: 'exp-02',
    date: '2026-11-03',
    category: 'Electricity/Utility',
    amount: 18450,
    method: 'Cash',
    notes: 'IESCO commercial electricity bill including fridge power',
    loggedBy: 'Admin',
  },
  {
    id: 'exp-03',
    date: '2026-11-05',
    category: 'Refrigeration',
    amount: 3500,
    method: 'Cash',
    notes: 'Insulin storage refrigerator gas checkup and servicing',
    loggedBy: 'Pharmacist',
  },
  {
    id: 'exp-04',
    date: '2026-11-06',
    category: 'Packaging',
    amount: 2200,
    method: 'Cash',
    notes: 'Pharmacy printed paper bags and medicine dosage envelopes',
    loggedBy: 'Cashier',
  },
];

const INITIAL_STAFF: StaffUser[] = [
  {
    id: 'staff-01',
    name: 'Dr. Noman (Chief Pharmacist)',
    email: 'noman.pharmacy@genxpos.com',
    role: 'Admin',
    phone: '0300-1122334',
    status: 'Active',
    lastLogin: 'Just now',
  },
  {
    id: 'staff-02',
    name: 'Hamza Khan (Registered Pharmacist)',
    email: 'hamza.rx@genxpos.com',
    role: 'Pharmacist',
    phone: '0312-3344556',
    status: 'Active',
    lastLogin: 'Today, 09:30 AM',
  },
  {
    id: 'staff-03',
    name: 'Bilal Raza',
    email: 'bilal.counter@genxpos.com',
    role: 'Cashier',
    phone: '0345-6677889',
    status: 'Active',
    lastLogin: 'Yesterday',
  },
];

const INITIAL_SETTINGS: PharmacySettingsConfig = {
  pharmacyName: 'City Care Pharmacy & Medical Store',
  tagline: 'Authentic Medicines & Expert Healthcare Service',
  phone: '+92 51 2288990',
  email: 'info@citycarepharmacy.pk',
  address: 'Shop 1-2, Ground Floor, Medi Plaza, Main Boulevard, Islamabad',
  drugLicenseNumber: 'DL-ISB-2024-8849',
  taxRegistrationNumber: 'STRN-99887766-1',
  currency: 'Rs.',
  taxRatePercent: 0,
  receiptHeader: 'CITY CARE PHARMACY\nLicensed Medical Store\n24/7 Home Delivery Available',
  receiptFooter: 'Thank you for your visit!\nMedicines cannot be refunded without original receipt.\nKeep all drugs away from children.',
  printerType: 'thermal_80mm',
  autoPrintReceipt: true,
};

// ── Storage helpers ───────────────────────────────────────────────────────────

const KEY_PREFIX = 'genx:pharmacy:';

export const pharmacyStorage = {
  getMedicines(): Medicine[] {
    try {
      const data = localStorage.getItem(`${KEY_PREFIX}medicines`);
      if (!data) {
        localStorage.setItem(`${KEY_PREFIX}medicines`, JSON.stringify(INITIAL_MEDICINES));
        return INITIAL_MEDICINES;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_MEDICINES;
    }
  },
  saveMedicines(items: Medicine[]) {
    localStorage.setItem(`${KEY_PREFIX}medicines`, JSON.stringify(items));
  },

  getSuppliers(): Supplier[] {
    try {
      const data = localStorage.getItem(`${KEY_PREFIX}suppliers`);
      if (!data) {
        localStorage.setItem(`${KEY_PREFIX}suppliers`, JSON.stringify(INITIAL_SUPPLIERS));
        return INITIAL_SUPPLIERS;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_SUPPLIERS;
    }
  },
  saveSuppliers(items: Supplier[]) {
    localStorage.setItem(`${KEY_PREFIX}suppliers`, JSON.stringify(items));
  },

  getCustomers(): PharmacyCustomer[] {
    try {
      const data = localStorage.getItem(`${KEY_PREFIX}customers`);
      if (!data) {
        localStorage.setItem(`${KEY_PREFIX}customers`, JSON.stringify(INITIAL_CUSTOMERS));
        return INITIAL_CUSTOMERS;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_CUSTOMERS;
    }
  },
  saveCustomers(items: PharmacyCustomer[]) {
    localStorage.setItem(`${KEY_PREFIX}customers`, JSON.stringify(items));
  },

  getExpenses(): PharmacyExpense[] {
    try {
      const data = localStorage.getItem(`${KEY_PREFIX}expenses`);
      if (!data) {
        localStorage.setItem(`${KEY_PREFIX}expenses`, JSON.stringify(INITIAL_EXPENSES));
        return INITIAL_EXPENSES;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_EXPENSES;
    }
  },
  saveExpenses(items: PharmacyExpense[]) {
    localStorage.setItem(`${KEY_PREFIX}expenses`, JSON.stringify(items));
  },

  getStaff(): StaffUser[] {
    try {
      const data = localStorage.getItem(`${KEY_PREFIX}staff`);
      if (!data) {
        localStorage.setItem(`${KEY_PREFIX}staff`, JSON.stringify(INITIAL_STAFF));
        return INITIAL_STAFF;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_STAFF;
    }
  },
  saveStaff(items: StaffUser[]) {
    localStorage.setItem(`${KEY_PREFIX}staff`, JSON.stringify(items));
  },

  getSettings(): PharmacySettingsConfig {
    try {
      const data = localStorage.getItem(`${KEY_PREFIX}settings`);
      if (!data) {
        localStorage.setItem(`${KEY_PREFIX}settings`, JSON.stringify(INITIAL_SETTINGS));
        return INITIAL_SETTINGS;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_SETTINGS;
    }
  },
  saveSettings(config: PharmacySettingsConfig) {
    localStorage.setItem(`${KEY_PREFIX}settings`, JSON.stringify(config));
  },

  getPurchases(): PurchaseOrder[] {
    try {
      const data = localStorage.getItem(`${KEY_PREFIX}purchases`);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  },
  savePurchases(items: PurchaseOrder[]) {
    localStorage.setItem(`${KEY_PREFIX}purchases`, JSON.stringify(items));
  },
};
