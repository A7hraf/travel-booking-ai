# Deploying to Railway

You need a [Railway](https://railway.com) account (the Hobby plan is about $5/month) and an [Anthropic API key](https://console.anthropic.com/settings/keys) for the chat assistant.

## 1. Create the project

1. In Railway: **New Project → Deploy from GitHub repo** and pick `A7hraf/travel-booking-ai`. Allow Railway access to the repo if asked.
2. In the same project: **+ Create → Database → PostgreSQL**.

The first deploy of the app will fail until the variables below are set. That's expected.

## 2. Add a volume for uploads

Company documents and package photos are saved to disk, so they need a volume that survives redeploys.

- Open the app service → **Settings → Volumes → Add volume**, mount path **`/data`**.

## 3. Set the variables

App service → **Variables** → add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (use Railway's reference picker) |
| `AUTH_SECRET` | a long random string, e.g. the output of `openssl rand -base64 48` |
| `ANTHROPIC_API_KEY` | your Claude API key |
| `UPLOAD_DIR` | `/data/uploads` |
| `ADMIN_EMAIL` | the email you'll log in with as admin |
| `ADMIN_PASSWORD` | a strong password, at least 12 characters |
| `SUPPORT_EMAIL` | (optional) shown on the login page for forgotten passwords |

Railway redeploys automatically. On start the app runs database migrations and creates your admin account (only if there is no admin yet). After your first login you can delete `ADMIN_PASSWORD`.

## 4. Get a web address

App service → **Settings → Networking → Generate Domain**. You get something like `travel-booking-ai-production.up.railway.app`. A custom domain can be added on the same screen.

Check `https://<your-domain>/api/health` returns `{"ok":true}`.

## 5. Install it on your phone

Open your domain on the phone:

- **iPhone (Safari):** Share button → **Add to Home Screen**.
- **Android (Chrome):** menu ⋮ → **Install app** (or **Add to Home screen**).

It opens full screen with the TripDeal icon, like a normal app.

## 6. First steps in the app

1. Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
2. **Accounts** → create a **Support** account for whoever validates companies.
3. Travel companies sign up as normal users, then use **List your company** to apply. Support validates, you approve.
4. The approved owner adds packages (with photos) and employees. Customers can now book through the chat.

## Demo data (optional)

To try the app with sample packages and demo accounts (all with password `password123`, so only for testing):
run `SEED_DEMO=true npx prisma db seed` from Railway's shell for the service. Don't do this on the real production database.

## Updating

Every push to `main` redeploys automatically. Migrations run on start.

## Backups

Railway's Postgres has backups on paid plans (Database → Backups). Back up the `/data` volume too if documents matter to you.
