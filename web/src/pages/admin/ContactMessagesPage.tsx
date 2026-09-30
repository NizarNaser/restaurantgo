import { useEffect, useState } from 'react';
import { Loader2, Trash2, Mail, MailOpen } from 'lucide-react';
import api from '../../api/axios';

interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function ContactMessagesPage() {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = () => {
    setLoading(true);
    api.get('/admin/contact-messages').then((res) => setMessages(res.data.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchMessages(); }, []);

  const markRead = async (id: number) => {
    await api.put(`/admin/contact-messages/${id}/read`);
    fetchMessages();
  };

  const remove = async (id: number) => {
    if (!confirm('حذف هذه الرسالة؟')) return;
    await api.delete(`/admin/contact-messages/${id}`);
    fetchMessages();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">رسائل التواصل</h1>

      <div className="mt-6 space-y-3">
        {messages.length === 0 ? (
          <div className="card p-12 text-center text-gray-400">لا توجد رسائل بعد.</div>
        ) : messages.map((m) => (
          <div key={m.id} className={`card p-5 ${!m.is_read ? 'border-red-200' : ''}`}>
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="flex items-center gap-2">
                  {m.is_read ? <MailOpen size={16} className="text-gray-400" /> : <Mail size={16} className="text-[var(--color-primary)]" />}
                  <p className="font-semibold text-gray-900">{m.subject || 'بدون موضوع'}</p>
                </div>
                <p className="text-sm text-gray-500 mt-1">{m.name} · {m.email}</p>
                <p className="mt-3 text-gray-700 text-sm">{m.message}</p>
                <p className="mt-2 text-xs text-gray-400">{new Date(m.created_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {!m.is_read && (
                  <button onClick={() => markRead(m.id)} className="btn btn-outline text-xs px-3 py-1.5">تعليم كمقروءة</button>
                )}
                <button onClick={() => remove(m.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
