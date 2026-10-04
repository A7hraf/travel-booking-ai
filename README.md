# TripDeal — AI travel package booking

A marketplace where travel companies publish packages and customers book them by chatting with an AI assistant (Claude). When a deal is closed, or the customer needs something the AI can't handle, the chat is handed to a human: an employee of the travel company, or the platform's support team.

## Roles

| Role | How you get it | What you can do |
|---|---|---|
| **Customer** | Public sign-up (`/register`) — the only self-service role | Chat with the AI, book packages, see bookings, apply for a company profile |
| **Company owner** | Your company application is validated by support and approved by an admin | Everything an employee can do, plus: profit dashboard, company profile, manage team |
| **Company employee** | Added by the company owner (or created by an admin) | Manage packages, answer handed-off chats, confirm/cancel bookings |
| **Support** | Created by an admin | Validate company applications, handle chats escalated to support, route chats to a company |
| **Admin** | Created by an admin (first one via seed) | Final approval of companies, create any account, (de)activate users, suspend companies, set commission |

## Main flows

**Company onboarding**

```
customer account ──submit form + documents──▶ SUBMITTED
   SUBMITTED ──support──▶ VALIDATED | NEEDS_CHANGES (applicant edits & resubmits) | REJECTED
   VALIDATED ──admin────▶ APPROVED (company created, applicant becomes COMPANY_OWNER) | REJECTED
```

Documents (license, tax certificate, owner ID) are stored outside `public/` and only downloadable by the applicant, support and admins.

**Booking through the AI**

1. The customer starts a chat. Claude asks about the trip (destination, dates, group size, budget).
2. Claude uses tools against the database: `search_packages`, `get_package_details`. It can only quote real packages and prices.
3. Once the customer confirms a summary, Claude calls `create_booking`. Seats are reserved atomically, prices are snapshotted, and the chat is **handed to the company** (`HANDED_TO_COMPANY`).
4. Company staff see it under *Conversations*, reply in the same chat, and confirm the booking under *Bookings*.
5. If there's an issue, Claude calls `handoff_to_company` (company-specific questions) or `handoff_to_support` (account/payment problems, no company involved, model refusal). Company staff can also escalate to support, and support can route a chat to a company.

Once a chat is handed off, the AI stops replying and only humans answer.

**Company profit**

Each booking stores `totalPrice`, `totalCost` (from the package's owner-only *cost per person*) and `platformFee` (from the company's commission rate). The owner's *Profit* page shows revenue − cost − commission for confirmed/completed bookings, overall and per package. Employees never see costs or profit.

## Tech

- Next.js 16 (App Router, server actions), React 19, Tailwind CSS 4
- PostgreSQL + Prisma 6
- Claude via `@anthropic-ai/sdk` (`claude-opus-5-5`), manual tool-use loop in `src/lib/ai/assistant.ts`. The raw API transcript is stored on the conversation (`aiHistory`) and only appended to. Server-side refusal fallbacks are enabled (`fallbacks: "default"`).
- Auth: email + password (bcrypt), signed JWT in an httpOnly cookie (`jose`); role checks in every page and action (`src/lib/auth.ts`).

```
prisma/schema.prisma          data model
prisma/seed.ts                demo data + accounts
src/lib/ai/                   Claude assistant + tools
src/lib/services/             bookings, profit, conversation handoff
src/app/actions/              server actions (auth, applications, packages, team, admin, bookings, conversations)
src/app/api/conversations/... chat send/poll endpoint
src/app/(pages)               customer: /chat /bookings /apply-company
                              company:  /company/*   staff chat view: /inbox/[id]
                              support:  /support/*   admin: /admin/*
```

## Features

- **AI booking chat** (Claude) that searches real packages, creates bookings and hands off to company staff or support. Customers can also skip the AI with "Talk to a person".
- **Company onboarding** with document upload, support validation, and admin approval
- **Packages** with photos, availability, seats and group size; owner-only cost and margin
- **Bookings** with seat reservation, confirm/cancel/complete, and **manual payments** (cash, bank transfer, card in person) with receipt reference; paid bookings that get cancelled are marked as refunded
- **Profit dashboard** for owners: revenue, costs, platform commission, net profit, and money still to collect
- **Notifications** (bell in the header) for new chats, messages, booking and payment changes, and application decisions
- **Accounts**: profile and password change; admins and company owners can reset passwords
- **Installable on phones** (add to home screen; full screen with app icon)
- **Hardening**: login/sign-up/chat rate limits, one AI reply at a time per chat, security headers, private documents

## Deploying

See **[DEPLOY.md](DEPLOY.md)** for the step-by-step Railway setup and installing the app on your phone.

## Getting started (local development)

```bash
cp .env.example .env        # set DATABASE_URL, AUTH_SECRET, ANTHROPIC_API_KEY
npm install
npx prisma migrate dev      # creates the schema
npm run db:seed             # demo company, packages and accounts
npm run dev
```

Demo accounts (password `password123`): `admin@example.com`, `support@example.com`, `owner@example.com`, `employee@example.com`, `customer@example.com`.

## Tests

```bash
npm run test:e2e   # end-to-end browser tests; uses a stand-in for the Claude API, no key needed
```

## Not built yet

- Online card payment (payments are recorded manually by staff)
- Email/SMS/push notifications (notifications are in-app)
- Self-service "forgot password" by email (needs an email provider; admins/owners reset passwords)
- Real-time chat (it refreshes every 3 seconds)
- Multiple departure dates per package
