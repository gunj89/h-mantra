# H Mantra — Tanki Project Works

Static 3-page website (no build step). Open `index.html` in a browser, or upload the folder to any static host (Netlify, GitHub Pages, Cloudflare Pages, cPanel).

```
index.html        Home
portfolio.html    67-project gallery with category filters + lightbox
contact.html      Details, WhatsApp CTA, enquiry form, map
assets/css/style.css
assets/js/main.js
assets/images/    hero.jpg, about.jpg, logo/, projects/project-01.jpg … project-67.jpg
```

## Common edits

- **Add a project:** drop `project-68.jpg` in `assets/images/projects/`, then copy any `<figure class="portfolio-item">` block in `portfolio.html`. Set `data-category` to one of: `interior`, `living-room`, `bedroom`, `kitchen`, `furniture`, `mandir`, `wall-ceiling`.
- **Remove a project:** delete its `<figure>` block.
- **Enquiry form:** has no server. It opens WhatsApp with the details pre-filled, using the number in `data-whatsapp` on the `<form>` in `contact.html`. To send email instead, connect Web3Forms / Formspree and remove the form block in `assets/js/main.js`.
- **Phone / email / address:** appear in each page's footer, `contact.html`, and the JSON-LD block in `<head>` of `index.html` and `contact.html`.

## Before going live

- Confirm the WhatsApp number (`919106940350`) and the map pin on the Contact page.
- Add `og:image`, `canonical`, `sitemap.xml` and `robots.txt` once the domain is known.
