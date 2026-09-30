# منصة RestaurantGo — الخطة الهندسية الشاملة

## 1. مخطط قاعدة البيانات (ERD)

### جداول Multi-Tenancy الأساسية

```sql
-- المطاعم / Tenants
tenants
  id, ulid, name, slug, custom_domain, subdomain
  plan_id, trial_ends_at, status (active|suspended|cancelled)
  timezone, default_currency, default_locale
  created_at, updated_at, deleted_at

-- خطط الاشتراك
plans
  id, name (Starter|Pro|Enterprise), slug
  price_monthly, price_yearly, currency
  max_branches, max_menu_items, max_users
  has_custom_domain, has_white_label, has_advanced_reports
  stripe_price_id_monthly, stripe_price_id_yearly

-- اشتراكات المطاعم
subscriptions
  id, tenant_id, plan_id
  stripe_subscription_id, paddle_subscription_id
  status, current_period_start, current_period_end
  trial_ends_at, canceled_at
  created_at, updated_at

-- المستخدمون (مرتبطون بـ tenant)
users
  id, tenant_id, name, email, password
  role (owner|manager|staff|viewer)
  phone, avatar, locale, timezone
  two_factor_secret, two_factor_confirmed_at
  last_login_at, created_at, updated_at

-- الفروع
branches
  id, tenant_id, name, address, city, country, phone
  latitude, longitude, google_place_id
  working_hours (JSON), is_active
  created_at, updated_at
```

### جداول القوائم والمحتوى

```sql
-- تصنيفات القائمة
menu_categories
  id, tenant_id, branch_id (nullable=all branches)
  parent_id (for subcategories), sort_order, is_active
  image_path, created_at, updated_at

-- ترجمات التصنيفات
menu_category_translations
  id, menu_category_id, locale
  name, description

-- أصناف القائمة
menu_items
  id, tenant_id, menu_category_id
  sku, base_price, calories, prep_time_minutes
  is_available, is_featured, sort_order
  video_url, tags (JSON: vegetarian|vegan|gluten_free|spicy|halal)
  seo_title, seo_description, seo_og_image
  created_at, updated_at, deleted_at

-- ترجمات الأصناف
menu_item_translations
  id, menu_item_id, locale
  name, description, ingredients

-- أسعار متعددة العملات
menu_item_prices
  id, menu_item_id, currency, price, updated_at

-- صور الأصناف
menu_item_media
  id, menu_item_id, path, type (image|video), sort_order, alt_text

-- المقالات / المدونة
articles
  id, tenant_id, branch_id (nullable)
  author_id, status (draft|published|scheduled)
  featured_image, publish_at
  seo_title, seo_description, seo_og_image
  created_at, updated_at, deleted_at

-- ترجمات المقالات
article_translations
  id, article_id, locale
  title, slug, content (longtext), excerpt

-- تقييمات العملاء
reviews
  id, tenant_id, menu_item_id (nullable), branch_id (nullable)
  customer_name, customer_email, rating (1-5), comment
  is_approved, created_at
```

### جداول الإدارة المالية

```sql
-- الموظفون
employees
  id, tenant_id, branch_id
  name, national_id, phone, email
  position, base_salary, currency
  hire_date, status (active|inactive)
  bank_account (encrypted), created_at, updated_at

-- أوقات الدوام
attendance_records
  id, tenant_id, employee_id, branch_id
  check_in, check_out, type (manual|biometric|api)
  notes, created_by, created_at

-- كشوف الرواتب
payroll_runs
  id, tenant_id, branch_id
  period_start, period_end, currency
  status (draft|approved|paid), processed_at
  created_by, approved_by

payroll_items
  id, payroll_run_id, employee_id
  base_salary, overtime_pay, bonuses
  deductions, net_salary, notes

-- الإيرادات
revenues
  id, tenant_id, branch_id
  amount, currency, category
  description, date, reference_number
  created_by, created_at

-- المصاريف
expenses
  id, tenant_id, branch_id
  amount, currency, category
  description, date, vendor
  receipt_path, created_by, created_at

-- فئات المصاريف/الإيرادات
financial_categories
  id, tenant_id, type (revenue|expense)
  name, color, icon, is_active

-- أسعار الصرف اليومية
exchange_rates
  id, base_currency, target_currency
  rate, date, source (api|manual)
```

