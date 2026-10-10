import { getDatabase, getCurrentTenantId } from './db';
import { supabase, isSupabaseConfigured } from './supabase';
import { ReceiptSettings, DEFAULT_RECEIPT_SETTINGS } from '@/features/receipt/types';

export const receiptSettingsRepo = {
  /**
   * Loads receipt settings for the given or current tenant.
   * Multi-tier retrieval: Supabase Cloud -> Local SQLite -> LocalStorage -> Safe Defaults.
   */
  async getSettings(tenantId: string = getCurrentTenantId()): Promise<ReceiptSettings> {
    const effectiveTenantId = tenantId || 'default';

    // 1. Try Supabase Cloud first
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('receipt_settings')
          .select('*')
          .eq('tenant_id', effectiveTenantId)
          .maybeSingle();

        if (!error && data) {
          const mapped = mapSupabaseToSettings(data);
          // Update local cache
          saveToLocalStorage(effectiveTenantId, mapped);
          void saveToSqlite(mapped).catch(() => {});
          return mapped;
        }
      } catch (err) {
        console.warn('[receiptSettingsRepo] Supabase fetch error:', err);
      }
    }

    // 2. Try Local SQLite
    try {
      const db = await getDatabase();
      const rows = await db.select<any[]>(
        'SELECT * FROM receipt_settings WHERE tenant_id = ? LIMIT 1',
        [effectiveTenantId]
      );
      if (rows && rows.length > 0) {
        const mapped = mapSqliteToSettings(rows[0]);
        saveToLocalStorage(effectiveTenantId, mapped);
        return mapped;
      }
    } catch (err) {
      // Local SQLite may be unavailable in pure browser dev
    }

    // 3. Try LocalStorage
    const local = loadFromLocalStorage(effectiveTenantId);
    if (local) {
      return local;
    }

    // 4. Fallback to Safe Defaults
    return {
      ...DEFAULT_RECEIPT_SETTINGS,
      tenantId: effectiveTenantId,
    };
  },

  /**
   * Persists receipt settings across Cloud, Local SQLite, and LocalStorage.
   */
  async saveSettings(settings: ReceiptSettings): Promise<ReceiptSettings> {
    const effectiveTenantId = settings.tenantId || getCurrentTenantId() || 'default';
    const now = Date.now();
    const toSave: ReceiptSettings = {
      ...settings,
      tenantId: effectiveTenantId,
      id: settings.id || `rec_set_${effectiveTenantId}`,
      updatedAt: now,
      createdAt: settings.createdAt || now,
    };

    // 1. Save to LocalStorage immediately
    saveToLocalStorage(effectiveTenantId, toSave);

    // 2. Save to SQLite
    try {
      await saveToSqlite(toSave);
    } catch (err) {
      console.warn('[receiptSettingsRepo] SQLite save warning:', err);
    }

    // 3. Save to Supabase Cloud
    if (isSupabaseConfigured()) {
      try {
        const payload = mapSettingsToSupabase(toSave);
        const { error } = await supabase
          .from('receipt_settings')
          .upsert(payload, { onConflict: 'tenant_id' });

        if (error) {
          console.warn('[receiptSettingsRepo] Supabase upsert warning:', error.message);
        }
      } catch (err) {
        console.warn('[receiptSettingsRepo] Supabase cloud save warning:', err);
      }
    }

    return toSave;
  },

  /**
   * Resets tenant's receipt settings to the default professional branding.
   */
  async resetToDefaults(tenantId: string = getCurrentTenantId()): Promise<ReceiptSettings> {
    const effectiveTenantId = tenantId || 'default';
    const fresh: ReceiptSettings = {
      ...DEFAULT_RECEIPT_SETTINGS,
      tenantId: effectiveTenantId,
      id: `rec_set_${effectiveTenantId}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    return this.saveSettings(fresh);
  },
};

// ─── LocalStorage Helpers ──────────────────────────────────────────────────────

function getStorageKey(tenantId: string): string {
  return `genx:receipt_settings:${tenantId}`;
}

function loadFromLocalStorage(tenantId: string): ReceiptSettings | null {
  try {
    const raw = localStorage.getItem(getStorageKey(tenantId));
    if (raw) {
      return JSON.parse(raw) as ReceiptSettings;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveToLocalStorage(tenantId: string, settings: ReceiptSettings): void {
  try {
    localStorage.setItem(getStorageKey(tenantId), JSON.stringify(settings));
  } catch {
    // Ignore quota errors
  }
}

// ─── SQLite Persistence ───────────────────────────────────────────────────────

async function saveToSqlite(s: ReceiptSettings): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO receipt_settings (
      id, tenant_id, business_name, brand_title, tagline, business_type,
      logo_url, logo_width, logo_alignment, address, city, country, phone,
      whatsapp, email, website, tax_id, business_reg_no, receipt_title, subtitle,
      footer_thank_you, footer_message, return_policy, warranty_disclaimer,
      announcement, social_media, paper_width, font_size, font_family, line_spacing,
      margin_top, margin_bottom, feed_lines, cut_paper, open_cash_drawer,
      show_barcode, show_qr_code, show_invoice_number, show_date_time, show_cashier,
      show_branch, show_terminal, show_customer_name, show_customer_phone,
      show_customer_address, show_customer_tax, show_payment_method, show_cash_details,
      show_change, show_credit_balance, show_order_notes, show_vehicle_info,
      show_vehicle_make_model, show_vehicle_plate, show_vehicle_mileage, show_mechanic,
      show_job_number, show_part_number, show_product_brand, show_vehicle_compatibility,
      show_warranty_details, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?
    )
    ON CONFLICT(tenant_id) DO UPDATE SET
      business_name = excluded.business_name,
      brand_title = excluded.brand_title,
      tagline = excluded.tagline,
      business_type = excluded.business_type,
      logo_url = excluded.logo_url,
      logo_width = excluded.logo_width,
      logo_alignment = excluded.logo_alignment,
      address = excluded.address,
      city = excluded.city,
      country = excluded.country,
      phone = excluded.phone,
      whatsapp = excluded.whatsapp,
      email = excluded.email,
      website = excluded.website,
      tax_id = excluded.tax_id,
      business_reg_no = excluded.business_reg_no,
      receipt_title = excluded.receipt_title,
      subtitle = excluded.subtitle,
      footer_thank_you = excluded.footer_thank_you,
      footer_message = excluded.footer_message,
      return_policy = excluded.return_policy,
      warranty_disclaimer = excluded.warranty_disclaimer,
      announcement = excluded.announcement,
      social_media = excluded.social_media,
      paper_width = excluded.paper_width,
      font_size = excluded.font_size,
      font_family = excluded.font_family,
      line_spacing = excluded.line_spacing,
      margin_top = excluded.margin_top,
      margin_bottom = excluded.margin_bottom,
      feed_lines = excluded.feed_lines,
      cut_paper = excluded.cut_paper,
      open_cash_drawer = excluded.open_cash_drawer,
      show_barcode = excluded.show_barcode,
      show_qr_code = excluded.show_qr_code,
      show_invoice_number = excluded.show_invoice_number,
      show_date_time = excluded.show_date_time,
      show_cashier = excluded.show_cashier,
      show_branch = excluded.show_branch,
      show_terminal = excluded.show_terminal,
      show_customer_name = excluded.show_customer_name,
      show_customer_phone = excluded.show_customer_phone,
      show_customer_address = excluded.show_customer_address,
      show_customer_tax = excluded.show_customer_tax,
      show_payment_method = excluded.show_payment_method,
      show_cash_details = excluded.show_cash_details,
      show_change = excluded.show_change,
      show_credit_balance = excluded.show_credit_balance,
      show_order_notes = excluded.show_order_notes,
      show_vehicle_info = excluded.show_vehicle_info,
      show_vehicle_make_model = excluded.show_vehicle_make_model,
      show_vehicle_plate = excluded.show_vehicle_plate,
      show_vehicle_mileage = excluded.show_vehicle_mileage,
      show_mechanic = excluded.show_mechanic,
      show_job_number = excluded.show_job_number,
      show_part_number = excluded.show_part_number,
      show_product_brand = excluded.show_product_brand,
      show_vehicle_compatibility = excluded.show_vehicle_compatibility,
      show_warranty_details = excluded.show_warranty_details,
      updated_at = excluded.updated_at`,
    [
      s.id || `rec_set_${s.tenantId}`,
      s.tenantId,
      s.businessName,
      s.brandTitle || null,
      s.tagline || null,
      s.businessType,
      s.logoUrl || null,
      s.logoWidth,
      s.logoAlignment,
      s.address,
      s.city,
      s.country,
      s.phone,
      s.whatsapp || null,
      s.email || null,
      s.website || null,
      s.taxId || null,
      s.businessRegNo || null,
      s.receiptTitle,
      s.subtitle || null,
      s.footerThankYou,
      s.footerMessage || null,
      s.returnPolicy || null,
      s.warrantyDisclaimer || null,
      s.announcement || null,
      s.socialMedia || null,
      s.paperWidth,
      s.fontSize,
      s.fontFamily,
      s.lineSpacing,
      s.marginTop,
      s.marginBottom,
      s.feedLines,
      s.cutPaper ? 1 : 0,
      s.openCashDrawer ? 1 : 0,
      s.showBarcode ? 1 : 0,
      s.showQrCode ? 1 : 0,
      s.showInvoiceNumber ? 1 : 0,
      s.showDateTime ? 1 : 0,
      s.showCashier ? 1 : 0,
      s.showBranch ? 1 : 0,
      s.showTerminal ? 1 : 0,
      s.showCustomerName ? 1 : 0,
      s.showCustomerPhone ? 1 : 0,
      s.showCustomerAddress ? 1 : 0,
      s.showCustomerTax ? 1 : 0,
      s.showPaymentMethod ? 1 : 0,
      s.showCashDetails ? 1 : 0,
      s.showChange ? 1 : 0,
      s.showCreditBalance ? 1 : 0,
      s.showOrderNotes ? 1 : 0,
      s.showVehicleInfo ? 1 : 0,
      s.showVehicleMakeModel ? 1 : 0,
      s.showVehiclePlate ? 1 : 0,
      s.showVehicleMileage ? 1 : 0,
      s.showMechanic ? 1 : 0,
      s.showJobNumber ? 1 : 0,
      s.showPartNumber ? 1 : 0,
      s.showProductBrand ? 1 : 0,
      s.showVehicleCompatibility ? 1 : 0,
      s.showWarrantyDetails ? 1 : 0,
      s.createdAt || Date.now(),
      s.updatedAt || Date.now(),
    ]
  );
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapSqliteToSettings(r: any): ReceiptSettings {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    businessName: r.business_name || DEFAULT_RECEIPT_SETTINGS.businessName,
    brandTitle: r.brand_title || undefined,
    tagline: r.tagline || undefined,
    businessType: r.business_type || 'auto_care',
    logoUrl: r.logo_url || undefined,
    logoWidth: Number(r.logo_width || 180),
    logoAlignment: r.logo_alignment || 'center',
    address: r.address || '',
    city: r.city || '',
    country: r.country || '',
    phone: r.phone || '',
    whatsapp: r.whatsapp || undefined,
    email: r.email || undefined,
    website: r.website || undefined,
    taxId: r.tax_id || undefined,
    businessRegNo: r.business_reg_no || undefined,
    receiptTitle: r.receipt_title || DEFAULT_RECEIPT_SETTINGS.receiptTitle,
    subtitle: r.subtitle || undefined,
    footerThankYou: r.footer_thank_you || DEFAULT_RECEIPT_SETTINGS.footerThankYou,
    footerMessage: r.footer_message || undefined,
    returnPolicy: r.return_policy || undefined,
    warrantyDisclaimer: r.warranty_disclaimer || undefined,
    announcement: r.announcement || undefined,
    socialMedia: r.social_media || undefined,
    paperWidth: r.paper_width || '80mm',
    fontSize: r.font_size || 'standard',
    fontFamily: r.font_family || 'monospace',
    lineSpacing: r.line_spacing || 'normal',
    marginTop: Number(r.margin_top || 0),
    marginBottom: Number(r.margin_bottom || 0),
    feedLines: Number(r.feed_lines ?? 2),
    cutPaper: Boolean(r.cut_paper),
    openCashDrawer: Boolean(r.open_cash_drawer),
    showBarcode: Boolean(r.show_barcode),
    showQrCode: Boolean(r.show_qr_code),
    showInvoiceNumber: Boolean(r.show_invoice_number),
    showDateTime: Boolean(r.show_date_time),
    showCashier: Boolean(r.show_cashier),
    showBranch: Boolean(r.show_branch),
    showTerminal: Boolean(r.show_terminal),
    showCustomerName: Boolean(r.show_customer_name),
    showCustomerPhone: Boolean(r.show_customer_phone),
    showCustomerAddress: Boolean(r.show_customer_address),
    showCustomerTax: Boolean(r.show_customer_tax),
    showPaymentMethod: Boolean(r.show_payment_method),
    showCashDetails: Boolean(r.show_cash_details),
    showChange: Boolean(r.show_change),
    showCreditBalance: Boolean(r.show_credit_balance),
    showOrderNotes: Boolean(r.show_order_notes),
    showVehicleInfo: Boolean(r.show_vehicle_info),
    showVehicleMakeModel: Boolean(r.show_vehicle_make_model),
    showVehiclePlate: Boolean(r.show_vehicle_plate),
    showVehicleMileage: Boolean(r.show_vehicle_mileage),
    showMechanic: Boolean(r.show_mechanic),
    showJobNumber: Boolean(r.show_job_number),
    showPartNumber: Boolean(r.show_part_number),
    showProductBrand: Boolean(r.show_product_brand),
    showVehicleCompatibility: Boolean(r.show_vehicle_compatibility),
    showWarrantyDetails: Boolean(r.show_warranty_details),
    createdAt: Number(r.created_at || Date.now()),
    updatedAt: Number(r.updated_at || Date.now()),
  };
}

