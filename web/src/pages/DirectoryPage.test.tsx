import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DirectoryPage from './DirectoryPage';
import api from '../api/axios';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const mockedApi = vi.mocked(api, true);

const restaurant = {
  tenant_name: 'Demo Restaurant', tenant_slug: 'demo-restaurant', logo_path: null,
  description: null, branch_id: 1, address: '123 Culinary Ave', city: 'Beirut', country: 'LB',
  rating_average: 4.7, rating_count: 3,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.get.mockImplementation((url: string) => {
    if (url === '/v1/directory/filters') return Promise.resolve({ data: { LB: ['Beirut'] } });
    if (url === '/v1/directory/restaurants') return Promise.resolve({ data: { data: [restaurant] } });
    if (url === '/v1/ads') return Promise.resolve({ data: [] });
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
});

describe('DirectoryPage', () => {
  it('lists restaurants returned by the API', async () => {
    render(<MemoryRouter><DirectoryPage /></MemoryRouter>);

    expect(await screen.findByText('Demo Restaurant')).toBeInTheDocument();
    expect(screen.getByText('Beirut, LB')).toBeInTheDocument();
  });

  it('re-fetches restaurants when a city filter is chosen', async () => {
    render(<MemoryRouter><DirectoryPage /></MemoryRouter>);
    await screen.findByText('Demo Restaurant');

    const citySelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(citySelect, { target: { value: 'Beirut' } });

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledWith('/v1/directory/restaurants', {
        params: { city: 'Beirut', per_page: 10, page: 1 },
      });
    });
  });
});
