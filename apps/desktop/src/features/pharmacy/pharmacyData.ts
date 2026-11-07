/**
 * Pharmacy Data Store & CRUD Helpers
 * Starts completely EMPTY — NO mock, dummy, seed, or sample data.
 * Pure real data persisted via localStorage.
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

const DEFAULT_SETTINGS: PharmacySettingsConfig = {
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

// ── Storage Keys & Clean Purge of Legacy Mock Data ───────────────────────────

const KEY_PREFIX = 'genx:pharmacy:';
const MOCK_CLEANED_FLAG = 'genx:pharmacy:mock_purged_v2';

/**
 * Automatically purges any legacy seeded mock data from user's localStorage
 * so that existing sessions also start completely empty.
 */
function cleanLegacyMockDataOnce() {
  if (typeof window === 'undefined') return;
  try {
    if (!localStorage.getItem(MOCK_CLEANED_FLAG)) {
      // Clear legacy dummy arrays
      const medRaw = localStorage.getItem(`${KEY_PREFIX}medicines`);
      if (medRaw && (medRaw.includes('med-01') || medRaw.includes('Panadol Extra'))) {
        localStorage.removeItem(`${KEY_PREFIX}medicines`);
      }
      const supRaw = localStorage.getItem(`${KEY_PREFIX}suppliers`);
      if (supRaw && (supRaw.includes('sup-01') || supRaw.includes('Premier Pharmaceuticals'))) {
        localStorage.removeItem(`${KEY_PREFIX}suppliers`);
      }
      const custRaw = localStorage.getItem(`${KEY_PREFIX}customers`);
      if (custRaw && (custRaw.includes('cust-01') || custRaw.includes('Muhammad Aslam'))) {
        localStorage.removeItem(`${KEY_PREFIX}customers`);
      }
      const expRaw = localStorage.getItem(`${KEY_PREFIX}expenses`);
      if (expRaw && (expRaw.includes('exp-01') || expRaw.includes('IESCO commercial'))) {
        localStorage.removeItem(`${KEY_PREFIX}expenses`);
      }
      const staffRaw = localStorage.getItem(`${KEY_PREFIX}staff`);
      if (staffRaw && (staffRaw.includes('staff-01') || staffRaw.includes('Dr. Noman'))) {
        localStorage.removeItem(`${KEY_PREFIX}staff`);
      }
      const poRaw = localStorage.getItem(`${KEY_PREFIX}purchases`);
      if (poRaw && (poRaw.includes('po-101') || poRaw.includes('PO-2026-084'))) {
        localStorage.removeItem(`${KEY_PREFIX}purchases`);
      }
      localStorage.setItem(MOCK_CLEANED_FLAG, 'true');
    }
  } catch {
    // ignore
  }
}

cleanLegacyMockDataOnce();

export const pharmacyStorage = {
  getMedicines(): Medicine[] {
    try {
      const data = localStorage.getItem(`${KEY_PREFIX}medicines`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveMedicines(items: Medicine[]) {
    localStorage.setItem(`${KEY_PREFIX}medicines`, JSON.stringify(items));
  },

  getSuppliers(): Supplier[] {
    try {
      const data = localStorage.getItem(`${KEY_PREFIX}suppliers`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveSuppliers(items: Supplier[]) {
    localStorage.setItem(`${KEY_PREFIX}suppliers`, JSON.stringify(items));
  },

  getCustomers(): PharmacyCustomer[] {
    try {
      const data = localStorage.getItem(`${KEY_PREFIX}customers`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveCustomers(items: PharmacyCustomer[]) {
    localStorage.setItem(`${KEY_PREFIX}customers`, JSON.stringify(items));
  },

  getExpenses(): PharmacyExpense[] {
    try {
      const data = localStorage.getItem(`${KEY_PREFIX}expenses`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveExpenses(items: PharmacyExpense[]) {
    localStorage.setItem(`${KEY_PREFIX}expenses`, JSON.stringify(items));
  },

  getStaff(): StaffUser[] {
    try {
      const data = localStorage.getItem(`${KEY_PREFIX}staff`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveStaff(items: StaffUser[]) {
    localStorage.setItem(`${KEY_PREFIX}staff`, JSON.stringify(items));
  },

  getSettings(): PharmacySettingsConfig {
    try {
      const data = localStorage.getItem(`${KEY_PREFIX}settings`);
      return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },
  saveSettings(config: PharmacySettingsConfig) {
    localStorage.setItem(`${KEY_PREFIX}settings`, JSON.stringify(config));
  },

  getPurchases(): PurchaseOrder[] {
    try {
      const data = localStorage.getItem(`${KEY_PREFIX}purchases`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  savePurchases(items: PurchaseOrder[]) {
    localStorage.setItem(`${KEY_PREFIX}purchases`, JSON.stringify(items));
  },

  getAccounts(): PharmacyAccountRecord[] {
    try {
      const data = localStorage.getItem(`${KEY_PREFIX}accounts`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveAccounts(items: PharmacyAccountRecord[]) {
    localStorage.setItem(`${KEY_PREFIX}accounts`, JSON.stringify(items));
  },

  getDisposalLogs(): DisposalLog[] {
    try {
      const data = localStorage.getItem(`${KEY_PREFIX}disposals`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
  saveDisposalLogs(items: DisposalLog[]) {
    localStorage.setItem(`${KEY_PREFIX}disposals`, JSON.stringify(items));
  },
};
