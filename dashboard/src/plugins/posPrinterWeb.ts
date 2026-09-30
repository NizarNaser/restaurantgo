import { WebPlugin } from '@capacitor/core';
import type { PosPrinterPlugin, PrintPayload } from './posPrinter';

/**
 * Browsers have no API to open a raw socket to a WiFi printer or a
 * Bluetooth SPP connection, so direct silent printing only works inside
 * the native RestaurantGo POS Android app. This web fallback exists so
 * calling code doesn't crash while running in the regular dashboard.
 */
export class PosPrinterWeb extends WebPlugin implements PosPrinterPlugin {
  async print(_payload: PrintPayload): Promise<{ success: boolean }> {
    throw new Error('Direct printing needs the RestaurantGo POS Android app — use "Print bill" for the browser print dialog instead.');
  }
}
