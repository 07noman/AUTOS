import { useState, useEffect } from 'react';
import { Car, Plus, Search, Shield, Calendar, User, FileText } from 'lucide-react';
import { Card, CardContent } from '@genx/ui/Card';
import { Button } from '@genx/ui/Button';
import { Badge } from '@genx/ui/Badge';
import { vehicleRepo } from '@/lib/auto-care-db';
import { getCurrentTenantId } from '@/lib/db';
import type { Vehicle } from '@genx/types/domain/auto-care';

export function VehiclesView() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // New vehicle form
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('2021');
  const [licensePlate, setLicensePlate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [color, setColor] = useState('White');
  const [mileage, setMileage] = useState('35000');

  const reload = async () => {
    try {
      const data = await vehicleRepo.findAll(getCurrentTenantId());
      setVehicles(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!make || !model || !licensePlate) return;
    try {
      await vehicleRepo.create({
        tenantId: getCurrentTenantId(),
        make,
        model,
        year: Number(year) || 2021,
        licensePlate,
        customerName: customerName || undefined,
        color,
        mileage: Number(mileage) || undefined,
      });
      setShowAddModal(false);
      setMake('');
      setModel('');
      setLicensePlate('');
      setCustomerName('');
      void reload();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = vehicles.filter(
    (v) =>
      !search ||
      v.make.toLowerCase().includes(search.toLowerCase()) ||
      v.model.toLowerCase().includes(search.toLowerCase()) ||
      v.licensePlate.toLowerCase().includes(search.toLowerCase()) ||
      (v.customerName && v.customerName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <Car className="h-6 w-6 text-primary" /> Vehicles
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Registered customer vehicles, maintenance history, and specifications
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Add Vehicle
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by make, model, license plate, customer..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-bg border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-bg-elevated border border-border rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-text">Register New Vehicle</h2>
            <form onSubmit={handleAddVehicle} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Make *</label>
                  <input
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="Toyota"
                    className="w-full text-sm px-3 py-2 bg-bg border border-border rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Model *</label>
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Camry"
                    className="w-full text-sm px-3 py-2 bg-bg border border-border rounded-lg"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Year</label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full text-sm px-3 py-2 bg-bg border border-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">License Plate *</label>
                  <input
                    value={licensePlate}
                    onChange={(e) => setLicensePlate(e.target.value)}
                    placeholder="ABC-1234"
                    className="w-full text-sm px-3 py-2 bg-bg border border-border rounded-lg"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Customer Name</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="John Smith"
                  className="w-full text-sm px-3 py-2 bg-bg border border-border rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Color</label>
                  <input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="Silver"
                    className="w-full text-sm px-3 py-2 bg-bg border border-border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Mileage (miles)</label>
                  <input
                    type="number"
                    value={mileage}
                    onChange={(e) => setMileage(e.target.value)}
                    className="w-full text-sm px-3 py-2 bg-bg border border-border rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Vehicle</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Vehicle Grid */}
      {loading ? (
        <div className="py-12 text-center text-text-muted">Loading vehicles...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-text-muted">No vehicles found</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => (
            <Card key={v.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-text text-base">
                      {v.year} {v.make} {v.model}
                    </h3>
                    <div className="text-xs font-mono font-bold text-primary mt-0.5">
                      {v.licensePlate}
                    </div>
                  </div>
                  <Badge variant="default">{v.color || 'Standard'}</Badge>
                </div>

                <div className="pt-2 border-t border-border/60 text-xs text-text-secondary space-y-1.5">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-text-muted" />
                    <span>Customer: {v.customerName || 'Walk-in'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-text-muted" />
                    <span>Mileage: {v.mileage ? `${v.mileage.toLocaleString()} mi` : 'N/A'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default VehiclesView;
