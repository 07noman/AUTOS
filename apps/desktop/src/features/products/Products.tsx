import { useMemo, useState } from 'react';
import { useProducts, useCategories } from '@/hooks/useProducts';
import { ProductForm } from './ProductForm';

export function Products() {
  const [view, setView] = useState<'list' | 'cards'>('cards');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [formOpen, setFormOpen] = useState(false);

  const { data: rawProducts = [], isLoading: productsLoading } = useProducts();
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();

  const loading = productsLoading || categoriesLoading;

  // Build category lookup map
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [categories]);

  // Map to unified display items
  const products = useMemo(() => {
    return rawProducts.map((p) => ({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId || null,
      categoryName: p.categoryId ? categoryMap.get(p.categoryId) || 'Uncategorized' : 'Uncategorized',
      internalReference: p.sku || null,
      barcode: p.barcode || null,
      salesPrice: p.sellingPrice || 0,
      cost: p.costPrice || 0,
      quantityOnHand: p.stock || 0,
      imageUrl: p.images && p.images.length > 0 ? p.images[0] : null,
      variantsCount: undefined,
    }));
  }, [rawProducts, categoryMap]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        categoryId === 'all' || product.categoryId === categoryId;

      const matchesSearch =
        !term ||
        [
          product.name,
          product.internalReference,
          product.barcode,
          product.categoryName,
        ].some((value) => (value ?? '').toLowerCase().includes(term));

      return matchesCategory && matchesSearch;
    });
  }, [products, search, categoryId]);

  const money = (value: number) =>
    new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 2,
    }).format(value || 0);

  return (
    <main className="min-h-full bg-[#f7f8fa] p-4 text-slate-800 sm:p-6">
      {/* Page heading */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your products and categories
          </p>
        </div>

        <button
          onClick={() => setFormOpen(true)}
          className="rounded-lg bg-[#79556f] px-5 py-2.5 font-medium text-white shadow-sm transition hover:bg-[#63435a]"
        >
          + New Product
        </button>
      </div>

      {/* Search + category + view controls */}
      <section className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 md:flex-row">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search product, SKU or barcode..."
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-[#79556f]"
          aria-label="Search products"
        />

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 md:min-w-52"
          aria-label="Filter products by category"
        >
          <option value="all">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        <div className="flex shrink-0 rounded-lg border border-slate-200 p-1">
          <button
            onClick={() => setView('cards')}
            aria-pressed={view === 'cards'}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              view === 'cards'
                ? 'bg-[#eee7ed] font-semibold text-[#79556f]'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            ▦ Cards
          </button>
          <button
            onClick={() => setView('list')}
            aria-pressed={view === 'list'}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              view === 'list'
                ? 'bg-[#eee7ed] font-semibold text-[#79556f]'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            ☰ List
          </button>
        </div>
      </section>

      <div className="mb-3 text-sm text-slate-500">
        {loading
          ? 'Loading products...'
          : `${filteredProducts.length} products`}
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-10 text-center text-slate-500">
          Loading products & categories...
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center">
          <p className="font-medium text-slate-700">No products found</p>
          <p className="mt-1 text-sm text-slate-500">
            Try another search or category.
          </p>
        </div>
      ) : view === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="flex min-h-32 w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#b7a1b2] hover:shadow-sm"
            >
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
                {product.imageUrl ? (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-3xl text-slate-300">▧</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="truncate font-semibold text-slate-900">
                  {product.name}
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  {product.categoryName}
                </p>

                <p className="mt-2 font-semibold text-slate-900">
                  {money(product.salesPrice)}
                </p>

                <p className="mt-1 truncate text-xs text-slate-500">
                  {product.internalReference || 'No SKU'} · Stock:{' '}
                  <span className={product.quantityOnHand <= 0 ? 'text-rose-600 font-semibold' : 'font-medium'}>
                    {product.quantityOnHand}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[850px] text-sm">
            <thead className="border-b bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-4 text-left font-medium">Product Name</th>
                <th className="px-4 py-4 text-left font-medium">Category</th>
                <th className="px-4 py-4 text-left font-medium">Internal Reference</th>
                <th className="px-4 py-4 text-right font-medium">Sales Price</th>
                <th className="px-4 py-4 text-right font-medium">Cost</th>
                <th className="px-4 py-4 text-right font-medium">On Hand</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  className="border-b last:border-0 hover:bg-slate-50 transition"
                >
                  <td className="px-4 py-4 font-medium text-slate-900">
                    {product.name}
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    {product.categoryName || 'Uncategorized'}
                  </td>
                  <td className="px-4 py-4 text-slate-500 font-mono text-xs">
                    {product.internalReference || '—'}
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-slate-900">
                    {money(product.salesPrice)}
                  </td>
                  <td className="px-4 py-4 text-right text-slate-500">
                    {money(product.cost)}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span
                      className={
                        product.quantityOnHand <= 0
                          ? 'text-rose-600 font-semibold'
                          : 'font-medium text-slate-900'
                      }
                    >
                      {product.quantityOnHand}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProductForm open={formOpen} onOpenChange={setFormOpen} />
    </main>
  );
}
