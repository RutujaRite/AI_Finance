# UI/UX review rubric

Use this rubric for structured reviews and improvement decisions. Inspect both the rendered interface and relevant implementation when available.

## Severity levels

- **Blocker:** Prevents completion, access, comprehension, or use at an important viewport.
- **High:** Creates substantial friction, mistakes, mistrust, or abandonment.
- **Medium:** Weakens clarity, consistency, efficiency, or accessibility without blocking the core task.
- **Low:** Polish opportunity with limited user impact.

## Review dimensions

Score each relevant dimension from 1 to 5 only when a score helps comparison. Explain the evidence behind low scores.

| Dimension | Inspect | Strong result |
|---|---|---|
| Product fit | Audience, industry, task, brand, tone | The visual direction feels credible and specific to the product |
| Information architecture | Grouping, labels, navigation, findability | Users can predict where information and actions live |
| Task flow | Steps, decisions, forms, recovery | The primary job is obvious, efficient, and recoverable |
| Visual hierarchy | Titles, actions, emphasis, scan order | Attention lands on the right information in the right order |
| Typography | Scale, measure, weight, line height, numerals | Text is readable, distinct by role, and stable across widths |
| Layout and spacing | Grid, alignment, density, whitespace, rhythm | Spacing communicates grouping and produces optical balance |
| Color and contrast | Roles, semantic meaning, state distinction | Color supports hierarchy and remains accessible |
| Components and states | Consistency, affordance, feedback, edge states | Controls behave predictably in all meaningful states |
| Responsive behavior | Reflow, touch, overflow, navigation, tables | Each target width feels intentionally composed |
| Accessibility | Keyboard, focus, labels, errors, motion, reading order | Core flows are perceivable and operable without a mouse |
| Content quality | Clarity, specificity, empty/error copy, trust | Copy helps users decide and recover without ambiguity |
| Perceived quality | Consistency, detail, performance signals | The interface feels deliberate, stable, and trustworthy |

## Evidence gathering

- Identify the exact page, component, viewport, and state.
- Reproduce issues where possible instead of inferring only from source.
- Check narrow and wide widths, keyboard navigation, long content, empty data, loading, and errors.
- Inspect whether repeated defects share a root cause in tokens, primitives, or information architecture.
- Distinguish visual taste from measurable usability or consistency problems.

## Finding format

For each material finding include:

1. **Severity and location**
2. **Observed issue**
3. **User impact**
4. **Concrete recommendation**
5. **Evidence or verification method**

Keep minor polish items grouped. Do not bury blockers in a long undifferentiated checklist.

## Improvement priority

Fix in this order unless product risk dictates otherwise:

1. broken flows, inaccessible controls, lost data, overflow, and destructive ambiguity;
2. navigation, hierarchy, forms, responsive structure, and missing system states;
3. typography, spacing, component consistency, and content clarity;
4. decorative refinement and optional motion.

After changes, repeat the relevant checks and compare the same viewports and states.
