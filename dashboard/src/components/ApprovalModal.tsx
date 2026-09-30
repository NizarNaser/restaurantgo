import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import Modal from './Modal';

/**
 * Step-up authentication for sensitive actions (approving a discount) that
 * any staff member can request but only an owner/manager can approve.
 * Either the currently logged-in user proves it's them (their own password —
 * only offered if they actually hold that role), or a different owner/manager
 * physically present authenticates with their card's access code (the
 * shared-terminal case).
 */
export default function ApprovalModal({
  isOpen, onClose, title, onApprove,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onApprove: (credential: { password?: string; access_code?: string }) => Promise<void>;
}) {
  const hasRole = useAuthStore((s) => s.hasRole);
  const canUseOwnPassword = hasRole('owner') || hasRole('manager');
  const [tab, setTab] = useState<'password' | 'code'>(canUseOwnPassword ? 'password' : 'code');
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onApprove(tab === 'password' ? { password: value } : { access_code: value });
      setValue('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not verify this credential.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <ShieldCheck size={14} /> Requires an owner or manager's approval.
        </p>
        {canUseOwnPassword && (
          <div className="flex border-b border-gray-200 mb-2">
            <button type="button" onClick={() => setTab('password')} className={`px-3 py-1.5 text-xs font-medium ${tab === 'password' ? 'text-[#ff4757] border-b-2 border-[#ff4757]' : 'text-gray-500'}`}>My password</button>
            <button type="button" onClick={() => setTab('code')} className={`px-3 py-1.5 text-xs font-medium ${tab === 'code' ? 'text-[#ff4757] border-b-2 border-[#ff4757]' : 'text-gray-500'}`}>Access code</button>
          </div>
        )}
        <input
          type={tab === 'password' ? 'password' : 'text'}
          required
          autoFocus
          placeholder={tab === 'password' ? 'Your password' : "Owner/manager's access code"}
          className="input w-full"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button type="submit" disabled={submitting} className="btn btn-primary w-full flex items-center justify-center gap-2">
          {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Approve'}
        </button>
      </form>
    </Modal>
  );
}
