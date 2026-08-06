# Fine-Tuned Open-Source Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the complete substantive article at `/fine-tuned-open-source-models/` in the personal site's visual language, with local figures, no booking calls to action, no source attribution, and no em dash characters.

**Architecture:** Keep the site framework-free. The new route is a self-contained HTML document with embedded CSS and local PNG captures of the nine source figures. The existing home page gets one direct article link, and a shell validation script checks the route, required content, exclusions, links, figure assets, and forbidden punctuation.

**Tech Stack:** Static HTML and CSS, POSIX shell validation, Python local HTTP server, Playwright with system Chrome for source figure capture and visual verification.

---

### Task 1: Add a failing article-page contract

**Files:**
- Create: `scripts/check-article-page.sh`

- [ ] **Step 1: Add the executable validation script**

The script must assert that the new page and all nine local figure files exist; that the title, all six article parts, appendix, sources, author names, and home navigation are present; that the homepage links to the route; and that no em dash, booking copy, or Fermisense attribution is present.

- [ ] **Step 2: Run the script before implementation**

Run: `sh scripts/check-article-page.sh`

Expected: failure because `fine-tuned-open-source-models/index.html` does not exist.

### Task 2: Capture local figure assets

**Files:**
- Create: `fine-tuned-open-source-models/assets/fig-hero.png`
- Create: `fine-tuned-open-source-models/assets/fig-divide.png`
- Create: `fine-tuned-open-source-models/assets/fig-grpo.png`
- Create: `fine-tuned-open-source-models/assets/fig-bankruptcy.png`
- Create: `fine-tuned-open-source-models/assets/fig-episode.png`
- Create: `fine-tuned-open-source-models/assets/fig-twin.png`
- Create: `fine-tuned-open-source-models/assets/fig-plateau.png`
- Create: `fine-tuned-open-source-models/assets/fig-training.png`
- Create: `fine-tuned-open-source-models/assets/fig-quadrant.png`

- [ ] **Step 1: Capture each source figure at desktop width**

Use Playwright with `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, a 1440 pixel viewport, and a device scale factor of 2. Load the source article, disable transitions and animations, force `.reveal` elements visible, and capture each `#fig-*` element listed above.

- [ ] **Step 2: Verify the assets**

Run: `file fine-tuned-open-source-models/assets/*.png`

Expected: nine valid PNG images with nonzero dimensions.

### Task 3: Build the article page

**Files:**
- Create: `fine-tuned-open-source-models/index.html`

- [ ] **Step 1: Add the document shell and native site styles**

Use the existing site's monospace stack, `#222` text, white background, gray metadata, thin gray rules, and compact link treatment. Keep prose at 660 pixels, allow article figures to expand to 980 pixels, add visible focus states, and use horizontal overflow wrappers for tables.

- [ ] **Step 2: Add the complete substantive article**

Preserve the source title, subtitle, July 27, 2026 date, five published authors, Parts I through VI, TL;DR, case study, checklist, appendix, and sources. Preserve citation destinations. Replace each source figure with its matching local PNG, use the source figure's accessible label or title as alternative text, and retain the original figure title and caption as HTML text.

- [ ] **Step 3: Remove promotional and forbidden content**

Remove the inline 30-minute audit link and the entire booking panel. Retain the Hugging Face model link as a plain informational sentence. Do not add a source-site attribution. Replace every em dash with a comma, colon, semicolon, parentheses, or a normal hyphen according to the sentence.

- [ ] **Step 4: Add article navigation**

Add `← back to home` links at the start and end using `../` so the route works both locally and when deployed as a directory.

### Task 4: Add the homepage entry

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add the article under thoughts**

Insert a direct link to `fine-tuned-open-source-models/` before the existing thought entries, labeled `The Rise of Intelligence Ownership - july 2026`, with a short one-sentence description in the same compact style.

- [ ] **Step 2: Run the contract**

Run: `sh scripts/check-article-page.sh`

Expected: all checks pass.

### Task 5: Browser verification

**Files:**
- Verify: `index.html`
- Verify: `fine-tuned-open-source-models/index.html`

- [ ] **Step 1: Start the static server**

Run: `python3 -m http.server 4173`

Expected: the server listens on `http://127.0.0.1:4173`.

- [ ] **Step 2: Verify navigation and browser errors**

Open the home page and article route in system Chrome through Playwright. Confirm the home link reaches the article, both back links resolve to the home page, all figure images load, and the browser console reports no page errors.

- [ ] **Step 3: Capture responsive previews**

Capture full-page screenshots at 1440 by 1000 and 390 by 844. Inspect the article header, representative figures, appendix table, source notes, and page ending for overflow or clipping.

- [ ] **Step 4: Run final checks**

Run: `sh scripts/check-article-page.sh && git diff --check`

Expected: all checks pass and Git reports no whitespace errors.
