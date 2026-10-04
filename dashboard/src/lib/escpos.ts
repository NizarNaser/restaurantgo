// Builds raw ESC/POS byte tickets for thermal receipt printers. ESC/POS is
// a shared standard most restaurant thermal printers understand (Epson,
// Xprinter, Star, and most generic ones) — not a single vendor SDK.

const ESC = 0x1b;
const GS = 0x1d;
const LINE_WIDTH = 32; // characters per line on a standard 58mm/80mm printer

function textToBytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function init(): number[] {
  return [ESC, 0x40];
}

function align(mode: 'left' | 'center' | 'right'): number[] {
  const n = mode === 'center' ? 1 : mode === 'right' ? 2 : 0;
  return [ESC, 0x61, n];
}

function bold(on: boolean): number[] {
  return [ESC, 0x45, on ? 1 : 0];
}

function feed(lines = 1): number[] {
  return Array(lines).fill(0x0a);
}

function cut(): number[] {
  return [GS, 0x56, 0x00];
}

function line(text = ''): number[] {
  return [...textToBytes(text), 0x0a];
}

function divider(): number[] {
  return line('-'.repeat(LINE_WIDTH));
}

export interface TicketLine {
  name: string;
  quantity: number;
}

/** A single department's ticket (e.g. Kitchen) — only the items it needs to prepare. */
export function buildDepartmentTicket(params: {
  departmentName: string;
  tableNumber: string;
  hallName?: string | null;
  items: TicketLine[];
  timestamp: string;
}): Uint8Array {
  const bytes: number[] = [
    ...init(),
    ...align('center'),
    ...bold(true),
    ...line(params.departmentName.toUpperCase()),
    ...bold(false),
    ...line(`Table ${params.tableNumber}${params.hallName ? ' · ' + params.hallName : ''}`),
    ...line(new Date(params.timestamp).toLocaleTimeString()),
    ...align('left'),
    ...divider(),
  ];

  for (const item of params.items) {
    bytes.push(...line(`${item.quantity} x ${item.name}`));
  }

  bytes.push(...feed(3), ...cut());
  return new Uint8Array(bytes);
}

export interface BillLine {
  name: string;
  weight?: string | null;
  quantity: number;
  subtotal: string;
}

/** The full itemized bill, printed on the primary/bar printer when the customer asks to pay. */
export function buildFullBillTicket(params: {
  tableNumber: string;
  hallName?: string | null;
  items: BillLine[];
  subtotal: string;
  taxRate: number;
  taxAmount: number;
  serviceChargeRate: number;
  serviceChargeAmount: number;
  grandTotal: number;
  currency: string;
  openedAt: string;
  closedAt?: string | null;
  staffName?: string | null;
}): Uint8Array {
  const bytes: number[] = [
    ...init(),
    ...align('center'),
    ...bold(true),
    ...line('BILL'),
    ...bold(false),
    ...line(`Table ${params.tableNumber}${params.hallName ? ' · ' + params.hallName : ''}`),
    ...align('left'),
    ...divider(),
  ];

  for (const item of params.items) {
    const label = `${item.quantity} x ${item.name}${item.weight ? ` (${item.weight})` : ''}`;
    bytes.push(...line(`${label.padEnd(Math.max(LINE_WIDTH - item.subtotal.length, label.length))}${item.subtotal}`));
  }

  bytes.push(...divider(), ...line(`Subtotal: ${params.currency} ${params.subtotal}`));

  if (params.taxRate > 0) {
    bytes.push(...line(`Tax (${params.taxRate}%): ${params.currency} ${params.taxAmount.toFixed(2)}`));
  }

  if (params.serviceChargeRate > 0) {
    bytes.push(...line(`Service charge (${params.serviceChargeRate}%): ${params.currency} ${params.serviceChargeAmount.toFixed(2)}`));
  }

  bytes.push(
    ...bold(true),
    ...line(`TOTAL: ${params.currency} ${params.grandTotal.toFixed(2)}`),
    ...bold(false),
    ...line(`Opened: ${new Date(params.openedAt).toLocaleString()}`)
  );

  if (params.closedAt) {
    bytes.push(...line(`Closed: ${new Date(params.closedAt).toLocaleString()}`));
  }
  if (params.staffName) {
    bytes.push(...line(`Served by: ${params.staffName}`));
  }

  bytes.push(...feed(3), ...cut());
  return new Uint8Array(bytes);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
