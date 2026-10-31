import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import ShiftGate from './ShiftGate';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

vi.mock('../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const mockedApi = vi.mocked(api, true);
const manager = { id: 1, name: 'Manager', permissions: ['manage shifts'] } as never;
const PROMPT = 'Start a new shift?';

const renderGate = (path = '/dashboard') => render(
  <MemoryRouter initialEntries={[path]}>
    <Link to="/dashboard">go to dashboard</Link>
    <ShiftGate />
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: manager });
});

describe('ShiftGate', () => {
  it('prompts when no shift is open', async () => {
    mockedApi.get.mockResolvedValue({ data: {} });
    renderGate();

    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
  });

  it('stays hidden when a shift is already open', async () => {
    mockedApi.get.mockResolvedValue({ data: { id: 7, status: 'open' } });
    renderGate();

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledWith('/shifts/current'));
    await act(async () => {});
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  it('stays hidden when the check fails', async () => {
    mockedApi.get.mockRejectedValue(new Error('network'));
    renderGate();

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  it('does not prompt for a shift opened elsewhere after the layout mounted', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: {} });
    renderGate('/orders');
    expect(await screen.findByText(PROMPT)).toBeInTheDocument();

    mockedApi.get.mockResolvedValue({ data: { id: 7, status: 'open' } });
    fireEvent.click(screen.getByText('go to dashboard'));

    await waitFor(() => expect(mockedApi.get).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(screen.queryByText(PROMPT)).not.toBeInTheDocument();
  });

  it('checks once the user loads after an app restart', async () => {
    useAuthStore.setState({ user: null });
    mockedApi.get.mockResolvedValue({ data: {} });
    renderGate();
    expect(mockedApi.get).not.toHaveBeenCalled();

    act(() => useAuthStore.setState({ user: manager }));

    expect(await screen.findByText(PROMPT)).toBeInTheDocument();
  });

  it('goes away after starting a shift from the prompt', async () => {
    mockedApi.get.mockResolvedValue({ data: {} });
    mockedApi.post.mockResolvedValue({ data: { id: 8, status: 'open' } });
    renderGate();

    fireEvent.click(await screen.findByText('Start shift'));

    await waitFor(() => expect(screen.queryByText(PROMPT)).not.toBeInTheDocument());
    expect(mockedApi.post).toHaveBeenCalledWith('/shifts/open', {});
  });
});
