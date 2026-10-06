import { useState, useEffect } from 'react';
import { Wrench, Clock, CheckCircle, DollarSign, Plus, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Card, CardHeader, CardTitle, CardContent } from '@genx/ui/Card';
import { Badge } from '@genx/ui/Badge';
import { Button } from '@genx/ui/Button';
import { jobRepo } from '@/lib/auto-care-db';
import type { ServiceJob } from '@genx/types/domain/auto-care';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', in_progress: 'In Progress',
  waiting_parts: 'Waiting Parts', completed: 'Completed', cancelled: 'Cancelled',
};

const STATUS_VARIANTS: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  pending: 'default', in_progress: 'info',
  waiting_parts: 'warning', completed: 'success', cancelled: 'error',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-text-muted', normal: 'text-text', high: 'text-warning', urgent: 'text-error',
};

export function AutoCareDashboard() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [stats, setStats] = useState({ active: 0, pending: 0, completedToday: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    try {
      const [allJobs, st] = await Promise.all([jobRepo.findAll(), jobRepo.getStats()]);
      setJobs(allJobs);
      setStats(st);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const recentJobs = jobs.slice(0, 8);

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-text-secondary">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary" /> Auto Care Dashboard
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <Button onClick={() => navigate('/auto-care/jobs/new')} className="flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Job
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Active Jobs</CardTitle>
            <Wrench className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{stats.active}</div>
            <p className="text-xs text-text-muted mt-1">In progress now</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Pending</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-warning">{stats.pending}</div>
            <p className="text-xs text-text-muted mt-1">Awaiting service</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-success">{stats.completedToday}</div>
            <p className="text-xs text-text-muted mt-1">Jobs done today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Today's Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${stats.revenue.toFixed(2)}</div>
            <p className="text-xs text-text-muted mt-1">Invoiced today</p>
          </CardContent>
        </Card>
      </div>

      {/* Job list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Jobs</CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate('/auto-care/jobs')}>View All</Button>
        </CardHeader>
        <CardContent className="p-0">
          {recentJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-text-muted">
              <AlertCircle className="h-10 w-10 mb-3 opacity-40" />
              <p>No jobs yet. Create your first job!</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between px-6 py-4 hover:bg-bg-subtle transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <span className="text-xs font-mono text-text-muted bg-bg-subtle px-2 py-0.5 rounded">{job.jobNumber}</span>
                    <div>
                      <div className="font-medium text-text text-sm">{job.customerName}</div>
                      <div className="text-xs text-text-secondary">{job.vehicleSummary}</div>
                    </div>
                    {job.mechanicName && (
                      <div className="text-xs text-text-muted hidden md:block">👷 {job.mechanicName}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={clsx('text-xs font-semibold uppercase tracking-wide', PRIORITY_COLORS[job.priority])}>{job.priority}</span>
                    <Badge variant={STATUS_VARIANTS[job.status]}>{STATUS_LABELS[job.status]}</Badge>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/auto-care/jobs/${job.id}`)}>View</Button>
                      {job.status === 'pending' && (
                        <Button size="sm" onClick={async () => {
                          await jobRepo.updateStatus(job.id, 'in_progress', { startedAt: Date.now() });
                          void reload();
                        }}>Start</Button>
                      )}
                      {job.status === 'in_progress' && (
                        <Button size="sm" variant="outline" onClick={() => navigate(`/auto-care/pos?jobId=${job.id}&customer=${encodeURIComponent(job.customerName)}&vehicle=${encodeURIComponent(job.vehicleSummary)}&jobNumber=${job.jobNumber}`)}>
                          Invoice
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
