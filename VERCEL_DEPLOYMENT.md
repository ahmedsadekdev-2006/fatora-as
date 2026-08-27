# Vercel deployment

This repository is deployed as one Vercel project. Vercel serves the Vite
frontend from `dist/public` and discovers the backend Functions under `api/`.

## Vercel project

Create a Vercel project from the repository with these settings:

- Root Directory: `.`
- Framework Preset: `Vite`
- Build Command: `pnpm run build:client`
- Output Directory: `dist/public`
- Install Command: `pnpm install --frozen-lockfile`

Frontend environment variables:

```dotenv
# يتغير: ضع رابط مشروع Backend بعد نشره، بدون / في النهاية
VITE_API_URL=https://<backend-project>.vercel.app

# اختياري: اتركه فارغًا إذا لم تستخدم الخريطة
VITE_GOOGLE_MAPS_API_KEY=
```

في Vercel أضف اسم المتغير والقيمة فقط، ولا تنسخ أسطر التعليقات.

The production `VITE_API_URL` must be the deployed backend Vercel URL, without a trailing slash.

Vercel detects `api/[...path].ts` and `api/health.ts` as serverless backend
entry points. The API is available under the `/api` path on the same domain.

Backend environment variables:

```dotenv
# يتغير من development إلى production
NODE_ENV=production

# انسخ نفس رابط MongoDB Atlas من ملف .env المحلي، ولا تضعه في Frontend
MONGODB_URI=<MongoDB Atlas connection string>

# يبقى كما هو
MONGODB_DB=fatora

# انسخ قيمة JWT_SECRET من .env المحلي، أو ولّد سرًا جديدًا قويًا
JWT_SECRET=<long-random-secret>

# يتغير: ضع رابط مشروع Frontend بعد نشره
FRONTEND_URL=https://<your-project>.vercel.app

# يتغير: نفس رابط Frontend تمامًا، بدون مسافات
ALLOWED_ORIGINS=https://<your-project>.vercel.app

# يبقى true في الإنتاج
SECURE_COOKIES=true
```

في Vercel أضف اسم المتغير والقيمة فقط، ولا تنسخ أسطر التعليقات.

The core sales application does not require Manus. Add these only when enabling
the corresponding optional integrations:

```text
# اختياري: لا تضفها إلا إذا ربطت مزودًا خارجيًا فعليًا
GOOGLE_MAPS_API_KEY=<optional>
OPENAI_API_KEY=<optional>
OPENAI_BASE_URL=https://api.openai.com/v1
```

`PORT` and `HOST` are not required for the serverless project. They remain available for local/standalone Node startup.

## Deployment order

1. Deploy this single Vercel project.
2. Set `FRONTEND_URL` and `ALLOWED_ORIGINS` to the project URL.
3. Keep `VITE_API_URL` empty because frontend and API share the same domain.
4. Redeploy after saving the environment variables.
5. Test `https://<your-project>.vercel.app/api/health`.
6. Test MongoDB login and one read/write operation from the frontend.

## Local development

Keep local `.env` files outside Git. The existing local server remains available with:

```text
pnpm run dev
```

For local frontend-to-backend requests, set `VITE_API_URL=http://localhost:3000`.

## Important limitations

Vercel Functions are stateless. The application must continue to use MongoDB for durable server data. The browser IndexedDB queue and service worker remain client-side and are not replaced by Vercel caching.
