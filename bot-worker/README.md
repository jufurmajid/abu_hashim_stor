# بوت إدارة أبو هاشم

هذا البوت منفصل عن الموقع الثابت. الموقع يبقى Static داخل GitHub، بينما البوت يعمل كـ Cloudflare Worker صغير.

## المتغيرات السرية

ضعها في Worker Secrets، ولا تضعها داخل GitHub:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `ADMIN_CHAT_ID`
- `GITHUB_TOKEN`

### GITHUB_TOKEN

يجب أن يكون Token بصلاحية كتابة محتوى المستودع فقط قدر الإمكان.

## الأوامر

`/add الاسم | السعر | التصنيف | الإيموجي`

`/edit رقم | الاسم | السعر | التصنيف | الإيموجي`

`/hide رقم`

`/show رقم`

`/delete رقم`

`/list`

كل تعديل يكتب مباشرة إلى `data/products.json` ويصنع Commit في GitHub.

## ملاحظة

لا تشارك أي Token داخل المحادثة أو داخل ملفات الموقع.
