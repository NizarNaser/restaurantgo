import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MenuPage from './MenuPage';
import api from '../api/axios';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const mockedApi = vi.mocked(api, true);

const categories = [{ id: 1, name: 'Mains', items_count: 1 }];

const items = [
  {
    id: 10,
    name: 'Margherita Pizza',
    description: 'Classic',
    weight: null,
    is_available: true,
    is_featured: false,
    price: 12.5,
    category_id: 1,
    image_url: null,
    translations: [
      { locale: 'en', name: 'Margherita Pizza', description: 'Classic' },
      { locale: 'ar', name: 'بيتزا مارغريتا', description: 'كلاسيكية' },
    ],
    prices: [
      { currency: 'USD', price: 12.5 },
      { currency: 'EUR', price: 11 },
    ],
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <MenuPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.get.mockImplementation((url: string) => {
    if (url === '/menu/categories') return Promise.resolve({ data: { data: categories } });
    if (url === '/menu/items') return Promise.resolve({ data: { data: items } });
    if (url === '/dashboard/stats') return Promise.resolve({ data: { tenant_slug: 'demo-restaurant' } });
    return Promise.reject(new Error(`Unexpected GET ${url}`));
  });
});

describe('MenuPage', () => {
  it('renders items from the API', async () => {
    renderPage();

    expect(await screen.findByText('Margherita Pizza')).toBeInTheDocument();
    expect(screen.getByText('$12.50')).toBeInTheDocument();
  });

  it('creates an item with translations for multiple languages and multiple currency prices', async () => {
    mockedApi.post.mockResolvedValue({ data: { id: 99 } });
    renderPage();

    await screen.findByText('Margherita Pizza');
    fireEvent.click(screen.getByRole('button', { name: /Add Item/i }));

    fireEvent.change(screen.getByPlaceholderText('e.g. Margherita Pizza'), { target: { value: 'Beef Burger' } });

    // Add Arabic as a second language and fill its name in.
    fireEvent.change(screen.getByDisplayValue('+ Add language'), { target: { value: 'ar' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. Margherita Pizza'), { target: { value: 'برغر لحم' } });

    fireEvent.change(screen.getByPlaceholderText('12.99'), { target: { value: '9.5' } });
    fireEvent.click(screen.getByText('+ Add currency'));
    const currencyInputs = screen.getAllByPlaceholderText('USD');
    fireEvent.change(currencyInputs[1], { target: { value: 'eur' } });
    const priceInputs = screen.getAllByPlaceholderText('12.99');
    fireEvent.change(priceInputs[1], { target: { value: '8.7' } });

    fireEvent.change(screen.getByDisplayValue('Select Category'), { target: { value: '1' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Item' }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/menu/items', expect.objectContaining({
      translations: expect.arrayContaining([
        expect.objectContaining({ locale: 'en', name: 'Beef Burger' }),
        expect.objectContaining({ locale: 'ar', name: 'برغر لحم' }),
      ]),
      prices: expect.arrayContaining([
        expect.objectContaining({ currency: 'USD', price: 9.5 }),
        expect.objectContaining({ currency: 'EUR', price: 8.7 }),
      ]),
    })));
  });

  it('loads all existing translations and prices when editing an item', async () => {
    renderPage();

    await screen.findByText('Margherita Pizza');
    fireEvent.click(screen.getByLabelText('Edit Margherita Pizza'));

    // English tab is active by default.
    expect(await screen.findByDisplayValue('Margherita Pizza')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12.5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('11')).toBeInTheDocument();

    // Switch to the Arabic tab and see its own name.
    fireEvent.click(screen.getByRole('button', { name: /العربية/ }));
    expect(await screen.findByDisplayValue('بيتزا مارغريتا')).toBeInTheDocument();
  });
});
