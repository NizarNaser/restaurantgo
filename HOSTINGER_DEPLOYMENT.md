# النشر على Hostinger (VPS)

> لديك خطة **Business** (استضافة مشتركة، بدون VPS)؟ استخدم [`HOSTINGER_BUSINESS_DEPLOYMENT.md`](HOSTINGER_BUSINESS_DEPLOYMENT.md) بدلاً من هذا الملف.

دليل تقني خطوة بخطوة لنشر المنصة على Hostinger كبيئة إنتاج حقيقية، بحيث يحصل كل مطعم يسجّل على subdomain خاص به (`restaurant-name.yourdomain.com`) يفتح مباشرة على صفحة المطعم. الخطة التجارية الكاملة (المراحل، التكاليف، الجدول الزمني) في تقرير منفصل — هذا الملف تقني بحت، ويكمل [`docker-compose.prod.yml`](docker-compose.prod.yml) و[`deploy/nginx/restaurantgo.conf`](deploy/nginx/restaurantgo.conf).

## لماذا VPS لا Shared/Cloud Hosting

جربنا فحص خطط Hostinger الأخرى مقابل ما يحتاجه هذا المشروع تحديدًا:

| المتطلب | Shared/Cloud Hosting | VPS (KVM) |
|---|---|---|
| SSL Wildcard (`*.yourdomain.com`) — ضروري لكل الـ subdomains | غير مدعوم | مدعوم |
| Docker (نفس صور الإنتاج المستخدمة محليًا) | غير مدعوم | مدعوم بالكامل |
| Queue worker + Scheduler كعمليات دائمة | غير مدعوم (Cron فقط كل دقيقة كحد أقصى) | مدعوم |
| SSH + تحكم كامل بـ Nginx | محدود | كامل |

**الخلاصة: خطة VPS من نوع KVM هي المطلوبة.** خطة `KVM 2` (2 vCPU / 8GB RAM / 100GB NVMe) كافية لبداية المنصة (عشرات إلى بضع مئات من المطاعم المسجّلة)؛ يمكن الترقية لاحقًا لنفس الحساب دون إعادة نشر من الصفر.

## 1) تجهيز الدومين

1. اشترِ دومين (أو استخدم دومين موجود لديك) — مثال افتراضي في هذا الدليل: `restaurantgo.com`.
2. في لوحة تحكم الدومين (Hostinger أو أي مسجّل آخر)، أضف سجلّات DNS التالية تشير إلى IP الخاص بالـ VPS:

   | Type | Name | Value |
   |---|---|---|
   | A | `@` | IP الخاص بالـ VPS |
   | A | `www` | IP الخاص بالـ VPS |
   | A | `*` | IP الخاص بالـ VPS |

   سجلّ الـ `*` (wildcard) هو الذي يجعل subdomain أي مطعم يعمل تلقائيًا بدون أي إعداد يدوي إضافي عند كل تسجيل جديد.

## 2) تجهيز الـ VPS

1. من hPanel، أنشئ VPS بقالب **Ubuntu 24.04** (بدون لوحة تحكم — سنستخدم Docker مباشرة).
2. اتصل عبر SSH وثبّت Docker:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
3. استنسخ المشروع:
   ```bash
   git clone <your-repo-url> restaurantgo && cd restaurantgo
   ```

## 3) ملفات البيئة

```bash
cp api/.env.example api/.env
```

عدّل `api/.env`:
- `APP_ENV=production`, `APP_DEBUG=false`
- `APP_URL=https://api.restaurantgo.com`
- `APP_BASE_DOMAIN=restaurantgo.com` ← **هذا هو السطر الذي يفعّل الـ subdomains لكل مطعم** (انظر `SeoService::tenantBaseUrl()` و`IdentifyTenant` middleware في الكود — كلاهما جاهز مسبقًا ولا يحتاج أي تعديل، فقط هذا المتغيّر).
- `APP_PUBLIC_URL=https://app.restaurantgo.com`
- بيانات القاعدة (`DB_*`) — تبقى كما هي (`mysql`/`restaurantgo`)، فقط اختر كلمة مرور حقيقية.
- `MAIL_*`, `STRIPE_*` وبقية المفاتيح الحقيقية.

