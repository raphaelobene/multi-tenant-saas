# Multi-Tenant SaaS Dashboard

A production-ready multi-tenant SaaS application built with Next.js 15, PostgreSQL (with RLS), Upstash Redis, better-auth, shadcn/ui, TanStack Query, and Tailwind CSS.

Each tenant gets their own subdomain (`acme.yourdomain.com`), fully isolated data via PostgreSQL Row Level Security, and a dashboard with analytics, team management, settings, and billing.

---

## Architecture

```
Request: acme.yourdomain.com/analytics
         ↓
   proxy.ts — extracts "acme" from hostname
         ↓
   Redis cache hit? → returns tenant config
   Cache miss?     → queries Postgres, primes Redis
         ↓
   Injects x-tenant-id, x-tenant-slug headers
         ↓
   Rate limit check (per-tenant, Upstash)
         ↓
   Rewrites to /tenant/analytics (the route group)
         ↓
   Server component: getAuthenticatedTenantContext()
   - Reads x-tenant-id from headers
   - Verifies user session (better-auth)
   - Verifies user is a member of this tenant
         ↓
   DB query via withTenantContext(tenantId)
   - Sets: SET LOCAL app.current_tenant_id = '...'
   - PostgreSQL RLS policies enforce data isolation
```

**Key isolation guarantee**: If tenant context isn't set before a query, RLS policies return zero rows. No silent data leaks.

---

## Tech Stack

| Layer              | Technology                                |
| ------------------ | ----------------------------------------- |
| Framework          | Next.js 15 (App Router)                   |
| Database           | PostgreSQL via Neon (serverless-friendly) |
| ORM                | Drizzle ORM                               |
| Auth               | better-auth                               |
| Cache / Rate limit | Upstash Redis                             |
| UI                 | shadcn/ui + Tailwind CSS                  |
| Data fetching      | TanStack Query v5                         |
| Charts             | Recharts                                  |

---

## Step-by-Step Setup

### Prerequisites

- Node.js 20+
- A PostgreSQL database (Neon recommended for serverless)
- An Upstash Redis instance
- (For production) A domain with wildcard DNS support

---

### Step 1: Clone and install dependencies

```bash
git clone <your-repo>
cd multi-tenant-saas
npm install
```

---

### Step 2: Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

```env
# PostgreSQL — Neon connection string
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"

# better-auth — generate secret with: openssl rand -base64 32
BETTER_AUTH_SECRET="your-generated-secret"
BETTER_AUTH_URL="http://localhost:3000"

# Upstash Redis — from console.upstash.com
UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-token"

# Your root domain
NEXT_PUBLIC_ROOT_DOMAIN="yourdomain.com"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

### Step 3: Set up the database

**Generate and run migrations:**

```bash
# Generate the Drizzle migration files
npm run db:generate

# Push the schema to your database
npm run db:push
```

**Enable Row Level Security (CRITICAL — do not skip):**

Connect to your database and run:

```bash
psql $DATABASE_URL -f src/lib/db/migrations/0001_enable_rls.sql
```

Or paste the contents of `src/lib/db/migrations/0001_enable_rls.sql` directly into your Neon SQL editor.

This enables RLS on all tenant-scoped tables and creates the `set_tenant_context()` function.

**Verify RLS is working:**

```sql
-- This should return 0 rows (no tenant context set)
SELECT * FROM tenant_members;

-- This should return your tenant's rows
SELECT set_config('app.current_tenant_id', 'your-tenant-uuid', true);
SELECT * FROM tenant_members;
```

---

### Step 4: Install shadcn/ui components

```bash
# Initialize shadcn
npx shadcn@latest init

# Install all required components
npx shadcn@latest add button card input label badge avatar separator switch tabs select dialog dropdown-menu tooltip table
```

---

### Step 5: Local development with subdomains

**Option A: Chrome's native .localhost support (easiest)**

Chrome natively supports `*.localhost` subdomains. Just start the dev server:

```bash
npm run dev
```

Then visit:

- `http://localhost:3000` — main domain / marketing page
- `http://acme.localhost:3000` — tenant dashboard for "acme"
- `http://admin.localhost:3000` — super admin panel

Note: This works in Chrome and Edge. For Firefox/Safari, use Option B.

**Option B: /etc/hosts (all browsers)**

Add entries to `/etc/hosts`:

```
127.0.0.1 acme.localhost
127.0.0.1 admin.localhost
127.0.0.1 mycompany.localhost
```

Then access `http://acme.localhost:3000`.

**Option C: dnsmasq (wildcard, all browsers)**

Install dnsmasq and add:

```
address=/.localhost/127.0.0.1
```

This routes ALL `.localhost` subdomains to localhost automatically.

---

### Step 6: Create your first tenant

1. Go to `http://localhost:3000/signup`
2. Create an account
3. Choose a workspace name and subdomain (e.g., "acme")
4. You'll be redirected to `http://acme.localhost:3000`

**Create a super admin:**

```sql
UPDATE users SET is_super_admin = true WHERE email = 'your@email.com';
```

Then visit `http://admin.localhost:3000` to access the admin panel.

---

### Step 7: Development workflow

```bash
# Start dev server
npm run dev

# Open Drizzle Studio (visual DB browser)
npm run db:studio

# Generate new migration after schema changes
npm run db:generate

# Apply migrations
npm run db:migrate
```

---

## Deployment to Vercel

### Step 1: Set up wildcard DNS

