import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Users,
  Package,
  FileText,
  CalendarDays,
  ClipboardList,
  CreditCard,
  User,
  Boxes,
  BarChart3,
  History,
  Plus,
  Search,
  ArrowRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@genx/ui/Card';
import { Button } from '@genx/ui/Button';
import { Badge } from '@genx/ui/Badge';

interface Props {
  moduleId: string;
}

const MODULE_META: Record<
  string,
  {
    title: string;
    desc: string;
    icon: React.ElementType;
    color: string;
    stat1: { label: string; value: string };
    stat2: { label: string; value: string };
    items: Array<{ title: string; subtitle: string; tag: string; date: string }>;
  }
> = {
  'vehicle-history': {
    title: 'Vehicle History',
    desc: 'Complete inspection and maintenance timeline per customer vehicle',
    icon: History,
    color: 'text-cyan-500',
    stat1: { label: 'Service Logs', value: '142' },
    stat2: { label: 'Repeat Customers', value: '88%' },
    items: [
      { title: '2020 Toyota Camry (ABC-1234)', subtitle: 'Full Synthetic Oil Change & Filter', tag: 'Completed', date: 'Yesterday' },
      { title: '2019 Honda Civic (XYZ-5678)', subtitle: 'Front Brake Pads & Rotor Resurfacing', tag: 'Completed', date: '3 days ago' },
      { title: '2018 Ford F-150 (LMN-9012)', subtitle: 'AC Compressor Diagnosis & Recharge', tag: 'Completed', date: '1 week ago' },
    ],
  },
  customers: {
    title: 'Customers',
    desc: 'Directory of clients, contact details, and vehicle ownership',
    icon: Users,
    color: 'text-pink-500',
    stat1: { label: 'Total Clients', value: '84' },
    stat2: { label: 'Fleet Accounts', value: '6' },
    items: [
      { title: 'John Smith', subtitle: '2020 Toyota Camry · (555) 234-5678', tag: 'Active', date: 'Oct 2, 2026' },
      { title: 'Sarah Williams', subtitle: '2019 Honda Civic · (555) 876-5432', tag: 'Active', date: 'Oct 1, 2026' },
      { title: 'Bob Martinez', subtitle: '2018 Ford F-150 · (555) 345-6789', tag: 'Active', date: 'Sep 28, 2026' },
      { title: 'Lisa Johnson', subtitle: '2021 Chevrolet Malibu · (555) 901-2345', tag: 'Active', date: 'Sep 25, 2026' },
    ],
  },
  inventory: {
    title: 'Inventory',
    desc: 'Parts stock management, reorder alerts, and supplier tracking',
    icon: Package,
    color: 'text-indigo-500',
    stat1: { label: 'SKUs in Stock', value: '420' },
    stat2: { label: 'Low Stock Alerts', value: '3' },
    items: [
      { title: 'Full Synthetic Motor Oil 5W-30', subtitle: 'SKU: OIL-SYN-5W30 · 48 quarts in stock', tag: 'In Stock', date: 'Bin A-12' },
      { title: 'OEM Oil Filter Toyota', subtitle: 'SKU: OF-01 · 15 units in stock', tag: 'In Stock', date: 'Bin B-04' },
      { title: 'Ceramic Brake Pads (Front)', subtitle: 'SKU: BP-02 · 2 units left (Min: 5)', tag: 'Low Stock', date: 'Bin C-01' },
      { title: 'Iridium Spark Plugs', subtitle: 'SKU: SP-03 · 22 units in stock', tag: 'In Stock', date: 'Bin D-08' },
    ],
  },
  estimates: {
    title: 'Estimates & Quotes',
    desc: 'Diagnostic repair quotations and customer pre-authorizations',
    icon: FileText,
    color: 'text-amber-500',
    stat1: { label: 'Pending Quotes', value: '5' },
    stat2: { label: 'Accepted Rate', value: '92%' },
    items: [
      { title: 'EST-104: Transmission Fluid Flush', subtitle: 'Customer: Mike Davis · $240.00', tag: 'Sent', date: 'Today' },
      { title: 'EST-103: Suspension Strut Replacement', subtitle: 'Customer: Emily White · $680.00', tag: 'Accepted', date: 'Yesterday' },
      { title: 'EST-102: Complete Brake System Overhaul', subtitle: 'Customer: David Brown · $450.00', tag: 'Accepted', date: '2 days ago' },
    ],
  },
  appointments: {
    title: 'Appointments',
    desc: 'Scheduled bay appointments, drop-offs, and service calendar',
    icon: CalendarDays,
    color: 'text-teal-500',
    stat1: { label: "Today's Bookings", value: '6' },
    stat2: { label: 'Bay Capacity', value: '75%' },
    items: [
      { title: '09:00 AM — Oil Change & Filter', subtitle: 'John Smith · Bay 1 · Assigned: Mike Johnson', tag: 'In Bay', date: 'Today' },
      { title: '11:30 AM — Brake Pad Replacement', subtitle: 'Sarah Williams · Bay 2 · Assigned: Alex Chen', tag: 'Confirmed', date: 'Today' },
      { title: '02:00 PM — AC System Diagnostics', subtitle: 'Bob Martinez · Bay 1 · Assigned: Mike Johnson', tag: 'Scheduled', date: 'Today' },
      { title: '04:15 PM — Wheel Alignment & Tire Balance', subtitle: 'Rachel Green · Bay 3 · Unassigned', tag: 'Pending', date: 'Today' },
    ],
  },
  'job-board': {
    title: 'Job Board',
    desc: 'Live shop status tracking across all mechanics and service bays',
    icon: ClipboardList,
    color: 'text-rose-500',
    stat1: { label: 'Active in Shop', value: '8' },
    stat2: { label: 'Avg Turnaround', value: '2.4 hrs' },
    items: [
      { title: 'JOB-001: 2020 Toyota Camry', subtitle: 'Oil Change & Safety Inspection · Mike Johnson', tag: 'In Progress', date: 'Bay 1' },
      { title: 'JOB-002: 2019 Honda Civic', subtitle: 'Front Brake Rotor Replacement · Alex Chen', tag: 'Pending', date: 'Bay 2' },
      { title: 'JOB-003: 2018 Ford F-150', subtitle: 'AC Compressor Repair · Awaiting Parts', tag: 'Waiting Parts', date: 'Staging' },
      { title: 'JOB-004: 2021 Chevrolet Malibu', subtitle: 'Tire Rotation & Balance · Mike Johnson', tag: 'Completed', date: 'Ready for Pickup' },
    ],
  },
  payments: {
    title: 'Payments & Invoices',
    desc: 'Work order invoicing, receipts, card processing, and balances',
    icon: CreditCard,
    color: 'text-lime-500',
    stat1: { label: "Today's Collected", value: '$4,850.00' },
    stat2: { label: 'Invoices Paid', value: '12' },
    items: [
      { title: 'INV-0042 · $164.13', subtitle: 'John Smith · 2020 Toyota Camry · Credit Card', tag: 'Paid', date: '10:45 AM' },
      { title: 'INV-0041 · $350.00', subtitle: 'Sarah Williams · 2019 Honda Civic · Cash', tag: 'Paid', date: '09:20 AM' },
      { title: 'INV-0040 · $89.50', subtitle: 'David Miller · Walk-in Parts Purchase · Card', tag: 'Paid', date: 'Yesterday' },
    ],
  },
  staff: {
    title: 'Staff & Mechanics',
    desc: 'Technicians, service advisors, workload distribution, and billable hours',
    icon: User,
    color: 'text-purple-500',
    stat1: { label: 'Technicians On Duty', value: '4' },
    stat2: { label: 'Shop Utilization', value: '84%' },
    items: [
      { title: 'Mike Johnson — Lead Master Technician', subtitle: 'Specialties: Engine & Brakes · 6.5 billable hrs today', tag: 'Active', date: 'Bay 1' },
      { title: 'Alex Chen — Electrical & AC Specialist', subtitle: 'Specialties: AC, Diagnostics, Hybrid · 5.0 billable hrs', tag: 'Active', date: 'Bay 2' },
      { title: 'Sarah Brown — Service Advisor', subtitle: 'Customer Check-in & Invoicing · 12 orders handled', tag: 'Front Desk', date: 'Main' },
      { title: 'David Lee — Alignment & Tire Tech', subtitle: 'Specialties: Tires, Suspension, Alignment · 4.5 hrs', tag: 'Active', date: 'Bay 3' },
    ],
  },
  parts: {
    title: 'Parts & Products',
    desc: 'Catalog of automotive components, consumables, fluids, and retail items',
    icon: Boxes,
    color: 'text-orange-500',
    stat1: { label: 'Active Catalog Items', value: '185' },
    stat2: { label: 'Categories', value: '14' },
    items: [
      { title: 'Synthetic Engine Oil 5W-30 (1 Qt)', subtitle: 'Cost: $4.50 · Selling: $8.99 · Stock: 48', tag: 'Active', date: 'Fluids' },
      { title: 'Heavy Duty Oil Filter OF-01', subtitle: 'Cost: $6.00 · Selling: $12.99 · Stock: 15', tag: 'Active', date: 'Filters' },
      { title: 'Ceramic Brake Pad Set BP-02', subtitle: 'Cost: $24.00 · Selling: $45.99 · Stock: 8', tag: 'Active', date: 'Brakes' },
      { title: 'Standard Air Filter AF-04', subtitle: 'Cost: $8.00 · Selling: $15.99 · Stock: 10', tag: 'Active', date: 'Filters' },
    ],
  },
  reports: {
    title: 'Reports & Analytics',
    desc: 'Shop performance, parts margins, labor efficiency, and sales breakdown',
    icon: BarChart3,
    color: 'text-sky-500',
    stat1: { label: 'Monthly Gross Revenue', value: '$48,250' },
    stat2: { label: 'Labor Efficiency', value: '94%' },
    items: [
      { title: 'Weekly Revenue & Labor Breakdown', subtitle: 'Parts: $18,400 (38%) · Labor: $29,850 (62%)', tag: 'Generated', date: 'Current Week' },
      { title: 'Mechanic Productivity & Billed Hours Report', subtitle: 'Average 34.5 billable hours per technician', tag: 'Generated', date: 'Sep 2026' },
      { title: 'Fast-Moving Parts Inventory Audit', subtitle: 'Top 20 items contributing to 80% parts sales', tag: 'Generated', date: 'Sep 2026' },
    ],
  },
};

