import { useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, Pencil, ImagePlus } from 'lucide-react';
import api from '../../api/axios';

interface Ad {
  id: number;
  title: string;
  advertiser_name: string | null;
  image_path: string | null;
  placement: string;
  link_url: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  click_count: number;
}

const placements = [
  { value: 'home_hero', label: 'الصفحة الرئيسية — قسم رئيسي' },
  { value: 'home_sidebar', label: 'الصفحة الرئيسية — جانبي' },
  { value: 'directory_top', label: 'دليل المطاعم — أعلى' },
  { value: 'directory_sidebar', label: 'دليل المطاعم — جانبي' },
];

const emptyForm = { title: '', advertiser_name: '', link_url: '', placement: 'home_hero', starts_at: '', ends_at: '', is_active: true };

export default function AdvertisementsPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchAds = () => {
    setLoading(true);
    api.get('/admin/advertisements').then((res) => setAds(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => { fetchAds(); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImage(file);
    setImagePreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(emptyForm);
    setImage(null);
    setEditingId(null);
    setImagePreview((prev) => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImage(null);
    setImagePreview(null);
    setModalOpen(true);
  };

  const openEdit = (ad: Ad) => {
    setEditingId(ad.id);
    setForm({
      title: ad.title,
      advertiser_name: ad.advertiser_name ?? '',
      link_url: ad.link_url ?? '',
      placement: ad.placement,
      // The API serializes a date-cast column as a full ISO datetime, not
      // the plain YYYY-MM-DD a <input type="date"> requires — the leading
      // 10 characters are that date either way.
      starts_at: ad.starts_at ? ad.starts_at.slice(0, 10) : '',
      ends_at: ad.ends_at ? ad.ends_at.slice(0, 10) : '',
      is_active: ad.is_active,
    });
    setImage(null);
    setImagePreview(ad.image_path);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const url = editingId ? `/admin/advertisements/${editingId}` : '/admin/advertisements';
      // Only switch to multipart when an image was actually picked from
      // the device — plain JSON still works for the common no-creative,
      // text-only ad.
      if (image) {
        const data = new FormData();
        Object.entries(form).forEach(([key, value]) => {
          // FormData stringifies everything — Laravel's `boolean` rule
          // accepts "1"/"0" but not the literal strings "true"/"false"
          // that String(value) would otherwise produce.
          data.append(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
        });
        data.append('image', image);
        // PHP never populates $_FILES for a genuine PUT/PATCH request body —
        // sending this as a POST with Laravel's _method override is what
        // lets the server parse the upload at all on an edit.
        if (editingId) data.append('_method', 'PUT');
        await api.post(url, data, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else if (editingId) {
        await api.put(url, form);
      } else {
        await api.post(url, form);
      }
      closeModal();
      fetchAds();
    } catch (err: any) {
      alert(err.response?.data?.message || 'تعذر حفظ الإعلان.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('حذف هذا الإعلان؟')) return;
    await api.delete(`/admin/advertisements/${id}`);
    fetchAds();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">الإعلانات المدفوعة</h1>
        <button onClick={openCreate} className="btn btn-primary"><Plus size={18} className="ml-2" /> إضافة إعلان</button>
      </div>

      <div className="mt-6 card overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3"></th>
              <th className="px-6 py-3">العنوان</th>
              <th className="px-6 py-3">المعلن</th>
              <th className="px-6 py-3">المكان</th>
              <th className="px-6 py-3">النقرات</th>
              <th className="px-6 py-3">الحالة</th>
              <th className="px-6 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ads.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">لا توجد إعلانات بعد.</td></tr>
            ) : ads.map((ad) => (
              <tr key={ad.id}>
                <td className="px-6 py-4">
                  {ad.image_path ? (
                    <img src={ad.image_path} alt="" className="w-14 h-10 object-cover rounded-lg border border-gray-100" />
                  ) : (
                    <div className="w-14 h-10 rounded-lg bg-gray-50 border border-gray-100" />
                  )}
                </td>
                <td className="px-6 py-4 font-medium text-gray-900">{ad.title}</td>
                <td className="px-6 py-4 text-gray-500">{ad.advertiser_name ?? '-'}</td>
                <td className="px-6 py-4 text-gray-600">{placements.find((p) => p.value === ad.placement)?.label ?? ad.placement}</td>
                <td className="px-6 py-4 text-gray-600">{ad.click_count}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${ad.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {ad.is_active ? 'فعّال' : 'متوقف'}
                  </span>
                </td>
                <td className="px-6 py-4 flex items-center gap-1">
                  <button onClick={() => openEdit(ad)} className="p-1.5 text-gray-400 hover:text-[#ff4757] hover:bg-red-50 rounded-lg"><Pencil size={16} /></button>
                  <button onClick={() => handleDelete(ad.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-semibold">{editingId ? 'تعديل الإعلان' : 'إضافة إعلان'}</h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-3">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                  <ImagePlus size={16} className="text-gray-400" /> صورة الإعلان (اختياري)
                </label>
                {imagePreview ? (
                  <img src={imagePreview} alt="" className="w-full h-28 object-cover rounded-lg border border-gray-200 mb-2" />
                ) : null}
                <input type="file" accept="image/*" onChange={handleImageChange} className="w-full text-sm text-gray-600" />
              </div>
              <input name="title" required placeholder="عنوان الإعلان" className="input" value={form.title} onChange={handleChange} />
              <input name="advertiser_name" placeholder="اسم المعلن (اختياري)" className="input" value={form.advertiser_name} onChange={handleChange} />
              <input name="link_url" type="url" placeholder="رابط الإعلان" className="input" value={form.link_url} onChange={handleChange} />
              <select name="placement" className="input bg-white" value={form.placement} onChange={handleChange}>
                {placements.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input name="starts_at" type="date" className="input" value={form.starts_at} onChange={handleChange} />
                <input name="ends_at" type="date" className="input" value={form.ends_at} onChange={handleChange} />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} /> فعّال
              </label>
              <button type="submit" disabled={submitting} className="btn btn-primary w-full">
                {submitting ? <Loader2 size={18} className="animate-spin" /> : 'حفظ'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
