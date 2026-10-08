import { useMemo } from 'react';
import { TrendingUp, AlertTriangle, Package, DollarSign } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@genx/ui/Card';
import { Badge } from '@genx/ui/Badge';
import { productRepo, orderRepo, getCurrentTenantId } from '@/lib/db';

export function Dashboard() {
  const currentTenant = getCurrentTenantId();

  const { data: products = [] } = useQuery({
    queryKey: ['products', currentTenant],
    queryFn: () => productRepo.findAll(currentTenant),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders-dashboard', currentTenant],
    queryFn: () => orderRepo.findAll(currentTenant),
  });

  const { lowStock, outOfStock, todayOrders, totalSales } = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayOrders = orders.filter((o) => o.createdAt >= todayStart.getTime());
    const totalSales = todayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const lowStock = products.filter((p) => p.stock <= p.minimumStock && p.stock > 0);
    const outOfStock = products.filter((p) => p.stock === 0);

    return { lowStock, outOfStock, todayOrders, totalSales };
  }, [products, orders]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-text">Dashboard</h1>
          <p className="text-sm text-text-secondary mt-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Today&apos;s Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalSales.toFixed(2)}</div>
            <p className="text-xs text-success flex items-center mt-2">
              <TrendingUp className="h-3 w-3 mr-1" /> Live from SQLite orders
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Orders Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayOrders.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Low Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lowStock.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Products</CardTitle>
            <Package className="h-4 w-4 text-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Low Stock Alerts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {lowStock.length === 0 && outOfStock.length === 0 ? (
            <p className="text-text-muted text-center py-6">All products are well stocked</p>
          ) : (
            <>
              {lowStock.map((p) => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-bg-subtle rounded-lg">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-text-secondary">SKU: {p.sku}</div>
                  </div>
                  <Badge variant="warning">
                    {p.stock} / {p.minimumStock}
                  </Badge>
                </div>
              ))}
              {outOfStock.map((p) => (
                <div key={p.id} className="flex justify-between items-center p-3 bg-error-bg rounded-lg">
                  <div className="font-medium">{p.name}</div>
                  <Badge variant="error">Out of stock</Badge>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
