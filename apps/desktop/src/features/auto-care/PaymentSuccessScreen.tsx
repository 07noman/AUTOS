import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  Printer,
  Mail,
  MessageCircle,
  ArrowLeft,
  ShoppingCart,
  X,
} from "lucide-react";
import "./PaymentSuccessScreen.css";
import GenXReceipt, { type GenXReceiptOrder, type GenXReceiptItem } from "./GenXReceipt";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SuccessOrder extends GenXReceiptOrder {
  id?: string;
  invoiceNumber?: string;
  ticketNumber?: string;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
    mobile?: string;
  };
  items?: GenXReceiptItem[];
  subtotal?: number;
  tax?: number;
  taxAmount?: number;
  taxableAmount?: number;
  total?: number;
  paymentMethod?: string;
  amountPaid?: number;
  cashierName?: string;
  storeEmail?: string;
  storeLogo?: string;
  createdAt?: string | number | Date;
  invoiceUrl?: string;
  invoiceCode?: string;
  qrCode?: string;
}

export interface SuccessPayment {
  amount?: number;
  method?: string;
  change?: number;
}

interface PaymentSuccessScreenProps {
  order?: SuccessOrder;
  payment?: SuccessPayment;
  /** The actual paid amount — NEVER hard-code, always pass from real payment result */
  amount: number;
  currency?: string;
  onBack?: () => void;
  onContinue?: () => void;
  onPrint?: (order?: SuccessOrder, payment?: SuccessPayment) => Promise<void> | void;
  onSendEmail?: (email: string, order?: SuccessOrder) => Promise<void> | void;
  onSendWhatsApp?: (phone: string, order?: SuccessOrder) => Promise<void> | void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency = "Rs.") {
  return `${currency} ${n.toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function methodLabel(method?: string) {
  if (!method) return "Paid";
  const map: Record<string, string> = {
    cash: "Cash",
    card: "Card",
    credit: "Credit",
    mobile: "Mobile Wallet",
  };
  return map[method.toLowerCase()] ?? method;
}

// ─── Receipt Modal ────────────────────────────────────────────────────────────

interface ReceiptModalProps {
  order?: SuccessOrder;
  onClose: () => void;
  onSendEmail?: (email: string) => Promise<void> | void;
  onSendWhatsApp?: (phone: string) => Promise<void> | void;
}

function ReceiptModal({ order, onClose, onSendEmail, onSendWhatsApp }: ReceiptModalProps) {
  const [tab, setTab] = useState<"email" | "whatsapp">("email");
  const [email, setEmail] = useState(order?.customer?.email ?? "");
  const [phone, setPhone] = useState(order?.customer?.phone ?? order?.customer?.mobile ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      if (tab === "email") {
        if (!email.trim()) { alert("Please enter an email address."); return; }
        await onSendEmail?.(email.trim());
      } else {
        if (!phone.trim()) { alert("Please enter a phone number."); return; }
        await onSendWhatsApp?.(phone.trim());
      }
      setSent(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      console.error("Send receipt failed:", err);
      alert("Could not send the receipt. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="pss-modal-overlay" onClick={onClose}>
      <div className="pss-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pss-modal-header">
          <h3>Send Receipt</h3>
          <button type="button" className="pss-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="pss-modal-tabs">
          <button
            type="button"
            className={`pss-tab${tab === "email" ? " active" : ""}`}
            onClick={() => setTab("email")}
          >
            <Mail size={16} /> Email
          </button>
          <button
            type="button"
            className={`pss-tab${tab === "whatsapp" ? " active" : ""}`}
            onClick={() => setTab("whatsapp")}
          >
            <MessageCircle size={16} /> WhatsApp
          </button>
        </div>

        <div className="pss-modal-body">
          {sent ? (
            <div className="pss-sent-msg">
              <CheckCircle2 size={32} />
              <p>Receipt sent!</p>
            </div>
          ) : tab === "email" ? (
            <label className="pss-field">
              <span>Email address</span>
              <input
                type="email"
                autoFocus
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
            </label>
          ) : (
            <label className="pss-field">
              <span>WhatsApp / phone number</span>
              <input
                type="tel"
                autoFocus
                placeholder="+92 300 0000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
            </label>
          )}
        </div>

        {!sent && (
          <div className="pss-modal-footer">
            <button type="button" className="pss-btn-ghost" onClick={onClose} disabled={sending}>
              Cancel
            </button>
            <button type="button" className="pss-btn-send" onClick={handleSend} disabled={sending}>
              {sending ? "Sending…" : "Send Receipt"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PaymentSuccessScreen ─────────────────────────────────────────────────────

export default function PaymentSuccessScreen({
  order,
  payment,
  amount,
  currency = "Rs.",
  onBack,
  onContinue,
  onPrint,
  onSendEmail,
  onSendWhatsApp,
}: PaymentSuccessScreenProps) {
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [printing, setPrinting] = useState(false);

  // The paid amount MUST come from the actual payment — never hard-coded.
  const paidAmount =
    typeof amount === "number" && !isNaN(amount)
      ? amount
      : Number(
          payment?.amount ??
          order?.total ??
          0
        );

  const handlePrint = async () => {
    if (printing) return;
    setPrinting(true);
    try {
      if (onPrint) {
        await onPrint(order, payment);
      } else {
        window.print();
      }
    } catch (err) {
      console.error("Receipt print failed:", err);
      alert("Unable to print receipt.");
    } finally {
      setPrinting(false);
    }
  };

  const changeGiven =
    payment?.change != null && payment.change > 0 ? payment.change : null;

  return (
    <>
      {createPortal(
        <div id="genx-receipt-portal">
          <GenXReceipt order={order} payment={payment} />
        </div>,
        document.body
      )}

      <div className="pss-root">
      {/* ── Receipt modal ── */}
      {showReceiptModal && (
        <ReceiptModal
          order={order}
          onClose={() => setShowReceiptModal(false)}
          onSendEmail={
            onSendEmail
              ? (e) => onSendEmail(e, order)
              : undefined
          }
          onSendWhatsApp={
            onSendWhatsApp
              ? (p) => onSendWhatsApp(p, order)
              : undefined
          }
        />
      )}

      {/* ── Main card ── */}
      <div className="pss-card">

        {/* Success icon */}
        <div className="pss-icon-wrap">
          <CheckCircle2 className="pss-check-icon" size={52} />
        </div>

        <h1 className="pss-title">Payment Successful</h1>

        {/* Invoice / customer info */}
        {(order?.invoiceNumber || order?.customer?.name) && (
          <div className="pss-meta">
            {order.invoiceNumber && (
              <span className="pss-badge">#{order.invoiceNumber}</span>
            )}
            {order.customer?.name && (
              <span className="pss-customer">{order.customer.name}</span>
            )}
          </div>
        )}

        {/* Amount */}
        <div className="pss-amount-block">
          <span className="pss-currency">{currency}</span>
          <span className="pss-amount">
            {paidAmount.toLocaleString("en-PK", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        {/* Method + change */}
        <div className="pss-details">
          {(payment?.method ?? order?.paymentMethod) && (
            <div className="pss-detail-row">
              <span>Payment method</span>
              <strong>{methodLabel(payment?.method ?? order?.paymentMethod)}</strong>
            </div>
          )}
          {changeGiven != null && (
            <div className="pss-detail-row">
              <span>Change</span>
              <strong className="pss-change">{fmt(changeGiven, currency)}</strong>
            </div>
          )}
          {order?.subtotal != null && order.subtotal !== paidAmount && (
            <div className="pss-detail-row">
              <span>Subtotal</span>
              <strong>{fmt(order.subtotal, currency)}</strong>
            </div>
          )}
          {order?.tax != null && order.tax > 0 && (
            <div className="pss-detail-row">
              <span>Tax (5%)</span>
              <strong>{fmt(order.tax, currency)}</strong>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="pss-actions">
          <button
            type="button"
            className="pss-btn pss-btn-print"
            onClick={handlePrint}
            disabled={printing}
          >
            <Printer size={18} />
            {printing ? "Printing…" : "Print Receipt"}
          </button>

          <button
            type="button"
            className="pss-btn pss-btn-receipt"
            onClick={() => setShowReceiptModal(true)}
          >
            <Mail size={18} />
            Send Receipt
          </button>
        </div>

        {/* Bottom navigation */}
        <div className="pss-nav">
          {onBack && (
            <button type="button" className="pss-btn-nav pss-btn-back" onClick={onBack}>
              <ArrowLeft size={17} />
              Back
            </button>
          )}
          {onContinue && (
            <button type="button" className="pss-btn-nav pss-btn-continue" onClick={onContinue}>
              <ShoppingCart size={17} />
              New Sale
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
