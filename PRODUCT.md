# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Fabian's peers, potential collaborators, and readers visit the site to understand his current focus, background, writing, and public profiles.

## Product Purpose

The site is a concise personal homepage. Success means a visitor can quickly understand who Fabian is, what he is doing, and which longer-form thoughts they can read.

## Positioning

The homepage combines intentionally sparse personal writing with one memorable interactive visual system rather than behaving like a conventional portfolio or résumé template.

## Operating Context

Visitors read a single long-scrolling page on desktop or mobile, use the fixed section navigation, follow article and profile links, and may activate the portrait voice agent.

## Capabilities and Constraints

- The production homepage at `/` must remain independent from experimental variants.
- The experimental route is plain HTML, CSS, and JavaScript with no required build step.
- Existing copy, links, semantic structure, and the portrait voice-agent interaction remain unchanged.
- Decorative rendering must never intercept pointer or keyboard input.
- The experience needs bounded desktop and mobile GPU budgets, a non-WebGL fallback, and reduced-motion behavior.

## Brand Commitments

Fabian's name, direct lowercase section labels, compact monospace typography, and quiet editorial structure are established. For the experimental route, the user explicitly selected the monochrome particle-ocean language of the vGPU FFT ocean example as the binding motion reference.

## Evidence on Hand

- Homepage content and navigation: `index.html`
- Experimental route: `water/index.html`
- Portrait interaction: inline homepage canvas code and `assets/homepage-navigation.js`
- Public profile and article links embedded in the page

No testimonials, commercial claims, customer logos, or performance claims should be invented.

## Product Principles

- Content remains legible and useful before spectacle.
- One authored interactive moment is more valuable than scattered decoration.
- Experimental visuals must feel native to the sparse personal site.
- Motion stays responsive, reversible, and considerate of constrained devices.

