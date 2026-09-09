# Writing notes for the AI site

Notes live in `_posts/` as Markdown files. Jekyll builds them into
`https://wirewalktech.github.io/AI-Extension/writing/`.

There are three ways to write one. The first needs no setup.

---

## 1. GitHub's own editor — works now, works from a phone

The lowest-friction option and nothing to install.

1. Go to <https://github.com/wirewalktech/AI-Extension/tree/main/_posts>
2. **Add file → Create new file**
3. Name it `YYYY-MM-DD-a-short-slug.md`
4. Paste the template below, write, and commit

The site rebuilds itself in about a minute.

```markdown
---
title: "Sentence case title"
date: 2026-09-09 09:00:00 -0400
summary: >-
  One or two sentences. Shown on the notes index and used as the page's
  meta description.
tags:
  - Method
---

Body in Markdown. `##` for section headings.
```

Two things that catch people out:

- **A future date will not publish.** Jekyll hides posts dated ahead of the build.
- **The filename sets the URL.** `2026-09-09-the-thirty-claim-sample.md` becomes
  `/writing/the-thirty-claim-sample/`. The date in the filename must match the `date:` field.

---

## 2. The visual editor, locally — works now, no accounts

`/admin/` is [Decap CMS](https://decapcms.org): title, summary, tags and a Markdown body with
live preview. Running it locally needs two terminals and no credentials at all:

```bash
cd ~/Downloads/wirewalkai
npx decap-server          # terminal 1 — the local backend

bundle exec jekyll serve  # terminal 2 — the site itself
```

Then open <http://localhost:4000/admin/>. Saving writes straight into `_posts/`. Commit and
push when you are happy with it.

This works because `local_backend: true` is set in `admin/config.yml`.

---

## 3. The visual editor, hosted — usable from anywhere, needs one-time setup

To use `/admin/` on the live site — from a phone, without a terminal — Decap needs to
authenticate you against GitHub. GitHub Pages cannot host the OAuth callback itself, so this
requires one small external piece. It is free, and it is set up once.

**Step 1 — register a GitHub OAuth app**

<https://github.com/settings/developers> → **New OAuth App**

| Field | Value |
|---|---|
| Application name | Wirewalk AI notes |
| Homepage URL | `https://wirewalktech.github.io/AI-Extension/` |
| Authorization callback URL | the `/callback` URL of the proxy from step 2 |

Note the **Client ID** and generate a **Client Secret**.

**Step 2 — deploy an OAuth proxy**

A Cloudflare Worker is the usual choice: free, no server, about thirty lines. Several
maintained implementations exist — search for "decap cms cloudflare worker oauth". Deploy it
with the client ID and secret from step 1 as environment variables, then put its callback URL
back into the OAuth app.

**Step 3 — point the CMS at it**

In `admin/config.yml`, uncomment `base_url` and set it to the worker's address:

```yaml
backend:
  name: github
  repo: wirewalktech/AI-Extension
  branch: main
  base_url: https://your-worker.workers.dev
```

Commit and push. `/admin/` on the live site will then offer **Login with GitHub**.

> Anyone who can authenticate as a collaborator on the repository can publish. Keep the
> repository's collaborator list as the access control.

---

## Where things are

| Path | What it is |
|---|---|
| `_posts/` | the notes, one Markdown file each |
| `writing.html` | the index page, at `/writing/` |
| `_layouts/article.html` | how a single note is rendered |
| `admin/config.yml` | CMS fields and backend |
| `_config.yml` | Jekyll settings — `baseurl` must stay `/AI-Extension` |

`index.html` has no front matter, so Jekyll copies it through untouched. The Operating Review
page is unaffected by any of this.
