# Products UI

A plain **HTML5 / CSS3 / ES-modules** frontend for the Products API (the PHP
developer test assignment). No build step, no runtime dependencies, no
framework — just static files served by nginx, plus a small dev/test toolchain
(ESLint, Prettier, TypeScript for type-checking JS, Vitest).

---

## What it does

- Lists products in a table (code, name, description, brand, material, price).
- Filtering by **brand**, **material**, **price from/to**, and a **text search
  that matches the product name and code only** (this mirrors the API; the
  description is _not_ searched).
- Sorting by any API-sortable column (code, name, brand, material, price) with
  an asc/desc toggle.
- Pagination (10 items per page, fixed by the API).
- CSV export of the **current filter + sort** (no page), delivered by the API
  as an attachment.
- Editing a product in a modal dialog (code, name, description, price, brand,
  material), with client-side validation and full rendering of the API's `422`
  validation errors.

State (page, sort, order, filters, search) lives **in the URL**, so views are
shareable and back/forward work.

---

## Architecture

Feature-Sliced Design (FSD), plain JavaScript (ESM), with `// @ts-check`-style
JSDoc types validated by `tsc` (`checkJs`).

```
src/
├── app/                 # bootstrap + global styles
│   ├── main.js
│   └── styles/          # tokens.css, base.css, index.css
├── pages/products/      # the only page
│   ├── products-page.js # composition root: wires features + widget + entity
│   ├── model/list-state.js   # URL <-> state, history, page reconciliation
│   └── index.js
├── widgets/product-table/     # sortable table + pagination entry
├── features/
│   ├── product-filters/       # filter form
│   ├── product-export/        # CSV export anchor
│   └── product-edit/          # edit dialog + form
├── entities/product/          # API calls, ListState <-> query string, formatting
└── shared/
    ├── api/http.js            # fetch wrapper + error mapping
    ├── ui/                    # pagination, select, dialog helpers
    └── lib/                   # dom, store, debounce, error-messages
```

**Merged the `brand` and `material` entities** into `entities/product`
(`brand.js`, `material.js`) instead of separate slices: in this domain they are
one-line wrappers around `GET /api/brands` and `GET /api/materials`, so separate
layers would be over-engineering.

**One pagination implementation** lives in `shared/ui/pagination.js` and is
reused by the `product-table` widget (no duplicate copy inside the widget).

### Key modules

- **`entities/product/query.js`** — the _single_ source of truth that turns
  `ListState` into a query string. Both the list request and the CSV export link
  are built from it (`buildListUrl` / `buildExportUrl`), the export dropping the
  `page` parameter. The two can never drift apart.
- **`shared/api/http.js`** — maps the API's JSON error contract to typed errors
  (`ApiError` with `status`/`errorKey`, `NetworkError`, `AbortError`) and parses
  the `422` payload `{ "validationError": [ { "<field>": ["<key>", …] } ] }`.
- **`pages/products/products-page.js`** — the store subscription is the _single_
  driver of list fetching. Every state change (filters, sort, page, popstate)
  triggers exactly one request. Requests are guarded by an `AbortController`
  **and** a monotonic sequence id, so a slow/stale response can never overwrite a
  newer one.

---

## Security

Untrusted API data is **never** interpreted as HTML:

- All DOM is built with `document.createElement` + `textContent`
  (`shared/lib/dom.js`), never `innerHTML`.
- ESLint forbids `innerHTML`, `outerHTML`, `insertAdjacentHTML` and
  `document.write`/`writeln` (`no-restricted-properties` / `no-restricted-syntax`).
- A test feeds hostile strings (`<img src=x onerror=alert(1)>`) through the table
  and the form and asserts that no element is created and the text stays literal.

The API-supplied `debug` field (present when `APP_DEBUG=true`) is never surfaced.

---

## Prerequisites

