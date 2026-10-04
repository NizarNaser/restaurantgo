import { describe, expect, it } from 'vitest';
import { buildDepartmentTicket, buildFullBillTicket, bytesToBase64 } from './escpos';

function decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe('buildDepartmentTicket', () => {
  it('starts with the ESC/POS init sequence and ends with feed + cut', () => {
    const bytes = buildDepartmentTicket({
      departmentName: 'Kitchen',
      tableNumber: 'T1',
      hallName: 'Main Hall',
      items: [{ name: 'Caesar Salad', quantity: 2 }],
      timestamp: '2026-01-01T12:00:00Z',
    });

    expect(bytes[0]).toBe(0x1b);
    expect(bytes[1]).toBe(0x40);
    expect(bytes.slice(-3)).toEqual(new Uint8Array([0x1d, 0x56, 0x00]));
  });

  it('includes the department name, table, hall, and each item with its quantity', () => {
    const bytes = buildDepartmentTicket({
      departmentName: 'Kitchen',
      tableNumber: 'T1',
      hallName: 'Main Hall',
      items: [
        { name: 'Caesar Salad', quantity: 2 },
        { name: 'Fattoush', quantity: 1 },
      ],
      timestamp: '2026-01-01T12:00:00Z',
    });
    const text = decode(bytes);

    expect(text).toContain('KITCHEN');
    expect(text).toContain('Table T1');
    expect(text).toContain('Main Hall');
    expect(text).toContain('2 x Caesar Salad');
    expect(text).toContain('1 x Fattoush');
  });

  it('omits the hall name when none is given', () => {
    const bytes = buildDepartmentTicket({
      departmentName: 'Bar',
      tableNumber: 'T5',
      items: [{ name: 'Mojito', quantity: 1 }],
      timestamp: '2026-01-01T12:00:00Z',
    });
    const text = decode(bytes);

    expect(text).toContain('Table T5');
    expect(text).not.toContain('·');
  });
});

describe('buildFullBillTicket', () => {
  it('includes the grand total, tax line, staff name, weight, and both timestamps when a table is closed', () => {
    const bytes = buildFullBillTicket({
      tableNumber: 'T1',
      hallName: 'Main Hall',
      items: [{ name: 'Caesar Salad', weight: '350g', quantity: 2, subtotal: '20.00' }],
      subtotal: '20.00',
      taxRate: 10,
      taxAmount: 2,
      serviceChargeRate: 5,
      serviceChargeAmount: 1,
      grandTotal: 23,
      currency: 'USD',
      openedAt: '2026-01-01T12:00:00Z',
      closedAt: '2026-01-01T13:00:00Z',
      staffName: 'Demo Owner',
    });
    const text = decode(bytes);

    expect(text).toContain('BILL');
    expect(text).toContain('(350g)');
    expect(text).toContain('Subtotal: USD 20.00');
    expect(text).toContain('Tax (10%): USD 2.00');
    expect(text).toContain('Service charge (5%): USD 1.00');
    expect(text).toContain('TOTAL: USD 23.00');
    expect(text).toContain('Served by: Demo Owner');
    expect(text).toContain('Opened:');
    expect(text).toContain('Closed:');
  });

  it('omits the tax and service charge lines when both rates are 0, and the closed line for a still-open table', () => {
    const bytes = buildFullBillTicket({
      tableNumber: 'T1',
      items: [{ name: 'Mojito', quantity: 1, subtotal: '6.00' }],
      subtotal: '6.00',
      taxRate: 0,
      taxAmount: 0,
      serviceChargeRate: 0,
      serviceChargeAmount: 0,
      grandTotal: 6,
      currency: 'USD',
      openedAt: '2026-01-01T12:00:00Z',
    });
    const text = decode(bytes);

    expect(text).not.toContain('Tax (');
    expect(text).not.toContain('Service charge (');
    expect(text).not.toContain('Closed:');
    expect(text).toContain('TOTAL: USD 6.00');
  });
});

describe('bytesToBase64', () => {
  it('round-trips arbitrary bytes, including ones outside the printable ASCII range', () => {
    const original = new Uint8Array([0x1b, 0x40, 0x00, 0xff, 0x0a, 0x1d, 0x56]);
    const encoded = bytesToBase64(original);
    const decoded = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));

    expect(decoded).toEqual(original);
  });
});
