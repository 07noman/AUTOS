import { ReceiptData, ReceiptSettings } from './types';
import { generateBarcodeSvg } from './utils/barcode';

let isPrintLocked = false;

/**
 * Generates self-contained, print-ready HTML for thermal receipt printing.
 */
export function generateThermalReceiptHtml(data: ReceiptData, settings: ReceiptSettings): string {
  const paperWidth = settings.paperWidth || '80mm';
  const currency = data.currency || 'PKR';

  const fmtMoney = (val: number | undefined): string => {
    const num = Number(val || 0);
    return num % 1 === 0
      ? num.toLocaleString('en-US')
      : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const d = data.date ? new Date(data.date) : new Date();
  const dateStr = !Number.isNaN(d.getTime())
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : String(data.date);
  const timeStr = !Number.isNaN(d.getTime())
    ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : '';

  const barcodeValue = data.barcodeValue || data.orderNumber || 'AC202610110008';
  const barcodeSvg = settings.showBarcode
    ? generateBarcodeSvg(barcodeValue, {
        height: 40,
        moduleWidth: paperWidth === '58mm' ? 1.2 : 1.5,
        showText: true,
        fontSize: 10,
      })
    : '';

  const hasVehicle = Boolean(
    data.vehicle &&
      (data.vehicle.makeModel ||
        data.vehicle.plateNumber ||
        data.vehicle.mileage ||
        data.vehicle.advisor ||
        data.vehicle.mechanic ||
        data.vehicle.jobNumber)
  );

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${data.orderNumber}</title>
  <style>
    @page {
      size: ${paperWidth} auto;
      margin: 0mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background: #ffffff;
      color: #000000;
      font-family: ${settings.fontFamily === 'sans-serif' ? 'Arial, sans-serif' : "'Courier New', Courier, monospace"};
      font-size: ${settings.fontSize === 'compact' ? '10px' : settings.fontSize === 'large' ? '13px' : '11.5px'};
      line-height: ${settings.lineSpacing === 'compact' ? '1.15' : settings.lineSpacing === 'relaxed' ? '1.4' : '1.25'};
      width: ${paperWidth};
      max-width: ${paperWidth};
      padding: ${paperWidth === '58mm' ? '2mm 3mm 4mm 3mm' : '4mm 5mm 6mm 5mm'};
      margin: 0 auto;
      text-align: left;
    }
    .dashed {
      border-bottom: 1px dashed #000000;
      margin: 5px 0;
    }
    .double-dashed {
      border-bottom: 2px dashed #000000;
      margin: 5px 0;
    }
    .header {
      text-align: center;
      margin-bottom: 5px;
    }
    .logo {
      display: block;
      margin: ${settings.logoAlignment === 'left' ? '0 auto 5px 0' : settings.logoAlignment === 'right' ? '0 0 5px auto' : '0 auto 5px auto'};
      width: ${settings.logoWidth || 180}px;
      max-width: 100%;
      height: auto;
    }
    .tagline {
      font-size: 9.5px;
      font-weight: bold;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .store-name {
      font-size: 15px;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 2px;
    }
    .brand-title {
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .contact-info {
      font-size: 10px;
      line-height: 1.3;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 6px;
      row-gap: 2px;
      font-size: 10px;
    }
    .meta-row {
      display: flex;
    }
    .meta-lbl {
      width: 72px;
      flex-shrink: 0;
    }
    .meta-val {
      font-weight: bold;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    th {
      font-weight: bold;
      border-bottom: 1px solid #000;
      padding-bottom: 2px;
    }
    td {
      padding: 2.5px 0 1px 0;
      vertical-align: top;
    }
    .col-idx { width: 14px; }
    .col-qty { width: 30px; text-align: center; }
    .col-price { width: 55px; text-align: right; }
    .col-amount { width: 60px; text-align: right; font-weight: bold; }
    .subtext {
      font-size: 9px;
      color: #000;
      padding-left: 1px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 1.5px 0;
    }
    .grand-total {
      font-size: 14.5px;
      font-weight: 900;
      padding: 3px 0;
    }
    .footer {
      text-align: center;
      font-size: 10px;
      margin-top: 6px;
      line-height: 1.35;
    }
    .barcode-wrap {
      display: flex;
      justify-content: center;
      margin: 6px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    ${settings.logoUrl ? `<img src="${settings.logoUrl}" class="logo" alt="${settings.businessName}" />` : ''}
    ${settings.tagline ? `<div class="tagline">${escapeHtml(settings.tagline)}</div>` : ''}
    <div class="store-name">${escapeHtml(settings.businessName)}</div>
    ${settings.brandTitle ? `<div class="brand-title">${escapeHtml(settings.brandTitle)}</div>` : ''}
    <div class="contact-info">
      ${settings.address ? `<div>${escapeHtml(settings.address)}</div>` : ''}
      ${settings.city || settings.country ? `<div>${escapeHtml([settings.city, settings.country].filter(Boolean).join(', '))}</div>` : ''}
      ${settings.phone ? `<div>Ph: ${escapeHtml(settings.phone)}</div>` : ''}
      ${settings.whatsapp ? `<div>WhatsApp: ${escapeHtml(settings.whatsapp)}</div>` : ''}
      ${settings.taxId ? `<div>Tax Reg / NTN: ${escapeHtml(settings.taxId)}</div>` : ''}
    </div>
  </div>

  <div class="dashed"></div>

  <div class="meta-grid">
    ${settings.showInvoiceNumber ? `<div class="meta-row"><span class="meta-lbl">Receipt No :</span><span class="meta-val">${escapeHtml(data.orderNumber)}</span></div>` : ''}
    ${settings.showDateTime ? `<div class="meta-row"><span class="meta-lbl">Date    :</span><span class="meta-val">${dateStr}</span></div>` : ''}
    ${settings.showDateTime && timeStr ? `<div class="meta-row"><span class="meta-lbl">Time       :</span><span class="meta-val">${timeStr}</span></div>` : ''}
    ${settings.showCashier && data.cashierName ? `<div class="meta-row"><span class="meta-lbl">Cashier :</span><span class="meta-val">${escapeHtml(data.cashierName)}</span></div>` : ''}
    ${settings.showTerminal ? `<div class="meta-row"><span class="meta-lbl">Terminal   :</span><span class="meta-val">${escapeHtml(data.terminalName || 'POS-01')}</span></div>` : ''}
    ${settings.showCustomerName ? `<div class="meta-row"><span class="meta-lbl">Customer:</span><span class="meta-val">${escapeHtml(data.customer?.name || 'Walk-in')}</span></div>` : ''}
  </div>

  ${settings.showVehicleInfo && hasVehicle ? `
    <div class="dashed"></div>
    <div class="meta-grid">
      ${settings.showVehicleMakeModel && data.vehicle?.makeModel ? `<div class="meta-row"><span class="meta-lbl">Vehicle    :</span><span class="meta-val">${escapeHtml(data.vehicle.makeModel)}</span></div>` : ''}
      ${settings.showVehiclePlate && data.vehicle?.plateNumber ? `<div class="meta-row"><span class="meta-lbl">Plate   :</span><span class="meta-val">${escapeHtml(data.vehicle.plateNumber)}</span></div>` : ''}
      ${settings.showVehicleMileage && data.vehicle?.mileage ? `<div class="meta-row"><span class="meta-lbl">Mileage    :</span><span class="meta-val">${escapeHtml(String(data.vehicle.mileage))}</span></div>` : ''}
      ${settings.showMechanic && (data.vehicle?.advisor || data.vehicle?.mechanic) ? `<div class="meta-row"><span class="meta-lbl">Advisor :</span><span class="meta-val">${escapeHtml(data.vehicle.advisor || data.vehicle.mechanic || '')}</span></div>` : ''}
    </div>
  ` : ''}

  <div class="dashed"></div>

  ${paperWidth === '80mm' ? `
    <table>
      <thead>
        <tr>
          <th class="col-idx">#</th>
          <th>Item Name</th>
          <th class="col-qty">Qty</th>
          <th class="col-price">Price</th>
          <th class="col-amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map((it, idx) => {
          const sub = [
            settings.showProductBrand && it.brand ? it.brand : null,
            settings.showPartNumber && it.sku ? `SKU: ${it.sku}` : null,
            settings.showVehicleCompatibility && it.compatibility ? it.compatibility : null,
          ].filter(Boolean);

          return `
            <tr>
              <td class="col-idx">${idx + 1}</td>
              <td>${escapeHtml(it.name)}</td>
              <td class="col-qty">${it.quantity}</td>
              <td class="col-price">${fmtMoney(it.price)}</td>
              <td class="col-amount">${fmtMoney(it.total)}</td>
            </tr>
            ${sub.length > 0 ? `<tr><td></td><td colspan="4" class="subtext">${escapeHtml(sub.join(' · '))}</td></tr>` : ''}
          `;
        }).join('')}
      </tbody>
    </table>
  ` : `
    <div>
      ${data.items.map((it, idx) => `
        <div style="padding: 2.5px 0;">
          <div style="font-weight:bold;">${idx + 1}. ${escapeHtml(it.name)}</div>
          ${it.brand || it.sku ? `<div class="subtext">${escapeHtml([it.brand, it.sku].filter(Boolean).join(' · '))}</div>` : ''}
          <div style="display:flex; justify-content:space-between; font-size:10px;">
            <span>${it.quantity} × ${fmtMoney(it.price)}</span>
            <span style="font-weight:bold;">${fmtMoney(it.total)}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `}

  <div class="dashed"></div>

  <div>
    <div class="total-row"><span>Subtotal</span><span>${fmtMoney(data.subtotal)}</span></div>
    ${data.discount > 0 ? `<div class="total-row"><span>Discount</span><span>-${fmtMoney(data.discount)}</span></div>` : ''}
    ${data.tax > 0 ? `<div class="total-row"><span>Tax ${data.taxRatePercent ? `(${data.taxRatePercent}%)` : ''}</span><span>${fmtMoney(data.tax)}</span></div>` : ''}
    <div class="double-dashed"></div>
    <div class="total-row grand-total"><span>Total</span><span>${currency} ${fmtMoney(data.total)}</span></div>
    <div class="dashed"></div>
    ${settings.showPaymentMethod ? `<div class="total-row"><span>Payment Method : <strong style="text-transform:capitalize;">${escapeHtml(data.paymentMethod)}</strong></span><span>${data.paymentMethod.toLowerCase() === 'credit' ? 'Credit' : fmtMoney(data.amountPaid ?? data.total)}</span></div>` : ''}
    ${settings.showChange && data.paymentMethod.toLowerCase() === 'cash' ? `<div class="total-row"><span>Change</span><span>${fmtMoney(data.change ?? 0)}</span></div>` : ''}
    ${settings.showCreditBalance && data.paymentMethod.toLowerCase() === 'credit' && data.customer?.remainingBalance !== undefined ? `
      <div class="total-row" style="font-weight:bold;"><span>Remaining Balance</span><span>${fmtMoney(data.customer.remainingBalance)}</span></div>
    ` : ''}
  </div>

  <div class="dashed"></div>

  <div class="footer">
    ${settings.footerThankYou ? `<div style="font-weight:bold;">${escapeHtml(settings.footerThankYou)}</div>` : ''}
    ${settings.footerMessage ? `<div style="font-weight:bold;">${escapeHtml(settings.footerMessage)}</div>` : ''}
    ${settings.returnPolicy ? `<div style="font-size:9px; margin-top:3px;">${escapeHtml(settings.returnPolicy)}</div>` : ''}
    ${barcodeSvg ? `<div class="barcode-wrap">${barcodeSvg}</div>` : ''}
  </div>

  ${Array.from({ length: Math.max(0, settings.feedLines || 2) }).map(() => '<div style="height:5mm;"></div>').join('')}
</body>
</html>`;
}

/**
 * Dispatches thermal print to browser or desktop without blocking UI.
 */
export async function printThermalReceipt(data: ReceiptData, settings: ReceiptSettings): Promise<void> {
  if (isPrintLocked) {
    console.warn('[printThermalReceipt] Print call ignored — debouncing previous click.');
    return;
  }

  isPrintLocked = true;
  try {
    const html = generateThermalReceiptHtml(data, settings);

    // 1. Try Tauri native print command if available
    const printedViaTauri = await tryTauriPrint(html);
    if (printedViaTauri) {
      return;
    }

    // 2. Otherwise trigger native browser print dialog
    printInBrowser(html);
  } finally {
    // Release debounce lock quickly
    window.setTimeout(() => {
      isPrintLocked = false;
    }, 400);
  }
}

async function tryTauriPrint(html: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as {
    __TAURI__?: { invoke: (cmd: string, args: Record<string, unknown>) => Promise<unknown> };
    __TAURI_INTERNALS__?: { invoke: (cmd: string, args: Record<string, unknown>) => Promise<unknown> };
  };
  const invoke = w.__TAURI__?.invoke ?? w.__TAURI_INTERNALS__?.invoke;
  if (!invoke) return false;
  try {
    await invoke('print_receipt', { html });
    return true;
  } catch {
    return false;
  }
}

function printInBrowser(html: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Clean up any existing print elements
  const oldContainer = document.getElementById('genx-thermal-print-container');
  if (oldContainer) oldContainer.remove();
  const oldStyle = document.getElementById('genx-thermal-print-style');
  if (oldStyle) oldStyle.remove();

  // 1. Inject high-priority @media print stylesheet
  const styleEl = document.createElement('style');
  styleEl.id = 'genx-thermal-print-style';
  styleEl.textContent = `
    @media screen {
      #genx-thermal-print-container {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        position: fixed !important;
        left: -9999px !important;
      }
    }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body > *:not(#genx-thermal-print-container) {
        display: none !important;
      }
      #genx-thermal-print-container {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        z-index: 99999999 !important;
      }
    }
  `;
  document.head.appendChild(styleEl);

  // 2. Parse HTML and extract styles and body content
  const container = document.createElement('div');
  container.id = 'genx-thermal-print-container';

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Clone all style elements from template
    doc.querySelectorAll('style').forEach((st) => {
      container.appendChild(st.cloneNode(true));
    });

    // Append thermal receipt body content
    container.innerHTML += doc.body.innerHTML;
  } catch {
    container.innerHTML = html;
  }

  document.body.appendChild(container);

  const cleanup = () => {
    window.setTimeout(() => {
      try {
        container.remove();
        styleEl.remove();
      } catch {}
    }, 1000);
  };

  // 3. Trigger native browser print dialog
  window.setTimeout(() => {
    try {
      window.focus();
      window.print();
    } catch (e) {
      console.warn('window.print() error, retrying:', e);
      window.print();
    } finally {
      cleanup();
    }
  }, 100);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
