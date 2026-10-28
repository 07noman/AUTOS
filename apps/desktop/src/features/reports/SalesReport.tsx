import { useMemo, useState } from 'react';
import { Download, TrendingUp, DollarSign, CreditCard, ShoppingBag, Calendar, Printer, Wallet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@genx/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@genx/ui/Card';
import { Table, TableHeader, TableRow, TableHead, TableCell, TableBody } from '@genx/ui/Table';
import { salesReportRepo, orderRepo, getCurrentTenantId, SaleRecord } from '@/lib/db';
import { expenseRepo, type Expense } from '@/lib/expenses-repo';
import { receiptSettingsRepo } from '@/lib/receipt-settings-repo';
import { printThermalReceipt } from '@/features/receipt/print-service';

type DateFilter = 'all' | 'today' | '7days' | '30days';

export function SalesReport() {
  const currentTenant = getCurrentTenantId();
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  const { data: sales = [], isLoading } = useQuery<SaleRecord[]>({
    queryKey: ['sales-report-unified', currentTenant],
    queryFn: () => salesReportRepo.getCompletedSales(currentTenant),
    staleTime: 1000 * 30,
  });

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: ['expenses-report', currentTenant],
    queryFn: () => expenseRepo.findAll(currentTenant),
    staleTime: 1000 * 30,
  });

  const filteredSales = useMemo(() => {
    if (dateFilter === 'all') return sales;

    const now = Date.now();
    let cutoff = 0;
    if (dateFilter === 'today') {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      cutoff = d.getTime();
    } else if (dateFilter === '7days') {
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
    } else if (dateFilter === '30days') {
      cutoff = now - 30 * 24 * 60 * 60 * 1000;
    }

    return sales.filter((s) => s.createdAt >= cutoff);
  }, [sales, dateFilter]);

  const filteredExpenses = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (dateFilter === 'today') {
      return expenses.filter((e) => e.date === todayStr);
    }
    if (dateFilter === '7days') {
      const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return expenses.filter((e) => e.date >= cutoff);
    }
    if (dateFilter === '30days') {
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return expenses.filter((e) => e.date >= cutoff);
    }
    return expenses;
  }, [expenses, dateFilter]);

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [filteredExpenses]);

  const money = (val: number) =>
    new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 2,
    }).format(val || 0);

  const {
    totalOrders,
    totalRevenue,
    cashRevenue,
    creditRevenue,
    avgOrderValue,
    dailySummary,
  } = useMemo(() => {
    const totalOrders = filteredSales.length;
    const totalRevenue = filteredSales.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const cashRevenue = filteredSales
      .filter((o) => o.paymentMethod === 'cash')
      .reduce((s, o) => s + (Number(o.total) || 0), 0);
    const creditRevenue = filteredSales
      .filter((o) => o.paymentMethod.includes('credit') || o.paymentMethod.includes('account'))
      .reduce((s, o) => s + (Number(o.total) || 0), 0);

    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    const netProfit = totalRevenue - totalExpenses;

    const groups = filteredSales.reduce<
      Record<string, { date: string; orders: number; cash: number; credit: number; other: number; total: number }>
    >((acc, o) => {
      const d = new Date(o.createdAt).toISOString().split('T')[0];
      if (!acc[d]) acc[d] = { date: d, orders: 0, cash: 0, credit: 0, other: 0, total: 0 };
      acc[d].orders += 1;
      const amt = Number(o.total) || 0;
      if (o.paymentMethod === 'cash') {
        acc[d].cash += amt;
      } else if (o.paymentMethod.includes('credit') || o.paymentMethod.includes('account')) {
        acc[d].credit += amt;
      } else {
        acc[d].other += amt;
      }
      acc[d].total += amt;
      return acc;
    }, {});

    const dailySummary = Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));

    return { totalOrders, totalRevenue, cashRevenue, creditRevenue, avgOrderValue, dailySummary };
  }, [filteredSales]);

  const exportCSV = () => {
    if (filteredSales.length === 0) return;
    const headers = ['Order Number', 'Date', 'Source', 'Payment Method', 'Customer', 'Subtotal', 'Tax', 'Total'];
    const rows = filteredSales.map((s) => [
      s.orderNumber,
      new Date(s.createdAt).toLocaleString(),
      s.source,
      s.paymentMethod,
      s.customerName || 'N/A',
      s.subtotal,
      s.tax,
      s.total,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sales_report_${dateFilter}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReprint = async (sale: SaleRecord) => {
    try {
      const settings = await receiptSettingsRepo.getSettings(currentTenant);
      let items = [
        {
          name: `Sale Transaction (${sale.source.replace(/_/g, ' ')})`,
          quantity: 1,
          price: sale.subtotal,
          total: sale.subtotal,
        },
      ];

      if (sale.source === 'retail_pos') {
        const order = await orderRepo.findById(currentTenant, sale.id);
        if (order && order.items && order.items.length > 0) {
          items = order.items.map((i) => ({
            name: i.name,
            sku: i.sku,
            quantity: i.quantity,
            price: i.price,
            discount: i.discount,
            total: i.total,
          }));
        }
      }

      await printThermalReceipt(
        {
          orderNumber: sale.orderNumber,
          date: sale.createdAt,
          terminalName: 'POS-01',
          customer: { name: sale.customerName },
          items,
          subtotal: sale.subtotal,
          discount: sale.discount,
          tax: sale.tax,
          total: sale.total,
          paymentMethod: sale.paymentMethod,
          amountPaid: sale.total,
          change: 0,
          currency: 'PKR',
        },
        settings
      );
    } catch (err) {
      console.error('Reprint receipt error:', err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sales Report</h1>
          <p className="text-sm text-text-secondary">
            Unified completed sales from POS and Invoices (PKR)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date range filter */}
          <div className="flex items-center bg-bg-elevated border border-border rounded-lg p-1 text-sm">
            <Calendar className="h-4 w-4 mx-2 text-text-muted" />
            <button
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1 rounded-md transition ${
                dateFilter === 'all' ? 'bg-primary text-white font-medium' : 'text-text-secondary hover:text-text'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-1 rounded-md transition ${
                dateFilter === 'today' ? 'bg-primary text-white font-medium' : 'text-text-secondary hover:text-text'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateFilter('7days')}
              className={`px-3 py-1 rounded-md transition ${
                dateFilter === '7days' ? 'bg-primary text-white font-medium' : 'text-text-secondary hover:text-text'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setDateFilter('30days')}
              className={`px-3 py-1 rounded-md transition ${
                dateFilter === '30days' ? 'bg-primary text-white font-medium' : 'text-text-secondary hover:text-text'
              }`}
            >
              30 Days
            </button>
          </div>

          <Button variant="outline" onClick={exportCSV} disabled={filteredSales.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Metric Cards (Including Expenses & Net Profit) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Total Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-text-muted mt-1">Completed transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{money(totalRevenue)}</div>
            <p className="text-xs text-text-muted mt-1">Avg: {money(avgOrderValue)} / order</p>
          </CardContent>
        </Card>

        <Card className="border-rose-500/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Total Expenses</CardTitle>
            <Wallet className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-500">{money(totalExpenses)}</div>
            <p className="text-xs text-rose-400 mt-1">{filteredExpenses.length} expense entries</p>
          </CardContent>
        </Card>

        <Card className={netProfit >= 0 ? 'border-teal-500/40' : 'border-rose-500/40'}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-text uppercase tracking-wider">
              Net Profit
            </CardTitle>
            <DollarSign className={`h-4 w-4 ${netProfit >= 0 ? 'text-teal-400' : 'text-rose-400'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
              {money(netProfit)}
            </div>
            <p className="text-xs text-text-muted mt-1">Sales minus Expenses</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-text-secondary">Cash Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{money(cashRevenue)}</div>
            <p className="text-xs text-text-muted mt-1">Direct cash received</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Summary Table */}
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
                    No completed sales found in this period
                  </TableCell>
                </TableRow>
              ) : (
                dailySummary.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="font-mono text-sm">{row.date}</TableCell>
                    <TableCell className="text-right font-medium">{row.orders}</TableCell>
                    <TableCell className="text-right text-text-secondary">{money(row.cash)}</TableCell>
                    <TableCell className="text-right text-warning">{money(row.credit)}</TableCell>
                    <TableCell className="text-right font-bold text-success">{money(row.total)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transaction Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Completed Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Time</TableHead>
                <TableHead className="text-right">Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-text-muted">
                    Loading transactions...
                  </TableCell>
                </TableRow>
              ) : filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-text-muted">
                    No transactions recorded
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.slice(0, 50).map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-mono text-xs font-semibold">{sale.orderNumber}</TableCell>
                    <TableCell className="text-xs">
                      <span className="capitalize px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {sale.source.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{sale.customerName || 'Walk-in Customer'}</TableCell>
                    <TableCell className="text-xs uppercase font-medium text-text-muted">
                      {sale.paymentMethod}
                    </TableCell>
                    <TableCell className="text-right font-bold text-success">
                      {money(sale.total)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-text-muted">
                      {new Date(sale.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleReprint(sale)}
                        title="Reprint Thermal Receipt"
                        className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10 inline-flex items-center gap-1"
                      >
                        <Printer className="h-3.5 w-3.5" /> Reprint
                      </Button>
                    </TableCell>
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