- Docker + Docker Compose (for running the UI and the API stack).
- Node.js (for lint / type-check / tests). Node **v24** was used; npm 11.

> Node was not on `PATH` in the dev environment used to build this; it was
> available via nvm at `~/.nvm/versions/node/v24.15.0`. If `node`/`npm` are not
> found, prepend it:
>
> ```bash
> export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"
> ```

---

## Running (preview)

### 1. Start the API stack first

The API project creates the Docker network `products_products-network` that the
UI joins. Start it from the API repo's `docker/` directory:

```bash
cd ../api/docker
docker compose up -d --build
docker compose exec app composer install
docker compose exec app php tracker migrations:migrate
docker compose exec app php tracker fixtures:load
```

### 2. Start the UI

```bash
# from this (ui/) directory
docker compose up
```

Open **http://localhost:8080**. The host port is configurable with the `UI_PORT`
variable (default `8080`); to override it, copy `ui/.env.example` to `ui/.env`
(optional, local-only, not committed) and adjust it.

### How the UI reaches the API

The UI nginx (`nginx/default.conf`) serves the static frontend on `/` and
**proxies `/api/` to the API project's nginx container over the shared Docker
network**, so the browser sees a single origin and CORS is not needed.

- The upstream is `https://products-api-nginx` (the API nginx listens on
  container port **443**). The proxy connects **server-to-server inside the
  Docker network by container name**, so it depends on **no API host port** and
  is unaffected by the API's host port mapping.
- The API nginx serves HTTPS with a **self-signed certificate** whose
  `CN=localhost` and which has **no SAN** (`docker/certificates/` in the API
  project). Because the proxy connects to the container name
  (`products-api-nginx`), hostname verification could never succeed against this
  certificate, so the proxy sets `proxy_ssl_server_name on` (send SNI) and
  **`proxy_ssl_verify off`**.
  > ⚠️ **`proxy_ssl_verify off` is a LOCAL-DEVELOPMENT-ONLY setting** because the
  > certificate is self-signed and has no SAN. In production the upstream
  > certificate must be verified (or a proper CA/truststore configured).
- The upstream is resolved **lazily** through Docker's embedded DNS
  (`resolver 127.0.0.11 valid=10s`) with a variable in `proxy_pass`, so the UI
  nginx starts even when the API stack is down. In that case `/api/...` returns
  an error and the UI shows its **error state with a “Zkusit znovu” (retry)
  button** instead of crashing.

The API's HTTP->HTTPS redirect does **not** apply to the UI: the proxy talks to
the API's HTTPS listener on container port 443 directly, never through the API's
published HTTP port.

Nothing in the API repository is modified.

> **Optional: regenerate the certificate with a SAN.** For a nicer browser
> experience the API's self-signed certificate could be regenerated with a
> `subjectAltName` (e.g. `DNS:localhost, DNS:products-api-nginx`) via
> `openssl req -x509 ... -addext "subjectAltName=..."`. This is optional and is
> **not** done here; the current certificate has `CN=localhost` and no SAN, which
> is why the proxy disables verification.

---

## Development commands

```bash
npm install        # one-time
npm run lint       # ESLint (includes the innerHTML security guard)
npm run typecheck  # tsc -p jsconfig.json --noEmit  (checks JS via JSDoc)
npm run test       # Vitest (jsdom)
npm run format     # Prettier --write
npm run format:check
```

Everything runs without a bundler; `index.html` loads `src/app/main.js` as a
module. The nginx container mounts `index.html` and `src/` read-only.

---

## Manual verification checklist

Automated tests cover the pure logic, the table/form DOM and the page wiring in
jsdom. The following checks require a browser and the running stacks and were
**NOT executed here** (no browser/Playwright available) — treat them as
**UNVERIFIED** until you run them.

> All strings in the UI are in Czech (the assignment language).

### Happy path

1. Start both stacks (see above), open http://localhost:8080.
2. **Table** lists products with code, name, description (truncated, full text on
   hover via `title`), brand, material, price formatted as `1 890,00 Kč`.
