import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@genx/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@genx/ui/Card';
import { jobRepo } from '@/lib/auto-care-db';
import { getCurrentTenantId } from '@/lib/db';
import type { JobPriority, JobStatus } from '@genx/types/domain/auto-care';

const MECHANICS = ['Mike Johnson', 'Alex Chen', 'Sarah Brown', 'David Lee'];

export function NewJobForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    customerName: '',
    vehicleMake: '',
    vehicleModel: '',
    vehicleYear: new Date().getFullYear().toString(),
    licensePlate: '',
    priority: 'normal' as JobPriority,
    mechanic: '',
    estimatedHours: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerName.trim()) { setError('Customer name is required'); return; }
    if (!form.vehicleMake.trim() || !form.vehicleModel.trim()) { setError('Vehicle make and model are required'); return; }
    setSaving(true);
    setError('');
    try {
      const jobNumber = await jobRepo.nextJobNumber();
      const vehicleSummary = `${form.vehicleYear} ${form.vehicleMake} ${form.vehicleModel}${form.licensePlate ? ` (${form.licensePlate})` : ''}`;
      const job = await jobRepo.create({
        tenantId: getCurrentTenantId(),
        jobNumber,
        customerName: form.customerName,
        vehicleSummary,
        status: 'pending' as JobStatus,
        priority: form.priority,
        mechanicName: form.mechanic || undefined,
        estimatedHours: form.estimatedHours ? parseFloat(form.estimatedHours) : undefined,
        notes: form.notes || undefined,
      });
      navigate(`/auto-care/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full text-sm px-3 py-2 bg-bg border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50';
  const labelClass = 'block text-xs font-medium text-text-secondary mb-1';

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-text">New Service Job</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Customer */}
        <Card>
          <CardHeader><CardTitle className="text-base">Customer Information</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className={labelClass}>Customer Name *</label>
              <input value={form.customerName} onChange={set('customerName')} placeholder="John Smith" className={inputClass} required />
            </div>
          </CardContent>
        </Card>

        {/* Vehicle */}
        <Card>
          <CardHeader><CardTitle className="text-base">Vehicle Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Year</label>
                <input value={form.vehicleYear} onChange={set('vehicleYear')} placeholder="2020" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Make *</label>
                <input value={form.vehicleMake} onChange={set('vehicleMake')} placeholder="Toyota" className={inputClass} required />
              </div>
              <div>
                <label className={labelClass}>Model *</label>
                <input value={form.vehicleModel} onChange={set('vehicleModel')} placeholder="Camry" className={inputClass} required />
              </div>
            </div>
            <div>
              <label className={labelClass}>License Plate</label>
              <input value={form.licensePlate} onChange={set('licensePlate')} placeholder="ABC-1234" className={inputClass} />
            </div>
          </CardContent>
        </Card>

        {/* Job details */}
        <Card>
          <CardHeader><CardTitle className="text-base">Job Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Priority</label>
                <select value={form.priority} onChange={set('priority')} className={inputClass}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Assign Mechanic</label>
                <select value={form.mechanic} onChange={set('mechanic')} className={inputClass}>
                  <option value="">Unassigned</option>
                  {MECHANICS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Estimated Hours</label>
              <input type="number" min={0} step={0.5} value={form.estimatedHours} onChange={set('estimatedHours')} placeholder="1.5" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea value={form.notes} onChange={set('notes')} placeholder="Describe the problem or service needed..." rows={3} className={`${inputClass} resize-none`} />
            </div>
          </CardContent>
        </Card>

        {error && <div className="text-sm text-error bg-error/10 border border-error/20 rounded-lg p-3">{error}</div>}

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(-1)} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={saving} className="flex-1">{saving ? 'Creating...' : 'Create Job'}</Button>
        </div>
      </form>
    </div>
  );
}
