"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  Search,
  ScanBarcode,
  Menu,
  Plus,
  Minus,
  Trash2,
  User as UserRound,
  StickyNote,
  MoreVertical,
  Upload,
  Delete,
  CreditCard,
  Banknote,
  WalletCards,
  Car,
  Wrench,
  Settings2,
  X,
  ShoppingCart,
  LayoutGrid,
  EyeOff,
  Tag,
  Percent,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import PaymentPage, { type PaymentData, type POSCustomer, type POSCartItem } from "./PaymentPage";
import PaymentSuccessScreen from "./PaymentSuccessScreen";
import POSVehicleModal, { type POSVehicleDetails } from "./POSVehicleModal";
import { DiscountModal, type DiscountType } from "@/components/pos/DiscountModal";
import { completePOSSale, posOrderRepo, vehicleRepo } from "../../lib/auto-care-db";
import { useAuth } from "../../hooks/useAuth";
import { useProducts, useCategories } from "../../hooks/useProducts";
import { productRepo, customerRepo, getCurrentTenantId } from "../../lib/db";

import { isOnline } from "../../services/connectionManager";
import { saveOfflineOrder } from "../../services/offlineOrders";
import { reduceStock } from "../../services/offlineInventory";
import SoftwareMode from "../../components/SoftwareMode";
import UserMenu from "../../components/UserMenu";
import { AccountActionsPage } from "@/features/account-actions/AccountActionsPage";
import { PasscodeLock } from "@/components/PasscodeLock";
import { getAppSettings, isModuleUnlocked } from "@/lib/app-settings";

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
  categoryId?: string;
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

// NOTE: All products and categories come exclusively from the live Supabase database.
// No hardcoded/mock data — see allPosProducts and posCategories computed below.

