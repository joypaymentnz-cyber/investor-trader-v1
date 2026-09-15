# INVESTOR ↔ TRADER — V1 FINAL

This package contains the corrected four-file static web app:

- `index.html` — responsive purple/white interface
- `app.js` — Supabase-powered application logic
- `netlify.toml` — Netlify configuration
- `README.md` — this guide

## Included V1 features

- INVESTOR and TRADER roles
- TRADER accounts can also make investments
- Separate My Investments and Trading Obligations
- NGN and USDT kept completely separate
- ROI/profit and total obligation calculations
- 3 or 7 business-day terms
- Trader nickname/user lookup
- Trader confirmation/dispute
- Record Payment
- Paid Early
- Payment Reminder
- Investor Accept Payment / Query Payment
- Outstanding balance calculation
- Payment and transaction history
- Notifications
- Responsive mobile/desktop purple-and-white interface
- Supabase Auth and database authorization

## Supabase

The app expects these environment values when used with a build/deployment setup:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The current V1 database is already configured for authenticated payment operations.

## Important

Do not create duplicate users or duplicate transactions just to test this package. Existing registered accounts and database records remain the source of truth.
