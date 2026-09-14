# INVESTOR ↔ TRADER — V1

A simple four-file web app for recording investor/trader transactions.

## Files
- `index.html` — the website interface
- `app.js` — Supabase login, registration, dashboard, transactions and payment actions
- `styles.css` — purple/white responsive design
- `netlify.toml` — Netlify configuration

## Deploy
Upload these four files directly into the root of a GitHub repository connected to Netlify.

The Supabase project is already configured for this V1. The public Supabase URL and publishable key are included in `app.js`; these are intended for browser use. Never put a Supabase service-role/secret key in this file.

## Roles
Only two roles exist:
- INVESTOR
- TRADER

There is no admin account or admin dashboard.

## Important
The database, authentication, row-level security and secure transaction/payment functions live in Supabase. The four files are only the website layer, so you do not need to manage a large Next.js folder structure.

## Trader can also invest
A TRADER account can create investments as the investor side while continuing to receive and manage separate trading obligations. The app keeps those two sides separate on the dashboard.
