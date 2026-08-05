# PG Manager

Owner dashboard for a paying-guest property: beds, tenants and rent collection.
No build step, no framework — plain HTML, CSS and JavaScript, hosted on Cloudflare Pages.

Live: https://pg.swayamkate.com/

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Dashboard with four views: Overview, Beds, Tenants, Rent |
| `login.html` | Sign-in page |
| `signup.html` | Account creation page |
| `config.js` | **Supabase project URL and anon key go here** |
| `auth.js` | Shared auth layer (Supabase, with demo fallback) |
| `store.js` | Per-account data store: rooms, tenants, payments, activity |
| `app.js` | Rendering, dialogs, tabs, theme and logout |
| `styles.css` | Light + dark theme, all components |
| `manage.css` | Empty states, dialogs and row actions |
| `404.html` | Not-found page |

## Data

There is **no sample data anywhere in this app**. Every account signs in to an
empty property and builds it up through the UI:

1. **Property name** in the header sets the label under the logo.
2. **Beds → Add room** creates a room with a floor, a bed count (1–8) and a rent
   per bed.
3. Clicking a vacant bed, or **Tenants → Add tenant**, moves someone in.
4. **Rent → Mark paid** records a payment. **On notice** and **Check out** are on
   each tenant row.

Everything is saved by `store.js` under `localStorage["pgData:<account id>"]`, so
two different logins never see each other's rooms or tenants. Occupancy, expected
rent, collections and the activity feed are all derived from what you enter.

Unpaid rent shows as **Due**, and as **Overdue** once the month is past the 10th.
Paid flags reset automatically at the start of each month.

### Limits of browser storage

The data lives in one browser on one device. Clearing site data wipes it, and it
does not sync between your phone and laptop. Moving the rooms and tenants into
Supabase tables is the next step — see below.

## Connecting Supabase

Authentication runs through `auth.js`, which uses **Supabase Auth** when
`config.js` holds real values and otherwise falls back to demo mode.

1. Create a project at [supabase.com](https://supabase.com).
2. Open **Project Settings → API** and copy:
   - **Project URL**
   - **Project API keys → `anon` `public`**
3. Paste both into `config.js`:

   ```js
   window.PG_CONFIG = {
     SUPABASE_URL: "https://xxxxxxxxxxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOi..."
   };
   ```

4. In **Authentication → Providers → Email**, make sure Email is enabled.
5. In **Authentication → URL Configuration**, set the Site URL to
   `https://pg.swayamkate.com` so confirmation links come back to the site.
6. Commit and push. Cloudflare redeploys in about a minute.

The `anon` key is designed to be public and shipped to the browser — access is
restricted by Row Level Security. **Never put the `service_role` key in this
repo**; it bypasses all security rules.

Only sign-in and sign-up talk to Supabase today. Rooms and tenants are still
browser-side.

### Email confirmation

Supabase confirms email addresses by default. With it on, sign-up shows
"check your email for a confirmation link" and sign-in only works after the link
is clicked. To skip that while demoing, turn off **Confirm email** in
**Authentication → Providers → Email**.

## Logins

| Login | How |
| --- | --- |
| Demo owner | Email `admin`, password `pass` — always works, in either mode |
| Real account | Create one on `signup.html` (email + password, minimum 6 characters) |

The demo login is a deliberate escape hatch so the preview can always be opened.
It starts with an empty property like every other account. Remove it from
`auth.js` (`DEMO_ID` / `DEMO_PW`) before real use.

## Demo mode vs Supabase mode

| | Demo mode (`config.js` empty) | Supabase mode |
| --- | --- | --- |
| Accounts stored | `localStorage` in one browser, plain text | Supabase `auth.users`, hashed |
| Works across devices | No | Yes |
| Session | `sessionStorage`, lost on tab close | Supabase session, persists |
| Suitable for real users | **No** | Yes |

Demo mode exists only so the preview never breaks. It is not secure: passwords
are readable in DevTools and disappear when browser data is cleared.

## Theme

Light and dark palettes are driven by `data-theme` on `<html>`.
Dark is the default. The toggle in the top-right saves the choice to
`localStorage["pgTheme"]`, which then overrides the default on every page.

## Next steps

- Move rooms, tenants and payments into Supabase tables with Row Level Security
  so data follows the account instead of the browser
- Edit a tenant, or move one between beds, without checking out first
- Rent receipts and payment history per month
- Complaints and expense tracking
