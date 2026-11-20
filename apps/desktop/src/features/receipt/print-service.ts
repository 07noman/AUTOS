import { ReceiptData, ReceiptSettings } from './types';
import { generateBarcodeSvg } from './utils/barcode';

/* FIX #3 & #4: Read Cashier Name from localStorage, never garbled text */
function getCashierNameForPrint(dataCashier?: string): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('cashierName');
    if (stored === 'orgpyurgenal') {
      try { localStorage.removeItem('cashierName'); } catch {}
    } else if (stored && stored.trim()) {
      return stored.trim();
    }
  }
  if (dataCashier && dataCashier.trim() && dataCashier.trim() !== 'orgpyurgenal') {
    return dataCashier.trim();
  }
  return '-';
}


/**
 * Generates self-contained, print-ready HTML for thermal receipt printing.
 * FIX #1-#11 applied to printed output.
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

  const items = Array.isArray(data.items) ? data.items : [];
  const paymentMethod = (data.paymentMethod || 'cash').toLowerCase();

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

  /* FIX #3 & #4: Use clean cashier name from localStorage */
  const cashierName = getCashierNameForPrint(data.cashierName);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${data.orderNumber}</title>
  <style>
    /* FIX #10: Strict 80mm page sizing */
    @page {
      size: ${paperWidth} auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      /* FIX #11: Force exact color reproduction */
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      background: #fff;
      color: #000 !important;
      /* FIX #11: Courier New monospace for sharp thermal */
      font-family: 'Courier New', Courier, monospace !important;
      font-size: ${settings.fontSize === 'compact' ? '10px' : settings.fontSize === 'large' ? '13px' : '11.5px'};
      font-weight: 600;
      line-height: ${settings.lineSpacing === 'compact' ? '1.15' : settings.lineSpacing === 'relaxed' ? '1.4' : '1.25'};
      /* FIX #10: Width constraints */
      width: ${paperWidth};
      max-width: ${paperWidth};
      padding: 2mm 2mm;
      margin: 0 auto;
      text-align: left;
      overflow-x: hidden;
    }
    /* FIX #8: CSS dashed lines, 1.2px dark */
    .dashed {
      border: none;
      border-top: 1.2px dashed #000;
      margin: 4px 0;
      width: 100%;
      height: 0;
    }
    .double-dashed {
      border: none;
      border-top: 2px dashed #000;
      margin: 4px 0;
      width: 100%;
      height: 0;
    }
    .header {
      text-align: center;
      margin-bottom: 5px;
    }
    /* FIX #11: Logo dark and sharp */
    .logo {
      display: block;
      margin: ${settings.logoAlignment === 'left' ? '0 auto 5px 0' : settings.logoAlignment === 'right' ? '0 0 5px auto' : '0 auto 5px auto'};
      width: ${settings.logoWidth || 180}px;
      max-width: 45mm;
      height: auto;
      filter: contrast(1.2) brightness(0.9);
    }
    .tagline {
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 3px;
      color: #000 !important;
    }
    /* FIX #11: Store name extra bold */
    .store-name {
      font-size: 15px;
      font-weight: 800;
      line-height: 1.2;
      margin-bottom: 2px;
      color: #000 !important;
    }
    .brand-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      margin-bottom: 2px;
      color: #000 !important;
    }
    .contact-info {
      font-size: 10px;
      line-height: 1.3;
      color: #000 !important;
    }
    /* FIX #7: Single-column stacked meta rows */
    .meta-stack {
      display: flex;
      flex-direction: column;
      width: 100%;
      font-size: 11px;
      color: #000 !important;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      width: 100%;
      font-size: 11px;
      color: #000 !important;
    }
    .meta-lbl {
      flex-shrink: 0;
      font-weight: 600;
      color: #000 !important;
      margin-right: 4px;
    }
    .meta-val {
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #000 !important;
    }
    /* FIX #1 & #2: Vehicle block — each row full width */
    .vehicle-block {
      display: flex;
      flex-direction: column;
      width: 100%;
      font-size: 11px;
      color: #000 !important;
    }
    .meta-row-full {
      display: flex;
      justify-content: space-between;
      width: 100%;
      font-size: 11px;
      color: #000 !important;
    }
    /* FIX #6: Items table — fixed layout, correct widths */
    table {
      width: 100% !important;
      table-layout: fixed;
      border-collapse: collapse;
      font-size: 11px;
      color: #000 !important;
    }
    th {
      font-weight: 700;
      border-bottom: 1px solid #000;
      padding-bottom: 2px;
      color: #000 !important;
    }
    td {
      padding: 2.5px 0 1px 0;
      vertical-align: top;
      color: #000 !important;
    }
    .col-name { width: 42%; text-align: left; word-break: break-word; overflow-wrap: break-word; white-space: normal; }
    .col-qty { width: 10%; text-align: center; white-space: nowrap; }
    .col-price { width: 24%; text-align: right; white-space: nowrap; }
    .col-amount { width: 24%; text-align: right; font-weight: 700; white-space: nowrap; }
    .subtext {
      font-size: 9px !important;
      color: #000 !important;
      padding-left: 0;
      line-height: 1.2;
      word-break: break-word;
      overflow-wrap: break-word;
      white-space: normal;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 1.5px 0;
      color: #000 !important;
    }
    /* FIX #11: Grand total bold and large */
    .grand-total {
      font-size: 14px;
      font-weight: 800;
      padding: 3px 0;
      color: #000 !important;
    }
    /* FIX #9: Footer — full width, centered, word-break */
    .footer {
      text-align: center;
      font-size: 10px;
      margin-top: 6px;
      line-height: 1.35;
      width: 100%;
      word-break: break-word;
      hyphens: none;
      color: #000 !important;
    }
    .footer-policy {
      font-size: 10px;
      width: 100%;
      text-align: center;
      word-break: break-word;
      hyphens: none;
      margin-top: 3px;
    }
    /* FIX #11: Barcode sharp and dark */
    .barcode-wrap {
      display: flex;
      justify-content: center;
      margin: 6px 0;
      background: #fff;
      padding: 2mm;
    }
    .barcode-wrap svg {
      image-rendering: pixelated;
    }
    .barcode-wrap text {
      font-weight: 700 !important;
      font-size: 11px !important;
      letter-spacing: 1px;
      fill: #000 !important;
    }
    /* FIX #11: No shadows, no opacity in print */
    @media print {
      * { -webkit-print-color-adjust: exact !important; }
      body { box-shadow: none !important; }
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

  <!-- FIX #7: Single-column stacked meta rows -->
  <div class="meta-stack">
    ${settings.showInvoiceNumber ? `<div class="meta-row"><span class="meta-lbl">Receipt No :</span><span class="meta-val">${escapeHtml(data.orderNumber)}</span></div>` : ''}
    ${settings.showDateTime ? `<div class="meta-row"><span class="meta-lbl">Date :</span><span class="meta-val">${dateStr}</span></div>` : ''}
    ${settings.showDateTime && timeStr ? `<div class="meta-row"><span class="meta-lbl">Time :</span><span class="meta-val">${timeStr}</span></div>` : ''}
    ${settings.showCashier ? `<div class="meta-row"><span class="meta-lbl">Cashier :</span><span class="meta-val">${escapeHtml(cashierName)}</span></div>` : ''}
    ${settings.showTerminal ? `<div class="meta-row"><span class="meta-lbl">Terminal :</span><span class="meta-val">${escapeHtml(data.terminalName || 'POS-01')}</span></div>` : ''}
    ${settings.showCustomerName ? `<div class="meta-row"><span class="meta-lbl">Customer :</span><span class="meta-val">${escapeHtml(data.customer?.name || 'Walk-in')}</span></div>` : ''}
    ${data.customer?.phone ? `<div class="meta-row"><span class="meta-lbl">Phone :</span><span class="meta-val">${escapeHtml(data.customer.phone)}</span></div>` : ''}
    ${settings.showBranch && data.branchName ? `<div class="meta-row"><span class="meta-lbl">Branch :</span><span class="meta-val">${escapeHtml(data.branchName)}</span></div>` : ''}
  </div>

  ${settings.showVehicleInfo && hasVehicle ? `
    <div class="dashed"></div>
    <!-- FIX #1 & #2: Vehicle and Mileage on SEPARATE full-width lines -->
    <div class="vehicle-block">
      ${data.vehicle?.plateNumber && data.vehicle?.makeModel ? `<div class="meta-row-full"><span class="meta-lbl">Vehicle :</span><span class="meta-val">${escapeHtml(data.vehicle.plateNumber)} - ${escapeHtml(data.vehicle.makeModel)}</span></div>` : (data.vehicle?.plateNumber ? `<div class="meta-row-full"><span class="meta-lbl">Vehicle :</span><span class="meta-val">${escapeHtml(data.vehicle.plateNumber)}</span></div>` : (settings.showVehicleMakeModel && data.vehicle?.makeModel ? `<div class="meta-row-full"><span class="meta-lbl">Vehicle :</span><span class="meta-val">${escapeHtml(data.vehicle.makeModel)}</span></div>` : ''))}
      ${settings.showVehicleMileage && data.vehicle?.mileage ? `<div class="meta-row-full"><span class="meta-lbl">Mileage :</span><span class="meta-val" style="white-space:normal;word-break:break-word;">${escapeHtml(String(data.vehicle.mileage))}</span></div>` : ''}
      ${settings.showMechanic && (data.vehicle?.advisor || data.vehicle?.mechanic) ? `<div class="meta-row-full"><span class="meta-lbl">Advisor :</span><span class="meta-val">${escapeHtml(data.vehicle.advisor || data.vehicle.mechanic || '')}</span></div>` : ''}
      ${settings.showJobNumber && data.vehicle?.jobNumber ? `<div class="meta-row-full"><span class="meta-lbl">Job No :</span><span class="meta-val">${escapeHtml(data.vehicle.jobNumber)}</span></div>` : ''}
    </div>
  ` : ''}

  <div class="dashed"></div>

  ${paperWidth === '80mm' ? `
    <!-- FIX #6: Fixed-layout table with correct column widths -->
    <table>
      <thead>
        <tr>
          <th class="col-name">Item Name</th>
          <th class="col-qty">Qty</th>
          <th class="col-price">Price</th>
          <th class="col-amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((it) => {
          const sub = [
            settings.showProductBrand && it.brand ? it.brand : null,
            settings.showPartNumber && it.sku ? `SKU: ${it.sku}` : null,
            settings.showVehicleCompatibility && it.compatibility ? it.compatibility : null,
          ].filter(Boolean);

          return `
            <tr>
              <td class="col-name">
                <div>${escapeHtml(it.name)}</div>
                ${sub.length > 0 ? `<div class="subtext">${escapeHtml(sub.join(' · '))}</div>` : ''}
              </td>
              <td class="col-qty">${it.quantity}</td>
              <td class="col-price">${fmtMoney(it.price)}</td>
              <td class="col-amount">${fmtMoney(it.total)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  ` : `
    <div>
      ${items.map((it, idx) => `
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
    <!-- FIX #5: Payment Method shown ONCE only, no duplicate -->
    ${settings.showPaymentMethod ? `<div class="total-row"><span>Payment Method</span><span style="text-transform:capitalize;font-weight:700;">${escapeHtml(paymentMethod)}</span></div>` : ''}
    ${settings.showPaymentMethod && paymentMethod !== 'credit' ? `<div class="total-row"><span>Amount Paid</span><span>${fmtMoney(data.amountPaid ?? data.total)}</span></div>` : ''}
    ${settings.showChange && paymentMethod === 'cash' ? `<div class="total-row"><span>Change</span><span>${fmtMoney(data.change ?? 0)}</span></div>` : ''}
    ${settings.showCreditBalance && paymentMethod === 'credit' && data.customer?.remainingBalance !== undefined ? `
      <div class="total-row" style="font-weight:bold;"><span>Remaining Balance</span><span>${fmtMoney(data.customer.remainingBalance)}</span></div>
    ` : ''}
  </div>

  <div class="dashed"></div>

  <!-- FIX #9: Footer full width, centered, word-break safe -->
  <div class="footer">
    ${settings.footerThankYou ? `<div style="font-weight:800;">${escapeHtml(settings.footerThankYou)}</div>` : ''}
    ${settings.footerMessage ? `<div style="font-weight:700;">${escapeHtml(settings.footerMessage)}</div>` : ''}
    ${settings.returnPolicy ? `<div class="footer-policy">${escapeHtml(settings.returnPolicy)}</div>` : ''}
    ${barcodeSvg ? `<div class="barcode-wrap">${barcodeSvg}</div>` : ''}
  </div>

  ${Array.from({ length: Math.max(0, settings.feedLines || 2) }).map(() => '<div style="height:5mm;"></div>').join('')}
</body>
</html>`;
}

/**
 * Dispatches thermal print to browser or desktop webview without blocking UI.
 */
export async function printThermalReceipt(data: ReceiptData, settings: ReceiptSettings): Promise<void> {
  const html = generateThermalReceiptHtml(data, settings);
  printInBrowser(html);
}

function printInBrowser(html: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // 1. Clean up any previous print elements
  const oldIframe = document.getElementById('genx-receipt-print-frame');
  if (oldIframe) {
    try { oldIframe.remove(); } catch {}
  }
  const oldPortal = document.getElementById('genx-receipt-portal');
  if (oldPortal) {
    try { oldPortal.remove(); } catch {}
  }

  // 2. Prepare invisible iframe with layout dimensions so Chromium computes styles and opens print dialog
  const iframe = document.createElement('iframe');
  iframe.id = 'genx-receipt-print-frame';
  iframe.setAttribute('title', 'Receipt Print');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '100vw';
  iframe.style.height = '100vh';
  iframe.style.border = 'none';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '-99999';

  document.body.appendChild(iframe);

  let hasPrinted = false;
  const executePrint = () => {
    if (hasPrinted) return;
    hasPrinted = true;

    try {
      const frameWin = iframe.contentWindow;
      if (!frameWin) {
        fallbackDirectPrint(html);
        return;
      }
      frameWin.focus();
      frameWin.print();
    } catch (err) {
      console.warn('[printInBrowser] Iframe print failed, falling back to direct page print:', err);
      fallbackDirectPrint(html);
    }
  };

  try {
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      fallbackDirectPrint(html);
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    // Check if there are images in the receipt that need loading before printing (e.g. store logo)
    const images = doc.images;
    if (images && images.length > 0) {
      let loaded = 0;
      const onImageLoaded = () => {
        loaded++;
        if (loaded >= images.length) {
          window.setTimeout(executePrint, 60);
        }
      };

      for (let i = 0; i < images.length; i++) {
        if (images[i].complete) {
          loaded++;
        } else {
          images[i].onload = onImageLoaded;
          images[i].onerror = onImageLoaded;
        }
      }

      if (loaded >= images.length) {
        window.setTimeout(executePrint, 60);
      } else {
        window.setTimeout(executePrint, 400);
      }
    } else {
      window.setTimeout(executePrint, 60);
    }
  } catch (err) {
    console.warn('[printInBrowser] Failed to write into iframe:', err);
    fallbackDirectPrint(html);
  }

  // Cleanup iframe safely after print completes
  window.setTimeout(() => {
    try { iframe.remove(); } catch {}
  }, 45000);
}

function fallbackDirectPrint(html: string): void {
  const oldPortal = document.getElementById('genx-receipt-portal');
  if (oldPortal) {
    try { oldPortal.remove(); } catch {}
  }

  const portal = document.createElement('div');
  portal.id = 'genx-receipt-portal';

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll('style').forEach((st) => portal.appendChild(st.cloneNode(true)));
    portal.innerHTML += doc.body.innerHTML;
  } catch {
    portal.innerHTML = html;
  }

  document.body.appendChild(portal);

  const cleanup = () => {
    window.setTimeout(() => {
      try {
        portal.remove();
      } catch {}
    }, 1500);
  };

  window.addEventListener('afterprint', cleanup, { once: true });
  try {
    window.focus();
    window.print();
  } catch {
    window.print();
  } finally {
    cleanup();
  }
}

function escapeHtml(str: string | undefined | null): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
