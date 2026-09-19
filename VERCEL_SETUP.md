# متجر أبو هاشم

متجر عربي بسيط للحوم والألبان والأجبان.

## التشغيل على Vercel

متغيرات البيئة المطلوبة:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- ADMIN_BOT_TOKEN
- ADMIN_CHAT_ID
- ORDERS_BOT_TOKEN
- ORDERS_CHAT_ID
- TELEGRAM_WEBHOOK_SECRET
- WEBHOOK_SETUP_SECRET

بعد إنشاء مشروع Supabase، شغّل الملف `supabase/schema.sql` في SQL Editor.

بعد نشر المشروع على Vercel وإضافة المتغيرات، افتح مرة واحدة:
`/api/setup-webhooks?secret=WEBHOOK_SETUP_SECRET`

الموقع يعمل عبر `/`، المنتجات عبر `/api/products` والطلبات عبر `/api/orders`.
