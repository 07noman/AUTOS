"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  Search,
  ScanBarcode,
  Menu,
  Plus,
  Minus,
  Trash2,
  User as UserRound,
  StickyNote,
  CreditCard,
  Banknote,
  WalletCards,
  Car,
  Wrench,
  Settings2,
  ShoppingCart,
  LayoutGrid,
  Tag,
  Percent,
  X,
} from "lucide-react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import PaymentPage, { type PaymentData, type POSCustomer, type POSCartItem } from "@/features/auto-care/PaymentPage";
import PaymentSuccessScreen from "@/features/auto-care/PaymentSuccessScreen";
import POSVehicleModal, { type POSVehicleDetails } from "@/features/auto-care/POSVehicleModal";
import { DiscountModal, type DiscountType } from "@/components/pos/DiscountModal";
import { completePOSSale, posOrderRepo, vehicleRepo } from "@/lib/auto-care-db";
import { useAuth } from "@/hooks/useAuth";
import { useProducts, useCategories } from "@/hooks/useProducts";
import { productRepo, customerRepo, getCurrentTenantId } from "@/lib/db";
import { isOnline } from "@/services/connectionManager";
import { saveOfflineOrder } from "@/services/offlineOrders";
import { reduceStock } from "@/services/offlineInventory";
import SoftwareMode from "@/components/SoftwareMode";
import UserMenu from "@/components/UserMenu";
import { AccountActionsPage } from "@/features/account-actions/AccountActionsPage";
import { PasscodeLock } from "@/components/PasscodeLock";
import { getAppSettings, isModuleUnlocked, getHiddenModulesSync } from "@/lib/app-settings";
import { BUSINESS_TYPES, resolveBusinessType, type BusinessTypeKey } from "@/lib/businessTypes";

type Category = {
  id: string;
  name: string;
  color: string;
};

type Product = {
  id: string | number;
  name: string;
  price: number;
  category: string;
  image?: string;
  type: "product" | "service";
  stock?: number;
  trackInventory?: boolean;
  barcode?: string;
  sku?: string;
};

type CartItem = Product & {
  quantity: number;
};

interface MasterPOSProps {
  businessType?: BusinessTypeKey | string;
}

