import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FinancialPage from './FinancialPage';
import api from '../api/axios';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const mockedApi = vi.mocked(api, true);

const summary = {
  revenue_this_month: 1800,
  expense_this_month: 1100,
  profit_this_month: 700,
  revenue_last_month: 2200,
  expense_last_month: 950,
  profit_last_month: 1250,
};

const revenues = [
  { id: 1, amount: 1800, currency: 'USD', description: 'Dine-in sales', date: '2026-09-01', reference_number: 'R-3' },
];

const expenses = [
  { id: 1, amount: 1100, currency: 'USD', description: 'Ingredients', date: '2026-09-01', vendor: 'Sysco' },
];

const chartData = [
  { month: '2026-09', label: 'Sep 2026', revenue: 1800, expense: 1100, profit: 700 },
];

const report = {
  from: '2026-01-01',
  to: '2026-09-30',
  rows: [{ month: '2026-09', label: 'Sep 2026', revenue: 1800, expense: 1100, profit: 700 }],
  totals: { revenue: 1800, expense: 1100, profit: 700 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.get.mockImplementation((url: string) => {
    if (url === '/financial/summary') return Promise.resolve({ data: summary });
    if (url === '/financial/revenues') return Promise.resolve({ data: revenues });
    if (url === '/financial/expenses') return Promise.resolve({ data: expenses });
    if (url === '/financial/chart-data') return Promise.resolve({ data: chartData });
    if (url === '/financial/reports/profit-loss') return Promise.resolve({ data: report });
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
});

describe('FinancialPage', () => {
  it('renders summary cards from the API', async () => {
    render(<FinancialPage />);

    expect(await screen.findByText('$1,800.00')).toBeInTheDocument();
    expect(screen.getByText('$1,100.00')).toBeInTheDocument();
  });

  it('switches to the Profit & Loss report tab and shows totals', async () => {
    render(<FinancialPage />);

    await screen.findByText('$1,800.00');
    fireEvent.click(screen.getByRole('button', { name: 'Profit & Loss' }));

    await waitFor(() => {
      expect(screen.getByText(/Total \(/)).toBeInTheDocument();
    });
  });

  it('downloads an Excel export when the button is clicked', async () => {
    mockedApi.get.mockImplementation((url: string, config?: { responseType?: string }) => {
      if (url === '/financial/export/revenues') {
        expect(config?.responseType).toBe('blob');
        return Promise.resolve({ data: new Blob(['x']) });
      }
      if (url === '/financial/summary') return Promise.resolve({ data: summary });
      if (url === '/financial/revenues') return Promise.resolve({ data: revenues });
      if (url === '/financial/expenses') return Promise.resolve({ data: expenses });
      if (url === '/financial/chart-data') return Promise.resolve({ data: chartData });
      if (url === '/financial/reports/profit-loss') return Promise.resolve({ data: report });
      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    render(<FinancialPage />);
    await screen.findByText('$1,800.00');

    fireEvent.click(screen.getByRole('button', { name: /Export Excel/i }));

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/financial/export/revenues', { responseType: 'blob' });
    });
  });
});
