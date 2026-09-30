import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReservationsPage from './ReservationsPage';
import api from '../api/axios';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), put: vi.fn() },
}));

const mockedApi = vi.mocked(api, true);

const reservations = [
  {
    id: 1,
    type: 'table',
    customer_name: 'Layla H.',
    customer_email: null,
    customer_phone: '+961 70 000 000',
    party_size: 4,
    event_name: null,
    reserved_at: '2026-09-10T19:00:00Z',
    duration_minutes: 90,
    status: 'pending',
    notes: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.get.mockResolvedValue({
    data: { data: reservations, current_page: 1, last_page: 1, total: 1 },
  });
});

describe('ReservationsPage', () => {
  it('renders reservations from the API', async () => {
    render(<ReservationsPage />);

    expect(await screen.findByText('Layla H.')).toBeInTheDocument();
    expect(screen.getByText('+961 70 000 000')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('confirms a reservation and updates its status', async () => {
    mockedApi.put.mockResolvedValue({ data: { ...reservations[0], status: 'confirmed' } });

    render(<ReservationsPage />);
    await screen.findByText('Layla H.');

    fireEvent.click(screen.getByTitle('Confirm'));

    await waitFor(() => {
      expect(mockedApi.put).toHaveBeenCalledWith('/reservations/1', { status: 'confirmed' });
    });
    expect(await screen.findByText('confirmed')).toBeInTheDocument();
  });

  it('refetches with a status filter when the dropdown changes', async () => {
    render(<ReservationsPage />);
    await screen.findByText('Layla H.');

    fireEvent.change(screen.getByDisplayValue('All statuses'), { target: { value: 'confirmed' } });

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenLastCalledWith('/reservations', {
        params: { status: 'confirmed', page: 1 },
      });
    });
  });
});
