# قائمة الانتقال: RestaurantGo ← RestoAtlas (restaurantgo.org ← restoatlas.com)

خطوات يدوية على السيرفر والخدمات الخارجية لإكمال إعادة التسمية التي في الفرع `rebrand/restoatlas`.
الكود جاهز؛ هذه الخطوات **لا ينفّذها أحد تلقائيًا**.

> **الترتيب مهم.** workflow النشر (`deploy-vps.yml`) بعد الدمج يعمل من `/var/www/restoatlas` ويعيد تشغيل
> `restoatlas-queue` و`restoatlas-scheduler`. لذلك نفّذ الأقسام 1 إلى 5 **قبل** دمج الفرع في `main`،
> وإلا سيفشل أول نشر.

| الدومين | يخدم |
|---|---|
| `restoatlas.com` | الموقع التسويقي (`web`) |
| `www.restoatlas.com` | تحويل 301 إلى `restoatlas.com` |
| `app.restoatlas.com` | لوحة التحكم (`dashboard`) |
| `api.restoatlas.com` | Laravel API |
| `{slug}.restoatlas.com` | صفحة كل مطعم (`dashboard` نفسه) |

---

## 1) DNS في Hostinger لـ restoatlas.com

hPanel ← Domains ← restoatlas.com ← **DNS / Nameservers**. احذف سجلات A/CNAME الافتراضية (صفحة الـ parking) ثم أضف:

| النوع | الاسم | القيمة | TTL |
|---|---|---|---|
| A | `@` | IP الـ VPS | 3600 |
| A | `www` | IP الـ VPS | 3600 |
| A | `app` | IP الـ VPS | 3600 |
| A | `api` | IP الـ VPS | 3600 |
| A | `*` | IP الـ VPS | 3600 |

- إن كان للـ VPS عنوان IPv6، أضف سجلات `AAAA` بنفس الأسماء.
- IP الـ VPS: من hPanel ← VPS ← Overview (أو `curl -4 ifconfig.me` على السيرفر).
- تحقّق قبل المتابعة:
  ```bash
  dig +short restoatlas.com app.restoatlas.com api.restoatlas.com test123.restoatlas.com
  ```
  كلها يجب أن ترجع IP الـ VPS.
- **لا تغيّر** سجلات `restaurantgo.org` — يجب أن تبقى (ومعها `*`) موجّهة للـ VPS حتى تعمل التحويلات.

## 2) شهادة SSL (wildcard) عبر Let's Encrypt

الشهادة wildcard تحتاج تحدّي DNS-01 (لا يكفي HTTP-01):

```bash
sudo certbot certonly --manual --preferred-challenges dns \
  -d restoatlas.com -d '*.restoatlas.com'
```

- سيطلب certbot سجلَّي TXT باسم `_acme-challenge` (قيمتين مختلفتين، أضف الاثنين في نفس الاسم في hPanel).
  انتظر حتى يظهرا قبل الضغط على Enter:
  ```bash
  dig +short TXT _acme-challenge.restoatlas.com
  ```
- الناتج في `/etc/letsencrypt/live/restoatlas.com/` (المسار المستخدم في `deploy/nginx/vps/restoatlas.conf`).
- **التجديد:** وضع `--manual` لا يتجدد تلقائيًا — كرّر الأمر كل ~60 يومًا (ضع تذكيرًا)،
  أو انقل DNS الدومين لمزوّد له plugin لـ certbot (مثل Cloudflare مع `python3-certbot-dns-cloudflare`) ليتجدد وحده.
- تأكّد أن شهادة الدومين القديم ما زالت صالحة وتغطي `*.restaurantgo.org` (التحويلات عبر HTTPS تحتاجها):
  ```bash
  sudo certbot certificates
  ```
  إن كان مسارها غير `/etc/letsencrypt/live/restaurantgo.org/` عدّل المسار في `restaurantgo-redirects.conf`.

## 3) إعادة تسمية مجلد التطبيق وعمليات PM2

