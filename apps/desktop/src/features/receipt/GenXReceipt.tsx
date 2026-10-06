import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import "./GenXReceipt.css";

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface GenXReceiptItem {
  id?: string | number;
  name: string;
  product_name?: string;
  quantity?: number;
  unitPrice?: number;
  unit_price?: number;
  price?: number;
  total?: number;
  lineTotal?: number;
  line_total?: number;
  unit?: string;
  unitName?: string;
  unit_name?: string;
}

export interface GenXReceiptOrder {
  id?: string;
  items?: GenXReceiptItem[];
  subtotal?: number;
  taxAmount?: number;
  tax_amount?: number;
  tax?: number;
  taxableAmount?: number;
  taxable_amount?: number;
  total?: number;
  grandTotal?: number;
  grand_total?: number;
  amountPaid?: number;
  amount_paid?: number;
  paymentMethod?: string;
  payment_method?: string;
  ticketNumber?: string;
  ticket_number?: string;
  orderNumber?: string;
  order_number?: string;
  invoiceNumber?: string;
  invoice_number?: string;
  cashierName?: string;
  cashier_name?: string;
  userName?: string;
  user_name?: string;
  storeEmail?: string;
  store_email?: string;
  createdAt?: string | number | Date;
  created_at?: string | number | Date;
  invoiceUrl?: string;
  invoice_url?: string;
  invoiceCode?: string;
  invoice_code?: string;
  storeLogo?: string;
  store_logo?: string;
  qrCode?: string;
  qr_code?: string;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

export interface GenXReceiptPayment {
  amount?: number;
  method?: string;
  change?: number;
}

export interface GenXReceiptProps {
  order?: GenXReceiptOrder;
  payment?: GenXReceiptPayment;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(value: unknown): string {
  const number = Number(value || 0);
  return `Rs. ${number.toFixed(2)}`;
}

function formatPrintHeaderDateTime(date: Date): string {
  try {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = String(date.getFullYear()).slice(-2);
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${month}/${day}/${year}, ${hours}:${minutes} ${ampm}`;
  } catch {
    return date.toLocaleString();
  }
}

function formatDateTime(value: unknown): string {
  if (!value) return "";
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;

  return `${month}/${day}/${year} ${hours}:${minutes}:${seconds} ${ampm}`;
}

function getTotalItems(items: GenXReceiptItem[] = []): number {
  return items.reduce(
    (total, item) => total + Number(item.quantity || 0),
    0
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GenXReceipt({ order, payment }: GenXReceiptProps) {
  const items = order?.items || [];
  const totalItems = getTotalItems(items);

  const subtotal = Number(order?.subtotal || 0);

  const taxAmount = Number(
    order?.taxAmount ??
      order?.tax_amount ??
      order?.tax ??
      0
  );

  const taxableAmount = Number(
    order?.taxableAmount ??
      order?.taxable_amount ??
      subtotal
  );

  const grandTotal = Number(
    order?.total ??
      order?.grandTotal ??
      order?.grand_total ??
      payment?.amount ??
      subtotal + taxAmount
  );

  const amountPaid = Number(
    order?.amountPaid ??
      order?.amount_paid ??
      payment?.amount ??
      grandTotal
  );

  const paymentMethod =
    order?.paymentMethod ||
    order?.payment_method ||
    payment?.method ||
    "Cash";

  const ticketNumber =
    order?.ticketNumber ||
    order?.ticket_number ||
    order?.invoiceNumber ||
    order?.invoice_number ||
    order?.orderNumber ||
    order?.order_number ||
    "262-1-000001";

  const cashierName =
    order?.cashierName ||
    order?.cashier_name ||
    order?.userName ||
    order?.user_name ||
    "noman53000@gmail.com";

  const storeEmail =
    order?.storeEmail ||
    order?.store_email ||
    cashierName ||
    "noman53000@gmail.com";

  const saleDate =
    order?.createdAt ||
    order?.created_at ||
    new Date();

  const invoiceCode =
    order?.invoiceCode ||
    order?.invoice_code ||
    ticketNumber;

  const invoiceUrl =
    order?.invoiceUrl ||
    order?.invoice_url ||
    "https://genxpos.cloud/pos/ticket";

  const logo =
    order?.storeLogo ||
    order?.store_logo ||
    "";

  const [qrCodeUrl, setQrCodeUrl] = useState<string>(
    order?.qrCode || order?.qr_code || ""
  );
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    if (order?.qrCode || order?.qr_code) {
      setQrCodeUrl(order.qrCode || order.qr_code || "");
      return;
    }

    let isMounted = true;
    const fullUrl = `${invoiceUrl}?code=${encodeURIComponent(invoiceCode)}`;

    QRCode.toDataURL(fullUrl, {
      width: 140,
      margin: 0,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((dataUrl) => {
        if (isMounted) setQrCodeUrl(dataUrl);
      })
      .catch((err) => {
        console.warn("QR code generation failed:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [order?.qrCode, order?.qr_code, invoiceUrl, invoiceCode]);

  const [printDate] = useState(() => formatPrintHeaderDateTime(new Date()));

  return (
    <div className="genx-receipt">

      {/* TOP LINE */}
      <div className="receipt-top-line">
        <span>{printDate}</span>
        <span>GenX Cloud POS</span>
      </div>

      {/* LOGO */}
      {logo && !logoError ? (
        <img
          className="receipt-logo"
          src={logo}
          alt="GenX Cloud POS"
          onError={() => setLogoError(true)}
        />
      ) : (
        <div className="receipt-logo-placeholder">
          <svg
            className="receipt-cam-icon"
            viewBox="0 0 24 24"
            width="22"
            height="22"
            stroke="currentColor"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
          <span className="receipt-logo-text">Your logo</span>
        </div>
      )}

      {/* TICKET INFORMATION */}
      <div className="receipt-ticket">
        <div className="ticket-number">
          {ticketNumber.toLowerCase().startsWith("ticket")
            ? ticketNumber
            : `Ticket ${ticketNumber}`}
        </div>
        <div className="ticket-date">{formatDateTime(saleDate)}</div>
        <div className="ticket-cashier">Served by: {cashierName}</div>
      </div>

      {/* PRODUCTS */}
      <div className="receipt-products">
        {items.map((item, index) => {
          const quantity = Number(item.quantity || 0);

          const unitPrice = Number(
            item.unitPrice ??
              item.unit_price ??
              item.price ??
              0
          );

          const itemTotal = Number(
            item.total ??
              item.lineTotal ??
              item.line_total ??
              quantity * unitPrice
          );

          const unit =
            item.unit ||
            item.unitName ||
            item.unit_name ||
            "Units";

          return (
            <div className="receipt-product" key={item.id || index}>
              <div className="product-quantity">{quantity}</div>

              <div className="product-details">
                <div className="product-name">
                  {item.name || item.product_name}
                </div>
                <div className="product-unit-price">
                  {money(unitPrice)} / {unit}
                </div>
              </div>

              <div className="product-total">{money(itemTotal)}</div>
            </div>
          );
        })}
      </div>

      {/* TOTALS */}
      <div className="receipt-totals">
        <div className="receipt-total-row">
          <span>Subtotal:</span>
          <span>{money(subtotal)}</span>
        </div>

        <div className="receipt-total-row">
          <span>General Sales Tax</span>
          <span>{money(taxAmount)}</span>
        </div>

        <div className="receipt-total-row">
          <span>Base General Sales Tax</span>
          <span>{money(taxableAmount)}</span>
        </div>

        <div className="receipt-total-row receipt-grand-total">
          <span>Total:</span>
          <span>{money(grandTotal)}</span>
        </div>

        <div className="receipt-total-row receipt-payment">
          <span>{paymentMethod}</span>
          <span>{money(amountPaid)}</span>
        </div>
      </div>

      {/* TOTAL ITEMS */}
      <div className="receipt-items-total">
        <span>Total Items</span>
        <strong>{totalItems}</strong>
      </div>

      {/* QR / INVOICE */}
      <div className="receipt-invoice">
        <div className="receipt-qr">
          {qrCodeUrl ? (
            <img src={qrCodeUrl} alt="Invoice QR Code" />
          ) : (
            <div className="qr-placeholder">QR</div>
          )}
        </div>

        <div className="invoice-details">
          <div className="invoice-title">Need an invoice?</div>
          <div className="invoice-url">{invoiceUrl}</div>
          <div className="invoice-code">Code: {invoiceCode}</div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="receipt-footer">
        <span>Choose POS</span>
        <span className="footer-email">{storeEmail}</span>
      </div>

      {/* POWERED BY */}
      <div className="receipt-powered">
        Powered by <strong>GenX Cloud POS</strong>
      </div>

    </div>
  );
}
