# GitHub Pages deployment guide

This document explains how this app is configured so that `npm run build` and `npm run deploy` work correctly for GitHub Pages.

## 1. What the app uses for deployment

This project is a Vite + Vue app. For GitHub Pages, the build output is generated into the `dist` folder, and that folder is published by the `gh-pages` package.

### Core deployment pieces

- `vite.config.js` sets the correct public base path for GitHub Pages.
- `package.json` defines the deployment script and homepage metadata.
- `src/router/index.js` uses browser history so routes work correctly when hosted on GitHub Pages.
- `.github/workflows/deploy.yml` provides an automated deployment workflow through GitHub Actions.
- `public/404.html` helps GitHub Pages handle direct deep links.

---

## 2. Build process

The build command is:

```bash
npm run build
```

This runs Vite’s production build and outputs a static site to the `dist` folder.

### Why this works

Vite compiles the Vue app into static assets that GitHub Pages can serve directly.

---

## 3. Deploy process

The deploy command is:

```bash
npm run deploy
```

It runs:

```bash
npm run build && gh-pages -d dist
```

### What that means

1. `npm run build` creates the production build.
2. `gh-pages` publishes the contents of `dist` to the GitHub Pages branch.
3. GitHub Pages serves that published content.

---

## 4. GitHub Pages configuration in the app

### A. Vite base path

In [vite.config.js](../vite.config.js), the app uses a base path matching the GitHub Pages repository URL.

```js
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'tennis'

export default defineConfig({
  plugins: [vue()],
  base: process.env.NODE_ENV === 'production' ? `/${repoName}/` : '/',
})
```

This ensures assets such as CSS, JS, and images load from the correct subpath.

### B. Homepage metadata

In [package.json](../package.json), the homepage field points to the GitHub Pages URL:

```json
"homepage": "https://AlexDunia.github.io/tennis/"
```

This helps tooling understand the public site URL.

### C. Router history mode

In [src/router/index.js](../src/router/index.js), the router uses browser history instead of hash history:

```js
import { createRouter, createWebHistory } from 'vue-router'
```

This is important because GitHub Pages serves the app from a route-like URL structure and direct navigation should work more reliably.

---

## 5. GitHub Actions deployment

The app also has a GitHub Actions workflow at [.github/workflows/deploy.yml](../.github/workflows/deploy.yml).

It automatically:

1. Checks out the repository
2. Installs dependencies with `npm ci`
3. Runs the production build
4. Uploads the `dist` folder to GitHub Pages

This is the recommended modern setup because it removes the need to rely only on local deployment commands.

---

## 6. Handling direct routes and refreshes

GitHub Pages does not automatically serve SPA routes like `/dashboard` or `/tournaments` the same way a local dev server does.

To support that, the app includes [public/404.html](../public/404.html), which helps redirect deep links back into the app correctly.

---

## 7. Repo settings you should confirm on GitHub

In your GitHub repository:

1. Go to Settings → Pages
2. Make sure the source is set to GitHub Actions
3. Confirm the repository name matches the deployed URL pattern

The expected site URL for this app is:

```text
https://AlexDunia.github.io/tennis/
```

---

## 8. Summary

This app is set up for GitHub Pages by combining:

- a Vite base path that matches the repo name
- a homepage URL that points to the published site
- browser-history routing for SPA navigation
- a deployment script using `gh-pages`
- an automated GitHub Actions workflow

That combination is what allows `npm run build` and `npm run deploy` to work for your GitHub Pages deployment.