```bash
# 1. سجّل كيف تعمل العمليات الحالية (الأمر، المجلد، المعاملات) قبل حذفها
pm2 describe rgo-queue
pm2 describe rgo-scheduler

# 2. أوقفها وانقل المجلد
pm2 stop rgo-queue rgo-scheduler
sudo mv /var/www/restaurantgo /var/www/restoatlas

# 3. رابط storage مطلق ويشير للمسار القديم — أعد إنشاءه
cd /var/www/restoatlas/api
rm public/storage && php artisan storage:link
php artisan optimize:clear     # الـ cache المحفوظ فيه مسارات قديمة

# 4. أعد إنشاء العمليات بالأسماء الجديدة — نفس الأمر الذي ظهر في "pm2 describe"، مثلًا:
pm2 delete rgo-queue rgo-scheduler
pm2 start "php artisan queue:work --sleep=3 --tries=3" --name restoatlas-queue     --cwd /var/www/restoatlas/api
pm2 start "php artisan schedule:work"                  --name restoatlas-scheduler --cwd /var/www/restoatlas/api
pm2 save

# 5. ابحث عن أي إشارة متبقية للمسار القديم
sudo grep -rn "/var/www/restaurantgo" /etc/nginx /etc/php /etc/cron* /etc/logrotate.d 2>/dev/null
crontab -l | grep restaurantgo
```

عدّل كل نتيجة من الخطوة 5 للمسار الجديد. اسم قاعدة البيانات `restaurantgo` **يبقى كما هو**.

## 4) nginx

```bash
# احتفظ بنسخة من الإعداد الحالي
sudo cp -a /etc/nginx/sites-available /root/nginx-sites-backup-$(date +%F)

# انسخ الملفين من الريبو
sudo cp /var/www/restoatlas/deploy/nginx/vps/restoatlas.conf            /etc/nginx/sites-available/
sudo cp /var/www/restoatlas/deploy/nginx/vps/restaurantgo-redirects.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/restoatlas.conf            /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/restaurantgo-redirects.conf /etc/nginx/sites-enabled/
```

- **عطّل ملف الموقع القديم** الذي يخدم `restaurantgo.org` حاليًا (احذف الـ symlink من `sites-enabled` فقط — الملف الأصلي يبقى في `sites-available`)، وإلا سيتعارض `server_name` مع ملف التحويلات.
- راجع في الملفين: socket الـ PHP-FPM (`ls /run/php/`، الافتراضي في الملف `php8.3-fpm.sock`) ومسار الشهادة القديمة.
- ثم:
  ```bash
  sudo nginx -t && sudo systemctl reload nginx
  ```
  (الملفات لم تُختبر بـ `nginx -t` قبل الرفع — هذه الخطوة ضرورية.)

ما تفعله التحويلات (`restaurantgo-redirects.conf`):

| من | إلى |
|---|---|
| `restaurantgo.org/*`، `www.restaurantgo.org/*` | 301 ← `https://restoatlas.com/*` |
| `app.restaurantgo.org/*` | 301 ← `https://app.restoatlas.com/*` |
| `{slug}.restaurantgo.org/*` | 301 ← `https://{slug}.restoatlas.com/*` (المسار والـ query string محفوظان) |
| `api.restaurantgo.org/*` | **بدون تحويل** — يخدم الـ API كما هو (POST والـ webhooks وتطبيق POS القديم تستمر بالعمل)، مع سجل منفصل `/var/log/nginx/restaurantgo-api-deprecated.log` وترويسة `Deprecation: true` |

## 5) ملف `.env` على الـ VPS (`/var/www/restoatlas/api/.env`)

غيّر هذه القيم فقط:

```dotenv
APP_NAME=RestoAtlas
APP_URL=https://api.restoatlas.com
APP_BASE_DOMAIN=restoatlas.com
APP_PUBLIC_URL=https://app.restoatlas.com
MAIL_FROM_ADDRESS="support@restoatlas.com"
# MAIL_FROM_NAME="${APP_NAME}"  ← يبقى كما هو، يأخذ الاسم الجديد تلقائيًا
```

