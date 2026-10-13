import { vehicleRepo, posOrderRepo } from '../apps/desktop/src/lib/auto-care-db';
import { getCurrentTenantId } from '../apps/desktop/src/lib/db';

(async () => {
  const tenantId = getCurrentTenantId();
  const vehicleDetails = {
    regNo: 'TEST-1234',
    make: 'Toyota',
    model: 'Corolla',
    mileage: 45000,
    customerName: 'John Doe',
    notes: 'Test note',
    phone: '555-1234',
  };

  // Create a paid order simulating POS payment
  const paidOrder = await posOrderRepo.createPaid({
    items: [{ id: 'item1', name: 'Oil Change', price: 30, quantity: 1, type: 'service' }],
    subtotal: 30,
    tax: 1.5,
    total: 31.5,
    paidAmount: 31.5,
    paymentMethod: 'cash',
    vehiclePlateNumber: vehicleDetails.regNo,
    vehicleMakeModel: `${vehicleDetails.make} ${vehicleDetails.model}`,
    vehicleMileage: vehicleDetails.mileage,
    tenantId,
  });
  console.log('Created paid order ID:', paidOrder.id);

  // Upsert vehicle record (mirrors handlePOSPayment logic)
  await vehicleRepo.upsertByPlate({
    tenantId,
    licensePlate: vehicleDetails.regNo,
    make: vehicleDetails.make,
    model: vehicleDetails.model,
    mileage: vehicleDetails.mileage,
    customerName: vehicleDetails.customerName,
    notes: vehicleDetails.notes,
  });

  // Verify vehicle was saved
  const vehicles = await vehicleRepo.findAll(tenantId);
  console.log('Vehicle count after upsert:', vehicles.length);
  const added = vehicles.find(v => v.licensePlate === vehicleDetails.regNo);
  console.log('Added vehicle record:', added);
})();
