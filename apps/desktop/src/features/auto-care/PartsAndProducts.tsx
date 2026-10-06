import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Boxes,
  Search,
  Plus,
  ShoppingCart,
  AlertCircle,
  Package,
  MoreVertical,
} from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@genx/ui/Button";
import { Badge } from "@genx/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@genx/ui/Card";
import { useProducts } from "@/hooks/useProducts";
import { AddProductModal } from "./AddProductModal";

export function PartsAndProducts() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: products = [], isLoading, refetch } = useProducts();

  // Filter: only show products that belong to auto-care-ish categories
  // (all products from the shared DB are shown — users manage them all here)
  const q = search.trim().toLowerCase();

  // Unique categories from loaded products
  const categories = Array.from(
    new Set(
      products
        .map((p) => p.categoryId)
        .filter(Boolean) as string[]
    )
  );

  const filtered = products.filter((p) => {
    const matchSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode ?? "").toLowerCase().includes(q);

    const matchCat =
      categoryFilter === "all" || p.categoryId === categoryFilter;

    return matchSearch && matchCat;
  });

  const activeCount = products.filter((p) => p.status === "active").length;
  const lowStockCount = products.filter(
    (p) => p.stock <= p.minimumStock && p.minimumStock > 0
  ).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text flex items-center gap-2.5">
            <Boxes className="h-6 w-6 text-orange-500" />
            Parts &amp; Products
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Catalog of automotive components, consumables, fluids, and retail items
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/auto-care/pos")}
          >
            <ShoppingCart className="h-4 w-4 mr-1.5" />
            Open POS
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Product
          </Button>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-text-muted font-medium">Active Catalog Items</div>
            <div className="text-2xl font-bold text-text mt-1">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-text-muted font-medium">Categories</div>
            <div className="text-2xl font-bold text-primary mt-1">{categories.length || 14}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-text-muted font-medium">Low Stock Alerts</div>
            <div className={clsx("text-2xl font-bold mt-1", lowStockCount > 0 ? "text-error" : "text-success")}>
              {lowStockCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-text-muted font-medium">Total SKUs</div>
            <div className="text-2xl font-bold text-text mt-1">{products.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Search + Category filter ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, or barcode…"
            className="w-full pl-9 pr-4 py-2 text-sm bg-bg border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 py-1 text-sm bg-bg border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Products list ── */}
      <Card>
        <CardHeader className="py-3 px-4 border-b border-border flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-text">
            {filtered.length} product{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
          {isLoading && (
            <span className="text-xs text-text-muted animate-pulse">Loading…</span>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-text-muted">
              <span className="animate-spin mr-2">⏳</span> Loading products…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-muted gap-3">
              <AlertCircle className="h-10 w-10 opacity-30" />
              <p className="text-sm">
                {search ? "No products match your search." : "No products yet. Add your first product!"}
              </p>
              {!search && (
                <Button size="sm" onClick={() => setModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Product
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-bg-subtle transition-colors group"
                >
                  {/* Left: image + info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Color dot / image */}
                    <div
                      className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden bg-bg-subtle border border-border"
                      style={{
                        background:
                          (product.images?.[0] && product.images[0].startsWith("data:"))
                            ? undefined
                            : (product.metadata?.color as string) || "#f3f4f6",
                      }}
                    >
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="h-4 w-4 text-text-muted opacity-60" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-text truncate">
                        {product.name}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-text-muted">{product.sku}</span>
                        {product.barcode && (
                          <span className="text-xs text-text-muted opacity-60">· {product.barcode}</span>
                        )}
                        {product.categoryId && (
                          <span className="text-xs bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded">
                            {product.categoryId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: price, stock, status */}
                  <div className="flex items-center gap-4 flex-shrink-0 ml-3">
                    <div className="text-right hidden sm:block">
                      <div className="text-sm font-bold text-text">
                        Rs. {product.sellingPrice.toFixed(2)}
                      </div>
                      {product.costPrice > 0 && (
                        <div className="text-xs text-text-muted">
                          Cost: Rs. {product.costPrice.toFixed(2)}
                        </div>
                      )}
                    </div>

                    <div className="text-center hidden md:block w-16">
                      <div
                        className={clsx(
                          "text-sm font-semibold",
                          product.stock <= product.minimumStock && product.minimumStock > 0
                            ? "text-error"
                            : "text-text"
                        )}
                      >
                        {product.stock}
                      </div>
                      <div className="text-xs text-text-muted">in stock</div>
                    </div>

                    <Badge
                      variant={
                        product.status === "active"
                          ? "success"
                          : product.status === "inactive"
                          ? "warning"
                          : "default"
                      }
                    >
                      {product.status}
                    </Badge>

                    <button
                      type="button"
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-bg-subtle"
                      aria-label="More options"
                    >
                      <MoreVertical className="h-4 w-4 text-text-muted" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add Product Modal ── */}
      <AddProductModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          void refetch();
        }}
      />
    </div>
  );
}

export default PartsAndProducts;
