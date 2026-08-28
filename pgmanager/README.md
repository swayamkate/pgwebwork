# PG Manager — Hostel / PG Finance & Management System

A complete, production-ready Hostel / PG Management and Finance Web App built with Next.js, TypeScript, Tailwind CSS, Prisma, and PostgreSQL.

## Features

- 🏠 **Room & Bed Management** — Visual room cards with bed status
- 👥 **Tenant Management** — Full tenant profiles with assignments
- 💰 **Rent Management** — Monthly rent tracking with PAID/PARTIAL/DUE/OVERDUE status
- 💳 **Payment System** — Manual payment entry with receipts
- 🏦 **Bank Statement Import** — CSV/XLSX upload with automatic parsing and tenant matching
- 📊 **Dashboard** — Financial summaries, charts, and alerts
- 📋 **Expense Management** — Category-wise expense tracking
- 📈 **Reports** — Financial, tenant, and occupancy reports
- 🧾 **Receipts** — Auto-generated printable payment receipts
- 🔔 **Notifications** — Rent due, overdue, and import alerts
- 📝 **Audit Log** — Track all financial and data changes
- ⚙️ **Settings** — Configurable property details and rent settings
- 🌙 **Dark/Light Mode** — Toggle theme
- 📱 **Responsive** — Works on desktop, tablet, and mobile

## Tech Stack

- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** Custom session-based authentication with bcrypt
- **Charts:** Recharts
- **Icons:** Lucide React
- **PDF:** jsPDF (for receipts and reports)

## Setup

### 1. Install dependencies

```bash
cd pgmanager
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
```

Edit `.env` with your PostgreSQL connection string:

```
DATABASE_URL="postgresql://user:password@localhost:5432/pgmanager?schema=public"
NEXTAUTH_SECRET="your-secret-key"
```

### 3. Set up database

```bash
npx prisma db push
npx prisma generate
```

Or with migrations:

```bash
npx prisma migrate dev --name init
```

### 4. Seed demo data (optional)

```bash
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

Demo login: `admin@pgmanager.com` / `admin12345`

### 5. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Database schema (Supabase)

If using Supabase, run `supabase/data-schema.sql` in the SQL Editor for RLS policies.

## Project Structure

```
pgmanager/
├── prisma/
│   ├── schema.prisma        # Complete database schema
│   └── seed.ts              # Demo data seeder
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Root layout
│   │   ├── globals.css      # Global styles + theme
│   │   ├── login/           # Auth pages
│   │   ├── signup/
│   │   ├── (dashboard)/     # Dashboard layout + pages
│   │   │   ├── layout.tsx   # Sidebar navigation
│   │   │   ├── page.tsx     # Dashboard with charts
│   │   │   ├── tenants/     # Tenant management
│   │   │   ├── rooms/       # Room & bed management
│   │   │   ├── rent/        # Rent tracking
│   │   │   ├── payments/    # Payment records
│   │   │   ├── bank-import/ # Bank statement import
│   │   │   ├── expenses/    # Expense management
│   │   │   ├── reports/     # Reports & analytics
│   │   │   ├── receipts/    # Payment receipts
│   │   │   ├── audit/       # Audit log
│   │   │   ├── notifications/
│   │   │   └── settings/
│   │   └── api/             # API routes
│   │       ├── auth/        # Login, signup, logout
│   │       ├── dashboard/   # Dashboard stats
│   │       ├── tenants/     # Tenant CRUD
│   │       ├── rooms/       # Room CRUD
│   │       ├── payments/    # Payment CRUD
│   │       ├── bank-import/ # Bank import + matching
│   │       ├── expenses/    # Expense CRUD
│   │       ├── audit/       # Audit log
│   │       ├── notifications/
│   │       └── settings/
│   └── lib/
│       ├── prisma.ts        # Prisma client singleton
│       ├── auth.ts          # Authentication helpers
│       └── utils.ts         # Utility functions
└── package.json
```

## Deployment

### Cloudflare Pages (Static Export)

This app requires server-side features (API routes, database). For Cloudflare deployment, use **Cloudflare Workers** with the Next.js adapter, or deploy to:

- **Vercel** (recommended for Next.js)
- **Railway**
- **Render**
- **DigitalOcean App Platform**

### Production Checklist

1. Set `DATABASE_URL` to production PostgreSQL
2. Run `npx prisma migrate deploy`
3. Set strong `NEXTAUTH_SECRET`
4. Create admin account or seed database
5. Configure domain and SSL
