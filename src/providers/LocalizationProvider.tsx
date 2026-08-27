import React, { createContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useMarketplace } from '@/providers/MarketplaceProvider';

export type AppLocale = 'en' | 'ar';

type LocalizationContextValue = {
  locale: AppLocale;
  isRTL: boolean;
  direction: 'ltr' | 'rtl';
  t: (text: string) => string;
};

const STORAGE_KEY = 'beybridge.preferred-language';

const ARABIC: Record<string, string> = {
  Home: 'الرئيسية',
  Saved: 'المحفوظات',
  'Saved services': 'الخدمات المحفوظة',
  Requests: 'الطلبات',
  'My requests': 'طلباتي',
  Business: 'الأعمال',
  'Provider dashboard': 'لوحة مقدم الخدمة',
  Profile: 'الملف الشخصي',
  Notifications: 'الإشعارات',
  'Find a service': 'ابحث عن خدمة',
  'Service map': 'خريطة الخدمات',
  'Service listing': 'إدراج خدمة',
  'Provider verification': 'توثيق مقدم الخدمة',
  'Verification evidence': 'مستندات التوثيق',
  'Report content': 'الإبلاغ عن محتوى',
  'Request service': 'طلب خدمة',
  'Request details': 'تفاصيل الطلب',
  'Service details': 'تفاصيل الخدمة',
  Administration: 'الإدارة',
  'Verification review': 'مراجعة التوثيق',
  'Review report': 'مراجعة البلاغ',
  Beirut: 'بيروت',
  'FAST LOCAL HELP': 'مساعدة محلية سريعة',
  'What can we help with?': 'كيف يمكننا مساعدتك؟',
  'Describe the problem. We’ll match it to the right local service.':
    'صِف المشكلة وسنطابقها مع الخدمة المحلية المناسبة.',
  'Try “flat tire” or “leaking sink”': 'جرّب «إطار مثقوب» أو «مغسلة تسرّب الماء»',
  'Search by service, problem, or provider name': 'ابحث حسب الخدمة أو المشكلة أو اسم مقدم الخدمة',
  'Quick help': 'مساعدة سريعة',
  Plumbers: 'سباكون',
  Electricians: 'كهربائيون',
  Mechanics: 'ميكانيكيون',
  'Roadside Tire Help': 'مساعدة إطارات على الطريق',
  'Car Battery Help': 'مساعدة بطارية السيارة',
  Towing: 'سحب سيارات',
  'Cleaning Services': 'خدمات التنظيف',
  'House Maintenance': 'صيانة منزلية',
  'AC Repair': 'تصليح المكيفات',
  'Appliance Repair': 'تصليح الأجهزة',
  Carpenters: 'نجارون',
  Painters: 'دهّانون',
  Locksmiths: 'صانعو أقفال',
  'Pest Control': 'مكافحة الحشرات',
  'Moving Services': 'خدمات النقل',
  'Mobile Car Wash': 'غسيل سيارات متنقل',
  Handyman: 'عامل صيانة',
  'Delivery & Errands': 'توصيل ومشاوير',
  'Phone/Laptop Repair': 'تصليح الهواتف والكمبيوتر',
  'Laundry Services': 'خدمات الغسيل',
  'Choose what you need': 'اختر ما تحتاجه',
  'All services': 'كل الخدمات',
  'Top rated in Beirut': 'الأعلى تقييماً في بيروت',
  'Popular local professionals': 'مهنيون محليون موثوقون',
  'See all': 'عرض الكل',
  'Loading your account…': 'جارٍ تحميل حسابك…',
  'Welcome back': 'أهلاً بعودتك',
  'Create your account': 'أنشئ حسابك',
  'Sign in to keep your trusted services in one place.':
    'سجّل الدخول للاحتفاظ بخدماتك الموثوقة في مكان واحد.',
  'Join BeyBridge to save providers and manage your account.':
    'انضم إلى BeyBridge لحفظ مقدمي الخدمات وإدارة حسابك.',
  'Sign in': 'تسجيل الدخول',
  'Create account': 'إنشاء حساب',
  'Continue with Google': 'المتابعة باستخدام Google',
  'Continue with Apple': 'المتابعة باستخدام Apple',
  'or continue with': 'أو تابع باستخدام',
  Email: 'البريد الإلكتروني',
  Phone: 'الهاتف',
  'Full name': 'الاسم الكامل',
  'Your name': 'اسمك',
  'I want to': 'أريد أن',
  'Find services': 'أبحث عن خدمات',
  'Offer services': 'أقدّم خدمات',
  'You will create a listing first. Provider mode activates after the listing is saved.':
    'ستنشئ إدراجاً أولاً، ويتفعّل وضع مقدم الخدمة بعد حفظه.',
  'You can save local professionals and share reviews.':
    'يمكنك حفظ المهنيين المحليين ومشاركة المراجعات.',
  Password: 'كلمة المرور',
  'At least 8 characters': 'ثمانية أحرف على الأقل',
  'Your password': 'كلمة المرور',
  'Verify and continue': 'تحقق وتابع',
  'Send verification code': 'إرسال رمز التحقق',
  'Account created. Check your email to confirm it, then sign in.':
    'تم إنشاء الحساب. تحقق من بريدك الإلكتروني ثم سجّل الدخول.',
  'Enter your name to create an account.': 'أدخل اسمك لإنشاء حساب.',
  'Enter a valid email address.': 'أدخل بريداً إلكترونياً صالحاً.',
  'Sign-in was cancelled.': 'تم إلغاء تسجيل الدخول.',
  'Check your messages': 'تحقق من رسائلك',
  'Change number': 'تغيير الرقم',
  'Verification code sent by SMS.': 'تم إرسال رمز التحقق برسالة نصية.',
  'Enter the 6-digit verification code.': 'أدخل رمز التحقق المكوّن من 6 أرقام.',
  'Edit profile': 'تعديل الملف الشخصي',
  'Member since': 'عضو منذ',
  'Your reviews': 'مراجعاتك',
  'Default area': 'المنطقة الافتراضية',
  Language: 'اللغة',
  English: 'English',
  'Account type': 'نوع الحساب',
  Customer: 'عميل',
  'Service provider': 'مقدم خدمة',
  'Your provider business': 'نشاطك كمقدم خدمة',
  'Do you offer a service?': 'هل تقدم خدمة؟',
  'Manage listings, publishing status, availability, and customer reviews.':
    'أدر إدراجاتك وحالة النشر والتوافر ومراجعات العملاء.',
  'Create your first listing. Provider mode activates only after the listing is saved.':
    'أنشئ إدراجك الأول. يتفعّل وضع مقدم الخدمة فقط بعد حفظ الإدراج.',
  'Administrator dashboard': 'لوحة الإدارة',
  'Sign out': 'تسجيل الخروج',
  'Phone verified': 'تم التحقق من الهاتف',
  'Phone verification pending': 'التحقق من الهاتف معلّق',
  'Email verified': 'تم التحقق من البريد الإلكتروني',
  'Email confirmation pending': 'تأكيد البريد الإلكتروني معلّق',
  'Not added': 'غير مضاف',
  'Not selected': 'غير محدد',
  'Loading…': 'جارٍ التحميل…',
  'Make BeyBridge feel more personal': 'اجعل BeyBridge أكثر ملاءمة لك',
  'Close profile editor': 'إغلاق تعديل الملف الشخصي',
  'Phone number': 'رقم الهاتف',
  'Preferred language': 'اللغة المفضلة',
  'Save profile': 'حفظ الملف الشخصي',
  'Enter at least two characters for your name.': 'أدخل حرفين على الأقل لاسمك.',
  'Loading your saved services…': 'جارٍ تحميل خدماتك المحفوظة…',
  'Sign in to save services': 'سجّل الدخول لحفظ الخدمات',
  'Create an account or sign in, then keep trusted providers ready for the next time you need help.':
    'أنشئ حساباً أو سجّل الدخول واحتفظ بمقدمي الخدمات الموثوقين عند الحاجة.',
  'Go to account': 'الذهاب إلى الحساب',
  'Your trusted services': 'خدماتك الموثوقة',
  'Nothing saved yet': 'لا توجد خدمات محفوظة بعد',
  'Tap the heart on a service to keep it here for quick access later.':
    'اضغط على القلب في صفحة الخدمة لحفظها هنا والوصول إليها بسرعة.',
  'Browse services': 'تصفح الخدمات',
  'Reviews you shared': 'المراجعات التي شاركتها',
  'Your feedback helps neighbors choose local services with confidence.':
    'تساعد ملاحظاتك الآخرين على اختيار الخدمات المحلية بثقة.',
  'Unavailable service': 'خدمة غير متاحة',
  'Loading your reviews…': 'جارٍ تحميل مراجعاتك…',
  'No reviews yet': 'لا توجد مراجعات بعد',
  'After using a service, open its page to rate your experience and leave helpful details.':
    'بعد استخدام خدمة، افتح صفحتها لتقييم تجربتك وكتابة تفاصيل مفيدة.',
  'Sign in to list a service': 'سجّل الدخول لإدراج خدمة',
  'Create or sign in to your account, then add your first service listing. Provider mode activates only after the listing is saved.':
    'أنشئ حساباً أو سجّل الدخول ثم أضف إدراج خدمتك الأول. يتفعّل وضع مقدم الخدمة بعد حفظه.',
  'Go to profile': 'الذهاب إلى الملف الشخصي',
  'Listing not found': 'الإدراج غير موجود',
  'This listing is no longer available in your provider account.':
    'لم يعد هذا الإدراج متاحاً في حساب مقدم الخدمة.',
  'Back to dashboard': 'العودة إلى لوحة التحكم',
  'New service listing': 'إدراج خدمة جديدة',
  'Edit listing': 'تعديل الإدراج',
  'Loading your listing…': 'جارٍ تحميل إدراجك…',
  'GET DISCOVERED': 'اظهر للعملاء',
  'LISTING HEALTH': 'اكتمال الإدراج',
  'Service basics': 'أساسيات الخدمة',
  'Tell customers what you do': 'أخبر العملاء بما تقدمه',
  'Business or professional name': 'اسم النشاط أو المهني',
  'Category': 'الفئة',
  'Description': 'الوصف',
  'Service area': 'منطقة الخدمة',
  'Contact details': 'بيانات الاتصال',
  'Availability': 'التوافر',
  'Pricing': 'الأسعار',
  'Save draft': 'حفظ كمسودة',
  'Publish listing': 'نشر الإدراج',
  'Use my location': 'استخدام موقعي',
  'Remove': 'إزالة',
  'Emergency or same-day service': 'خدمة طارئة أو في اليوم نفسه',
  'Show customers that urgent requests are welcome.': 'أظهر للعملاء أنك تستقبل الطلبات العاجلة.',
  Currency: 'العملة',
  'Ready when you are': 'جاهز عندما تكون جاهزاً',
  'Save as private draft': 'حفظ كمسودة خاصة',
  'YOUR BUSINESS': 'نشاطك',
  PROVIDER: 'مقدم خدمة',
  'Manage your services': 'إدارة خدماتك',
  'Respond to customer requests, keep availability current, and manage your listings.':
    'استجب لطلبات العملاء وحدّث توافرك وأدر إدراجاتك.',
  'New service': 'خدمة جديدة',
  Listings: 'الإدراجات',
  Live: 'منشور',
  'Open requests': 'الطلبات المفتوحة',
  'Customer requests': 'طلبات العملاء',
  'No customer requests yet': 'لا توجد طلبات عملاء بعد',
  'New requests will appear here with the job details, timing, budget, and contact number.':
    'ستظهر الطلبات الجديدة هنا مع تفاصيل العمل والوقت والميزانية ورقم الاتصال.',
  'Create your first service listing': 'أنشئ إدراج خدمتك الأول',
  'Provider mode activates only after your first listing is saved.':
    'يتفعّل وضع مقدم الخدمة فقط بعد حفظ إدراجك الأول.',
  'Start my listing': 'بدء إدراجي',
  'Your listings': 'إدراجاتك',
  'Listing suspended': 'الإدراج موقوف',
  'Delete listing': 'حذف الإدراج',
  '30-day performance': 'أداء آخر 30 يوماً',
  'Private metrics across your service listings': 'مؤشرات خاصة لجميع إدراجات خدماتك',
  'Completed quoted value': 'قيمة عروض الأسعار المكتملة',
  'Requests by listing': 'الطلبات حسب الإدراج',
  'Performance data will appear here.': 'ستظهر بيانات الأداء هنا.',
  'Verified provider': 'مقدم خدمة موثّق',
  'Verification pending': 'التوثيق معلّق',
  'Verification needs more evidence': 'التوثيق يحتاج إلى مستندات إضافية',
  'Build customer trust': 'عزّز ثقة العملاء',
  Evidence: 'المستندات',
  Withdraw: 'سحب الطلب',
  Reapply: 'إعادة التقديم',
  Verify: 'توثيق',
  View: 'عرض',
  Edit: 'تعديل',
  Finish: 'إكمال',
  Pause: 'إيقاف مؤقت',
  Publish: 'نشر',
  Delete: 'حذف',
  Cancel: 'إلغاء',
  'Search services': 'البحث عن خدمات',
  'Matching ': 'مطابقة ',
  ' and related services': ' والخدمات ذات الصلة',
  'Search this area': 'البحث في هذه المنطقة',
  'Sort by': 'الترتيب حسب',
  Relevance: 'الصلة',
  Distance: 'المسافة',
  Rating: 'التقييم',
  'Sort by price': 'الترتيب حسب السعر',
  'Default order': 'الترتيب الافتراضي',
  'Low to high': 'من الأقل إلى الأعلى',
  'High to low': 'من الأعلى إلى الأقل',
  'Price: low to high': 'السعر: من الأقل إلى الأعلى',
  'Price: high to low': 'السعر: من الأعلى إلى الأقل',
  Quote: 'عرض سعر',
  'Open now': 'مفتوح الآن',
  'All categories': 'كل الفئات',
  'No services found': 'لم يتم العثور على خدمات',
  'Try another search or clear a filter.': 'جرّب بحثاً آخر أو أزل أحد عوامل التصفية.',
  'Clear filters': 'مسح عوامل التصفية',
  Map: 'الخريطة',
  List: 'القائمة',
  Verified: 'موثّق',
  Directions: 'الاتجاهات',
  'View service': 'عرض الخدمة',
  'Explore services on the map': 'استكشف الخدمات على الخريطة',
  'No places match these filters': 'لا توجد أماكن تطابق عوامل التصفية',
  'Try showing closed or unverified providers.': 'جرّب إظهار مقدمي الخدمات المغلقين أو غير الموثّقين.',
  'LOCATION BROWSER': 'تصفح المواقع',
  'Explore services by area': 'استكشف الخدمات حسب المنطقة',
  'No mapped services yet': 'لا توجد خدمات على الخريطة بعد',
  'Loading service map...': 'جارٍ تحميل خريطة الخدمات…',
  'Request this service': 'اطلب هذه الخدمة',
  'Save service': 'حفظ الخدمة',
  'Local service': 'خدمة محلية',
  New: 'جديد',
  'Urgent requests': 'طلبات عاجلة',
  'Service unavailable': 'الخدمة غير متاحة',
  'This provider is no longer listed.': 'لم يعد مقدم الخدمة مدرجاً.',
  'New—no reviews yet': 'جديد — لا توجد مراجعات بعد',
  'Edit your listing': 'تعديل إدراجك',
  'Get directions': 'الحصول على الاتجاهات',
  'Report this service': 'الإبلاغ عن هذه الخدمة',
  'Details coming soon.': 'ستتوفر التفاصيل قريباً.',
  About: 'حول الخدمة',
  Address: 'العنوان',
  'Opening hours': 'ساعات العمل',
  Closed: 'مغلق',
  'Edit your review': 'تعديل مراجعتك',
  'No written reviews yet.': 'لا توجد مراجعات مكتوبة بعد.',
  You: 'أنت',
  'Report review': 'الإبلاغ عن المراجعة',
  'Your rating': 'تقييمك',
  'Your experience': 'تجربتك',
  'Save changes': 'حفظ التغييرات',
  'Publish review': 'نشر المراجعة',
  'Delete review': 'حذف المراجعة',
  Reviews: 'المراجعات',
  'Write a review': 'اكتب مراجعة',
  'Review this service': 'قيّم هذه الخدمة',
  'Rate service': 'قيّم الخدمة',
  'View review': 'عرض المراجعة',
  'How was the service?': 'كيف كانت الخدمة؟',
  'Your review': 'مراجعتك',
  'Service completed': 'اكتملت الخدمة',
  'Share how the job went. Your feedback helps neighbors choose confidently and helps providers improve.':
    'شاركنا كيف سارت الخدمة. تساعد ملاحظاتك الآخرين على الاختيار بثقة وتساعد مقدمي الخدمات على التحسن.',
  'Your review helps other customers find dependable local services.':
    'تساعد مراجعتك العملاء الآخرين في العثور على خدمات محلية موثوقة.',
  'You can update your feedback if anything about your experience changed.':
    'يمكنك تحديث ملاحظاتك إذا تغيّر أي شيء في تجربتك.',
  'Reviews unlock after a completed service request.':
    'تُتاح المراجعات بعد اكتمال طلب الخدمة.',
  'Checking review eligibility…': 'جارٍ التحقق من أهلية المراجعة…',
  'Report listing': 'الإبلاغ عن الإدراج',
  'What do you need?': 'ماذا تحتاج؟',
  'Describe the job': 'صِف العمل',
  'Service address or area': 'عنوان الخدمة أو المنطقة',
  'Use map': 'استخدام الخريطة',
  'Preferred time (optional)': 'الوقت المفضل (اختياري)',
  'How urgent is it?': 'ما درجة الاستعجال؟',
  Standard: 'عادي',
  'Flexible timing': 'وقت مرن',
  Urgent: 'عاجل',
  'Within 24 hours': 'خلال 24 ساعة',
  Emergency: 'طارئ',
  'As soon as possible': 'في أقرب وقت ممكن',
  'Budget (optional)': 'الميزانية (اختياري)',
  'Your budget': 'ميزانيتك',
  'Send service request': 'إرسال طلب الخدمة',
  REQUESTING: 'طلب من',
  'Specific details help the provider quote and prepare.':
    'تساعد التفاصيل المحددة مقدم الخدمة على التسعير والاستعداد.',
  'Tap Use map to attach your precise GPS pin.': 'اضغط «استخدام الخريطة» لإرفاق موقع GPS دقيق.',
  'Choose emergency only when immediate help is genuinely needed.':
    'اختر طارئاً فقط عندما تحتاج فعلاً إلى مساعدة فورية.',
  'The provider can still send a different quote.': 'يمكن لمقدم الخدمة إرسال عرض سعر مختلف.',
  'Your profile name and phone number will be shared only with this provider so they can respond to the request.':
    'سيتم إرسال اسم ملفك ورقم هاتفك إلى مقدم الخدمة هذا فقط ليتمكن من الرد على الطلب.',
  'Select service location': 'حدد موقع الخدمة',
  'Use current location': 'استخدام الموقع الحالي',
  'Confirm location': 'تأكيد الموقع',
  'Choose service location': 'اختر موقع الخدمة',
  'Tap the map or drag the pin': 'اضغط على الخريطة أو اسحب الدبوس',
  'Loading map...': 'جارٍ تحميل الخريطة…',
  'The map could not load': 'تعذر تحميل الخريطة',
  'Check your connection, then try again.': 'تحقق من اتصالك ثم حاول مجدداً.',
  'Try again': 'حاول مجدداً',
  'Selected location': 'الموقع المحدد',
  'Use this location': 'استخدام هذا الموقع',
  'Request sent': 'تم إرسال الطلب',
  'Request timeline': 'سجل الطلب',
  'REQUEST STATUS': 'حالة الطلب',
  'Awaiting provider': 'بانتظار مقدم الخدمة',
  'The provider can accept, decline, or send a quote.':
    'يمكن لمقدم الخدمة القبول أو الرفض أو إرسال عرض سعر.',
  'Quote ready': 'عرض السعر جاهز',
  'The customer can accept the quote or decline it.': 'يمكن للعميل قبول عرض السعر أو رفضه.',
  Accepted: 'مقبول',
  'The provider accepted the job. Confirm timing before work begins.':
    'قبل مقدم الخدمة العمل. أكّد الموعد قبل البدء.',
  Scheduled: 'مجدول',
  'The service has been scheduled by the provider.': 'تم تحديد موعد الخدمة من مقدم الخدمة.',
  'In progress': 'قيد التنفيذ',
  'The provider has started working on this request.': 'بدأ مقدم الخدمة العمل على هذا الطلب.',
  Completed: 'مكتمل',
  'Work in progress': 'طلبات قيد التنفيذ',
  'You’re all caught up': 'لا توجد طلبات تحتاج إلى متابعة',
  'Open a request to review the latest provider response.':
    'افتح الطلب لمراجعة آخر رد من مقدم الخدمة.',
  'No active requests. Previous jobs remain available below.':
    'لا توجد طلبات نشطة. تبقى الطلبات السابقة متاحة أدناه.',
  'The provider marked this service as completed.': 'وضع مقدم الخدمة علامة مكتمل على هذه الخدمة.',
  Declined: 'مرفوض',
  'The provider could not take this request.': 'لم يتمكن مقدم الخدمة من قبول هذا الطلب.',
  Cancelled: 'ملغى',
  'This request is closed and no further action is needed.': 'هذا الطلب مغلق ولا يلزم إجراء آخر.',
  'New request': 'طلب جديد',
  'Quote sent': 'تم إرسال عرض السعر',
  'Quote: ': 'عرض السعر: ',
  'Budget: ': 'الميزانية: ',
  'Open exact map pin': 'فتح الموقع الدقيق على الخريطة',
  'GPS location attached by the customer': 'موقع GPS أرفقه العميل',
  'QUOTED PRICE': 'السعر المقترح',
  'The customer can accept or decline your quote.': 'يمكن للعميل قبول عرض السعر أو رفضه.',
  Details: 'التفاصيل',
  'MY REQUESTS': 'طلباتي',
  'Jobs stay organized': 'طلباتك منظمة دائماً',
  'Could not refresh requests': 'تعذر تحديث الطلبات',
  'No service requests yet': 'لا توجد طلبات خدمة بعد',
  'No requests yet': 'لا توجد طلبات بعد',
  'Find a provider and send a request to track the job here.':
    'ابحث عن مقدم خدمة وأرسل طلباً لتتبّع العمل هنا.',
  'Loading notifications…': 'جارٍ تحميل الإشعارات…',
  'No notifications yet': 'لا توجد إشعارات بعد',
  'Updates about requests, verification, and reports will appear here.':
    'ستظهر هنا تحديثات الطلبات والتوثيق والبلاغات.',
  'Enable push notifications': 'تفعيل الإشعارات الفورية',
  'This device is registered': 'هذا الجهاز مسجّل',
  'Get device alerts': 'تلقي إشعارات الجهاز',
  'Device alerts unavailable': 'إشعارات الجهاز غير متاحة',
  'Opt in for request, trust, and listing updates when you are away from the app.':
    'فعّل إشعارات الطلبات والتوثيق والقوائم عندما تكون خارج التطبيق.',
  'Send test alert': 'إرسال إشعار تجريبي',
  'Queueing test…': 'جارٍ تجهيز الاختبار…',
  'Test alert queued. Put BeyBridge in the background and check your tray.':
    'تم تجهيز الإشعار التجريبي. ضع BeyBridge في الخلفية وتحقق من شريط الإشعارات.',
  'Test alert sent. Check your Android notification tray.':
    'تم إرسال الإشعار التجريبي. تحقق من شريط إشعارات Android.',
  'The test alert is still queued. Pull to refresh in a moment.':
    'لا يزال الإشعار التجريبي في قائمة الانتظار. اسحب للتحديث بعد لحظات.',
  'Turn off': 'إيقاف',
  Enable: 'تفعيل',
  'Sign in for account updates': 'سجّل الدخول لتلقي تحديثات الحساب',
  'ACCOUNT ACTIVITY': 'نشاط الحساب',
  'Mark all read': 'تحديد الكل كمقروء',
  'Nothing new yet': 'لا جديد حتى الآن',
  'Mark all as read': 'تحديد الكل كمقروء',
  'Clear all': 'مسح الكل',
  'Administrator access required': 'يلزم وصول إداري',
  'This account does not have a platform-administrator role.':
    'لا يملك هذا الحساب صلاحية إدارة المنصة.',
  'Checking administrator access': 'جارٍ التحقق من صلاحية الإدارة',
  'One moment…': 'لحظة من فضلك…',
  'Verification requests': 'طلبات التوثيق',
  Reports: 'البلاغات',
  Pending: 'معلّق',
  Approved: 'مقبول',
  Rejected: 'مرفوض',
  Reviewing: 'قيد المراجعة',
  Resolved: 'تم الحل',
  'BEYBRIDGE OPERATIONS': 'عمليات BEYBRIDGE',
  'Trust & safety dashboard': 'لوحة الثقة والسلامة',
  'Review provider evidence, investigate reports, and record every moderation action.':
    'راجع مستندات مقدمي الخدمات وتحقق من البلاغات وسجّل كل إجراء إشرافي.',
  'Refreshing queues…': 'جارٍ تحديث قوائم الانتظار…',
  'PROVIDER VERIFICATION': 'توثيق مقدم الخدمة',
  'Evidence summary': 'ملخص المستندات',
  'Decision note': 'ملاحظة القرار',
  Reject: 'رفض',
  Approve: 'موافقة',
  'No decision note was recorded.': 'لم يتم تسجيل ملاحظة للقرار.',
  'CONTENT REPORT': 'بلاغ محتوى',
  'Reporter details': 'تفاصيل البلاغ',
  'Content snapshot at reporting time': 'نسخة المحتوى وقت الإبلاغ',
  'Investigation outcome': 'نتيجة التحقيق',
  'Provider listing moderation': 'الإشراف على إدراج مقدم الخدمة',
  'TRUST & SAFETY': 'الثقة والسلامة',
  'What is the problem?': 'ما المشكلة؟',
  'What happened?': 'ماذا حدث؟',
  'Submit private report': 'إرسال بلاغ خاص',
  'Submit for review': 'إرسال للمراجعة',
  'Verification documents': 'مستندات التوثيق',
  Private: 'خاص',
  'Loading documents…': 'جارٍ تحميل المستندات…',
  'No documents attached.': 'لا توجد مستندات مرفقة.',
  'Review pending': 'المراجعة معلّقة',
  'Back to Business': 'العودة إلى الأعمال',
  'Sign-in could not be completed': 'تعذر إكمال تسجيل الدخول',
  'Back to account': 'العودة إلى الحساب',
  'Completing sign-in…': 'جارٍ إكمال تسجيل الدخول…',
  'BeyBridge will return you to your account automatically.':
    'سيعيدك BeyBridge إلى حسابك تلقائياً.',
  'An administrator will review your evidence. You can safely add or remove supporting documents while the request is pending.':
    'سيراجع المسؤول مستنداتك. يمكنك إضافة المستندات الداعمة أو إزالتها بأمان ما دام الطلب قيد المراجعة.',
  'Choose a category for ratings and a draggable results list.':
    'اختر فئة لعرض التقييمات وقائمة نتائج قابلة للسحب.',
  'Clear details help customers understand the service and contact you confidently.':
    'تساعد التفاصيل الواضحة العملاء على فهم الخدمة والتواصل معك بثقة.',
  'Completed decisions remain in Supabase as an audit trail and are not silently deleted.':
    'تبقى القرارات المكتملة في Supabase كسجل تدقيق ولا تُحذف بصمت.',
  'Confirm the stated identity and records outside the app before approving. A badge means evidence was reviewed; it is not a service guarantee.':
    'تحقق من الهوية والسجلات المذكورة خارج التطبيق قبل الموافقة. تعني الشارة أن المستندات روجعت، وليست ضماناً للخدمة.',
  'Connect Supabase to enable accounts': 'اربط Supabase لتفعيل الحسابات',
  'Copy `.env.example`, fill in the values from Supabase → Connect, then reload the app.':
    'انسخ `.env.example`، وأدخل القيم من Supabase ← Connect، ثم أعد تحميل التطبيق.',
  'Create .env.local': 'أنشئ ملف .env.local',
  'Current restriction:': 'القيد الحالي:',
  'Customers need the essentials before they can choose you. You can save a draft and publish when it is ready.':
    'يحتاج العملاء إلى المعلومات الأساسية قبل اختيارك. يمكنك حفظ مسودة ونشرها عندما تصبح جاهزة.',
  'Document uploads are the next security milestone. For now, provide only references an administrator can verify—never include passwords, bank details, or national-ID images.':
    'رفع المستندات هو الخطوة الأمنية التالية. حالياً، قدم فقط مراجع يمكن للمسؤول التحقق منها، ولا تضع كلمات مرور أو بيانات مصرفية أو صور هوية وطنية.',
  'Drafts stay private. Publishing makes the listing searchable and open to reviews.':
    'تبقى المسودات خاصة. النشر يجعل الإدراج قابلاً للبحث والتقييم.',
  'Enter the code sent to': 'أدخل الرمز المرسل إلى',
  'Follow provider responses, review quotes, and keep active work in one place.':
    'تابع ردود مقدمي الخدمات وراجع عروض الأسعار واحتفظ بالأعمال النشطة في مكان واحد.',
  'Include your country code. Lebanese local numbers are formatted as +961 automatically.':
    'أدخل رمز الدولة. تُنسّق الأرقام اللبنانية المحلية تلقائياً بصيغة +961.',
  'Only the listing owner and platform administrators can open these files. Never upload passwords, payment-card details, or unrelated personal records.':
    'يمكن فقط لمالك الإدراج ومسؤولي المنصة فتح هذه الملفات. لا ترفع كلمات مرور أو بيانات بطاقات دفع أو سجلات شخصية غير مرتبطة.',
  'Open any provider and tap Request service to describe the job and ask for a response.':
    'افتح صفحة أي مقدم خدمة واضغط على طلب الخدمة لوصف العمل وطلب الرد.',
  'Open the map to place a pin, drag it, or use your current location.':
    'افتح الخريطة لوضع دبوس أو سحبه أو استخدام موقعك الحالي.',
  'Private PDF, JPEG, or PNG evidence · 5 MB per file':
    'مستندات خاصة بصيغة PDF أو JPEG أو PNG · ‏5 ميغابايت لكل ملف',
  'Published providers with a saved latitude and longitude will appear here.':
    'سيظهر هنا مقدمو الخدمات المنشورون الذين لديهم إحداثيات محفوظة.',
  'Reporting does not automatically remove content. An administrator reviews the context and records the outcome.':
    'لا يؤدي الإبلاغ إلى إزالة المحتوى تلقائياً. يراجع المسؤول السياق ويسجل النتيجة.',
  'Request replies, verification decisions, and report outcomes will appear here.':
    'ستظهر هنا ردود الطلبات وقرارات التوثيق ونتائج البلاغات.',
  'The account experience is ready. Add your Supabase project values to a local environment file to turn it on.':
    'تجربة الحساب جاهزة. أضف قيم مشروع Supabase إلى ملف البيئة المحلي لتفعيلها.',
  'The interactive pin picker is available in the Android and iOS app. On web, you can attach your precise current location.':
    'يتوفر اختيار الدبوس التفاعلي في تطبيقَي Android وiOS. على الويب، يمكنك إرفاق موقعك الحالي بدقة.',
  'Updates about your service requests, provider listing, verification, and reports will stay organized here.':
    'ستبقى تحديثات طلبات الخدمة وإدراج مقدم الخدمة والتوثيق والبلاغات منظمة هنا.',
  'Verification tells customers that BeyBridge reviewed the identity and evidence behind this listing. Approval is not automatic.':
    'يخبر التوثيق العملاء أن BeyBridge راجع الهوية والمستندات المرتبطة بهذا الإدراج. الموافقة ليست تلقائية.',
  'Your report is private. The person or business you report will not see your identity.':
    'بلاغك خاص، ولن يرى الشخص أو النشاط الذي تبلغ عنه هويتك.',
  'REQUEST OPTIONS': 'خيارات الطلب',
  'CUSTOMER BUDGET': 'ميزانية العميل',
  'PROVIDER RESPONSE': 'رد مقدم الخدمة',
  'JOB DETAILS': 'تفاصيل العمل',
  'SERVICE LOCATION': 'موقع الخدمة',
  'PREFERRED TIMING': 'الوقت المفضل',
  'URGENCY': 'الأولوية',
  'Quote:': 'عرض السعر:',
  'Budget:': 'الميزانية:',
  'and related services': 'والخدمات ذات الصلة',
  nearby: 'بالقرب منك',
  away: 'بعيداً',
  attention: 'تحتاج متابعة',
  customer: 'عميل',
  request: 'طلب',
  saved: 'محفوظة',
  done: 'مكتمل',
  Report: 'إبلاغ',
  Submitted: 'تم الإرسال',
  Sent: 'أُرسل',
  'Latest action': 'آخر إجراء',
  'This request was': 'كان هذا الطلب',
  'EXPO_PUBLIC_SUPABASE_URL=…': 'EXPO_PUBLIC_SUPABASE_URL=…',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…': 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…',
  '6-digit verification code': 'رمز التحقق المكوّن من 6 أرقام',
  'A signed-in account helps prevent abuse while your identity remains private from the reported person or business.':
    'يساعد الحساب المسجل على منع إساءة الاستخدام، وتبقى هويتك مخفية عن الشخص أو النشاط المُبلّغ عنه.',
  'A simple signal helps customers decide': 'معلومة بسيطة تساعد العملاء على الاختيار',
  'About this service': 'حول هذه الخدمة',
  Accept: 'قبول',
  'Accept quote': 'قبول عرض السعر',
  Active: 'نشطة',
  'Add a helpful response, availability, or questions (optional)':
    'أضف رداً مفيداً أو أوقات التوفر أو أسئلة (اختياري)',
  'Add a phone number first': 'أضف رقم هاتف أولاً',
  All: 'الكل',
  'Back to profile': 'العودة إلى الملف الشخصي',
  'BeyBridge — Explore Beirut, one service at a time': 'BeyBridge — استكشف بيروت، خدمة تلو الأخرى',
  'Business registration': 'تسجيل النشاط',
  'Business registration (optional)': 'تسجيل النشاط (اختياري)',
  Call: 'اتصال',
  'Call now': 'اتصل الآن',
  'Cancel job': 'إلغاء العمل',
  'Cancel request': 'إلغاء الطلب',
  'Center map on my location': 'توسيط الخريطة على موقعي',
  'Change your account type to Service provider from your profile to list a service.':
    'غيّر نوع حسابك إلى مقدم خدمة من ملفك الشخصي لإدراج خدمة.',
  'Checking for the latest provider responses.': 'جارٍ التحقق من أحدث ردود مقدمي الخدمات.',
  'Checking the latest status and response.': 'جارٍ التحقق من أحدث حالة ورد.',
  'Checking the listing and its latest review status.': 'جارٍ التحقق من الإدراج وآخر حالة مراجعة.',
  'Choose service location on map': 'اختر موقع الخدمة على الخريطة',
  'Clear search': 'مسح البحث',
  'Close category results': 'إغلاق نتائج الفئة',
  'Close location picker': 'إغلاق اختيار الموقع',
  'Close review form': 'إغلاق نموذج المراجعة',
  'Completed, declined, and cancelled requests': 'الطلبات المكتملة والمرفوضة والملغاة',
  Completion: 'الإنجاز',
  'Contact and availability': 'التواصل والتوفر',
  'Content reports': 'بلاغات المحتوى',
  'Content unavailable': 'المحتوى غير متاح',
  'Customer budget': 'ميزانية العميل',
  Decline: 'رفض',
  'Decline quote': 'رفض عرض السعر',
  'Describe the issue and include the facts an administrator should check. Do not include passwords or payment-card details.':
    'صف المشكلة وأضف الحقائق التي يجب على المسؤول التحقق منها. لا تضع كلمات مرور أو بيانات بطاقات دفع.',
  Dismiss: 'إغلاق',
  'Every quote, acceptance, and completed job will stay organized here.':
    'ستبقى عروض الأسعار والموافقات والأعمال المكتملة منظمة هنا.',
  'Example: 5': 'مثال: 5',
  'Example: Cedar Home Repairs': 'مثال: Cedar Home Repairs',
  'Example: Friday after 3 PM': 'مثال: الجمعة بعد الساعة 3 مساءً',
  'Example: The kitchen sink is leaking under the cabinet and the valve may need replacing.':
    'مثال: حوض المطبخ يسرّب الماء تحت الخزانة وقد يحتاج الصمام إلى الاستبدال.',
  'Expand or collapse map results': 'توسيع نتائج الخريطة أو طيّها',
  Experience: 'الخبرة',
  'Explain the jobs you handle, what makes your service reliable, and what customers should expect.':
    'اشرح الأعمال التي تنفذها وما الذي يجعل خدمتك موثوقة وما الذي ينبغي أن يتوقعه العملاء.',
  'Explain who you are, your relevant experience, which records an administrator can verify, and how customers can confirm your business identity.':
    'اشرح من أنت وخبرتك ذات الصلة والسجلات التي يستطيع المسؤول التحقق منها وكيف يمكن للعملاء التأكد من هوية نشاطك.',
  'Filter by service type': 'التصفية حسب نوع الخدمة',
  'Finish the job': 'إنهاء العمل',
  'Hamra, Achrafieh, Verdun…': 'الحمرا، الأشرفية، فردان…',
  'Hamra, Beirut, Greater Beirut…': 'الحمرا، بيروت، بيروت الكبرى…',
  History: 'السجل',
  'It may have been removed, or your account does not have access to it.':
    'ربما تمت إزالته أو لا يملك حسابك صلاحية الوصول إليه.',
  'Job details': 'تفاصيل العمل',
  'Leave blank': 'اتركه فارغاً',
  'Licence, syndicate, or certification number': 'رقم الترخيص أو النقابة أو الشهادة',
  'Listing unavailable': 'الإدراج غير متاح',
  'Listing verified': 'الإدراج موثّق',
  'Loading report': 'جارٍ تحميل البلاغ',
  'Loading request': 'جارٍ تحميل الطلب',
  'Loading requests': 'جارٍ تحميل الطلبات',
  'Loading verification': 'جارٍ تحميل التوثيق',
  'Loading verification request': 'جارٍ تحميل طلب التوثيق',
  'Loading your profile and this service.': 'جارٍ تحميل ملفك الشخصي وهذه الخدمة.',
  'Loading your provider profile and listings.': 'جارٍ تحميل ملف مقدم الخدمة وإدراجاتك.',
  'Make it easy to reach you': 'سهّل التواصل معك',
  'Manage customer requests from your Business tab.': 'أدر طلبات العملاء من تبويب الأعمال.',
  'Manage the job': 'إدارة العمل',
  'Map for choosing the service location': 'خريطة لاختيار موقع الخدمة',
  'Map of service providers in Beirut': 'خريطة مقدمي الخدمات في بيروت',
  'Mark as reviewing': 'تحديد كقيد المراجعة',
  'Mark completed': 'تحديد كمكتمل',
  'Mark scheduled': 'تحديد كموعد مجدول',
  'Mobile number': 'رقم الهاتف المحمول',
  'Monday–Friday': 'الاثنين–الجمعة',
  'Only the owner can request verification for this listing.':
    'يمكن لمالك الإدراج فقط طلب توثيقه.',
  'Open administrator dashboard': 'فتح لوحة الإدارة',
  'Open and in-review customer reports': 'بلاغات العملاء المفتوحة وقيد المراجعة',
  'Open Business': 'فتح الأعمال',
  'Open exact service location on the map': 'فتح موقع الخدمة الدقيق على الخريطة',
  'Open reports': 'فتح البلاغات',
  'Open service map for Beirut': 'فتح خريطة الخدمات في بيروت',
  'Pending identity and business-evidence reviews': 'مراجعات الهوية ومستندات النشاط المعلّقة',
  'Preferred timing': 'الوقت المفضل',
  'Preparing your dashboard': 'جارٍ تجهيز لوحة التحكم',
  'Preparing your request': 'جارٍ تجهيز طلبك',
  'Pricing style': 'أسلوب التسعير',
  'Primary service area': 'منطقة الخدمة الأساسية',
  'Professional licence': 'ترخيص مهني',
  'Professional licence (optional)': 'ترخيص مهني (اختياري)',
  'Provider mode is not enabled': 'وضع مقدم الخدمة غير مفعّل',
  'Provider response': 'رد مقدم الخدمة',
  'Provider verification is available only to the listing owner.':
    'توثيق مقدم الخدمة متاح فقط لمالك الإدراج.',
  'Providers need a reliable way to contact you about the job. Add your number in Profile, then return here.':
    'يحتاج مقدم الخدمة إلى وسيلة موثوقة للتواصل معك بشأن العمل. أضف رقمك في الملف الشخصي ثم عد إلى هنا.',
  'Quote amount': 'قيمة عرض السعر',
  'Quote success': 'نجاح عروض الأسعار',
  Reason: 'السبب',
  Recommended: 'موصى به',
  'Record what you checked, your decision, and any follow-up needed.':
    'سجّل ما تحققت منه وقرارك وأي متابعة لازمة.',
  'Record what you checked. A reason is required when rejecting.':
    'سجّل ما تحققت منه. يجب إدخال سبب عند الرفض.',
  'Registration name or number': 'اسم التسجيل أو رقمه',
  'Report history': 'سجل البلاغ',
  'Report unavailable': 'البلاغ غير متاح',
  'Reported content': 'المحتوى المُبلّغ عنه',
  'Request options': 'خيارات الطلب',
  'Request unavailable': 'الطلب غير متاح',
  'Requests that still need attention or work': 'الطلبات التي ما زالت تحتاج إلى متابعة أو عمل',
  Resolve: 'حل البلاغ',
  'Resolved and dismissed reports remain available for audit and restoration actions':
    'تبقى البلاغات المحلولة والمغلقة متاحة للتدقيق وإجراءات الاستعادة',
  'Respond to customer': 'الرد على العميل',
  'Response rate': 'معدل الاستجابة',
  'Retrieving the evidence and review history.': 'جارٍ استرجاع المستندات وسجل المراجعة.',
  'Retrieving the report and moderation history.': 'جارٍ استرجاع البلاغ وسجل الإشراف.',
  'Review this quote': 'مراجعة عرض السعر',
  'Search for a service': 'البحث عن خدمة',
  'Selected service location pin': 'دبوس موقع الخدمة المحدد',
  'Send quote': 'إرسال عرض السعر',
  'Service description': 'وصف الخدمة',
  'Service location': 'موقع الخدمة',
  'Service provider locations': 'مواقع مقدمي الخدمات',
  'Service requests are private to the customer and provider.':
    'طلبات الخدمة خاصة بالعميل ومقدم الخدمة.',
  'Service setup': 'إعداد الخدمة',
  'Set expectations before customers call': 'وضّح التوقعات قبل اتصال العملاء',
  'Show all filtered services': 'إظهار كل الخدمات المصفاة',
  'Sign in required': 'تسجيل الدخول مطلوب',
  'Sign in to manage your business': 'سجّل الدخول لإدارة نشاطك',
  'Sign in to report': 'سجّل الدخول للإبلاغ',
  'Sign in to request this service': 'سجّل الدخول لطلب هذه الخدمة',
  'Sign in to track requests': 'سجّل الدخول لمتابعة الطلبات',
  'Sign in to view this request': 'سجّل الدخول لعرض هذا الطلب',
  'Sign in with an administrator account to open this dashboard.':
    'سجّل الدخول بحساب مسؤول لفتح لوحة التحكم هذه.',
  'Sort and filter category results': 'فرز نتائج الفئة وتصفيتها',
  'Start job': 'بدء العمل',
  'Street, building, landmark…': 'الشارع، المبنى، علامة مميزة…',
  'Street, building, neighborhood, or landmark': 'الشارع أو المبنى أو الحي أو علامة مميزة',
  'Submit search': 'تنفيذ البحث',
  'Submitted by': 'أرسله',
  Suspended: 'موقوف',
  'The service or review you tried to report is no longer available.':
    'لم تعد الخدمة أو المراجعة التي حاولت الإبلاغ عنها متاحة.',
  'This is your content': 'هذا محتواك',
  'This is your listing': 'هذا إدراجك',
  'This listing is not currently accepting requests.': 'هذا الإدراج لا يقبل الطلبات حالياً.',
  'This report is restricted to platform administrators.': 'هذا البلاغ متاح لمسؤولي المنصة فقط.',
  'This report was not found or is no longer visible.': 'لم يتم العثور على هذا البلاغ أو لم يعد مرئياً.',
  'This review is restricted to platform administrators.': 'هذه المراجعة متاحة لمسؤولي المنصة فقط.',
  'This verification request was not found or is no longer visible.':
    'لم يتم العثور على طلب التوثيق أو لم يعد مرئياً.',
  'Top rated': 'الأعلى تقييماً',
  'Try “tire change” or “broken fridge”': 'جرّب «تغيير إطار» أو «ثلاجة معطلة»',
  Urgency: 'الأولوية',
  'Use my current location': 'استخدام موقعي الحالي',
  'Use the editing controls instead of reporting content you own.':
    'استخدم أدوات التعديل بدلاً من الإبلاغ عن محتوى تملكه.',
  Verification: 'التوثيق',
  'View filtered services as a full list': 'عرض الخدمات المصفاة كقائمة كاملة',
  'View these services on the map': 'عرض هذه الخدمات على الخريطة',
  'Waiting for the customer': 'بانتظار العميل',
  'What went well? Was the provider punctual, clear, and fairly priced?':
    'ما الذي سار جيداً؟ هل كان مقدم الخدمة ملتزماً بالوقت وواضحاً وسعره عادلاً؟',
  WhatsApp: 'واتساب',
  'WhatsApp number (optional)': 'رقم واتساب (اختياري)',
  'Where and how you work': 'أين وكيف تعمل',
  'Withdraw request': 'سحب الطلب',
  'Years of experience': 'سنوات الخبرة',
  'Your account keeps requests private and lets you follow each response.':
    'يحافظ حسابك على خصوصية الطلبات ويتيح لك متابعة كل رد.',
  'Your current location': 'موقعك الحالي',
  'Your listings, reviews, and publishing controls will appear here.':
    'ستظهر هنا إدراجاتك ومراجعاتك وأدوات التحكم بالنشر.',
  'you@example.com': 'name@example.com',
  'Choose the reason that best describes the problem.': 'اختر السبب الذي يصف المشكلة بأفضل شكل.',
  'Add at least 10 characters so the administrator can investigate.':
    'أضف 10 أحرف على الأقل ليتمكن المسؤول من التحقق.',
  'The sign-in response could not be read. Please try again.':
    'تعذرت قراءة استجابة تسجيل الدخول. حاول مجدداً.',
  'Sign-in did not finish. Return to your account and try again.':
    'لم يكتمل تسجيل الدخول. عد إلى حسابك وحاول مجدداً.',
  'Add a business or professional name before saving.':
    'أضف اسم النشاط أو الاسم المهني قبل الحفظ.',
  'Years of experience must be a whole number between 0 and 80.':
    'يجب أن تكون سنوات الخبرة رقماً صحيحاً بين 0 و80.',
  'Add at least 30 characters describing what customers can expect.':
    'أضف 30 حرفاً على الأقل لوصف ما يمكن أن يتوقعه العملاء.',
  'Add the main area where you provide this service.': 'أضف المنطقة الأساسية التي تقدم فيها هذه الخدمة.',
  'Add a valid phone number so customers can contact you.':
    'أضف رقم هاتف صالحاً ليتمكن العملاء من التواصل معك.',
  'Add your weekday availability before publishing.': 'أضف أوقات توفرك خلال أيام الأسبوع قبل النشر.',
  'Add a valid starting price, or select “Contact for quote.”':
    'أضف سعراً ابتدائياً صالحاً أو اختر «تواصل للحصول على عرض سعر».',
  'Explain your identity, experience, and verification evidence in at least 30 characters.':
    'اشرح هويتك وخبرتك ومستندات التوثيق في 30 حرفاً على الأقل.',
  'Tell people a little more—use at least 10 characters.':
    'أخبر الآخرين بمزيد من التفاصيل باستخدام 10 أحرف على الأقل.',
  'Describe the job in at least 20 characters so the provider can respond accurately.':
    'صف العمل في 20 حرفاً على الأقل ليتمكن مقدم الخدمة من الرد بدقة.',
  'Add the address or area where the service is needed.':
    'أضف العنوان أو المنطقة التي تحتاج فيها إلى الخدمة.',
  'Enter a positive budget or leave it blank.': 'أدخل ميزانية موجبة أو اترك الحقل فارغاً.',
  'The document could not be opened.': 'تعذر فتح المستند.',
  'Phone verification is not enabled yet. Configure an SMS provider in Supabase Auth.':
    'التحقق عبر الهاتف غير مفعّل بعد. اضبط مزود رسائل SMS في Supabase Auth.',
  'This social sign-in method is not enabled yet in Supabase Auth.':
    'طريقة تسجيل الدخول هذه غير مفعّلة بعد في Supabase Auth.',
  'That verification code expired. Request a new code and try again.':
    'انتهت صلاحية رمز التحقق. اطلب رمزاً جديداً وحاول مجدداً.',
  'That verification code is incorrect. Check the SMS and try again.':
    'رمز التحقق غير صحيح. راجع الرسالة النصية وحاول مجدداً.',
  'Too many attempts. Wait a moment before requesting another code.':
    'محاولات كثيرة جداً. انتظر قليلاً قبل طلب رمز آخر.',
  'Service requests could not be refreshed.': 'تعذر تحديث طلبات الخدمة.',
  'Sign in to request a service.': 'سجّل الدخول لطلب خدمة.',
  Monday: 'الاثنين',
  Tuesday: 'الثلاثاء',
  Wednesday: 'الأربعاء',
  Thursday: 'الخميس',
  Friday: 'الجمعة',
  Saturday: 'السبت',
  Sunday: 'الأحد',
  'Sign in to continue': 'سجّل الدخول للمتابعة',
  Retry: 'إعادة المحاولة',
};

