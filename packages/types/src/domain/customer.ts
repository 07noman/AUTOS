export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  creditLimit: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}
