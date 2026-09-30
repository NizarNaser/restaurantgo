import { useEffect, useState } from 'react';
import { Loader2, Users, Phone, Mail, Calendar, Clock, PartyPopper, Check, X, CheckCheck } from 'lucide-react';
import api from '../api/axios';

type Status = 'pending' | 'confirmed' | 'cancelled' | 'completed';

interface Reservation {
  id: number;
  type: 'table' | 'event';
  customer_name: string;
  customer_email: string | null;
  customer_phone: string;
  party_size: number;
  event_name: string | null;
  reserved_at: string;
  duration_minutes: number | null;
  status: Status;
  notes: string | null;
}

interface PaginatedResponse {
  data: Reservation[];
  current_page: number;
  last_page: number;
  total: number;
}

const STATUS_STYLES: Record<Status, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
  completed: 'bg-blue-100 text-blue-700',
};

const STATUS_ACTIONS: { status: Status; label: string; icon: typeof Check }[] = [
  { status: 'confirmed', label: 'Confirm', icon: Check },
  { status: 'completed', label: 'Mark completed', icon: CheckCheck },
  { status: 'cancelled', label: 'Cancel', icon: X },
];

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'' | Status>('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    fetchReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page]);

  const fetchReservations = async () => {
    setLoading(true);
    try {
      const res = await api.get<PaginatedResponse>('/reservations', {
        params: { status: statusFilter || undefined, page },
      });
      setReservations(res.data.data);
      setLastPage(res.data.last_page);
    } catch (error) {
      console.error('Failed to fetch reservations', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (reservation: Reservation, status: Status) => {
    setUpdatingId(reservation.id);
    try {
      await api.put(`/reservations/${reservation.id}`, { status });
      setReservations((prev) =>
        prev.map((r) => (r.id === reservation.id ? { ...r, status } : r)),
      );
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Failed to update the reservation.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reservations</h2>
          <p className="text-sm text-gray-500">
            Table and event bookings coming in from your restaurant's public page.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setPage(1);
            setStatusFilter(e.target.value as '' | Status);
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-700"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-[#ff4757]" size={32} />
          </div>
        ) : reservations.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Calendar size={32} className="mx-auto mb-3 text-gray-300" />
            No reservations{statusFilter ? ` with status "${statusFilter}"` : ''} yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Guest</th>
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-5 py-3 font-medium">Party</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reservations.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 align-top">
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-900">{r.customer_name}</div>
                      <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Phone size={12} />
                        {r.customer_phone}
                      </div>
                      {r.customer_email && (
                        <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <Mail size={12} />
                          {r.customer_email}
                        </div>
                      )}
                      {r.notes && (
                        <div className="text-xs text-gray-500 mt-1 max-w-xs">{r.notes}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} className="text-gray-400" />
                        {new Date(r.reserved_at).toLocaleString()}
                      </div>
                      {r.type === 'event' && r.event_name && (
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                          <PartyPopper size={12} />
                          {r.event_name}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      <div className="flex items-center gap-1.5">
                        <Users size={14} className="text-gray-400" />
                        {r.party_size}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {updatingId === r.id ? (
                          <Loader2 size={16} className="animate-spin text-gray-400" />
                        ) : (
                          STATUS_ACTIONS.filter((a) => a.status !== r.status).map((action) => (
                            <button
                              key={action.status}
                              onClick={() => updateStatus(r, action.status)}
                              title={action.label}
                              className={`p-2 rounded-lg hover:bg-gray-100 ${
                                action.status === 'cancelled'
                                  ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                  : action.status === 'confirmed'
                                  ? 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                                  : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                              }`}
                            >
                              <action.icon size={16} />
                            </button>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {lastPage}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page >= lastPage}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
