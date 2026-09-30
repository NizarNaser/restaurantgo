import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from './RegisterPage';
import api from '../api/axios';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const mockedApi = vi.mocked(api, true);

beforeEach(() => {
  vi.clearAllMocks();
});

const PLANS = [
  { id: 1, name: 'Starter', slug: 'starter', description: null, price_monthly: 19, price_yearly: 190, currency: 'USD', max_branches: 1, max_menu_items: 50, max_users: 3, has_custom_domain: false, has_white_label: false, has_advanced_reports: false },
  { id: 2, name: 'Pro', slug: 'pro', description: null, price_monthly: 49, price_yearly: 490, currency: 'USD', max_branches: 5, max_menu_items: 500, max_users: 15, has_custom_domain: true, has_white_label: false, has_advanced_reports: true },
];

async function goToDetailsStep() {
  await waitFor(() => expect(screen.getByText('Starter')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await waitFor(() => expect(screen.getByPlaceholderText('Restaurant name')).toBeInTheDocument());
}

function fillForm() {
  fireEvent.change(screen.getByPlaceholderText('Restaurant name'), { target: { value: 'Test Bistro' } });
  fireEvent.change(screen.getByPlaceholderText('Subdomain (e.g. my-restaurant)'), { target: { value: 'test-bistro' } });
  fireEvent.change(screen.getByPlaceholderText('Your full name'), { target: { value: 'Jane Owner' } });
  fireEvent.change(screen.getByPlaceholderText('Email address'), { target: { value: 'jane@example.com' } });
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'Passw0rd123' } });
  fireEvent.change(screen.getByPlaceholderText('Confirm password'), { target: { value: 'Passw0rd123' } });
}

describe('RegisterPage', () => {
  beforeEach(() => {
    mockedApi.get.mockResolvedValue({ data: { data: PLANS } });
  });

  it('lets the user pick a plan before filling in the registration form', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: {} });

    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Pro')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Pro'));
    await goToDetailsStep();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByText('Your account was created!')).toBeInTheDocument();
    });
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({
      subdomain: 'test-bistro',
      locale: 'en',
      supported_locales: ['en'],
      plan_id: 2,
    }));
  });

  it('defaults to the Starter plan and submits the signup form', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: {} });

    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    await goToDetailsStep();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByText('Your account was created!')).toBeInTheDocument();
    });
    expect(mockedApi.post).toHaveBeenCalledWith('/auth/register', expect.objectContaining({
      subdomain: 'test-bistro',
      locale: 'en',
      supported_locales: ['en'],
      plan_id: 1,
    }));
  });

  it('shows validation errors returned by the API', async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: { data: { errors: { subdomain: ['This subdomain is already taken.'] } } },
    });

    render(<MemoryRouter><RegisterPage /></MemoryRouter>);
    await goToDetailsStep();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(screen.getByText('This subdomain is already taken.')).toBeInTheDocument();
    });
  });
});
