# FreelanceKit

FreelanceKit is a freelancer invoicing and client-management web app: clients, quotations, invoices, payment tracking, PDFs, and a Free / Pro subscription model.

The frontend is HTML, CSS, and vanilla JavaScript. Authentication and data live in [Supabase](https://supabase.com). Razorpay can be connected later through a server-side Edge Function — the browser never receives payment secrets.

## 1. File structure

```
FreelanceKit/
├── index.html              Public landing
├── dashboard.html          Private dashboard
├── clients.html
├── invoices.html
├── quotations.html
├── payments.html
├── expenses.html           Pro
├── pricing.html
├── settings.html
├── login.html
├── signup.html
├── reset-password.html
├── privacy.html
├── terms.html
├── contact.html
├── style.css
├── config.js
├── ui.js
├── auth.js
├── database.js
├── invoices.js
├── quotations.js
├── clients.js
├── payments.js
├── subscription.js
├── pdf.js
├── app.js
├── manifest.json
├── service-worker.js
├── robots.txt
├── sitemap.xml
├── assets/favicon.svg
├── README.md
├── .gitignore
└── supabase/
    ├── schema.sql
    └── functions/payments/index.ts
```

## 2. Supabase database setup

1. Create a project at [supabase.com](https://supabase.com) (free tier is enough for development).
2. Open **SQL Editor** and run `supabase/schema.sql` in full.
3. Confirm **Authentication → Providers → Email** is enabled.
4. Under **Authentication → URL configuration**, set:
   - Site URL to your app origin (for local: `http://localhost:4173` or similar)
   - Redirect URLs: `http://localhost:4173/reset-password.html` and your production reset URL
5. The schema creates a private Storage bucket `logos` and RLS so users only read/write their own rows.
6. **Subscriptions cannot be updated from the browser.** Changing `localStorage` cannot make a user Pro. To test Pro during development, run this in the SQL editor as a project admin (not from the app):

```sql
update public.subscriptions
set plan = 'pro', status = 'pro', billing_period = 'monthly',
    current_period_end = now() + interval '30 days'
where user_id = '<auth user uuid>';
```

## 3. Environment / configuration

Edit `config.js`:

| Field | What to put |
| --- | --- |
| `supabaseUrl` | Project URL (Settings → API) |
| `supabaseAnonKey` | **anon** public key only |
| `razorpayKeyId` | Razorpay **Key ID** (public). Leave empty until checkout is live |
| `paymentsFunctionUrl` | URL of the deployed `payments` Edge Function |
| `supportEmail` | Contact email shown on the contact page |

Never put the Supabase **service_role** key or Razorpay **secret** in `config.js` or any other frontend file.

Optional analytics: assign `window.FreelanceKit.analytics = function (event, payload) { ... }` after the scripts load. Nothing is sent unless you add that function.

## 4. Local development

The app is static files. From the project directory:

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`. Fill in `config.js`, create an account on **Sign up**, then use the dashboard.

If email confirmation is on, confirm the user in the Supabase Auth dashboard or disable confirmation for local testing.

## 5. GitHub

```bash
git add .
git commit -m "Add FreelanceKit invoicing app"
git remote add origin git@github.com:<you>/FreelanceKit.git
git push -u origin main
```

Do not commit service-role keys. `config.js` may contain the public anon key; that is expected for a static frontend.

## 6. Free deployment

Any static host works:

- **Cloudflare Pages / Netlify / GitHub Pages / Firebase Hosting**: publish this folder as the site root.
- Set the Site URL and redirect URLs in Supabase to the HTTPS origin.
- Update `sitemap.xml` loc values to your real domain.
- After deploy, install as a PWA from the browser if the service worker registers (HTTPS required).

Supabase remains the backend; the host only serves HTML/CSS/JS.

## 7. Connecting Razorpay later

1. Create a Razorpay account and generate test Key ID + Key Secret.
2. Deploy the function:

```bash
supabase functions deploy payments
```

3. Set function secrets: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (and `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_URL` which Supabase usually injects).
4. Put the Key ID in `config.js` (`razorpayKeyId`) and the function URL in `paymentsFunctionUrl`.
5. Checkout calls `createCheckout` → Razorpay Checkout → `verifyPayment` on the server. The function checks the HMAC signature and only then sets `subscriptions.status` to `pro`.
6. If credentials are missing, the UI shows **Payments are not configured yet.** It will not pretend a payment succeeded.

Frontend helpers (in `payments.js`): `createCheckout`, `verifyPayment`, `activateSubscription` (refuses to activate without verification), `cancelSubscription`.

## 8. Free vs Pro

**Free (₹0/month)**  
Up to 5 clients, 5 invoices per month, 5 quotations per month, basic dashboard, PDF invoice/quotation, client management, currency on the profile, basic template, CSV/JSON export, usage meters (for example “Invoices 3 / 5 used this month”). Hitting a limit shows an upgrade message and does not crash the app.

**Pro (₹399/month or ₹3,999/year, save ₹791 vs monthly)**  
Unlimited documents, analytics, expense tracking, recurring invoice schedules, automatic numbering for generated invoices, custom templates/colors/logo, overdue tracking, PDF reports, client history. Pro-only UI is marked with a **PRO** badge. Effective plan is `my_plan()` / the `subscriptions` row — not a flag in `localStorage`.

## 9. Production security checklist

- [ ] Only the **anon** key is in the frontend
- [ ] `schema.sql` RLS is applied; subscriptions have **SELECT** for users and no client **UPDATE**
- [ ] Razorpay secret only in Edge Function secrets
- [ ] Auth redirect URLs are exact HTTPS URLs you control
- [ ] Storage bucket `logos` is not public
- [ ] `robots.txt` keeps dashboard routes out of the index
- [ ] No `eval` or unsanitized HTML from user input (UI uses `escapeHtml`)
- [ ] Do not trust query params or client prices for entitlements
- [ ] Confirm email templates and password-reset links
- [ ] Legal pages reviewed; placeholder email replaced

## 10. Remaining limitations

- Client payments (what your customers pay you) are **manual records**, not a collected checkout, until you add a separate gateway for that.
- Recurring invoices **generate documents** (on demand or via `generate_due_recurring_invoices` on a schedule). **Email is not sent** unless you add an email provider.
- Automatic generation for all users needs a cron job calling the SQL function with the service role (the app can generate **your** due schedules if you are Pro).
- Multi-currency display is per-profile default; there is no FX conversion engine.
- Team accounts and custom domains are not implemented (data model is one user per account).
- GST is stored as tax fields; there is no full e-invoicing / GSTR filing.
- jsPDF downloads a structured PDF; print fallback exists if the library fails to load.
- `sitemap.xml` still uses `https://example.com` until you replace it.
- Password reset depends on Supabase email delivery (or Inbucket on local CLI).

## Architecture for later

Keep using `FK.paymentsGateway`, `FK.subscriptionApi`, and the `subscriptions` table when you add Razorpay live keys, email, scheduled recurring jobs, extra currencies, or a mobile client that talks to the same Supabase project.