### جداول النظام

```sql
-- سجل التدقيق
audit_logs
  id, tenant_id, user_id
  action, model_type, model_id
  old_values (JSON), new_values (JSON)
  ip_address, user_agent, created_at

-- إشعارات
notifications
  id, tenant_id, user_id
  type, channel (email|sms|push|database)
  title, body, data (JSON)
  read_at, sent_at, created_at

-- أكواد QR
qr_codes
  id, tenant_id, branch_id, menu_category_id (nullable)
  type (menu|item|table), target_url
  image_path, scan_count, created_at

-- كوبونات خصم
coupons
  id, tenant_id, code, type (percent|fixed)
  value, currency, max_uses, used_count
  expires_at, is_active, created_at
```

---

## 2. هيكل مشروع Laravel API

```
restaurantgo-api/
├── app/
│   ├── Console/Commands/
│   │   ├── ProcessPayroll.php
│   │   ├── UpdateExchangeRates.php
│   │   └── GenerateSitemaps.php
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Auth/
│   │   │   │   ├── LoginController.php
│   │   │   │   ├── RegisterController.php
│   │   │   │   └── TwoFactorController.php
│   │   │   ├── Tenant/
│   │   │   │   ├── MenuCategoryController.php
│   │   │   │   ├── MenuItemController.php
│   │   │   │   ├── ArticleController.php
│   │   │   │   ├── BranchController.php
│   │   │   │   ├── EmployeeController.php
│   │   │   │   ├── AttendanceController.php
│   │   │   │   ├── PayrollController.php
│   │   │   │   ├── RevenueController.php
│   │   │   │   ├── ExpenseController.php
│   │   │   │   ├── ReviewController.php
│   │   │   │   ├── QrCodeController.php
│   │   │   │   └── ReportController.php
│   │   │   ├── Subscription/
│   │   │   │   ├── PlanController.php
│   │   │   │   ├── SubscriptionController.php
│   │   │   │   └── WebhookController.php
│   │   │   ├── Public/
│   │   │   │   ├── RestaurantController.php
│   │   │   │   ├── MenuController.php
│   │   │   │   └── ArticleController.php
│   │   │   └── SuperAdmin/
│   │   │       ├── TenantController.php
│   │   │       ├── PlanController.php
│   │   │       └── SupportController.php
│   │   ├── Middleware/
│   │   │   ├── IdentifyTenant.php
│   │   │   ├── CheckSubscription.php
│   │   │   └── EnforceLocale.php
│   │   ├── Requests/
│   │   │   ├── MenuItemRequest.php
│   │   │   ├── EmployeeRequest.php
│   │   │   └── ...
│   │   └── Resources/
│   │       ├── MenuItemResource.php
│   │       ├── MenuItemCollection.php
│   │       └── ...
│   ├── Models/
│   │   ├── Tenant.php          # HasMany users, branches, menus
│   │   ├── User.php            # BelongsTo tenant
│   │   ├── Branch.php
│   │   ├── MenuItem.php        # HasMany translations, prices, media
│   │   ├── Article.php
│   │   ├── Employee.php
│   │   ├── PayrollRun.php
│   │   └── ...
│   ├── Jobs/
│   │   ├── GeneratePdfReport.php
│   │   ├── ExportExcelReport.php
│   │   ├── SendPayrollNotification.php
│   │   └── SyncGoogleBusiness.php
│   ├── Services/
│   │   ├── TenantService.php
│   │   ├── PayrollService.php
│   │   ├── ExchangeRateService.php
│   │   ├── SeoService.php
│   │   └── StripeService.php
│   └── Policies/
│       ├── MenuItemPolicy.php
│       ├── EmployeePolicy.php
│       └── ...
├── database/migrations/
├── routes/
│   ├── api.php          # /api/v1/...
│   ├── web.php          # sitemap, robots.txt, public pages
│   └── channels.php
└── config/
    ├── multitenancy.php
    └── plans.php
```

