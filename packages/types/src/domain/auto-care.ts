export type JobStatus = 'pending' | 'in_progress' | 'waiting_parts' | 'completed' | 'cancelled';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Vehicle {
  id: string;
  tenantId: string;
  customerId?: string;
  customerName?: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin?: string;
  color?: string;
  mileage?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AutoCareService {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  laborRate: number;
  estimatedHours: number;
  category: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ServiceJob {
  id: string;
  tenantId: string;
  jobNumber: string;
  customerId?: string;
  customerName: string;
  vehicleId?: string;
  vehicleSummary: string;
  status: JobStatus;
  priority: JobPriority;
  mechanicId?: string;
  mechanicName?: string;
  estimatedHours?: number;
  actualHours?: number;
  notes?: string;
  startedAt?: number;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ServiceJobItem {
  id: string;
  jobId: string;
  type: 'part' | 'service';
  productId?: string;
  serviceId?: string;
  name: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
  createdAt: number;
}

export interface AutoCareInvoice {
  id: string;
  tenantId: string;
  invoiceNumber: string;
  jobId?: string;
  jobNumber?: string;
  customerId?: string;
  customerName: string;
  vehicleSummary?: string;
  items: ServiceJobItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'mobile' | 'credit';
  status: 'paid' | 'unpaid' | 'partial';
  notes?: string;
  createdAt: number;
  updatedAt: number;
}
