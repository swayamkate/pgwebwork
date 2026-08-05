# PG Manager — static preview

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
| `app.js` | Demo data, rendering, tabs, theme and logout |
| `styles.css` | Light + dark theme, all components |
| `404.html` | Not-found page |

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
Remove it from `auth.js` (`DEMO_ID` / `DEMO_PW`) before real use.

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

## Data

Beds, tenants, rent and activity all come from the `ROOMS` array in `app.js` —
12 rooms across 3 floors, 36 beds. There is no database behind the dashboard
yet; only login and sign-up talk to Supabase.

## Next steps

- Move rooms, tenants and payments into Supabase tables with Row Level Security
- Tenant add / edit / move between beds
- Rent receipts and payment history
- Complaints and expense tracking
