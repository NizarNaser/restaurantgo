import { registerPlugin } from '@capacitor/core';

export interface PrintPayload {
  connectionType: 'wifi' | 'bluetooth';
  /** IP address for WiFi (printed to TCP port 9100), or the paired device's MAC address for Bluetooth. */
  address: string;
  /** Base64-encoded raw ESC/POS bytes, e.g. from bytesToBase64() in lib/escpos.ts. */
  data: string;
}

export interface PosPrinterPlugin {
  print(payload: PrintPayload): Promise<{ success: boolean }>;
}

const PosPrinter = registerPlugin<PosPrinterPlugin>('PosPrinter', {
  web: () => import('./posPrinterWeb').then((m) => new m.PosPrinterWeb()),
});

export default PosPrinter;
