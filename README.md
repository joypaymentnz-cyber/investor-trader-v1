# INVESTOR ↔ TRADER V1

Simple purple-and-white investment record web app using **Supabase Auth + PostgreSQL/RLS**.

## Roles
- INVESTOR: create investments, track payouts, confirm/dispute payment receipts.
- TRADER: confirm/dispute obligations, record payments, and also create their own investments.

## Security
- Supabase Auth handles passwords.
- Passwords are never stored by this app in plaintext.
- Show/Hide password is available on the login/registration form.
- Database RLS limits records to authorised parties.
- Transaction creation, confirmation, payment recording and receipt confirmation use secure database functions.
- No admin role, hidden account, or backdoor.
- NGN and USDT are kept completely separate.

## Files
- `index.html` — complete responsive UI
- `app.js` — Supabase Auth and application logic
- `netlify.toml` — Netlify configuration
- `README.md` — project notes

## Required frontend settings
The Supabase project URL and publishable key are already included in `app.js`. The publishable key is safe for browser use when RLS is correctly configured.

## Supabase Auth
Enable email/password authentication in Supabase Auth. If email confirmation is enabled, users must confirm their email before logging in. The Forgot Password flow uses Supabase's password recovery email.

Microsoft/Azure mail integration is not required by this version.