function mapSupabaseToSettings(data: any): ReceiptSettings {
  return {
    id: data.id,
    tenantId: data.tenant_id,
    businessName: data.business_name || DEFAULT_RECEIPT_SETTINGS.businessName,
    brandTitle: data.brand_title || undefined,
    tagline: data.tagline || undefined,
    businessType: data.business_type || 'auto_care',
    logoUrl: data.logo_url || undefined,
    logoWidth: Number(data.logo_width || 180),
    logoAlignment: data.logo_alignment || 'center',
    address: data.address || '',
    city: data.city || '',
    country: data.country || '',
    phone: data.phone || '',
    whatsapp: data.whatsapp || undefined,
    email: data.email || undefined,
    website: data.website || undefined,
    taxId: data.tax_id || undefined,
    businessRegNo: data.business_reg_no || undefined,
    receiptTitle: data.receipt_title || DEFAULT_RECEIPT_SETTINGS.receiptTitle,
    subtitle: data.subtitle || undefined,
    footerThankYou: data.footer_thank_you || DEFAULT_RECEIPT_SETTINGS.footerThankYou,
    footerMessage: data.footer_message || undefined,
    returnPolicy: data.return_policy || undefined,
    warrantyDisclaimer: data.warranty_disclaimer || undefined,
    announcement: data.announcement || undefined,
    socialMedia: data.social_media || undefined,
    paperWidth: data.paper_width || '80mm',
    fontSize: data.font_size || 'standard',
    fontFamily: data.font_family || 'monospace',
    lineSpacing: data.line_spacing || 'normal',
    marginTop: Number(data.margin_top || 0),
    marginBottom: Number(data.margin_bottom || 0),
    feedLines: Number(data.feed_lines ?? 2),
    cutPaper: Boolean(data.cut_paper),
    openCashDrawer: Boolean(data.open_cash_drawer),
    showBarcode: Boolean(data.show_barcode),
    showQrCode: Boolean(data.show_qr_code),
    showInvoiceNumber: Boolean(data.show_invoice_number),
    showDateTime: Boolean(data.show_date_time),
    showCashier: Boolean(data.show_cashier),
    showBranch: Boolean(data.show_branch),
    showTerminal: Boolean(data.show_terminal),
    showCustomerName: Boolean(data.show_customer_name),
    showCustomerPhone: Boolean(data.show_customer_phone),
    showCustomerAddress: Boolean(data.show_customer_address),
    showCustomerTax: Boolean(data.show_customer_tax),
    showPaymentMethod: Boolean(data.show_payment_method),
    showCashDetails: Boolean(data.show_cash_details),
    showChange: Boolean(data.show_change),
    showCreditBalance: Boolean(data.show_credit_balance),
    showOrderNotes: Boolean(data.show_order_notes),
    showVehicleInfo: Boolean(data.show_vehicle_info),
    showVehicleMakeModel: Boolean(data.show_vehicle_make_model),
    showVehiclePlate: Boolean(data.show_vehicle_plate),
    showVehicleMileage: Boolean(data.show_vehicle_mileage),
    showMechanic: Boolean(data.show_mechanic),
    showJobNumber: Boolean(data.show_job_number),
    showPartNumber: Boolean(data.show_part_number),
    showProductBrand: Boolean(data.show_product_brand),
    showVehicleCompatibility: Boolean(data.show_vehicle_compatibility),
    showWarrantyDetails: Boolean(data.show_warranty_details),
    createdAt: Number(data.created_at || Date.now()),
    updatedAt: Number(data.updated_at || Date.now()),
  };
}

