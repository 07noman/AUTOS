export interface ReceiptData {
  businessName: string;
  orderNumber: string;
  date: string;
  items: Array<{ name: string; quantity: number; price: number; total: number }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  footer?: string;
}

function money(n: number): string {
  return n.toFixed(2);
}

export class PrinterService {
  formatReceipt(data: ReceiptData): string {
    const lines: string[] = [
      data.businessName,
      `Order: ${data.orderNumber}`,
      `Date: ${data.date}`,
      '--------------------------------',
      ...data.items.flatMap((i) => [`${i.quantity}x ${i.name}`, `   ${money(i.total)}`]),
      '--------------------------------',
      `Subtotal: ${money(data.subtotal)}`,
    ];
    if (data.discount > 0) {
      lines.push(`Discount: -${money(data.discount)}`);
    }
    lines.push(
      `Tax: ${money(data.tax)}`,
      `TOTAL: ${money(data.total)}`,
      `Payment: ${data.paymentMethod}`,
      data.footer ?? 'Thank you!'
    );
    return lines.join('\n');
  }

  toHtml(data: ReceiptData): string {
    const body = this.formatReceipt(data);
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${data.orderNumber}</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; margin: 16px; }
    pre { white-space: pre-wrap; }
  </style>
</head>
<body>
  <pre>${body.replace(/</g, '&lt;')}</pre>
</body>
</html>`;
  }

  async printReceipt(data: ReceiptData): Promise<void> {
    const html = this.toHtml(data);

    const printedViaTauri = await this.tryTauriPrint(html);
    if (printedViaTauri) return;

    this.printInBrowser(html);
  }

  private async tryTauriPrint(html: string): Promise<boolean> {
    const w = window as unknown as {
      __TAURI__?: { invoke: (cmd: string, args: Record<string, unknown>) => Promise<unknown> };
      __TAURI_INTERNALS__?: { invoke: (cmd: string, args: Record<string, unknown>) => Promise<unknown> };
    };
    const invoke = w.__TAURI__?.invoke ?? w.__TAURI_INTERNALS__?.invoke;
    if (!invoke) return false;
    try {
      await invoke('print_receipt', { html });
      return true;
    } catch {
      return false;
    }
  }

  private printInBrowser(html: string): void {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) {
      iframe.remove();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    const cleanup = () => {
      window.setTimeout(() => iframe.remove(), 500);
    };
    iframe.contentWindow?.addEventListener('afterprint', cleanup);
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(cleanup, 4000);
  }
}

export default PrinterService;
