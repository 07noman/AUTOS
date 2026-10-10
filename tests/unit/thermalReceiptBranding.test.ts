import { describe, it, expect, beforeEach } from 'vitest';
import { encodeCode128B, generateBarcodeSvg } from '../../apps/desktop/src/features/receipt/utils/barcode';
import { sanitizeSvg } from '../../apps/desktop/src/features/receipt/utils/logo-processor';
import { DEFAULT_RECEIPT_SETTINGS, ReceiptData } from '../../apps/desktop/src/features/receipt/types';
import { generateThermalReceiptHtml } from '../../apps/desktop/src/features/receipt/print-service';

describe('1D Barcode (Code 128) Generation', () => {
  it('encodes ASCII text into Code 128B modules with quiet zones', () => {
    const modules = encodeCode128B('AC-20261011-0008');
    expect(modules.length).toBeGreaterThan(50);
    // Quiet zones at start and end should be 0s
    expect(modules.slice(0, 10).every((m) => m === 0)).toBe(true);
    expect(modules.slice(-10).every((m) => m === 0)).toBe(true);
  });

  it('generates high contrast SVG with text label', () => {
    const svg = generateBarcodeSvg('AC202610110008', { height: 40, showText: true });
    expect(svg).toContain('<svg');
    expect(svg).toContain('fill="#000000"');
    expect(svg).toContain('AC202610110008');
  });

  it('handles empty string gracefully', () => {
    const svg = generateBarcodeSvg('');
    expect(svg).toBe('');
  });
});

describe('Logo Security & SVG Sanitization', () => {
  it('strips <script> tags and active event handlers from SVG', () => {
    const maliciousSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" onload="alert('XSS')">
        <script>alert('pwned')</script>
        <circle cx="50" cy="50" r="40" onclick="evil()" />
      </svg>
    `;
    const cleaned = sanitizeSvg(maliciousSvg);
    expect(cleaned).not.toContain('<script');
    expect(cleaned).not.toContain('alert');
    expect(cleaned).not.toContain('onload=');
    expect(cleaned).not.toContain('onclick=');
    expect(cleaned).toContain('<circle');
  });

  it('preserves clean SVG vectors', () => {
    const cleanSvg = `<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" fill="#000" /></svg>`;
    const output = sanitizeSvg(cleanSvg);
    expect(output).toContain('<rect');
    expect(output).toContain('fill="#000"');
  });
});

describe('Thermal Receipt HTML Generation & Layout Sizing', () => {
  const sampleSale: ReceiptData = {
    orderNumber: 'AC-20261011-0008',
    date: '2026-10-11T15:24:00',
    cashierName: 'Ali Raza',
    terminalName: 'POS-01',
    customer: {
      name: 'Walk-in Customer',
      phone: '0300-9876543',
    },
    vehicle: {
      makeModel: 'Toyota Corolla GLi',
      plateNumber: 'LEA-4921',
      mileage: '45,200 km',
    },
    items: [
      {
        name: 'Engine Oil 5W-30 (4L)',
        brand: 'Castrol Magnatec',
        sku: 'OIL-001',
        quantity: 1,
        price: 6450,
        total: 6450,
      },
      {
        name: 'Oil Filter',
        sku: '90915-10004',
        quantity: 1,
        price: 850,
        total: 850,
      },
    ],
    subtotal: 7300,
    discount: 300,
    tax: 1260,
    total: 8260,
    paymentMethod: 'cash',
    amountPaid: 8500,
    change: 240,
    currency: 'PKR',
  };

  it('renders 80mm tabular receipt with financial breakdown and auto care details', () => {
    const html = generateThermalReceiptHtml(sampleSale, {
      ...DEFAULT_RECEIPT_SETTINGS,
      paperWidth: '80mm',
    });

    expect(html).toContain('80mm');
    expect(html).toContain('AC-20261011-0008');
    expect(html).toContain('Ali Raza');
    expect(html).toContain('Toyota Corolla GLi');
    expect(html).toContain('LEA-4921');
    expect(html).toContain('Engine Oil 5W-30 (4L)');
    expect(html).toContain('Castrol Magnatec');
    expect(html).toContain('PKR 8,260');
    expect(html).toContain('Change');
    expect(html).toContain('240');
  });

  it('renders 58mm compact stacked layout when paper width is 58mm', () => {
    const html = generateThermalReceiptHtml(sampleSale, {
      ...DEFAULT_RECEIPT_SETTINGS,
      paperWidth: '58mm',
    });

    expect(html).toContain('58mm');
    expect(html).toContain('1. Engine Oil 5W-30 (4L)');
    expect(html).toContain('1 × 6,450');
  });

  it('omits vehicle section when transaction has no vehicle data', () => {
    const retailSale: ReceiptData = {
      ...sampleSale,
      vehicle: undefined,
    };
    const html = generateThermalReceiptHtml(retailSale, DEFAULT_RECEIPT_SETTINGS);
    expect(html).not.toContain('Toyota Corolla GLi');
    expect(html).not.toContain('LEA-4921');
  });

  it('correctly handles credit sales with remaining balance', () => {
    const creditSale: ReceiptData = {
      ...sampleSale,
      paymentMethod: 'credit',
      customer: {
        name: 'Credit Customer',
        remainingBalance: 15400,
      },
    };
    const html = generateThermalReceiptHtml(creditSale, DEFAULT_RECEIPT_SETTINGS);
    expect(html).toContain('Payment Method : <strong style="text-transform:capitalize;">credit</strong>');
    expect(html).toContain('Remaining Balance');
    expect(html).toContain('15,400');
  });
});
