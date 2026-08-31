KILOCODE UI-ONLY IMPLEMENTATION RULES

Use the design-polished-ui references in this folder as the design authority.

IMPORTANT SCOPE:
- Change ONLY the visual/UI layer.
- DO NOT change application flow, business logic, API behavior, database logic, authentication, routing behavior, state-management behavior, or data-processing logic.
- DO NOT rename routes, endpoints, components, props, API fields, database fields, or existing functional actions unless absolutely required only for presentation.
- Preserve all existing functionality exactly as it currently works.
- Do not remove existing features.

TASK:
1. Inspect the existing project before editing.
2. Identify the existing design system, CSS/Tailwind/theme tokens, reusable components, layout primitives, and icon system.
3. Apply the rules in SKILL.md and references/ to the existing pages.
4. Improve ONLY:
   - typography and hierarchy
   - spacing and alignment
   - colors and contrast
   - borders, radii, shadows
   - buttons, inputs, tables, cards, tabs, navigation styling
   - responsive layout/presentation
   - loading, empty, error, disabled and focus visual states
   - visual consistency across pages
5. Reuse the existing component architecture and dependencies whenever possible.
6. Do not introduce a new UI framework unless the project already uses it.
7. Do not add decorative effects just for appearance. Prioritize a polished, professional SaaS/product UI.
8. Preserve all existing text/data unless a wording change is strictly needed for UI clarity.
9. Make the UI responsive for mobile, tablet and desktop.
10. Ensure keyboard focus, contrast, labels and touch targets remain accessible.
11. After changes, run the existing lint/build/tests if available and fix only issues caused by the UI changes.

DESIGN DIRECTION:
Professional, modern, clean, high-trust SaaS/product interface. Use restrained color, strong hierarchy, consistent spacing, readable typography, clear states, and purposeful surfaces. Avoid excessive gradients, glassmorphism, huge rounded cards, excessive pills, glow effects, meaningless animation, and low-contrast text.

FINAL CHECK:
Before finishing, verify that the application's FLOW is unchanged. The user should be able to perform the same actions in the same way; only the appearance and responsive presentation should be improved.
