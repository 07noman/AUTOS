import { useMemo, useState } from "react";
import {
  Banknote,
  CreditCard,
  User as UserRound,
  FileText,
  Delete,
  ArrowLeft,
  CheckCircle2,
  WalletCards,
  X,
} from "lucide-react";
import "./PaymentPage.css";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentMethod = "cash" | "credit" | "card";

export interface POSCustomer {
  id?: string;
  name: string;
  phone?: string;
}

export interface POSCartItem {
  id: string;        // product id as string
  name: string;
  quantity: number;
  price: number;     // unit price
  type?: "product" | "service";
}

export interface PaymentData {
  orderId?: string;
  items: POSCartItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  /** Cash/card: amount the customer handed over. Credit: 0. */
  paidAmount: number;
  customer?: POSCustomer;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (amount: number) =>
  `Rs. ${amount.toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ─── Lightweight built-in customer picker ────────────────────────────────────
// The POS passes in the existing customer list from its own state / hook.
// If you already have a full CustomerPicker modal, pass onSelectCustomer
// and it will be called instead of showing this inline one.

interface CustomerPickerModalProps {
  customers: POSCustomer[];
  onSelect: (c: POSCustomer) => void;
  onClose: () => void;
}

function CustomerPickerModal({
  customers,
  onSelect,
  onClose,
}: CustomerPickerModalProps) {
  const [q, setQ] = useState("");

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      c.phone?.includes(q)
  );

  return (
    <div className="customer-picker-overlay" onClick={onClose}>
      <div
        className="customer-picker-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="customer-picker-header">
          <h3>Select Customer</h3>
          <button
            type="button"
            className="customer-picker-close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="customer-picker-search">
          <input
            autoFocus
            placeholder="Search by name or phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="customer-picker-list">
          {filtered.length === 0 ? (
            <div className="customer-picker-empty">
              No customers found
            </div>
          ) : (
            filtered.map((c, i) => (
              <button
                key={c.id ?? i}
                type="button"
                className="customer-picker-item"
                onClick={() => onSelect(c)}
              >
                <div className="customer-picker-avatar">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="customer-picker-info">
                  <strong>{c.name}</strong>
                  {c.phone && <span>{c.phone}</span>}
                </div>
              </button>
            ))
          )}
        </div>

        <button
          type="button"
          className="customer-picker-add"
          onClick={() => {
            const name = window.prompt("New customer name:");
            if (name?.trim()) {
              onSelect({ name: name.trim() });
              onClose();
            }
          }}
        >
          + Add new customer
        </button>
      </div>
    </div>
  );
}

// ─── Success Overlay ──────────────────────────────────────────────────────────

interface SuccessOverlayProps {
  total: number;
  change: number;
  method: PaymentMethod;
  customer?: POSCustomer;
  onNewSale: () => void;
  onClose: () => void;
}

function SuccessOverlay({
  total,
  change,
  method,
  customer,
  onNewSale,
  onClose,
}: SuccessOverlayProps) {
  return (
    <div className="payment-success-overlay">
      <div className="payment-success-card">
        <div className="success-icon">
          <CheckCircle2 size={32} />
        </div>

        <h2>Payment Complete</h2>

        <p>
          {method === "credit"
            ? `Credit recorded for ${customer?.name ?? "customer"}`
            : method === "card"
            ? "Card payment accepted"
            : "Cash payment accepted"}
        </p>

        <div className="success-amount">{fmt(total)}</div>

        {method === "cash" && change > 0 && (
          <p style={{ marginBottom: 16, color: "#004d3b", fontWeight: 700 }}>
            Change: {fmt(change)}
          </p>
        )}

        <div className="success-actions">
          <button
            type="button"
            className="btn-new-sale"
            onClick={onNewSale}
          >
            New Sale
          </button>
          <button
            type="button"
            className="btn-close"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PaymentPage ──────────────────────────────────────────────────────────────

interface PaymentPageProps {
  total: number;
  subtotal: number;
  tax: number;
  items: POSCartItem[];
  orderId?: string;

  /** Pre-selected customer from the POS state. */
  selectedCustomer?: POSCustomer | null;

  /**
   * Full customer list from your existing hook/state.
   * Used by the built-in picker. Leave empty if you provide onSelectCustomer.
   */
  customers?: POSCustomer[];

  /**
   * Override: open your own existing customer-picker UI instead.
   * If provided, the built-in picker won't open.
   */
  onSelectCustomer?: () => void;

  /**
   * Called when payment is confirmed.
   * Connect this to your EXISTING order/invoice/ledger handler.
   * Do NOT duplicate DB writes here.
   */
  onPayment: (data: PaymentData) => Promise<void> | void;

  /** Back to cart — must NOT clear cart items. */
  onBack: () => void;

  onInvoice?: () => void;

  /** Called after successful payment, after the success overlay's "New Sale". */
  onNewSale?: () => void;

  /**
   * When provided, called immediately after a successful DB write with the
   * real PaymentData + change amount. The parent can then show its own
   * success screen. When set, the built-in SuccessOverlay will NOT appear.
   */
  onPaymentSuccess?: (data: PaymentData, change: number) => void;
}

export default function PaymentPage({
  total,
  subtotal,
  tax,
  items,
  orderId,
  selectedCustomer: externalCustomer,
  customers = [],
  onSelectCustomer,
  onPayment,
  onBack,
  onInvoice,
  onNewSale,
  onPaymentSuccess,
}: PaymentPageProps) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState(total.toFixed(2));
  const [processing, setProcessing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [localCustomer, setLocalCustomer] = useState<POSCustomer | null>(
    externalCustomer ?? null
  );
  const [success, setSuccess] = useState(false);

  // Keep in sync if parent updates the selected customer
  const customer = externalCustomer ?? localCustomer;

  const numericAmount = Number(amount) || 0;
  const remaining = Math.max(total - numericAmount, 0);
  const change = Math.max(numericAmount - total, 0);

  const canValidate =
    method === "credit"
      ? Boolean(customer)
      : numericAmount >= total;

  const title = useMemo(() => {
    if (method === "cash") return "Cash";
    if (method === "credit") return "Credit";
    return "Card";
  }, [method]);

  // ── Keypad helpers ──────────────────────────────────────────────────────────

  const addAmount = (value: number) => {
    setAmount((cur) => ((Number(cur) || 0) + value).toFixed(2));
  };

  const appendDigit = (digit: string) => {
    setAmount((cur) => {
      if (cur === "0" || cur === "0.00") return digit;
      return `${cur}${digit}`;
    });
  };

  const addDecimal = () => {
    setAmount((cur) => (cur.includes(".") ? cur : `${cur}.`));
  };

  const toggleSign = () => {
    setAmount((cur) => (-(Number(cur) || 0)).toString());
  };

  const removeLastDigit = () => {
    setAmount((cur) => (cur.length <= 1 ? "0" : cur.slice(0, -1)));
  };

  // ── Method change ──────────────────────────────────────────────────────────

  const handleMethodChange = (next: PaymentMethod) => {
    setMethod(next);
    setAmount(total.toFixed(2));
  };

  // ── Customer selection ─────────────────────────────────────────────────────

  const openCustomerPicker = () => {
    if (onSelectCustomer) {
      // Use the existing POS customer picker
      onSelectCustomer();
    } else {
      setPickerOpen(true);
    }
  };

  // ── Validate / submit ──────────────────────────────────────────────────────

  const handleValidate = async () => {
    if (processing) return;

    if (method === "credit" && !customer) {
      openCustomerPicker();
      return;
    }

    if (method !== "credit" && numericAmount < total) return;

    try {
      setProcessing(true);

      const paymentData: PaymentData = {
        orderId,
        items,
        subtotal,
        tax,
        total,
        paymentMethod: method,
        paidAmount: method === "credit" ? 0 : numericAmount,
        customer: customer ?? undefined,
      };

      // ⚠️  This calls the EXISTING handler wired up by AutoCarePOS.
      //     No DB logic lives here — it belongs in the parent.
      await onPayment(paymentData);

      // If the parent wants to render its own success screen, call the hook.
      // Otherwise fall back to the built-in SuccessOverlay.
      if (onPaymentSuccess) {
        onPaymentSuccess(paymentData, change);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      console.error("Payment processing failed:", err);
      alert(
        `Payment failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setProcessing(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="genx-payment-page">

      {/* ── Success overlay ── */}
      {success && (
        <SuccessOverlay
          total={total}
          change={change}
          method={method}
          customer={customer ?? undefined}
          onNewSale={() => {
            setSuccess(false);
            onNewSale?.();
          }}
          onClose={() => {
            setSuccess(false);
            onBack();
          }}
        />
      )}

      {/* ── Customer picker ── */}
      {pickerOpen && (
        <CustomerPickerModal
          customers={customers}
          onSelect={(c) => {
            setLocalCustomer(c);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* ───────────────────────── HEADER ───────────────────────── */}
      <header className="payment-header">
        <div className="payment-header-left">
          <button
            type="button"
            className="header-back"
            onClick={onBack}
            disabled={processing}
          >
            <ArrowLeft size={21} />
          </button>

          <div className="genx-mini-logo">GX</div>

          <div className="header-title">
            <strong>Payment</strong>
            <span>Complete transaction</span>
          </div>
        </div>

        <div className="payment-order-info">
          {orderId && (
            <>
              <span>Order</span>
              <strong>#{orderId}</strong>
            </>
          )}
        </div>
      </header>

      {/* ───────────────────────── CONTENT ───────────────────────── */}
      <main className="payment-content">

        {/* ── LEFT ── */}
        <section className="payment-left">

          {/* Payment method selection */}
          <div className="payment-section">
            <div className="section-heading">
              <div>
                <h2>Payment method</h2>
                <p>Select how the customer will pay</p>
              </div>
            </div>

            <div className="payment-methods">

              {/* CASH */}
              <button
                type="button"
                className={`payment-method${method === "cash" ? " active" : ""}`}
                onClick={() => handleMethodChange("cash")}
              >
                <div className="method-icon"><Banknote size={28} /></div>
                <div className="method-content">
                  <strong>Cash</strong>
                  <span>Receive cash and record revenue</span>
                </div>
                {method === "cash" && (
                  <CheckCircle2 className="method-check" size={22} />
                )}
              </button>

              {/* CARD */}
              <button
                type="button"
                className={`payment-method${method === "card" ? " active" : ""}`}
                onClick={() => handleMethodChange("card")}
              >
                <div className="method-icon"><CreditCard size={28} /></div>
                <div className="method-content">
                  <strong>Card</strong>
                  <span>Payment through card</span>
                </div>
                {method === "card" && (
                  <CheckCircle2 className="method-check" size={22} />
                )}
              </button>

              {/* CREDIT */}
              <button
                type="button"
                className={`payment-method${method === "credit" ? " active" : ""}`}
                onClick={() => handleMethodChange("credit")}
              >
                <div className="method-icon credit-icon"><WalletCards size={28} /></div>
                <div className="method-content">
                  <strong>Credit</strong>
                  <span>Add outstanding balance to customer ledger</span>
                </div>
                {method === "credit" && (
                  <CheckCircle2 className="method-check" size={22} />
                )}
              </button>

            </div>
          </div>

          {/* Customer */}
          <div className="payment-section">
            <div className="section-heading">
              <div>
                <h2>Customer</h2>
                <p>Customer information for this transaction</p>
              </div>
            </div>

            {customer ? (
              <div className="customer-selected">
                <div className="customer-avatar">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <div className="customer-details">
                  <strong>{customer.name}</strong>
                  {customer.phone && <span>{customer.phone}</span>}
                </div>
                <button
                  type="button"
                  className="change-customer"
                  onClick={openCustomerPicker}
                  disabled={processing}
                >
                  Change
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={`customer-empty${method === "credit" ? " required" : ""}`}
                onClick={openCustomerPicker}
                disabled={processing}
              >
                <div className="customer-empty-icon">
                  <UserRound size={21} />
                </div>
                <div>
                  <strong>
                    {method === "credit"
                      ? "Select customer for credit"
                      : "Add customer"}
                  </strong>
                  <span>
                    {method === "credit"
                      ? "Required for credit sales"
                      : "Optional"}
                  </span>
                </div>
                <span className="customer-arrow">→</span>
              </button>
            )}
          </div>

          {/* Invoice button */}
          {onInvoice && (
            <button
              type="button"
              className="invoice-button"
              onClick={onInvoice}
              disabled={processing}
            >
              <FileText size={19} />
              Invoice
            </button>
          )}

        </section>

        {/* ── RIGHT (summary / keypad) ── */}
        <aside className="payment-summary">

          {/* Total */}
          <div className="summary-header">
            <span>Total payable</span>
            <div className="total-amount">
              <small>Rs.</small>
              <strong>
                {total.toLocaleString("en-PK", {
                  minimumFractionDigits: 2,
                })}
              </strong>
            </div>
          </div>

          {/* Selected method pill */}
          <div className="selected-payment">
            <div className="selected-payment-header">
              <div className="selected-payment-name">
                {method === "cash" && <Banknote size={21} />}
                {method === "card" && <CreditCard size={21} />}
                {method === "credit" && <WalletCards size={21} />}
                <span>{title}</span>
              </div>
              <button
                type="button"
                className="remove-payment"
                onClick={() => handleMethodChange("cash")}
                disabled={processing}
                aria-label="Reset to cash"
              >
                <X size={17} />
              </button>
            </div>
            <div className="selected-payment-amount">
              {fmt(method === "credit" ? total : numericAmount)}
            </div>
          </div>

          {/* Amount received input (cash / card) */}
          {method !== "credit" && (
            <div className="amount-area">
              <label>Amount received</label>
              <div className="amount-input">
                <span>Rs.</span>
                <input
                  value={amount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^-?\d*\.?\d*$/.test(v)) setAmount(v);
                  }}
                  inputMode="decimal"
                  aria-label="Amount received"
                />
              </div>
            </div>
          )}

          {/* Credit notice */}
          {method === "credit" && (
            <div className="credit-notice">
              <div className="notice-icon"><WalletCards size={19} /></div>
              <div>
                <strong>Credit sale</strong>
                <p>
                  {customer
                    ? `${fmt(total)} will be added to ${customer.name}'s outstanding ledger balance.`
                    : "Select a customer to record this credit sale."}
                </p>
              </div>
            </div>
          )}

          {/* Quick amounts */}
          {method !== "credit" && (
            <div className="quick-amounts">
              <button type="button" onClick={() => setAmount(total.toFixed(2))}>
                Exact
              </button>
              <button type="button" onClick={() => addAmount(10)}>+10</button>
              <button type="button" onClick={() => addAmount(20)}>+20</button>
              <button type="button" onClick={() => addAmount(50)}>+50</button>
              <button type="button" onClick={() => addAmount(100)}>+100</button>
            </div>
          )}

          {/* Numeric keypad */}
          {method !== "credit" && (
            <div className="keypad">
              {["1","2","3","4","5","6","7","8","9"].map((d) => (
                <button key={d} type="button" onClick={() => appendDigit(d)}>
                  {d}
                </button>
              ))}
              <button type="button" className="sign-key" onClick={toggleSign}>
                +/−
              </button>
              <button type="button" onClick={() => appendDigit("0")}>0</button>
              <button type="button" className="decimal-key" onClick={addDecimal}>
                .
              </button>
              <button type="button" className="delete-key" onClick={removeLastDigit}>
                <Delete size={21} />
              </button>
            </div>
          )}

          {/* Remaining / Change */}
          {method !== "credit" && (
            <div className="change-row">
              <span>{remaining > 0 ? "Remaining" : "Change"}</span>
              <strong className={remaining > 0 ? "remaining" : "change"}>
                {fmt(remaining > 0 ? remaining : change)}
              </strong>
            </div>
          )}

          {/* Validate button */}
          <button
            type="button"
            className="validate-button"
            disabled={processing || !canValidate}
            onClick={handleValidate}
          >
            {processing ? (
              <>
                <span className="payment-spinner" />
                Processing…
              </>
            ) : (
              <>
                <CheckCircle2 size={20} />
                {method === "credit" ? "Confirm Credit Sale" : "Validate Payment"}
              </>
            )}
          </button>

          {!canValidate && method !== "credit" && (
            <p className="validation-help">
              Amount received must be at least {fmt(total)}.
            </p>
          )}

        </aside>

      </main>
    </div>
  );
}
