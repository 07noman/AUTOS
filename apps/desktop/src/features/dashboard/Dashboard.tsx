import { useMemo, useState } from 'react';
import { TrendingUp, AlertTriangle, Package, DollarSign, Plus, Database, Sparkles, CheckCircle2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@genx/ui/Card';
import { Badge } from '@genx/ui/Badge';
import { Button } from '@genx/ui/Button';
import { productRepo, categoryRepo, orderRepo, getCurrentTenantId } from '@/lib/db';
import { ProductForm } from '@/features/products/ProductForm';

const SAMPLE_DEMO_PRODUCTS = [
  {
    name: 'Synthetic Engine Oil 5W-30',
    sku: 'OIL-5W30',
    barcode: '89640001001',
    costPrice: 4200,
    sellingPrice: 5500,
    stock: 24,
    minimumStock: 5,
    categoryName: 'Engine Oil',
  },
  {
    name: 'Genuine Oil Filter OF-01',
    sku: 'FLT-OF01',
    barcode: '89640001002',
    costPrice: 1200,
    sellingPrice: 1800,
    stock: 35,
    minimumStock: 8,
    categoryName: 'Filters',
  },
  {
    name: 'Front Ceramic Brake Pads',
    sku: 'BRK-PAD-F',
    barcode: '89640001003',
    costPrice: 5000,
    sellingPrice: 7200,
    stock: 12,
    minimumStock: 3,
    categoryName: 'Brakes',
  },
  {
    name: 'Heavy Duty 12V Battery 65Ah',
    sku: 'BAT-12V65',
    barcode: '89640001004',
    costPrice: 16000,
    sellingPrice: 21000,
    stock: 6,
    minimumStock: 2,
    categoryName: 'Battery',
  },
  {
    name: 'Silicone Wiper Blades (Pair)',
    sku: 'WPR-24-18',
    barcode: '89640001005',
    costPrice: 1500,
    sellingPrice: 2400,
    stock: 18,
    minimumStock: 4,
    categoryName: 'Accessories',
  },
];

export function Dashboard() {
  const currentTenant = getCurrentTenantId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);

  const { data: products = [], refetch: refetchProducts } = useQuery({
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

  const money = (val: number) =>
    new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 2,
    }).format(val || 0);

  // Load sample demo products for testing
  const handleLoadDemoProducts = async () => {
    setIsSeeding(true);
    try {
      const now = Date.now();
      // Ensure categories exist
      const existingCats = await categoryRepo.findAll(currentTenant);
      const catMap = new Map(existingCats.map((c) => [c.name.toLowerCase(), c.id]));

      for (const p of SAMPLE_DEMO_PRODUCTS) {
        let catId = catMap.get(p.categoryName.toLowerCase());
        if (!catId) {
          catId = crypto.randomUUID();
          await categoryRepo.create({
            id: catId,
            tenantId: currentTenant,
            name: p.categoryName,
            createdAt: now,
            updatedAt: now,
          });
          catMap.set(p.categoryName.toLowerCase(), catId);
        }

        const newProd = {
          id: crypto.randomUUID(),
          tenantId: currentTenant,
          sku: p.sku,
          name: p.name,
          barcode: p.barcode,
          categoryId: catId,
          costPrice: p.costPrice,
          sellingPrice: p.sellingPrice,
          stock: p.stock,
          minimumStock: p.minimumStock,
          status: 'active' as const,
          createdAt: now,
          updatedAt: now,
        };
        await productRepo.create(newProd);
      }

      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      await refetchProducts();
      setSeedSuccess(true);
      setTimeout(() => setSeedSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to load demo products:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Dashboard</h1>
          <p className="text-sm text-text-secondary mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* 2 Main Quick Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setFormOpen(true)}
            className="bg-[#79556f] text-white hover:bg-[#63435a] shadow-sm flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Product
          </Button>

          <Button
            variant="outline"
            onClick={handleLoadDemoProducts}
            isLoading={isSeeding}
            className="flex items-center gap-2 border-slate-300 hover:bg-slate-50"
          >
            {seedSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="text-emerald-700">Products Loaded!</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-amber-500" />
                Load Test Products
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Onboarding Banner when no products are present */}
      {products.length === 0 && (
        <div className="rounded-xl border border-dashed border-[#b7a1b2] bg-[#fdf9fb] p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eee7ed] text-[#79556f]">
            <Package className="h-6 w-6" />
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-900">Your store catalog is empty</h3>
          <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
            Aap manually product add kar sakte hain ya testing ke liye instant mock products load kar sakte hain.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Button
              onClick={() => setFormOpen(true)}
              className="bg-[#79556f] text-white hover:bg-[#63435a]"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Product
            </Button>
            <Button
              variant="outline"
              onClick={handleLoadDemoProducts}
              isLoading={isSeeding}
            >
              <Database className="h-4 w-4 mr-2 text-[#79556f]" />
              Load Test Products
            </Button>
          </div>
        </div>
      )}

      {/* Key Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Today&apos;s Sales</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{money(totalSales)}</div>
            <p className="text-xs text-success flex items-center mt-2">
              <TrendingUp className="h-3 w-3 mr-1" /> Live SQLite sales
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

        <div onClick={() => navigate('/products')} className="cursor-pointer">
          <Card className="hover:border-[#b7a1b2] transition">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-text-secondary">Total Products</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{products.length}</div>
              <p className="text-xs text-text-muted mt-2">Click to open Products catalog</p>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Low Stock Alerts */}
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

      {/* Product Form Modal */}
      <ProductForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
