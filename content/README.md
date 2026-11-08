# Lordevs website – content guide

All text on the website lives in **JSON files in this folder**. You never need to touch the HTML.
No backend, no database, no dependencies – just Node.js (v18+).

```
content/
  site.json            ← shared across every page: logo, contact details, menu, footer, cookie banner
  pages/
    home.json          ← the home page   → builds index.html
    privacy.json       ← the privacy page → builds privacy.html
```

**One JSON file = one page.** Each page file has its own SEO title/description and an ordered list of `sections`.

---

## 0. Generated SEO files

Every build also writes **`sitemap.xml`** (every page that isn't `"noindex"`) and **`robots.txt`** (allows all crawlers and points to the sitemap).
Don't edit them by hand. A page's `<lastmod>` date is the date its JSON file was last committed (today if it has uncommitted edits).

> The visual CMS dashboard (`/admin/`) has been removed for now. Edit the JSON files directly. The dashboard is still in git history if it's needed again.

---

## 1. Edit → see the result (by hand)

```bash
node dev.mjs          # open http://localhost:3000  – edit any JSON, save, the page rebuilds and reloads itself
node build.mjs        # (or) just rebuild index.html / privacy.html once
```

If a JSON file has a mistake, the build tells you the file, the place and what is wrong
(for example `home.json → sections[4] (services) → items[2]: "title" is required`), and the dev server shows it in the browser.

> `index.html` and `privacy.html` are **generated** – edit the JSON, not the HTML (changes to the HTML are overwritten on the next build).
> Publish the folder as it is (Netlify, Cloudflare Pages, any static host) – or run `node build.mjs` as the build command.

---

## 2. Common tasks

| I want to… | Edit |
|---|---|
| Change the phone / WhatsApp / email | `site.json → contact` (updates footer, privacy page and booking button everywhere) |
| Change the menu links | `site.json → navigation.links` |
| Change the page title / Google description | `pages/home.json → meta` |
| Change the big hero headline | `pages/home.json → sections[type "hero"] → title` |
| Add a FAQ question | add `{ "q": "…", "a": "…" }` to the `faq` section's `items` |
| Add / remove a service | add / delete an object in the `services` section's `items` |
| Change the booking time slots | `booking → timeSlots` |
| Hide a section without deleting it | add `"enabled": false` to that section |
| Reorder sections | move the section object up or down inside `sections` |
| Turn off the cookie banner | `site.json → cookieBanner.enabled: false` |
| Add social links | add them to `site.json → footer.columns` (see "Links" below) |

---

## 3. Text formatting

Any text field may contain these tags: `<b>`, `<strong>`, `<i>`, `<em>`, `<br>` (line break), `<mark>` (yellow highlight), `<span>`, `<a href="…">`.
Anything else is shown as plain text, so a typo can't break the page. Write `&` normally.

Shortcuts you can use in any text: `{{email}}`, `{{whatsapp}}` (display number), `{{whatsappUrl}}` (chat link), `{{brand}}`.
They are filled in from `site.json → contact`.

**Links** (`footer.columns[].links`, `navigation`):
`{ "label": "Instagram", "href": "https://instagram.com/…", "external": true }` – `external` opens a new tab, `"accent": true` makes it yellow.

**Icons** (for services, process steps and "why" cards) – use the name in `"icon"`:
`globe, layers, target, search, wrench, bolt, dollar, code, trending, shield, rocket, mail, chat, clock, users, design, gauge, monitor, phone, check, star`

**Card colours** (`"style"`): `yellow`, `stone`, `cream`, `dark`

---

## 4. Section reference (`pages/*.json → sections`)

Every section is `{ "type": "…", …fields }`. Optional on all: `"enabled": false`, `"id": "custom-anchor"`.
`tag` = small label above the title, `title` = heading (use `<br>` for a line break), `lead` = intro line.

| type | fields |
|---|---|
| `hero` | `title.line1`, `title.line2`, `subtitle`, `cta{label,href}`, `proof{rating,text}`, `logosTitle`, `logos[]` |
| `workStrip` | `items[]` → `tag`, `name`, `mock` (`browser` \| `phone` \| `chart` \| `shop`), `theme` (1–5) |
| `about` | `statement`, `stats` with 5 fixed slots: `projects`, `clients`, `satisfaction`, `growth`, `countries` (numbers use `value` + `suffix`) |
| `techBand` | `items[]` (the scrolling yellow band) |
| `services` | `tag`, `title`, `lead`, `items[]` → `icon`, `style`, `title`, `text`, `linkLabel`, `linkHref` |
| `compare` | `tag`, `title`, `other{title,items[]}`, `us{title,items[]}`, `trustedText`, `logos[]` |
| `why` | `tag`, `title`, `cards[]` → `icon`, `style`, `title`, `text`; add `"wide": true` + `linkLabel`/`linkHref` for the big cards |
| `testimonials` | `tag`, `title`, `items[]` → `quote`, `name`, `role`, `avatarBg`, optional `avatarColor`, `logo`, `variant` (`hero` \| `accent`) |
| `process` | `tag`, `title`, `lead`, `steps[]` → `icon`, `title`, `text` (numbered automatically), `cta{label,href}` |
| `booking` | `tag`, `title`, optional `calendlyUrl` (embeds Calendly and ignores the fields below), `panel{host,subtitle,title,details[]}`, `timeSlots[]`, `confirmLabel`, `emailSubject`, optional `email` |
| `faq` | `tag`, `title`, `items[]` → `q`, `a` |
| `legal` | `title`, `updated`, `blocks[]` → optional `heading`, `paragraphs[]`, `list[]` (used for privacy / terms pages) |

Shared things (logo, avatars, cookie banner text, footer) are in `site.json`.

---

## 5. Add a new page

1. Create `content/pages/about.json`:
   ```json
   {
     "output": "about.html",
     "layout": "default",
     "meta": { "title": "About – Lordevs", "description": "Who we are." },
     "sections": [
       { "type": "faq", "tag": "FAQ", "title": "Questions", "items": [ { "q": "…", "a": "…" } ] }
     ]
   }
   ```
   (`layout` is `default` for a normal page with the menu and footer, or `legal` for a simple text page.)
2. Link to it from `site.json` (menu or footer) with `"href": "about.html"`.
3. Run `node build.mjs`. Files starting with `_` (e.g. `_draft.json`) are ignored.

Menu links that start with `#` (like `#services`) automatically point back to the home page when used on other pages.

---

## 6. What the build adds for SEO (automatically)

- page `<title>`, description, canonical URL and Open Graph tags from `meta` – **set `url` in `site.json` to your real domain**
- `Organization` structured data (from `site.json`) on the home page
- `FAQPage` structured data from your FAQ items – so answers can be picked up by Google and AI answer engines
- `"meta": { "noindex": true }` on a page keeps it out of search engines
