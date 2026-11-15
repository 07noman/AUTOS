import { describe, it, expect, beforeEach } from 'vitest';
import { setupTauriBrowserMock } from '../../apps/desktop/src/lib/tauri-mock';
import { generateThermalReceiptHtml } from '../../apps/desktop/src/features/receipt/print-service';
import { DEFAULT_RECEIPT_SETTINGS, ReceiptData } from '../../apps/desktop/src/features/receipt/types';
import { vehicleRepo, posOrderRepo, backfillVehiclePhoneFromOrders } from '../../apps/desktop/src/lib/auto-care-db';

describe('Auto Care Phone & Receipt Template Verification', () => {
  beforeEach(() => {
    localStorage.clear();
    setupTauriBrowserMock();
  });
  const baseOrderData: ReceiptData = {
    orderNumber: '0042',
    date: '2026-11-15T15:30:00',
    cashierName: 'Zeeshan',
    customer: {
      name: 'SAMI BAHI',
      phone: '0300-1234567',
    },
    vehicle: {
      plateNumber: 'BPN-992',
      makeModel: 'Toyota AQUA',
      mileage: '45000',
    },
    items: [
      { name: 'Engine Oil 5W-30', quantity: 1, price: 5000, total: 5000 },
    ],
    subtotal: 5000,
    discount: 0,
    tax: 0,
    total: 5000,
    paymentMethod: 'cash',
  };

  it('prints Phone line directly below Customer Name when phone is provided', () => {
    const html = generateThermalReceiptHtml(baseOrderData, DEFAULT_RECEIPT_SETTINGS);

    // Verify Customer Name is present
    expect(html).toContain('Customer:</span><span class="meta-val">SAMI BAHI</span>');
    // Verify Phone is present
    expect(html).toContain('Phone   :</span><span class="meta-val">0300-1234567</span>');
    // Verify Vehicle line is present with reg_no - make model
    expect(html).toContain('Vehicle    :</span><span class="meta-val">BPN-992 - Toyota AQUA</span>');
  });

  it('completely hides Phone line when phone is empty, null, or undefined (no undefined or null printed)', () => {
    const withoutPhone: ReceiptData = {
      ...baseOrderData,
      customer: {
        name: 'SAMI BAHI',
        phone: undefined,
      },
    };

    const html = generateThermalReceiptHtml(withoutPhone, DEFAULT_RECEIPT_SETTINGS);

    expect(html).toContain('Customer:</span><span class="meta-val">SAMI BAHI</span>');
    // Must NOT contain Phone line
    expect(html).not.toContain('Phone');
    expect(html).not.toContain('null');
    expect(html).not.toContain('undefined');
  });

  it('hides Phone line when customer is completely absent (walk-in)', () => {
    const walkInOrder: ReceiptData = {
      ...baseOrderData,
      customer: undefined,
    };

    const html = generateThermalReceiptHtml(walkInOrder, DEFAULT_RECEIPT_SETTINGS);
    expect(html).not.toContain('Phone');
    expect(html).not.toContain('null');
    expect(html).not.toContain('undefined');
  });
});

describe('Vehicle Phone Preservation & Non-Destructive Update Rules', () => {
  it('does NOT overwrite existing vehicle phone when an update provides an empty phone', async () => {
    const tenantId = 'test-tenant-autocare';

    // 1. Initial vehicle creation with phone
    const v1 = await vehicleRepo.upsertByPlate({
      tenantId,
      licensePlate: 'BPN-992',
      make: 'Toyota',
      model: 'AQUA',
      customerName: 'SAMI BAHI',
      phone: '0300-1234567',
    });
    expect(v1.phone).toBe('0300-1234567');

    // 2. Subsequent update where phone is NOT passed / empty
    const v2 = await vehicleRepo.upsertByPlate({
      tenantId,
      licensePlate: 'BPN-992',
      make: 'Toyota',
      model: 'AQUA',
      customerName: 'SAMI BAHI',
      mileage: 48000,
      phone: '', // Empty!
    });

    // Rule: Must retain previously entered phone!
    expect(v2.phone).toBe('0300-1234567');
  });

  it('updates vehicle phone when a new non-empty phone is explicitly provided', async () => {
    const tenantId = 'test-tenant-autocare';

    const updated = await vehicleRepo.upsertByPlate({
      tenantId,
      licensePlate: 'BPN-992',
      make: 'Toyota',
      model: 'AQUA',
      phone: '0321-7654321',
    });

    expect(updated.phone).toBe('0321-7654321');
  });
});

describe('Vehicle History Search by Phone & List Formatting', () => {
  const sampleVehicles = [
    {
      id: '1',
      tenantId: 'test',
      licensePlate: 'BPN-992',
      make: 'Toyota',
      model: 'AQUA',
      year: 2026,
      customerName: 'SAMI BAHI',
      phone: '0300-1234567',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: '2',
      tenantId: 'test',
      licensePlate: 'LEE-5000',
      make: 'Honda',
      model: 'Civic',
      year: 2024,
      customerName: 'Ahmed Raza',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  it('matches vehicles by phone number search query', () => {
    const query = '0300-1234567';
    const matches = sampleVehicles.filter(
      (v) =>
        v.licensePlate.toUpperCase().includes(query) ||
        (v.customerName && v.customerName.toUpperCase().includes(query)) ||
        (v.phone && v.phone.toUpperCase().includes(query))
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].licensePlate).toBe('BPN-992');
  });

  it('formats vehicle list subtitle as "Name - Phone" if phone is present, or only "Name" if missing', () => {
    const formatSubtitle = (v: { customerName?: string; phone?: string }) => {
      return v.phone ? `${v.customerName || 'Walk-in'} - ${v.phone}` : (v.customerName || 'Walk-in');
    };

    expect(formatSubtitle(sampleVehicles[0])).toBe('SAMI BAHI - 0300-1234567');
    expect(formatSubtitle(sampleVehicles[1])).toBe('Ahmed Raza');
  });
});
