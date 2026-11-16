"use client";

import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  Search,
  ScanBarcode,
  Menu,
  Plus,
  Minus,
  Trash2,
  StickyNote,
  MoreVertical,
  Upload,
  Delete,
  X,
  ShoppingCart,
  LayoutGrid,
  Tag,
  Pill,
  User,
  AlertTriangle,
  RotateCw,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PaymentPage, { type PaymentData, type POSCustomer, type POSCartItem } from "../auto-care/PaymentPage";
import PaymentSuccessScreen from "../auto-care/PaymentSuccessScreen";
import { DiscountModal, type DiscountType } from "@/components/pos/DiscountModal";
import { PharmacyCustomerModal, type SelectedCustomerDetails } from "./PharmacyCustomerModal";
import {
  pharmacyDb,
  subscribeToPharmacyRealtime,
  getAuthBusinessId,
  type Medicine,
  type PharmacySettingsConfig,
} from "./pharmacyData";
import { savePendingOrder } from "@/services/pendingOrders";
import { useAuth } from "@/hooks/useAuth";
import SoftwareMode from "@/components/SoftwareMode";

type Category = {
  id: string;
  name: string;
  color: string;
};

type CartItem = {
  id: string;
  name: string;
  genericName?: string;
  price: number;
  category: string;
  dosageForm?: string;
  strength?: string;
  stock: number;
  batchNumber?: string;
  expiryDate?: string;
  barcode?: string;
  sku?: string;
  quantity: number;
};