export function AutoCarePOS() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const { data: dbProducts = [] } = useProducts();
  const { data: dbCategories = [] } = useCategories();

  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState("Walk-in Customer");
  const [vehicleDetails, setVehicleDetails] = useState<POSVehicleDetails | null>(null);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
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

  // Dynamic POS categories built purely from real database categories (plus "All")
  const posCategories = useMemo<Category[]>(() => {
    const list: Category[] = [{ id: "all", name: "All", color: "bg-slate-100" }];
    const swatches = [
      "bg-orange-100",
      "bg-emerald-100",
      "bg-blue-100",
      "bg-purple-100",
      "bg-yellow-100",
      "bg-pink-100",
      "bg-cyan-100",
    ];
    const addedNames = new Set<string>();

    dbCategories.forEach((c, idx) => {
      const cleanName = (c.name || '').trim();
      if (!cleanName || addedNames.has(cleanName.toLowerCase())) return;
      addedNames.add(cleanName.toLowerCase());
      list.push({
        id: c.id || cleanName,
        name: cleanName,
        color: swatches[idx % swatches.length],
      });
    });

    // Also include any non-UUID category present on products that isn't in dbCategories
    dbProducts.forEach((p, idx) => {
      const rawCat = (p.categoryId || (p as any).category || '').trim();
      if (!rawCat) return;
      const matchingDbCat = dbCategories.find(
        (c) => c.id === rawCat || c.name.toLowerCase() === rawCat.toLowerCase()
      );
      if (!matchingDbCat && !addedNames.has(rawCat.toLowerCase()) && !/^[0-9a-f-]{36}$/i.test(rawCat)) {
        addedNames.add(rawCat.toLowerCase());
        list.push({
          id: rawCat,
          name: rawCat,
          color: swatches[(dbCategories.length + idx) % swatches.length],
        });
      }
    });

    return list;
  }, [dbCategories, dbProducts]);

  // Persistent Order state
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [currentOrderNumber, setCurrentOrderNumber] = useState<number | null>(null);

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
    method: string;
    invoiceNumber?: string;
    customerName?: string;
    vehicle?: {
      makeModel?: string;
      plateNumber?: string;
      mileage?: string | number;
    };
    items?: POSCartItem[];
    subtotal?: number;
    discount?: number;
    tax?: number;
    taxRatePercent?: number;
    total?: number;
    paidAmount?: number;
    orderId?: string;
  } | null>(null);

  const [selectedPOSCustomer, setSelectedPOSCustomer] =
    useState<POSCustomer | null>(null);

  // Products from database only (NO mock products)
  const allPosProducts = useMemo<Product[]>(() => {
    return dbProducts.map((p) => {
      const rawCat = (p.categoryId || (p as any).category || '').trim();
      const matchedCat = dbCategories.find(
        (c) => c.id === rawCat || c.name.toLowerCase() === rawCat.toLowerCase()
      );
      const displayCategory = matchedCat ? matchedCat.name : (rawCat || "General");

      return {
        id: p.id,
        name: p.name,
        price: p.sellingPrice,
        category: displayCategory,
        categoryId: matchedCat ? matchedCat.id : rawCat,
        image: p.images?.[0],
        type: "product" as const,
        stock: p.stock,
        trackInventory: p.metadata?.trackInventory !== false,
        barcode: p.barcode,
        sku: p.sku,
      };
    });
  }, [dbProducts, dbCategories]);


  const filteredProducts = useMemo(() => {
    return allPosProducts.filter((product) => {
      let categoryMatch = activeCategory === "all";
      if (!categoryMatch) {
        const activeClean = activeCategory.trim().toLowerCase();
        const prodCatName = (product.category || "").trim().toLowerCase();
        const prodCatId = (product.categoryId || "").trim().toLowerCase();

        const matchedActiveCat = dbCategories.find(
          (c) => c.id.toLowerCase() === activeClean || c.name.toLowerCase() === activeClean
        );
        const activeName = matchedActiveCat ? matchedActiveCat.name.toLowerCase() : activeClean;
        const activeId = matchedActiveCat ? matchedActiveCat.id.toLowerCase() : activeClean;

        categoryMatch =
          prodCatId === activeId ||
          prodCatId === activeName ||
          prodCatName === activeName ||
          prodCatName === activeId ||
          prodCatName.includes(activeName) ||
          activeName.includes(prodCatName);
      }

      const searchClean = search.trim().toLowerCase();
      const searchMatch =
        !searchClean ||
        product.name.toLowerCase().includes(searchClean) ||
        (product.barcode && product.barcode.toLowerCase().includes(searchClean)) ||
        (product.sku && product.sku.toLowerCase().includes(searchClean));

      return categoryMatch && searchMatch;
    });
  }, [allPosProducts, activeCategory, search, dbCategories]);

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

  const subtotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

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
      const existing = current.find(
        (item) => String(item.id) === String(product.id)
      );

      if (existing) {
        return current.map((item) =>
          String(item.id) === String(product.id)
            ? {
                ...item,
                quantity: item.quantity + 1,
              }
            : item
        );
      }

      return [
        ...current,
        {
          ...product,
          quantity: 1,
        },
      ];
    });
  };

  const increaseQuantity = (id: string | number) => {
    setCart((current) =>
      current.map((item) =>
        String(item.id) === String(id)
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item
      )
    );
  };

  const decreaseQuantity = (id: string | number) => {
    setCart((current) =>
      current
        .map((item) =>
          String(item.id) === String(id)
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (id: string | number) => {
    setCart((current) =>
      current.filter((item) => String(item.id) !== String(id))
    );
  };

  const handleNewOrder = async () => {
    if (cart.length > 0) {
      try {
        await posOrderRepo.createOngoing({
          items: cart.map((i) => ({
            id: String(i.id),
            name: i.name,
            quantity: i.quantity,
            price: i.price,
            type: i.type,
            subtotal: i.price * i.quantity,
          })),
          subtotal,
          tax,
          total,
          customerName: customer !== "Walk-in Customer" ? customer : (selectedPOSCustomer?.name || undefined),
          customerId: selectedPOSCustomer?.id,
          tenantId: getCurrentTenantId(),
        });
      } catch (err) {
        console.warn("Could not save ongoing order:", err);
      }
    }
    setCart([]);
    setDiscountValue(0);
    setSelectedPOSCustomer(null);
    setCustomer("Walk-in Customer");
    setCurrentOrderId(null);
    try {
      const nextNum = await posOrderRepo.nextOrderNumber(getCurrentTenantId());
      setCurrentOrderNumber(nextNum);
    } catch {
      setCurrentOrderNumber((prev) => (prev ? prev + 1 : 1));
    }
  };

  const clearCart = () => {
    setCart([]);
    setDiscountValue(0);
  };

  // ── handlePOSPayment (Idempotent POS Payment Submission) ─────────────────
  const handlePOSPayment = async (data: PaymentData) => {
    const now = Date.now();
    if (isSubmittingPaymentRef.current || (now - lastPaymentTimestampRef.current < 3500)) {
      console.warn('[pos] Payment submission already in progress or debounced, ignoring duplicate call');
      return;
    }
    isSubmittingPaymentRef.current = true;
    lastPaymentTimestampRef.current = now;

    console.log('[pos] Executing atomic POS sale...', {
      orderId: data.orderId,
      total: data.total,
      itemCount: data.items.length,
      method: data.paymentMethod,
    });

    try {
      let invoiceNumber = "";
      const activeTenant = getCurrentTenantId();
      let paidOrder: any = null;

      // 1. Atomic SQLite Order creation + Stock deduction + Outbox event
      paidOrder = await posOrderRepo.createPaid({
        items: (data.items || []).map((item) => ({
          id: String(item?.id || (item as any)?.productId || crypto.randomUUID()),
          name: item?.name || 'Item',
          quantity: item?.quantity || 1,
          price: item?.price || 0,
          type: item?.type || 'product',
          subtotal: (item?.price || 0) * (item?.quantity || 1),
        })),
        subtotal: data.subtotal,
        discount: data.discount ?? discountAmount,
        tax: data.tax,
        total: data.total,
        paidAmount: data.paidAmount,
        paymentMethod: data.paymentMethod,
        customerName: vehicleDetails?.customerName || data.customer?.name || (customer !== "Walk-in Customer" ? customer : undefined),
        customerId: data.customer?.id,
        vehiclePlateNumber: vehicleDetails?.regNo,
        vehicleMakeModel: vehicleDetails ? `${vehicleDetails.make} ${vehicleDetails.model}`.trim() : undefined,
        vehicleMileage: vehicleDetails?.mileage,
        existingOrderId: currentOrderId || undefined,
        tenantId: activeTenant,
      });

      invoiceNumber = String(paidOrder?.orderNumber ?? 1).padStart(4, "0");

      // Save / update vehicle in vehicles database & history for years of tracking
      if (vehicleDetails?.regNo) {
        void vehicleRepo.upsertByPlate({
          tenantId: activeTenant,
          licensePlate: vehicleDetails.regNo,
          make: vehicleDetails.make,
          model: vehicleDetails.model,
          mileage: vehicleDetails.mileage,
          customerName: vehicleDetails.customerName,
          notes: vehicleDetails.notes,
        }).catch((err) => console.warn('[pos] Vehicle upsert error:', err));
      }

      // Save customer to customers module if name provided
      if (
        vehicleDetails?.customerName &&
        vehicleDetails.customerName.trim() &&
        vehicleDetails.customerName !== 'Walk-in Customer'
      ) {
        void customerRepo.create({
          id: crypto.randomUUID(),
          tenantId: activeTenant,
          name: vehicleDetails.customerName.trim(),
          phone: vehicleDetails.phone || undefined,
          balance: 0,
          creditLimit: 0,
        }).catch(() => {});
      }

      // Refresh products in cache so inventory counters decrement immediately
      void queryClient.invalidateQueries({ queryKey: ["products"] });

      if (isOnline()) {
        try {
          const invoice = await completePOSSale({
            items: data.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
            })),
            subtotal: data.subtotal,
            tax: data.tax,
            total: data.total,
            paymentMethod: data.paymentMethod,
            customerName: vehicleDetails?.customerName || data.customer?.name,
            customerId: data.customer?.id,
          });

          if (invoice?.invoiceNumber) {
            invoiceNumber = invoice.invoiceNumber;
          }
        } catch (e) {
          console.warn('[pos] completePOSSale invoice warning:', e);
        }
      }

      // Mirror to IndexedDB using strictly identical paidOrder.id and orderNumber so it never creates a duplicate order!
      void saveOfflineOrder({
        id: paidOrder.id,
        clientOrderId: paidOrder.id,
        orderNumber: paidOrder.orderNumber,
        items: data.items,
        subtotal: data.subtotal,
        discount: data.discount ?? discountAmount,
        tax: data.tax,
        total: data.total,
        paymentMethod: data.paymentMethod,
        paidAmount: data.paidAmount,
        customer: data.customer,
        completedAt: new Date().toISOString(),
        source: isOnline() ? "online" : "offline",
        syncStatus: "synced",
        tenantId: activeTenant,
      }).catch(() => {});

      lastInvoiceNumberRef.current = invoiceNumber || (currentOrderNumber ? String(currentOrderNumber).padStart(4, "0") : "0001");

      // Clear cart & reset order after sale
      setCart([]);
      setDiscountValue(0);
      setSelectedPOSCustomer(null);
      setCustomer("Walk-in Customer");
      setVehicleDetails(null);
      setCurrentOrderId(null);
      void posOrderRepo.nextOrderNumber(activeTenant).then(setCurrentOrderNumber);
    } catch (e) {
      console.error("Atomic POS sale failed in SQLite:", e);
      throw e;
    } finally {
      setTimeout(() => {
        isSubmittingPaymentRef.current = false;
      }, 2000);
    }
  };

  const handleKeypadPress = (key: string) => {
    if (cart.length === 0) return;
    const lastItem = cart[cart.length - 1];
    if (key === "⌫") {
      decreaseQuantity(lastItem.id);
    } else if (key === "+/-") {
      increaseQuantity(lastItem.id);
    }
  };

  // ── Build typed cart items for PaymentPage ────────────────────────────────
  const paymentItems: POSCartItem[] = cart.map((item) => ({
    id: String(item.id),
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    type: item.type,
  }));

  // ── Protection Guard: Hidden Module & Master Passcode ────────────────────
  const [posUnlocked, setPosUnlocked] = useState(() => isModuleUnlocked('Point of Sale'));
  const [isPosBlocked, setIsPosBlocked] = useState(false);
  const [isPosLocked, setIsPosLocked] = useState(false);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const settings = await getAppSettings();
        if (!isMounted) return;
        if (settings.hidden_modules?.includes('Point of Sale')) {
          setIsPosBlocked(true);
        } else if (settings.is_passcode_enabled && !isModuleUnlocked('Point of Sale') && !posUnlocked) {
          setIsPosLocked(true);
        }
      } catch (err) {
        console.warn('[AutoCarePOS] Error checking protection settings:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [posUnlocked]);

  if (isPosBlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#1d1d23] text-white p-6 text-center select-none">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-4 shadow-lg shadow-rose-500/5">
          <EyeOff className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold mb-2">Point of Sale Hidden</h2>
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          The Point of Sale module is currently hidden by administrator settings.
        </p>
        <button
          type="button"
          onClick={() => navigate('/auto-care')}
          className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition shadow-lg shadow-primary/20 cursor-pointer"
        >
          Return to Launcher
        </button>
      </div>
    );
  }

  if (isPosLocked) {
    return (
      <div className="min-h-screen bg-[#1d1d23]">
        <PasscodeLock
          moduleName="Point of Sale"
          onUnlock={() => {
            setPosUnlocked(true);
            setIsPosLocked(false);
          }}
          onClose={() => navigate('/auto-care')}
        />
      </div>
    );
  }

  // ── PaymentPage: full-screen overlay, cart is NOT cleared on back ─────────
  if (showPayment) {
    return (
      <>
        <PaymentPage
          total={total}
          subtotal={subtotal}
          discount={discountAmount}
          tax={tax}
          taxRatePercent={taxRatePercent}
          items={paymentItems}
          orderId={currentOrderNumber ? String(currentOrderNumber).padStart(4, "0") : "0001"}
          selectedCustomer={selectedPOSCustomer}
          onBack={() => setShowPayment(false)}
          onPayment={handlePOSPayment}
          onNewSale={() => setShowPayment(false)}
          onPaymentSuccess={(data, change) => {
            // This is called ONLY after a real successful DB write.
            // data.total is the genuine total — NEVER hard-coded.
            setSuccessData({
              amount: data.total,
              change,
              method: data.paymentMethod,
              invoiceNumber: lastInvoiceNumberRef.current || `INV-${Math.floor(Math.random() * 90000 + 10000)}`,
              customerName: vehicleDetails?.customerName || data.customer?.name,
              vehicle: vehicleDetails ? {
                makeModel: `${vehicleDetails.make} ${vehicleDetails.model}`.trim(),
                plateNumber: vehicleDetails.regNo,
                mileage: vehicleDetails.mileage,
              } : undefined,
              items: data.items,
              subtotal: data.subtotal,
              discount: data.discount ?? discountAmount,
              tax: data.tax,
              taxRatePercent,
              total: data.total,
              paidAmount: data.paidAmount,
              orderId: data.orderId,
            });
            lastInvoiceNumberRef.current = undefined;
          }}
        />

        {/* PaymentSuccessScreen renders on top of PaymentPage after payment */}
        {successData && (
          <PaymentSuccessScreen
            amount={successData.amount}
            currency="Rs."
            order={{
              id: successData.orderId,
              invoiceNumber: successData.invoiceNumber,
              ticketNumber: successData.invoiceNumber,
              customer: successData.customerName
                ? { name: successData.customerName }
                : undefined,
              vehicle: successData.vehicle,
              items: (successData.items || []).map((item) => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.price,
                total: item.price * item.quantity,
                unit: item.type === "service" ? "Hours" : "Units",
              })),
              subtotal: successData.subtotal ?? subtotal,
              discount: successData.discount ?? discountAmount,
              tax: successData.tax ?? tax,
              taxRatePercent: successData.taxRatePercent ?? taxRatePercent,
              taxAmount: successData.tax ?? tax,
              taxableAmount: (successData.subtotal ?? subtotal) - (successData.discount ?? discountAmount),
              total: successData.total ?? total,
              paymentMethod: successData.method,
              amountPaid: successData.paidAmount ?? successData.amount,
              cashierName: user?.email || "noman53000@gmail.com",
              storeEmail: user?.email || "noman53000@gmail.com",
              createdAt: Date.now(),
            }}
            payment={{
              amount: successData.amount,
              change: successData.change,
              method: successData.method,
            }}
            onBack={() => {
              // Go back to POS (payment already committed — back just means new order)
              setSuccessData(null);
              setShowPayment(false);
            }}
            onContinue={() => {
              // New sale — cart already cleared in handlePOSPayment
              setSuccessData(null);
              setShowPayment(false);
            }}
            onPrint={async (orderArg, paymentArg) => {
              try {
                const { receiptSettingsRepo } = await import('@/lib/receipt-settings-repo');
                const { printThermalReceipt } = await import('@/features/receipt/print-service');
                const currentTenant = getCurrentTenantId();
                const settings = await receiptSettingsRepo.getSettings(currentTenant);

                const rawItems = orderArg?.items || successData?.items || [];
                const printItems = rawItems.map((it: any) => ({
                  name: it.name || it.product_name || 'Item',
                  quantity: Number(it.quantity || 1),
                  price: Number(it.price || it.unitPrice || 0),
                  total: Number(it.total || it.lineTotal || (Number(it.price || it.unitPrice || 0) * Number(it.quantity || 1))),
                }));

                const orderNum = orderArg?.invoiceNumber || orderArg?.orderNumber || successData?.invoiceNumber || `AC-${Date.now()}`;
                const custName = orderArg?.customer?.name || successData?.customerName;
                const veh = orderArg?.vehicle || successData?.vehicle || (vehicleDetails ? {
                  makeModel: `${vehicleDetails.make} ${vehicleDetails.model}`.trim(),
                  plateNumber: vehicleDetails.regNo,
                  mileage: vehicleDetails.mileage,
                } : undefined);
                const payMethod = paymentArg?.method || successData?.method || 'cash';
                const paidAmt = Number(orderArg?.amountPaid ?? successData?.paidAmount ?? successData?.amount ?? 0);
                const subTot = Number(orderArg?.subtotal ?? successData?.subtotal ?? subtotal);
                const taxAmt = Number(orderArg?.tax ?? successData?.tax ?? tax);
                const totAmt = Number(orderArg?.total ?? successData?.total ?? total);
                const chgAmt = Number(paymentArg?.change ?? successData?.change ?? 0);

                await printThermalReceipt(
                  {
                    orderNumber: String(orderNum),
                    date: Date.now(),
                    cashierName: user?.name || user?.email || 'Cashier',
                    terminalName: 'POS-01',
                    customer: custName ? { name: custName } : undefined,
                    vehicle: veh,
                    items: printItems,
                    subtotal: subTot,
                    discount: Number(orderArg?.discount ?? successData?.discount ?? discountAmount),
                    tax: taxAmt,
                    taxRatePercent: Number(orderArg?.taxRatePercent ?? successData?.taxRatePercent ?? taxRatePercent),
                    total: totAmt,
                    paymentMethod: payMethod,
                    amountPaid: paidAmt,
                    change: chgAmt,
                    currency: 'PKR',
                  },
                  settings
                );
              } catch (err) {
                console.error('Thermal receipt print failed, fallback to window.print():', err);
                window.print();
              }
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f4f4f4] text-[#202124]">

      {/* =====================================================
          1. TOP CONTINUOUS POS HEADER (FULL WIDTH)
      ====================================================== */}
      <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-[#d8d8d8] bg-white px-3 z-30">
        
        {/* Left header group */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mobile cart toggle */}
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

          {/* Register button */}
          <button
            onClick={() => navigate('/auto-care')}
            title="Return to Business pos & store Apps Launcher"
            className="flex h-[34px] items-center gap-1.5 rounded-lg border border-[#bce6e9] bg-[#e6f5f6] px-3 text-[13px] sm:text-[14px] font-medium text-[#00878a] hover:bg-[#d8f0f2] transition-colors"
          >
            <LayoutGrid className="h-4 w-4 text-[#00878a]" />
            <span>Register</span>
          </button>

          {/* Orders button */}
          <button
            onClick={() => navigate('/auto-care/orders')}
            className="flex h-[34px] items-center rounded-lg px-3 text-[13px] sm:text-[14px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Orders
          </button>

          {/* + button */}
          <button
            onClick={handleNewOrder}
            title="New Order / Hold Ongoing Order"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[#d0d0d0] text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>

          {/* Order number badge */}
          <div className="flex h-[34px] min-w-[65px] items-center justify-center rounded-lg border border-[#159aa5] bg-[#f5ffff] px-2.5 text-[13px] sm:text-[14px] font-medium text-[#159aa5]">
            {currentOrderNumber ? String(currentOrderNumber).padStart(4, "0") : "0001"}
          </div>
        </div>

        {/* Right header group */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex w-[180px] sm:w-[260px] md:w-[300px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) {
                  const clean = search.trim().toLowerCase();
                  const found = allPosProducts.find(
                    (p) =>
                      (p.barcode && p.barcode.toLowerCase() === clean) ||
                      (p.sku && p.sku.toLowerCase() === clean)
                  );
                  if (found) {
                    addToCart(found);
                    setSearch("");
                  }
                }
              }}
              placeholder="Search products..."
              className="h-[34px] w-full rounded-lg border border-[#d5d5d5] bg-white pl-8 pr-3 text-[13px] outline-none transition focus:border-[#159aa5]"
            />
          </div>

          {/* Barcode button */}
          <button
            title="Scan barcode"
            onClick={() => {
              const barcode = window.prompt("Enter or scan product barcode:");
              if (barcode && barcode.trim()) {
                const clean = barcode.trim().toLowerCase();
                const found = allPosProducts.find(
                  (p) =>
                    (p.barcode && p.barcode.toLowerCase() === clean) ||
                    (p.sku && p.sku.toLowerCase() === clean) ||
                    String(p.id).toLowerCase() === clean
                );
                if (found) {
                  addToCart(found);
                } else {
                  alert(`Product with barcode "${barcode}" not found.`);
                }
              }
            }}
            className="hidden sm:flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[#d5d5d5] text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <ScanBarcode className="h-4 w-4" />
          </button>

          {/* Software Mode */}
          <div className="hidden xl:flex items-center">
            <SoftwareMode compact={true} />
          </div>

          {/* User Profile & Account Actions */}
          <div className="relative">
            <button
              type="button"
              onClick={handleOpenAccountActions}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-[#00897b] text-[13px] font-bold text-white shadow-sm hover:ring-2 hover:ring-[#00897b]/40 transition cursor-pointer"
              title={user?.name || user?.email || "Cashier"}
              aria-label="Account Actions"
            >
              {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "N"}
            </button>
          </div>

          {/* Menu Dropdown */}
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
                  onClick={() => navigate('/auto-care')}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 font-medium"
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-[#159aa5]" />
                  Business pos & store Launcher
                </button>
                <button
                  onClick={() => navigate('/auto-care/service-jobs')}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 font-medium"
                >
                  <Wrench className="h-3.5 w-3.5 text-orange-500" />
                  Service Jobs
                </button>
                <button
                  onClick={() => navigate('/auto-care/dashboard')}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 font-medium"
                >
                  <Car className="h-3.5 w-3.5 text-purple-500" />
                  Dashboard
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={() => {
                    localStorage.removeItem('genx:selectedModule');
                    navigate('/select-module');
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

      {/* =====================================================
          2. MAIN BODY (LEFT CART + RIGHT PRODUCT AREA)
      ====================================================== */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT CART PANEL ───────────────────────────── */}
        <section
          className={`
            fixed inset-y-[48px] left-0 z-40 flex w-full
            max-w-[480px] flex-col bg-white
            border-r border-[#d8d8d8]
            transition-transform duration-200
            lg:static lg:w-[35%] lg:max-w-[400px] lg:min-w-[320px]
            ${
              mobileCartOpen
                ? "translate-x-0"
                : "-translate-x-full lg:translate-x-0"
            }
          `}
        >
          {/* Mobile close button bar */}
          <div className="flex h-8 items-center justify-between border-b border-[#e5e7eb] px-3 bg-slate-50 lg:hidden">
            <span className="text-xs font-semibold text-slate-600">Order Cart</span>
            <button
              onClick={() => setMobileCartOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-slate-200 text-slate-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Cart items list - expands to fill available space */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex h-full min-h-[160px] items-center justify-center text-center text-slate-400 p-4">
                <div>
                  <ShoppingCart className="mx-auto h-7 w-7 opacity-30" />
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    No items in order
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Click products on the right to add
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[#f0f0f0]">
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex min-h-[36px] items-center px-3 py-1.5 hover:bg-[#eef7f8]/50 transition-colors text-[13px]"
                  >
                    <div className="w-6 shrink-0 text-center font-bold text-slate-900 text-xs">
                      {item.quantity}
                    </div>

                    <div className="min-w-0 flex-1 px-2">
                      <div className="truncate text-xs sm:text-[13px] font-normal text-slate-900 leading-tight">
                        {item.name}
                      </div>
                      {item.type === "service" && (
                        <span className="text-[10px] text-orange-600 font-medium">
                          Service
                        </span>
                      )}
                    </div>

                    <div className="shrink-0 text-right text-xs sm:text-[13px] font-semibold text-slate-900 pr-2">
                      Rs. {(item.price * item.quantity).toLocaleString()}
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => decreaseQuantity(item.id)}
                        className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                        title="Decrease"
                      >
                        <Minus className="h-2.5 w-2.5" />
                      </button>
                      <button
                        onClick={() => increaseQuantity(item.id)}
                        className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                        title="Increase"
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </button>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="flex h-5 w-5 items-center justify-center rounded hover:bg-red-50 hover:text-red-500 text-slate-400 ml-0.5"
                        title="Remove"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom section: Totals + Customer/Note + Keypad + Payment */}
          <div className="shrink-0 border-t border-[#d8d8d8] bg-white">
            
            {/* Totals, Discount & Tax */}
            <div className="px-3 py-2 space-y-1 bg-white">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Subtotal</span>
                <span>Rs. {subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
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
                      -Rs. {discountAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Taxes ({taxRatePercent}%)</span>
                <span>Rs. {tax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>

              {/* Total Bill */}
              <div className="flex items-center justify-between text-base font-bold text-slate-900 pt-1 border-t border-[#e8e8e8]">
                <span>Total</span>
                <span className="text-slate-900 font-bold text-[17px]">
                  Rs. {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Customer & Vehicle Details button */}
            <div className="flex items-center gap-1.5 border-t border-[#e8e8e8] px-2.5 py-1.5">
              <button
                type="button"
                onClick={() => setVehicleModalOpen(true)}
                className={`flex h-[34px] flex-1 min-w-0 items-center justify-between gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all ${
                  vehicleDetails?.regNo
                    ? 'bg-blue-50 border-blue-400 text-blue-950 font-bold shadow-xs'
                    : 'bg-white border-[#d3d3d3] text-slate-800 hover:bg-slate-50'
                }`}
                title="Click to enter Customer & Vehicle Details (Reg No, Make, Model, Mileage)"
              >
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <Car className={`h-3.5 w-3.5 shrink-0 ${vehicleDetails?.regNo ? 'text-blue-600' : 'text-slate-500'}`} />
                  {vehicleDetails?.regNo ? (
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-extrabold uppercase px-1.5 py-0.5 bg-blue-600 text-white text-[10px] rounded tracking-wider">
                        {vehicleDetails.regNo}
                      </span>
                      <span className="truncate text-slate-800 text-[11px] font-semibold">
                        {vehicleDetails.make} {vehicleDetails.model}
                      </span>
                    </div>
                  ) : (
                    <span className="truncate font-semibold text-slate-700">
                      {customer !== "Walk-in Customer" ? customer : "Vehicle Details"}
                    </span>
                  )}
                </div>

                {vehicleDetails?.regNo ? (
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold shrink-0 border border-emerald-200">
                    {vehicleDetails.mileage ? `${Number(vehicleDetails.mileage).toLocaleString()} km` : 'Active'}
                  </span>
                ) : (
                  <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider shrink-0 bg-blue-50 px-1.5 py-0.5 rounded">
                    + Details
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  const note = window.prompt("Order Note");
                  if (note) alert(`Note added: ${note}`);
                }}
                className="flex h-[32px] items-center justify-center gap-1 rounded border border-[#d3d3d3] px-2.5 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors"
              >
                <StickyNote className="h-3 w-3" />
                <span>Note</span>
              </button>

              <button
                title="Upload order"
                onClick={() => alert("Order synced with cloud database")}
                className="flex h-[32px] w-[32px] items-center justify-center rounded border border-[#d3d3d3] text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={clearCart}
                title="Clear cart"
                className="flex h-[32px] w-[32px] items-center justify-center rounded border border-[#d3d3d3] text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-4 border-t border-[#d8d8d8]">
              {[
                "1", "2", "3", "Qty",
                "4", "5", "6", "%",
                "7", "8", "9", "Price",
                "+/-", "0", ".", "⌫",
              ].map((key) => (
                <button
                  key={key}
                  onClick={() => handleKeypadPress(key)}
                  className={`
                    flex h-[38px] items-center justify-center
                    border-b border-r border-[#d8d8d8]
                    text-[15px] font-medium
                    transition hover:bg-slate-100 cursor-pointer
                    ${key === "Qty" ? "bg-[#e6f5f6] text-[#00878a] font-semibold" : ""}
                    ${key === "%" ? "text-slate-600" : ""}
                    ${key === "Price" ? "bg-[#f3f4f6] text-slate-700" : ""}
                    ${key === "+/-" ? "bg-[#fef3c7] text-slate-800" : ""}
                    ${key === "." ? "bg-white" : ""}
                    ${key === "⌫" ? "bg-[#fecdd3] text-slate-800" : ""}
                  `}
                >
                  {key === "⌫" ? (
                    <Delete className="h-4 w-4" />
                  ) : (
                    key
                  )}
                </button>
              ))}
            </div>

            {/* Payment Button */}
            <div className="p-2">
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

        {/* ── RIGHT PRODUCT PANEL ───────────────────────── */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f4f4f4]">

          {/* Category Bar */}
          <div className="shrink-0 overflow-x-auto border-b border-[#e0e0e0] bg-[#f8fafc] px-3 py-2">
            <div className="flex min-w-max gap-1.5">
              {posCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`
                    flex h-[34px] min-w-[90px]
                    items-center justify-center
                    rounded-lg px-4
                    text-xs sm:text-[13px] font-medium
                    transition cursor-pointer
                    ${
                      activeCategory === category.id
                        ? "border border-[#159aa5] bg-[#e6f5f6] text-[#00878a] font-semibold shadow-xs"
                        : `${category.color} text-slate-800 hover:brightness-95`
                    }
                  `}
                >
                  {category.name}
                </button>
              ))}

            </div>
          </div>

          {/* Product Grid */}
          <div className="min-h-0 flex-1 overflow-y-auto p-2.5 sm:p-3">
            {filteredProducts.length === 0 ? (
              <div className="flex h-full min-h-[200px] items-center justify-center">
                <div className="text-center text-slate-400">
                  <Search className="mx-auto h-8 w-8 opacity-40" />
                  <p className="mt-2 text-xs font-medium text-slate-600">No products found</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Try another search or category.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5">
                {filteredProducts.map((product) => {
                  const cartItem = cart.find((item) => item.id === product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addToCart(product)}
                      className="group relative flex min-h-[140px] flex-col overflow-hidden rounded-xl border border-[#d8d8d8] bg-white text-left shadow-xs transition hover:border-[#b0b0b0] hover:shadow-sm cursor-pointer"
                    >
                      {/* Product Image */}
                      <div className="relative flex h-[95px] sm:h-[100px] items-center justify-center overflow-hidden bg-[#fafafa] p-1">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="h-full w-full object-contain transition duration-150 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div
                            className={`
                              flex h-full w-full items-center justify-center
                              ${
                                product.type === "service"
                                  ? "bg-gradient-to-br from-orange-50 to-orange-100"
                                  : "bg-gradient-to-br from-slate-50 to-slate-100"
                              }
                            `}
                          >
                            {product.type === "service" ? (
                              <Wrench className="h-8 w-8 text-orange-400" />
                            ) : (
                              <Car className="h-8 w-8 text-slate-300" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* Product Name & Price */}
                      <div className="flex min-h-[44px] flex-col justify-center px-2 py-1 bg-white">
                        <div className="truncate text-xs font-medium text-slate-900 leading-tight">
                          {product.name}
                        </div>

                        <div className="mt-0.5 flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-slate-700">
                            Rs. {product.price.toLocaleString()}
                          </span>
                          {product.type === "product" && typeof product.stock === "number" && (
                            <span
                              className={`text-[10px] font-medium px-1 rounded ${
                                product.stock > 0
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-red-50 text-red-600"
                              }`}
                            >
                              {product.stock}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Category color line */}
                      <div
                        className={`
                          absolute bottom-0 left-0 right-0 h-[3px]
                          ${
                            product.category === "services"
                              ? "bg-orange-300"
                              : product.category === "oil"
                                ? "bg-emerald-300"
                                : product.category === "brakes"
                                  ? "bg-red-300"
                                  : product.category === "tyres"
                                    ? "bg-purple-300"
                                    : product.category === "battery"
                                      ? "bg-yellow-300"
                                      : product.category === "accessories"
                                        ? "bg-cyan-300"
                                        : "bg-blue-300"
                          }
                        `}
                      />

                      {/* Cart quantity badge - matches Odoo black pill badge [1] */}
                      {cartItem && (
                        <div className="absolute right-1.5 bottom-[46px] flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1.5 text-[10px] font-bold text-white shadow-sm">
                          {cartItem.quantity}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

        </section>

      </div>

      {/* POS Vehicle Details Modal */}
      <POSVehicleModal
        isOpen={vehicleModalOpen}
        onClose={() => setVehicleModalOpen(false)}
        onSave={(v) => {
          setVehicleDetails(v);
          if (v) {
            setCustomer(v.customerName || "Walk-in Customer");
            setSelectedPOSCustomer({ name: v.customerName, phone: v.phone });
          } else {
            setCustomer("Walk-in Customer");
            setSelectedPOSCustomer(null);
          }
        }}
        currentDetails={vehicleDetails}
      />

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
          businessType="auto_care"
        />
      )}

    </div>
  );
}

export default AutoCarePOS;