وراجع هذه **إن كانت موجودة** في الملف:

| المفتاح | القيمة الجديدة |
|---|---|
| `SESSION_DOMAIN` | `.restoatlas.com` إن كانت `.restaurantgo.org`، أو اتركها `null` |
| `SANCTUM_STATEFUL_DOMAINS` | استبدل كل `restaurantgo.org` بـ `restoatlas.com` |
| `CORS_ALLOWED_ORIGINS` | استبدل الدومينات القديمة (دومينات المطاعم المخصصة تبقى) |

ملاحظات:
- تغيير `APP_NAME` يغيّر أيضًا اسم cookie الجلسة وبادئة الـ cache — النتيجة cache فارغ مرة واحدة، لا شيء آخر.
- واجهات `web` و`dashboard` لا تحتاج `.env` على السيرفر — قيم `VITE_*` موجودة في `deploy-vps.yml`.

ثم:

```bash
cd /var/www/restoatlas/api
php artisan config:clear && php artisan cache:clear && php artisan route:clear
php artisan config:cache && php artisan route:cache   # الإنتاج يعمل بـ cache (كما في deploy-vps.yml)
pm2 restart restoatlas-queue restoatlas-scheduler
```

## 6) الدمج والنشر

1. افتح PR من `rebrand/restoatlas` إلى `main` وراجعه.
2. بعد الدمج يعمل `Deploy to VPS` تلقائيًا — تأكد أنه انتهى بـ `DEPLOY_OK`.
3. اختبار سريع:
   ```bash
   curl -sI https://restoatlas.com | head -1                      # 200
   curl -s  https://api.restoatlas.com/api/v1/plans | head -c 200  # JSON
   curl -sI "https://restaurantgo.org/restaurants?x=1" | grep -i location   # https://restoatlas.com/restaurants?x=1
   curl -sI https://test.restaurantgo.org/menu | grep -i location           # https://test.restoatlas.com/menu
   curl -sI https://api.restaurantgo.org/api/v1/plans | grep -i deprecation # Deprecation: true (وبدون تحويل)
   ```

## 7) محتوى في قاعدة البيانات (من لوحة السوبر أدمن)

هذه نصوص مخزّنة في قاعدة بيانات الإنتاج، لا يغيّرها الكود:

- **إعدادات SEO للمنصة** (`/admin` ← SEO): العنوان والوصف بكل اللغات — العنوان المقترح:
  `RestoAtlas — All-in-One Restaurant Management Platform`. وحدّث رمز Google Site Verification بعد الخطوة 9.
- **الخطط** (`/admin` ← Plans): أي وصف فيه "RestaurantGo" (مثل الخطة المجانية: "Try RestaurantGo at no cost…").
- **حساب السوبر أدمن**: بريده الحالي لا يتغير تلقائيًا؛ غيّره إلى `admin@restoatlas.com` إن أردت (بعد إنشاء صندوق البريد).
- ابحث عن أي بقايا:
  ```sql
  SELECT id FROM platform_settings WHERE seo_title LIKE '%estaurantgo%' OR seo_description LIKE '%estaurantgo%';
  SELECT id, slug FROM plans WHERE description LIKE '%estaurantgo%' OR name LIKE '%estaurantgo%';
  ```

## 8) البريد: restoatlas.com

1. أنشئ صندوق البريد `support@restoatlas.com` — هو بريد الموقع الرسمي: المرسِل لكل الإيميلات، ويظهر في تذييل الموقع. و`admin@` إن أردته.
2. في مزوّد البريد المستخدم في `MAIL_HOST`، أضف الدومين `restoatlas.com` وانسخ سجلاته إلى DNS في Hostinger:
   - **SPF** (TXT على `@`)، مثال: `v=spf1 include:<مزوّدك> ~all` — سجل SPF واحد فقط للدومين.
   - **DKIM** (TXT أو CNAME بالاسم الذي يعطيه المزوّد، مثل `default._domainkey`).
   - **DMARC** (TXT على `_dmarc`)، ابدأ بـ: `v=DMARC1; p=none; rua=mailto:support@restoatlas.com` ثم شدّده إلى `quarantine` بعد أسبوعين من تقارير نظيفة.