---

## 3. هيكل مشروع React (لوحة التحكم)

```
restaurantgo-dashboard/
├── src/
│   ├── api/
│   │   ├── client.ts          # Axios instance + interceptors
│   │   ├── auth.ts
│   │   ├── menu.ts
│   │   ├── financial.ts
│   │   └── subscription.ts
│   ├── components/
│   │   ├── ui/                # shadcn/ui base components
│   │   ├── charts/
│   │   │   ├── RevenueChart.tsx
│   │   │   ├── ExpenseBreakdown.tsx
│   │   │   └── TopItemsChart.tsx
│   │   ├── menu/
│   │   │   ├── MenuItemForm.tsx
│   │   │   ├── MenuItemCard.tsx
│   │   │   └── CategoryTree.tsx
│   │   ├── financial/
│   │   │   ├── PayrollTable.tsx
│   │   │   ├── AttendanceCalendar.tsx
│   │   │   └── TransactionForm.tsx
│   │   └── layout/
│   │       ├── Sidebar.tsx
│   │       ├── TopBar.tsx
│   │       └── TenantSwitcher.tsx
│   ├── pages/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx
│   │   ├── menu/
│   │   │   ├── MenuItemsPage.tsx
│   │   │   └── CategoriesPage.tsx
│   │   ├── articles/
│   │   ├── employees/
│   │   ├── attendance/
│   │   ├── payroll/
│   │   ├── financial/
│   │   │   ├── RevenuesPage.tsx
│   │   │   └── ExpensesPage.tsx
│   │   ├── reports/
│   │   ├── settings/
│   │   │   ├── GeneralSettings.tsx
│   │   │   ├── SeoSettings.tsx
│   │   │   └── BillingPage.tsx
│   │   └── superadmin/
│   ├── store/
│   │   ├── authSlice.ts
│   │   ├── tenantSlice.ts
│   │   └── notificationSlice.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useTenant.ts
│   │   └── usePermission.ts
│   └── i18n/
│       ├── ar.json
│       ├── en.json
│       └── fr.json
```

---

## 4. قائمة API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | تسجيل مطعم جديد |
| POST | `/api/v1/auth/login` | تسجيل الدخول |
| POST | `/api/v1/auth/logout` | تسجيل الخروج |
| POST | `/api/v1/auth/2fa/enable` | تفعيل 2FA |
| POST | `/api/v1/auth/2fa/verify` | التحقق من 2FA |
| POST | `/api/v1/auth/password/reset` | إعادة تعيين كلمة المرور |

### قائمة الطعام
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/menu/categories` | قائمة التصنيفات |
| POST | `/api/v1/menu/categories` | إنشاء تصنيف |
| PUT | `/api/v1/menu/categories/{id}` | تعديل تصنيف |
| DELETE | `/api/v1/menu/categories/{id}` | حذف تصنيف |
| GET | `/api/v1/menu/items` | قائمة الأصناف |
| POST | `/api/v1/menu/items` | إنشاء صنف |
| PUT | `/api/v1/menu/items/{id}` | تعديل صنف |
| DELETE | `/api/v1/menu/items/{id}` | حذف صنف |
| POST | `/api/v1/menu/items/{id}/media` | رفع صور/فيديو |
| PUT | `/api/v1/menu/items/{id}/prices` | تحديث الأسعار متعددة العملات |
| POST | `/api/v1/menu/items/{id}/translations` | إضافة ترجمة |

### المقالات
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/articles` | قائمة المقالات |
| POST | `/api/v1/articles` | إنشاء مقالة |
| PUT | `/api/v1/articles/{id}` | تعديل مقالة |
| DELETE | `/api/v1/articles/{id}` | حذف مقالة |
| POST | `/api/v1/articles/{id}/publish` | نشر مقالة |

