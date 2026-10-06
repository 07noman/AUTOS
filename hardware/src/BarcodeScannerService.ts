export class BarcodeScannerService {
  private onScanCallback: ((barcode: string) => void) | null = null;

  /**
   * Initialize barcode scanner
   */
  async initialize(): Promise<void> {
    // TODO: Listen for HID barcode scanner events
    document.addEventListener('keydown', this.handleKeyPress.bind(this));
    console.log('Barcode scanner initialized');
  }

  /**
   * Set scan callback
   */
  onScan(callback: (barcode: string) => void): void {
    this.onScanCallback = callback;
  }

  /**
   * Handle key press from barcode scanner
   */
  private handleKeyPress(event: KeyboardEvent): void {
    // Barcode scanners typically send Enter at the end
    if (event.key === 'Enter') {
      // TODO: Process scanned barcode
      console.log('Barcode scanned');
    }
  }

  /**
   * Process scanned barcode
   */
  private processBarcode(barcode: string): void {
    if (this.onScanCallback) {
      this.onScanCallback(barcode);
    }
  }
}

export default BarcodeScannerService;
