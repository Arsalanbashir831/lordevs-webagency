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

## 0. The visual editor (CMS)

```bash
node dev.mjs          # then open  http://localhost:3000/admin/
```

A friendly editor for everything below – no JSON knowledge needed:

- **Pages** in the sidebar (and **New page**), plus **Site settings** (logo, contact, menu, footer, cookie banner)
- each page is a list of **sections**: drag to reorder, click to edit, eye to hide, duplicate, delete, **Add section**
- forms with text fields, colour pickers, an icon picker, and add / reorder / delete for every list (services, FAQ, steps…)
- a **live preview** (desktop / tablet / mobile) that jumps to the section you open and refreshes when you save
- **Save** (or `Cmd/Ctrl + S`) writes the JSON file and rebuilds the site; if a change would break the build it is rolled back and you see why
- a **JSON** tab for the raw file, and a copy of the previous version of every saved file in `content/.backups/` (last 30)

The editor runs only on your computer (it listens on `127.0.0.1` and refuses requests from other websites), so there is nothing to log in to
and nothing is exposed online. Publish the generated HTML (`index.html`, `privacy.html`, …) – the admin is only for you.

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
| `booking` | `tag`, `title`, `panel{host,subtitle,title,details[]}`, `timeSlots[]`, `confirmLabel`, `emailSubject`, optional `email` |
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