export function PharmacyPOS() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, logout } = useAuth();

  // State
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [settings, setSettings] = useState<PharmacySettingsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomerDetails | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [currentOrderNumber, setCurrentOrderNumber] = useState<string>("0001");

  // Payment states
  const [showPayment, setShowPayment] = useState(false);
  const isSubmittingPaymentRef = useRef(false);
  const lastPaymentTimestampRef = useRef<number>(0);
  const lastInvoiceNumberRef = useRef<string | undefined>(undefined);

  const [successData, setSuccessData] = useState<{
    amount: number;
    change: number;
    method: string;
    invoiceNumber: string;
    customerName?: string;
    customerPhone?: string;
    items?: POSCartItem[];
    subtotal?: number;
    discount?: number;
    tax?: number;
    taxRatePercent?: number;
    total?: number;
    paidAmount?: number;
    orderId?: string;
  } | null>(null);

  // Discount & Tax state
  const [discountType, setDiscountType] = useState<DiscountType>("percent");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [taxRatePercent, setTaxRatePercent] = useState<number>(0);

  // Load medicines and settings LIVE from Supabase
  const loadPharmacyData = useCallback(async () => {
    try {
      const [meds, conf, nextInv] = await Promise.all([
        pharmacyDb.getMedicines(),
        pharmacyDb.getSettings().catch(() => null),
        pharmacyDb.nextInvoiceNumber().catch(() => "0001"),
      ]);
      setMedicines(meds);
      if (conf) {
        setSettings(conf);
        setTaxRatePercent(Number(conf.taxRatePercent || 0));
      }
      setCurrentOrderNumber(nextInv);
    } catch (err: any) {
      console.warn("[PharmacyPOS] Error loading pharmacy data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void loadPharmacyData();

    // Subscribe to Supabase Realtime changes
    let unsubRealtime: () => void = () => {};
    void getAuthBusinessId()
      .then((bId) => {
        if (!mounted) return;
        unsubRealtime = subscribeToPharmacyRealtime(bId, (table) => {
          console.log(`[PharmacyPOS] Realtime update on table: ${table}`);
          void loadPharmacyData();
        });
      })
      .catch(() => {});

    // Listen for custom window events dispatched within this browser tab
    const handleMedChanged = () => void loadPharmacyData();
    const handleSaleDone = () => void loadPharmacyData();
    window.addEventListener("pharmacy:medicine-changed", handleMedChanged);
    window.addEventListener("pharmacy:sale-completed", handleSaleDone);

    return () => {
      mounted = false;
      unsubRealtime();
      window.removeEventListener("pharmacy:medicine-changed", handleMedChanged);
      window.removeEventListener("pharmacy:sale-completed", handleSaleDone);
    };
  }, [loadPharmacyData]);

  // Dynamic POS categories built purely from real medicines
  const posCategories = useMemo<Category[]>(() => {
    const list: Category[] = [{ id: "all", name: "All Medicines", color: "bg-slate-100" }];
    const swatches = [
      "bg-teal-100",
      "bg-blue-100",
      "bg-emerald-100",
      "bg-purple-100",
      "bg-orange-100",
      "bg-amber-100",
      "bg-cyan-100",
      "bg-rose-100",
    ];
    const added = new Set<string>();

    medicines.forEach((m, idx) => {
      const cat = (m.category || m.dosageForm || "").trim();
      if (!cat || added.has(cat.toLowerCase())) return;
      added.add(cat.toLowerCase());
      list.push({
        id: cat,
        name: cat,
        color: swatches[list.length % swatches.length],
      });
    });

    return list;
  }, [medicines]);

  // Filter medicines by active category and search
  const now = new Date();
  const filteredProducts = useMemo(() => {
    return medicines.filter((m) => {
      const catMatch =
        activeCategory === "all" ||
        m.category?.toLowerCase() === activeCategory.toLowerCase() ||
        m.dosageForm?.toLowerCase() === activeCategory.toLowerCase();

      const searchClean = search.trim().toLowerCase();
      const searchMatch =
        !searchClean ||
        m.name.toLowerCase().includes(searchClean) ||
        m.genericName.toLowerCase().includes(searchClean) ||
        (m.barcode && m.barcode.toLowerCase().includes(searchClean)) ||
        (m.batchNumber && m.batchNumber.toLowerCase().includes(searchClean)) ||
        (m.sku && m.sku.toLowerCase().includes(searchClean));

      return catMatch && searchMatch;
    });
  }, [medicines, activeCategory, search]);

  // Cart totals calculation
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const discountAmount = useMemo(() => {
    if (discountValue <= 0 || subtotal <= 0) return 0;
    if (discountType === "percent") {
      return (subtotal * Math.min(100, discountValue)) / 100;
    }
    return Math.min(subtotal, discountValue);
  }, [subtotal, discountType, discountValue]);

  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const tax = (discountedSubtotal * Math.max(0, taxRatePercent)) / 100;
  const total = discountedSubtotal + tax;

  // Cart operations
  const addToCart = (med: Medicine) => {
    // Check out of stock
    if (Number(med.stock || 0) <= 0) {
      alert(`Out of Stock: "${med.name}" has 0 stock remaining. Sale is blocked.`);
      return;
    }

    // Check expiry
    if (med.expiryDate && new Date(med.expiryDate) <= now) {
      alert(`Expired Medicine: "${med.name}" expired on ${med.expiryDate}. Sale is strictly blocked.`);
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => String(item.id) === String(med.id));
      if (existing) {
        if (existing.quantity >= med.stock) {
          alert(`Stock Limit Reached: Only ${med.stock} units of "${med.name}" are in stock.`);
          return current;
        }
        return current.map((item) =>
          String(item.id) === String(med.id)
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...current,
        {
          id: med.id,
          name: med.name,
          genericName: med.genericName,
          price: med.sellingPrice,
          category: med.category || "General",
          dosageForm: med.dosageForm,
          strength: med.strength,
          stock: med.stock,
          batchNumber: med.batchNumber,
          expiryDate: med.expiryDate,
          barcode: med.barcode,
          sku: med.sku,
          quantity: 1,
        },
      ];
    });
  };

  const increaseQuantity = (id: string) => {
    setCart((current) =>
      current.map((item) => {
        if (String(item.id) === String(id)) {
          if (item.quantity >= item.stock) {
            alert(`Stock Limit: Only ${item.stock} units available in inventory.`);
            return item;
          }
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      })
    );
  };

  const decreaseQuantity = (id: string) => {
    setCart((current) =>
      current
        .map((item) =>
          String(item.id) === String(id)
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (id: string) => {
    setCart((current) => current.filter((item) => String(item.id) !== String(id)));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountValue(0);
  };

  const handleNewOrder = async () => {
    setCart([]);
    setDiscountValue(0);
    setSelectedCustomer(null);
    try {
      const nextNum = await pharmacyDb.nextInvoiceNumber();
      setCurrentOrderNumber(nextNum);
    } catch {
      setCurrentOrderNumber("0001");
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

  // Atomic POS Sale Submission (Handles all 12 modules)
  const handlePOSPayment = async (data: PaymentData) => {
    const timestamp = Date.now();
    if (isSubmittingPaymentRef.current || timestamp - lastPaymentTimestampRef.current < 500) {
      console.warn("[PharmacyPOS] Duplicate submission blocked");
      return;
    }
    isSubmittingPaymentRef.current = true;
    lastPaymentTimestampRef.current = timestamp;

    try {
      const customerName =
        selectedCustomer?.name && selectedCustomer.name !== "Walk-in Customer"
          ? selectedCustomer.name
          : data.customer?.name || "Walk-in Customer";

      const customerPhone =
        selectedCustomer?.phone || data.customer?.phone || undefined;

      let createdSale: any = null;
      const isOff = typeof navigator !== "undefined" ? !navigator.onLine : false;

      if (!isOff) {
        try {
          createdSale = await pharmacyDb.createSale({
            invoiceNumber: currentOrderNumber,
            customerName,
            customerPhone,
            customerId: selectedCustomer?.id || data.customer?.id,
            items: cart.map((it) => ({
              id: it.id,
              name: it.name,
              quantity: it.quantity,
              price: it.price,
              batchNumber: it.batchNumber,
              expiryDate: it.expiryDate,
              subtotal: it.price * it.quantity,
              type: "product" as const,
            })),
            subtotal: data.subtotal,
            discount: data.discount ?? discountAmount,
            tax: data.tax,
            totalAmount: data.total,
            paidAmount: data.paidAmount,
            paymentMethod: data.paymentMethod === "cash" ? "Cash" : data.paymentMethod === "credit" ? "Credit" : "Card",
          });
        } catch (serverErr) {
          console.warn("[PharmacyPOS] Server sale failed, saving offline:", serverErr);
        }
      }

      if (!createdSale) {
        const localInvoiceNumber = currentOrderNumber || `PH-${Date.now().toString().slice(-4)}`;
        createdSale = {
          id: `ph-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          invoiceNumber: localInvoiceNumber,
          customerName,
          customerPhone,
          customerId: selectedCustomer?.id || data.customer?.id,
          items: cart.map((it) => ({
            id: it.id,
            name: it.name,
            quantity: it.quantity,
            price: it.price,
            batchNumber: it.batchNumber,
            expiryDate: it.expiryDate,
            subtotal: it.price * it.quantity,
            type: "product" as const,
          })),
          subtotal: data.subtotal,
          discount: data.discount ?? discountAmount,
          tax: data.tax,
          totalAmount: data.total,
          total: data.total,
          paidAmount: data.paidAmount,
          paymentMethod: data.paymentMethod === "cash" ? "Cash" : data.paymentMethod === "credit" ? "Credit" : "Card",
          createdAt: new Date().toISOString(),
          status: "pending",
        };

        void savePendingOrder({
          ...createdSale,
          total: data.total,
          timestamp: Date.now(),
          status: "pending",
        }).catch((err) => console.warn('[PharmacyPOS] savePendingOrder error:', err));
      }

      lastInvoiceNumberRef.current = createdSale.invoiceNumber;

      // Update local state and clear cart
      setCart([]);
      setDiscountValue(0);
      setSelectedCustomer(null);
      void loadPharmacyData().catch(() => {});
    } catch (err: any) {
      console.error("[PharmacyPOS] Sale transaction failed:", err);
      alert(`Sale Failed: ${err.message || "Please check connection"}`);
      throw err;
    } finally {
      isSubmittingPaymentRef.current = false;
    }
  };

  // Build typed cart items for PaymentPage
  const paymentItems: POSCartItem[] = cart.map((item) => ({
    id: String(item.id),
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    type: "product" as const,
  }));

  // Payment overlay screen
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
          orderId={currentOrderNumber}
          selectedCustomer={
            selectedCustomer
              ? { id: selectedCustomer.id, name: selectedCustomer.name, phone: selectedCustomer.phone }
              : null
          }
          onBack={() => setShowPayment(false)}
          onPayment={handlePOSPayment}
          onNewSale={() => setShowPayment(false)}
          onPaymentSuccess={(data, change) => {
            const invoiceStr = lastInvoiceNumberRef.current || currentOrderNumber || "0001";
            setSuccessData({
              amount: data.total,
              change,
              method: data.paymentMethod,
              invoiceNumber: invoiceStr,
              customerName: selectedCustomer?.name || data.customer?.name || "Walk-in Customer",
              customerPhone: selectedCustomer?.phone || data.customer?.phone,
              items: data.items,
              subtotal: data.subtotal,
              discount: data.discount ?? discountAmount,
              tax: data.tax,
              taxRatePercent,
              total: data.total,
              paidAmount: data.paidAmount,
              orderId: invoiceStr,
            });
            lastInvoiceNumberRef.current = undefined;
          }}
        />

        {successData && (
          <PaymentSuccessScreen
            amount={successData.amount}
            currency="Rs."
            order={{
              id: successData.orderId,
              invoiceNumber: successData.invoiceNumber,
              ticketNumber: successData.invoiceNumber,
              customer: {
                name: successData.customerName,
                phone: successData.customerPhone,
              },
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
              taxAmount: successData.tax ?? tax,
              taxableAmount: (successData.subtotal ?? subtotal) - (successData.discount ?? discountAmount),
              total: successData.total ?? total,
              paymentMethod: successData.method,
              amountPaid: successData.paidAmount ?? successData.amount,
              cashierName: user?.email || "Pharmacist",
              storeEmail: settings?.email || user?.email || "pharmacy@genxpos.com",
              createdAt: Date.now(),
            }}
            payment={{
              amount: successData.amount,
              change: successData.change,
              method: successData.method,
            }}
            onBack={() => {
              setSuccessData(null);
              setShowPayment(false);
            }}
            onContinue={() => {
              setSuccessData(null);
              setShowPayment(false);
            }}
            onPrint={async (orderArg, paymentArg) => {
              try {
                const { printThermalReceipt } = await import("@/features/receipt/print-service");
                const rawItems = orderArg?.items || successData?.items || [];
                const printItems = rawItems.map((it: any) => ({
                  name: it.name || "Medicine",
                  quantity: Number(it.quantity || 1),
                  price: Number(it.price || it.unitPrice || 0),
                  total: Number(it.total || (Number(it.price || it.unitPrice || 0) * Number(it.quantity || 1))),
                }));

                const orderNum = orderArg?.invoiceNumber || successData?.invoiceNumber || "0001";
                const custName = orderArg?.customer?.name || successData?.customerName;
                const custPhone = orderArg?.customer?.phone || successData?.customerPhone;

                await printThermalReceipt(
                  {
                    orderNumber: String(orderNum),
                    date: Date.now(),
                    cashierName: user?.name || user?.email || "Pharmacist",
                    terminalName: "PHARM-01",
                    customer: custName ? { name: custName, phone: custPhone } : undefined,
                    items: printItems,
                    subtotal: Number(orderArg?.subtotal ?? successData?.subtotal ?? subtotal),
                    discount: Number(orderArg?.discount ?? successData?.discount ?? discountAmount),
                    tax: Number(orderArg?.tax ?? successData?.tax ?? tax),
                    taxRatePercent: Number(taxRatePercent),
                    total: Number(orderArg?.total ?? successData?.total ?? total),
                    paymentMethod: paymentArg?.method || successData?.method || "Cash",
                    amountPaid: Number(orderArg?.amountPaid ?? successData?.paidAmount ?? successData?.amount ?? 0),
                    change: Number(paymentArg?.change ?? successData?.change ?? 0),
                    currency: settings?.currency || "PKR",
                  },
                  {
                    paperWidth: settings?.printerType === "thermal_58mm" ? "58mm" : "80mm",
                    storeName: settings?.pharmacyName || "Pharmacy Store",
                    storeAddress: settings?.address || "Medical Complex",
                    storePhone: settings?.phone || "0300-0000000",
                    headerText: settings?.receiptHeader || "Licensed Medical Store & Pharmacy",
                    footerText: settings?.receiptFooter || "Get Well Soon! Medicines sold non-refundable without receipt.",
                    showBarcode: true,
                    showQrCode: true,
                  } as any
                );
              } catch (err) {
                console.error("Print failed, falling back to window.print():", err);
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
      {/* 1. TOP HEADER (MATCHING AUTO CARE POS EXACTLY) */}
      <header className="flex h-[48px] shrink-0 items-center justify-between border-b border-[#d8d8d8] bg-white px-3 z-30">
        {/* Left header group */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mobile cart toggle */}
          <button
            type="button"
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
            type="button"
            onClick={() => navigate("/pharmacy")}
            title="Return to Pharmacy Launcher"
            className="flex h-[34px] items-center gap-1.5 rounded-lg border border-[#bce6e9] bg-[#e6f5f6] px-3 text-[13px] sm:text-[14px] font-medium text-[#00878a] hover:bg-[#d8f0f2] transition-colors"
          >
            <LayoutGrid className="h-4 w-4 text-[#00878a]" />
            <span>Pharmacy</span>
          </button>

          {/* Orders button */}
          <button
            type="button"
            onClick={() => navigate("/pharmacy/orders")}
            className="flex h-[34px] items-center rounded-lg px-3 text-[13px] sm:text-[14px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Orders
          </button>

          {/* New Order (+) button */}
          <button
            type="button"
            onClick={handleNewOrder}
            title="New Order"
            className="flex h-[34px] w-[34px] items-center justify-center rounded-lg border border-[#d0d0d0] text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>

          {/* Order number badge */}
          <div className="flex h-[34px] min-w-[65px] items-center justify-center rounded-lg border border-[#159aa5] bg-[#f5ffff] px-2.5 text-[13px] sm:text-[14px] font-medium text-[#159aa5]">
            #{currentOrderNumber}
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
                  const found = medicines.find(
                    (m) =>
                      (m.barcode && m.barcode.toLowerCase() === clean) ||
                      (m.batchNumber && m.batchNumber.toLowerCase() === clean) ||
                      (m.sku && m.sku.toLowerCase() === clean)
                  );
                  if (found) {
                    addToCart(found);
                    setSearch("");
                  }
                }
              }}
              placeholder="Search medicines, formula, barcode..."
              className="h-[34px] w-full rounded-lg border border-[#d5d5d5] bg-white pl-8 pr-3 text-[13px] outline-none transition focus:border-[#159aa5]"
            />
          </div>

          {/* Barcode scan */}
          <button
            type="button"
            title="Scan Barcode"
            onClick={() => {
              const barcode = window.prompt("Enter or scan medicine barcode:");
              if (barcode && barcode.trim()) {
                const clean = barcode.trim().toLowerCase();
                const found = medicines.find(
                  (m) =>
                    (m.barcode && m.barcode.toLowerCase() === clean) ||
                    (m.sku && m.sku.toLowerCase() === clean) ||
                    (m.batchNumber && m.batchNumber.toLowerCase() === clean)
                );
                if (found) {
                  addToCart(found);
                } else {
                  alert(`Medicine with barcode "${barcode}" not found in inventory.`);
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

          {/* User Profile */}
          <div className="relative">
            <button
              type="button"
              onClick={() => navigate("/pharmacy/settings")}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-lg bg-[#00897b] text-[13px] font-bold text-white shadow-sm hover:ring-2 hover:ring-[#00897b]/40 transition cursor-pointer"
              title={user?.email || "Pharmacist"}
            >
              {user?.email?.charAt(0).toUpperCase() || "P"}
            </button>
          </div>

          {/* Menu Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenuDropdown(!showMenuDropdown)}
              title="Menu"
              className="flex h-[34px] w-[34px] items-center justify-center rounded-lg hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>

            {showMenuDropdown && (
              <div className="absolute right-0 mt-1.5 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl z-50">
                <button
                  type="button"
                  onClick={() => navigate("/pharmacy")}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 font-medium"
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-[#00897b]" />
                  Pharmacy Launcher
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/pharmacy/medicines")}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 font-medium"
                >
                  <Pill className="h-3.5 w-3.5 text-blue-500" />
                  Medicines & Inventory
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/pharmacy/dashboard")}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 font-medium"
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-indigo-500" />
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/pharmacy/reports")}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 font-medium"
                >
                  <Tag className="h-3.5 w-3.5 text-teal-500" />
                  Reports & Analytics
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("genx:selectedModule");
                    navigate("/select-module");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 font-medium"
                >
                  <RotateCw className="h-3.5 w-3.5 text-slate-500" />
                  Switch Business
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. MAIN BODY (LEFT CART + RIGHT PRODUCT PANEL) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT CART PANEL */}
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
          {/* Mobile close bar */}
          <div className="flex h-8 items-center justify-between border-b border-[#e5e7eb] px-3 bg-slate-50 lg:hidden">
            <span className="text-xs font-semibold text-slate-600">Prescription Cart</span>
            <button
              type="button"
              onClick={() => setMobileCartOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-slate-200 text-slate-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Cart items list */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="flex h-full min-h-[160px] items-center justify-center text-center text-slate-400 p-4">
                <div>
                  <ShoppingCart className="mx-auto h-7 w-7 opacity-30 text-[#00897b]" />
                  <p className="mt-2 text-xs font-medium text-slate-600">No medicines in cart</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Click medicines on the right to dispense</p>
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
                      <div className="truncate text-xs sm:text-[13px] font-medium text-slate-900 leading-tight">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-teal-700 flex items-center gap-1">
                        <span>{item.dosageForm || "Med"}</span>
                        {item.strength && <span>• {item.strength}</span>}
                      </div>
                    </div>

                    <div className="shrink-0 text-right text-xs sm:text-[13px] font-semibold text-slate-900 pr-2">
                      Rs. {(item.price * item.quantity).toLocaleString()}
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => decreaseQuantity(item.id)}
                        className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                        title="Decrease"
                      >
                        <Minus className="h-2.5 w-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => increaseQuantity(item.id)}
                        className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-100"
                        title="Increase"
                      >
                        <Plus className="h-2.5 w-2.5" />
                      </button>
                      <button
                        type="button"
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

          {/* Bottom section: Totals, Patient, Keypad, Pay */}
          <div className="shrink-0 border-t border-[#d8d8d8] bg-white">
            {/* Totals */}
            <div className="px-3 py-2 space-y-1 bg-white">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Subtotal</span>
                <span>Rs. {subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>

              {/* Discount Row */}
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setIsDiscountModalOpen(true)}
                  disabled={cart.length === 0}
                  className="flex items-center gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <Tag className="h-3.5 w-3.5 text-emerald-600" />
                  {discountAmount > 0 ? (
                    <span>Discount ({discountType === "percent" ? `${discountValue}%` : "Rs."})</span>
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
                      onClick={() => setDiscountValue(0)}
                      className="text-slate-400 hover:text-rose-500 cursor-pointer p-0.5 rounded transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <span className="text-slate-400 text-[11px]">Rs. 0</span>
                )}
              </div>

              {/* Taxes */}
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

            {/* Customer & Patient details button */}
            <div className="flex items-center gap-1.5 border-t border-[#e8e8e8] px-2.5 py-1.5">
              <button
                type="button"
                onClick={() => setCustomerModalOpen(true)}
                className={`flex h-[34px] flex-1 min-w-0 items-center justify-between gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all ${
                  selectedCustomer && selectedCustomer.name !== "Walk-in Customer"
                    ? "bg-teal-50 border-teal-400 text-teal-950 font-bold shadow-xs"
                    : "bg-white border-[#d3d3d3] text-slate-800 hover:bg-slate-50"
                }`}
                title="Select Patient / Customer"
              >
                <div className="flex items-center gap-1.5 min-w-0 truncate">
                  <User
                    className={`h-3.5 w-3.5 shrink-0 ${
                      selectedCustomer && selectedCustomer.name !== "Walk-in Customer"
                        ? "text-teal-600"
                        : "text-slate-500"
                    }`}
                  />
                  <span className="truncate font-semibold text-slate-700">
                    {selectedCustomer?.name || "Walk-in Customer"}
                  </span>
                </div>

                {selectedCustomer?.phone ? (
                  <span className="text-[10px] text-teal-700 bg-teal-100/60 px-1.5 py-0.5 rounded font-bold shrink-0">
                    {selectedCustomer.phone}
                  </span>
                ) : (
                  <span className="text-[10px] text-teal-600 font-bold uppercase tracking-wider shrink-0 bg-teal-50 px-1.5 py-0.5 rounded">
                    + Patient
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  const note = window.prompt("Order / Prescription Note");
                  if (note) alert(`Note added: ${note}`);
                }}
                className="flex h-[32px] items-center justify-center gap-1 rounded border border-[#d3d3d3] px-2.5 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors"
              >
                <StickyNote className="h-3 w-3" />
                <span>Note</span>
              </button>

              <button
                type="button"
                onClick={() => void loadPharmacyData()}
                title="Sync Inventory"
                className="flex h-[32px] w-[32px] items-center justify-center rounded border border-[#d3d3d3] text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
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
                  type="button"
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
                  {key === "⌫" ? <Delete className="h-4 w-4" /> : key}
                </button>
              ))}
            </div>

            {/* Payment Button */}
            <div className="p-2">
              <button
                type="button"
                onClick={() => {
                  if (cart.length === 0) return;
                  setShowPayment(true);
                }}
                disabled={cart.length === 0}
                className="flex h-[44px] w-full items-center justify-center rounded-lg bg-[#00897b] text-[15px] font-semibold text-white transition hover:bg-[#00796b] cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Payment
              </button>
            </div>
          </div>
        </section>

        {/* RIGHT PRODUCT PANEL */}
        <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#f4f4f4]">
          {/* Category Bar */}
          <div className="shrink-0 overflow-x-auto border-b border-[#e0e0e0] bg-[#f8fafc] px-3 py-2">
            <div className="flex min-w-max gap-1.5">
              {posCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
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
            {loading ? (
              <div className="flex h-full min-h-[200px] items-center justify-center">
                <div className="text-center text-slate-400">
                  <RotateCw className="mx-auto h-7 w-7 animate-spin text-teal-600" />
                  <p className="mt-2 text-xs font-medium text-slate-600">Loading medicines from Supabase cloud...</p>
                </div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex h-full min-h-[200px] items-center justify-center">
                <div className="text-center text-slate-400">
                  <Search className="mx-auto h-8 w-8 opacity-40 text-slate-400" />
                  <p className="mt-2 text-xs font-medium text-slate-600">No medicines found</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Try searching another drug or dosage form.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 2xl:grid-cols-5">
                {filteredProducts.map((med) => {
                  const isOutOfStock = Number(med.stock || 0) <= 0;
                  const isExpired = Boolean(med.expiryDate && new Date(med.expiryDate) <= now);

                  return (
                    <button
                      key={med.id}
                      type="button"
                      onClick={() => addToCart(med)}
                      className={`group relative flex min-h-[135px] flex-col overflow-hidden rounded-xl border bg-white text-left shadow-xs transition cursor-pointer ${
                        isOutOfStock || isExpired
                          ? "border-red-200 opacity-80 hover:border-red-300"
                          : "border-[#d8d8d8] hover:border-[#b0b0b0] hover:shadow-sm"
                      }`}
                    >
                      {/* Medicine Icon & Badges */}
                      <div className="relative flex h-[80px] sm:h-[85px] items-center justify-center overflow-hidden bg-gradient-to-br from-teal-50/50 to-slate-50 p-2">
                        <Pill className={`h-8 w-8 ${isOutOfStock ? "text-slate-300" : "text-[#00897b]"}`} />

                        {/* Top Badges */}
                        <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 items-end">
                          {isExpired ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white uppercase tracking-wider">
                              EXPIRED
                            </span>
                          ) : isOutOfStock ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500 text-white uppercase tracking-wider">
                              OUT OF STOCK
                            </span>
                          ) : (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                med.stock <= (med.minStockLevel || 10)
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              Stock: {med.stock}
                            </span>
                          )}
                        </div>

                        {/* Dosage Form Badge */}
                        <div className="absolute bottom-1.5 left-1.5">
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/90 text-slate-700 border border-slate-200 shadow-2xs">
                            {med.dosageForm} {med.strength && `• ${med.strength}`}
                          </span>
                        </div>
                      </div>

                      {/* Medicine Name & Price */}
                      <div className="flex min-h-[48px] flex-col justify-center px-2 py-1.5 bg-white">
                        <div className="truncate text-xs font-semibold text-slate-900 leading-tight">
                          {med.name}
                        </div>
                        <div className="truncate text-[10px] text-slate-500 mt-0.5">
                          {med.genericName || med.category}
                        </div>

                        <div className="mt-1 flex items-center justify-between text-[11px]">
                          <span className="font-bold text-[#00897b] text-xs">
                            Rs. {med.sellingPrice.toLocaleString()}
                          </span>
                          {med.batchNumber && (
                            <span className="text-[9px] text-slate-400 font-mono">
                              {med.batchNumber}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bottom Category Indicator Line */}
                      <div
                        className={`absolute bottom-0 left-0 right-0 h-[3px] ${
                          isOutOfStock
                            ? "bg-red-400"
                            : isExpired
                            ? "bg-rose-500"
                            : "bg-[#00897b]"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Customer & Patient Modal */}
      <PharmacyCustomerModal
        isOpen={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        selectedCustomer={selectedCustomer}
        onSelectCustomer={(cust) => setSelectedCustomer(cust)}
      />

      {/* Discount Modal */}
      <DiscountModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        subtotal={subtotal}
        currentType={discountType}
        currentValue={discountValue}
        taxRatePercent={taxRatePercent}
        onApply={(type, value) => {
          setDiscountType(type);
          setDiscountValue(value);
        }}
        onRemove={() => {
          setDiscountType('percent');
          setDiscountValue(0);
        }}
      />
    </div>
  );
}

export default PharmacyPOS;
