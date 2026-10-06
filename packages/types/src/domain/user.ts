export type UserRole = 'owner' | 'manager' | 'cashier';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string;
}