export function MasterPOS({ businessType: propType }: MasterPOSProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlParams = useParams<{ businessType?: string }>();
  
  const bKey = resolveBusinessType(propType || urlParams.businessType);
  const config = BUSINESS_TYPES[bKey] ?? BUSINESS_TYPES['auto-parts'];
  const basePath = `/business/${bKey}`;

  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { data: dbProducts = [] } = useProducts();
  const { data: dbCategories = [] } = useCategories();

  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vehicleDetails, setVehicleDetails] = useState<POSVehicleDetails | null>(null);
  const [customer, setCustomer] = useState("Walk-in Customer");
  const [selectedPOSCustomer, setSelectedPOSCustomer] = useState<POSCustomer | null>(null);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const showAccountActions = showUserMenu || searchParams.get("view") === "actions";

  const handleCloseAccountActions = () => {
    setShowUserMenu(false);
    if (searchParams.get("view") === "actions") {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("view");
        return next;
      });
    }
  };

  const handleOpenAccountActions = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("view", "actions");
      return next;
    });
  };

  // App settings protection state
  const [isPasscodeEnabled, setIsPasscodeEnabled] = useState(false);
  const [hiddenModules, setHiddenModules] = useState<string[]>(() =>
    getHiddenModulesSync(user?.id ?? null)
  );
  const [sessionUnlocked, setSessionUnlocked] = useState(false);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const settings = await getAppSettings();
        if (isMounted) {
          setIsPasscodeEnabled(Boolean(settings.is_passcode_enabled));
          setHiddenModules(settings.hidden_modules || []);
        }
      } catch (err) {
        console.warn("[MasterPOS] Failed to load app settings:", err);
      }
    })();
  }, []);

  const [currentOrderNumber, setCurrentOrderNumber] = useState<number | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

  // Read URL query params on mount
  useEffect(() => {
    const jobCustomer = searchParams.get("customer");
    const jobVehicle = searchParams.get("vehicle");
    const jobNumber = searchParams.get("jobNumber");

    if (jobCustomer) setCustomer(jobCustomer);
    if (jobVehicle || jobNumber) {
      setVehicleDetails({
        regNo: jobNumber || "",
        make: jobVehicle || "",
        model: "",
        mileage: "",
        customerName: jobCustomer || "",
      });
    }
  }, [searchParams]);

  useEffect(() => {
    const activeTenant = getCurrentTenantId();
    const loadId = searchParams.get("loadOrderId");
    if (loadId) {
      void posOrderRepo.findById(loadId, activeTenant).then((order) => {
        if (order && order.status === "ONGOING") {
          setCurrentOrderId(order.id);
          setCurrentOrderNumber(order.orderNumber);
          if (order.customerName) setCustomer(order.customerName);
          const restoredItems: CartItem[] = order.items.map((i) => ({
            id: i.id,
            name: i.name,
            price: i.price,
            category: i.type === "service" ? "services" : "parts",
            type: i.type,
            quantity: i.quantity,
          }));
          setCart(restoredItems);
        }
      });
    } else {
      void posOrderRepo.nextOrderNumber(activeTenant).then(setCurrentOrderNumber);
    }
  }, [searchParams]);

  // Payment page state
  const [showPayment, setShowPayment] = useState(false);
  const lastInvoiceNumberRef = useRef<string | undefined>(undefined);
  const isSubmittingPaymentRef = useRef(false);
  const lastPaymentTimestampRef = useRef<number>(0);

  const [successData, setSuccessData] = useState<{
    amount: number;
    change: number;
    method: "cash" | "credit" | "card";
    invoiceNumber: string;
    customerName?: string;
    vehicle?: any;
    items?: any[];
    subtotal?: number;
    discount?: number;
    tax?: number;
    taxRatePercent?: number;
    total?: number;
    paidAmount?: number;
    orderId?: string;
  } | null>(null);

  const allPosProducts = useMemo<Product[]>(() => {
    return dbProducts.map((p: any) => ({
      id: p.id,
      name: p.name,
      price: Number(p.price || 0),
      category: p.category_id || p.category || "General",
      type: (p.type === "service" ? "service" : "product") as "product" | "service",
      stock: p.stock ?? p.stock_quantity ?? 0,
      trackInventory: Boolean(p.track_inventory ?? true),
      barcode: p.barcode || "",
      sku: p.sku || "",
      image: p.image || undefined,
    }));
  }, [dbProducts]);

  const posCategories = useMemo<Category[]>(() => {
    const defaultColors = [
      "bg-teal-500", "bg-sky-500", "bg-indigo-500",
      "bg-purple-500", "bg-rose-500", "bg-amber-500", "bg-emerald-500",
    ];
    const mapped = dbCategories.map((c: any, index: number) => ({
      id: c.id,
      name: c.name,
      color: defaultColors[index % defaultColors.length],
    }));
    return [{ id: "all", name: "All Categories", color: "bg-slate-700" }, ...mapped];
  }, [dbCategories]);

  const filteredProducts = useMemo(() => {
    return allPosProducts.filter((product) => {
      let categoryMatch = activeCategory === "all";
      if (!categoryMatch) {
        categoryMatch =
          product.category === activeCategory ||
          String(product.category).toLowerCase() === activeCategory.toLowerCase();
      }
      const searchClean = search.trim().toLowerCase();
      const searchMatch =
        !searchClean ||
        product.name.toLowerCase().includes(searchClean) ||
        (product.barcode && product.barcode.toLowerCase().includes(searchClean)) ||
        (product.sku && product.sku.toLowerCase().includes(searchClean));

      return categoryMatch && searchMatch;
    });
  }, [allPosProducts, activeCategory, search]);

  // ── Store & Tax integration (0% default or saved setting) ────────────────
  const [taxRatePercent, setTaxRatePercent] = useState<number>(() => {
    const saved = localStorage.getItem('genx:default_tax_rate');
    return saved !== null ? Math.max(0, parseFloat(saved) || 0) : 0;
  });

  useEffect(() => {
    const handleTaxChanged = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom?.detail?.taxRate !== undefined) {
        setTaxRatePercent(Math.max(0, Number(custom.detail.taxRate) || 0));
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'genx:default_tax_rate') {
        setTaxRatePercent(Math.max(0, parseFloat(e.newValue || '0') || 0));
      }
    };
    window.addEventListener('genx:tax-rate-changed', handleTaxChanged);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('genx:tax-rate-changed', handleTaxChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // ── Cart Discount state (Amount or Percent) ──────────────────────────────
  const [discountType, setDiscountType] = useState<DiscountType>('percent');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);

  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);

  const discountAmount = useMemo(() => {
    if (discountValue <= 0 || subtotal <= 0) return 0;
    if (discountType === 'percent') {
      return (subtotal * Math.min(100, discountValue)) / 100;
    }
    return Math.min(subtotal, discountValue);
  }, [subtotal, discountType, discountValue]);

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const tax = (discountedSubtotal * Math.max(0, taxRatePercent)) / 100;
  const total = discountedSubtotal + tax;

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((item) => String(item.id) === String(product.id));
      if (existing) {
        return current.map((item) =>
          String(item.id) === String(product.id)
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...current, { ...product, quantity: 1 }];
    });
  };

  const increaseQuantity = (id: string | number) => {
    setCart((current) =>
      current.map((item) =>
        String(item.id) === String(id) ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  };

  const decreaseQuantity = (id: string | number) => {
    setCart((current) =>
      current
        .map((item) =>
          String(item.id) === String(id) ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (id: string | number) => {
    setCart((current) => current.filter((item) => String(item.id) !== String(id)));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountValue(0);
  };

  const handleNewOrder = async () => {
    const activeTenant = getCurrentTenantId();
    if (cart.length > 0) {
      try {
        await posOrderRepo.createOngoing({
          items: cart.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            type: item.type,
            category: item.category,
            trackInventory: item.trackInventory,
          })),
          subtotal,
          tax,
          total,
          customerName: customer !== "Walk-in Customer" ? customer : undefined,
          notes: vehicleDetails ? JSON.stringify({ vehicle: vehicleDetails }) : undefined,
          tenantId: activeTenant,
        });
      } catch (err) {
        console.warn("[MasterPOS] Failed to save ongoing order:", err);
      }
    }
    setCart([]);
    setVehicleDetails(null);
    setCustomer("Walk-in Customer");
    setSelectedPOSCustomer(null);
    setCurrentOrderId(null);
    const nextNum = await posOrderRepo.nextOrderNumber(activeTenant);
    setCurrentOrderNumber(nextNum);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f4f4f4] text-[#202124]">
      {/* ── Top POS Header ─────────────────────────────────────── */}
      <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-[#d8d8d8] bg-white px-3 z-30">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setMobileCartOpen(!mobileCartOpen)}
            className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[#d0d0d0] lg:hidden relative"
            title="Cart"
          >
            <ShoppingCart className="h-4 w-4 text-slate-700" />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {cart.length}
              </span>
            )}
          </button>

          <button
            onClick={() => navigate(basePath)}
            title={`Return to ${config.name} Launcher`}
            className="flex h-[34px] items-center gap-1.5 rounded-lg border border-[#bce6e9] bg-[#e6f5f6] px-3 text-[13px] sm:text-[14px] font-medium text-[#00878a] hover:bg-[#d8f0f2] transition-colors"
          >
            <LayoutGrid className="h-4 w-4 text-[#00878a]" />
            <span>Register</span>
          </button>

          <button
            onClick={() => navigate(`${basePath}/orders`)}
            className="flex h-[34px] items-center rounded-lg px-3 text-[13px] sm:text-[14px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Orders
          </button>

          <button
            onClick={handleNewOrder}
            title="New Order"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[#d0d0d0] text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>

          <div className="flex h-[34px] min-w-[65px] items-center justify-center rounded-lg border border-[#159aa5] bg-[#f5ffff] px-2.5 text-[13px] sm:text-[14px] font-medium text-[#159aa5]">
            {currentOrderNumber ? String(currentOrderNumber).padStart(4, "0") : "0001"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex w-[180px] sm:w-[260px] md:w-[300px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="h-[34px] w-full rounded-lg border border-[#d0d0d0] bg-white pl-8 pr-3 text-xs sm:text-[13px] outline-none focus:border-[#159aa5]"
            />
          </div>

          <div className="hidden xl:flex items-center">
            <SoftwareMode compact={true} />
          </div>

          {/* User Profile & Account Actions */}
          <div className="relative">
            <button
              type="button"
              onClick={handleOpenAccountActions}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-[#00897b] text-[13px] font-bold text-white shadow-sm hover:ring-2 hover:ring-[#00897b]/40 transition cursor-pointer"
              title={user?.name || `${config.name} Cashier`}
              aria-label="Account Actions"
            >
              {user?.name?.charAt(0).toUpperCase() || config.name.charAt(0).toUpperCase()}
            </button>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenuDropdown(!showMenuDropdown)}
              title="Menu"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>

            {showMenuDropdown && (
              <div className="absolute right-0 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl z-50">
                <button
                  onClick={() => navigate(basePath)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 font-medium"
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-[#159aa5]" />
                  {config.name} Launcher
                </button>
                <button
                  onClick={() => navigate(`${basePath}/service-jobs`)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 font-medium"
                >
                  <Wrench className="h-3.5 w-3.5 text-orange-500" />
                  Service Jobs
                </button>
                <button
                  onClick={() => navigate(`${basePath}/dashboard`)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 font-medium"
                >
                  <Car className="h-3.5 w-3.5 text-purple-500" />
                  Dashboard
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={() => {
                    localStorage.removeItem("genx:selectedModule");
                    navigate("/select-module");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 font-medium"
                >
                  <Settings2 className="h-3.5 w-3.5 text-slate-500" />
                  Switch Business
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main POS Workspace ──────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Cart panel */}
        <section
          className={`
            fixed inset-y-[48px] left-0 z-40 flex w-full
            max-w-[480px] flex-col bg-white
            border-r border-[#d8d8d8]
            transition-transform duration-200
            lg:static lg:w-[35%] lg:max-w-[400px] lg:min-w-[320px]
            ${mobileCartOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          {/* Cart Header */}
          <div className="flex h-[42px] shrink-0 items-center justify-between border-b border-[#e5e5e5] px-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Current Order
            </span>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-rose-600 hover:underline flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" /> Clear Cart
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#f0f0f0] p-2">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-400">
                <ShoppingCart className="h-10 w-10 stroke-[1.5] opacity-40 mb-2" />
                <p className="text-sm font-medium">Cart is empty</p>
                <p className="text-xs text-slate-400 mt-0.5">Select items to start order</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2.5 px-2">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="truncate text-[13px] font-semibold text-slate-800">
                      {item.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      Rs. {item.price.toFixed(2)} × {item.quantity} ={" "}
                      <span className="font-semibold text-slate-700">
                        Rs. {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => decreaseQuantity(item.id)}
                      className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-bold text-slate-800">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => increaseQuantity(item.id)}
                      className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="flex h-6 w-6 items-center justify-center rounded hover:bg-rose-50 text-rose-500 ml-1"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Footer / Totals & Actions */}
          <div className="shrink-0 border-t border-[#e0e0e0] bg-[#fafafa] p-3 space-y-2">
            <div className="flex justify-between text-xs text-slate-600">
              <span>Subtotal</span>
              <span>Rs. {subtotal.toFixed(2)}</span>
            </div>

            {/* Discount Row (Replaces hardcoded tax & opens discount modal with amount/percent) */}
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setIsDiscountModalOpen(true)}
                disabled={cart.length === 0}
                className="flex items-center gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Click to apply discount (percentage or fixed amount)"
              >
                <Tag className="h-3.5 w-3.5 text-emerald-600" />
                {discountAmount > 0 ? (
                  <span>Discount ({discountType === 'percent' ? `${discountValue}%` : 'Rs.'})</span>
                ) : (
                  <span>+ Add Discount</span>
                )}
              </button>
              {discountAmount > 0 ? (
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-emerald-600">
                    -Rs. {discountAmount.toFixed(2)}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDiscountValue(0);
                    }}
                    className="text-slate-400 hover:text-rose-500 cursor-pointer p-0.5 rounded transition-colors"
                    title="Remove discount"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <span className="text-slate-400 text-[11px]">Rs. 0</span>
              )}
            </div>

            {/* Taxes (Dynamic from Store Settings, 0% default) */}
            <div className="flex justify-between text-xs text-slate-600">
              <span>Taxes ({taxRatePercent}%)</span>
              <span>Rs. {tax.toFixed(2)}</span>
            </div>

            {/* Total Bill */}
            <div className="flex justify-between text-base font-bold text-slate-900 pt-1 border-t border-[#e8e8e8]">
              <span>Total</span>
              <span>Rs. {total.toFixed(2)}</span>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  if (cart.length === 0) return;
                  setShowPayment(true);
                }}
                disabled={cart.length === 0}
                className="flex h-[44px] w-full items-center justify-center rounded-lg bg-[#704a62] text-[15px] font-semibold text-white transition hover:bg-[#5e3c52] cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Payment
              </button>
            </div>
          </div>
        </section>

        {/* Product Catalog Area */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f4f4f4]">
          {/* Categories */}
          <div className="shrink-0 overflow-x-auto border-b border-[#e0e0e0] bg-[#f8fafc] px-3 py-2">
            <div className="flex min-w-max gap-1.5">
              {posCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`
                    flex h-[34px] min-w-[90px] items-center justify-center rounded-lg px-4 text-xs sm:text-[13px] font-medium transition cursor-pointer
                    ${
                      activeCategory === category.id
                        ? "bg-[#00878a] text-white shadow-sm font-semibold"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-[#dcdcdc]"
                    }
                  `}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {filteredProducts.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                <Search className="h-10 w-10 opacity-30 mb-2" />
                <p className="text-sm font-medium">No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
                {filteredProducts.map((product) => {
                  const cartItem = cart.find((i) => String(i.id) === String(product.id));
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className={`
                        relative flex flex-col justify-between overflow-hidden rounded-xl border bg-white p-3 text-left transition hover:shadow-md cursor-pointer
                        ${cartItem ? "border-[#00878a] ring-1 ring-[#00878a]" : "border-[#e0e0e0]"}
                      `}
                    >
                      <div>
                        <div className="text-[13px] font-semibold text-slate-800 line-clamp-2">
                          {product.name}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {product.type === "service" ? "Service" : `Stock: ${product.stock ?? 0}`}
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[14px] font-bold text-[#00878a]">
                          Rs. {product.price.toFixed(2)}
                        </span>
                        {cartItem && (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                            {cartItem.quantity}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Payment Page Overlay */}
      {showPayment && (
        <PaymentPage
          total={total}
          subtotal={subtotal}
          discount={discountAmount}
          tax={tax}
          taxRatePercent={taxRatePercent}
          items={cart.map((c) => ({
            id: String(c.id),
            name: c.name,
            quantity: c.quantity,
            price: c.price,
            type: c.type,
          }))}
          onBack={() => setShowPayment(false)}
          onPayment={async (data) => {
            setShowPayment(false);
            setSuccessData({
              amount: data.paidAmount,
              change: Math.max(0, data.paidAmount - total),
              method: data.paymentMethod,
              invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
              customerName: customer,
              items: cart,
              subtotal,
              discount: data.discount ?? discountAmount,
              tax,
              taxRatePercent,
              total,
              paidAmount: data.paidAmount,
            });
            clearCart();
          }}
        />
      )}

      {/* Payment Success Overlay */}
      {successData && (
        <PaymentSuccessScreen
          amount={successData.amount}
          currency="Rs."
          order={{
            id: successData.orderId || `ORD-${Date.now()}`,
            invoiceNumber: successData.invoiceNumber,
            ticketNumber: successData.invoiceNumber,
            customer: successData.customerName ? { name: successData.customerName } : undefined,
            items: (successData.items || []).map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.price,
              total: item.price * item.quantity,
              unit: "Units",
            })),
            subtotal: successData.subtotal ?? subtotal,
            discount: successData.discount ?? discountAmount,
            tax: successData.tax ?? tax,
            taxRatePercent: successData.taxRatePercent ?? taxRatePercent,
            total: successData.total ?? total,
            paymentMethod: successData.method,
            amountPaid: successData.paidAmount ?? successData.amount,
            createdAt: Date.now(),
          }}
          payment={{
            amount: successData.amount,
            change: successData.change,
            method: successData.method,
          }}
          onBack={() => setSuccessData(null)}
          onContinue={() => setSuccessData(null)}
        />
      )}

      {/* Cart Discount Modal */}
      <DiscountModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        subtotal={subtotal}
        currentType={discountType}
        currentValue={discountValue}
        taxRatePercent={taxRatePercent}
        onApply={(type, val) => {
          setDiscountType(type);
          setDiscountValue(val);
        }}
        onRemove={() => {
          setDiscountValue(0);
        }}
      />

      {/* Odoo-style Full Page Account Actions Grid */}
      {showAccountActions && (
        <AccountActionsPage
          onClose={handleCloseAccountActions}
          onLogout={logout}
          cartItemCount={cart.length}
          businessType={bKey}
        />
      )}
    </div>
  );
}

export default MasterPOS;