import { AutoCareReportsPage } from './AutoCareReportsPage';

export function AutoCareModuleView({ moduleId }: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  if (moduleId === 'reports') {
    return <AutoCareReportsPage />;
  }

  const meta = MODULE_META[moduleId] || {
    title: 'Auto Care Module',
    desc: 'Manage and configure your workshop operations',
    icon: Wrench,
    color: 'text-primary',
    stat1: { label: 'Total Records', value: '24' },
    stat2: { label: 'Status', value: 'Active' },
    items: [],
  };

  const Icon = meta.icon;

  const filteredItems = meta.items.filter(
    (item) =>
      !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2.5">
            <Icon className={`h-6 w-6 ${meta.color}`} />
            <span>{meta.title}</span>
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">{meta.desc}</p>
        </div>
        <div className="flex items-center gap-2">
          {moduleId === 'inventory' || moduleId === 'parts' ? (
            <Button onClick={() => navigate('/auto-care/pos')}>Open POS</Button>
          ) : moduleId === 'job-board' || moduleId === 'appointments' ? (
            <Button onClick={() => navigate('/auto-care/jobs/new')}>
              <Plus className="h-4 w-4 mr-1.5" /> New Job
            </Button>
          ) : (
            <Button onClick={() => navigate('/auto-care/pos')}>
              Launch POS <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          )}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-text-muted font-medium">{meta.stat1.label}</div>
            <div className="text-2xl font-bold text-text mt-1">{meta.stat1.value}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-text-muted font-medium">{meta.stat2.label}</div>
            <div className="text-2xl font-bold text-primary mt-1">{meta.stat2.value}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${meta.title.toLowerCase()}...`}
          className="w-full pl-9 pr-4 py-2 text-sm bg-bg border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Records List */}
      <Card>
        <CardHeader className="py-3 px-4 border-b border-border">
          <CardTitle className="text-sm font-semibold text-text">Recent Records & Activities</CardTitle>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-border">
          {filteredItems.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-4 hover:bg-bg-subtle transition-colors"
            >
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-text">{item.title}</div>
                <div className="text-xs text-text-secondary">{item.subtitle}</div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-text-muted hidden sm:inline">{item.date}</span>
                <Badge variant={item.tag === 'Completed' || item.tag === 'Paid' || item.tag === 'Active' ? 'success' : item.tag === 'Low Stock' ? 'error' : 'default'}>
                  {item.tag}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default AutoCareModuleView;