3. اختبر: سجّل مطعمًا تجريبيًا، تأكد أن رسالة الترحيب تصل من `support@restoatlas.com` وأن SPF/DKIM = pass (Gmail ← Show original).

## 9) Google Search Console

1. أضف property من نوع **Domain** لـ `restoatlas.com` (تحقّق بسجل TXT في DNS).
2. أرسل الـ sitemaps:
   - `https://restoatlas.com/sitemap.xml`
   - `https://api.restoatlas.com/sitemap.xml`
3. في property الدومين القديم `restaurantgo.org`: Settings ← **Change of address** ← اختر `restoatlas.com`.
   (يتطلب أن تكون تحويلات 301 فعّالة وأن يكون الـ property الجديد موثّقًا.)
4. لا تحذف property القديم — راقب انتقال الفهرسة منه.

## 10) خدمات خارجية

**Stripe** (الاشتراكات + Stripe Connect):
- Developers ← Webhooks: أضف endpoint جديدًا `https://api.restoatlas.com/api/webhooks/stripe` بنفس الأحداث.
  ضع الـ signing secret الجديد في `STRIPE_WEBHOOK_SECRET`. أبقِ القديم (`api.restaurantgo.org`) فعّالًا لفترة الانتقال
  ثم عطّله. (الـ endpoint القديم يستمر بالعمل لأن `api.restaurantgo.org` لا يُحوَّل.)
  **انتبه:** endpoint واحد فقط يحمل الـ secret الموجود في `.env` — إن كان الاثنان فعّالين، سيفشل التحقق على أحدهما. الأبسط: غيّر عنوان الـ endpoint الحالي إلى الدومين الجديد بدل إنشاء ثانٍ (يبقى نفس الـ secret).
- Products: أعد تسمية المنتجات "RestaurantGo Free/Pro/…" إلى "RestoAtlas …" (أمر `stripe:sync-plans` لا يعدّل المنتجات الموجودة).
- Settings ← Business ← Public details: اسم النشاط، الموقع، و**statement descriptor** (ما يظهر في كشف بطاقة العميل).
- Settings ← Connect ← Branding: الاسم والأيقونة والموقع التي يراها المطاعم عند ربط حساباتهم.

**PayPal** (ربط حسابات المطاعم — partner referrals):
- في PayPal Developer ← تطبيقك: حدّث أي return URL / website URL من `restaurantgo.org` إلى `restoatlas.com`.
  (عناوين العودة في الكود تُبنى من الطلب نفسه، لا يلزم تغيير الكود.)
- لا يوجد webhook لـ PayPal في الكود حاليًا.

**Sentry**: لا يلزم تغيير (الـ DSN لا يرتبط بالدومين). اختياريًا أضف `restoatlas.com` في Allowed Domains إن كانت مفعّلة.

**غير مستخدم في الكود حاليًا** (لا شيء لتحديثه): Google OAuth، بوتات WhatsApp/Telegram، Google Analytics على مستوى المنصة.
(أكواد GA4/Meta Pixel الموجودة هي لكل مطعم بنفسه — نبّه المطاعم أن يضيفوا `{slug}.restoatlas.com` في إعدادات GA الخاصة بهم.)

**حسابات التواصل**: أنشئ `facebook.com/restoatlas`، `instagram.com/restoatlas`، `t.me/restoatlas` — صفحة Contact تشير إليها من الآن.
إن لم يتوفر الاسم، عدّل الروابط في `web/src/pages/ContactPage.tsx`.

## 11) تطبيق Android (RestoAtlas POS)