In your DNS provider, add:

```
A    yourdomain.com        → 76.76.21.21 (Vercel IP)
A    *.yourdomain.com      → 76.76.21.21 (Vercel IP)
```

Or use a CNAME for the wildcard if your DNS provider supports it.

### Step 2: Configure Vercel domain

1. Go to your Vercel project → Settings → Domains
2. Add `yourdomain.com`
3. Add `*.yourdomain.com` (wildcard)
4. Vercel will prompt for DNS verification

### Step 3: Set environment variables in Vercel

In Vercel dashboard → Settings → Environment Variables, add all the variables from `.env.example`:

```
DATABASE_URL=...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://yourdomain.com
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
NEXT_PUBLIC_ROOT_DOMAIN=yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Step 4: Deploy

```bash
# Push to your connected Git repo, or:
npx vercel --prod
```

### Vercel Preview Deployments

Preview deployments (`my-app-git-branch.vercel.app`) are treated as the main domain — tenant subdomains won't work in previews. This is by design: previews are for testing the main app shell. Test multi-tenant features against your production or staging domain.

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login, signup — main domain
│   │   ├── login/
│   │   └── signup/
│   ├── tenant/          # Tenant dashboard (rewritten from subdomain)
│   │   ├── layout.tsx   # Auth check + TenantProvider
│   │   ├── page.tsx     # Overview dashboard
│   │   ├── analytics/
│   │   ├── team/
│   │   └── settings/
│   ├── admin/           # Super admin (admin.yourdomain.com)
│   │   └── tenants/
│   ├── api/
│   │   ├── auth/[...all]/  # better-auth handler
│   │   ├── tenants/        # Tenant creation, slug check
│   │   ├── members/        # Team member management
│   │   ├── invitations/    # Invite flow
│   │   ├── analytics/      # Event tracking
│   │   ├── settings/       # Workspace settings
│   │   └── admin/          # Admin-only routes
│   └── page.tsx         # Marketing homepage
├── lib/
│   ├── db/
│   │   ├── schema.ts    # All tables + RLS policies
│   │   ├── index.ts     # DB client + withTenantContext()
│   │   └── migrations/
│   ├── redis/
│   │   └── index.ts     # Tenant cache + rate limits + feature flags
│   ├── auth/
│   │   ├── index.ts     # better-auth server config
│   │   └── client.ts    # better-auth client
│   └── tenant/
│       ├── context.ts   # Server: getTenantContext(), auth checks
│       └── hooks.ts     # Client: TanStack Query hooks
├── components/
│   ├── dashboard/       # Sidebar, header
│   ├── tenant/          # TenantProvider, hooks
│   ├── admin/           # Admin UI components
│   └── providers/       # QueryProvider
└── proxy.ts        # Subdomain routing (the critical piece)
```

---

## Security Notes

**These are the things that keep data isolated:**

1. **Proxy**: Extracts tenant from hostname, injects `x-tenant-id` header. Blocks requests to nonexistent or suspended tenants.

2. **getAuthenticatedTenantContext()**: Every protected server component and API route calls this. It verifies the user is both authenticated AND a member of the current tenant.

3. **withTenantContext(tenantId)**: Sets `app.current_tenant_id` as a Postgres session variable before any query. RLS policies read this variable.

4. **RLS policies**: All tenant tables have `USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)`. If the variable isn't set, queries return zero rows.

5. **FORCE ROW LEVEL SECURITY**: Applied to all tenant tables. The table owner cannot bypass RLS accidentally.

**Never do this:**

```typescript
// ❌ BAD — bypasses tenant context, queries all rows
const members = await db.query.tenantMembers.findMany();

// ✅ GOOD — scoped to current tenant via RLS
const { db, release } = await getScopedDb(ctx.tenantId);
const members = await db.query.tenantMembers.findMany();
release();
```

---

## Extending the Schema

When adding new tenant-scoped tables:

```typescript
// 1. Add tenant_id to your table
export const myNewTable = pgTable(
  "my_new_table",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    // ... your columns
  },
  (table) => [
    // 2. Add the RLS policy
    pgPolicy("my_new_table_isolation_policy", {
      as: "permissive",
      for: "all",
      to: "authenticated",
      using: sql`tenant_id = current_setting('app.current_tenant_id', true)::uuid`,
    }),
  ],
);
```

Then in your SQL migration file, enable RLS:

```sql
ALTER TABLE my_new_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE my_new_table FORCE ROW LEVEL SECURITY;
```

---

## Adding Email

The invitation system has a placeholder for sending emails. Connect your provider:

```typescript
// src/lib/auth/index.ts
sendInvitationEmail: async (data) => {
  await resend.emails.send({
    from: "invites@yourdomain.com",
    to: data.email,
    subject: `You're invited to ${data.organization.name}`,
    html: `<a href="${data.invitationUrl}">Accept invitation</a>`,
  });
};
```

Popular choices: [Resend](https://resend.com), [SendGrid](https://sendgrid.com), [Postmark](https://postmarkapp.com).

---

## Commands Reference

```bash
npm run dev          # Start dev server on :3000
npm run build        # Production build
npm run start        # Start production server
npm run db:generate  # Generate Drizzle migrations from schema
npm run db:migrate   # Run pending migrations
npm run db:push      # Push schema directly (dev only)
npm run db:studio    # Open Drizzle Studio at :4983
npm run lint         # ESLint
```