أنشئ ملف `.env` في جذر المشروع (يقرأه `docker-compose.prod.yml` لبناء الواجهتين):
```bash
cat > .env <<'EOF'
BASE_DOMAIN=restaurantgo.com
DB_PASSWORD=<كلمة مرور قوية>
DB_ROOT_PASSWORD=<كلمة مرور قوية أخرى>
EOF
```

## 4) شهادة SSL الشاملة (Wildcard)

شهادة SSL العادية (المجانية التي توفرها استضافات Hostinger المشتركة) **لا تغطي subdomains ديناميكية** — لازم شهادة Wildcard، والتي تتطلب تحقق DNS-01 (وليس HTTP-01 العادي). خياران:

**الخيار الأبسط (بدون أي مزوّد خارجي) — تحقق يدوي:**
```bash
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --manual --preferred-challenges dns \
  -d restaurantgo.com -d www.restaurantgo.com -d '*.restaurantgo.com'
```
سيطلب منك certbot إضافة سجل TXT في DNS يدويًا (خطوة واحدة، تُكرَّر كل ~90 يومًا عند التجديد).

**الخيار الموصى به للإنتاج (تجديد تلقائي) — إن كانت إدارة DNS للدومين عبر Cloudflare (مجاني):**
غيّر صورة خدمة `certbot` في `docker-compose.prod.yml` إلى `certbot/dns-cloudflare`، أضف ملف `cloudflare.ini` يحوي API Token، ثم:
```bash
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --dns-cloudflare --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d restaurantgo.com -d www.restaurantgo.com -d '*.restaurantgo.com'
```
وأضف إلى crontab على الـ VPS تجديدًا تلقائيًا شهريًا:
```
0 3 1 * * cd /path/to/restaurantgo && docker compose -f docker-compose.prod.yml run --rm certbot renew --quiet && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## 5) التشغيل

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

أول إقلاع لحاوية `api` ينفّذ تلقائيًا (عبر `docker/entrypoint.sh`): توليد `APP_KEY` إن لزم، `php artisan migrate --force`، وربط `storage:link`. إن أردت بيانات تجريبية (خطط الاشتراك الأساسية إلزامية، البقية اختيارية):
```bash
docker compose -f docker-compose.prod.yml exec api php artisan db:seed --class=PlansSeeder --force
docker compose -f docker-compose.prod.yml exec api php artisan db:seed --class=RolesPermissionsSeeder --force
```

## 6) التحقق

- `https://restaurantgo.com` → الموقع التسويقي/الدليل (`web`).
- `https://app.restaurantgo.com/login` → لوحة تحكم المنصة.
- `https://api.restaurantgo.com/api/v1/plans` → يجب أن يرجع JSON.
- سجّل مطعمًا تجريبيًا (subdomain مثلاً `test`) من `https://restaurantgo.com/register`، ثم افتح `https://test.restaurantgo.com` — يجب أن تفتح صفحة المطعم مباشرة بدون أي `/p/` في الرابط.

## القيود المعروفة (صادقة، ليست جاهزة للإنتاج الثقيل بعد)

1. **`php artisan serve` وليس php-fpm/Nginx حقيقي لخدمة الـ API.** كافٍ لإطلاق أولي بعشرات/مئات المطاعم، لكنه أحادي الخيط — إن كبر عدد المستخدمين المتزامنين، الخطوة التالية هي تحويل `api/Dockerfile` إلى `php-fpm` خلف Nginx (تحسين منفصل عن هذا الدليل، وليس ضروريًا لإطلاق أولي).
2. **نسخ احتياطي لقاعدة البيانات:** هذا الدليل لا يضيف نسخًا احتياطيًا تلقائيًا — أضف `mysqldump` مجدولًا (cron) يرفع النسخة لمكان خارج الـ VPS قبل الاعتماد على البيئة لعملاء حقيقيين.
3. **البريد الإلكتروني:** استخدم مزوّد بريد معاملاتي عبر HTTPS API (Postmark/Resend/SES) بدل SMTP الخام — راجع [`TRIAL_DEPLOYMENT.md`](TRIAL_DEPLOYMENT.md) للسبب.
