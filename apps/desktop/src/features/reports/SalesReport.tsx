import { useMemo } from 'react';
import { Download, Filter, TrendingUp, DollarSign, CreditCard, ShoppingBag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@genx/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@genx/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableCell, TableBody } from '@genx/ui/Table';
import { orderRepo, getCurrentTenantId } from '@/lib/db';

export function SalesReport() {
  const currentTenant = getCurrentTenantId();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders-report', currentTenant],
    queryFn: () => orderRepo.findAll(currentTenant),
  });

  const { totalOrders, totalRevenue, cashRevenue, creditRevenue, dailySummary } = useMemo(() => {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const cashRevenue = orders
      .filter((o) => o.paymentMethod === 'cash')
      .reduce((s, o) => s + (Number(o.total) || 0), 0);
    const creditRevenue = orders
      .filter((o) => o.paymentMethod === 'credit')
      .reduce((s, o) => s + (Number(o.total) || 0), 0);

    const groups = orders.reduce<Record<string, { date: string; orders: number; cash: number; credit: number; total: number }>>((acc, o) => {
      const d = new Date(o.createdAt).toISOString().split('T')[0];
      if (!acc[d]) acc[d] = { date: d, orders: 0, cash: 0, credit: 0, total: 0 };
      acc[d].orders += 1;
      if (o.paymentMethod === 'cash') acc[d].cash += Number(o.total) || 0;
      if (o.paymentMethod === 'credit') acc[d].credit += Number(o.total) || 0;
      acc[d].total += Number(o.total) || 0;
      return acc;
    }, {});

    const dailySummary = Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));

    return { totalOrders, totalRevenue, cashRevenue, creditRevenue, dailySummary };
  }, [orders]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Sales Report</h1>
          <p className="text-sm text-text-secondary">Real-time SQLite sales and revenue performance</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Total Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-text-muted mt-1">Tenant orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Total Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">${totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-text-muted mt-1">Cash + Credit combined</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Cash Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${cashRevenue.toFixed(2)}</div>
            <p className="text-xs text-text-muted mt-1">Collected in cash</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Credit Sales</CardTitle>
            <CreditCard className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">${creditRevenue.toFixed(2)}</div>
            <p className="text-xs text-text-muted mt-1">On customer accounts</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Cash</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Total Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-text-muted">
                    Loading sales data...
                  </TableCell>
                </TableRow>
              ) : dailySummary.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-text-muted">
                    No sales recorded yet
                  </TableCell>
                </TableRow>
              ) : (
                dailySummary.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="font-mono text-sm">{row.date}</TableCell>
                    <TableCell className="text-right">{row.orders}</TableCell>
                    <TableCell className="text-right text-text-secondary">${row.cash.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-warning">${row.credit.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold text-success">${row.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