### الموظفون والرواتب
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/employees` | قائمة الموظفين |
| POST | `/api/v1/employees` | إضافة موظف |
| PUT | `/api/v1/employees/{id}` | تعديل موظف |
| POST | `/api/v1/attendance/checkin` | تسجيل حضور |
| POST | `/api/v1/attendance/checkout` | تسجيل انصراف |
| GET | `/api/v1/attendance` | سجل الحضور |
| POST | `/api/v1/payroll/run` | إنشاء كشف راتب |
| GET | `/api/v1/payroll/{id}` | عرض كشف راتب |
| POST | `/api/v1/payroll/{id}/approve` | اعتماد كشف الراتب |
| GET | `/api/v1/payroll/{id}/export/pdf` | تصدير PDF |

### المالية
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/revenues` | الإيرادات |
| POST | `/api/v1/revenues` | إضافة إيراد |
| GET | `/api/v1/expenses` | المصاريف |
| POST | `/api/v1/expenses` | إضافة مصروف |
| GET | `/api/v1/reports/summary` | ملخص مالي |
| GET | `/api/v1/reports/profit-loss` | تقرير الأرباح والخسائر |
| GET | `/api/v1/reports/export` | تصدير Excel/PDF |
| GET | `/api/v1/exchange-rates` | أسعار الصرف الحالية |

### الاشتراكات
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/plans` | خطط الاشتراك |
| POST | `/api/v1/subscription/checkout` | إنشاء جلسة دفع Stripe |
| GET | `/api/v1/subscription` | اشتراكي الحالي |
| POST | `/api/v1/subscription/cancel` | إلغاء الاشتراك |
| POST | `/api/v1/subscription/resume` | استئناف الاشتراك |
| POST | `/api/v1/webhooks/stripe` | Stripe Webhook |
| POST | `/api/v1/coupons/validate` | التحقق من كوبون |

### الصفحات العامة (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/public/{slug}/info` | معلومات المطعم |
| GET | `/api/v1/public/{slug}/menu` | القائمة العامة |
| GET | `/api/v1/public/{slug}/articles` | مقالات المطعم |
| GET | `/api/v1/public/{slug}/articles/{articleSlug}` | مقالة واحدة |
| POST | `/api/v1/public/{slug}/reviews` | إضافة تقييم |

### Super Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/tenants` | كل المطاعم |
| PUT | `/api/v1/admin/tenants/{id}/suspend` | تعليق مطعم |
| GET | `/api/v1/admin/metrics` | إحصائيات المنصة |

---

## 5. خارطة الطريق (Roadmap)

### 🚀 Sprint 1 — الأساس (أسابيع 1-3)
- [ ] إعداد Laravel + PostgreSQL + Redis
- [ ] نظام Multi-tenancy (subdomain + middleware)
- [ ] نظام المصادقة (Sanctum + 2FA)
- [ ] RBAC بـ Spatie Permissions
- [ ] نماذج قاعدة البيانات والـ Migrations
- [ ] إعداد React + TypeScript + Zustand
- [ ] Layout الرئيسي للوحة التحكم

### 🍽️ Sprint 2 — إدارة القوائم (أسابيع 4-6)
- [ ] CRUD التصنيفات والأصناف
- [ ] رفع الصور بـ Spatie Media Library
- [ ] دعم تعدد اللغات (i18n) للأصناف
- [ ] أسعار متعددة العملات
- [ ] QR Code تلقائي لكل قائمة
- [ ] الصفحة العامة للمطعم (SSR/Next.js)

### ✍️ Sprint 3 — المحتوى والسيو (أسابيع 7-8) ✅
- [x] نظام المدونة/المقالات
- [x] تحرير Meta/OG لكل صفحة
- [x] توليد sitemap.xml تلقائي
- [x] Schema.org structured data
- [x] Hreflang للمحتوى متعدد اللغات
- [x] Canonical URLs

