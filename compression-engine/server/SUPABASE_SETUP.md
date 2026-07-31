# Supabase Production Setup

Full guide to move CompressionAI from local SQLite to a production PostgreSQL database on Supabase, with per-user data isolation and encryption at rest.

---

## 1. Create the Supabase project

1. Sign up at https://supabase.com and create a new project
2. Choose a strong database password (save it — you'll need it in step 3)
3. Pick the region closest to your users
4. Wait ~2 minutes for provisioning

## 2. Grab the connection strings

Go to **Project Settings → Database → Connection string** and copy two URLs:

| Purpose | Mode | Port | Format |
|---------|------|------|--------|
| Runtime (`DATABASE_URL`) | Transaction pooler | 6543 | `postgresql://postgres.REF:PWD@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true` |
| Migrations (`DIRECT_URL`) | Direct | 5432 | `postgresql://postgres.REF:PWD@aws-0-REGION.pooler.supabase.com:5432/postgres` |

Prisma needs the direct URL for migrations because PgBouncer's transaction mode doesn't support prepared statements the way `prisma migrate` uses them.

## 3. Generate secrets

Run these in a terminal to get random values you'll paste into `.env`:

```bash
# JWT_SECRET (64 bytes = 128 hex chars)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# JWT_REFRESH_SECRET (run again for a DIFFERENT value)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ENCRYPTION_KEY (must be exactly 32 bytes = 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. Create your `.env`

```bash
cd compression-engine/server
cp .env.example .env
```

Edit `.env` and fill in:
- `DATABASE_URL` and `DIRECT_URL` from step 2
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY` from step 3
- `CORS_ORIGIN` set to your production frontend URL

## 5. Push the schema

```bash
npx prisma generate
npx prisma migrate deploy
```

If you're bootstrapping a fresh Supabase project (no history to preserve), simpler:

```bash
npx prisma db push
```

This creates all tables, indexes, and enums in one shot.

## 6. Apply Row Level Security

Open the Supabase SQL Editor and paste the contents of
`prisma/migrations/rls_policies.sql`. Run it.

This enables RLS on every user-scoped table. Because our backend uses the
`service_role` connection string, RLS is bypassed for our server (which is
what we want). But if anyone hits Supabase directly with the anon key,
they get zero rows. Defense in depth.

## 7. Verify data isolation

Quick sanity checks after deploying:

```sql
-- Should return zero rows for anyone with anon/authenticated role
SET ROLE anon;
SELECT * FROM users LIMIT 1;
SELECT * FROM api_keys LIMIT 1;

-- Reset to postgres role
RESET ROLE;
```

## 8. Backup schedule

In Supabase → **Database → Backups**, ensure daily automated backups are enabled. Free tier gives 7 days; Pro gives point-in-time recovery.

## 9. Deploy the backend

Any platform (Railway, Render, Fly, Vercel Functions, etc). Just:
- Set the same env vars you defined in `.env` as production secrets
- Run `npm run build && npm start`

## 10. Key rotation

**JWT secrets**: rotating them invalidates every active session immediately. Users must re-login. Zero downtime on the database side.

**Encryption key**: rotating requires re-encrypting every row in `api_keys`. A migration script pattern:
```javascript
// 1. Set ENCRYPTION_KEY_OLD and ENCRYPTION_KEY (new)
// 2. Read all keys with OLD, encrypt with NEW, write back
// 3. Remove ENCRYPTION_KEY_OLD
```

Plan this before you have many rows.

---

## What's in place for security

| Guarantee | How it's enforced |
|-----------|-------------------|
| Users see only their own data | All queries filter by `userId`, enforced in every route handler |
| API keys never stored in plaintext | AES-256-GCM in `utils/crypto.ts`, stored in `api_keys.encrypted_key` |
| Passwords hashed | bcrypt (cost 12) in `auth.routes.ts` |
| JWT tokens signed & verified | `jsonwebtoken` with 24h access + 7d refresh, signed HS256 |
| Sessions revocable | `sessions` table with `revokedAt` and `expiresAt` |
| Cascading deletes | `ON DELETE CASCADE` on every FK from user → children |
| Direct DB access blocked | RLS enabled, only `service_role` (backend) can read |
| Duplicate keys prevented | `@@unique([userId, provider, keyFingerprint])` |
| Sensitive fields never returned | Routes return `keyPrefix` (e.g., `sk-abcd`) not the full key |
| Audit trail | Every mutation logged to `activity_logs` |
| Password reset tokens hashed | Only `tokenHash` is stored, never the raw token |
| Timing attacks mitigated | `crypto.timingSafeEqual` in `safeEqual()` |

## Multi-tenant architecture

Data is isolated per user at three layers:

1. **Application layer** — every Prisma query includes `where: { userId }` from the authenticated JWT. This is enforced in route handlers and can't be bypassed by a malicious client.

2. **Database layer (schema)** — foreign keys with `ON DELETE CASCADE` guarantee that removing a user removes ALL their rows across every table. No orphaned data.

3. **Database layer (RLS)** — even if the app layer had a bug and forgot a `where` clause, the anon role has zero table privileges. Only the service_role (backend) can access data.

## Developer isolation

If a user (developer) adds their own OpenAI API key:
- The key is encrypted with AES-256-GCM before it hits the database
- It's tagged with their `userId` and unique per-user via fingerprint
- Only their sessions can use that key — enforced by `ApiKeyService.resolve()` which requires a `userId` argument and only queries keys owned by that user
- The system-level fallback keys in `.env` are used ONLY when a user hasn't added their own

Even the `keyPrefix` shown in the UI (e.g., `sk-abcd`) is fine to expose — it can't be used to authenticate to the provider.
