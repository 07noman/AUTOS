import { useState, useEffect } from 'react';
import { Plus, Filter, Search, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Card, CardContent } from '@genx/ui/Card';
import { Badge } from '@genx/ui/Badge';
import { Button } from '@genx/ui/Button';
import { jobRepo } from '@/lib/auto-care-db';
import type { ServiceJob, JobStatus } from '@genx/types/domain/auto-care';

const ALL_STATUSES: { key: JobStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All Jobs' },
  { key: 'pending', label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'waiting_parts', label: 'Waiting Parts' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_VARIANTS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  pending: 'default', in_progress: 'info',
  waiting_parts: 'warning', completed: 'success', cancelled: 'error',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-bg-subtle text-text-muted',
  normal: 'bg-bg-subtle text-text',
  high: 'bg-warning/10 text-warning',
  urgent: 'bg-error/10 text-error',
};

export function ServiceJobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const reload = async () => {
    try {
      const all = await jobRepo.findAll();
      setJobs(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const filtered = jobs.filter((j) => {
    if (statusFilter !== 'all' && j.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return j.jobNumber.toLowerCase().includes(q) ||
        j.customerName.toLowerCase().includes(q) ||
        j.vehicleSummary.toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-text-secondary">Loading jobs...</div>;
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text">Service Jobs</h1>
          <p className="text-sm text-text-secondary mt-1">{jobs.length} total jobs</p>
        </div>
        <Button onClick={() => navigate('/auto-care/jobs/new')} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Job
        </Button>
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by job #, customer, vehicle..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-bg border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-border">
        {ALL_STATUSES.map(({ key, label }) => {
          const count = key === 'all' ? jobs.length : jobs.filter((j) => j.status === key).length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setStatusFilter(key)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap rounded-md transition-colors',
                statusFilter === key ? 'bg-primary text-white' : 'text-text-secondary hover:bg-bg-subtle'
              )}
            >
              {label}
              <span className={clsx('text-xs px-1.5 py-0.5 rounded-full', statusFilter === key ? 'bg-white/20' : 'bg-bg-subtle')}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Job list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-text-muted">
          <AlertCircle className="h-10 w-10 mb-3 opacity-40" />
          <p>No jobs found</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/auto-care/jobs/new')}>Create First Job</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((job) => (
            <div key={job.id} className="cursor-pointer" onClick={() => navigate(`/auto-care/jobs/${job.id}`)}>
              <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-xs font-mono bg-bg-subtle text-text-muted px-2 py-1 rounded mt-0.5 shrink-0">{job.jobNumber}</span>
                    <div className="min-w-0">
                      <div className="font-semibold text-text">{job.customerName}</div>
                      <div className="text-sm text-text-secondary">🚗 {job.vehicleSummary}</div>
                      {job.mechanicName && <div className="text-xs text-text-muted mt-0.5">👷 {job.mechanicName}</div>}
                      {job.estimatedHours && (
                        <div className="text-xs text-text-muted mt-0.5">
                          ⏱️ Est: {job.estimatedHours}h{job.actualHours ? ` · Actual: ${job.actualHours}h` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full uppercase', PRIORITY_COLORS[job.priority])}>{job.priority}</span>
                      <Badge variant={STATUS_VARIANTS[job.status]}>{job.status.replace('_', ' ')}</Badge>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      {job.status === 'pending' && (
                        <Button size="sm" onClick={async () => {
                          await jobRepo.updateStatus(job.id, 'in_progress', { startedAt: Date.now() });
                          void reload();
                        }}>Start</Button>
                      )}
                      {job.status === 'in_progress' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => navigate(`/auto-care/pos?jobId=${job.id}&customer=${encodeURIComponent(job.customerName)}&vehicle=${encodeURIComponent(job.vehicleSummary)}&jobNumber=${job.jobNumber}`)}>
                            Invoice
                          </Button>
                          <Button size="sm" variant="outline" onClick={async () => {
                            await jobRepo.updateStatus(job.id, 'completed', { completedAt: Date.now() });
                            void reload();
                          }}>Complete</Button>
                        </>
                      )}
                      {job.status === 'waiting_parts' && (
                        <Button size="sm" onClick={async () => {
                          await jobRepo.updateStatus(job.id, 'in_progress');
                          void reload();
                        }}>Resume</Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
