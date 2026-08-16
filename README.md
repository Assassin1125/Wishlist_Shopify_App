# Wishlist

A database-backed wishlist app for Shopify stores. Customers save products (at
the variant level) to a persistent wishlist that survives across devices and
sessions; merchants get an embedded analytics dashboard showing wishlist
activity, conversion rates, and top products.

Built as a private/custom-distribution app: full Partner Dashboard app
(OAuth, embedded admin, Theme App Extension) installed on one client's store
via a direct install link, not listed on the Shopify App Store.

## Features

- **Storefront**: heart/wishlist button on product cards, collection pages,
  and PDP; variant-aware; a "My Wishlist" drawer (image, title, price, variant,
  stock status) with move-to-cart and remove actions; guest wishlists that
  merge into the customer's account on login; real-time UI sync across every
  instance of a product on the page.
- **Backend**: Node.js (React Router, Shopify's official app template) with
  OAuth, session-token auth, and an App Proxy layer so the storefront widget
  calls the backend same-origin.
- **Database**: PostgreSQL via Prisma, multi-tenant (shop domain as tenant
  key), with an append-only event log powering analytics independent of
  current wishlist state.
- **Analytics**: total wishlist adds, wishlist→cart and wishlist→purchase
  conversion rates, a 30-day trend chart, a most-wishlisted-products table,
  and CSV export - all in an embedded Polaris admin page.
- **Compliance**: the three mandatory GDPR webhooks
  (`customers/data_request`, `customers/redact`, `shop/redact`), plus
  `products/update`/`products/delete` listeners that keep cached product data
  (price, availability, title, image) in sync.

## Tech stack

| Layer | Choice |
|---|---|
| App framework | React Router (Shopify's official app template) + TypeScript |
| Storefront widget | Theme App Extension - Liquid blocks + vanilla TypeScript (no framework shipped to the storefront) |
| Admin UI | Polaris web components, embedded via App Bridge |
| Database | PostgreSQL + Prisma |
| Hosting (recommended) | Render (web service + managed Postgres) |

## Prerequisites

- Node.js `>=20.19 <22` or `>=22.12` (see `package.json` `engines`)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli/getting-started)
  (`npm init @shopify/app@latest` bootstraps it if you don't have it globally)
- A Shopify Partner/Dev Dashboard organization and a development store
- A PostgreSQL database (this project was built against
  [Neon](https://neon.tech)'s free tier for local dev - any Postgres works)

## Setup

1. Install dependencies:

   ```shell
   npm install
   ```

2. Create `.env` in the project root with your database connection string:

   ```
   DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
   ```

3. Run migrations:

   ```shell
   npx prisma migrate deploy
   ```

4. Link the project to your app in the Dev Dashboard (skip if `shopify.app.toml`
   already has your `client_id`):

   ```shell
   npx shopify app config link
   ```

## Local development

```shell
npx shopify app dev --store=your-dev-store.myshopify.com
```

This starts the backend, opens a tunnel, and bundles the theme extension. The
CLI prints a **Preview URL** - open it and approve the OAuth install prompt.

**Windows note:** if the Cloudflare tunnel reports "refused to connect," it's
usually because Node bound its local ports to the IPv6 loopback (`::1`) only.
Run with `NODE_OPTIONS=--dns-result-order=ipv4first` prefixed to force IPv4:

```shell
NODE_OPTIONS="--dns-result-order=ipv4first" npx shopify app dev --store=your-dev-store.myshopify.com
```

**Enabling the storefront widget** (one-time, per theme - this can't be
automated, Theme App Extensions have to be placed manually):

1. Dev store admin → **Online Store → Themes → Customize**
2. **App embeds** (bottom-left icon) → toggle on **"Wishlist drawer"**
   (this is what loads the shared JS/CSS for the whole site)
3. On a product page or product-card section → **Add block → Apps →
   "Wishlist button"**

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. |
| `SHOPIFY_API_KEY` | Yes (prod) | Injected automatically by `shopify app dev` locally; set manually in production. |
| `SHOPIFY_API_SECRET` | Yes (prod) | Same as above. |
| `SCOPES` | Yes (prod) | Comma-separated access scopes; mirrors `shopify.app.toml`. |
| `SHOPIFY_APP_URL` | Yes (prod) | Your deployed app's public URL. |
| `SHOP_CUSTOM_DOMAIN` | No | Only if the store uses a custom domain. |

## Deployment

1. Provision Postgres and a web service (Render or your preferred host).
2. Set the environment variables above on the host.
3. Run `npx prisma migrate deploy` against the production database.
4. Push your app config and extensions:

   ```shell
   npx shopify app deploy
   ```

5. In the Dev Dashboard, set distribution to **Custom Distribution** and
   generate the install link for the client's store.

## Known limitations / open items

- **Wishlist-to-purchase conversion tracking is coded but not yet live** - it
  needs `orders/paid`, which Shopify gates behind **Protected Customer Data
  access** (order payloads carry customer PII). Grant that in the Dev
  Dashboard, then uncomment the `orders/paid` subscription in
  `shopify.app.toml`.
- Conversion rates only cover **logged-in customer** activity - an anonymous
  guest wishlist add can't be linked back to an order at checkout.
- No automated test suite yet; verification so far has been direct API/DB
  testing against a live dev store.
- Notifications (back-in-stock, price-drop alerts) and shareable wishlist
  links are out of scope for this build.
- Redis caching and rate limiting are deferred until traffic actually
  justifies them.