### 💰 Sprint 4 — الاشتراكات والدفع (أسابيع 9-10) ✅
- [x] إعداد Stripe + خطط الاشتراك
- [x] Free Trial + كوبونات
- [x] Stripe Webhooks (تجديد، إلغاء، فشل دفع)
- [x] Billing Portal في لوحة التحكم
- [x] حماية routes بـ CheckSubscription middleware

### 👥 Sprint 5 — إدارة الموظفين (أسابيع 11-13) ✅
- [x] CRUD الموظفين
- [x] تسجيل الحضور والانصراف
- [x] احتساب الرواتب التلقائي
- [x] كشوف الرواتب وتصدير PDF

### 📊 Sprint 6 — التحليلات المالية (أسابيع 14-16) ✅
- [x] تسجيل الإيرادات والمصاريف
- [x] لوحة الرسوم البيانية (Recharts)
- [x] تقارير الأرباح والخسائر
- [x] تصدير Excel
- [x] تكامل أسعار الصرف اليومية (API)

### 🛡️ Sprint 7 — الأمان والجودة (أسابيع 17-18) ✅
- [x] Audit Log لكل العمليات الحساسة
- [x] GDPR: تصدير/حذف البيانات
- [x] اختبارات Pest (Backend) + Vitest (Frontend، بديل Jest المتوافق مع Vite)
- [x] CI/CD بـ GitHub Actions (ملف workflow جاهز؛ بانتظار `git init` + remote من طرفك لتفعيله)
- [x] توثيق API بـ Swagger/OpenAPI (Scribe — `/docs` و`/docs.openapi`)
- [x] Laravel Telescope (فعّال محليًا) + Sentry (مُجهّز، بانتظار SENTRY_LARAVEL_DSN)

### 🌍 Sprint 8 — لوحة السوبر أدمن (أسبوع 19-20)
- [ ] إدارة كل المستأجرين
- [ ] مراقبة الاستخدام والإحصائيات
- [ ] أدوات الدعم الفني
- [ ] Custom Domain management

### 🔮 مراحل مستقبلية (Post-MVP)
- QR Ordering (طلب عبر الجوال)
- White-label كامل للـ Enterprise
- تكامل Google Business Profile
- Public API + Webhooks
- Embeddable Widget
- Online Ordering + عمولات
- Paddle (Merchant of Record للضرائب العالمية)

---

## 6. متغيرات البيئة (.env)

```env
APP_NAME=RestaurantGo
APP_URL=https://platform.restaurantgo.com

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_DATABASE=restaurantgo

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

STRIPE_KEY=pk_live_...
STRIPE_SECRET=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

EXCHANGE_RATE_API_KEY=...
MEILISEARCH_HOST=http://meilisearch:7700

MAIL_MAILER=ses
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=eu-west-1
AWS_BUCKET=restaurantgo-media

SENTRY_LARAVEL_DSN=https://...
```

---

## 7. قرارات تقنية مهمة

| القرار | الخيار المختار | السبب |
|--------|---------------|-------|
| Multi-tenancy | Row-level (tenant_id) + DB منفصلة للـ Enterprise | توازن بين التكلفة والعزل |
| Auth | Laravel Sanctum + 2FA | بسيط، آمن، يدعم SPA |
| Media | Spatie Media Library + S3 | موثوق، يدعم تحويلات الصور |
| Search | Laravel Scout + Meilisearch | سريع، يدعم العربية |
| Payments | Stripe MVP، Paddle لاحقاً | Stripe أوسع انتشاراً، Paddle يحل الضرائب |
| SSR | Next.js منفصل للصفحات العامة | أفضل SEO وأداء |
| Queue | Redis + Laravel Horizon | مراقبة عمليات الـ Queue بسهولة |
| Permissions | Spatie Laravel Permission | معيار صناعي في Laravel |
