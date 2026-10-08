import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Users, Plus, Search, Phone, Mail, DollarSign } from 'lucide-react';
import { Button } from '@genx/ui/Button';
import { Input } from '@genx/ui/Input';
import { Table, TableHeader, TableRow, TableHead, TableCell, TableBody } from '@genx/ui/Table';
import { Dialog, DialogHeader, DialogTitle, DialogContent, DialogFooter } from '@genx/ui/Dialog';
import { Card, CardHeader, CardTitle, CardContent } from '@genx/ui/Card';
import { useCustomers, useCreateCustomer } from '@/hooks/useCustomers';
import { getCurrentTenantId } from '@/lib/db';

const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  creditLimit: z.coerce.number().min(0).default(0),
});

type CustomerFormData = z.infer<typeof customerSchema>;

export function Customers() {
  const currentTenant = getCurrentTenantId();
  const { data: customers = [], isLoading } = useCustomers(currentTenant);
  const createCustomer = useCreateCustomer();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: { creditLimit: 0 },
  });

  const onSubmit = async (data: CustomerFormData) => {
    await createCustomer.mutateAsync({
      name: data.name,
      phone: data.phone || undefined,
      email: data.email || undefined,
      address: data.address || undefined,
      creditLimit: data.creditLimit,
    });
    reset();
    setModalOpen(false);
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search)) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  const totalBalance = customers.reduce((s, c) => s + (Number(c.balance) || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Customers & Credit Ledger
          </h1>
          <p className="text-sm text-text-secondary">Manage customer directory and store credit balances</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Outstanding Credit Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">${totalBalance.toFixed(2)}</div>
            <p className="text-xs text-text-muted mt-1">Total receivables</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-bg-elevated">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Credit Balance</TableHead>
              <TableHead className="text-right">Credit Limit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-text-muted">
                  Loading customers...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-text-muted">
                  No customers found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-sm text-text-secondary">{customer.phone || '—'}</TableCell>
                  <TableCell className="text-sm text-text-secondary">{customer.email || '—'}</TableCell>
                  <TableCell className="text-right font-bold text-warning">
                    ${Number(customer.balance || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-text-secondary">
                    ${Number(customer.creditLimit || 0).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Customer Name *" {...register('name')} error={errors.name?.message} />
            <Input label="Phone" type="tel" placeholder="03000000001" {...register('phone')} />
            <Input label="Email" type="email" placeholder="customer@example.com" {...register('email')} error={errors.email?.message} />
            <Input label="Address" {...register('address')} />
            <Input label="Credit Limit" type="number" step="0.01" {...register('creditLimit')} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Save Customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default Customers;
