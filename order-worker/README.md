# بوت استقبال طلبات أبو هاشم

هذا Worker مستقل عن بوت الإدارة. الموقع الثابت يرسل بيانات الطلب إلى هذا Worker، والـ Worker يرسل الطلب إلى بوت Telegram المخصص للطلبات.

## Secrets

ضع داخل Cloudflare Worker Secrets:

- `TELEGRAM_BOT_TOKEN` — توكن بوت استقبال الطلبات فقط.
- `ORDERS_CHAT_ID` — رقم المجموعة/الحساب الذي يستلم الطلبات.

لا تضع أي Token داخل GitHub.

## بعد النشر

خذ رابط Worker، مثلاً:

`https://abu-hashim-order-bot.<YOUR-SUBDOMAIN>.workers.dev`

ثم ضع الرابط في:

`data/store.json`

داخل الحقل:

`orderApiUrl`

الموقع سيرسل الطلبات إليه مباشرة.

## ملاحظات

- لا توجد قاعدة بيانات.
- الأسعار يعاد التحقق منها من `data/products.json` قبل إرسال الطلب.
- المنتج المخفي لا يمكن طلبه.
- الطلب يصل مباشرة إلى Telegram.
- الموقع يبقى Static.
