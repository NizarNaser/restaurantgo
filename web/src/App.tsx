import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import PublicLayout from './layouts/PublicLayout';
import AdminLayout from './layouts/AdminLayout';

const HomePage = lazy(() => import('./pages/HomePage'));
const DirectoryPage = lazy(() => import('./pages/DirectoryPage'));
const RestaurantDetailPage = lazy(() => import('./pages/RestaurantDetailPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));

const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'));
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage'));
const TenantsPage = lazy(() => import('./pages/admin/TenantsPage'));
const PaymentsPage = lazy(() => import('./pages/admin/PaymentsPage'));
const PlansPage = lazy(() => import('./pages/admin/PlansPage'));
const CouponsPage = lazy(() => import('./pages/admin/CouponsPage'));
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage'));
const StaffPage = lazy(() => import('./pages/admin/StaffPage'));
const StaffAttendancePage = lazy(() => import('./pages/admin/StaffAttendancePage'));
const StaffPayrollPage = lazy(() => import('./pages/admin/StaffPayrollPage'));
const AdvertisementsPage = lazy(() => import('./pages/admin/AdvertisementsPage'));
const ContactMessagesPage = lazy(() => import('./pages/admin/ContactMessagesPage'));
const PlatformSeoPage = lazy(() => import('./pages/admin/PlatformSeoPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-[var(--color-primary)]" size={32} />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/restaurants" element={<DirectoryPage />} />
            <Route path="/restaurants/:slug" element={<RestaurantDetailPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          <Route path="/admin/login" element={<AdminLoginPage />} />

          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminOverviewPage />} />
            <Route path="/admin/tenants" element={<TenantsPage />} />
            <Route path="/admin/payments" element={<PaymentsPage />} />
            <Route path="/admin/plans" element={<PlansPage />} />
            <Route path="/admin/coupons" element={<CouponsPage />} />
            <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
            <Route path="/admin/staff" element={<StaffPage />} />
            <Route path="/admin/staff/attendance" element={<StaffAttendancePage />} />
            <Route path="/admin/staff/payroll" element={<StaffPayrollPage />} />
            <Route path="/admin/advertisements" element={<AdvertisementsPage />} />
            <Route path="/admin/contact-messages" element={<ContactMessagesPage />} />
            <Route path="/admin/seo" element={<PlatformSeoPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
