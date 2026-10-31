import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { useAdminAuthStore } from '../store/adminAuthStore';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

beforeEach(() => {
  useAdminAuthStore.setState({
    isAuthenticated: true,
    user: { id: 1, name: 'Admin', email: 'admin@example.com', tenant_id: null, roles: ['super_admin'], permissions: [] },
    hasPermission: () => true,
  });
});

describe('AdminLayout mobile menu', () => {
  it('opens from the header and closes once a link is chosen', async () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<p>overview page</p>} />
            <Route path="tenants" element={<p>tenants page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    const drawer = screen.getByRole('dialog');
    fireEvent.click(within(drawer).getByRole('link', { name: 'Subscribed restaurants' }));

    expect(await screen.findByText('tenants page')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
