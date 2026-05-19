# Resumod ATS Match — Chrome Extension (MV3)

One-click resume-vs-JD scorer with a **Shadow DOM sidebar** that slides in
over LinkedIn, Internshala, and Naukri job pages.

UI pattern borrowed 1:1 from the sibling **OptyMatch** extension
([OptyMatch-scraper-linkedin-internshala](../OptyMatch-scraper-linkedin-internshala/)):
glass-morphism card stack, mac-style minimize/close buttons, shadow-root
encapsulation for CSS isolation, CSP-safe event wiring.

> **No popup.** Click the toolbar icon → sidebar slides in on the current job
> page. Click again → slides out. Minimize collapses it to a 48 px circle.

## 📁 Project structure

```
resumod-ats-extension/
├── manifest.json               MV3 manifest (no default_popup)
├── background.js               Service worker — action.onClicked toggles sidebar,
│                               handles ANALYZE_JOB, stores resume/settings/last result
├── content/
│   ├── extract-common.js       Shared helpers: waitFor (MutationObserver), text sanitize,
│   │                           "show more" clicker. Exposes window.ResumodExtract
│   ├── linkedin.js             LinkedIn JD + title + company selectors (ordered fallbacks)
│   ├── internshala.js          Internshala detail-page selectors
│   ├── naukri.js               Naukri hashed-class selectors
│   └── sidebar.js              The Shadow-DOM sidebar: resume upload, analyze,
│                               score ring, pill lists, suggestions, settings panel
└── README.md
```

Each site gets **3 scripts** injected at `document_idle`:
`extract-common.js` → `<site>.js` → `sidebar.js`. The site script registers its
scrape function on `window.ResumodExtract`; the sidebar calls it directly.

## 🏗️ Architecture

```
                 click toolbar icon
                          │
                          ▼
 ┌─────────────────────────────────────────┐
 │ background.js                           │
 │                                         │
 │  action.onClicked ──┐                   │
 │                     ▼                   │
 │  chrome.tabs.sendMessage("TOGGLE_      │
 │    SIDEBAR") ───────────────────┐       │
 │                                 │       │
 │  onMessage("ANALYZE_JOB") ←─────┼──┐    │
 │      │                          │  │    │
 │      ▼                          │  │    │
 │    fetch Resumod API   ─────────┼──┼─▶ Resumod ATS API
 │    (or local mock scorer)       │  │    │
 └─────────────────────────────────┼──┼────┘
                                   ▼  │
        ┌──────────────────────────────┼────────────┐
        │ content (shadow DOM sidebar) │            │
        │                              │            │
        │  extract-common.js ──┐       │            │
        │  <site>.js          ─┤       │            │
        │                      ▼       ▲            │
        │  sidebar.js: upload resume,  │            │
        │  Analyze click ──► scrape(), │            │
        │  then sendMessage("ANALYZE_JOB") ─────────┘
        │  then render score + pills + tips
        └───────────────────────────────────────────┘
```

### Message types

| Type             | From       | To          | Response                                     |
|------------------|------------|-------------|----------------------------------------------|
| `TOGGLE_SIDEBAR` | background | content     | `{ ok, visible }`                            |
| `ANALYZE_JOB`    | content    | background  | `{ ok, data: { score, matched, missing, suggestions } }` |

### Storage keys (`chrome.storage.local`)

| Key                      | Shape                                                                    |
|--------------------------|--------------------------------------------------------------------------|
| `resumod_resume`         | `{ filename, mimeType, size, base64, textPreview, uploadedAt }`          |
| `resumod_settings`       | `{ apiEndpoint, apiToken, mockMode }`                                    |
| `resumod_last_analysis`  | `{ score, matchedKeywords, missingKeywords, suggestions, jobTitle, ... }`|

## 🔒 CSP — what we learned from OptyMatch

LinkedIn ships a strict Content Security Policy; Internshala and Naukri are
laxer but we apply the same defensive patterns everywhere. The OptyMatch
extension documents the actual failure modes it hit
([see README §"Content Security Policy (CSP) Compliance & Fixes"](../OptyMatch-scraper-linkedin-internshala/README.md)
lines 459–571). Key rules we follow in [content/sidebar.js](content/sidebar.js):

