# pgwebwork

Static preview build of **PG Manager** — an owner-facing dashboard for running a PG / hostel: bed inventory, tenants and rent collection.

This is a **display build**. Everything renders from demo data in `app.js`, so it can be deployed and shown to the owner immediately. No backend, no build step, no dependencies.

## Login

The site opens on `login.html`.

| Field | Value |
| --- | --- |
| User ID | `admin` |
| Password | `pass` |

Signing in sets a flag in `sessionStorage` and sends you to the dashboard. `index.html` redirects back to the login page if that flag is missing, and **Log out** in the header clears it. Closing the browser tab ends the session.

> **This is a demo lock, not real security.** The credentials sit in `login.html` and are checked in the browser, so anyone can read them via View Source. Replace this with a server-side login before real tenant data goes in.

## What's in it

| Screen | Shows |
| --- | --- |
| Overview | Bed/occupancy/collection stats, occupancy per floor, recent activity |
| Beds | All 12 rooms with each bed marked occupied, vacant or on notice |
| Tenants | Full tenant list with bed, phone, join date, rent and payment status |
| Rent | Expected vs collected vs pending for the month, plus a payment log |

## Files

```
login.html    sign-in page (demo credentials)
index.html    all four dashboard screens
styles.css    design system (colors, layout, responsive rules)
app.js        demo data + rendering + tab navigation + logout
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
