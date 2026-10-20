import React, { useState, useEffect, useCallback } from "react";
import {
  Monitor,
  Moon,
  Sun,
  Download,
  Banknote,
  RefreshCw,
  Plus,
  ChevronLeft,
  Key,
  X,
  AlertTriangle,
  CheckCircle2,
  Info,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { syncEngine } from "@/lib/sync";
import { getInstallPrompt } from "@/services/pwaInstall";
import { AddProductModal } from "@/features/auto-care/AddProductModal";

export interface AccountActionsPageProps {
  onClose?: () => void;
  onLogout?: () => void;
  cartItemCount?: number;
  businessType?: string;
  className?: string;
}

interface ToastMessage {
  id: number;
  text: string;
  type: "success" | "info" | "error";
}

export function AccountActionsPage({
  onClose,
  onLogout,
  cartItemCount = 0,
  businessType,
  className = "",
}: AccountActionsPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();

  // Dark mode state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  // Action states
  const [isReloading, setIsReloading] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [showCloseRegisterModal, setShowCloseRegisterModal] = useState(false);

  // Cash In/Out state
  const [cashType, setCashType] = useState<"in" | "out">("in");
  const [cashAmount, setCashAmount] = useState("");
  const [cashReason, setCashReason] = useState("Opening Float");
  const [cashNotes, setCashNotes] = useState("");

  // Close Register Reconciliation state
  const [countedCash, setCountedCash] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const expectedCash = 5000; // Standard baseline expected drawer float in PKR

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((text: string, type: "success" | "info" | "error" = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Listen for Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showAddProductModal) {
          setShowAddProductModal(false);
        } else if (showCashModal) {
          setShowCashModal(false);
        } else if (showCloseRegisterModal) {
          setShowCloseRegisterModal(false);
        } else if (onClose) {
          onClose();
        } else {
          navigate(-1);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAddProductModal, showCashModal, showCloseRegisterModal, onClose, navigate]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate(-1);
    }
  };

  // 1. Customer Display
  const handleCustomerDisplay = () => {
    showToast(
      "Customer Display: No secondary display is currently connected or configured for this terminal. (Multi-display setup is in development).",
      "info"
    );
  };

  // 2. Switch Dark / Light Mode
  const handleToggleTheme = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", nextDark);
    }
    try {
      localStorage.setItem("genx:theme", nextDark ? "dark" : "light");
    } catch (e) {
      // ignore
    }
    showToast(nextDark ? "Switched to Dark Mode" : "Switched to Light Mode", "success");
  };

  // 3. Install App
  const handleInstallApp = async () => {
    const event = (window as any).__GENX_INSTALL_PROMPT || getInstallPrompt();
    if (!event) {
      showToast(
        "App installation is not available in this browser or the app is already installed.",
        "info"
      );
      return;
    }

    try {
      event.prompt();
      const choice = await event.userChoice;
      if (choice && choice.outcome === "accepted") {
        showToast("GENX Cloud POS app installed successfully!", "success");
      }
    } catch (e) {
      console.error("Installation prompt error:", e);
      showToast("App installation could not be completed.", "error");
    }
    (window as any).__GENX_INSTALL_PROMPT = null;
  };

  // 4. Cash In/Out
  const handleSaveCashInOut = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(cashAmount);
    if (!cashAmount || isNaN(amountNum) || amountNum <= 0) {
      showToast("Please enter a valid amount greater than 0.", "error");
      return;
    }

    try {
      const existingStr = localStorage.getItem("genx:cash_drawer_transactions");
      const transactions = existingStr ? JSON.parse(existingStr) : [];
      const record = {
        id: `cash_${Date.now()}`,
        type: cashType,
        amount: amountNum,
        reason: cashReason,
        notes: cashNotes.trim() || undefined,
        cashier: user?.name || user?.email || "Cashier",
        timestamp: new Date().toISOString(),
      };
      transactions.push(record);
      localStorage.setItem("genx:cash_drawer_transactions", JSON.stringify(transactions));
      showToast(
        `Cash ${cashType === "in" ? "In" : "Out"} of PKR ${amountNum.toLocaleString()} recorded successfully.`,
        "success"
      );
      setCashAmount("");
      setCashNotes("");
      setShowCashModal(false);
    } catch (err) {
      console.error("Failed to save cash transaction:", err);
      showToast("Failed to record cash transaction.", "error");
    }
  };

  // 5. Reload Data
  const handleReloadData = async () => {
    if (isReloading) return;
    setIsReloading(true);
    showToast("Synchronizing and reloading data from server...", "info");

    try {
      await syncEngine.sync();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["categories"] }),
        queryClient.invalidateQueries({ queryKey: ["orders"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["receiptSettings"] }),
      ]);
      showToast("Data synchronized and reloaded successfully.", "success");
    } catch (err) {
      console.error("Reload data failed:", err);
      showToast("Failed to synchronize with server. Operating on local cache.", "error");
    } finally {
      setIsReloading(false);
    }
  };

  // 6. Create Product
  const handleCreateProduct = () => {
    setShowAddProductModal(true);
  };

  // 7. Backend
  const handleBackend = () => {
    const selectedModule = localStorage.getItem("genx:selectedModule");
    const isAutoCare =
      businessType === "auto_care" ||
      selectedModule === "auto_care" ||
      selectedModule === "auto-parts";

    if (isAutoCare) {
      navigate("/auto-care");
    } else if (businessType) {
      navigate(`/business/${businessType}`);
    } else if (selectedModule) {
      navigate(`/business/${selectedModule}`);
    } else {
      navigate("/dashboard");
    }
  };

  // 8. Close Register
  const handleCloseRegisterClick = () => {
    setShowCloseRegisterModal(true);
  };

  const handleConfirmCloseRegister = () => {
    try {
      const countedNum = parseFloat(countedCash) || 0;
      const difference = countedNum - expectedCash;
      const closureRecord = {
        id: `close_reg_${Date.now()}`,
        cashier: user?.name || user?.email || "Cashier",
        terminal: "Register 1",
        expectedCash,
        countedCash: countedNum,
        difference,
        notes: closingNotes.trim() || undefined,
        closedAt: new Date().toISOString(),
      };
      const existingStr = localStorage.getItem("genx:register_closures");
      const closures = existingStr ? JSON.parse(existingStr) : [];
      closures.push(closureRecord);
      localStorage.setItem("genx:register_closures", JSON.stringify(closures));
    } catch (e) {
      console.error("Failed to persist register closure report:", e);
    }

    setShowCloseRegisterModal(false);
    if (onLogout) {
      onLogout();
    } else {
      logout();
      navigate("/login");
    }
  };

  const countedNum = parseFloat(countedCash) || 0;
  const variance = countedCash ? countedNum - expectedCash : 0;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-[#f4f6f8] dark:bg-[#111827] text-slate-800 dark:text-slate-100 font-sans select-none overflow-hidden ${className}`}
      role="dialog"
      aria-modal="true"
      aria-label="Account Actions"
    >
      {/* ── TOP HEADER (GENX Navigation & Branding) ────────────────────── */}
      <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#1f2937] px-4 sm:px-6 shadow-sm z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 px-2.5 items-center justify-center rounded bg-[#004D3B] text-[12px] font-bold tracking-wider text-white">
              GENX
            </span>
            <span className="text-sm font-semibold text-slate-900 dark:text-white hidden sm:inline">
              Cloud POS
            </span>
          </div>

          <span className="h-4 w-px bg-slate-300 dark:bg-neutral-700 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#004D3B] text-xs font-bold text-white">
              {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "C"}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 leading-tight">
                {user?.name || user?.email || "Cashier"}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-neutral-400 leading-tight">
                Register 1 · Main Terminal
              </span>
            </div>
          </div>
        </div>

        {/* Close (X) button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-[#1f2937] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004D3B]"
            title="Close Account Actions (Esc)"
            aria-label="Close Account Actions"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT (Odoo-Style Action Grid) ───────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 flex flex-col items-center justify-center">
        <div className="w-full max-w-6xl mx-auto">
          {/* Action Grid: 4 columns x 2 rows on desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
            {/* ── ROW 1 ────────────────────────────────────────── */}

            {/* 1. Customer Display */}
            <button
              type="button"
              onClick={handleCustomerDisplay}
              className="h-[220px] bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-neutral-700 rounded-lg flex flex-col items-center justify-center p-6 gap-3.5 transition-all hover:border-slate-300 dark:hover:border-neutral-600 hover:bg-slate-50/80 dark:hover:bg-neutral-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004D3B] group shadow-sm text-center"
            >
              <Monitor className="h-7 w-7 text-slate-500 dark:text-neutral-400 group-hover:text-slate-700 dark:group-hover:text-neutral-200 transition-colors" />
              <span className="text-[19px] font-medium text-slate-800 dark:text-slate-100 leading-snug">
                Customer Display
              </span>
            </button>

            {/* 2. Switch to Dark Mode / Light Mode */}
            <button
              type="button"
              onClick={handleToggleTheme}
              className="h-[220px] bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-neutral-700 rounded-lg flex flex-col items-center justify-center p-6 gap-3.5 transition-all hover:border-slate-300 dark:hover:border-neutral-600 hover:bg-slate-50/80 dark:hover:bg-neutral-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004D3B] group shadow-sm text-center"
            >
              {darkMode ? (
                <Sun className="h-7 w-7 text-amber-500 transition-colors" />
              ) : (
                <Moon className="h-7 w-7 text-slate-500 dark:text-neutral-400 group-hover:text-slate-700 dark:group-hover:text-neutral-200 transition-colors" />
              )}
              <span className="text-[19px] font-medium text-slate-800 dark:text-slate-100 leading-snug">
                {darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              </span>
            </button>

            {/* 3. Install App */}
            <button
              type="button"
              onClick={handleInstallApp}
              className="h-[220px] bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-neutral-700 rounded-lg flex flex-col items-center justify-center p-6 gap-3.5 transition-all hover:border-slate-300 dark:hover:border-neutral-600 hover:bg-slate-50/80 dark:hover:bg-neutral-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004D3B] group shadow-sm text-center"
            >
              <Download className="h-7 w-7 text-slate-500 dark:text-neutral-400 group-hover:text-slate-700 dark:group-hover:text-neutral-200 transition-colors" />
              <span className="text-[19px] font-medium text-slate-800 dark:text-slate-100 leading-snug">
                Install App
              </span>
            </button>

            {/* 4. Cash In/Out */}
            <button
              type="button"
              onClick={() => {
                setCashType("in");
                setCashReason("Opening Float");
                setCashAmount("");
                setCashNotes("");
                setShowCashModal(true);
              }}
              className="h-[220px] bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-neutral-700 rounded-lg flex flex-col items-center justify-center p-6 gap-3.5 transition-all hover:border-slate-300 dark:hover:border-neutral-600 hover:bg-slate-50/80 dark:hover:bg-neutral-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004D3B] group shadow-sm text-center"
            >
              <Banknote className="h-7 w-7 text-slate-500 dark:text-neutral-400 group-hover:text-slate-700 dark:group-hover:text-neutral-200 transition-colors" />
              <span className="text-[19px] font-medium text-slate-800 dark:text-slate-100 leading-snug">
                Cash In/Out
              </span>
            </button>

            {/* ── ROW 2 ────────────────────────────────────────── */}

            {/* 5. Reload Data */}
            <button
              type="button"
              onClick={handleReloadData}
              disabled={isReloading}
              className="h-[220px] bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-neutral-700 rounded-lg flex flex-col items-center justify-center p-6 gap-3.5 transition-all hover:border-slate-300 dark:hover:border-neutral-600 hover:bg-slate-50/80 dark:hover:bg-neutral-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004D3B] group shadow-sm text-center disabled:opacity-60"
            >
              <RefreshCw
                className={`h-7 w-7 text-slate-500 dark:text-neutral-400 group-hover:text-slate-700 dark:group-hover:text-neutral-200 transition-colors ${
                  isReloading ? "animate-spin text-[#004D3B]" : ""
                }`}
              />
              <span className="text-[19px] font-medium text-slate-800 dark:text-slate-100 leading-snug">
                {isReloading ? "Reloading..." : "Reload Data"}
              </span>
            </button>

            {/* 6. Create Product */}
            <button
              type="button"
              onClick={handleCreateProduct}
              className="h-[220px] bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-neutral-700 rounded-lg flex flex-col items-center justify-center p-6 gap-3.5 transition-all hover:border-slate-300 dark:hover:border-neutral-600 hover:bg-slate-50/80 dark:hover:bg-neutral-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004D3B] group shadow-sm text-center"
            >
              <Plus className="h-7 w-7 text-slate-500 dark:text-neutral-400 group-hover:text-slate-700 dark:group-hover:text-neutral-200 transition-colors" />
              <span className="text-[19px] font-medium text-slate-800 dark:text-slate-100 leading-snug">
                Create Product
              </span>
            </button>

            {/* 7. Backend */}
            <button
              type="button"
              onClick={handleBackend}
              className="h-[220px] bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-neutral-700 rounded-lg flex flex-col items-center justify-center p-6 gap-3.5 transition-all hover:border-slate-300 dark:hover:border-neutral-600 hover:bg-slate-50/80 dark:hover:bg-neutral-800/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004D3B] group shadow-sm text-center"
            >
              <ChevronLeft className="h-7 w-7 text-slate-500 dark:text-neutral-400 group-hover:text-slate-700 dark:group-hover:text-neutral-200 transition-colors" />
              <span className="text-[19px] font-medium text-slate-800 dark:text-slate-100 leading-snug">
                Backend
              </span>
            </button>

            {/* 8. Close Register (Prominent destructive solid red tile) */}
            <button
              type="button"
              onClick={handleCloseRegisterClick}
              className="h-[220px] bg-[#d9383a] hover:bg-[#b91c1c] text-white border border-[#d9383a] rounded-lg flex flex-col items-center justify-center p-6 gap-3.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#d9383a] group shadow-sm text-center cursor-pointer"
            >
              <Key className="h-7 w-7 text-white" />
              <span className="text-[19px] font-medium text-white leading-snug">
                Close Register
              </span>
            </button>
          </div>
        </div>
      </main>

      {/* ── CASH IN / OUT WORKFLOW MODAL ──────────────────────────────── */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-neutral-700 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-neutral-700">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-[#004D3B]" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Cash In / Cash Out
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCashModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCashInOut} className="mt-4 space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-neutral-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setCashType("in");
                    setCashReason("Opening Float");
                  }}
                  className={`flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition ${
                    cashType === "in"
                      ? "bg-white dark:bg-[#1f2937] text-emerald-700 dark:text-emerald-400 shadow-sm"
                      : "text-slate-600 dark:text-neutral-400 hover:text-slate-900"
                  }`}
                >
                  <ArrowDownCircle className="h-4 w-4" />
                  Cash In (Deposit)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCashType("out");
                    setCashReason("Petty Cash");
                  }}
                  className={`flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition ${
                    cashType === "out"
                      ? "bg-white dark:bg-[#1f2937] text-rose-700 dark:text-rose-400 shadow-sm"
                      : "text-slate-600 dark:text-neutral-400 hover:text-slate-900"
                  }`}
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  Cash Out (Expense)
                </button>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Amount (PKR) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                    Rs.
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    min="1"
                    placeholder="0.00"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    className="w-full h-11 pl-11 pr-3 rounded-lg border border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-base font-semibold focus:border-[#004D3B] focus:ring-1 focus:ring-[#004D3B] outline-none"
                    autoFocus
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Reason / Category
                </label>
                <select
                  value={cashReason}
                  onChange={(e) => setCashReason(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-sm focus:border-[#004D3B] outline-none"
                >
                  {cashType === "in" ? (
                    <>
                      <option value="Opening Float">Opening Drawer Float</option>
                      <option value="Change Replenishment">Change Replenishment</option>
                      <option value="Customer Advance">Customer Advance / Deposit</option>
                      <option value="Other In">Other Cash Deposit</option>
                    </>
                  ) : (
                    <>
                      <option value="Petty Cash">Petty Cash / Daily Expense</option>
                      <option value="Supplier Payment">Supplier / Vendor Payment</option>
                      <option value="Bank Deposit">Bank Deposit / Safe Drop</option>
                      <option value="Owner Withdrawal">Owner Withdrawal</option>
                      <option value="Other Out">Other Cash Outflow</option>
                    </>
                  )}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Note / Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Receipt #, description"
                  value={cashNotes}
                  onChange={(e) => setCashNotes(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-sm focus:border-[#004D3B] outline-none"
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-neutral-700">
                <button
                  type="button"
                  onClick={() => setShowCashModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-medium text-white bg-[#004D3B] hover:bg-[#00382b] rounded-lg transition shadow-sm"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CLOSE REGISTER CONFIRMATION & RECONCILIATION MODAL ────────── */}
      {showCloseRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#1f2937] border border-slate-200 dark:border-neutral-700 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-neutral-700">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
                  <Key className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Close Register & Cash Reconciliation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCloseRegisterModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Active Cart Warning */}
              {cartItemCount > 0 && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 p-3 text-amber-900 dark:text-amber-200 text-xs sm:text-sm">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <span className="font-bold">Active Cart in Progress: </span>
                    There are currently {cartItemCount} item(s) in the active order cart.
                    Closing the register will exit the cashier session without completing the pending sale.
                  </div>
                </div>
              )}

              {/* Register Summary */}
              <div className="rounded-lg border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800/60 p-3 text-xs sm:text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Cashier:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {user?.name || user?.email || "Cashier"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Terminal:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Register 1 (Main Station)
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-neutral-700">
                  <span className="text-slate-500 dark:text-neutral-400">Expected Cash in Drawer:</span>
                  <span className="font-bold text-[#004D3B] dark:text-emerald-400">
                    Rs. {expectedCash.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Cash count input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Closing Cash Counted (PKR) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                    Rs.
                  </span>
                  <input
                    type="number"
                    step="any"
                    placeholder="Enter physical cash in drawer"
                    value={countedCash}
                    onChange={(e) => setCountedCash(e.target.value)}
                    className="w-full h-11 pl-11 pr-3 rounded-lg border border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-base font-semibold focus:border-[#d9383a] focus:ring-1 focus:ring-[#d9383a] outline-none"
                    autoFocus
                  />
                </div>

                {countedCash && (
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Discrepancy / Variance:</span>
                    <span
                      className={`font-bold ${
                        variance === 0
                          ? "text-emerald-600"
                          : variance > 0
                          ? "text-blue-600"
                          : "text-rose-600"
                      }`}
                    >
                      {variance === 0
                        ? "Exact Match (Rs. 0)"
                        : variance > 0
                        ? `+ Rs. ${variance.toLocaleString()} (Surplus)`
                        : `- Rs. ${Math.abs(variance).toLocaleString()} (Shortage)`}
                    </span>
                  </div>
                )}
              </div>

              {/* Closing Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Closing Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. End of morning shift handover"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white text-sm focus:border-[#d9383a] outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-neutral-700">
                <button
                  type="button"
                  onClick={() => setShowCloseRegisterModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-lg transition"
                >
                  Keep Register Open
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCloseRegister}
                  className="px-5 py-2 text-sm font-bold text-white bg-[#d9383a] hover:bg-[#b91c1c] rounded-lg transition shadow-sm"
                >
                  Confirm & Close Register
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE PRODUCT MODAL (Reusing AddProductModal) ─────────────── */}
      {showAddProductModal && (
        <AddProductModal
          open={showAddProductModal}
          onClose={() => setShowAddProductModal(false)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["products"] });
            showToast("New product created successfully!", "success");
            setShowAddProductModal(false);
          }}
        />
      )}

      {/* ── TOAST NOTIFICATIONS ───────────────────────────────────────── */}
      {toasts.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-md w-full px-4 pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg text-sm font-medium border pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-2 ${
                t.type === "success"
                  ? "bg-emerald-900 text-white border-emerald-700"
                  : t.type === "error"
                  ? "bg-rose-900 text-white border-rose-700"
                  : "bg-slate-900 text-white border-slate-700"
              }`}
            >
              {t.type === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
              {t.type === "error" && <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />}
              {t.type === "info" && <Info className="h-4 w-4 text-sky-400 shrink-0" />}
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AccountActionsPage;
