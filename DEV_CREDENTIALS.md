# بيانات الدخول التجريبية (بيئة التطوير المحلية فقط)

هذه بيانات seed data موجودة فقط في قاعدة البيانات المحلية بعد تشغيل `php artisan db:seed`.
لن تعمل في أي بيئة إنتاج حقيقية، ويجب عدم استخدامها هناك.

تم التحقق من هذه القائمة مباشرة من قاعدة البيانات الحالية بتاريخ 2026-09-11 (وليس فقط من كود الـ seeders).

## سوبر أدمن (لوحة الشركة)

- الرابط: `http://localhost:5174/admin/login`
- البريد: `admin@restaurantgo.com`
- كلمة المرور: `password`

الحساب له دور `super_admin` بكل الصلاحيات — مصدره [`PlatformStaffSeeder`](api/database/seeders/PlatformStaffSeeder.php).

## أصحاب المطاعم (لوحة dashboard)

- الرابط: `http://localhost:5173/login`
- كلمة المرور لجميع الحسابات التالية: `password`

| المطعم | البريد الإلكتروني |
|---|---|
| Demo Restaurant | `owner@demo.com` |
| Le Gourmet Beirut | `owner@le-gourmet.com` |
| Dubai Spice House | `owner@dubai-spice.com` |
| Cairo Nile Bites | `owner@nile-bites.com` |
| Istanbul Kebab Corner | `owner@istanbul-kebab.com` |
| Amman Garden Restaurant | `owner@amman-garden.com` |
| Casablanca Riad Kitchen | `owner@casa-riad.com` |
| Jeddah Seafood House | `owner@jeddah-seafood.com` |
| Manama Pearl Restaurant | `owner@manama-pearl.com` |
| Baghdad Tigris Kitchen | `owner@tigris-kitchen.com` |
| Muscat Omani Table | `owner@muscat-omani.com` |
| La Table Tunisoise | `owner@table-tunisoise.com` |

المصدر: [`DemoTenantSeeder`](api/database/seeders/DemoTenantSeeder.php) و[`DemoRestaurantsSeeder`](api/database/seeders/DemoRestaurantsSeeder.php).

> **ملاحظة:** مطعم "مطعم الأصالة" (al-asala) وتينانت "dubai arena city" موجودان في قاعدة البيانات لكن بريديهما تغيّرا عن القيم التي ينشئها الـ seeder (`owner@al-asala.com` غير موجود فعليًا) — أي أنهما أصبحا حسابين حقيقيين مستخدَمين للاختبار الفعلي، وليسا ببيانات seed. لا تُدرَج بيانات دخولهما هنا لأنها غير معروفة/ليست `password`.

## حسابات موظفي "Demo Restaurant" (لتجربة الأدوار المختلفة)

بيانات إضافية أُضيفت عبر [`DemoOperationalDataSeeder`](api/database/seeders/DemoOperationalDataSeeder.php) على نفس تينانت `Demo Restaurant` (`owner@demo.com`) لتغطية كل الأدوار — كلمة المرور لجميعها أيضًا `password`:

| الاسم | البريد الإلكتروني | الدور |
|---|---|---|
| Demo Owner | `owner@demo.com` | owner |
| Layla Manager | `layla-manager@demo.com` | manager |
| Omar Waiter | `omar-waiter@demo.com` | waiter |
| Sara Waiter | `sara-waiter@demo.com` | waiter |
| Karim Bartender | `karim-bartender@demo.com` | bartender |
| Rana Staff | `rana-staff@demo.com` | staff |
| Yousef Staff | `yousef-staff@demo.com` | staff |
| Kitchen Screen | `kitchen-screen@demo.com` | kitchen_display (تفتح مباشرة شاشة المطبخ `/kds` فقط، بدون دخول للوحة التحكم) |

> ملاحظة: هذا الـ seeder لم يُضَف بعد إلى `DatabaseSeeder::run()`، فهو لا يعمل تلقائيًا مع `php artisan db:seed` العام — شُغِّل يدويًا بأمر `php artisan db:seed --class=DemoOperationalDataSeeder --force`.
