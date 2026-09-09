# Platform patterns

Read the section matching the product surface being designed.

## Websites and landing pages

- Give each section one job and maintain a clear narrative from promise to proof to action.
- Make the opening state communicate audience, outcome, and next action without vague slogans.
- Use proof appropriate to the claim: results, customer evidence, process, credentials, product screens, or guarantees.
- Vary composition deliberately while maintaining grid alignment; do not repeat identical feature-card rows for the entire page.
- Keep calls to action specific and consistent. Use a secondary action only when it supports a genuinely different user intent.
- Optimize for reading and conversion on mobile; do not rely on hover to reveal essential information.

## SaaS dashboards and CRMs

- Lead with decisions and work queues rather than vanity metrics.
- Keep global navigation, page navigation, filtering, and row actions visually distinct.
- Make status, ownership, last activity, and next action easy to scan.
- Use cards for bounded groups, not as the default wrapper for every label and value.
- Keep filters discoverable and show active-filter state. Provide a clear reset path.
- Support table density, sorting, pagination or virtualization, column priority, empty states, and bulk-action feedback.
- Keep important actions near the object they affect and confirm destructive or irreversible operations.

## Forms and workflows

- Group fields by user intent and ask only for information needed at that stage.
- Use persistent visible labels, appropriate input types, examples only where helpful, and inline error recovery.
- Prefer one column for complex forms. Use columns only for short, strongly related fields.
- Indicate progress when a workflow spans meaningful stages; do not create artificial steps for a short form.
- Preserve entered data after recoverable errors.
- Explain why sensitive information is needed at the moment it is requested.

## Mobile applications

- Design for thumb reach, interrupted attention, on-screen keyboards, safe areas, and variable device heights.
- Keep each screen focused. Reveal secondary controls through clear drill-down or contextual menus.
- Use platform conventions for navigation and system behaviors unless the product has a strong reason not to.
- Avoid tiny icon-only actions and crowded header bars.
- Account for offline, retry, permissions, notifications, and background state where relevant.
- Verify with long labels, larger text settings, keyboard-open states, and both short and tall screens.

## Responsive data presentation

Choose a strategy explicitly:

- keep a horizontally scrollable table when column comparison is essential;
- prioritize essential columns and expose the rest in row detail;
- convert records into structured stacked rows when cross-row comparison is secondary;
- use summary cards plus drill-down when users need monitoring more than raw data.

Do not convert every table to unrelated cards without considering comparison and scan speed.

## Navigation

- Use top navigation for a small set of broad destinations.
- Use a sidebar for many persistent product destinations and nested operational areas.
- Use tabs for peer views of the same object, not unrelated pages.
- Use breadcrumbs where hierarchy matters and users can arrive deep-linked.
- Use bottom navigation on mobile for a small number of frequent top-level destinations.
- Preserve clear current-location state at every viewport.
