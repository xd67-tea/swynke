# Swynke website

The one-page site for swynke.com.au, deployed on Vercel from `main`.

- `index.html` is the live page. It's generated, so don't edit it by hand.
- `src/template.html` is the page with `{{slot}}` placeholders for every piece of text.
- `content.json` is the text that's currently published.
- `apps-script/` is the Google Sheet editor that people use to edit, save versions and publish. See [apps-script/SETUP.md](apps-script/SETUP.md).
- `tools/render.js` rebuilds `index.html` from the template and `content.json` (`node tools/render.js`), using the same code as the editor.
- `middleware.js` puts a password on the site while it's in preview. Delete it at launch.
