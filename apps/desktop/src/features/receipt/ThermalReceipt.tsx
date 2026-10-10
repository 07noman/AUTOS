import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { ReceiptData, ReceiptSettings, PaperWidth } from './types';
import { generateBarcodeSvg } from './utils/barcode';
import './ThermalReceipt.css';

export interface ThermalReceiptProps {
  data: ReceiptData;
  settings: ReceiptSettings;
  paperWidthOverride?: PaperWidth;
  preview?: boolean;
}

export function ThermalReceipt({
  data,
  settings,
  paperWidthOverride,
  preview = false,
}: ThermalReceiptProps) {
  const paperWidth = paperWidthOverride || settings.paperWidth || '80mm';
  const currency = data.currency || 'PKR';

  // Format monetary value
  const fmtMoney = (val: number | undefined): string => {
    const num = Number(val || 0);
    return num % 1 === 0
      ? num.toLocaleString('en-US')
      : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Format Date and Time
  const { dateStr, timeStr } = useMemo(() => {
    try {
      const d = data.date ? new Date(data.date) : new Date();
      if (Number.isNaN(d.getTime())) return { dateStr: String(data.date), timeStr: '' };
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return {
        dateStr: `${yyyy}-${mm}-${dd}`,
        timeStr: `${hh}:${min}`,
      };
    } catch {
      return { dateStr: String(data.date), timeStr: '' };
    }
  }, [data.date]);

  // Barcode SVG
  const barcodeValue = data.barcodeValue || data.orderNumber || 'AC202610110008';
  const barcodeSvgHtml = useMemo(() => {
    if (!settings.showBarcode || !barcodeValue) return '';
    return generateBarcodeSvg(barcodeValue, {
      height: 40,
      moduleWidth: paperWidth === '58mm' ? 1.2 : 1.5,
      showText: true,
      fontSize: 10,
    });
  }, [settings.showBarcode, barcodeValue, paperWidth]);

  // QR Code
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  useEffect(() => {
    if (!settings.showQrCode) {
      setQrCodeDataUrl('');
      return;
    }
    const qrTarget = data.qrCodeUrl || `https://genxpos.cloud/receipt/${barcodeValue}`;
    QRCode.toDataURL(qrTarget, {
      width: paperWidth === '58mm' ? 100 : 130,
      margin: 0,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(setQrCodeDataUrl)
      .catch((err) => console.warn('QR Code generation failed:', err));
  }, [settings.showQrCode, data.qrCodeUrl, barcodeValue, paperWidth]);

  // Determine logo alignment class
  const logoAlignClass =
    settings.logoAlignment === 'left'
      ? 'tr-logo-left'
      : settings.logoAlignment === 'right'
      ? 'tr-logo-right'
      : 'tr-logo-center';

  // Check if vehicle information actually exists
  const hasVehicleData = Boolean(
    data.vehicle &&
      (data.vehicle.makeModel ||
        data.vehicle.plateNumber ||
        data.vehicle.mileage ||
        data.vehicle.advisor ||
        data.vehicle.mechanic ||
        data.vehicle.jobNumber)
  );

  return (
    <div className={`thermal-receipt-wrapper ${preview ? 'thermal-receipt-preview-card' : ''}`}>
      <div
        className={`thermal-receipt paper-${paperWidth} font-${settings.fontSize || 'standard'} font-${settings.fontFamily === 'sans-serif' ? 'sans' : 'mono'} spacing-${settings.lineSpacing || 'normal'}`}
        style={{
          marginTop: `${settings.marginTop || 0}mm`,
          marginBottom: `${settings.marginBottom || 0}mm`,
        }}
      >
        {/* ── A. BUSINESS HEADER ──────────────────────────────────────────────── */}
        <div className="tr-header">
          {/* Logo */}
          {settings.logoUrl && (
            <div className={`tr-logo-container ${logoAlignClass}`}>
              <img
                src={settings.logoUrl}
                alt={settings.businessName}
                style={{
                  width: `${settings.logoWidth || 180}px`,
                  maxWidth: '100%',
                }}
              />
            </div>
          )}

          {/* Brand Tagline */}
          {settings.tagline && (
            <div className="tr-tagline">{settings.tagline}</div>
          )}

          {/* Business Name */}
          <div className="tr-store-name">{settings.businessName || 'Auto Care Store'}</div>

          {/* Brand Heading / Subtitle */}
          {settings.brandTitle && (
            <div className="tr-brand-title">{settings.brandTitle}</div>
          )}

          {/* Address & Contact */}
          <div className="tr-contact-info">
            {settings.address && <div>{settings.address}</div>}
            {(settings.city || settings.country) && (
              <div>
                {[settings.city, settings.country].filter(Boolean).join(', ')}
              </div>
            )}
            {settings.phone && <div>Ph: {settings.phone}</div>}
            {settings.whatsapp && <div>WhatsApp: {settings.whatsapp}</div>}
            {settings.email && <div>Email: {settings.email}</div>}
            {settings.website && <div>Web: {settings.website}</div>}
            {settings.taxId && <div>Tax Reg / NTN: {settings.taxId}</div>}
            {settings.businessRegNo && <div>Reg #: {settings.businessRegNo}</div>}
          </div>
        </div>

        {/* ── B. TRANSACTION & METADATA GRID ──────────────────────────────────── */}
        <div className="tr-dashed-line" />

        <div className="tr-meta-grid">
          {settings.showInvoiceNumber && (
            <div className="tr-meta-row">
              <span className="tr-meta-label">Receipt No :</span>
              <span className="tr-meta-val">{data.orderNumber}</span>
            </div>
          )}
          {settings.showDateTime && (
            <div className="tr-meta-row">
              <span className="tr-meta-label">Date    :</span>
              <span className="tr-meta-val">{dateStr}</span>
            </div>
          )}
          {settings.showDateTime && timeStr && (
            <div className="tr-meta-row">
              <span className="tr-meta-label">Time       :</span>
              <span className="tr-meta-val">{timeStr}</span>
            </div>
          )}
          {settings.showCashier && data.cashierName && (
            <div className="tr-meta-row">
              <span className="tr-meta-label">Cashier :</span>
              <span className="tr-meta-val">{data.cashierName}</span>
            </div>
          )}
          {settings.showTerminal && (
            <div className="tr-meta-row">
              <span className="tr-meta-label">Terminal   :</span>
              <span className="tr-meta-val">{data.terminalName || 'POS-01'}</span>
            </div>
          )}
          {settings.showCustomerName && (
            <div className="tr-meta-row">
              <span className="tr-meta-label">Customer:</span>
              <span className="tr-meta-val">{data.customer?.name || 'Walk-in'}</span>
            </div>
          )}
          {settings.showBranch && data.branchName && (
            <div className="tr-meta-row">
              <span className="tr-meta-label">Branch     :</span>
              <span className="tr-meta-val">{data.branchName}</span>
            </div>
          )}
          {settings.showCustomerPhone && data.customer?.phone && (
            <div className="tr-meta-row">
              <span className="tr-meta-label">Phone   :</span>
              <span className="tr-meta-val">{data.customer.phone}</span>
            </div>
          )}
          {settings.showCustomerAddress && data.customer?.address && (
            <div className="tr-meta-row" style={{ gridColumn: 'span 2' }}>
              <span className="tr-meta-label">Address    :</span>
              <span className="tr-meta-val">{data.customer.address}</span>
            </div>
          )}
          {settings.showCustomerTax && data.customer?.taxId && (
            <div className="tr-meta-row">
              <span className="tr-meta-label">Cust Tax  :</span>
              <span className="tr-meta-val">{data.customer.taxId}</span>
            </div>
          )}
        </div>

        {/* ── AUTO CARE VEHICLE & SERVICE DETAILS (When Available) ─────────────── */}
        {settings.showVehicleInfo && hasVehicleData && (
          <>
            <div className="tr-dashed-line" />
            <div className="tr-meta-grid">
              {settings.showVehicleMakeModel && data.vehicle?.makeModel && (
                <div className="tr-meta-row">
                  <span className="tr-meta-label">Vehicle    :</span>
                  <span className="tr-meta-val">{data.vehicle.makeModel}</span>
                </div>
              )}
              {settings.showVehiclePlate && data.vehicle?.plateNumber && (
                <div className="tr-meta-row">
                  <span className="tr-meta-label">Plate   :</span>
                  <span className="tr-meta-val">{data.vehicle.plateNumber}</span>
                </div>
              )}
              {settings.showVehicleMileage && data.vehicle?.mileage && (
                <div className="tr-meta-row">
                  <span className="tr-meta-label">Mileage    :</span>
                  <span className="tr-meta-val">{data.vehicle.mileage}</span>
                </div>
              )}
              {settings.showMechanic && (data.vehicle?.advisor || data.vehicle?.mechanic) && (
                <div className="tr-meta-row">
                  <span className="tr-meta-label">Advisor :</span>
                  <span className="tr-meta-val">{data.vehicle.advisor || data.vehicle.mechanic}</span>
                </div>
              )}
              {settings.showJobNumber && data.vehicle?.jobNumber && (
                <div className="tr-meta-row">
                  <span className="tr-meta-label">Job No     :</span>
                  <span className="tr-meta-val">{data.vehicle.jobNumber}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* ── C. ITEMIZED PURCHASE TABLE ──────────────────────────────────────── */}
        <div className="tr-dashed-line" />

        {paperWidth === '80mm' ? (
          /* Standard 80mm Table View */
          <table className="tr-items-table">
            <thead>
              <tr className="tr-items-header">
                <th className="tr-col-idx">#</th>
                <th className="tr-col-name">Item Name</th>
                <th className="tr-col-qty">Qty</th>
                <th className="tr-col-price">Price</th>
                <th className="tr-col-amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, idx) => {
                const subMeta = [
                  settings.showProductBrand && item.brand ? item.brand : null,
                  settings.showPartNumber && item.sku ? `SKU: ${item.sku}` : null,
                  settings.showVehicleCompatibility && item.compatibility ? item.compatibility : null,
                  settings.showWarrantyDetails && item.warranty ? `Warranty: ${item.warranty}` : null,
                ].filter(Boolean);

                return (
                  <React.Fragment key={item.id || idx}>
                    <tr className="tr-item-row">
                      <td className="tr-col-idx">{idx + 1}</td>
                      <td className="tr-col-name">{item.name}</td>
                      <td className="tr-col-qty">{item.quantity}</td>
                      <td className="tr-col-price">{fmtMoney(item.price)}</td>
                      <td className="tr-col-amount">{fmtMoney(item.total)}</td>
                    </tr>
                    {subMeta.length > 0 && (
                      <tr>
                        <td />
                        <td colSpan={4} className="tr-item-subtext">
                          {subMeta.join(' · ')}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* Stacked 58mm Narrow View */
          <div className="tr-stacked-items">
            {data.items.map((item, idx) => {
              const subMeta = [
                settings.showProductBrand && item.brand ? item.brand : null,
                settings.showPartNumber && item.sku ? item.sku : null,
                settings.showVehicleCompatibility && item.compatibility ? item.compatibility : null,
              ].filter(Boolean);

              return (
                <div key={item.id || idx} className="tr-stacked-item">
                  <div className="tr-stacked-title">
                    {idx + 1}. {item.name}
                  </div>
                  {subMeta.length > 0 && (
                    <div className="tr-item-subtext">
                      {subMeta.join(' · ')}
                    </div>
                  )}
                  <div className="tr-stacked-calc">
                    <span>
                      {item.quantity} × {fmtMoney(item.price)}
                    </span>
                    <span style={{ fontWeight: 600 }}>{fmtMoney(item.total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── D. FINANCIAL SUMMARY ────────────────────────────────────────────── */}
        <div className="tr-dashed-line" />

        <div className="tr-totals-block">
          <div className="tr-total-row">
            <span>Subtotal</span>
            <span>{fmtMoney(data.subtotal)}</span>
          </div>

          {data.discount > 0 && (
            <div className="tr-total-row">
              <span>Discount</span>
              <span>-{fmtMoney(data.discount)}</span>
            </div>
          )}

          {data.tax > 0 && (
            <div className="tr-total-row">
              <span>Tax {data.taxRatePercent ? `(${data.taxRatePercent}%)` : ''}</span>
              <span>{fmtMoney(data.tax)}</span>
            </div>
          )}

          <div className="tr-double-line" />

          {/* Grand Total */}
          <div className="tr-total-row tr-grand-total">
            <span>Total</span>
            <span className="tr-total-val">{currency} {fmtMoney(data.total)}</span>
          </div>

          <div className="tr-dashed-line" />

          {/* Payment & Change / Credit Details */}
          {settings.showPaymentMethod && (
            <div className="tr-total-row">
              <span>Payment Method : <strong style={{ textTransform: 'capitalize' }}>{data.paymentMethod}</strong></span>
              {data.paymentMethod.toLowerCase() === 'credit' ? (
                <span>Credit</span>
              ) : (
                <span>{fmtMoney(data.amountPaid ?? data.total)}</span>
              )}
            </div>
          )}

          {settings.showChange && data.paymentMethod.toLowerCase() === 'cash' && (
            <div className="tr-total-row">
              <span>Change</span>
              <span>{fmtMoney(data.change ?? 0)}</span>
            </div>
          )}

          {/* Credit Account Balance */}
          {settings.showCreditBalance && data.paymentMethod.toLowerCase() === 'credit' && (
            <>
              {data.customer?.previousBalance !== undefined && (
                <div className="tr-total-row">
                  <span>Previous Balance</span>
                  <span>{fmtMoney(data.customer.previousBalance)}</span>
                </div>
              )}
              {data.customer?.remainingBalance !== undefined && (
                <div className="tr-total-row" style={{ fontWeight: 700 }}>
                  <span>Remaining Balance</span>
                  <span>{fmtMoney(data.customer.remainingBalance)}</span>
                </div>
              )}
            </>
          )}

          {settings.showOrderNotes && data.notes && (
            <div className="tr-total-row" style={{ fontStyle: 'italic', marginTop: 4 }}>
              <span>Notes: {data.notes}</span>
            </div>
          )}
        </div>

        {/* ── E. FOOTER & POLICIES ────────────────────────────────────────────── */}
        <div className="tr-dashed-line" />

        <div className="tr-footer">
          {settings.footerThankYou && (
            <div className="tr-footer-thankyou">{settings.footerThankYou}</div>
          )}
          {settings.footerMessage && (
            <div style={{ fontWeight: 600 }}>{settings.footerMessage}</div>
          )}
          {settings.announcement && (
            <div style={{ marginTop: 3, fontWeight: 700 }}>{settings.announcement}</div>
          )}
          {settings.returnPolicy && (
            <div className="tr-footer-policy">{settings.returnPolicy}</div>
          )}
          {settings.warrantyDisclaimer && (
            <div className="tr-footer-policy">{settings.warrantyDisclaimer}</div>
          )}
          {settings.socialMedia && (
            <div style={{ marginTop: 3, fontSize: 9.5 }}>Follow us: {settings.socialMedia}</div>
          )}

          {/* Barcode Output */}
          {settings.showBarcode && barcodeSvgHtml && (
            <div
              className="tr-barcode-container"
              dangerouslySetInnerHTML={{ __html: barcodeSvgHtml }}
            />
          )}

          {/* QR Code Output */}
          {settings.showQrCode && qrCodeDataUrl && (
            <div className="tr-barcode-container">
              <img
                src={qrCodeDataUrl}
                alt="QR Code"
                style={{ width: paperWidth === '58mm' ? '90px' : '110px' }}
              />
              <div style={{ fontSize: 9, marginTop: 2 }}>Scan to verify invoice</div>
            </div>
          )}
        </div>

        {/* Paper Feed Lines */}
        {Array.from({ length: Math.max(0, settings.feedLines || 2) }).map((_, i) => (
          <div key={i} style={{ height: '5mm' }} />
        ))}
      </div>
    </div>
  );
}

export default ThermalReceipt;
