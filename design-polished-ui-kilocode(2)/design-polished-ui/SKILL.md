---
name: design-polished-ui
description: Create, implement, review, and improve polished UI/UX for websites, landing pages, SaaS products, dashboards, CRMs, portals, and mobile applications. Use when Codex must design a new interface, translate product requirements or references into frontend code, choose a visual direction for an industry and audience, establish or extend a design system, make an interface responsive and accessible, critique screenshots or existing UI code, or fix weak hierarchy, spacing, typography, color, navigation, states, usability, and visual consistency.
---

# Design Polished UI

Create interfaces that feel specific to the product rather than assembled from a generic template. Adapt the visual language to the industry, audience, brand, platform, task frequency, and information density. Make the result usable, responsive, accessible, and production-ready—not only attractive.

## Choose the task path

- **Create:** Derive the product structure and visual system, then implement the complete interface.
- **Review:** Inspect the running UI, screenshots, and relevant source. Return prioritized, evidence-based findings using [references/review-rubric.md](references/review-rubric.md).
- **Improve:** Preserve working behavior, fix the highest-impact UX and visual problems, and verify the changed interface at representative viewports.

For review-only requests, do not edit files unless the user also asks for implementation.

## Follow the design workflow

### 1. Understand the product before styling

Determine from the request and codebase:

- product type, industry, audience, and primary user job;
- platform and expected input method;
- brand constraints and desired emotional qualities;
- core conversion or completion action;
- content density, usage frequency, and trust requirements;
- existing component library, tokens, routes, data, and frontend conventions.

Infer sensible defaults when the context is sufficient. Ask one focused question only when the missing answer would materially change the result. Never stall on minor aesthetic preferences.

### 2. Select a deliberate visual direction

Read [references/style-selection.md](references/style-selection.md) when choosing or changing the visual style. State the intended direction internally in one sentence, for example: “A calm, high-trust clinical portal with compact operational surfaces and warm human imagery.”

Choose a coherent position on these axes:

- restrained ↔ expressive;
- dense ↔ spacious;
- institutional ↔ approachable;
- editorial ↔ product-led;
- angular ↔ soft;
- monochrome ↔ color-forward.

Do not apply an industry stereotype blindly. The product’s audience, task, and brand override the category default.

### 3. Establish or extend the design system

Use the project’s existing system when one exists. Otherwise define a compact token set before building many components:

- color roles: canvas, surface, elevated surface, text, muted text, border, accent, semantic states;
- typography: display, heading, body, label, caption, numeric/data treatment;
- spacing scale based mainly on 4px increments;
- radii, borders, shadows, motion, content widths, and breakpoints;
- component states: default, hover, focus, active, selected, disabled, loading, error, and empty.

Use CSS variables or the framework’s theme tokens. Prefer a small, repeatable system over one-off values. Use at most two type families unless the brand already requires more.

### 4. Design the information architecture and states

Place the primary task and next action where users naturally scan. Group by meaning, not merely by matching card shapes. Reduce cognitive load through progressive disclosure.

Cover the complete experience:

- navigation and current-location cues;
- page title, context, and primary action;
- realistic content and meaningful labels;
- empty, loading, error, success, disabled, and permission states;
- validation and recovery guidance;
- long text, large numbers, narrow screens, and dense data.

For platform-specific patterns, read [references/platform-patterns.md](references/platform-patterns.md).

### 5. Implement with the existing stack

- Preserve the repository’s framework, package manager, component library, architecture, and conventions.
- Inspect installed dependencies before recommending new ones. Do not add a package when the existing stack or a small native implementation already solves the need well.
- Reuse and extend existing components before introducing parallel versions.
- Use semantic HTML and native controls when possible.
- Keep presentation components reusable without over-abstracting a one-off composition.
- Preserve working business logic and unrelated behavior during UI improvements.
- Use a consistent icon family already present in the project. Do not use emoji as interface icons unless the product language explicitly calls for it.
- Use real or representative content; avoid lorem ipsum when product copy can be inferred.
- Add imagery only when it advances comprehension, trust, or emotional direction. Do not use decorative imagery to hide weak layout.

### 6. Make responsiveness intentional

Design by content pressure, not device labels alone. Verify at least one narrow mobile width, one intermediate width, and one desktop width.

- Avoid horizontal page overflow, clipped text, overlapping controls, and unreachable actions.
- Convert desktop navigation to an appropriate mobile pattern.
- Recompose layouts instead of merely shrinking them.
- Keep touch targets comfortable and separate destructive actions.
- Give tables an explicit narrow-screen strategy: priority columns, stacked rows, controlled scroll, or drill-down.
- Keep forms readable with visible labels; do not rely on placeholder-only labeling.

### 7. Meet accessibility basics

- Maintain readable contrast and do not encode meaning by color alone.
- Provide visible keyboard focus and logical tab order.
- Label controls and icon-only actions accessibly.
- Associate errors and guidance with their fields.
- Respect reduced-motion preferences and avoid motion that blocks task completion.
- Preserve zoom, text reflow, and screen-reader-friendly reading order.

### 8. Render, inspect, and refine

When tools permit, run the app and inspect the result visually. Do not declare a UI finished from source code alone.

Check:

- intended visual hierarchy within the first few seconds;
- alignment, rhythm, optical balance, and text wrapping;
- responsive behavior at representative widths;
- interactive states and keyboard navigation;
- content extremes, empty/loading/error states, and console errors;
- consistency with the chosen direction and existing brand.

Iterate on visible defects, then run the project’s relevant tests, lint, or build checks in proportion to the change.

## Avoid generic AI design habits

Unless context clearly justifies them, avoid:

- gradient-heavy purple/blue palettes, excessive glow, and decorative glassmorphism;
- a card around every piece of content;
- excessive pills, oversized radii, and identical rounded rectangles;
- enormous hero text that pushes the actual product below the fold;
- arbitrary floating shapes, sparkles, and meaningless charts;
- low-contrast gray text, hairline controls, and weak focus states;
- multiple competing accent colors or inconsistent icon styles;
- excessive empty space in operational products;
- animation on every element or long staggered entrances;
- copying a reference so literally that the product loses its own identity.

Use strong hierarchy, composition, typography, and content before decoration.

## Review and improvement output

When reviewing, organize findings by severity and impact:

1. blockers affecting task completion, access, or responsive use;
2. high-impact navigation, hierarchy, readability, and state problems;
3. consistency and polish problems;
4. optional enhancements.

For each significant finding, identify the location, explain the user impact, and propose a concrete fix. Distinguish observed evidence from inference. When implementing improvements, prioritize root causes such as missing tokens or faulty layout primitives over scattered cosmetic patches.

## Definition of done

Finish only when the result:

- communicates a coherent style appropriate to its product and audience;
- makes the primary task obvious and efficient;
- works at representative mobile, tablet/intermediate, and desktop widths;
- includes meaningful interaction and system states;
- satisfies the accessibility basics above;
- contains no visible overlap, clipping, accidental overflow, or placeholder residue;
- reuses a consistent token and component system;
- passes relevant available checks and has been visually inspected when possible.
