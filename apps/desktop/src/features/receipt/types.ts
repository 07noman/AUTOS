export type BusinessType =
  | 'auto_care'
  | 'auto_parts'
  | 'retail'
  | 'supermarket'
  | 'restaurant'
  | 'workshop'
  | 'other';

export type PaperWidth = '58mm' | '80mm';
export type FontSize = 'compact' | 'standard' | 'large';
export type LineSpacing = 'compact' | 'normal' | 'relaxed';
export type LogoAlignment = 'left' | 'center' | 'right';

export interface ReceiptSettings {
  id?: string;
  tenantId: string;

  // Business Identity
  businessName: string;
  brandTitle?: string;
  tagline?: string;
  businessType: BusinessType;
  logoUrl?: string;
  logoWidth: number; // in pixels, e.g. 180
  logoAlignment: LogoAlignment;
  address: string;
  city: string;
  country: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  taxId?: string;
  businessRegNo?: string;

  // Receipt Content
  receiptTitle: string; // e.g. "SALES RECEIPT", "TAX INVOICE", "CASH MEMO"
  subtitle?: string;
  footerThankYou: string;
  footerMessage?: string;
  returnPolicy?: string;
  warrantyDisclaimer?: string;
  announcement?: string;
  socialMedia?: string;

  // Printer & Paper
  paperWidth: PaperWidth;
  fontSize: FontSize;
  fontFamily: 'monospace' | 'sans-serif';
  lineSpacing: LineSpacing;
  marginTop: number;
  marginBottom: number;
  feedLines: number;
  cutPaper: boolean;
  openCashDrawer: boolean;

  // Barcode / QR
  showBarcode: boolean;
  showQrCode: boolean;

  // Transaction Fields Toggles
  showInvoiceNumber: boolean;
  showDateTime: boolean;
  showCashier: boolean;
  showBranch: boolean;
  showTerminal: boolean;
  showCustomerName: boolean;
  showCustomerPhone: boolean;
  showCustomerAddress: boolean;
  showCustomerTax: boolean;
  showPaymentMethod: boolean;
  showCashDetails: boolean;
  showChange: boolean;
  showCreditBalance: boolean;
  showOrderNotes: boolean;

  // Auto Care & Technical Details
  showVehicleInfo: boolean;
  showVehicleMakeModel: boolean;
  showVehiclePlate: boolean;
  showVehicleMileage: boolean;
  showMechanic: boolean;
  showJobNumber: boolean;
  showPartNumber: boolean;
  showProductBrand: boolean;
  showVehicleCompatibility: boolean;
  showWarrantyDetails: boolean;

  createdAt?: number;
  updatedAt?: number;
}

export interface ReceiptItem {
  id?: string;
  name: string;
  sku?: string;
  brand?: string;
  compatibility?: string;
  warranty?: string;
  quantity: number;
  price: number;
  discount?: number;
  total: number;
}

export interface ReceiptCustomer {
  id?: string;
  name?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  previousBalance?: number;
  remainingBalance?: number;
}

export interface ReceiptVehicle {
  makeModel?: string;
  plateNumber?: string;
  mileage?: string | number;
  advisor?: string;
  mechanic?: string;
  jobNumber?: string;
  notes?: string;
}

export interface ReceiptData {
  orderNumber: string;
  date: number | string | Date;
  cashierName?: string;
  terminalName?: string;
  branchName?: string;
  customer?: ReceiptCustomer;
  vehicle?: ReceiptVehicle;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  tax: number;
  taxRatePercent?: number;
  total: number;
  paymentMethod: string;
  amountPaid?: number;
  change?: number;
  notes?: string;
  currency?: string;
  barcodeValue?: string;
  qrCodeUrl?: string;
}

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  tenantId: 'default',
  businessName: 'Auto Care Store',
  brandTitle: 'PARTS & ACCESSORIES',
  tagline: 'BETTER PARTS . SMOOTHER DRIVES',
  businessType: 'auto_care',
  logoUrl: '',
  logoWidth: 180,
  logoAlignment: 'center',
  address: 'Shop # 12, Main Auto Market',
  city: 'Karachi',
  country: 'Sindh',
  phone: '021-34567890',
  whatsapp: '0300-1234567',
  email: 'info@autocarestore.com',
  website: 'www.autocarestore.com',
  taxId: '',
  businessRegNo: '',

  receiptTitle: 'SALES RECEIPT',
  subtitle: '',
  footerThankYou: 'Thank You For Choosing Auto Care!',
  footerMessage: 'Keep Your Engine Happy',
  returnPolicy: '7 Days Return with Original Receipt. Electrical items are non-refundable.',
  warrantyDisclaimer: 'Warranty claims must be accompanied by this receipt.',
  announcement: '',
  socialMedia: '@autocarepk',

  paperWidth: '80mm',
  fontSize: 'standard',
  fontFamily: 'monospace',
  lineSpacing: 'normal',
  marginTop: 0,
  marginBottom: 0,
  feedLines: 2,
  cutPaper: true,
  openCashDrawer: false,

  showBarcode: true,
  showQrCode: false,

  showInvoiceNumber: true,
  showDateTime: true,
  showCashier: true,
  showBranch: true,
  showTerminal: true,
  showCustomerName: true,
  showCustomerPhone: true,
  showCustomerAddress: false,
  showCustomerTax: false,
  showPaymentMethod: true,
  showCashDetails: true,
  showChange: true,
  showCreditBalance: true,
  showOrderNotes: true,

  showVehicleInfo: true,
  showVehicleMakeModel: true,
  showVehiclePlate: true,
  showVehicleMileage: true,
  showMechanic: true,
  showJobNumber: true,
  showPartNumber: true,
  showProductBrand: true,
  showVehicleCompatibility: true,
  showWarrantyDetails: true,
};