| Risk                                                  | Our mitigation |
|-------------------------------------------------------|----------------|
| `document.head.appendChild(style)` blocked by CSP     | **Shadow DOM scope.** The `<style>` block lives inside `shadowRoot.innerHTML`. Shadow-scoped stylesheets work on LinkedIn today (same pattern as OptyMatch's [content.js:1914/2048](../OptyMatch-scraper-linkedin-internshala/content.js#L2048)). |
| Inline event handlers (`onclick="..."`)               | Never used. Every handler is `element.addEventListener("click", …)`. |
| External scripts via `<script src>`                   | Never injected. All JS is bundled and declared in `manifest.json → content_scripts`. |
| Page styles leaking into our UI (and vice versa)      | `attachShadow({ mode: "open" })` isolates the entire sidebar. |
| Shadow host getting hidden behind page modals         | Shadow host uses `z-index: 2147483647` (max). |
| Critical positioning lost if outer stylesheet blocked | Shadow host + container both carry inline `style=""` for `position/top/right/width/height/transform`. Everything else lives in the shadow-scoped `<style>`. |
| CORS / page-CSP blocking our `fetch`                  | All API calls run in the **background service worker**, which is not subject to the page's CSP. Same pattern OptyMatch uses for S3 downloads (see its [INTERNSHALA_README.md line 144-148](../OptyMatch-scraper-linkedin-internshala/INTERNSHALA_README.md#L144-L148)). |

**Debug trick**: if the sidebar ever renders without styling on a new site,
open DevTools → Console and search for `Refused to apply style` / `Content
Security Policy`. That's the signal to fall back to per-element
`element.style.cssText = "..."` for any CSS rule the page is blocking.

## 🧩 How the scrapers stay robust

1. Content scripts run at `run_at: "document_idle"` so React-rendered pages
   have painted at least once.
2. Each site script is wrapped in an IIFE with a `window.__RESUMOD_*__`
   guard so SPA navigations don't double-inject (same pattern as OptyMatch
   [content.js:5-7](../OptyMatch-scraper-linkedin-internshala/content.js#L5-L7)).
3. `ResumodExtract.waitFor([...])` uses a **MutationObserver** with a 3.5–4 s
   timeout, so lazy-loaded JD panels (LinkedIn quick-view, Naukri infinite
   scroll) are still caught.
4. Before reading the JD, we click every known "see more" / "show more"
   button so we capture the full text, not the truncated preview.
5. Selector lists go **most-specific → most-generic**, falling back to
   attribute-contains (`[class*="jobs-description"]`, `[class*="JobDesc"]`)
   so Naukri's hashed-classname renames and LinkedIn's rotating classes
   don't break us immediately.

### Selector cheat sheet

**LinkedIn** ([content/linkedin.js](content/linkedin.js))
```
.jobs-description__content .jobs-description-content__text
.jobs-description-content__text
.jobs-description__content
.jobs-box__html-content
article.jobs-description__container
.show-more-less-html__markup
[data-test-id="job-details-description"]
[class*="jobs-description"]
```

**Internshala** ([content/internshala.js](content/internshala.js))
```
.internship_details .text-container
.internship_details
#details_container
.about_internship_container
```

**Naukri** ([content/naukri.js](content/naukri.js))
```
section[class*="styles_job-desc-container"]
div[class*="styles_JDC__dang-inner-html"]
div[class*="JobDescription"]
div.dang-inner-html
```

## 🚀 Install (developer mode)

1. `chrome://extensions` → toggle **Developer mode** (top right).
2. Click **Load unpacked** → select `e:\hackathon\otymatch\resumod-ats-extension`.
3. The Resumod icon appears in the toolbar.
4. Open a job page on LinkedIn / Internshala / Naukri.
5. Click the Resumod icon → sidebar slides in from the right.
6. Upload your resume (PDF / DOCX / TXT, max 5 MB) — stored once, reused
   forever.
7. Click **⚡ Analyze this job page** → score + matched/missing keywords +
   suggestions appear in the sidebar.

Minimize (yellow dot) → sidebar collapses to a 48 px "R" circle you can
click to restore. Close (red dot) → sidebar slides out; click the toolbar
icon to bring it back.

## ⚙️ Wiring the real Resumod API

Scroll to the bottom of the sidebar → click **⚙ API settings**.

- **Endpoint**: e.g. `https://api.resumod.co/v1/ats/analyze`
- **Token** *(optional)*: sent as `Authorization: Bearer <token>`
- **Use local mock scoring**: **uncheck** once the backend is live

Request body the extension sends:
```json
{
  "resume": {
    "filename": "jane-doe-resume.pdf",
    "mimeType": "application/pdf",
    "base64": "JVBERi0xLjQK..."
  },
  "jobDescription": "...raw JD text scraped from the page...",
  "jobTitle": "Senior Frontend Engineer",
  "jobUrl": "https://www.linkedin.com/jobs/view/...",
  "source": "linkedin"
}
```

Expected response (several key-name variants are auto-normalized in
[background.js → normalizeApiResponse](background.js)):
```json
{
  "score": 78,
  "matchedKeywords": ["react", "typescript", "graphql"],
  "missingKeywords": ["kubernetes", "terraform"],
  "suggestions": [
    "Add a line about container orchestration experience if you have any.",
    "Quantify front-end performance wins with metrics."
  ]
}
```

Both `camelCase` and `snake_case`, and `atsScore` / `match_percentage` are
accepted. If your backend is on a host other than `*.resumod.co`, add it to
`host_permissions` in [manifest.json](manifest.json).

## 🧪 Quick smoke test (with mock mode on — default)

1. Load unpacked, upload any PDF.
2. Go to `https://www.linkedin.com/jobs/view/<some-job-id>`.
3. Click the Resumod icon → sidebar slides in.
4. Click **⚡ Analyze this job page**.
5. You should see a deterministic score (55–90 for PDFs, real keyword
   overlap for .txt resumes), keyword pills, and generic suggestions.
6. Uncheck mock mode once the real API is live.

## 🔭 Roadmap

- Auto-detect job pages and pulse the toolbar icon instead of waiting for a
  click.
- Highlight missing keywords inline on the JD text (Range API into Shadow
  DOM overlay).
- Multi-resume profiles (tag resumes by role, pick one per analysis).
- Replace the local mock scorer with an on-device embedding similarity
  fallback when offline.