function translateDynamic(text: string): string | null {
  const savedCount = text.match(/^(\d+) (service|services) saved$/);
  if (savedCount) return `${savedCount[1]} خدمة محفوظة`;

  const serviceCount = text.match(/^(\d+) (service|services)$/);
  if (serviceCount) return `${serviceCount[1]} خدمة`;

  const publishedCount = text.match(/^(\d+) published$/);
  if (publishedCount) return `${publishedCount[1]} منشورة`;

  const reviewCount = text.match(/^(\d+) customer (review|reviews)$/);
  if (reviewCount) return `${reviewCount[1]} مراجعة من العملاء`;

  const requestAttention = text.match(/^(\d+) requests? needs? attention$/);
  if (requestAttention) return `${requestAttention[1]} طلب يحتاج إلى متابعة`;

  const ready = text.match(/^(\d+)% ready to publish$/);
  if (ready) return `جاهز للنشر بنسبة ${ready[1]}٪`;

  const characterCounter = text.match(
    /^(\d+)\/(\d+) · minimum (\d+) characters( to publish)?$/
  );
  if (characterCounter) {
    return `${characterCounter[1]}/${characterCounter[2]} · الحد الأدنى ${characterCounter[3]} أحرف${
      characterCounter[4] ? ' للنشر' : ''
    }`;
  }

  const adminQueue = text.match(/^(\d+) verification · (\d+) report items waiting$/);
  if (adminQueue) {
    return `${adminQueue[1]} طلب توثيق · ${adminQueue[2]} بلاغ بانتظار المراجعة`;
  }

  const matchingServices = text.match(/^Matching (.+) and related services$/);
  if (matchingServices) {
    return `مطابقة ${ARABIC[matchingServices[1]] ?? matchingServices[1]} والخدمات ذات الصلة`;
  }

  const minChars = text.match(/^Password must be at least (\d+) characters\.$/);
  if (minChars) return `يجب أن تتكون كلمة المرور من ${minChars[1]} أحرف على الأقل.`;

  return null;
}

function getStoredLocale(): AppLocale {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const { profile } = useMarketplace();
  const locale = profile?.preferredLanguage ?? getStoredLocale();

  useEffect(() => {
    if (!profile?.preferredLanguage) return;
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, profile.preferredLanguage);
    } catch {
      // The selected locale still applies for the current session.
    }
  }, [profile?.preferredLanguage]);

  const value = useMemo<LocalizationContextValue>(
    () => ({
      locale,
      isRTL: locale === 'ar',
      direction: locale === 'ar' ? 'rtl' : 'ltr',
      t: (text) => {
        if (locale !== 'ar') return text;
        return ARABIC[text] ?? translateDynamic(text) ?? text;
      },
    }),
    [locale]
  );

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization() {
  const context = React.use(LocalizationContext);
  if (!context) throw new Error('useLocalization must be used inside LocalizationProvider');
  return context;
}
