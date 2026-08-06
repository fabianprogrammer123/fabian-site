# Fine-Tuned Open-Source Models Article Page

## Goal

Publish the Fermisense article "The Rise of Intelligence Ownership" as a native long-form article on Fabian Hildesheim's personal website.

## Route and navigation

- Publish the article at `/fine-tuned-open-source-models/`.
- Add a link to the article near the top of the `thoughts` section on the home page.
- Include a small `back to home` link at the top and bottom of the article page.

## Content

- Preserve the complete substantive article, figures, citations, source notes, and appendix.
- Preserve the published title, subtitle, date, and author list: Justinas Zaliaduonis, Joris Zilinskis, Fabian Hildesheim, Joel Hainzl, and Gediminas Pazera.
- Exclude all booking, sales, and lead-generation calls to action.
- Do not include an "originally published" attribution or similar source-site attribution.
- Do not include em dash characters. Rephrase or replace them without changing meaning.
- Host article visuals locally so the page does not depend on Fermisense for its core presentation.

## Visual design

The page extends the current site's restrained, monochrome, monospace language. The article uses the same white background, dark text, understated gray metadata, and thin rules. It widens the reading canvas only where the article needs room for charts, diagrams, and tables.

The page has three layout modes:

- Body copy stays in a narrow, readable column.
- Figures may use the full article width.
- Dense tables become horizontally scrollable on small screens.

Article parts use small utility labels and simple rules to encode the source structure. The charts and diagrams provide the only strong color, so no additional decorative palette or animation is introduced.

## Responsive and accessible behavior

- The page must remain usable on narrow mobile screens.
- Images and diagrams scale to their containers.
- Tables scroll rather than shrink into unreadable text.
- All informative visuals have useful alternative text or adjacent explanatory captions.
- Links and navigation expose visible keyboard focus.
- External links use normal browser behavior and remain distinguishable without relying on color alone.

## Implementation

- Keep the site framework-free and deployable as static files.
- Create `fine-tuned-open-source-models/index.html` and a local assets directory for article visuals.
- Reuse the site's existing CSS values while adding article-specific layout rules inside the new page.
- Update `index.html` only as needed to add the article link.

## Verification

- Confirm the route works from a local static server.
- Confirm the home-page link reaches the article and both back links return home.
- Compare the rendered article against the source for section order, paragraphs, figures, citations, appendix, and author metadata.
- Search the new and edited files for em dash characters.
- Inspect desktop and mobile screenshots for overflow, clipped figures, and unreadable tables.
