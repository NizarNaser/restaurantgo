# النشر على Hostinger Business (استضافة مشتركة)

هذا الدليل مخصص لخطة **Hostinger Business** (استضافة مشتركة/shared hosting عبر hPanel، بدون Docker ولا Root access). إن كانت لديك خطة **VPS**، استخدم [`HOSTINGER_DEPLOYMENT.md`](HOSTINGER_DEPLOYMENT.md) بدلاً من هذا الملف — تلك الخطة تدعم subdomain تلقائي لكل مطعم عبر شهادة SSL Wildcard، بينما هذا الدليل يعتمد بنية مختلفة (مبنية أصلاً في الكود) تعمل بدون أي منهما.

## الفكرة الأساسية: بدون Wildcard subdomain

استضافة Business المشتركة **لا تدعم**: Docker، عمليات خلفية دائمة (queue worker/scheduler كـ daemon)، ولا شهادة SSL Wildcard (`*.restaurantgo.org`) بسهولة. الكود أصلاً مبني ليدعم بديلاً لكل هذا:

- **مطعم بدون subdomain خاص** يظهر على مسار ثابت: `https://app.restaurantgo.org/p/{slug}` بدلاً من `https://{slug}.restaurantgo.org`. هذا مفعّل تلقائيًا في الكود بمجرد ترك `APP_BASE_DOMAIN` (الباك-إند) و`VITE_BASE_DOMAIN` (الواجهتان) **فارغين** — راجع `SeoService::tenantBaseUrl()` و`dashboard/src/lib/publicSite.ts`، كلاهما جاهز مسبقًا لهذا الوضع ولا يحتاج أي تعديل.
- **الـ queue** (ترجمة AI بالجملة، إلخ) يعمل عبر جدول قاعدة بيانات (`QUEUE_CONNECTION=database`) — يمكن تفريغه بأمر cron كل دقيقة بدل عملية دائمة.
- **الـ scheduler** (نشر المقالات المجدولة، تحديث أسعار الصرف) خفيف جدًا — يعمل بأمر `schedule:run` عبر cron كل دقيقة، وهو ما تدعمه أغلب خطط Hostinger Business فعليًا رغم أن دليل الـ VPS يذكر خلاف ذلك (كان يقارن مع خطط أضعف).

## 1) هيكلة الدومين

ثلاثة عناوين فقط، كل واحد subdomain عادي (وليس wildcard) — يُنشأ يدويًا مرة واحدة من hPanel → Domains → Subdomains:

| العنوان | يخدم | نوع |
|---|---|---|
| `restaurantgo.org` (+`www`) | `web` — الموقع التسويقي + دليل المطاعم + التسجيل | الدومين الرئيسي |
| `app.restaurantgo.org` | `dashboard` — لوحة تحكم المطاعم **و** صفحات كل مطعم العامة (`/p/{slug}`) | subdomain عادي |
| `api.restaurantgo.org` | `api` — الباك-إند Laravel | subdomain عادي |

