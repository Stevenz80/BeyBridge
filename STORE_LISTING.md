# Google Play store listing — draft

Draft text and form answers for Play Console. Review every line against the build you
upload; nothing here has been submitted. Limits: title 30 characters, short description 80,
full description 4,000.

## English (en-US)

**Title:** BeyBridge: Beirut Services

**Short description:** Find mechanics, laundries, electricians and more around Beirut.

**Full description:**

BeyBridge helps you find local services in and around Beirut, on a map or in a list.

• Browse by category: mechanics, laundry and dry cleaning, electricians, AC repair, carpenters, locksmiths and more.
• Search by what you need. Type "flat tire" or "no power" and BeyBridge suggests the right kind of service.
• See what is near you on the map and get directions.
• Call or message a business directly from its page.
• Save the services you trust.
• Send a service request to businesses that have joined BeyBridge, then follow quotes and status updates.
• Read and write reviews after a completed job.
• Use the app in English or Arabic.

For service providers: create a free listing, receive customer requests, send quotes and manage your jobs. New listings are reviewed before they appear.

About the listings: many businesses come from OpenStreetMap, a public map. They are marked "Directory listing", have not been checked by BeyBridge and may be out of date, so confirm details with the business. © OpenStreetMap contributors.

BeyBridge does not process payments. You agree prices and pay the business directly.

## Arabic (ar)

**Title:** BeyBridge: خدمات بيروت

**Short description:** اعثر على ميكانيكيين ومصابغ وكهربائيين وغيرهم في بيروت وضواحيها.

**Full description:**

يساعدك BeyBridge في العثور على الخدمات المحلية في بيروت وضواحيها، على الخريطة أو في قائمة.

• تصفّح حسب الفئة: ميكانيكيون، غسيل وتنظيف ملابس، كهربائيون، تصليح مكيفات، نجارون، صانعو أقفال وغيرها.
• ابحث بحسب حاجتك. اكتب «إطار مثقوب» أو «انقطاع الكهرباء» ويقترح التطبيق نوع الخدمة المناسب.
• شاهد الخدمات القريبة منك على الخريطة واحصل على الاتجاهات.
• اتصل بالمحل أو راسله مباشرة من صفحته.
• احفظ الخدمات التي تثق بها.
• أرسل طلب خدمة إلى المحلات المنضمّة إلى BeyBridge وتابع عروض الأسعار وحالة الطلب.
• اقرأ التقييمات واكتب تقييمك بعد إنجاز العمل.
• التطبيق متوفر بالعربية والإنجليزية.

لمقدّمي الخدمات: أنشئ إدراجًا مجانيًا، استقبل طلبات العملاء، أرسل عروض الأسعار وتابع أعمالك. تُراجَع الإدراجات الجديدة قبل ظهورها.

عن الإدراجات: كثير من المحلات مصدرها OpenStreetMap، وهي خريطة عامة. تظهر بعلامة «إدراج من دليل»، ولم يتحقق منها BeyBridge وقد تكون معلوماتها قديمة، فتأكّد من التفاصيل مع المحل. © المساهمون في OpenStreetMap.

لا يعالج BeyBridge أي مدفوعات. تتفق على السعر وتدفع للمحل مباشرة.

## Graphics still needed

| Asset | Requirement | Status |
| --- | --- | --- |
| App icon | 512 × 512 PNG | Export from `assets/images/icon.png` (1024 × 1024) |
| Feature graphic | 1024 × 500 PNG or JPG | Not made |
| Phone screenshots | 2–8, from the real Android build | Not made; take them on a device with real data |

## Data safety form — proposed answers

Confirm against the final build and the privacy policy before submitting.

| Data type | Collected | Shared | Purpose | Optional |
| --- | --- | --- | --- | --- |
| Name, email address | Yes | No | Account management | Required for an account |
| Phone number | Yes | With the provider you send a request to | App functionality | Optional |
| Precise and approximate location | Yes | Request location goes to the chosen provider | Nearby results, request address | Optional |
| Messages in service requests | Yes | With the other party to the request | App functionality | Optional |
| Reviews and listings | Yes | Public in the app | App functionality | Optional |
| Files (provider verification documents) | Yes | No | Provider verification | Providers only |
| Device or other IDs (push token) | Yes | No | Notifications | Optional |
| Crash logs and diagnostics | Only if Sentry is enabled | No | Analytics, stability | — |

- Data is encrypted in transit: **Yes**.
- Users can request deletion: **Yes** — in the app under Account → Delete account, and by the public deletion page.
- No advertising SDK, no in-app purchases, no payment data.

## Other declarations

- **App access:** all features need sign-in. Give Google a pre-confirmed customer account, and a provider account if you want provider features reviewed.
- **Ads:** No.
- **Content rating:** fill in the questionnaire; the app has user-generated reviews and listings with reporting, blocking and moderation.
- **Target audience:** adults (18+) is the simplest truthful choice for a services marketplace.
- **Category:** Maps & Navigation or Lifestyle. **Contact email:** beybridge.support@gmail.com.
