export interface Order {
  id: string;
  tenantId: string;
  orderNumber: string;
  items: OrderItem[];
  customerId?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'mobile' | 'credit';
  status: 'completed' | 'held' | 'suspended' | 'refunded';
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
  discount: number;
  tax: number;
  total: number;
}
