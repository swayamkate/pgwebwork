# pgwebwork

Static preview build of **PG Manager** — an owner-facing dashboard for running a PG / hostel: bed inventory, tenants and rent collection.

This is a **display build**. Everything renders from demo data in `app.js`, so it can be deployed and shown to the owner immediately. No backend, no build step, no dependencies.

## Login

The site opens on `login.html`. There are two ways in:

| Route | Details |
| --- | --- |
| Demo owner login | User ID `admin` · password `pass` |
| Create your own | `signup.html`, linked from the login page |

Signing in sets a flag in `sessionStorage` (plus the display name under `pgUser`) and sends you to the dashboard. `index.html` redirects back to the login page if that flag is missing, and **Log out** in the header clears it. Closing the browser tab ends the session.

Accounts created through the sign-up page are stored in `localStorage` under `pgUsers` as `{ id, pw, name, created }`. User IDs are lowercased, must be 3–20 characters of letters, numbers or underscores, and `admin` is reserved.

> **This is a demo lock, not real security.** Passwords are stored and compared in plain text in the browser, so anyone can read them via View Source or DevTools. Accounts also live only in the browser that created them — they do not sync across devices. Replace this with a server-side signup and login (hashed passwords) before real tenant data goes in.

## Theme

**Dark is the default.** Light is available too — the toggle sits in the header (and top-right of the login and sign-up pages), and the choice is saved to `localStorage`, so it survives reloads.

To change the default, edit the `data-theme` attribute on the `<html>` tag in `index.html`, `login.html` and `signup.html` (`"dark"` or `"light"`). A returning visitor's saved preference always wins over that default.

The palette is defined once as CSS custom properties at the top of `styles.css`:

- `:root, [data-theme="light"]` — light tokens
- `[data-theme="dark"]` — dark overrides

To rebrand, change `--brand`, `--brand-soft` and `--brand-grad` in both blocks; everything else (buttons, bars, badges, avatars, focus rings) follows automatically.

## What's in it

| Screen | Shows |
| --- | --- |
| Overview | Bed/occupancy/collection stats, occupancy per floor, recent activity |
| Beds | All 12 rooms with each bed marked occupied, vacant or on notice |
| Tenants | Full tenant list with bed, phone, join date, rent and payment status |
| Rent | Expected vs collected vs pending for the month, plus a payment log |

## Files

```
login.html    sign-in page (demo credentials + saved accounts)
signup.html   account creation
index.html    all four dashboard screens
styles.css    design tokens + all component styles
app.js        demo data + rendering + navigation + theme/logout
404.html      fallback page
```

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/login.html`.

## Deploy on Cloudflare Pages

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Pick the `pgwebwork` repository.
3. Build settings:
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: `/`
4. **Save and Deploy.** Add your custom domain under **Custom domains**.

Every push to `main` redeploys automatically.

## Next steps (making it real)

- Real authentication (server-side session, hashed passwords)
- Replace the `ROOMS` array in `app.js` with data fetched from an API
- Add / edit / move tenants between beds
- Record payments and generate rent receipts
- Complaints and expense tracking