function mapSettingsToSupabase(s: ReceiptSettings): any {
  return {
    id: s.id || `rec_set_${s.tenantId}`,
    tenant_id: s.tenantId,
    business_name: s.businessName,
    brand_title: s.brandTitle || null,
    tagline: s.tagline || null,
    business_type: s.businessType,
    logo_url: s.logoUrl || null,
    logo_width: s.logoWidth,
    logo_alignment: s.logoAlignment,
    address: s.address,
    city: s.city,
    country: s.country,
    phone: s.phone,
    whatsapp: s.whatsapp || null,
    email: s.email || null,
    website: s.website || null,
    tax_id: s.taxId || null,
    business_reg_no: s.businessRegNo || null,
    receipt_title: s.receiptTitle,
    subtitle: s.subtitle || null,
    footer_thank_you: s.footerThankYou,
    footer_message: s.footerMessage || null,
    return_policy: s.returnPolicy || null,
    warranty_disclaimer: s.warrantyDisclaimer || null,
    announcement: s.announcement || null,
    social_media: s.socialMedia || null,
    paper_width: s.paperWidth,
    font_size: s.fontSize,
    font_family: s.fontFamily,
    line_spacing: s.lineSpacing,
    margin_top: s.marginTop,
    margin_bottom: s.marginBottom,
    feed_lines: s.feedLines,
    cut_paper: s.cutPaper,
    open_cash_drawer: s.openCashDrawer,
    show_barcode: s.showBarcode,
    show_qr_code: s.showQrCode,
    show_invoice_number: s.showInvoiceNumber,
    show_date_time: s.showDateTime,
    show_cashier: s.showCashier,
    show_branch: s.showBranch,
    show_terminal: s.showTerminal,
    show_customer_name: s.showCustomerName,
    show_customer_phone: s.showCustomerPhone,
    show_customer_address: s.showCustomerAddress,
    show_customer_tax: s.showCustomerTax,
    show_payment_method: s.showPaymentMethod,
    show_cash_details: s.showCashDetails,
    show_change: s.showChange,
    show_credit_balance: s.showCreditBalance,
    show_order_notes: s.showOrderNotes,
    show_vehicle_info: s.showVehicleInfo,
    show_vehicle_make_model: s.showVehicleMakeModel,
    show_vehicle_plate: s.showVehiclePlate,
    show_vehicle_mileage: s.showVehicleMileage,
    show_mechanic: s.showMechanic,
    show_job_number: s.showJobNumber,
    show_part_number: s.showPartNumber,
    show_product_brand: s.showProductBrand,
    show_vehicle_compatibility: s.showVehicleCompatibility,
    show_warranty_details: s.showWarrantyDetails,
    created_at: s.createdAt || Date.now(),
    updated_at: s.updatedAt || Date.now(),
  };
}