3. The status line reads e.g. _„Nalezeno 25 produktů, stránka 1 z 3."_ and is
   announced by screen readers (it is an `aria-live` region).

### Filtering

4. Pick a **Značka** → list narrows, URL gains `brandId=…`, and the page resets
   to 1.
5. Pick a **Materiál** → same behavior.
6. Enter **Cena od / Cena do** → list narrows after the field loses focus; URL
   gains `priceFrom`/`priceTo`.
7. Type in **Hledat** → after ~350 ms the list narrows. Verify it matches the
   product **name or code**, and that the placeholder/label say
   _„Hledá v názvu a kódu produktu."_.
8. Click **Zrušit filtry** → all filters clear and the table resets.

### Sorting

9. Click a column header (e.g. **Cena**) → sorts ascending; click again →
   descending. The active header shows `aria-sort` and an ↑/↓ indicator.
10. Changing the sort resets to page 1 and updates the URL (`sort=price&order=desc`).

### Pagination

11. With more than 10 products, use the pagination controls; URL gains `page=N`.
12. **Out-of-range page:** navigate to `http://localhost:8080/?page=999` → the UI
    moves to the **last** page, and the URL is rewritten **in place**
    (`replaceState`, no extra history entry — pressing Back leaves the site, not
    just the page).
13. **Empty dataset:** if the DB has no products at all, the pagination is hidden
    and the empty state is shown.

### Empty / error states

14. Filter to a combination with no matches → the _„Nenalezeny žádné produkty"_
    empty state is shown and pagination disappears.
15. **Stop the API stack** (`cd ../api/docker && docker compose stop nginx`) and
    reload the UI → an error banner appears with the message and a **„Zkusit
    znovu"** button; the UI does not crash. Start the API again, click the button
    → the list loads.

### Editing

16. Click **Upravit** on a row → a modal dialog opens prefilled with the product.
17. Change the **Název** and **Cena**, click **Uložit** → dialog closes, the list
    refreshes and shows the new values.
18. Clear **Kód** and save → a required-field error appears under the field
    (client-side) and the dialog stays open.
19. Set a **Kód** that already exists (e.g. of another row) and save → the API
    returns `422` with `code.unique`; the error _„Produkt s tímto kódem už
    existuje."_ is shown under the **Kód** field.
20. Enter an invalid **Cena** (e.g. `0`, `-5`, `10.999`) → the price error is
    shown; a valid price (`10.99`) is accepted.
21. Open the dialog, then delete the row's product via another client/API and
    click **Uložit** → the dialog reports the product no longer exists and the
    list refreshes.
22. Press **Esc** or click **Zrušit** → the dialog closes and focus returns to
    the **Upravit** button that opened it.

### CSV export

23. Set some filters + a sort, click **Exportovat CSV** → the browser downloads a
    file named `products.csv` whose content matches the current filter/sort.
24. On a non-first page, export → the CSV contains **all** filtered rows (the
    export ignores `page`), and it is UTF-8 with a BOM and `;`-separated (opens
    correctly in Czech Excel).

### Accessibility / security spot-checks

25. Tab through the page: focus is always visible; the skip link appears first.
26. Add a product whose name contains `<b>x</b>` (via API/DB) and reload → the
    literal text is shown, not bold; no script executes.
27. Narrow the viewport (< ~48 rem) → the table collapses into labeled cards.

---

## Known limitations / notes

- **Search scope** is name + code only (API behavior), not description.
- **`perPage` is fixed at 10** by the API; the UI does not offer a page-size
  selector.
- If the filter lookups (`/api/brands`, `/api/materials`) fail, the filter
  selects stay empty but the list still works (graceful degradation).
- Consumer-side type checking is done with `tsc --checkJs`; there is no
  compilation step and no runtime type stripping beyond the browser's native ESM.