- معرّف التطبيق الجديد `com.restoatlas.pos` = تطبيق مختلف تمامًا. على كل جهاز: **احذف RestaurantGo POS** ثم ثبّت الجديد.
- ابنِ الـ APK بالعنوان الجديد:
  ```bash
  cd dashboard
  VITE_APP_NAME=RestoAtlas VITE_API_URL=https://api.restoatlas.com/api VITE_BASE_DOMAIN=restoatlas.com npm run build
  npx cap sync android && cd android && ./gradlew assembleRelease
  ```
- بعد التثبيت: تسجيل دخول جديد وإعادة ضبط الطابعة (بيانات التطبيق القديم لا تنتقل).
- إن كان التطبيق القديم على Google Play: صفحة متجر جديدة للتطبيق الجديد، وأوقف القديم بعد انتقال المستخدمين.

## 12) المطاعم ذات الدومين المخصص

- التحقق من الدومين يبحث الآن عن سجل TXT باسم `_restoatlas.<الدومين>` (بدل `_restaurantgo`). أي مطعم يربط دومينًا جديدًا يحتاج هذا الاسم.
- الدومينات المربوطة سابقًا لا تتأثر (التحقق يتم مرة واحدة عند الربط).
- إن كانت دومينات المطاعم تشير بـ CNAME إلى `app.restaurantgo.org`، اطلب منهم تغييرها إلى `app.restoatlas.com`.

## 13) الدومين القديم

- **أبقِ `restaurantgo.org` مسجّلًا 12 شهرًا على الأقل** وفعّل التجديد التلقائي، مع تجديد شهادته — التحويلات تعتمد عليهما.
- راقب سجل الـ API القديم:
  ```bash
  awk '{print $7}' /var/log/nginx/restaurantgo-api-deprecated.log | sort | uniq -c | sort -rn | head
  ```
- عندما يهدأ السجل (ولم يبق جهاز عليه التطبيق القديم): أزل block الـ `api.restaurantgo.org` من ملف التحويلات،
  وأزل قسم "Legacy domain" من `api/config/cors.php`.

## 14) اختبار في المتصفح

- [ ] `https://restoatlas.com` — العنوان "RestoAtlas — All-in-One Restaurant Management Platform"، الشعار والتذييل `RestoAtlas`، بريد الدعم `support@restoatlas.com`.
- [ ] **التسجيل** من `https://restoatlas.com/register` — رابط "صفحتك جاهزة" يشير إلى `https://{slug}.restoatlas.com`، ورسالة الترحيب تصل.
- [ ] **تسجيل الدخول** على `https://app.restoatlas.com/login` (كل المستخدمين سيُطلب منهم الدخول من جديد — طبيعي، التوكن محفوظ لكل دومين).
- [ ] **صفحة مطعم** `https://{slug}.restoatlas.com` — القائمة، التصنيفات، "Powered by RestoAtlas" يشير إلى `https://restoatlas.com`.
- [ ] **دورة طلب**: QR طاولة ← سلة ← طلب ← يظهر في اللوحة. وطلب توصيل مع دفع Stripe (وضع test) ← العودة للصفحة الصحيحة على الدومين الجديد ← webhook يُحدّث حالة الطلب.
- [ ] **الإيميلات**: ترحيب، فشل دفع (Stripe test card `4000 0000 0000 0341`)، تصدير GDPR — العنوان والتوقيع "The RestoAtlas Team".
- [ ] **2FA**: تفعيل جديد يظهر في تطبيق المصادقة باسم RestoAtlas.
- [ ] **المساعد الذكي** في الموقع واللوحة يعرّف نفسه بـ RestoAtlas.
- [ ] **التحويلات**: افتح `https://app.restaurantgo.org/login` و`https://{slug}.restaurantgo.org/?utm=x` — تحويل مع حفظ المسار والـ query.
- [ ] **لوحة السوبر أدمن** `https://restoatlas.com/admin/login`.
- [ ] تغيير اللغة (عربي/إنجليزي على الأقل) — لا يظهر `{{appName}}` حرفيًا في أي نص.