كل subdomain يحصل على شهادة SSL مجانية (Let's Encrypt) تلقائيًا من hPanel → SSL، لأنه عنوان ثابت معروف مسبقًا — لا حاجة لأي تحقق DNS يدوي كما في حالة الـ Wildcard.

> **قيد معروف:** مطعم يربط دومينه الخاص (custom domain) لاحقًا سيحتاج منك إضافة subdomain/addon-domain يدوي له في hPanel وتوجيهه لنفس مكان `app.restaurantgo.org`، لأن التوجيه التلقائي لكل دومين جديد يحتاج Wildcard (VPS فقط). لعدد قليل من المطاعم هذا مقبول تمامًا.

## 2) اختيار PHP والرفع

1. من hPanel → **Advanced → PHP Configuration**، اختر **PHP 8.4** لموقع `api.restaurantgo.org` (المشروع يتطلبه صراحة: `"php": "^8.4"` في `api/composer.json` مع Laravel 13).
2. ارفع الكود:
   - إن كان لديك SSH (متوفر في Business): `git clone <repo-url> restaurantgo` ثم `cd restaurantgo/api`.
   - بدون SSH: ارفع ملف zip للمجلد `api/` عبر File Manager وفكّه هناك.
3. **Document root لـ `api.restaurantgo.org` يجب أن يشير إلى `api/public`** (وليس `api/` نفسه) — من hPanel → Subdomains → Manage → غيّر الـ Document Root. هذا يعادل ما يفعله `php artisan serve` في بيئة Docker، لكن عبر Apache/php-fpm الحقيقيين لأداء أفضل بكثير تحت حمل حقيقي (يحل القيد الوحيد المذكور في دليل الـ VPS عن `artisan serve`).

## 3) قاعدة البيانات وComposer

1. hPanel → Databases → أنشئ قاعدة MySQL ومستخدمًا.
2. عبر SSH داخل `api/`:
   ```bash
   composer install --no-dev --optimize-autoloader
   ```
   إن لم يكن Composer متاحًا: شغّل `composer install --no-dev` **محليًا** على جهازك، ثم ارفع مجلد `vendor/` بالكامل عبر FTP (بطيء لكنه يعمل).

## 4) `api/.env`

انسخ `api/.env.example` إلى `api/.env` وعدّل:

```env
APP_NAME=RestaurantGo
APP_ENV=production
APP_DEBUG=false
APP_KEY=                      # سيتولّد تلقائيًا في الخطوة التالية
APP_URL=https://api.restaurantgo.org

# اتركهما فارغين — هذا ما يفعّل وضع /p/{slug} بدل الـ wildcard subdomain
APP_BASE_DOMAIN=
APP_PUBLIC_URL=https://app.restaurantgo.org

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_DATABASE=<اسم القاعدة من hPanel>
DB_USERNAME=<من hPanel>
DB_PASSWORD=<من hPanel>

QUEUE_CONNECTION=database
CACHE_STORE=database
SESSION_DRIVER=database

# بريد معاملاتي حقيقي — Gmail SMTP غير موثوق للإنتاج (قد يُحظر أو يُصنَّف كـ spam)
MAIL_MAILER=smtp
MAIL_HOST=smtp.postmarkapp.com    # أو Resend/SES — راجع TRIAL_DEPLOYMENT.md للسبب
MAIL_PORT=587
MAIL_USERNAME=...
MAIL_PASSWORD=...
MAIL_FROM_ADDRESS="hello@restaurantgo.org"

STRIPE_KEY=pk_live_...
STRIPE_SECRET=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# يشغّل كل ميزات AI: شات بوت التسويق، مساعد لوحة التحكم، شات بوت قائمة كل
# مطعم، والترجمة (فورية + جماعية). اتركه فارغًا لتعطيل الجميع بدون أي خطأ.
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
```

ثم:
```bash
php artisan key:generate
php artisan migrate --force
php artisan storage:link
php artisan db:seed --class=PlansSeeder --force
php artisan db:seed --class=RolesPermissionsSeeder --force
```

## 5) Cron (بديل queue worker/scheduler الدائمين)

hPanel → Advanced → Cron Jobs، أضف سطرين (كل دقيقة):

```cron
* * * * * cd /home/USER/restaurantgo/api && php artisan schedule:run >> /dev/null 2>&1
* * * * * cd /home/USER/restaurantgo/api && php artisan queue:work --stop-when-empty --max-time=50 --tries=3 >> /dev/null 2>&1
```

- السطر الأول: يشغّل `articles:publish-scheduled` (كل 5 دقائق) و`exchange-rates:update` (يوميًا 01:00) — معرّفان في `api/routes/console.php`، لا حاجة لأي تعديل.
- السطر الثاني: يفرّغ كل ما في جدول الـ queue (ترجمة AI بالجملة عند إضافة لغة جديدة) ثم يتوقف من تلقائيًا (`--stop-when-empty`) قبل أن يبدأ cron التالي — آمن حتى لو تداخل مع التشغيلة السابقة لأن كل صف في الـ queue يُقفل عند معالجته. النتيجة: تأخير حتى دقيقة واحدة في الترجمة الجماعية بدل الفورية — مقبول لهذه الميزة تحديدًا.

## 6) بناء ورفع الواجهتين (`web` و`dashboard`)

Vite build يحدث **محليًا** (أو عبر GitHub Actions) لأن الـ `VITE_*` تُخبز داخل الملفات الناتجة وقت البناء — لا يوجد Node.js على الاستضافة المشتركة أصلاً ولا حاجة له.

**`web/.env.production`:**
```env
VITE_API_URL=https://api.restaurantgo.org/api
VITE_RESTAURANT_SITE_URL=https://app.restaurantgo.org
VITE_BASE_DOMAIN=
```

**`dashboard/.env.production`:**
```env
VITE_API_URL=https://api.restaurantgo.org/api
VITE_BASE_DOMAIN=
```

ثم محليًا:
```bash
cd web && npm ci && npm run build        # ينتج web/dist
cd ../dashboard && npm ci && npm run build   # ينتج dashboard/dist
```

ارفع **محتوى** `web/dist/*` إلى document root لـ `restaurantgo.org`، و**محتوى** `dashboard/dist/*` إلى document root لـ `app.restaurantgo.org` (عبر File Manager أو FTP). كلا المجلدين يحتويان أصلاً على `.htaccess` جاهز (أُضيف لهما في هذا التعديل، داخل `web/public/` و`dashboard/public/` فينسخهما Vite تلقائيًا إلى `dist/` عند البناء) يتكفّل بـ:
- توجيه أي مسار غير موجود كملف فعلي إلى `index.html` (توجيه SPA، معادل تمامًا لـ `web/vercel.json`/`dashboard/vercel.json` المستخدمين مع Vercel).
- (في `dashboard` فقط) تحويل طلبات محركات البحث/الذكاء الاصطناعي (Googlebot، GPTBot، ClaudeBot، PerplexityBot، ...) على مسار `/p/{slug}` إلى `bot-render.php` بدل `index.html` — راجع قسم السيو أدناه.

**مهم:** افتح `dashboard/public/bot-render.php` بعد الرفع وتأكد أن `RESTAURANTGO_API_URL` بالأعلى يطابق `https://api.restaurantgo.org` (هذا هو الافتراضي المضبوط مسبقًا، عدّله فقط إن اخترت دومينًا مختلفًا).

## 7) التحقق

- `https://restaurantgo.org` → الموقع التسويقي.
- `https://app.restaurantgo.org/login` → لوحة تحكم المنصة.
- `https://api.restaurantgo.org/api/v1/plans` → يجب أن يرجع JSON.
- سجّل مطعمًا تجريبيًا من `https://restaurantgo.org/register`، ثم افتح `https://app.restaurantgo.org/p/{slug}` — يجب أن تفتح صفحة المطعم مباشرة.
- `https://app.restaurantgo.org/p/{slug}/preview` → يجب أن يرجع HTML كامل (بدون أي JavaScript) فيه اسم المطعم والقائمة — هذا ما يراه الذكاء الاصطناعي/محركات البحث، اختبره بمتصفح بدون تفعيل JS أو بـ `curl`.

## 8) السيو، Google Search Console، والبحث عبر الذكاء الاصطناعي

هذا الجزء جاهز في الكود بالكامل مع هذا التعديل، فقط فعّله بعد الرفع:

1. **Google Search Console**: أضف الموقعين `restaurantgo.org` و`app.restaurantgo.org` كخاصيتين منفصلتين (Domain property إن أمكن، وإلا URL-prefix). التحقق عبر **DNS TXT record** (وليس HTML tag) — أضف السجل من hPanel → DNS Zone، لأن التحقق بوسم HTML لا يعمل بشكل موثوق مع تطبيق client-rendered (نفس الملاحظة موجودة أصلاً في `web/src/hooks/useSeoHead.ts`).
2. **أرسل الـ sitemaps** التالية من Search Console:
   - `https://restaurantgo.org/sitemap.xml` (صفحات الموقع التسويقي).
   - `https://api.restaurantgo.org/sitemap.xml` (فهرس يضم sitemap كل مطعم نشط تلقائيًا — مُولَّد بـ `SeoService::platformSitemapIndex()`، لا حاجة لتحديثه يدويًا عند انضمام مطعم جديد).
3. **البحث عبر الذكاء الاصطناعي (ChatGPT/Perplexity/Claude وغيرها)**: أغلب زواحف الذكاء الاصطناعي (GPTBot، ClaudeBot، PerplexityBot...) **لا تُنفّذ JavaScript** — بعكس Googlebot الحديث. بما أن الواجهتين React (SPA)، أضفنا:
   - `web/public/llms.txt` — ملف وصفي عن المنصة بصيغة متعارف عليها حديثًا لوكلاء الذكاء الاصطناعي.
   - صفحة معاينة بدون JavaScript لكل مطعم على `https://app.restaurantgo.org/p/{slug}/preview` (تُبنى في Laravel مباشرة عبر `SeoRenderController`، بنفس بيانات `SeoService` المستخدمة في الواجهة).
   - في `dashboard/public/.htaccess`: أي طلب من أحد هذه الزواحف على `/p/{slug}` يُوجَّه تلقائيًا (بنفس الرابط الذي يراه الزائر العادي) إلى تلك الصفحة عبر `bot-render.php` بدل `index.html` الفارغ تقنيًا لغير منفّذي JS.
4. **لكل مطعم**: صفحة "الإعدادات → السيو" في لوحة التحكم (موجودة مسبقًا) تسمح بتعيين عنوان/وصف/صورة OG وربط Google Search Console الخاص بالمطعم (`google_site_verification`) — لا تغيير مطلوب هنا، فقط تأكد من توجيه أصحاب المطاعم لتعبئتها.

## القيود المعروفة

1. مطعم بدومين خاص (custom domain) يحتاج ربطًا يدويًا لكل دومين جديد (راجع §1) — لا يوجد تلقائي بدون VPS.
2. عدد المطاعم الكبير جدًا (آلاف) يجعل خطة Business (موارد CPU/RAM مشتركة) عنق زجاجة قبل أي شيء آخر في هذه البنية — عندها الانتقال لـ [`HOSTINGER_DEPLOYMENT.md`](HOSTINGER_DEPLOYMENT.md) (VPS) هو الخطوة التالية الطبيعية، دون أي تغيير في الكود لأن كلا المسارين مبنيان على نفس القاعدة (`APP_BASE_DOMAIN` فارغ = مسار؛ معبأ = subdomain).
3. الوسائط المرفوعة (صور القائمة، الشعار) تُخزَّن على نفس القرص — تأكد أن خطة Business توفر مساحة تخزين كافية، ولا يوجد CDN مدمج؛ فعّل `FILESYSTEM_DISK=s3` لاحقًا إن احتجت ذلك (الإعدادات جاهزة في `.env`، فقط أضف مفاتيح `AWS_*`).
