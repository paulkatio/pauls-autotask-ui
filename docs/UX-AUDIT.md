# UX/UI X-Audit — Befundliste

> Maschinell exportiert aus Workflow-Lauf `wf_bd12509f-3ea` (statischer Audit
> gegen die Design-Verfassung). Arbeitscheckliste: pro Commit abhaken. Quelle der
> Priorisierung/Themen: Synthese unten.

**Summe:** 222 verifizierte Befunde — 0 Blocker · 25 High · 97 Medium · 83 Low · 17 Nit (über 12 Bereiche).

## Zusammenfassung

The app is in solid shape: it is genuinely composed from shadcn/ui primitives, semantic tokens drive light/dark mode, the responsive card-to-table list pattern exists everywhere, and empty/loading/error states are mostly handled by shared components. There are no broken layouts or hard failures in the findings. The gap to "everywhere perfect" is almost entirely consistency drift, not bugs. The same correct ideas were implemented slightly differently each time, so the app reads as well-built-but-not-quite-uniform. Three systemic root causes account for the large majority of the 150+ findings: (1) the base SelectTrigger ships a desktop height (sm:h-8/sm:h-7) that does NOT match the toolbar standard (sm:h-9), forcing dozens of call sites into ad-hoc h-11 sm:h-9 / sm:h-9! overrides and producing a scatter of 28/32/36px control heights; (2) the responsive breakpoint for switching mobile cards to desktop tables is xl (1280px) in the shared SearchableTable and every list except tickets-list (lg, 1024px) and project detail panels (md, 768px), plus skeletons defaulting to md — creating dead bands where one page shows a table and the page next to it still shows cards at the same width; (3) single-source-of-truth is bypassed in several leaf components (StatusDot hex colors, hand-rolled badge logic, raw <a>/<button>/<input> markup, bespoke page headers and empty/error blocks). None of these threaten function, but together they keep the UI from feeling machine-consistent. The highest-leverage move is to fix the shared primitives once (Select height, skeleton breakpoint default, Empty padding) so most per-area overrides simply disappear, then sweep the remaining off-system markup.

### Systemische Themen (höchste Hebelwirkung)

1. **SelectTrigger base height is wrong, so the whole app fights it with ad-hoc overrides**
   - Warum: components/ui/select.tsx defines data-[size=default]:h-11 sm:data-[size=default]:h-8 (and h-7 for size=sm), but the established toolbar baseline is h-11 sm:h-9 (Input in searchable-table.tsx). Because the primitive disagrees with the standard, filter selects across companies-table, projects-list, resource-filter, grouped-list, period-select must add sm:h-9! (with !important) just to line up with the search input next to them — a textbook code smell repeated in 5+ files. The same root cause spreads further into buttons/tabs that copied the pattern, yielding three desktop heights in the wild: 28px (h-7), 32px (h-8), 36px (h-9). Fixing the primitive to sm:h-9 (or wiring a real size prop) deletes every override at once and makes toolbars align everywhere.
   - Betrifft: components/ui/select.tsx (root), companies-table.tsx, projects-list.tsx, tickets/resource-filter.tsx, vertrieb/grouped-list.tsx + period-select.tsx, dashboard/open-tickets.tsx, time/range-toggle.tsx, all Tabs (ticket-detail, project-tabs, vertrieb-tabs, url-tabs), meta-edit/attachment-upload buttons
2. **Inconsistent card-to-table breakpoint creates same-width layout discontinuities between sibling pages**
   - Warum: Verified: searchable-table.tsx, companies-table.tsx, contacts-table.tsx, projects-list.tsx all toggle at xl (xl:hidden / hidden xl:block = 1280px), but tickets-list.tsx toggles at lg (lg:hidden / lg:block = 1024px) and project detail panels toggle at md (768px). The result is a 256px dead band (1024-1280px) where Meine Tickets shows a full table while Firmen/Kontakte/Projekte still show 2-column cards — directly visible when navigating, and exactly the kind of inconsistency the design constitution forbids. Compounded by TableSkeleton/FiltersSkeleton defaulting to breakpoint='md' and a grid layout, so the loading state doesn't mirror the real xl flex-wrap layout, causing hydration jank. Standardize on one breakpoint (xl) and make it the skeleton default.
   - Betrifft: components/tickets/tickets-list.tsx (lg→xl), components/projects/project-phases-panel.tsx + project-tasks-panel.tsx (md→xl), components/skeletons.tsx (default md→xl, grid→flex-wrap), dashboard/open-tickets.tsx (inherits tickets-list)
3. **Single-source-of-truth bypassed: raw markup and inline colors instead of shared components/mappers**
   - Warum: Several leaf components reinvent things the system already provides, which breaks dark mode and maintenance. Verified StatusDot (status-indicator.tsx) applies an inline hex backgroundColor from statusColor() — these are fixed hex values that do NOT adapt to dark mode, unlike every Badge which uses semantic variants. Beyond that: ContractsPanel and PriorityBadge hand-roll badge logic instead of contractStatusVariant()/priorityVariant() in mappers.ts; contact-modal uses raw <a> for tel/mailto, command-palette uses raw <input> and <button>, result-column uses raw 'Mehr laden' <button> and plain-text empty/loading — all violations of the 'every visible element is a real shadcn component' rule. Error states fork three ways (raw Alert+title+icon, Alert+description-only, DataError). Funnel each back to the canonical source.
   - Betrifft: components/status-indicator.tsx + lib/autotask/mappers.ts (statusColor hex), priority-indicator.tsx, companies/kundenakte-panels.tsx, contacts/contact-modal.tsx, search/result-column.tsx + command-palette.tsx, data-error.tsx vs page.tsx/open-tickets.tsx
4. **Bespoke page headers, search inputs, and section gaps diverge from the established standards**
   - Warum: PageHeader exists and is used by all list pages, but company-detail-content, project-detail-content, and ticket-detail hand-roll equivalent header layouts with differing gaps (gap-2 vs PageHeader gap-1/sm:gap-4) and title sizes (ticket detail shrinks to text-xl on mobile). Search inputs are non-responsive and three different sizes: SearchableTable h-11 sm:h-9 (correct), SearchBox h-12, CommandPalette h-14 — so users meet three visually distinct search boxes. Section spacing should be gap-6 everywhere but vertrieb detail pages use gap-4. Count badges fork between chart-2 tint (PageHeader, OpenTickets) and secondary gray (companies-table, kundenakte). These are small individually but collectively erode the uniform feel.
   - Betrifft: page-header.tsx vs company/project/ticket detail headers, search/search-box.tsx (h-12) + command-palette.tsx (h-14) vs searchable-table.tsx, vertrieb/rechnungen/[id]/page.tsx (gap-4), page-header.tsx vs companies-table count badge color
5. **Filter toolbar counter/status text has no height, breaking vertical alignment in every list**
   - Warum: The 'X von Y' / 'X Kontakte' counter span in filter toolbars (companies-table, contacts-table, tickets-list) is text-sm with no height constraint, so it sits at line-height (~20px) next to h-11/sm:h-9 controls (44/36px) in the same flex row, leaving it visibly misaligned. Because it's the same pattern copied across lists, one fix (give the counter a matching height / self-center / h-9 inline-flex) cleans up all of them and is risk-free.
   - Betrifft: components/companies/companies-table.tsx, components/contacts/contacts-table.tsx, components/tickets/tickets-list.tsx toolbars
6. **Mobile touch-target rule (44px) leaks both ways: undersized desktop-only controls and missing heights on key buttons**
   - Warum: The h-11-on-mobile rule is applied inconsistently. Some controls are too SMALL on mobile (login page Microsoft button has no responsive sizing, mock-mode buttons default to h-8, no-access logout defaults to h-8, header-autotask-link is h-9 md:hidden, theme-toggle size=icon is h-8) — below the 44px minimum the project mandates. Others overshoot on desktop (range-toggle h-11 sm:h-7 = 28px, mock-user-switcher h-11 sm:h-7, open-tickets filter buttons h-11 sm:h-7). The inversion (taller mobile shrinking to a too-small desktop h-7) is the recurring shape. A single audit pass to the h-11 sm:h-9 standard resolves the family.
   - Betrifft: app/login/page.tsx, app/no-access/page.tsx, components/header-autotask-link.tsx, components/theme-toggle.tsx, components/mock-user-switcher.tsx, components/time/range-toggle.tsx, dashboard/open-tickets.tsx

### Quick Wins

- **c:\dev\pauls-autotask-ui\components\ui\select.tsx** — Change the SelectTrigger base height from sm:data-[size=default]:h-8 to sm:data-[size=default]:h-9 (and the size=sm variant from sm:h-7 to sm:h-8) so it matches the h-11 sm:h-9 toolbar baseline. This single primitive fix lets you delete every sm:h-9! override in companies-table, projects-list, resource-filter, grouped-list, and period-select, and aligns all filter selects with their adjacent search inputs.
- **c:\dev\pauls-autotask-ui\components\tickets\tickets-list.tsx** — Replace lg:hidden / lg:block with xl:hidden / xl:block (lines ~727, 742, 747) and add md:grid-cols-2 to the mobile card grid, matching searchable-table.tsx / companies-table.tsx. Removes the 1024-1280px dead band where tickets show a table while every sibling list still shows cards.
- **c:\dev\pauls-autotask-ui\components\skeletons.tsx** — Change TableSkeleton's default breakpoint from 'md' to 'xl' so it matches the actual majority usage, and switch FiltersSkeleton from a grid layout to flex flex-wrap items-center gap-2 to mirror the real toolbars. Eliminates load-time layout jump and the skeleton/content mismatch.
- **c:\dev\pauls-autotask-ui\components\status-indicator.tsx** — Stop applying inline hex from statusColor(); render StatusDot via semantic token classes (e.g. a small set of bg-* utility/token classes mapped per status) so the dot adapts to dark mode like every Badge. Touches lib/autotask/mappers.ts statusColor() too.
- **c:\dev\pauls-autotask-ui\components\time\range-toggle.tsx** — Change the toggle buttons from h-11 sm:h-7 (28px desktop) to h-11 sm:h-9 to match the toolbar baseline; apply the identical change to components/mock-user-switcher.tsx and the two filter buttons in components/dashboard/open-tickets.tsx.
- **c:\dev\pauls-autotask-ui\components\companies\companies-table.tsx** — Give the toolbar counter span ('X von Y') an aligned height (e.g. inline-flex items-center h-9 sm:self-center) and change the outer toolbar gap from gap-4 to gap-3 to match SearchableTable. Apply the same counter fix to contacts-table.tsx and tickets-list.tsx.
- **c:\dev\pauls-autotask-ui\components\companies\kundenakte-panels.tsx** — Replace the hardcoded ContractsPanel status badge logic (status===1/0 inline) with contractStatusVariant() from lib/autotask/mappers.ts, matching how the invoice and quote panels already delegate to their mappers.
- **c:\dev\pauls-autotask-ui\components\search\search-box.tsx** — Change the fixed h-12 to h-11 sm:h-9, and in command-palette.tsx change the input from h-14 to h-11 sm:h-9 (and make it the shadcn Input), so all three search surfaces share one height.
- **c:\dev\pauls-autotask-ui\app\(app)\vertrieb\rechnungen\[id]\page.tsx** — Change the detail page wrapper from flex flex-col gap-4 to gap-6 to match every other detail page (company/project/ticket); apply the same gap-6 to the Angebote and Verträge detail pages.
- **c:\dev\pauls-autotask-ui\app\login\page.tsx** — Add explicit responsive heights: change the Microsoft button from h-12 to h-11 sm:h-9 and give the mock-mode buttons h-11 sm:h-9 instead of the default h-8, so mobile touch targets meet the 44px minimum. Also give app/no-access/page.tsx Abmelden button and components/header-autotask-link.tsx the h-11 mobile size.

## Befunde nach Bereich

### Dashboard (app/(app)/page.tsx + components/dashboard/*)

_12 Befunde — 0 High · 3 Medium · 7 Low · 2 Nit_

- [ ] **[MEDIUM]** KPI grid uses lg breakpoint instead of consistent xl grid column step  `responsive` · _768, 1024, 1280_
  - Datei: `app/(app)/page.tsx` · line 145 (KPI grid)
  - Problem: The KPI card grid uses 'grid-cols-2 gap-4 lg:grid-cols-4' but at a 1280px viewport (start of xl), only 2 KPI cards fit per row initially, then jump to 4. This creates awkward spacing at 1024-1280px (lg to xl transition). At 768-1024px (md to lg), content may feel cramped with only 2 columns and 16px gap.
  - Fix: Consider if md:grid-cols-3 would be smoother (2→3→4 progression), or verify the design intent is truly 2→4 jump. Compare against KpiTilesSkeleton baseline and other grid patterns across the app to ensure consistency.
- [ ] **[MEDIUM]** Filter button heights do not match standard filter toolbar pattern  `alignment` · _sm and up_
  - Datei: `components/dashboard/open-tickets.tsx` · lines 90-107 (filter buttons)
  - Problem: The two filter buttons in OpenTickets use 'h-11 sm:h-7' but the SearchableTable baseline uses 'h-11 sm:h-9' for its search input and filters. This creates misalignment when these buttons sit in the same visual row as other UI elements. The buttons are 2px shorter on sm+ than expected by the design system.
  - Fix: Change 'h-11 sm:h-7' to 'h-11 sm:h-9' on lines 92 and 101 to match the documented pattern in SearchableTable, components/ui/select.tsx (SelectTrigger uses sm:data-[size=default]:h-8, but the search input baseline at line 127 searchable-table.tsx shows h-11 sm:h-9).
- [ ] **[MEDIUM]** View All button has inconsistent responsive height and width behavior  `spacing` · _320-639 (mobile), 640+ (sm)_
  - Datei: `components/dashboard/open-tickets.tsx` · line 145-163 (button for view all)
  - Problem: The 'Alle offenen Tickets anzeigen' button uses 'h-11 w-full sm:h-9 sm:w-auto sm:self-center'. On mobile it's full width and tall (h-11), then on sm+ it becomes auto-width and centered. This creates a layout shift: mobile is a full-width block, desktop becomes an inline, center-aligned element. While potentially intentional, the self-center only works inside a flex container.
  - Fix: Verify that the parent container (section.flex.flex-col.gap-4) properly constrains this. If centering on sm+ is intentional, document it. Otherwise, wrap in a centered flex container on sm+ to avoid relying on self-center.
- [ ] **[LOW]** KpiCard uses container queries but not fully mobile-optimized  `responsive` · _320_
  - Datei: `app/(app)/page.tsx` · line 58-82 (KpiCard component)
  - Problem: KpiCard uses @container queries to reflow based on card width, not viewport width. The layout switches at @min-[13rem]. On a 2-column mobile grid with 4px gap and p-4 padding, at 320px viewport each card is roughly 140px wide, so it stays in the narrow layout. This is correct. However, the icon placement (top-right) and label truncation should be verified at smallest viewport to ensure no overflow.
  - Fix: Test KPI cards at 320px width to ensure the layout doesn't overflow and truncation works correctly. The design appears sound, but container-query responsive behavior should be verified at the smallest breakpoint.
- [ ] **[LOW]** Mini bar chart uses inline style for width instead of potential Tailwind approach  `other` · _320-639 (mobile only)_
  - Datei: `components/dashboard/count-bar-chart.tsx` · line 155 (inline style in small view)
  - Problem: The progress bar in the small-screen list view uses `style={{ width: '${(d.count / maxCount) * 100}%' }}` for dynamic width. This is necessary since Tailwind can't handle dynamic percentage values. Not a violation, but an inline style in an otherwise Tailwind-heavy component.
  - Fix: No change needed; inline styles for dynamic percentages are standard. Documented in code comment already.
- [ ] **[LOW]** Chart uses matchMedia to toggle layout; breakpoint hardcoded to 1279px  `responsive` · _sm (640), xl (1280)_
  - Datei: `components/dashboard/count-bar-chart.tsx` · line 71, 83 (mobile toggle logic)
  - Problem: The chart uses window.matchMedia('(max-width: 1279px)') to switch between compact and full chart layouts. This is correct (matches Tailwind's xl breakpoint at 1280px). However, it's a client-side media query check separate from Tailwind classes. The small view uses matchMedia('(max-width: 639px)') for sm breakpoint. The values are hardcoded instead of importing from a config.
  - Fix: Consider exporting breakpoint values from a shared config (e.g., lib/breakpoints.ts) to keep matchMedia and Tailwind in sync. Currently hardcoded; acceptable but brittle if breakpoints change.
- [ ] **[LOW]** "Alle anzeigen" link uses inline className instead of shared action pattern  `component-sourcing` · _all_
  - Datei: `components/dashboard/my-projects-section.tsx` · line 33-38 (link styling)
  - Problem: The 'Alle anzeigen' link in MyProjectsSection uses inline 'text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm' styling. This is semantic-token based (correct), but other similar patterns in the app are often wrapped in component abstractions or consistent link styles. No shared LinkButton or ActionLink component is used here.
  - Fix: Create or use a consistent ActionLink/SecondaryLink component with this style, or document this as the canonical inline-link pattern for 'view all' actions. Currently it's ad-hoc styling.
- [ ] **[LOW]** OpenTickets section header does not match PageHeader pattern  `consistency` · _all_
  - Datei: `components/dashboard/open-tickets.tsx` · line 76-88 (section header)
  - Problem: The 'Offene Tickets' header is an h2 with 'text-lg font-semibold tracking-tight', while PageHeader uses h1 with 'text-2xl font-semibold tracking-tight'. The dashboard page itself uses PageHeader for 'Übersicht' (correct), but the OpenTickets sub-section rolls its own header. This is semantically correct (h2 for subsection) and typographically reasonable, but differs from any shared SectionHeader component.
  - Fix: Consider creating a SectionHeader component (h2 text-lg font-semibold tracking-tight) to match the dashboard's sub-sections and ensure cross-page consistency. Currently each manually defines the hierarchy.
- [ ] **[LOW]** Loading state uses opacity fade but loading skeleton is hidden  `state` · _all_
  - Datei: `components/dashboard/open-tickets.tsx` · line 118-140 (loading state fade)
  - Problem: When loading, the TicketsList div fades to opacity-60 with pointer-events-none. However, TicketsList itself (called with showFilters={false}) doesn't show a loading skeleton — it just shows the old data faded. This is intentional (no full-page re-render), but the UX is 'data dims and you wait'. No skeleton overlay is shown. This is acceptable for a quick refresh.
  - Fix: Document this pattern. If the fetch is long, consider showing a skeleton overlay inside the TicketsList or a progress indicator. Currently it's subtle, which may be intentional for quick updates.
- [ ] **[LOW]** TicketsList passed mobileLimit={8} but desktop table not limited  `consistency` · _mobile (< 1280px) vs. desktop (xl+)_
  - Datei: `components/dashboard/open-tickets.tsx` · line 127-139 (TicketsList config)
  - Problem: The OpenTickets component passes mobileLimit={8} to TicketsList, which limits the mobile card stack to 8 items before showing '+N more' overflow hint. On desktop (xl+), the full table shows all items on one page. This is intentional (mobile preview vs. desktop full view), but creates an asymmetry: mobile shows 8, desktop might show 10+. Worth noting.
  - Fix: This is intentional design. Document in comments that mobileLimit={8} is a deliberate preview limit, separate from the table pagination on desktop.
- [ ] **[NIT]** Dashboard page uses flex flex-col gap-6 via layout wrapper  `spacing` · _all_
  - Datei: `app/(app)/page.tsx` · line 139-144 (page wrapper spacing)
  - Problem: The dashboard content wraps in 'flex flex-col gap-6' (from the layout.tsx line 94). Each section (PageHeader, KPI grid, CountBarChart, MyProjectsSection, OpenTickets) is separated by gap-6 (1.5rem). This is consistent with the baseline and correct.
  - Fix: No change needed. Pattern is correct and consistent.
- [ ] **[NIT]** OpenTickets section has gap-4 but dashboard page uses gap-6  `spacing` · _all_
  - Datei: `components/dashboard/open-tickets.tsx` · line 76 (section wrapper)
  - Problem: The OpenTickets section wrapper uses 'flex flex-col gap-4' (line 76), while the page-level wrapper uses 'flex flex-col gap-6'. Internal section spacing is tighter than page-level spacing. This is acceptable (sub-sections are denser), but worth noting the hierarchy.
  - Fix: No change needed if intentional. The gap-4 vs. gap-6 hierarchy is reasonable: page sections are gap-6, internal sub-sections are gap-4. Document if needed.

### Ticket Lists (my/team/ball)

_32 Befunde — 0 High · 12 Medium · 20 Low · 0 Nit_

- [ ] **[MEDIUM]** Secondary section h2 undersized relative to PageHeader h1  `consistency` · _all_
  - Datei: `app/(app)/tickets/my/page.tsx` · lines 148-169
  - Problem: PageHeader h1: text-2xl (28px). Secondary h2: text-lg (18px). Gap is 10px, making secondary feel subordinate. Semantically correct (h1 > h2), but visual hierarchy may not reflect actual importance if secondary section is equally prominent.
  - Fix: Use text-xl for h2 (24px, closer to h1) or document the intentional de-emphasis. Alternatively, keep text-lg if secondary is truly secondary.
- [ ] **[MEDIUM]** Bulk bar layout mode switch at sm (640px) without intermediate state  `responsive` · _320, 640_
  - Datei: `components/tickets/bulk-bar.tsx` · lines 859-887
  - Problem: Mobile (< sm): Vertical flex-col with 'N Tickets ausgewählt' label + Actions button + X button. Desktop (sm+): Inline flex-row with label + inline controls (selects + buttons). Label uses `whitespace-nowrap`, risks overflow at 320px if N >= 100 (e.g., '100 Tickets ausgewählt' ~ 200px). At sm (640px), entire layout mode switches via isMobileBar hook (content replacement, not just CSS). No smooth transition.
  - Fix: Test label overflow at 320px with 2-3 digit counts. If overflow, allow `whitespace-normal` or abbreviate to 'N Tickets'. Verify smooth transition at 640px (no flash or layout jump).
- [ ] **[MEDIUM]** Bulk bar control widths inconsistent between mobile/desktop render paths  `alignment` · _640_
  - Datei: `components/tickets/bulk-bar.tsx` · lines 688-851
  - Problem: renderControls(stacked): mobile buttons `h-11 w-full`, desktop buttons `h-11 flex-1 sm:h-7 sm:flex-none`. Mobile selects `h-11 w-full`, desktop selects `w-40 shrink-0 sm:h-7 sm:w-auto sm:min-w-36`. Min-widths vary (select: no min-w on mobile; button: sm:min-w-36 on desktop). Layout can reflow when sheet closes and inline controls render.
  - Fix: Define consistent min-width baseline for all bulk controls. Test at 640px to ensure no visual jank during mode switch.
- [ ] **[MEDIUM]** isMobileBar threshold uses 640px (sm), potentially misaligned with other mobile-first logic  `responsive` · _640_
  - Datei: `components/tickets/bulk-bar.tsx` · lines 282-283
  - Problem: useIsMobile(640) switches between Actions-sheet (mobile) and inline controls (desktop) at exactly 640px (sm breakpoint). Most mobile-first patterns use sm as the transition, so this is consistent. However, if any page CSS uses md (768px) for layout changes, the bulk bar behavior may be unexpected. Acceptable but worth documenting the intended breakpoint.
  - Fix: Add comment: `// sm (640px) breakpoint: below = sheet mode, above = inline controls. Matches filter Tailwind classes.` to document intent.
- [ ] **[MEDIUM]** ResourceFilter sm:h-9! override suggests specificity conflict  `alignment` · _all_
  - Datei: `components/tickets/resource-filter.tsx` · line 62
  - Problem: SelectTrigger uses `sm:h-9!` (important flag) in ResourceFilter, while other filters use same. The ! indicates previous rule is being overridden. Base SelectTrigger (ui/select.tsx:44) specifies `sm:data-[size=default]:h-8`, so ! override forces h-9 instead. This works but is a code smell indicating the underlying component sizing doesn't match expectations.
  - Fix: Move h-9 logic into SelectTrigger as a size='filter' variant instead of overriding at call site. Eliminate ! usage.
- [ ] **[MEDIUM]** ResourceFilter label truncates without affordance  `alignment` · _320, 375, 414_
  - Datei: `components/tickets/resource-filter.tsx` · line 69
  - Problem: SelectTrigger label: `<span className="line-clamp-1 flex-1 text-left">{label}</span>`. At 320px with 'Mitarbeiter (23/30)', label truncates silently (line-clamp-1). No title attribute or ellipsis icon hints at truncation. User sees 'Mitarbeiter (2' — ambiguous state.
  - Fix: Add `title={label}` to span for hover tooltip, or show only numeric count '23/30' instead of full 'Mitarbeiter (23/30)'.
- [ ] **[MEDIUM]** Filter grid column thresholds unchecked from sm to 2xl  `responsive` · _768, 1024_
  - Datei: `components/tickets/tickets-list.tsx` · lines 567-572
  - Problem: Filter grid: `grid-cols-2 sm:grid-cols-4` (assignmentFilter=true) or `grid-cols-3` (default). At sm (640px+) jumps to 3-4 cols, then no further refinement through xl/2xl. At md (768px) and lg (1024px), 4-col grid may be too cramped or too sparse depending on content. No intermediate breakpoint (md/lg) to optimize column count.
  - Fix: Add explicit md/lg overrides: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4` or test actual rendering at 768/1024px to verify acceptable wrapping/spacing.
- [ ] **[MEDIUM]** Mobile card-to-table toggle at lg (1024px) creates visual discontinuity  `responsive` · _1024_
  - Datei: `components/tickets/tickets-list.tsx` · lines 727, 747
  - Problem: Cards: `grid grid-cols-1 gap-2 lg:hidden`. Table: `hidden overflow-x-auto rounded-lg border lg:block`. At lg (1024px), both toggle: cards disappear, table appears. No cross-fade/transition; visual weight (border vs internal gaps) differs. Perceived spacing shift due to page-level gap-6 vs card gap-2 internals.
  - Fix: Test visual continuity at exactly 1024px. Ensure table border visual weight + padding approximately match card container visual weight. Consider adding CSS transition or skeleton mask if flash is observable.
- [ ] **[MEDIUM]** Pager buttons scale aggressively: h-11 mobile to h-7 desktop  `alignment` · _640_
  - Datei: `components/tickets/tickets-list.tsx` · lines 819-838
  - Problem: Buttons: `className="h-11 flex-1 sm:h-7 sm:flex-none"`. Mobile: 44px (touch-friendly). Desktop (sm+): 28px (below 44px guideline, but acceptable for desktop). Jump at sm (640px) is large (44px → 28px = 16px shrink). Also changes from full-width flex-1 to flex-none, causing layout reflow.
  - Fix: Soften transition: `h-11 sm:h-9 md:h-8` or at least `h-11 sm:h-9` to reduce jarring size change.
- [ ] **[MEDIUM]** Filter SelectTrigger active state may conflict with dark mode  `color-token` · _all_
  - Datei: `components/tickets/tickets-list.tsx` · lines 581, 603, 633, 657
  - Problem: Filter chips use `chipState()` which returns `bg-secondary text-secondary-foreground` (active) or `border-input text-foreground` (inactive). SelectTrigger base has `dark:bg-input/30 dark:hover:bg-input/50` (ui/select.tsx:44). When chipState applies bg-secondary on dark mode, it may override or conflict with dark:bg-input, creating unclear contrast.
  - Fix: Verify dark mode rendering: active filter chip should clearly show bg-secondary (not input) with readable text. Add dark-mode explicit override in chipState if needed: `dark:bg-secondary dark:text-secondary-foreground` when active.
- [ ] **[MEDIUM]** Column visibility (2xl threshold for Company/Queue) hides info at xl (1280px)  `responsive` · _1280, 1536_
  - Datei: `components/tickets/tickets-list.tsx` · lines 364-366
  - Problem: hideSecondary = hidden 2xl:table-cell (Firma/Queue). hideAssignee = hidden xl:table-cell (Zugewiesen). At xl (1280px), user sees Zugewiesen but not Firma/Queue until 2xl (1536px). On a 1280-1535px laptop, Firma is missing, which may be important. No documented reason for this threshold choice.
  - Fix: Reconsider threshold: perhaps Firma should show at xl, Queue at 2xl. Or add inline column reordering so users can prioritize Firma if needed.
- [ ] **[MEDIUM]** Skeleton loading uses breakpoint='md' but list uses lg:hidden/lg:block  `state` · _768, 1024_
  - Datei: `components/tickets/tickets-list.tsx` · lines 727, 747
  - Problem: TableSkeleton called (implicitly or via TicketsList) may use breakpoint='md' (default), but list uses lg breakpoint for card/table toggle. Mismatch means skeleton doesn't mirror actual layout at md/lg boundaries.
  - Fix: Ensure any TableSkeleton used has breakpoint='lg' to match TicketsList's lg:hidden/lg:block thresholds. Verify skeleton and real layout align at 768px and 1024px.
- [ ] **[LOW]** Secondary TicketsList has searchMode='off' while main list uses searchMode='server'  `consistency` · _all_
  - Datei: `app/(app)/tickets/my/page.tsx` · line 163
  - Problem: Secondary list (line 166): `searchMode="off"` (no search). Main list (line 125): searchMode defaults to 'server' (implied). Intentional design (secondary list is small, read-only), but creates inconsistency in UX. Users may expect search to work everywhere. Acceptable but worth documentation.
  - Fix: Add inline comment explaining why secondary list has no search (fixed small list vs. large searchable list). Consider adding a brief note in the page description or UI.
- [ ] **[LOW]** SelectContent min-w varies across bulk bar selects without pattern  `spacing` · _all_
  - Datei: `components/tickets/bulk-bar.tsx` · lines 707-751
  - Problem: Status: min-w-52, Priority: min-w-44, Queue: min-w-52. No clear rationale for differences. Minor inconsistency.
  - Fix: Standardize to min-w-56 for all bulk bar SelectContent, or document per-select reasoning.
- [ ] **[LOW]** Bulk bar Actions button and close button not vertically aligned  `alignment` · _320, 375, 414_
  - Datei: `components/tickets/bulk-bar.tsx` · lines 864-887
  - Problem: On mobile, label (text-sm) + 'Aktionen' button (h-11) + 'X' button (h-11) sit in flex-col gap-2. Label is ~20px tall, buttons 44px. If flex-col doesn't explicitly center, baseline may misalign (label top-aligned while buttons bottom-aligned). Visual imbalance likely minor but worth verification.
  - Fix: Verify visual alignment of label vs buttons on mobile. If needed, add `flex-col gap-2 items-stretch` or wrap label in flex-center container.
- [ ] **[LOW]** Bulk bar main container uses flex-col gap-2 sm:flex-row, creating layout jump at sm  `spacing` · _640_
  - Datei: `components/tickets/bulk-bar.tsx` · line 691
  - Problem: Line 859: `className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"`. At sm, layout changes from column (vertical) to row (horizontal). Gap-2 applies to both, but row wrap may cause different visual rhythm than column. Acceptable but worth verifying at exactly 640px.
  - Fix: Test bulk bar layout at 640px to ensure gap-2 spacing feels consistent between column and row layouts.
- [ ] **[LOW]** CLOSED_STATUS_ID hardcoded to 5 instead of using picklists  `consistency` · _all_
  - Datei: `components/tickets/bulk-bar.tsx` · line 85
  - Problem: Line 81: `const CLOSED_STATUS_ID = 5;`. Hardcoded assumption that status 5 = Abgeschlossen. Picklists.status is available and should be queried. If Autotask's picklist changes, this breaks silently. Acceptable for stable systems, but less resilient than querying picklists.
  - Fix: Consider deriving CLOSED_STATUS_ID from picklists at runtime: `const closedStatus = picklists.status.find(s => s.label === "Abgeschlossen")?. value`, or add defensive error handling.
- [ ] **[LOW]** Bulk bar button className varies between stacked and inline, risking layout jump  `consistency` · _640_
  - Datei: `components/tickets/bulk-bar.tsx` · lines 689-704
  - Problem: btnCls: `stacked ? "h-11 w-full justify-start" : "h-11 flex-1 sm:h-7 sm:flex-none"`. Mobile: h-11 w-full. Desktop: h-11 flex-1 sm:h-7. At sm (640px), transition may cause visual jank. Acceptable if transition is smooth, but worth testing.
  - Fix: Test button layout and sizing at exactly 640px to ensure smooth transition between sheet and inline modes.
- [ ] **[LOW]** ResourceFilter label logic doesn't distinguish 'singular' count  `consistency` · _all_
  - Datei: `components/tickets/resource-filter.tsx` · lines 44-45
  - Problem: Label: `count === total ? "Alle Mitarbeiter" : count === 0 ? "Keine Mitarbeiter" : \`Mitarbeiter (${count}/${total})\``. No singular/plural handling for 'Mitarbeiter' (e.g., should be 'Mitarbeiter (1/30)' not 'Mitarbeiters'). German pluralization is always 'Mitarbeiter', so this is actually correct, but not explicitly defensive for other languages.
  - Fix: Add comment noting German pluralization is identical, or prepare i18n-safe structure if multi-language support is planned.
- [ ] **[LOW]** ResourceFilter value array mirrors selected Set but with string keys  `consistency` · _all_
  - Datei: `components/tickets/resource-filter.tsx` · line 48
  - Problem: Line 48: `const value = options.filter((o) => selected.has(o.id)).map((o) => String(o.id))`. Converts Set<number> to string[] for base-ui Select.multiple. String keys work, but type coercion is implicit. Acceptable pattern but could be more explicit with a comment.
  - Fix: Add inline comment: `// base-ui Select.multiple requires string values` to document the conversion.
- [ ] **[LOW]** ResourceFilter SelectContent min-w-56 may be excessive on mobile  `spacing` · _320, 375, 414_
  - Datei: `components/tickets/resource-filter.tsx` · line 71
  - Problem: ResourceFilter SelectContent: `min-w-56` (224px). On 320px mobile, this exceeds container width, forcing the popover to be narrower or shift off-screen. Base-ui should handle positioning, but worth verifying. Other filter selects have similar min-w (44-64), but resource filter is notably wider.
  - Fix: Test ResourceFilter popover positioning at 320px to ensure it doesn't overflow or obscure important UI. If needed, reduce min-w-56 to min-w-44 on mobile via responsive class (sm:min-w-56).
- [ ] **[LOW]** Title column max-width shrinks at xl then expands at 2xl  `responsive` · _1280, 1536_
  - Datei: `components/tickets/tickets-list.tsx` · lines 388-392
  - Problem: TruncatedText: `max-w-xs xl:max-w-[12rem] 2xl:max-w-md`. Width progression: 320px (xs) -> 192px (xl) -> 448px (2xl). Shrinking at xl is counterintuitive (more screen space but less width). May cause unexpected truncation at 1280px.
  - Fix: Use monotonic increase: `max-w-xs sm:max-w-sm md:max-w-md xl:max-w-lg` or document intentional mid-range compression.
- [ ] **[LOW]** Table min-w-2xl forces horizontal scroll at lg (1024px)  `responsive` · _1024_
  - Datei: `components/tickets/tickets-list.tsx` · line 748
  - Problem: Table className="min-w-2xl" enforces 640px minimum width. At lg (1024px), container ~1000px (minus sidebar + padding), table min-w=640 fits. But narrow lg breakpoints (exactly 1024px) leave little margin. If sidebar collapses or padding adjusts, table may be cramped or scroll-prone.
  - Fix: Verify horizontal scroll UX at 1024px. Ensure critical columns (Nummer, Titel, Status) are always viewport-first without scrolling.
- [ ] **[LOW]** Search placeholder text hardcoded vs configurable in SearchableTable  `consistency` · _all_
  - Datei: `components/tickets/tickets-list.tsx` · lines 52-63
  - Problem: TicketsList: `placeholder="Nummer oder Titel suchen …"` (hardcoded). SearchableTable: `placeholder={searchPlaceholder}` (configurable). Inconsistency means future UX changes need updates in both places.
  - Fix: Standardize: either make TicketsList placeholder configurable in props, or hardcode SearchableTable and remove prop.
- [ ] **[LOW]** Toolbar + BulkBar both use grid grid-cols-1 without explicit outer padding  `spacing` · _all_
  - Datei: `components/tickets/tickets-list.tsx` · line 541
  - Problem: Both toolbar and bulkbar rendered in `grid grid-cols-1` (line 544). This grid has no padding. Page layout adds p-4 md:p-6, so toolbar inherits that. But if toolbar is ever rendered standalone, it lacks visual breathing room. Minor inconsistency vs components that explicitly define padding.
  - Fix: Add comment documenting that padding is inherited from parent, or explicitly add padding to grid for clarity.
- [ ] **[LOW]** TicketCard variant passed as 'worklist' but not verified against TicketCardVariant type  `state` · _all_
  - Datei: `components/tickets/tickets-list.tsx` · line 738
  - Problem: TicketCard rendered with `variant="worklist"` (line 733). TicketCard accepts variant='worklist' | 'activity' (ticket-card.tsx line 70). Here, always 'worklist', never 'activity'. This is correct but suggests 'activity' variant is unused in lists (only in activity feed context). Not a bug, but notable pattern.
  - Fix: Verify that 'activity' variant is only used in activity feed, not accidentally missed in list contexts. Document variant choice if intentional.
- [ ] **[LOW]** Table header row uses hover:bg-muted/50 but doesn't prevent text hover effects  `consistency` · _all_
  - Datei: `components/tickets/tickets-list.tsx` · line 763
  - Problem: TableRow className="bg-muted/50 hover:bg-muted/50" (line 750). Hover state is same as normal state, effectively disabling hover feedback on header. This is correct (headers shouldn't change on hover), but explicit `hover:bg-muted/50` suggests an intent to keep it stable rather than letting cascading hover rules apply. Acceptable but stylistically verbose.
  - Fix: Consider removing explicit `hover:bg-muted/50` if it's always the same as normal state, or add comment explaining intentional hover-suppression.
- [ ] **[LOW]** Column order storage key differs from other component keys  `consistency` · _all_
  - Datei: `components/tickets/tickets-list.tsx` · lines 500-502
  - Problem: useColumnOrder key: `cols:tickets:${columnIds.join("-")}`. Follows pattern but includes dynamic columnIds in key. If columnIds change (columns added/removed), old localStorage entries orphan. Not a bug (graceful degrade), but means users lose custom column order on feature updates. Acceptable pattern.
  - Fix: Consider versioning the key (e.g., `cols:tickets:v2:...`) if breaking changes to column list are planned.
- [ ] **[LOW]** Mobile card overflow hint uses text-xs at lg:hidden, skipped at lg+  `consistency` · _1024_
  - Datei: `components/tickets/tickets-list.tsx` · lines 727-745
  - Problem: Overflow hint (line 742) shown only at lg:hidden (mobile/tablet). At lg+, no visible indicator that the table has horizontal scroll (if user hasn't discovered scroll). Acceptable design (tables assume scroll awareness), but mobile users see '+ 5 weitere …' while desktop users don't get equivalent hint.
  - Fix: Consider adding subtle scroll indicator on desktop table if horizontal scroll is necessary, or ensure critical columns (Nummer, Titel, Status) fit without scroll at all breakpoints.
- [ ] **[LOW]** TicketCard selectedIds state managed in parent but checkbox disabled when onToggleSelect is undefined  `consistency` · _all_
  - Datei: `components/tickets/tickets-list.tsx` · lines 179-185
  - Problem: Line 736: `onToggleSelect={(c) => toggleRow(t.id, c)}` always defined when selectable=true. TicketCard checks `onToggleSelect?.(...)` (optional chaining). This is defensive but means if onToggleSelect is undefined, checkbox becomes unclickable. Acceptable defensive coding, but suggests a potential contract mismatch if selectable=true but onToggleSelect not provided.
  - Fix: Add runtime assertion or type guarantee that when selectable=true, onToggleSelect and selected are both provided. Document requirement in TicketsList props.
- [ ] **[LOW]** mobileLimit and mobileOverflowHint parameters only used for secondary/dashboard contexts  `consistency` · _all_
  - Datei: `components/tickets/tickets-list.tsx` · lines 360-361
  - Problem: Parameters exist (line 77-78) but TicketsList calls from my/team/ball pages don't pass them (always undefined/default false). These features are used only in Dashboard or secondary sections. Acceptable but adds unused code surface in main list. Not a bug, but indicates feature creep.
  - Fix: If mobileLimit is unused in my/team/ball contexts, consider removing from TicketsList and creating a separate DashboardTicketList or TicketListVariant. Or document where mobileLimit is actually used.
- [ ] **[LOW]** Server-side search uses 350ms debounce; no user feedback during debounce  `consistency` · _all_
  - Datei: `components/tickets/tickets-list.tsx` · lines 251-264
  - Problem: Line 256: debounce 350ms on ?q= param change. User types, sees results after 350ms delay. No visual loading indicator (skeleton, spinner) shown during debounce. If user is on slow connection, they may assume input froze. Acceptable UX but could be polished with a brief loading pulse.
  - Fix: Consider adding a subtle opacity/skeleton effect to the list during debounce, or document the expected delay in placeholder text.

### Ticket Detail + Chat + Edit (ticket-detail, ticket-chat, meta-edit, time-tracking, and related components)

_11 Befunde — 0 High · 4 Medium · 7 Low · 0 Nit_

- [ ] **[MEDIUM]** AttachmentUpload button uses h-11 sm:h-7, inconsistent with Zeit erfassen (h-9) and other secondary buttons  `consistency` · _sm (h-7 vs h-9)_
  - Datei: `c:\dev\pauls-autotask-ui\components\tickets\attachment-upload.tsx` · Lines 66-75, button with size="sm" className="h-11 sm:h-7"
  - Problem: Upload button uses h-11 sm:h-7 while Zeit erfassen and Neue Notiz buttons use h-11 sm:h-9. This creates the same 8px desktop height mismatch if these buttons appear adjacent. Part of the broader h-7 vs h-9 split in edit/action buttons.
  - Fix: Change to h-11 sm:h-9 to align with Zeit erfassen and establish consistent secondary button height across ticket detail.
- [ ] **[MEDIUM]** Button height inconsistency: h-11 sm:h-7 vs h-11 sm:h-9 across edit components  `consistency` · _sm (h-7 vs h-9 mismatch, 8px difference)_
  - Datei: `c:\dev\pauls-autotask-ui\components\tickets\meta-edit.tsx` · Lines 159, 179, 184, 211 (DescriptionEdit) vs 562, 566 (StatusEdit dialog buttons)
  - Problem: DescriptionEdit 'Bearbeiten', 'Speichern', 'Abbrechen', and 'Mehr anzeigen' buttons use h-11 sm:h-7 (28px desktop). StatusEdit dialog buttons use h-11 sm:h-9 (36px desktop). This creates two incompatible heights for similar button roles. Inconsistency is within the same file (meta-edit.tsx).
  - Fix: Standardize all secondary action buttons to h-11 sm:h-9. Update DescriptionEdit, NoteForm, and AttachmentUpload to use h-9 instead of h-7 on desktop. h-7 is too small for accessible secondary actions.
- [ ] **[MEDIUM]** Tab trigger height (h-8) misaligned with Zeit erfassen button (h-9)  `alignment` · _sm+ (h-8 vs h-9 height mismatch)_
  - Datei: `c:\dev\pauls-autotask-ui\components\tickets\ticket-detail.tsx` · Lines 405-418, TabsList and TabsTriggers
  - Problem: TabsTrigger uses `className="h-11 flex-1 sm:h-8 sm:flex-none"` (32px desktop) while Zeit erfassen button uses `h-11 flex-1 sm:h-9 sm:flex-none"` (36px desktop). This 4px mismatch creates misalignment when displayed together. Also, flex-1 forces equal-width tabs at mobile (50% each).
  - Fix: Change TabsTrigger to h-11 sm:h-9 to match Zeit erfassen and standardize secondary button heights across the detail page.
- [ ] **[MEDIUM]** TabsTrigger uses flex-1 on mobile, forcing equal-width tab buttons (50% each for 2 tabs)  `state` · _mobile (flex-1 forces equal), sm+ (flex-none allows natural)_
  - Datei: `c:\dev\pauls-autotask-ui\components\tickets\ticket-detail.tsx` · Lines 405-418, TabsTrigger className="h-11 flex-1 sm:h-8 sm:flex-none"
  - Problem: With flex-1, each tab gets 50% width regardless of content at mobile, then transitions to flex-none for natural sizing at sm+. This is a design choice that constrains mobile tab width. If a third tab is added, tabs become 33% width each. Pattern works but differs from typical responsive tabs where content drives width.
  - Fix: Acceptable if equal-width mobile tabs are intentional. If natural tab sizing is preferred, remove flex-1 and use gap-1 with implicit flex-wrap to allow content-driven width.
- [ ] **[LOW]** Attachment description and button layout uses justify-between; wrapping risk on 320px screens  `responsive` · _320px (wrapping risk)_
  - Datei: `c:\dev\pauls-autotask-ui\components\tickets\attachment-upload.tsx` · Lines 61-77, div className="flex items-center justify-between gap-3"
  - Problem: The layout uses justify-between which spaces text and button apart. On 320px screens, text 'Max. ... pro Datei.' plus button may wrap to multiple lines due to gap-3 (12px) and container width. Pattern assumes single-line fit that may not hold at screen edge cases.
  - Fix: Test at 320px viewport. If wrapping occurs, use flex-col gap-2 on mobile or move description text to a separate line below the button.
- [ ] **[LOW]** DescriptionEdit secondary buttons mixed: some use h-11 sm:h-7, alignment inconsistent with parent detail page pattern  `consistency` · _sm (h-7 at desktop)_
  - Datei: `c:\dev\pauls-autotask-ui\components\tickets\meta-edit.tsx` · Lines 159, 211 (DescriptionEdit 'Bearbeiten' and 'Mehr anzeigen' buttons)
  - Problem: The 'Bearbeiten' button (line 159) and 'Mehr anzeigen' button (line 211) both use h-11 sm:h-7. While not broken, they're 8px shorter than Zeit erfassen (h-9) and other detail page action buttons at desktop, creating visual hierarchy noise.
  - Fix: Update to h-11 sm:h-9 to establish uniform secondary button size across the detail page.
- [ ] **[LOW]** Arbeitszeit & Abrechnung time totals grid uses grid-cols-2 without mobile override; cramping risk at 320px  `responsive` · _320px edge case (potential cramping)_
  - Datei: `c:\dev\pauls-autotask-ui\components\tickets\meta-edit.tsx` · Lines 493, grid div className="grid grid-cols-2 gap-4"
  - Problem: Card renders four metric fields (Gearbeitet, Geschätzt, Abrechenbar, Nicht abrechenbar) in a 2x2 grid with gap-4. At mobile screens narrower than ~375px, the grid may cramp labels and values. No responsive adjustment for mobile.
  - Fix: Add responsive grid class: 'grid-cols-1 sm:grid-cols-2'. This stacks fields vertically on mobile, expanding to 2 columns at sm+.
- [ ] **[LOW]** Right rail uses 2xl:w-80 without coordinating main grid changes at 2xl breakpoint  `responsive` · _2xl (1536px+)_
  - Datei: `c:\dev\pauls-autotask-ui\components\tickets\ticket-detail.tsx` · Lines 443, rightRail div className="flex w-full flex-col gap-4 xl:w-72 xl:shrink-0 2xl:w-80"
  - Problem: The rightRail expands to w-80 (320px) at 2xl (1536px). However, the main grid container (line 667) has no 2xl changes (only lg/xl). The rail widens alone without a coordinating layout reflow, creating an orphaned breakpoint.
  - Fix: Either remove 2xl:w-80 to keep rightRail at xl:w-72 universally, or add corresponding 2xl changes to main layout grid (line 667), such as 2xl:gap-8 to maintain proportional spacing. Document whether 2xl is a supported breakpoint for this template.
- [ ] **[LOW]** Desktop header (hidden md:flex) and mobile header (flex md:hidden) are correctly inverse; clean breakpoint transition at md (768px)  `responsive` · _mobile (<768px), md (768px+)_
  - Datei: `c:\dev\pauls-autotask-ui\components\tickets\ticket-detail.tsx` · Lines 571-583 (desktop header) vs 588-655 (mobile header)
  - Problem: The headers use perfectly inverse display rules. At <768px (mobile), the mobile header shows and desktop hides. At 768px+ (md), desktop shows and mobile hides. Transition is clean with no gap or overlap.
  - Fix: No change; responsive transition is correctly implemented.
- [ ] **[LOW]** Layout grid transitions correctly at lg (1024px) and xl (1280px) with no gaps  `responsive` · _lg (1024px two-column), xl (1280px three-column)_
  - Datei: `c:\dev\pauls-autotask-ui\components\tickets\ticket-detail.tsx` · Lines 667, main layout grid className="flex flex-col gap-6 lg:flex-row lg:flex-wrap lg:items-start xl:flex-nowrap"
  - Problem: At <lg: full-width stacked (flex-col). At lg: flex-row + flex-wrap enables two-column (leftRail + center/rightRail wraps). At xl: flex-nowrap forces three-column (leftRail, center, rightRail inline). Transitions are smooth and correctly composed. The leftRail width is lg:w-72 lg:shrink-0 (constrained via Rail component), center uses flex-1, rightRail uses xl:w-72 xl:shrink-0.
  - Fix: No change; responsive grid layout is correctly implemented.
- [ ] **[LOW]** Zeit erfassen and Neue Notiz buttons use flex-1 sm:flex-none; creates full-width button pairing at mobile  `spacing` · _mobile (flex-1 pairing), sm+ (flex-none individual)_
  - Datei: `c:\dev\pauls-autotask-ui\components\tickets\time-tracking.tsx` · Lines 109-114, TimeTracking div className="flex w-full flex-wrap items-center gap-2 sm:w-auto"
  - Problem: Both buttons (Zeit erfassen line 125, Neue Notiz new-note-button.tsx line 35) use `className="h-11 flex-1 sm:h-9 sm:flex-none"`. At mobile, flex-1 makes each button ~50% width (two-button row). At sm+, flex-none releases them to content width. This is a consistent pattern but creates varying button widths across breakpoints.
  - Fix: Pattern is acceptable if two-button mobile pairing is intentional. Document if this is an established mobile interaction pattern for similar action rows.

### Companies List & Detail (Kundenakte)

_10 Befunde — 0 High · 6 Medium · 3 Low · 1 Nit_

- [ ] **[MEDIUM]** SelectTrigger uses unnecessary priority override  `consistency` · _sm (640px+)_
  - Datei: `components/companies/companies-table.tsx` · line 247, SelectTrigger className
  - Problem: The Kundenart filter uses `sm:h-9!` with an arbitrary priority override, but should follow standard shadcn SelectTrigger pattern without the `!`. The base SelectTrigger already handles h-11 → sm:h-8 via size='sm' prop. Using `!` to force override suggests the base size prop isn't being applied correctly, breaking consistency with all other selects in the codebase (e.g., contacts-table, projects-list all use `sm:h-9` without `!`).
  - Fix: Remove the `!` priority override. Change `className="h-11 w-full min-w-0 sm:h-9! sm:w-auto sm:min-w-40"` to `className="h-11 w-full min-w-0 sm:h-9 sm:w-auto sm:min-w-40"` to match the baseline pattern.
- [ ] **[MEDIUM]** Filter toolbar counter has no explicit height, breaks alignment  `alignment` · _<sm (mobile), sm+ (desktop)_
  - Datei: `components/companies/companies-table.tsx` · line 262, filter counter text
  - Problem: The counter text `{filtered.length} von {rows.length}` has no height constraint and is only `text-sm`, while Input (h-11 sm:h-9) and SelectTrigger (h-11 sm:h-9) in the same toolbar row both have explicit heights. The text sits at baseline, causing vertical misalignment in the toolbar. All filter controls in a toolbar row must share the same height for proper visual alignment (44px mobile / responsive desktop).
  - Fix: Add flex-alignment: change `className="text-muted-foreground w-full text-sm whitespace-nowrap sm:ml-auto sm:w-auto"` to `className="text-muted-foreground flex items-center whitespace-nowrap w-full text-sm sm:ml-auto sm:w-auto"` to vertically center-align with neighbors.
- [ ] **[MEDIUM]** Filter toolbar gap-4 inconsistent with baseline gap-3  `spacing` · _all_
  - Datei: `components/companies/companies-table.tsx` · line 228, gap spacing inconsistency
  - Problem: CompaniesTable toolbar outer container uses `gap-4` (line 228), while SearchableTable baseline uses `gap-3` (searchable-table.tsx line 117). This creates inconsistent spacing between filter sections across the UI. The gap-4 may also create too much breathing room on mobile where space is limited.
  - Fix: Change outer container from `gap-4` to `gap-3` to match SearchableTable and other list-page patterns: `className="flex flex-col gap-3"`.
- [ ] **[MEDIUM]** Stat card grid column thresholds create awkward spacing  `responsive` · _768-1024, 1024-1280, 1280+_
  - Datei: `components/companies/company-detail-content.tsx` · line 228, stat cards grid
  - Problem: The KPI stat card grid uses `grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5`. This means: 320-640px (1 col), 640-768px (2 cols), 768-1024px (3 cols), 1024+ (5 cols). The jump from 3→5 columns at lg (1024px) is too large; most grids use 1→2→3→4 for smoother scaling. At 1920px, 5 cards with gap-4 becomes sparse; at 1024px, 3 cards become cramped before jumping to 5.
  - Fix: Revise to `grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4` for smoother scaling (1→2→3→4) and better spacing consistency across widths.
- [ ] **[MEDIUM]** StatCard focus ring uses ring-2 instead of ring-3  `consistency` · _all_
  - Datei: `components/companies/company-detail-content.tsx` · line 398, StatCard focus ring
  - Problem: StatCard Link wrapper uses `focus-visible:ring-2 focus-visible:ring-ring` (line 398), but all form controls (Input, Button, Select) use `focus-visible:ring-3 focus-visible:ring-ring/50`. This creates subtle visual inconsistency: focus rings on cards (ring-2 = 2px) are thinner than controls (ring-3 = 3px).
  - Fix: Align to component standard: change line 398 to `focus-visible:ring-3 focus-visible:ring-ring/50` to match Input/Button/Select baseline.
- [ ] **[MEDIUM]** ContractsPanel hardcodes badge logic instead of using contractStatusVariant  `component-sourcing` · _all_
  - Datei: `components/companies/kundenakte-panels.tsx` · line 158-164, ContractsPanel badge
  - Problem: Lines 158-164 use hardcoded Badge variants inline: `r.status === 1 ? <Badge>Aktiv</Badge> : r.status === 0 ? <Badge variant="secondary">Inaktiv</Badge>`. The centralized `contractStatusVariant()` function exists in mappers.ts (lines 198-199) but isn't used here. This violates single-source-of-truth for badge styling; if semantics change, this code is missed.
  - Fix: Import and use `contractStatusVariant` from mappers: `<Badge variant={contractStatusVariant(r.status)}>{r.status === 1 ? 'Aktiv' : r.status === 0 ? 'Inaktiv' : '—'}</Badge>`.
- [ ] **[LOW]** Mobile card grid uses correct xl breakpoint, consistent with SearchableTable  `consistency` · _<1280px, 1280px+_
  - Datei: `components/companies/companies-table.tsx` · line 303/340, cards-to-table breakpoint
  - Problem: Companies table cards use `grid-cols-1 md:grid-cols-2 xl:hidden` (line 303) and desktop table uses `hidden xl:block` (line 340), matching SearchableTable (lines 160/207). The xl (1280px) breakpoint is correct and consistent. No issue.
  - Fix: No change; pattern is correct and consistent with baseline.
- [ ] **[LOW]** Open tickets badges inconsistent with PageHeader badge coloring  `color-token` · _all_
  - Datei: `components/companies/company-detail-content.tsx` · line 210-217, open tickets badge
  - Problem: The 'Offene Tickets' column (line 211) uses `variant="secondary"` (gray background), while PageHeader badges use `bg-chart-2/15 text-chart-2` (blue tint per page-header.tsx line 41). Count badges elsewhere in the UI use chart-2 styling for visual consistency.
  - Fix: Align badge styling: change line 211 to `<Badge variant="secondary" className="bg-chart-2/15 text-chart-2 tabular-nums">` to match PageHeader count badge pattern.
- [ ] **[LOW]** Company detail header duplicates PageHeader layout pattern  `consistency` · _all_
  - Datei: `components/companies/company-detail-content.tsx` · line 166-200, company header
  - Problem: The company detail header (lines 166-200) hand-codes `flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4`, which mirrors PageHeader component pattern (page-header.tsx line 26-31). This duplicates logic; if header spacing changes, both must be updated. The metadata (address, phone, website) below the title complicates reusing PageHeader, but the principle stands.
  - Fix: Document this intentional duplication due to metadata layout constraints, or consider refactoring into a reusable CompanyHeader component with PageHeader-like semantics.
- [ ] **[NIT]** Contact info vertical gap (gap-y-1) is tight on wrapped lines  `spacing` · _320px_
  - Datei: `components/companies/company-detail-content.tsx` · line 172-199, contact info wrapping
  - Problem: Contact info icons/text use `flex flex-wrap items-center gap-x-4 gap-y-1`. The `gap-y-1` (4px) is minimal when address wraps across multiple lines on narrow phones, creating cramped vertical spacing.
  - Fix: Consider `gap-y-2` (8px) for slightly better breathing room on mobile: `gap-y-2` instead of `gap-y-1` in line 172.

### Contacts List + Detail + Modal

_13 Befunde — 1 High · 4 Medium · 8 Low · 0 Nit_

- [ ] **[HIGH]** Email and phone links use raw <a> tags instead of shadcn Button  `component-sourcing` · _all_
  - Datei: `components/contacts/contact-modal.tsx` · lines 123-148
  - Problem: Phone and email contact links (lines 123-148) use raw `<a href='tel:...' className='hover:bg-accent flex items-center gap-2 rounded-md px-2 py-1.5'>` instead of shadcn Button. This violates the design constitution rule: 'Every VISIBLE element must be a shadcn component or composed from shadcn primitives'. Raw interactive elements with custom styling = component-sourcing violation.
  - Fix: Replace raw `<a>` tags with `<Button variant='ghost' size='sm' asChild><a href={...}>...</a></Button>` to use shadcn Button infrastructure and ensure consistent interactive element styling.
- [ ] **[MEDIUM]** Mobile card grid gap and internal spacing inconsistency  `spacing` · _mobile, tablet (<xl)_
  - Datei: `components/contacts/contacts-table.tsx` · line 266
  - Problem: Mobile contact cards use `flex flex-col gap-1` (line 266) for internal spacing, while SearchableTable uses `flex flex-col gap-1.5` (line 179). This creates tighter vertical spacing in contact cards. Quoted classes: ContactsTable `gap-1` vs SearchableTable `gap-1.5`.
  - Fix: Change line 266 from `gap-1` to `gap-1.5` to match SearchableTable mobile card spacing. Ensure consistent internal card spacing across all list types.
- [ ] **[MEDIUM]** CompanyFilterPicker button breaks filter row pattern with fixed width  `consistency` · _sm (640px), md (768px), lg (1024px)_
  - Datei: `components/contacts/contacts-table.tsx` · lines 206-232, 373-385
  - Problem: The Firma filter button uses hardcoded width `sm:w-56` (line 378) instead of flexible grid layout. In SearchableTable, all controls share consistent row layout. ContactsTable mixes fluid input (`flex-1 min-w-48`) with fixed-width button (`sm:w-56`), creating misalignment potential at tablet widths. Filter row uses `flex flex-wrap items-center gap-2` but doesn't establish consistent height for all elements; status text (line 218) lacks height constraint.
  - Fix: Remove fixed `sm:w-56` width constraint and use grid-based filter layout (e.g., grid-cols-1 sm:grid-cols-3) to match SearchableTable pattern. Wrap all controls (search, company, status text) with explicit heights (h-11 sm:h-9).
- [ ] **[MEDIUM]** Email column max-width shrinks at 2xl breakpoint instead of growing  `responsive` · _lg (1024), xl (1280), 2xl (1536)_
  - Datei: `components/contacts/contacts-table.tsx` · lines 186-195
  - Problem: Email cell uses `max-w-48 2xl:max-w-xs`, meaning at 2xl (1536px, widest screens) the truncation is TIGHTER (xs), not looser. This is counterintuitive — wider viewports should show more content. Quote: `2xl:max-w-xs` contradicts responsive scaling logic. Name uses `max-w-xs` (fixed), company uses `max-w-44` (fixed).
  - Fix: Remove responsive override or reverse it: use `max-w-48 xl:max-w-56 2xl:max-w-lg` to increase space on larger screens. Or remove max-w from email entirely and rely on TruncatedText tooltip.
- [ ] **[MEDIUM]** Filter row status text lacks height constraint, causes misalignment  `alignment` · _all_
  - Datei: `components/contacts/contacts-table.tsx` · lines 206-232
  - Problem: Status text 'X Kontakte' (line 219) uses `text-muted-foreground w-full text-sm whitespace-nowrap sm:ml-auto sm:w-auto` with NO height, relying on line-height alone. On mobile when the filter row wraps, this text floats without a defined container height, potentially creating visual misalignment with input/button neighbors which are h-11/sm:h-9.
  - Fix: Wrap status text in a div with explicit height: `<div className='flex items-center h-11 sm:h-9 sm:ml-auto'><span className='text-muted-foreground text-sm'>...</span></div>` to ensure vertical alignment with filter controls.
- [ ] **[LOW]** Contact detail skeleton doesn't mirror actual tab button structure  `state` · _all_
  - Datei: `app/(app)/contacts/[id]/loading.tsx` · lines 14-17
  - Problem: Tab skeleton (lines 14-17) renders two plain h-8 Skeletons but actual contact detail uses UrlTabs which renders button-like tab controls. Skeleton is too vague and doesn't indicate interactive button semantics.
  - Fix: Enhance skeleton to show tab button structure: `<div className='flex gap-2'><Skeleton className='h-8 w-32' /><Skeleton className='h-8 w-40' /></div>` to mirror UrlTabs.
- [ ] **[LOW]** Contact info layout doesn't use standard FieldGroup pattern  `spacing` · _all_
  - Datei: `app/(app)/contacts/[id]/page.tsx` · lines 135-167
  - Problem: Contact details (company, email, phone) rendered as raw flex divs: `<div className='flex items-center gap-2'>` (line 138). Design constitution mentions 'Forms: FieldGroup + Field, not raw div+Label'. While this isn't a form, it's a quasi-structured data display that could use component reuse.
  - Fix: Consider creating a reusable ContactInfoField component or using FieldGroup pattern for consistency. Current raw div approach works but misses reuse opportunity.
- [ ] **[LOW]** Modal loading skeleton proportions don't match actual content  `state` · _all_
  - Datei: `components/contacts/contact-modal.tsx` · lines 95-98
  - Problem: Loading skeletons use `h-9 w-full`, `h-7 w-56`, `h-7 w-40`, suggesting tall block-level elements. But actual modal content (DialogTitle, DialogDescription, text-sm paragraphs) are text-based, not h-9-tall blocks. Skeleton sizes should be tighter to reflect text line heights.
  - Fix: Adjust loading skeletons to `<Skeleton className='h-6 w-48' />` for title and `<Skeleton className='h-4 w-32' />` for description to better match text-based content.
- [ ] **[LOW]** Modal phone/email links hardcode 'hover:bg-accent' instead of using Button variant  `color-token` · _all_
  - Datei: `components/contacts/contact-modal.tsx` · lines 101-152
  - Problem: Lines 125, 133, 142 use inline className 'hover:bg-accent' on raw `<a>` tags. These should delegate hover behavior to shadcn Button's variant system (variant='ghost' provides hover:bg-muted). Mixing inline classes with Button system is inconsistent.
  - Fix: Use Button component as noted in finding 3, which eliminates need for inline 'hover:bg-accent' class.
- [ ] **[LOW]** Mobile contact card missing focus/keyboard interaction classes  `consistency` · _mobile, tablet (<xl)_
  - Datei: `components/contacts/contacts-table.tsx` · line 266
  - Problem: ContactsTable mobile card (line 266) uses `hover:bg-muted/50 active:bg-muted flex flex-col gap-1` but is missing `cursor-pointer transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` classes present in SearchableTable cards. This causes visible difference in keyboard/focus feedback.
  - Fix: Add missing focus classes to line 266: append `cursor-pointer transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`.
- [ ] **[LOW]** SortHead button uses h-8 override inside TableHead context  `consistency` · _all_
  - Datei: `components/contacts/contacts-table.tsx` · lines 122-154
  - Problem: SortHead uses `<Button variant='ghost' size='sm' className='-ml-2 h-8'>` (line 145), explicitly setting h-8 with negative margin (`-ml-2`). This is lower than standard button heights and uses margin override for alignment adjustment. While intentional for table header sizing, it suggests non-standard nesting patterns.
  - Fix: Verify visual alignment of SortHead button with TableCell baselines at actual pixel level. If misaligned, prefer padding/inset adjustments over negative margins.
- [ ] **[LOW]** Filter row company button width creates inconsistent control sizing  `spacing` · _sm (640px)_
  - Datei: `components/contacts/contacts-table.tsx` · line 217
  - Problem: CompanyFilterPicker button (line 378) uses `sm:w-56` which is a fixed 224px width. On smaller sm screens (640-736px), this button may not fit alongside the search input (which takes `flex-1 min-w-48`), causing awkward wrapping behavior.
  - Fix: Test filter row layout at sm breakpoint (640px viewport). If button doesn't fit, reduce fixed width or make it `flex-1` with `max-w-56` instead of hardcoded width.
- [ ] **[LOW]** Company name column uses fixed max-w without responsive scaling  `responsive` · _2xl (1536)_
  - Datei: `components/contacts/contacts-table.tsx` · lines 175-178
  - Problem: Company column uses static `max-w-44` (line 177). No responsive override at larger breakpoints. Compared to email column which has `max-w-48 2xl:max-w-xs` (albeit inverted logic), company column has no scaling strategy for wide screens.
  - Fix: Add responsive scaling: `max-w-44 lg:max-w-56 xl:max-w-64` to give company names more space on desktop views.

### Projekte (Projects) list and detail

_11 Befunde — 3 High · 3 Medium · 5 Low · 0 Nit_

- [ ] **[HIGH]** SelectTrigger uses dangerous `!` to override responsive height on touch-sized devices  `spacing` · _320-639 (h-11 correct), 640-1279 (BROKEN: h-9 at 36px, too small for touch), 1280+ (h-9 correct)_
  - Datei: `components/projects/projects-list.tsx` · line 598
  - Problem: FilterSelect uses `className="h-11 w-full min-w-0 sm:h-9! sm:w-auto sm:min-w-36"`. The `sm:h-9!` forces h-9 (36px) at sm breakpoint (640px), which affects tablets at 768px where touch targets should still be h-11 (44px minimum). The `!important` makes this directive un-overrideable, breaking the responsive height pattern used everywhere else.
  - Fix: Remove the `!` and use `md:h-9` instead of `sm:h-9!`. Change to: `className="h-11 w-full min-w-0 md:h-9 md:w-auto md:min-w-36"`
- [ ] **[HIGH]** Filter toolbar uses 3-column grid for filters on mobile, causing cramped touch targets  `responsive` · _320 (grid-cols-3 ~100px per select), 375 (grid-cols-3 ~110px per select), 414 (grid-cols-3 readable), 640+ (flex, full layout)_
  - Datei: `components/projects/projects-list.tsx` · lines 316-376
  - Problem: Filter section uses `grid-cols-3 gap-2 sm:flex` which makes select buttons ~33% width on 320px. At 320px, each select is ~100px wide including margins, cramped for touch interaction. Baseline pattern (SearchableTable) uses simpler flex wrapping instead of multi-column grids on mobile.
  - Fix: Change filter grid to `grid-cols-1 sm:flex` or use flex wrapping instead. This allows full-width selects on mobile, improving touch usability.
- [ ] **[HIGH]** Mobile card-to-table breakpoint inconsistent between list (xl) and detail tabs (md)  `responsive` · _768-1023 (detail tabs: table, list: 2-col cards), 1024-1279 (same), 1280+ (both: table)_
  - Datei: `components/projects/projects-list.tsx` · lines 404-433
  - Problem: ProjectsList shows cards until xl (1280px) and table from xl+. ProjectTasksPanel and ProjectPhasesPanel show cards until md (768px) and table from md+. This creates a visual inconsistency: on tablet at 768-1023px, the detail tabs show tables while the list shows 2-column cards. Users see different layouts on the same device size depending on page.
  - Fix: Change ProjectTasksPanel and ProjectPhasesPanel to use `xl:hidden` / `hidden xl:block` to match ProjectsList (table debut at 1280px consistently).
- [ ] **[MEDIUM]** TabsTrigger uses h-8 desktop height instead of standard h-9  `consistency` · _320 (h-11 correct), 640+ (h-8, too short compared to h-9 standard)_
  - Datei: `components/projects/project-tabs.tsx` · lines 32-42
  - Problem: TabsTrigger className is `"h-11 flex-1 sm:h-8 sm:flex-none"`. Standard desktop form control height is h-9 (36px), but tabs use h-8 (32px), creating visual misalignment with buttons and selects that are h-9. h-8 is noticeably shorter.
  - Fix: Change to `"h-11 flex-1 sm:h-9 sm:flex-none"` to align with app-wide h-9 standard for desktop controls.
- [ ] **[MEDIUM]** Scope buttons use w-auto on desktop, causing unequal widths when badge is present  `alignment` · _320 (w-full, equal 50%), 640 (w-auto, unequal due to badge)_
  - Datei: `components/projects/projects-list.tsx` · lines 318-339
  - Problem: Scope buttons are `className="h-11 w-full sm:h-9 sm:w-auto"`. On mobile (320px), they are 50% width each (equal). On sm (640px+), they switch to `w-auto`, which sizes buttons to their content. 'Meine Projekte' with badge becomes wider than 'Alle Projekte', breaking alignment consistency.
  - Fix: Either (1) keep `w-full` on sm with `sm:max-w-none`, or (2) add equal `min-w-40` to both buttons to maintain visual balance despite content width differences.
- [ ] **[MEDIUM]** Mobile project card has `bg-card` but TicketCard does not, inconsistent card styling  `consistency` · _320 (mobile only)_
  - Datei: `components/projects/projects-list.tsx` · lines 406-431
  - Problem: ProjectsList mobile card: `className="bg-card flex flex-col gap-2 rounded-lg border p-3"` (explicit card background). TicketCard: no `bg-card`, inherits page background. This is inconsistent: one list has raised cards, the other has blended cards. Affects visual hierarchy and pattern recognition across the app.
  - Fix: Apply consistent card background: either add `bg-card` to all mobile list cards (TicketCard, etc.) or remove it from ProjectsList to match the blended pattern.
- [ ] **[LOW]** Project detail header is hand-rolled instead of using PageHeader component  `component-sourcing` · _all_
  - Datei: `components/projects/project-detail-content.tsx` · lines 145-183
  - Problem: Project detail does not use <PageHeader> component despite having a clear header section (title, description pattern). Instead, it uses manual flex/gap divs. This duplicates PageHeader's logic and means if PageHeader is updated, project detail won't follow.
  - Fix: If possible, refactor to use PageHeader component or document why custom layout is necessary (e.g., complex meta layout not supported by PageHeader).
- [ ] **[LOW]** StatCard applies inline hover styles instead of using semantic tokens or variants  `consistency` · _all (hover visible at all sizes)_
  - Datei: `components/projects/project-detail-content.tsx` · lines 268-313
  - Problem: StatCard manually applies `hover:border-primary/40 hover:shadow-md`. The hover effect is not fully tokenized: `shadow-md` is hardcoded, not a semantic token. If the app's card hover semantics change, StatCard won't update automatically.
  - Fix: Extract hover styles to a shared utility class or Card variant. Ensure shadow uses a semantic token if not already.
- [ ] **[LOW]** Row helper uses gap-1 on mobile, creating tight vertical spacing  `spacing` · _320 (gap-1 = 4px tight), 640+ (gap-3 = 12px spacious)_
  - Datei: `components/projects/project-meta-edit.tsx` · line 88
  - Problem: Row helper uses `grid-cols-1 items-center gap-1 sm:grid-cols-[8rem_1fr] sm:gap-3`. Mobile gap-1 (4px) is tight; desktop gap-3 (12px) is spacious. This is an intentional mobile optimization but may reduce readability if labels wrap or values are tall.
  - Fix: Consider increasing to gap-2 (8px) on mobile if readability testing shows issues. Otherwise, this optimization is acceptable.
- [ ] **[LOW]** Desktop table uses min-w-3xl vs SearchableTable baseline min-w-2xl  `consistency` · _1280+ (affects horizontal scroll behavior)_
  - Datei: `components/projects/projects-list.tsx` · line 437
  - Problem: ProjectsList table: `className="min-w-3xl"` (48rem = 768px). SearchableTable baseline: `minWidthClass = "min-w-2xl"` (42rem = 672px). Inconsistent minimum widths. Projects table has 7 columns vs SearchableTable's typical 5-6, so wider min-width may be intentional but not documented.
  - Fix: Document why min-w-3xl is necessary. If not, align with SearchableTable for consistency.
- [ ] **[LOW]** Search input uses sm:h-9 breakpoint instead of md:  `spacing` · _320-639 (h-11), 640-1279 (sm:h-9 at 36px, acceptable but borderline), 1280+ (36px)_
  - Datei: `components/projects/projects-list.tsx` · lines 342-351
  - Problem: Search input className: `"h-11 pl-9 sm:h-9"`. The input correctly uses `sm:h-9`, matching other controls. However, this should ideally be `md:h-9` to align with the mobile-first 44px touch minimum that extends to tablet (768px).
  - Fix: For consistency with touch targets, consider changing to `md:h-9` to keep 44px targets until md breakpoint. However, current `sm:h-9` is acceptable if intentional.

### Zeiten (My Times)

_16 Befunde — 1 High · 3 Medium · 2 Low · 10 Nit_

- [ ] **[HIGH]** RangeToggle buttons violate consistent sizing pattern across filter toolbars  `touch-target` · _320-414 (h-11 = 44px, correct for touch), 768+ (h-7 = 28px, breaks visual alignment with 36px filter controls)_
  - Datei: `c:\dev\pauls-autotask-ui\components\time\range-toggle.tsx` · lines 25, 32-33
  - Problem: Both Button components use className="h-11 sm:h-7" to override size="sm" defaults (h-7 desktop, h-7 mobile). This makes buttons 44px on mobile (correct touch target) but 28px on desktop (too small). The issue: standard Input/Select in filter toolbars use h-11 sm:h-9 (44px mobile, 36px desktop). Button size="sm" is h-7 (28px), so the override tries to fix mobile but breaks desktop consistency. Compare companies-table.tsx SelectTrigger: uses h-11 sm:h-9! (forcing desktop h-9). The RangeToggle buttons appear misaligned vertically with other toolbar controls on desktop (28px vs. 36px). On mobile, all controls are 44px (correct), but then desktop height drops inconsistently.
  - Fix: Change className on both buttons to 'h-11 sm:h-9' to match Input/Select filter heights (44px mobile, 36px desktop). This maintains visual alignment with potential future filter toolbar companions and fixes the desktop size mismatch.
- [ ] **[MEDIUM]** Loading skeleton uses KpiTilesSkeleton grid layout instead of flex-row layout for stats  `state` · _320-414 (card layout differs from text wrap, noticeable shift)_
  - Datei: `c:\dev\pauls-autotask-ui\app\(app)\zeiten\loading.tsx` · lines 12-16
  - Problem: Skeleton renders stats as KpiTilesSkeleton 'grid-cols-1 gap-4 sm:grid-cols-3' (3 stacked cards on mobile, 3 columns on sm+). Real page.tsx renders stats as 'flex flex-wrap gap-x-6 gap-y-1' (inline text with wrapping, no cards). Visual mismatch: skeleton shows 3 tall card blocks (~60px each), real content shows 1-2 lines of small text (~20px). On mobile during hydration: skeleton loads as 3 cards, real content appears as wrapped text, causing layout shift. Not a functional issue but causes hydration mismatch.
  - Fix: Replace KpiTilesSkeleton with a simple flex-wrap row skeleton: <div className='flex flex-wrap gap-x-6 gap-y-1'><Skeleton className='h-4 w-20' /><Skeleton className='h-4 w-20' /><Skeleton className='h-4 w-20' /></div> to match the real layout.
- [ ] **[MEDIUM]** Stats row uses dual-axis gap declaration instead of standard unified gap  `spacing` · _320-414 (gap-y-1 makes wrapped text lines too close), 768+ (gap-x-6 OK for single-line)_
  - Datei: `c:\dev\pauls-autotask-ui\app\(app)\zeiten\page.tsx` · line 53
  - Problem: Stats summary uses className='text-muted-foreground flex flex-wrap items-center gap-x-6 gap-y-1 text-sm'. The gap-x-6 gap-y-1 pattern violates the design guideline 'Spacing via gap-* inside flex/grid, NOT space-y-*/space-x-*'. More importantly, the values are mismatched for flex-wrap content: gap-y-1 (0.25rem) is too tight when items wrap to multiple lines on mobile, while gap-x-6 (1.5rem) is large horizontally. On 320px screens, 3 stats wrap into 2-3 lines with tight vertical spacing. Compare: companies-table.tsx toolbar uses 'flex flex-wrap items-center gap-2' uniformly. Better approach: use consistent gap-3 or gap-4.
  - Fix: Change to className='text-muted-foreground flex flex-wrap items-center gap-3 text-sm' (unified gap-3) for consistent spacing and better wrap-line breathing room.
- [ ] **[MEDIUM]** RangeToggle creates nested flex containers within PageHeader actions  `consistency` · _alle_
  - Datei: `c:\dev\pauls-autotask-ui\components\time\range-toggle.tsx` · lines 20-39
  - Problem: RangeToggle wraps buttons in flex container with border, padding, gap-1: 'flex items-center gap-1 rounded-lg border p-0.5'. PageHeader actions slot also wraps with 'flex shrink-0 items-center gap-2'. This creates double nesting: PageHeader flex → RangeToggle flex → buttons. Compare: other pages pass single buttons or independent actions without self-wrapping. The self-contained styling (border, padding, rounded-lg) is visually reasonable but structurally redundant with the parent actions container.
  - Fix: Either (A) keep as-is if intentionally a self-contained compound control (document as special case), or (B) flatten by removing border/padding/gap-1 and letting PageHeader handle spacing. Option A is reasonable for a toggle pair; document if keeping.
- [ ] **[LOW]** Mobile card badge + hours line uses justify-between with flex-wrap, causing layout ambiguity  `alignment` · _320-375 (narrow screens where long badge + hours wrapping creates ambiguity)_
  - Datei: `c:\dev\pauls-autotask-ui\components\time\zeiten-table.tsx` · line 74
  - Problem: Card row (line 74) uses 'flex flex-wrap items-center justify-between gap-2'. When badge text is long (e.g., 'Datenbank-Optimierung'), flex-wrap may wrap the badge onto a new line, breaking the justify-between intent. Compare: ticket-card.tsx line 166 uses simpler 'flex flex-wrap items-center gap-1.5' without justify-between. The justify-between is ambiguous under content variance on narrow screens.
  - Fix: Change to 'flex items-center justify-between gap-2' (remove flex-wrap) to enforce single-line layout, OR restructure as: <div>Badge</div><div className='text-right ml-auto'>hours</div> to explicitly handle potential wrapping.
- [ ] **[LOW]** Mobile card title + date line uses items-baseline which may misalign on content variance  `alignment` · _320-375 (long title + date may misalign on baseline)_
  - Datei: `c:\dev\pauls-autotask-ui\components\time\zeiten-table.tsx` · line 52
  - Problem: Line 52-68: title and date in 'flex items-baseline justify-between gap-2'. Baseline alignment can cause visual misalignment between long titles and dates. Compare: ticket-card.tsx line 160 keeps title standalone. The baseline is fragile with content variance.
  - Fix: Change items-baseline to items-center for more robust alignment, OR test with real long-title data to confirm baseline alignment is acceptable.
- [ ] **[NIT]** Empty state has conditional description but static title, could be more context-aware  `consistency` · _alle_
  - Datei: `c:\dev\pauls-autotask-ui\app\(app)\zeiten\page.tsx` · lines 74-87
  - Problem: Empty component shows conditional description ('Für heute...' vs 'Für diese Woche...') but static title 'Keine Zeiten erfasst'. Could show 'Keine Zeiten für heute' as title for even more context. Current pattern is clear and consistent with other pages.
  - Fix: Keep as-is (current pattern is clear and consistent). Optional enhancement: conditionally set emptyTitle for more context.
- [ ] **[NIT]** PageHeader description is generic, could emphasize action  `typography` · _alle_
  - Datei: `c:\dev\pauls-autotask-ui\app\(app)\zeiten\page.tsx` · line 45
  - Problem: Description: 'Deine erfassten Zeiten – heute oder in dieser Woche.' Clear but generic. Could rephrase to highlight RangeToggle action: 'Wähle einen Zeitraum, um deine erfassten Zeiten zu sehen.' Very minor UX polish.
  - Fix: Keep as-is (description is adequate). Optional: rephrase for proactive guidance.
- [ ] **[NIT]** Range defaulting logic duplicated between page and RangeToggle  `consistency` · _alle_
  - Datei: `c:\dev\pauls-autotask-ui\app\(app)\zeiten\page.tsx` · lines 29, 82-85
  - Problem: Line 29: page defaults range to 'today'. Line 8-14: RangeToggle hardcodes 'today' and 'week' strings. Logic is duplicated but acceptable (page is data layer, RangeToggle is UI). Not a bug.
  - Fix: No change. Separation of concerns (page data, RangeToggle UI) is appropriate.
- [ ] **[NIT]** RangeToggle buttons lack aria-pressed for toggle semantics  `accessibility` · _alle_
  - Datei: `c:\dev\pauls-autotask-ui\components\time\range-toggle.tsx` · lines 20-21
  - Problem: Buttons toggle between 'today' and 'week' modes but have no aria-pressed. Sighted users see visual state (variant ghost/default), but screen readers don't announce which button is active. Functional but not accessible.
  - Fix: Add aria-pressed={range === 'today'} to first button and aria-pressed={range === 'week'} to second for screen reader clarity. Low priority but improves WCAG compliance.
- [ ] **[NIT]** RangeToggle tightly couples TimeRange type, acceptable for this specific component  `other` · _alle_
  - Datei: `c:\dev\pauls-autotask-ui\components\time\range-toggle.tsx` · line 1-40
  - Problem: Imports TimeRange type from my-time.ts. Component is intentionally time-specific and hardcodes 'today' and 'week'. Appropriate coupling for this specialized control, not a bug.
  - Fix: No change. Current coupling is appropriate.
- [ ] **[NIT]** Date formatting functions duplicated instead of centralized in lib/format.ts  `consistency` · _alle_
  - Datei: `c:\dev\pauls-autotask-ui\components\time\zeiten-table.tsx` · lines 22-37
  - Problem: ZeitenTable defines fmtDate() and dateSort() locally. lib/format.ts houses formatHours() and formatCurrency() but not date formatters. This represents a minor DRY gap if similar formatting is needed elsewhere. Currently local; acceptable if table is the only consumer.
  - Fix: Optional: extract fmtDate and dateSort to lib/format.ts as formatShortDateDE() and parseDateSort() for consistency and potential reuse. Keep local if table-specific.
- [ ] **[NIT]** Desktop table hour columns use inconsistent text styling (bold vs. muted)  `consistency` · _alle_
  - Datei: `c:\dev\pauls-autotask-ui\components\time\zeiten-table.tsx` · lines 141-151
  - Problem: Dauer column: 'text-right font-medium'. Abrechenbar column: 'text-right text-muted-foreground' (no bold). Semantically: Dauer is primary/emphasized, Abrechenbar is secondary. Reasonable UX (highlights actual work) but not documented. Minor stylistic choice.
  - Fix: Keep as-is if hierarchy is intentional. Document or consider applying secondary styling more broadly for consistency.
- [ ] **[NIT]** Mobile card hours line has hardcoded dot separator and potential wrap awkwardness  `responsive` · _320 (narrow, potential clutter if badge + hours wrap)_
  - Datei: `c:\dev\pauls-autotask-ui\components\time\zeiten-table.tsx` · lines 80-86
  - Problem: Line 80-86: hours + muted text with '· abr. X Std'. On 320px with long badge, the hours line may wrap to a third line, creating clutter. Separator is hardcoded text, not semantic.
  - Fix: Keep as-is if acceptable. Optional: restructure as separate flex container to prevent wrapping with badge, or test with real data. Very minor polish.
- [ ] **[NIT]** Column key 'activity' doesn't match header 'Tätigkeit' (inconsistent naming convention)  `other` · _alle_
  - Datei: `c:\dev\pauls-autotask-ui\components\time\zeiten-table.tsx` · lines 126-127
  - Problem: Column key (line 126) is 'activity' (English) but header (line 127) is 'Tätigkeit' (German). Other columns: 'date'/Datum, 'ticket'/Ticket, 'dauer'/Dauer, 'bill'/Abrechenbar. Mix of English keys and German headers is inconsistent but functional.
  - Fix: Optional: standardize to all-German or all-English keys ('tätigkeit' or 'activity'). Keep as-is if this table is sole consumer and pattern is clear.
- [ ] **[NIT]** ZeitenTable doesn't explicitly set SearchableTable minWidthClass (uses default min-w-2xl)  `consistency` · _alle_
  - Datei: `c:\dev\pauls-autotask-ui\components\time\zeiten-table.tsx` · line 45
  - Problem: ZeitenTable uses SearchableTable default minWidthClass='min-w-2xl' (448px). Reasonable for 5-column table, consistent with other tables. No issue, just noting the implicit default.
  - Fix: No change. Current default is reasonable. Optional: add explicit minWidthClass='min-w-2xl' comment for clarity if concerned about column width justification.

### Search + Command Palette

_16 Befunde — 1 High · 7 Medium · 7 Low · 1 Nit_

- [ ] **[HIGH]** Command Palette search input is raw HTML, not shadcn Input component  `component-sourcing` · _alle_
  - Datei: `components/command-palette.tsx` · line 239-255 (input element inside search container)
  - Problem: The search input in the command palette (line 239-255) is a raw HTML `<input>` element instead of using the shadcn `<Input>` component. This creates a second instance of off-system markup for search and bypasses centralized input styling, focus ring, and accessibility features.
  - Fix: Use the `<Input>` component from `components/ui/input.tsx` instead. Keep the custom className for the large h-14 size (or adjust to h-11 sm:h-14 for better mobile touch targets).
- [ ] **[MEDIUM]** Search input height inconsistency across the app (SearchBox vs Palette vs SearchableTable)  `consistency` · _alle_
  - Datei: `components/command-palette.tsx` · line 237 (search input container), line 254 (input padding/styling)
  - Problem: Three different heights are used for search inputs: SearchableTable = h-11/sm:h-9; SearchBox = h-12 (non-responsive); Command Palette = h-14 (non-responsive). These should all follow the same baseline. Users see three visually distinct search experiences in different contexts, breaking visual language consistency.
  - Fix: Standardize all search inputs to h-11/sm:h-9 (or provide a reusable SearchInput component that encodes this pattern). The Palette can override to h-11/sm:h-14 if the larger desktop size is intentional (Spotlight pattern).
- [ ] **[MEDIUM]** Navigation suggestion buttons in palette use custom styling instead of Button component  `component-sourcing` · _alle_
  - Datei: `components/command-palette.tsx` · lines 266-276 ("Springen zu" nav buttons)
  - Problem: The "Springen zu" buttons (lines 266-276) are raw `<button>` elements with custom Tailwind classes rather than using the shadcn `<Button>` component. This repeats button styling across multiple places instead of centralizing it.
  - Fix: Use `<Button variant='ghost' size='sm'>` or similar for these navigation triggers. Ensures consistent button behavior across the app.
- [ ] **[MEDIUM]** "Mehr laden" button uses custom styling instead of Button component  `component-sourcing` · _alle_
  - Datei: `components/search/result-column.tsx` · line 102-106 ("Mehr laden" button)
  - Problem: The "Mehr laden" button (line 98-106) is implemented as a raw `<button>` element with inline Tailwind classes ('text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring mt-1 min-h-11 rounded-lg px-2 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 disabled:opacity-50 sm:min-h-0') instead of using the shadcn `<Button>` component. This duplicates button styling that should be centralized.
  - Fix: Replace with `<Button variant='ghost' size='sm'>` or similar, letting Button handle the styling. The responsive touch target (min-h-11 sm:min-h-0) is correct and can be passed as className override.
- [ ] **[MEDIUM]** Result row button/link touch target too small on mobile  `touch-target` · _<768_
  - Datei: `components/search/result-column.tsx` · lines 79-93 (row buttons/links)
  - Problem: Result row buttons (lines 79-93) use 'py-1.5' (0.375rem) vertical padding + 'text-sm' line height (~1rem) = approximately 2.5rem total height. This is below the recommended 44px (h-11 = 2.75rem) touch target for mobile. Users may have difficulty tapping individual results on phones.
  - Fix: Increase vertical padding to achieve min-h-11 on mobile. Change 'py-1.5' to 'py-2 sm:py-1.5' or wrap content in a container with 'min-h-11 sm:min-h-0'. Alternatively use the Button component which handles sizing.
- [ ] **[MEDIUM]** Result list internal scroll creates layout shift at sm breakpoint  `responsive` · _320, 375, 414, 640_
  - Datei: `components/search/result-column.tsx` · line 76 (ul overflow behavior)
  - Problem: The result list uses 'flex max-h-[45vh] flex-col overflow-y-auto sm:max-h-none sm:overflow-visible'. On mobile (<640px) the list is constrained to 45% viewport height and scrolls internally. At sm (>=640px) it becomes unrestricted and relies on parent scroll. This creates a responsive layout shift: the list behaves as a contained scroll box below sm, then as an infinite flex column at sm+. At the 639 to 640px transition, content layout changes.
  - Fix: Either: (1) Keep max-h-[45vh] at all sizes for consistent scrolling behavior; (2) Use a media-query-based approach in JavaScript to manage scrolling based on actual space; or (3) Wrap results in a consistently-scrolling container at all widths. Document the intentional shift in comments if it is deliberate design.
- [ ] **[MEDIUM]** Dense mode ResultGrid loses border while non-dense mode keeps it  `consistency` · _alle_
  - Datei: `components/search/result-column.tsx` · lines 113-135 (ResultGrid component)
  - Problem: ResultGrid applies 'overflow-hidden rounded-lg border' only when dense=false. When dense=true (used in the command palette), the grid has 'max-h-[60dvh] overflow-y-auto sm:max-h-96' but NO border, leaving it visually undefined. This creates an inconsistency: the search results on /search page have a visible border, but the same results in the palette are borderless. The gap-px between columns creates a visual separation (bg-border), but the outer container lacks framing.
  - Fix: Apply 'rounded-lg border' consistently to both dense and non-dense modes, or explicitly remove both for a cleaner look. Currently the asymmetry is confusing. If dense mode should be borderless for modal intent, add a comment explaining this design choice.
- [ ] **[MEDIUM]** SearchBox input height is hardcoded and not responsive  `touch-target` · _<1280_
  - Datei: `components/search/search-box.tsx` · line 30 (className='h-12 pl-11 text-base')
  - Problem: The input has a fixed height of h-12 (3rem) with no responsive variation. Per the design system baseline (SearchableTable), mobile search inputs should be h-11 (2.75rem) and downsize to sm:h-9 (2.25rem) on desktop. This input remains at h-12 across all widths, which is 8px taller than the mobile standard and wastes vertical space on small screens.
  - Fix: Change className from 'h-12 pl-11 text-base' to 'h-11 pl-9 sm:h-9 text-base' to match SearchableTable baseline and provide responsive downsizing.
- [ ] **[LOW]** Command Palette input height is not responsive and oversized on mobile  `touch-target` · _<640_
  - Datei: `components/command-palette.tsx` · line 254 (className='h-14 w-full bg-transparent text-base outline-none')
  - Problem: The search input in the command palette has a hardcoded h-14 (3.5rem = 56px) height with no responsive downsizing. This is taller than the standard mobile touch target (44px per design system). On mobile devices, this wastes 12px of vertical space. The input should respond at the sm breakpoint to a smaller size, consistent with SearchBox and SearchableTable baselines.
  - Fix: Change 'h-14' to 'h-11 sm:h-14' so the input is 2.75rem (44px) on mobile and 3.5rem (56px) on sm and above.
- [ ] **[LOW]** Navigation suggestions hidden on mobile when palette opens empty  `consistency` · _<640_
  - Datei: `components/command-palette.tsx` · line 261-278 (hidden p-2 sm:block)
  - Problem: The 'Springen zu' section uses 'hidden p-2 sm:block', so navigation options only appear at sm (640px) and above. When users open the palette on mobile with an empty query, they see only the search input with no guidance about where to navigate. At sm+, they see navigation options. This creates asymmetric UX between mobile and desktop, though the code comment indicates this is intentional (Paul-Feedback).
  - Fix: This is documented as intentional, so no fix required. However, consider showing at least a hint text (e.g., 'Type to search or enter to view full search page') on mobile instead of blank space, to guide first-time users.
- [ ] **[LOW]** Search icon size inconsistency in command palette  `other` · _alle_
  - Datei: `components/command-palette.tsx` · lines 237-256 (search input container and input styling)
  - Problem: The search icon in the command palette input is 'size-5' (1.25rem), while result column icons are 'size-3.5' (0.875rem) and nav icons are 'size-4' (1rem). This is likely intentional (search icon should be more prominent), but creates visual hierarchy shifts depending on which search UI the user is in.
  - Fix: Either standardize to a single icon size (probably size-4 or size-5 for all) and rely on placement for hierarchy, or document the intentional size differences. If intentional, this is acceptable; just ensure consistency across similar contexts.
- [ ] **[LOW]** Focus ring width inconsistency between input and buttons  `accessibility` · _ale_
  - Datei: `components/command-palette.tsx` · lines 237-256 (dialog container) and line 254 (input)
  - Problem: The Input component (from ui/input.tsx) uses 'focus-visible:ring-3' (3px ring), while result row buttons and nav suggestion buttons use 'focus-visible:ring-2' (2px ring). This inconsistency in focus indicator thickness may confuse keyboard navigators about which element has focus. The visual weight is different depending on whether you are focusing an input or a button.
  - Fix: Standardize to 'focus-visible:ring-3' across all interactive elements for consistency. This is a minor accessibility/consistency issue, not a blocker.
- [ ] **[LOW]** DialogContent uses gap-0 which removes spacing between sections  `spacing` · _ale_
  - Datei: `components/command-palette.tsx` · lines 222-227 (DialogContent className)
  - Problem: The DialogContent has 'gap-0' (line 227), which removes the default gap-4 between flex children. This means the search input (border-b), the results grid, and the footer hint are tightly packed with no visual breathing room between sections. Each section relies on its own internal padding (e.g., p-2, px-4 py-2) to create separation, leading to inconsistent gap widths.
  - Fix: Change 'gap-0' to 'gap-1' or 'gap-2' to provide consistent spacing between the three main sections (input bar, results grid, footer). Or, if gap-0 is intentional for a compact modal look, ensure each section is padding is intentionally designed to work with zero gap.
- [ ] **[LOW]** Loading state uses plain text instead of skeleton or structured indicator  `state` · _alle_
  - Datei: `components/search/result-column.tsx` · lines 71-75 (loading state)
  - Problem: When loading, ResultColumn displays 'Suchen...' as plain text. This is inconsistent with the app's skeleton pattern (components/skeletons.tsx) which uses structured Skeleton components that mirror the real layout. A loading skeleton would provide visual consistency and better prepare the user for what is coming.
  - Fix: Replace the 'Suchen...' text with a skeleton that mirrors the result row structure (e.g., 2-3 lines of Skeleton components stacked vertically). This aligns with the app's loading state design system.
- [ ] **[LOW]** SearchBox form lacks explicit mobile max-width constraint  `responsive` · _1440, 1920_
  - Datei: `components/search/search-box.tsx` · line 23 (form element)
  - Problem: The form has 'max-w-2xl' but no mobile-specific max-width or constraint. It relies on the parent page container's padding (p-4 md:p-6) for left/right margins. At very wide screens (1440+), the form maxes at 672px, which is reasonable, but there is no explicit mobile constraint. This works, but is less explicit than could be.
  - Fix: This is low priority (works as-is), but could add 'sm:max-w-xs md:max-w-2xl' to be more explicit about the progressive width at different breakpoints. Currently relies on implicit page container behavior.
- [ ] **[NIT]** DialogContent uses rounded-xl while most components use rounded-lg  `consistency` · _ale_
  - Datei: `components/command-palette.tsx` · line 227 (DialogContent className)
  - Problem: The DialogContent inherits 'rounded-xl' from the dialog base component, while most other components in the app (buttons, inputs, cards) use 'rounded-lg'. This is a subtle style shift. It is likely intentional for modals to have slightly more rounded corners, but it is worth noting for consistency audits.
  - Fix: This is stylistic and likely intentional. No fix required unless a global rounding audit decides to standardize all to lg or xl.

### Vertrieb (Rechnungen/Angebote/Verträge)

_10 Befunde — 2 High · 5 Medium · 3 Low · 0 Nit_

- [ ] **[HIGH]** Toolbar select controls use inconsistent !important flags (h-9 vs h-9!)  `alignment` · _sm+_
  - Datei: `components/vertrieb/grouped-list.tsx` · lines 199, 213, 238, 279
  - Problem: Search: `h-11 sm:h-9` (no !). Group-by: `h-11 sm:h-9!` (has !). Filter button: `h-11 sm:h-9` (no !). Filter sheet selects: `h-11 sm:h-9!` (has !). Mixing ! flags indicates unresolved CSS conflicts.
  - Fix: Determine if SelectTrigger's default styles (data-[size=default]:h-8 sm:data-[size=default]:h-8) override h-9. If so, apply ! consistently or refactor SelectTrigger to respect external h-* classes.
- [ ] **[HIGH]** VertriebTabs use sm:h-8 instead of sm:h-9, breaking toolbar alignment  `touch-target` · _<640px: h-11 (44px, correct); sm+: h-8 (32px, WRONG; should be h-9 = 36px)_
  - Datei: `components/vertrieb/vertrieb-tabs.tsx` · line 36
  - Problem: Tabs render as `h-11 flex-1 sm:h-8 sm:flex-none`, making desktop tabs 32px tall. Other toolbar controls (search, selects) use h-9 (36px) on desktop. This creates 4px vertical misalignment.
  - Fix: Change line 36 to `className="h-11 flex-1 sm:h-9 sm:flex-none"` to align with search input and select height.
- [ ] **[MEDIUM]** FieldGrid column span jumps from 1→2→3 without md breakpoint smoothing  `responsive` · _768-1024px (sparse 2-col), 1024px+ (jumps to dense 3-col)_
  - Datei: `components/vertrieb/detail-rail.tsx` · line 20
  - Problem: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` means 1-col (<640px), 2-col (640-1024px), 3-col (1024px+). At 768-1024px (md), still 2-col; at 1024px jumps to 3-col, which can look cramped with few fields.
  - Fix: Consider adding md:grid-cols-3 to shift 3-column layout to 768px, or test current spacing and accept if it looks balanced.
- [ ] **[MEDIUM]** Toolbar layout grid-to-flex transition at sm may cause reflow at 640-750px  `responsive` · _640-750px (sm breakpoint transition)_
  - Datei: `components/vertrieb/grouped-list.tsx` · lines 192-328
  - Problem: Mobile: `flex flex-col gap-2`, with controls in `grid grid-cols-2` wrapper (line 205). At sm: `sm:flex-row sm:flex-wrap`. The grid (2 cols) switches to flex row wrap, potentially causing layout shift if controls don't fit in one row at 640px.
  - Fix: Test at 640-750px. If wrapping occurs unexpectedly, either reduce search width (sm:w-48 instead of sm:w-64) or add explicit flex-nowrap.
- [ ] **[MEDIUM]** Filter sheet SelectTrigger uses h-11 sm:h-9!, but SelectItem uses min-h-11 sm:min-h-0  `touch-target` · _sm+_
  - Datei: `components/vertrieb/grouped-list.tsx` · line 284
  - Problem: Trigger and items have different sizing strategies: trigger forces h-9! desktop, items allow min-h-0. If SelectTrigger's sm:h-9! needs !important, consistency requires SelectItem to also force min-h-0.
  - Fix: Ensure SelectTrigger and SelectItem sizing align in approach (either both use !, or neither).
- [ ] **[MEDIUM]** Inconsistent !important flag on sm:h-9! in period-select trigger  `alignment` · _sm+_
  - Datei: `components/vertrieb/period-select.tsx` · line 45
  - Problem: Uses `sm:h-9! sm:w-auto` while grouped-list selects use `sm:h-9` (without !). The !important suggests a workaround for specificity conflicts; if applied here, it should be applied everywhere consistently.
  - Fix: Audit why sm:h-9! needs !important. Remove all ! flags and refactor to rely on natural CSS cascade if possible.
- [ ] **[MEDIUM]** Period-select trigger uses w-full min-w-0 on mobile, can cause icon/text clipping at 320px  `responsive` · _320-414px_
  - Datei: `components/vertrieb/period-select.tsx` · lines 43-50
  - Problem: Mobile trigger: `w-full min-w-0`. The min-w-0 overrides default min-w, allowing the trigger to shrink below content width. On 320px with icon + long text, content can truncate unexpectedly.
  - Fix: Replace `w-full min-w-0` with `w-full` to maintain minimum readable width. Or wrap in a flex container with `min-w-32`.
- [ ] **[LOW]** Detail page wrapper uses gap-4, while list pages use gap-6  `spacing` · _All_
  - Datei: `app/(app)/vertrieb/rechnungen/[id]/page.tsx` · line 60
  - Problem: Detail: `flex flex-col gap-4`. Lists: gap-6. Minor inconsistency in vertical spacing hierarchy.
  - Fix: Decide if gap-4 (detail) vs gap-6 (list) is intentional. If so, document. If not, standardize to gap-6.
- [ ] **[LOW]** Mobile card combines company and date with ' · ' separator, no wrap handling  `responsive` · _<375px_
  - Datei: `components/vertrieb/invoices-list.tsx` · line 127
  - Problem: Card renders `{(r.companyName || "—") + " · " + formatDate(r.date)}` in one line. Long company names can wrap, hiding the date.
  - Fix: Optionally add `truncate` or `line-clamp-1` to keep one line, or structure as flex items with individual truncation.
- [ ] **[LOW]** CalendarRangeIcon is always size-4, doesn't scale down on very narrow mobile  `responsive` · _320-375px_
  - Datei: `components/vertrieb/period-select.tsx` · line 47
  - Problem: Icon doesn't scale responsively; on 320px viewport, it may consume visible space. Modern phones handle it, but very narrow translations could cause text to wrap.
  - Fix: Optionally hide icon on mobile (sm:block) or accept current sizing as acceptable for modern devices.

### Global Chrome (Sidebar / Header / Nav / Bottom-Nav)

_16 Befunde — 0 High · 6 Medium · 9 Low · 1 Nit_

- [ ] **[MEDIUM]** Header inner layout (gap-2, px-4 md:px-6) creates inconsistency with page content  `spacing` · _alle_
  - Datei: `app/(app)/layout.tsx` · line 61
  - Problem: Header uses 'gap-2 px-4 md:px-6' while content below uses 'p-4 md:p-6 gap-6'. Header has gap-2 (8px) between elements, page has gap-6 (24px) between sections. This creates visual tension: header feels cramped (8px gaps) vs. content airy (24px gaps). Additionally, header padding (px-4/px-6) is inline padding only; no top/bottom padding inside header element (pt only for safe-area, no vertical padding).
  - Fix: Rationalize: 'gap-3 md:gap-4' in header (16-24px), and consider adding minimal y-padding for text alignment: 'py-2' to ensure header text has breathing room regardless of icon heights.
- [ ] **[MEDIUM]** Header button/control row has no flex-wrap or width constraints, risks overflow on narrow viewports  `responsive` · _320-768px (mobile/tablet before md breakpoint)_
  - Datei: `app/(app)/layout.tsx` · line 72
  - Problem: 'div className="ml-auto flex items-center gap-2"' contains HeaderSearch (w-56 at md+), MockUserSwitcher (h-11 sm:h-7), ThemeToggle (h-8), and HeaderAutotaskLink (h-9 md:hidden). No max-width or flex-shrink constraints. On 375px viewport with many elements visible, could cause horizontal overflow or misalignment without explicit gap/padding management.
  - Fix: Wrap controls in constrained container: 'gap-2 flex-wrap min-w-0' or use 'flex-shrink' on HeaderSearch: 'flex-shrink flex-grow-0' to prevent overflow.
- [ ] **[MEDIUM]** HeaderAutotaskLink has conflicting size on mobile (h-9 instead of h-11)  `responsive` · _<768px (mobile only)_
  - Datei: `components/header-autotask-link.tsx` · line 38
  - Problem: Button uses 'h-9 md:hidden' (36px on mobile). This violates the 44px touch-target rule for mobile interactive elements. All other mobile header controls (back, logo) use h-11 or size-11. This button should be 'h-11 md:hidden' to match touch-target requirements on mobile.
  - Fix: Change to 'h-11 md:hidden' to meet 44px minimum touch target on mobile, matching HeaderBack and HeaderLogo sizing.
- [ ] **[MEDIUM]** Header Search button width causes layout brittleness at md breakpoint  `responsive` · _hidden until 768px (md), then w-56, then lg:w-72 at 1024px_
  - Datei: `components/header-search.tsx` · line 32
  - Problem: Button is 'hidden w-56 justify-between font-normal md:flex lg:w-72'. At exactly 768px (md breakpoint), the button appears/disappears without intermediate sizing. On tablets (768-1024px), search is w-56 (224px) which may crowd the header if title grows. No responsive sizing between md:w-56 and lg:w-72.
  - Fix: Add intermediate breakpoint: 'md:w-48 lg:w-56 xl:w-72' to scale search width smoothly and provide space reserve on tablets.
- [ ] **[MEDIUM]** MockUserSwitcher has inverted height logic  `responsive` · _< 640px: 44px, ≥640px: 28px_
  - Datei: `components/mock-user-switcher.tsx` · line 38
  - Problem: Button uses 'h-11 sm:h-7' which means: mobile (h-11, 44px) becomes SHORTER on sm+ (h-7, 28px). This inverts the touch-target rule (≥44px on mobile only) — desktop should use h-9 (36px) or h-8 (32px) to match other header controls, not h-7. Render prop: 'size="sm" className="h-11 sm:h-7"'
  - Fix: Change to 'h-11 sm:h-9' to maintain ≥44px mobile touch targets and use h-9 desktop consistency with HeaderSearch/HeaderAutotaskLink.
- [ ] **[MEDIUM]** SearchableTable uses xl:hidden (1280px+) but most pages reference md/lg breakpoints  `responsive` · _768-1024px (md-lg gap), 1024-1280px (lg-xl gap)_
  - Datei: `components/searchable-table.tsx` · line 160
  - Problem: Card/Table toggle: 'grid grid-cols-1 md:grid-cols-2 xl:hidden' means cards show at 0-1280px, table at 1280px+. This is a 1280px breakpoint. Compare: Skeleton component mentions 'breakpoint' param with md/lg/xl options; SearchableTable hardcodes xl. Some pages may use different breakpoints (lg), creating inconsistency. The gap at 768-1280px (cards=2 cols) can be awkwardly narrow on 1024px tablets.
  - Fix: Review all table-using pages; if they all use xl, document as standard. If mixed, add 'tableBreakpoint' prop to SearchableTable. For 1024px tablets with 2-col cards: consider 'md:grid-cols-2 lg:grid-cols-3 xl:hidden' for better density.
- [ ] **[LOW]** Header min-h-16 (64px) is oversized for mobile context  `consistency` · _alle (320-1920)_
  - Datei: `app/(app)/layout.tsx` · line 60
  - Problem: Header uses 'min-h-16' (64px) across all sizes. On mobile, this creates vertical density mismatch: bottom-nav tabs are h-14 (56px), but header is min-h-16 (64px) + 1rem padding below = 72px+ total. Header should be more compact on mobile (e.g., min-h-14 or conditional). Currently: Logo (size-11 = 44px) + padding leave 20px+ vertical whitespace in header on mobile.
  - Fix: Add 'md:min-h-16' and use 'min-h-14' as mobile default to compress header: 'header className="... min-h-14 md:min-h-16 ..."'
- [ ] **[LOW]** AppSidebar uses 'mobileSide="right"' but default is 'left'  `consistency` · _mobile (<768px) in sheet mode_
  - Datei: `components/app-sidebar.tsx` · line 85
  - Problem: Sidebar opens from the right on mobile ('mobileSide="right"') due to explicit prop. This is intentional but undocumented in the chrome — most apps expect left sidebar. Right-side sheet is used to avoid covering left-aligned content on mobile, but the convention differs from standard. If users have muscle memory for left nav, this may feel surprising.
  - Fix: Document the choice in comments, or verify with mobile UX testing. If right-side is correct, ensure backdrop/sheet animation is smooth and sheet fully covers content area without edge leakage.
- [ ] **[LOW]** Back button uses size-11 (44px) while HeaderLogo also uses size-11  `consistency` · _mobile (<768px)_
  - Datei: `components/header-back.tsx` · line 44
  - Problem: Both HeaderBack and HeaderLogo render at 'size-11 md:hidden' (44px square, 100% touch target). When both appear on detail-list routes (edge case), they're identical in size but semantically different (logo link vs. action button). No visual distinction.
  - Fix: Add visual hierarchy: Keep size-11 for touch, but add subtle styling difference (e.g., Back uses 'variant="ghost"' while Logo uses a plain link with no button styling) or reorder to be semantically clear.
- [ ] **[LOW]** HeaderLogo link uses size-11 but has -ml-1 which reduces effective hit area  `touch-target` · _mobile (<768px)_
  - Datei: `components/header-logo.tsx` · line 26
  - Problem: Logo is 'flex size-11 items-center justify-center -ml-1 md:hidden'. The -ml-1 (-4px) reduces left edge padding, making the left side of the touch target narrower. Combined with header's px-4 (16px padding), the effective clickable area on the left edge is: 16px - 4px = 12px. This is below the comfortable touch target recommendation for edge cases.
  - Fix: Remove -ml-1 or add 'pl-1' offset elsewhere to restore full 44px touch target, or document as intentional to align logo visually closer to edge.
- [ ] **[LOW]** HeaderTitle span uses text-sm (14px) but doesn't declare line-height  `alignment` · _alle, especially <375px narrow screens_
  - Datei: `components/header-title.tsx` · line 56
  - Problem: Title is 'text-sm font-medium' without explicit line-height, relying on inherited base (likely 1.5 default). On 320px mobile (min-width design), if title wraps or next to icon, line-height mismatch with header's flex items-center (vertical center) can misalign text baseline. No min-w constraint on header container to reserve title space.
  - Fix: Add 'leading-tight' or 'leading-4' to title and ensure header gap-2 reserves enough space: 'flex-1 min-w-0' on title wrapper.
- [ ] **[LOW]** Bottom-nav padding calculation is fragile and undocumented  `spacing` · _mobile only (md:hidden)_
  - Datei: `components/mobile-bottom-nav.tsx` · line 65
  - Problem: Nav uses 'pb-[env(safe-area-inset-bottom)] md:hidden' with no explicit height. Height comes from 'h-14' (56px) on each tab button, but nav itself has no declared height. If any button grows (e.g. h-16), nav height floats. Layout padding (app/(app)/layout.tsx line 94) hard-codes 'pb-[calc(4.5rem+env(safe-area-inset-bottom))]' which assumes h-14 + 1rem gap = 4.5rem. If nav or gap changes, padding breaks.
  - Fix: Add CSS variable: define '--bottom-nav-height: 3.5rem;' in globals.css, use in both bottom-nav and layout padding: 'pb-[calc(var(--bottom-nav-height)+1rem+env(safe-area-inset-bottom))]'
- [ ] **[LOW]** Bottom-nav active state styling uses ternary color but no background highlight  `alignment` · _mobile only (<768px)_
  - Datei: `components/mobile-bottom-nav.tsx` · line 78-80
  - Problem: Active tab is 'active ? "text-primary" : "text-muted-foreground"' (color change only). Other interactive elements (sidebar active, form focus) use background color changes for visibility. Bottom-nav active state is text-color-only, which may be hard to see on muted backgrounds or at a glance. No background, no underline, only text color change.
  - Fix: Add subtle background on active tab: 'active ? "bg-primary/5 text-primary" : "text-muted-foreground"' or use border-top bar pattern common in mobile nav design.
- [ ] **[LOW]** Sidebar nav button height (h-10) differs from spec pattern  `consistency` · _md+ (desktop/expanded sidebar only)_
  - Datei: `components/nav-main.tsx` · line 53
  - Problem: SidebarMenuButton uses 'h-10 gap-3 [&>svg]:size-5' (40px height, 20px icon). This is taller than standard form controls (h-9 = 36px) but not declared as a 'touch-optimized' pattern like bottom-nav (h-14). Sidebar is always desktop (md+), so <44px is acceptable, but h-10 creates density mismatch vs. h-9 desktop buttons elsewhere. Consistency rule: all non-sidebar desktop buttons should be h-8 or h-9, sidebar nav can be h-9 or h-10.
  - Fix: Standardize sidebar nav to 'h-9 gap-2' to match desktop form controls, or document h-10 as 'comfort padding' for sidebar specifically and update all sidebar buttons consistently.
- [ ] **[LOW]** Theme toggle button lacks explicit size on mobile header  `state` · _<768px: hidden; ≥768px: h-8 (32px, below touch target)_
  - Datei: `components/theme-toggle.tsx` · line 22
  - Problem: Button renders as 'variant="outline" size="icon"' with no explicit height. Size 'icon' defaults to 'size-8' (32px, h-8 w-8) per button.tsx line 28. This is <44px and violates touch target rule on mobile. Header hides it on mobile anyway ('hidden md:inline-flex'), but the pattern is inconsistent: MobileBottomNav handles touch targets properly (h-11 mobile), but desktop-only header controls don't declare fallback heights.
  - Fix: If ever shown on mobile, use 'size="icon-lg"' (h-9 w-9) as fallback, or rely on 'hidden md:inline-flex' as-is if intentional desktop-only.
- [ ] **[NIT]** Badge positioning uses hardcoded offsets (-top-1.5 -right-4.5)  `alignment` · _mobile only_
  - Datei: `components/mobile-bottom-nav.tsx` · line 40
  - Problem: Badge uses 'absolute -top-1.5 -right-4.5' (magic numbers: -6px/-18px) instead of using calc based on icon/button size. If icon size changes (currently [&>svg]:size-5 = 20px), badge position remains fixed, misaligning the badge relative to the icon.
  - Fix: Use calc offsets: '-top-[calc(var(--icon-size)/2)] -right-[calc(var(--icon-size)/2)]' or replace with CSS grid overlay for badge positioning.

### Shared Primitives + Empty/Loading/Error States

_13 Befunde — 1 High · 8 Medium · 3 Low · 1 Nit_

- [ ] **[HIGH]** StatusDot uses inline style with hardcoded hex colors from statusColor(), not semantic tokens  `color-token` · _dark mode (colors don't adapt)_
  - Datei: `c:\dev\pauls-autotask-ui\components\status-indicator.tsx` · line 18
  - Problem: Line 18: 'style={{ backgroundColor: statusColor(status) }}' applies hardcoded hex strings (#eab308, #ef4444, etc. from mappers.ts lines 56-77) instead of semantic tokens. These colors don't adapt in dark mode—the hex #eab308 (yellow) is fixed regardless of dark/light mode. Compare with Badge, which uses semantic variants (destructive, success, warning) that automatically adapt via globals.css dark mode overrides.
  - Fix: Refactor statusColor() to return token-based class names or CSS variable names (e.g., 'bg-warning', 'bg-destructive') instead of hex strings. Apply as className instead of inline style. Alternatively, define CSS variables (--status-high-color, etc.) in globals.css and use in the inline style: `style={{ backgroundColor: 'var(--status-high-color)' }}`, with dark mode overrides for each.
- [ ] **[MEDIUM]** SelectTrigger in filter toolbar uses h-11 sm:h-9! with !important to override component default  `alignment` · _sm-1280 (filter row with misaligned heights until override applied)_
  - Datei: `c:\dev\pauls-autotask-ui\components\companies\companies-table.tsx` · line 247
  - Problem: Line 247: `className="h-11 w-full min-w-0 sm:h-9! sm:w-auto sm:min-w-40"`. The !important override is required because SelectTrigger defaults to sm:h-8, but this toolbar's Input uses sm:h-9. This workaround creates fragility—every filter select across the codebase must apply the same override. The corresponding Input on line 236 uses 'h-11 pl-9 sm:h-9' without !important, showing the inconsistency.
  - Fix: Fix the root cause in select.tsx by changing the default to sm:h-9, then remove all !important overrides from filter toolbars (companies-table, contacts-table, projects-list, bulk-bar, etc.).
- [ ] **[MEDIUM]** DataError renders bare Alert instead of using Empty component structure for consistency  `component-sourcing` · _all_
  - Datei: `c:\dev\pauls-autotask-ui\components\data-error.tsx` · line 15
  - Problem: DataError (line 15) renders 'Alert variant="destructive"' directly with AlertCircleIcon, AlertTitle, and AlertDescription. This differs from the Empty component pattern (flex column, centered, gap-4, bordered) used elsewhere. An error state and empty state are both 'null result' conditions and should render consistently. Alert is a different visual treatment that's not documented in the primitives.
  - Fix: Consider wrapping DataError in the Empty component structure or creating an ErrorState component that mirrors Empty's flex/center/gap pattern. Alternatively, document why DataError uses Alert instead and ensure both patterns are applied consistently across error scenarios.
- [ ] **[MEDIUM]** PriorityBadge manually overrides classes for priority 1 (Hoch) instead of using centralized variant mapping  `consistency` · _all_
  - Datei: `c:\dev\pauls-autotask-ui\components\priority-indicator.tsx` · line 22
  - Problem: Line 22 uses 'className={cn("border-destructive/40 text-destructive", className)}' to hardcode styling for priority 1, rather than delegating to badgeVariants. The comment (lines 5-8) explains the intent (Hoch = outline-red, distinct from Kritisch), but the implementation bypasses priorityVariant(). If mappers.priorityVariant ever changes, this special case might not align.
  - Fix: Add a dedicated badge variant (e.g., 'priority-high') to badgeVariants in ui/badge.tsx and return it from priorityVariant(priority=1) in mappers.ts. Remove the manual className override from PriorityBadge to centralize the logic.
- [ ] **[MEDIUM]** FiltersSkeleton uses grid layout, but real filter toolbars use flex flex-wrap  `consistency` · _tablet (600-1000px, grid vs flex behavior differs)_
  - Datei: `c:\dev\pauls-autotask-ui\components\skeletons.tsx` · lines 45-56 (FiltersSkeleton)
  - Problem: FiltersSkeleton (lines 45-56) renders filters in a grid: 'grid w-full gap-2' with 'grid-cols-2 sm:grid-cols-4'. However, real filter toolbars in companies-table.tsx (line 229), contacts-table.tsx (line 206), etc. use 'flex flex-wrap items-center gap-2'. The grid layout has fixed columns (2 → 4), while flex-wrap reflflows dynamically. This mismatch means the skeleton can look visually different from the real filters, especially on narrow tablets where grid might force awkward column breaks.
  - Fix: Update FiltersSkeleton to use flex-wrap (matching real toolbars) instead of grid. Remove the hardcoded grid-cols logic and let items wrap naturally.
- [ ] **[MEDIUM]** TableSkeleton defaults to breakpoint='md', but SearchableTable and main lists use breakpoint='xl'  `responsive` · _md (768px) vs xl (1280px)_
  - Datei: `c:\dev\pauls-autotask-ui\components\skeletons.tsx` · line 67
  - Problem: TableSkeleton has breakpoint='md' as the default (line 67), meaning cards hide at md:hidden and table shows at md:block. However, SearchableTable (line 160) uses the pattern grid-cols-1 md:grid-cols-2 xl:hidden + hidden xl:block (breakpoint='xl'). Companies and contacts tables also use xl. If a page calls TableSkeleton() without specifying breakpoint='xl', the skeleton will toggle at md (768px) instead of xl (1280px), creating visual jank during load.
  - Fix: Change TableSkeleton default breakpoint from 'md' to 'xl' (line 67) to match the established pattern. Most pages use xl; md should be explicitly passed only for exceptional cases.
- [ ] **[MEDIUM]** Empty component uses p-6 padding which compounds with app layout's p-4 md:p-6 outer padding  `spacing` · _320 (10 units lateral padding); 1024 (12 units, redundant)_
  - Datei: `c:\dev\pauls-autotask-ui\components\ui\empty.tsx` · line 10
  - Problem: Empty has 'p-6' hardcoded. The app layout (app/(app)/layout.tsx line 94) wraps content with 'p-4 md:p-6'. When Empty appears inside this container on mobile, total horizontal padding becomes 4 + 6 = 10 units (too much; should be ~4-6 total). On desktop, 6 + 6 = 12 is excessive. The component should either have no padding (let parent control via gap) or use p-4 to match mobile layout.
  - Fix: Change Empty's padding from p-6 to p-4, or remove it entirely and rely on parent flex gap for spacing. Test with real empty-state pages at 320px and 1024px.
- [ ] **[MEDIUM]** Empty component sets flex-1 without min-height, causing it to expand to fill container height unexpectedly  `spacing` · _all (especially mobile where empty state can be very tall)_
  - Datei: `c:\dev\pauls-autotask-ui\components\ui\empty.tsx` · line 9
  - Problem: Line 9: 'flex-1 flex-col items-center justify-center' makes Empty grow to fill available vertical space. If a filtered list is empty on a mostly-empty page, Empty can stretch to fill the entire viewport, creating awkward proportions. No min-h is set to constrain growth.
  - Fix: Add 'min-h-64' or 'min-h-screen' constraint to Empty, or document that callers should wrap Empty in a height-constrained container. Test with real empty-state scenarios on mobile.
- [ ] **[MEDIUM]** SelectTrigger applies redundant/competing height classes across breakpoints  `touch-target` · _<sm (mobile h-11 correct); sm-1280 (desktop h-8 vs h-9 input mismatch)_
  - Datei: `c:\dev\pauls-autotask-ui\components\ui\select.tsx` · lines 43-45
  - Problem: SelectTrigger uses `data[size=default]:h-11 sm:data[size=default]:h-8` and `data[size=sm]:h-11 sm:data[size=sm]:h-7` in the className. This means at mobile, size='default' is h-11 (44px, correct); at sm and above, it becomes h-8 (32px). However, when SelectTrigger appears in filter toolbar rows with Inputs (h-11 sm:h-9), the select may render at h-8 desktop, creating vertical misalignment. Search inputs use h-11 sm:h-9, but selects without explicit size override use h-11 sm:h-8.
  - Fix: Update select.tsx line 44 from `sm:data[size=default]:h-8` to `sm:data[size=default]:h-9` to match Input baseline and eliminate the need for !important overrides in consuming components.
- [ ] **[LOW]** FiltersSkeleton search skeleton layout may not perfectly match real toolbar parent div width constraints  `responsive` · _sm (375+)_
  - Datei: `c:\dev\pauls-autotask-ui\components\skeletons.tsx` · line 42
  - Problem: Line 42: 'h-11 w-full rounded-md sm:h-9 sm:max-w-xs'. The real search input in searchable-table.tsx (lines 121-129) is wrapped in a parent div with 'w-full min-w-48 flex-1 sm:max-w-xs', where flex-1 controls width. The skeleton Skeleton element only has max-w-xs set on itself, not flex-1 on a parent. At sm breakpoint, the widths should match, but the flex-1 behavior might differ subtly.
  - Fix: Wrap FiltersSkeleton's search Skeleton in a parent div with matching constraints: 'w-full min-w-48 flex-1 sm:max-w-xs'.
- [ ] **[LOW]** SortIcon renders inactive state with opacity-0, reserving space that causes slight visual asymmetry  `consistency` · _all_
  - Datei: `c:\dev\pauls-autotask-ui\components\table-sort-icon.tsx` · line 16
  - Problem: Line 16: 'opacity-0 transition-opacity group-hover/sorthead:opacity-50'. The icon is invisible (opacity-0) but still occupies size-3.5 width in the inline-flex gap-1 layout. This reserves space in the header, which is intentional to prevent layout shift on hover. However, it means every sortable column has ~14px of reserved but invisible space even when not sorting.
  - Fix: Document this behavior in a code comment. No change needed; it's intentional and prevents jank.
- [ ] **[LOW]** TruncatedText uses block truncate but may hide overflow on mobile without clear affordance  `responsive` · _320 (mobile, truncation affordance unclear)_
  - Datei: `c:\dev\pauls-autotask-ui\components\truncated-text.tsx` · line 39
  - Problem: Line 39: 'block truncate'. For text longer than available width (e.g., 30-char name in 320px container), the text will ellipsize. The ResizeObserver detects truncation (line 28), but the tooltip only appears on hover. On mobile, truncation may not be obvious without hover, potentially hiding important information.
  - Fix: Test with real data on 320px. If truncation is frequent, consider adding a visual fade-out gradient or documenting that truncated text is always preceded by a hover tooltip. Alternatively, reduce max-widths for mobile or use line-clamp for better mobile UX.
- [ ] **[NIT]** Badge renders h-5 (20px), smaller than 44px minimum, but this is correct for non-interactive indicators  `touch-target` · _all (h-5 constant)_
  - Datei: `c:\dev\pauls-autotask-ui\components\ui\badge.tsx` · line 8
  - Problem: Badge has hardcoded 'h-5'. Since badges are visual indicators (not clickable), h-5 is appropriate and should not be sized as touch targets. However, there's no responsive logic to handle contexts where badges might scale differently on mobile.
  - Fix: No change needed. Add a comment clarifying that h-5 is correct for badge indicators and should not be changed to match input heights (44px) unless badge becomes interactive.

### Login / no-access / admin / popup shell pages

_9 Befunde — 3 High · 2 Medium · 3 Low · 1 Nit_

- [ ] **[HIGH]** Login button uses hardcoded h-12 instead of responsive h-11 sm:h-9  `touch-target` · _alle_
  - Datei: `app/login/page.tsx` · line 87
  - Problem: The 'Mit Microsoft anmelden' button uses `className="h-12 w-full gap-3 text-base"` with hardcoded h-12 (48px). This violates the project's touch-target pattern where mobile buttons must be h-11 (44px) and desktop h-9 (36px). All other buttons in the codebase use `h-11 sm:h-9` (see components/tickets/time-tracking.tsx, components/tickets/time-entry-dialog.tsx, etc.). This creates both a consistency violation and an over-tall button on desktop.
  - Fix: Change className to `className="h-11 w-full gap-3 text-base sm:h-9"` to match the established pattern for full-width responsive buttons throughout the codebase.
- [ ] **[HIGH]** Mock-mode buttons lack responsive sizing specification  `touch-target` · _320, 375, 414_
  - Datei: `app/login/page.tsx` · line 72-78
  - Problem: The mock user buttons use `className="w-full justify-start"` without any height specification, defaulting to size="default" which is h-8 (32px). This is below the 44px minimum touch target for mobile. Every other list/form button in the codebase that spans full width includes `h-11 sm:h-9` (components/searchable-table.tsx line 127, components/tickets/new-ticket-dialog.tsx line 358). At 320px and 375px widths these buttons will be too small to tap reliably.
  - Fix: Add `h-11 sm:h-9` to the Button className: `className="h-11 w-full justify-start sm:h-9"` to match touch-target standards.
- [ ] **[HIGH]** No-access logout button lacks height specification, defaults to undersized h-8  `touch-target` · _320, 375, 414_
  - Datei: `app/no-access/page.tsx` · line 51
  - Problem: The 'Abmelden' button has no size attribute and no className height, so it defaults to size="default" (h-8, 32px). While it's inside a narrow Card, this still violates mobile touch-target standards. On small screens (320, 375px), this 32px button is too small. Comparable buttons in dialogs and forms use explicit sizing (e.g., time-entry-dialog.tsx line 460 uses `h-11 sm:h-9`).
  - Fix: Add `className="h-11 sm:h-9"` to the Button element: `<Button type="submit" variant="outline" className="h-11 sm:h-9">` to meet 44px minimum on mobile.
- [ ] **[MEDIUM]** Inconsistent main background color vs no-access page  `consistency` · _alle_
  - Datei: `app/login/page.tsx` · line 36
  - Problem: Login page's main has `className="bg-background flex min-h-svh..."` but no-access page's main omits bg-background. The login page explicitly applies the background token, while no-access relies on body's `@apply bg-background` from globals.css. This creates a subtle visual inconsistency where no-access inherits the background passively. Both pages should explicitly state it for clarity, or both should omit it for consistency.
  - Fix: Either add `bg-background` to no-access main (line 27) to match login page pattern, or remove it from login (line 36). Prefer adding it to no-access for explicit clarity: `className="bg-background flex min-h-svh..."`.
- [ ] **[MEDIUM]** Popup layout uses min-h-screen instead of min-h-svh, may cause viewport overflow  `responsive` · _320, 375, 414_
  - Datei: `app/popup/layout.tsx` · line 14
  - Problem: The popup wrapper uses `className="min-h-screen p-4 md:p-6"`. The `min-h-screen` unit includes the browser UI height, which can cause content to overflow the viewport in mobile browsers (Safari especially). The login and no-access pages correctly use `min-h-svh` (small viewport height). For pop-out windows and modal-like layouts, min-h-svh is the safer choice to avoid layout shift and scroll on small devices.
  - Fix: Change to `min-h-svh`: `className="min-h-svh p-4 md:p-6"` to match the pattern used in login/no-access pages and prevent overflow on mobile browsers.
- [ ] **[LOW]** Admin page structure is correct but contains only placeholder content  `consistency` · _alle_
  - Datei: `app/(app)/admin/page.tsx` · lines 14-29
  - Problem: The admin page correctly uses <PageHeader title="Admin" description="..." /> and <Empty> with EmptyMedia icon variant, matching the design system pattern. The page structure is sound and consistent. However, it contains only a placeholder Empty state with no actual admin features implemented.
  - Fix: When admin features are added, ensure they follow the section separation pattern (gap-6 between sections) and component sourcing from the established library.
- [ ] **[LOW]** Login page uses gap-10 between logo and buttons instead of standard gap-6  `spacing` · _alle_
  - Datei: `app/login/page.tsx` · line 37
  - Problem: The login page uses `gap-10` (40px) between the logo section and the login buttons. This is larger than the standard `gap-6` (24px) used throughout the main app for section separation. While the extra spacing is intentional for visual hierarchy on a login screen, it diverges from the established spacing scale.
  - Fix: Consider using `gap-8` (32px) instead of `gap-10` to stay within the standard spacing scale, or add a comment explaining the deviation for login screen visual hierarchy.
- [ ] **[LOW]** Popup layout padding is not scaled to standard gap-based section separation  `spacing` · _alle_
  - Datei: `app/popup/layout.tsx` · line 14
  - Problem: The popup layout applies padding directly to the wrapper: `p-4 md:p-6`. This is p-4 (16px) on mobile and p-6 (24px) on desktop. The main app layout (app/(app)/layout.tsx line 94) uses `gap-6` between sections and `p-4 md:p-6` for outer padding. The popup is consistent with outer padding, but lacks internal gap-based section structure.
  - Fix: No change needed if this is intentional for popup context. Ensure any child content uses gap-6 between major sections, consistent with main app layout pattern.
- [ ] **[NIT]** Login page title uses span instead of semantic h1 element  `typography` · _alle_
  - Datei: `app/login/page.tsx` · line 48
  - Problem: Login page title is a span with `className="text-2xl font-semibold tracking-tight"`, while admin page uses PageHeader which renders an h1. Both look identical visually, but login lacks semantic heading structure. This is minor for a one-off landing page.
  - Fix: Wrap login title in h1 element: `<h1 className="text-2xl font-semibold tracking-tight">Autotask UI</h1>` to match semantic structure of PageHeader.

### cross:Page headers & titles & section structure & outer spacing. Compare usesPageHeader, outerPaddingAndGaps across areas. Find pages with bespoke headers, different title size/weight, missing/inconsistent description, action placement differences, inconsistent section gaps (should all be gap-6) or page padding.

_8 Befunde — 1 High · 5 Medium · 2 Low · 0 Nit_

- [ ] **[HIGH]** Vertrieb detail pages use gap-4 instead of baseline gap-6 for section separation  `spacing` · _alle_
  - Datei: `app/(app)/vertrieb/rechnungen/[id]/page.tsx` · line 60 (return div className)
  - Problem: The invoice/quote/contract detail pages wrap PageHeader + content in 'flex flex-col gap-4' (line 60: `<div className="flex flex-col gap-4">`), while all other detail pages (Company: line 153, Project: line 136, Ticket: line 566) use 'gap-6'. This creates 1.5rem vs 1rem vertical spacing gap between page sections. Baseline establishes gap-6 in app/(app)/layout.tsx line 94.
  - Fix: Change 'gap-4' to 'gap-6' in all vertrieb detail page wrappers to align with PageHeader spacing pattern established in layout.tsx and used by companies/projects/tickets.
- [ ] **[MEDIUM]** Dashboard and ticket list pages both use gap-6 but MyProjectsSection and OpenTickets subsections use gap-4 internally  `spacing` · _alle_
  - Datei: `app/(app)/tickets/my/page.tsx` · PageHeader and secondary TicketsList rendering
  - Problem: Per-area findings note that Dashboard/MyProjectsSection (nit 'OpenTickets section has gap-4 but dashboard page uses gap-6'; line 304 in findings). The page wrapper enforces gap-6 between sections (layout.tsx line 94), but subsections (OpenTickets, MyProjectsSection, individual Tabs) use gap-4 internally, creating visual hierarchy inconsistency. Ticket lists also use gap-6 at page level but may differ in subsection gaps. This is a common pattern (sections at gap-6, sub-content at gap-4) but not explicitly documented as a rule in the design constitution.
  - Fix: Formalize a spacing hierarchy: page-level sections use gap-6 (1.5rem), subsection content uses gap-4 (1rem), card internals use gap-3 (0.75rem). Or harmonize all to gap-6 if visual breathing room is priority. Document in the constitution.
- [ ] **[MEDIUM]** Companies and Projects manually recreate PageHeader layout instead of reusing PageHeader component  `consistency` · _alle_
  - Datei: `components/companies/company-detail-content.tsx & components/projects/project-detail-content.tsx` · lines 166 and 145 (header wrapper div className)
  - Problem: Both company-detail and project-detail pages build a bespoke header using 'flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4' with h1 text-2xl font-semibold tracking-tight, instead of using the <PageHeader> component. This duplicates the layout pattern (flexbox + title styling) that PageHeader already provides. The Ticket detail (line 571) uses custom layouts for mobile/desktop split. By contrast, list pages (companies/page.tsx, projects/page.tsx, zeiten/page.tsx) consistently use <PageHeader>. The hand-rolled headers diverge in gap sizes (gap-2 vs PageHeader's gap-1) and responsive breakpoints.
  - Fix: Refactor company-detail and project-detail to use <PageHeader> component with title, description (e.g., address/company for company, company/dates for project), and actions passed as props. Falls back to custom layout only for Ticket detail where rich mobile/desktop header duality is required.
- [ ] **[MEDIUM]** Ticket detail header switches between two completely different layouts at md breakpoint  `consistency` · _md boundary (768px)_
  - Datei: `components/tickets/ticket-detail.tsx` · line 571 (desktop header) vs line 588 (mobile header)
  - Problem: Ticket detail uses 'hidden items-center gap-3 md:flex' for desktop (line 571-583: single-line h1 + date + button) vs 'flex flex-col gap-4 md:hidden' for mobile (line 588-620: stacked blocks with title/number/status/context). This is an intentional pattern (see comment line 585-587) but creates a stark visual discontinuity at md (768px). Desktop shows: 'Ticket 123 – Title · Datum · Button' in one row; Mobile shows: Ticket number (eyebrow) + Title + Status badges + Context section. The gap sizes differ (gap-3 desktop vs gap-4 mobile). This violates the spirit of responsive coherence in the design system where layouts should morph, not flip.
  - Fix: Consider a smoother responsive transition: use a single wrapper with flex flex-col md:flex-row gaps that adapt semantically at md. Or document explicitly why Ticket detail intentionally diverges from morphing-layout pattern (may be justified for complexity management). Compare against PageHeader's simpler flex-row approach (line 29, which handles mobile via gap-2, desktop via sm:gap-4).
- [ ] **[MEDIUM]** Ticket detail uses h1 text-xl on mobile vs text-2xl on desktop, deviating from PageHeader baseline  `typography` · _md (768px)_
  - Datei: `components/tickets/ticket-detail.tsx` · line 596 (h1 text-xl on mobile) vs line 572 (h1 text-2xl on desktop)
  - Problem: PageHeader (line 35) consistently uses h1 text-2xl font-semibold tracking-tight. Ticket detail's mobile header (line 596) uses h1 text-xl font-semibold tracking-tight, and desktop header (line 572) uses h1 text-2xl. This creates a 16px vs 24px mobile-to-desktop jump for the same semantic element. Other detail pages (company, project) also use text-2xl in their bespoke headers, creating inconsistency at the mobile breakpoint where Ticket deliberately shrinks. This may be intentional for mobile space optimization, but it deviates from the PageHeader pattern and other detail pages.
  - Fix: Audit whether text-xl on mobile ticket detail is intentional or oversight. If intentional (space-saving), document. If oversight, align to text-2xl like other detail pages and PageHeader baseline. Or create a variant of PageHeader that supports mobile title size reduction if mobile space is a recurring constraint.
- [ ] **[MEDIUM]** Ticket detail uses PageHeader-adjacent layout; vertrieb/sales detail pages lack any PageHeader equivalent  `consistency` · _alle_
  - Datei: `components/tickets/ticket-detail.tsx & app/(app)/vertrieb/rechnungen/[id]/page.tsx` · ticket-detail line 566 vs vertrieb line 60
  - Problem: Ticket detail builds its own header structure (line 566-620: flex flex-col gap-6 with desktop md:flex header and mobile md:hidden header), while vertrieb detail pages (invoice/quote/contract) only render PageHeader + breadcrumb without a specialized header block. Ticket detail justifies custom layout via rich metadata (priority, status, company, contact, resource); vertrieb pages could benefit from similar structure. This creates asymmetry where some detail contexts show multiple metadata rows inline, others show only minimal PageHeader. Baseline PageHeader (components/page-header.tsx) supports h1 + optional description, but detail pages with dynamic metadata cannot fit this into the component's structure.
  - Fix: Consider extending PageHeader to accept optional metadata/context rows (e.g., subtitle, secondary info flexbox), or document why vertrieb pages intentionally omit rich metadata display. Ticket detail's custom layout is justified; align others to it where business logic permits.
- [ ] **[LOW]** Dashboard PageHeader lacks description while all list/detail pages include optional description  `consistency` · _alle_
  - Datei: `app/(app)/page.tsx` · line 100 (PageHeader for Dashboard) vs line 28 (PageHeader component definition)
  - Problem: Dashboard PageHeader (line 45-49 in zeiten, line similar in companies/contacts) is invoked with title + optional description + actions. Companies list has description 'Firmen-Übersicht und Kundendetails'. Dashboard (app/(app)/page.tsx) uses only title 'Übersicht' and NewTicketDialog action, no description. This is consistent with the design — descriptions are optional — but zeiten/companies/contacts use them for context. Ticket lists (my/team/ball) use descriptions like 'Deine Tickets für diese Woche.' The Dashboard opts for simplicity; this is acceptable, but asymmetry is worth noting if descriptions should be universal for consistency.
  - Fix: No action needed if descriptions are intentionally optional. If consistency goal is to include context for all major pages, add a brief description to Dashboard PageHeader (e.g., 'Überblick über deine Tickets und Projekte').
- [ ] **[LOW]** PageHeader internal gap (gap-2 sm:gap-4) is tighter than page-level section gap (gap-6)  `consistency` · _alle_
  - Datei: `components/page-header.tsx & app/(app)/page.tsx` · PageHeader component line 29 (gap-2 sm:gap-4) vs Layout wrapper line 94 (gap-6)
  - Problem: PageHeader uses 'gap-2 sm:gap-4' (line 29) between its title/description and actions, while the page wrapper (layout.tsx line 94) separates sections with gap-6. This means the gap between PageHeader content and the next section below is 6, but the gap between PageHeader title and its right-aligned actions is only 4 on desktop (1rem). Visual spacing is tighter horizontally than vertically, which may be intentional (title-to-action proximity), but creates subtle inconsistency. Compare: PageHeader 'gap-2 sm:gap-4' vs. section spacing 'gap-6' (1.5rem).
  - Fix: Verify this is intentional visual hierarchy. If so, document it. If visual tension is undesired, consider gap-4 for PageHeader internal spacing to align more closely with section-to-section logic (1rem between related items, 1.5rem between sections).

### cross:Lists, tables, search & filter toolbars. Compare usesSearchableTable, searchInputHeights, listMobileToTableBreakpoint, filterToolbarPattern.

_12 Befunde — 3 High · 8 Medium · 1 Low · 0 Nit_

- [ ] **[HIGH]** Companies filter toolbar counter text has no explicit height, causing misalignment with Input/Select controls  `alignment` · _all_
  - Datei: `components/companies/companies-table.tsx` · line 262: Counter text without height constraint
  - Problem: Line 262 renders `<span className="text-muted-foreground w-full text-sm whitespace-nowrap sm:ml-auto sm:w-auto">` without height constraint. Input (line 236) is `h-11 sm:h-9`, SelectTrigger (line 247) is `h-11 sm:h-9!`, but the counter text floats without alignment, creating visual misalignment in the toolbar. TicketsList and ContactsTable have the same pattern. Contacts line 262 also lacks height.
  - Fix: Add `flex items-center` and explicit `h-11 sm:h-9` or `sm:h-auto` to the counter text to align it vertically with neighboring controls.
- [ ] **[HIGH]** Project detail tabs (Phasen/Aufgaben) use md (768px) card breakpoint while list uses xl (1280px)  `responsive` · _768-1024_
  - Datei: `components/projects/project-phases-panel.tsx` · line 85: `md:hidden` breakpoint for mobile cards
  - Problem: ProjectPhasesPanel and ProjectTasksPanel switch to table at `md` (768px) with `grid grid-cols-1 gap-2 md:hidden`, whereas the main ProjectsList uses `md:grid-cols-2 xl:hidden` (stays on cards until xl). Projects detail view shows table at 768px but main list shows cards at 768px. Creates 256px-wide visual discontinuity at 768-1024px.
  - Fix: Align detail tabs to use `xl:hidden` / `xl:block` to match the main list and other list pages (companies, contacts, zeiten).
- [ ] **[HIGH]** Ticket lists use lg (1024px) mobile-to-table breakpoint while baseline uses xl (1280px)  `responsive` · _768-1280_
  - Datei: `components/tickets/tickets-list.tsx` · line 357-365, card toggle breakpoint
  - Problem: TicketsList toggles between cards and table at `lg:hidden` / `lg:block` (1024px), whereas SearchableTable (baseline), CompaniesTable, ContactsTable, and ProjectsList all use `xl:hidden` / `xl:block` (1280px). This creates visual inconsistency: at 768-1024px, users see tables in Kundenakte/Kontakte but cards in Meine Tickets/Teamtickets.
  - Fix: Change TicketsList to use `xl:hidden` / `xl:block` (line ~357) to match SearchableTable pattern. This maintains consistency across all list pages.
- [ ] **[MEDIUM]** Companies filter toolbar uses gap-2 between search/selects, while SearchableTable uses gap-3 and other patterns vary  `spacing` · _mobile to sm (640px+)_
  - Datei: `components/companies/companies-table.tsx` · line 229-275: filter toolbar gap
  - Problem: CompaniesTable toolbar (line 229) opens with `flex flex-wrap items-center gap-2`. SearchableTable baseline (line 119) uses `gap-2` but internal structure is cleaner. ContactsTable also uses `gap-2` (line 229). But GroupedList (line 192) uses `gap-2` initially then `sm:gap-3` at sm breakpoint, and ProjectsList (line 192) uses `sm:flex-row sm:flex-wrap sm:items-center sm:gap-3`. This creates inconsistent toolbar density: gap-2 on mobile feels tighter than gap-3 on desktop in GroupedList/ProjectsList.
  - Fix: Standardize toolbar gap: consider `gap-2 sm:gap-3` pattern (like GroupedList/ProjectsList) or uniform `gap-2` across all areas. Current mix is: CompaniesTable/ContactsTable/SearchableTable use gap-2; ProjectsList/GroupedList use gap-2 sm:gap-3.
- [ ] **[MEDIUM]** Dashboard filter buttons (Alle offenen / Nicht zugewiesen) have non-standard height: h-11 sm:h-7 instead of h-11 sm:h-9  `alignment` · _all (44px mobile consistent, but 28px vs 36px desktop)_
  - Datei: `components/dashboard/open-tickets.tsx` · line 92: Buttons with `h-11 sm:h-7`
  - Problem: OpenTickets filter buttons (lines 91-100, 100-107) use `className="h-11 sm:h-7"` while the TicketsList below uses `h-11 sm:h-9` for its filter selects, causing 8px desktop height mismatch. Baseline is h-11 sm:h-9 across SearchableTable, CompaniesTable, ContactsTable, ProjectsList. Dashboard buttons are visibly shorter on desktop.
  - Fix: Change Dashboard filter buttons to `h-11 sm:h-9` to align with TicketsList and all other filter controls.
- [ ] **[MEDIUM]** ProjectsList table uses min-w-3xl while SearchableTable baseline and other lists use min-w-2xl  `consistency` · _lg (1024px) and below_
  - Datei: `components/projects/projects-list.tsx` · line 156: `min-w-3xl` vs baseline min-w-2xl
  - Problem: ProjectsList Table (line 156) has `className="min-w-3xl"` (48rem = 768px minimum), whereas SearchableTable default is `min-w-2xl` (42rem = 672px). Companies/Contacts tables also use min-w-2xl. This forces ProjectsList to scroll earlier on narrow viewports, breaking the consistency pattern.
  - Fix: Change ProjectsList table to `min-w-2xl` to match SearchableTable baseline and other list pages.
- [ ] **[MEDIUM]** SearchableTable toolbar uses simple flex gap-2, while GroupedList and ProjectsList use more complex flex/grid responsive patterns  `consistency` · _mobile to sm (640px+)_
  - Datei: `components/searchable-table.tsx` · line 119: Toolbar structure
  - Problem: SearchableTable (baseline) line 119 uses straightforward `flex flex-wrap items-center gap-2` for the toolbar. However, GroupedList (line 192) uses `flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3` (stacks on mobile, wraps on desktop), and ProjectsList (line 192) has similar stacked-to-flex transition. This means the baseline SearchableTable doesn't stack on mobile but GroupedList/ProjectsList do, creating asymmetry in mobile UX: SearchableTable controls wrap horizontally, while GroupedList search stays full-width until sm.
  - Fix: Consider standardizing toolbar layout: either (1) keep SearchableTable simple and update GroupedList/ProjectsList to match, or (2) update SearchableTable to use the stacking pattern for better mobile UX (search full-width, controls below).
- [ ] **[MEDIUM]** ResourceFilter (team filter) uses sm:h-9! override while other filter selects use either h-11 sm:h-9! or h-11 sm:h-9  `alignment` · _desktop (sm: 640px+)_
  - Datei: `components/tickets/resource-filter.tsx` · line 62: ResourceFilter SelectTrigger
  - Problem: ResourceFilter SelectTrigger line 62 uses `"h-11 w-full min-w-0 sm:h-9!"` with !important flag. CompaniesTable uses `sm:h-9!` (line 247), but ContactsTable and ProjectsMetaEdit use `sm:h-9` without override. This inconsistency suggests a pattern conflict in the Select component baseline (likely defaulting to h-8 on desktop, requiring !important override). All three instances are in filter toolbars but use different specificity levels.
  - Fix: Audit Select component default (ui/select.tsx) to confirm desktop height assumption. Either: (1) fix Select default to h-9, removing need for !important overrides, or (2) standardize all filter SelectTriggers to use h-11 sm:h-9! consistently across all areas.
- [ ] **[MEDIUM]** TicketsList filter grid uses grid-cols-2/grid-cols-4 thresholds while baseline SearchableTable doesn't have filter grid at all  `responsive` · _mobile to sm to md_
  - Datei: `components/tickets/tickets-list.tsx` · line 357-365, 242-256
  - Problem: TicketsList implements its own filter grid with `grid-cols-2 sm:grid-cols-4` (line ~242-256 in filter structure), whereas SearchableTable has no multi-column filter layout. CompaniesTable, ContactsTable also don't use grid for filters. Only TicketsList, ProjectsList (grid-cols-2/3), and GroupedList have grid-based filter layouts. This is intentional architectural divergence: some pages (Tickets/Projects/Vertrieb) have complex filter grids; others (Companies/Contacts/Zeiten) have simpler flex toolbars.
  - Fix: This divergence is architectural, not a bug. Document the pattern: single-filter toolbars use flex-wrap, multi-filter toolbars use responsive grids (grid-cols-2 mobile → 3-4 desktop).
- [ ] **[MEDIUM]** TicketsList uses default TableSkeleton breakpoint='md' but renders lg:hidden cards, creating skeleton/content mismatch  `state` · _768-1024px (md to lg)_
  - Datei: `components/tickets/tickets-list.tsx` · line 242-256: FiltersSkeleton breakpoint parameter
  - Problem: TicketsList passes no explicit breakpoint parameter to FiltersSkeleton + TableSkeleton, defaulting to breakpoint='md'. But real content uses `lg:hidden` (1024px) for cards. So on 768-1024px, the skeleton shows a table (from breakpoint='md') but real content shows cards (from lg:hidden), causing visual jump. SearchableTable also has this issue but defaults to breakpoint='md' without an lg override.
  - Fix: Pass `breakpoint='lg'` to TableSkeleton in TicketsList to match the real lg:hidden card breakpoint. Verify all other lists do the same.
- [ ] **[MEDIUM]** GroupedList (Vertrieb) uses sm:h-9! override on SelectTrigger while SearchableTable doesn't  `alignment` · _desktop (sm: 640px+)_
  - Datei: `components/vertrieb/grouped-list.tsx` · line 213, 238: SelectTrigger in GroupedList with sm:h-9! override
  - Problem: GroupedList line 213 (grouping select) uses `"h-11 w-full min-w-0 sm:h-9!"` and line 238 (filter button) uses `"h-11 w-full min-w-0 justify-start gap-1.5 sm:h-9 sm:w-auto"` (note: inconsistent — no !important on filter button line 238). This mirrors the pattern in TicketsList/ResourceFilter. SearchableTable (the baseline) has no filter selects, so the override pattern is unique to complex-filtered lists.
  - Fix: Standardize: either all SelectTriggers in filter toolbars use `sm:h-9!`, or the Select component default is fixed to h-9 and no overrides are needed.
- [ ] **[LOW]** ProjectsList uses `flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3` while CompaniesTable/ContactsTable use immediate flex-wrap  `responsive` · _mobile to sm (320-640px)_
  - Datei: `components/projects/projects-list.tsx` · line 192: Toolbar responsive layout
  - Problem: ProjectsList toolbar (line 192) stacks on mobile and switches to flex-wrap at sm. CompaniesTable/ContactsTable (line 229) use `flex flex-wrap items-center gap-2` immediately. This means at 320-640px, ProjectsList search is full-width with controls below; Companies/Contacts search wraps with controls. ProjectsList provides better mobile UX but diverges from Companies/Contacts pattern.
  - Fix: Consider adopting the stacking pattern across all list toolbars for consistency. This is a UX improvement (full-width search on mobile) rather than a bug.

### cross:Responsive behaviour & touch targets across 320/375/414/768/1024/1280/1440/1920. Compare gridColumnThresholds & listMobileToTableBreakpoint. Find dead bands where neither mobile cards nor desktop table show, horizontal overflow on phones, inconsistent breakpoints between similar pages, <44px touch targets on mobile, h-11 leaking to desktop, content hidden behind sticky header/bottom-nav/safe-area.

_14 Befunde — 4 High · 8 Medium · 2 Low · 0 Nit_

- [ ] **[HIGH]** Dashboard filter buttons use h-11 sm:h-7 (28px desktop) vs baseline h-11 sm:h-9 (36px desktop)  `alignment` · _<640px (mobile correct), 640-1024px (8px too short), 1024px+ (8px too short)_
  - Datei: `components/dashboard/open-tickets.tsx` · line 92, 101
  - Problem: OpenTickets filter buttons ('Alle offenen', 'Nur nicht zugewiesene') use className="h-11 sm:h-7" creating 8px height gap vs SearchableTable (h-11 sm:h-9), TicketsList (h-11 sm:h-9!), and other lists. This breaks vertical alignment with future filter controls and violates the h-11 sm:h-9 pattern established as the baseline in SearchableTable line 127.
  - Fix: Change className="h-11 sm:h-7" to className="h-11 sm:h-9" to match the unified pattern across Tickets, Companies, Contacts, and Projects lists.
- [ ] **[HIGH]** Divergent mobile-to-table breakpoints: Dashboard OpenTickets (via TicketsList lg:hidden/block) vs Companies/Contacts/Projects (xl:hidden/block)  `responsive` · _768-1024px (TicketsList shows cards, others show cards), 1024-1280px (TicketsList shows table, others show cards), 1280px+ (all show table)_
  - Datei: `components/dashboard/open-tickets.tsx vs components/tickets/tickets-list.tsx` · breakpoint divergence at lg vs xl
  - Problem: TicketsList (used in OpenTickets on Dashboard and all Ticket pages) uses lg:hidden/lg:block (1024px), while Companies (line 303), Contacts (xl:hidden), and Projects (line 404) use xl:hidden/xl:block (1280px). This creates visual inconsistency when comparing the Dashboard ticket section (table at 1024px) with adjacent sections or when navigating between pages. A user at 1024px width sees TicketsList as a full table but Companies card grid, violating the Design Constitution's consistency requirement.
  - Fix: Align all list pages to use xl:hidden/xl:block (1280px). Update TicketsList to match SearchableTable, Companies, and Projects baseline. This may require adjusting table min-width (currently min-w-2xl for SearchableTable, verify for TicketsList) to ensure comfortable rendering at lg (1024px).
- [ ] **[HIGH]** SearchBox input uses h-12 (48px fixed) instead of responsive h-11 sm:h-9  `touch-target` · _Mobile (h-12 = 48px, should be 44px), desktop (h-12 = 48px, should be 36px)_
  - Datei: `components/search/search-box.tsx` · input height
  - Problem: SearchBox uses className="h-12" as fixed height instead of responsive h-11 sm:h-9. This creates a 4px overhang on mobile (48px vs 44px baseline) and 12px overhang on desktop (48px vs 36px). Makes the search box visually dominate other inputs on the page. CommandPalette has similar issue with non-responsive input. Breaks the touch-target consistency principle.
  - Fix: Change SearchBox input from className="h-12" to className="h-11 sm:h-9" to match SearchableTable Input styling (line 127).
- [ ] **[HIGH]** Ticket lists use lg:hidden/lg:block (1024px), diverge from xl pattern in SearchableTable/Companies/Contacts/Projects  `responsive` · _<1024px (cards), 1024-1280px (table only for tickets, cards for others), 1280px+ (table for all)_
  - Datei: `components/tickets/tickets-list.tsx` · line 364-366
  - Problem: TicketsList toggles mobile cards (lg:hidden) to desktop table (lg:block) at 1024px breakpoint, but SearchableTable, Companies, Contacts, and Projects all use xl:hidden/xl:block (1280px). This creates a 256px dead band (1024-1280px) where Tickets show table but other lists show cards. At 1024px, ticket list becomes full table while company/contact/project lists still show 2-column card grids. Inconsistent mobile-to-table behavior across the app violates the Design Constitution baseline.
  - Fix: Change TicketsList from lg:hidden/lg:block to xl:hidden/xl:block (e.g., line 404 'hidden lg:block' → 'hidden xl:block', and mobile card grid 'md:grid-cols-2 lg:hidden' → 'md:grid-cols-2 xl:hidden'). This aligns with SearchableTable baseline and creates consistent responsive behavior across all list pages.
- [ ] **[MEDIUM]** Dashboard KPI grid uses lg:grid-cols-4 (1024px) breakpoint, diverges from xl standard for other grids  `responsive` · _320-768px (1 col unavailable), 768-1024px (abrupt 2→4 jump), 1024px+ (4 col too sparse at 1024-1280 on some screens)_
  - Datei: `app/(app)/page.tsx` · line 145
  - Problem: KPI card grid transitions from 2→4 columns at lg (1024px) with 'grid-cols-2 gap-4 lg:grid-cols-4'. Most other grids in the app use md:grid-cols-2 xl:hidden for mobile cards + xl for table (SearchableTable, Companies, Contacts, Projects all use xl=1280px). This creates a dead band at 768-1024px where KPI cards are 2-column while other list pages show cards. No md:grid-cols-3 to smooth the transition.
  - Fix: Add md:grid-cols-3 to KpiTilesSkeleton and dashboard KPI section: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' to match the smoother column progression in the rest of the app.
- [ ] **[MEDIUM]** Command Palette input uses h-14 (56px non-responsive) vs SearchableTable h-11 sm:h-9  `touch-target` · _All sizes (h-14 = 56px, oversized consistently)_
  - Datei: `components/command-palette.tsx` · input element height and SearchableTable input comparison
  - Problem: CommandPalette input uses className="h-14" as fixed 56px height, oversized vs SearchableTable (h-11 sm:h-9 = 44px mobile / 36px desktop). When the palette overlays other UI or substitutes for a toolbar input, the 12px height excess is visually jarring. No responsive sizing means desktop users get oversized controls. Violates touch-target consistency.
  - Fix: Change CommandPalette input from className="h-14" to className="h-11 sm:h-9" to align with SearchableTable and other inputs across the app.
- [ ] **[MEDIUM]** Companies SelectTrigger uses sm:h-9! (priority override) vs standard h-11 sm:h-9 pattern  `alignment` · _Mobile (h-11 OK), desktop 640px+ (h-9 with !important, fighting component default)_
  - Datei: `components/companies/companies-table.tsx` · line 247
  - Problem: SelectTrigger in companies filter uses 'className="h-11 w-full min-w-0 sm:h-9! sm:w-auto sm:min-w-40"' with unnecessary !important on sm:h-9!. The !important is a red flag indicating specificity conflict with the shadcn Select component default. This override suggests the component's base sizing was wrong and required force, violating the principle of using semantic component defaults. Multiple other places (TicketsList, Vertrieb) use the same h-11 sm:h-9! override, indicating a systemic issue with SelectTrigger's base sizing in shadcn/select.tsx.
  - Fix: Fix SelectTrigger default sizing in components/ui/select.tsx to use 'sm:h-9' without !important. This should be the component default, not an override in every consuming page. Verify with TicketsList, Companies, Projects, and Vertrieb that all SelectTriggers can drop the !important after the component fix.
- [ ] **[MEDIUM]** Contacts filter row status text lacks explicit height, breaks vertical alignment with Input/Select  `alignment` · _Mobile (20px text vs 44px controls = 24px gap), desktop (20px text vs 36px controls = 16px gap)_
  - Datei: `components/contacts/contacts-table.tsx` · filter row structure
  - Problem: ContactsTable filter row (lines ~150-170) contains: Input (h-11 sm:h-9), CompanyFilterPicker button (h-11 sm:h-9), and a span with text-sm for status count (no height). The text-sm span renders with default line-height (~1.25rem = 20px), misaligned with the 44px mobile / 36px desktop control heights. When baseline heights diverge within the same flex row, visual alignment breaks.
  - Fix: Apply explicit height to the status text span: 'h-11 sm:h-9 flex items-center' to match neighboring controls. Or wrap in a flex-center container with matching height.
- [ ] **[MEDIUM]** Projects filter grid uses grid-cols-3 on mobile (3-column) but most other lists use implicit flex-wrap or 2-column grid  `responsive` · _320px (3-col grid, ~100px wide selects, <44px touch targets), 375px (barely 125px), 414px (138px, still cramped), 640px+ (flex, OK)_
  - Datei: `components/projects/projects-list.tsx` · lines 353-375
  - Problem: ProjectsList filter section uses 'grid grid-cols-3 gap-2 sm:flex' for Status/Leiter/Firma selects. This forces 3 columns at mobile, cramping touch targets (each Select compressed to ~100px width on 320px screen). SearchableTable, Companies, Contacts use flex flex-wrap with full-width search + wrapping filters. Violates 44px touch target minimum; select triggers become too narrow to tap accurately at 320px.
  - Fix: Change filter grid from 'grid grid-cols-3 gap-2 sm:flex' to 'flex flex-col gap-2 sm:flex-row sm:flex-wrap' to match Companies/Contacts pattern, ensuring full-width filters on mobile with adequate tap targets.
- [ ] **[MEDIUM]** Ticket list mobile card grid uses md:grid-cols-2 but detail pages use similar breakpoint creating breakpoint band mismatch  `responsive` · _768-1024px (TicketsList shows 2-col cards, TicketDetail shows different 2-col arrangement)_
  - Datei: `components/tickets/tickets-list.tsx` · line 404
  - Problem: TicketsList mobile cards use 'grid grid-cols-1 gap-2 md:grid-cols-2 lg:hidden' (768px for 2-col), but TicketDetail content layout uses lg (1024px) for two-column flex-wrap, and Projects detail uses md:grid-cols-2 with different grid. When navigating from TicketsList (card at 768-1024px showing 2 cols) to TicketDetail (1024px shows 2-col layout differently), visual hierarchy shifts. No consistent column progression across list vs detail pages at same viewport size.
  - Fix: Document and enforce consistent breakpoint mapping: list pages use xl (1280px) for card→table toggle, detail pages use lg (1024px) for content reflow. Verify the chosen breakpoint is applied uniformly across all list and detail templates.
- [ ] **[MEDIUM]** Zeiten RangeToggle buttons use h-11 sm:h-7 (28px desktop, violates 36px baseline)  `touch-target` · _Mobile 320-640px (h-11, 44px, OK), desktop 640px+ (h-7, 28px, too small)_
  - Datei: `components/time/range-toggle.tsx` · buttons with h-11 sm:h-7
  - Problem: RangeToggle implements paired buttons ('Heute', 'Diese Woche', 'Dieser Monat') with className="h-11 sm:h-7", making them 28px on desktop. This violates the h-11 sm:h-9 baseline established in SearchableTable and other filter toolbars. When RangeToggle appears in PageHeader actions alongside other controls, the 8px height gap creates obvious visual misalignment. The buttons are too short to contain text comfortably.
  - Fix: Change className from 'h-11 sm:h-7' to 'h-11 sm:h-9' to match the unified control height pattern across filter toolbars.
- [ ] **[MEDIUM]** Vertrieb toolbar uses inconsistent gap and control alignment compared to SearchableTable and Companies  `alignment` · _All sizes (alignment varies by page, items-center missing in some, min-w constraints differ)_
  - Datei: `components/vertrieb/grouped-list.tsx` · toolbar construction (search input & filter selects)
  - Problem: GroupedList toolbar builds search input (h-11 sm:h-9) and filter selects (h-11 sm:h-9!) with flex flex-wrap gap-2 or similar, but SearchableTable uses flex flex-wrap items-center gap-2 with specific min-w constraints. Vertrieb detail-rail uses 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' for field grid (1→2→3) while TicketsList uses 1→2→4 pattern at different breakpoints. No unified toolbar pattern across all list/grouped pages, leading to subtle alignment shifts at breakpoint boundaries.
  - Fix: Standardize toolbar structure: all toolbars should use 'flex flex-wrap items-center gap-2 sm:gap-3' matching SearchableTable line 119. Ensure all SelectTriggers, Inputs, and Buttons in toolbars use the same h-11 sm:h-9 pattern without need for !important overrides.
- [ ] **[LOW]** OpenTickets 'Alle anzeigen' button uses h-11 sm:h-9 sm:w-auto but sm:self-center creates width inconsistency  `touch-target` · _320-640px (w-full, fills row), 640px+ (w-auto sm:self-center, centered but narrower)_
  - Datei: `components/dashboard/open-tickets.tsx` · line 148
  - Problem: Button at line 148 uses className="h-11 w-full sm:h-9 sm:w-auto sm:self-center" which is correct height (h-11 sm:h-9 baseline) but the combo of sm:w-auto + sm:self-center on a full-width mobile button creates a jumping layout at the sm breakpoint (640px). Width shifts from 100% → auto + self-center. Other pages (TicketsList, Companies) use similar patterns but the Dashboard applies this differently, causing button width instability at the breakpoint transition.
  - Fix: Verify that the sm:self-center is intentional. If the button should remain full-width on mobile, consider using sm:ml-auto instead of sm:self-center to right-align without centering. Or move to a flex container with gap to handle the layout shift predictably.
- [ ] **[LOW]** Projects detail page tabs use inconsistent h-8 height vs Dashboard/Tickets/Vertrieb h-9  `touch-target` · _Desktop 640px+ (h-8 instead of h-9, 4px visual gap)_
  - Datei: `components/projects/project-tabs.tsx` · tabs height context
  - Problem: ProjectTabs uses TabsTrigger with h-8 (32px) on desktop, while TicketDetail uses h-8, Vertrieb tabs use sm:h-8, but the baseline filter/toolbar pattern uses h-11 sm:h-9. Project tabs are 4px shorter than expected baseline, creating visual misalignment if tabs appear in a toolbar or filter row. UrlTabs (from findings) also uses h-8, suggesting a systemic issue where tab components default to h-8 instead of h-9.
  - Fix: Change ProjectTabs (and UrlTabs where used) from h-8 to h-9 on desktop, maintaining h-11 on mobile for touch. Ensure consistent TabsTrigger className="h-11 sm:h-9" across detail pages.

### cross:Color tokens, badges, dark mode

_7 Befunde — 2 High · 5 Medium · 0 Low · 0 Nit_

- [ ] **[HIGH]** OpenTickets badge uses chart-2 color token, but companies/contacts lists use secondary  `color-token` · _alle_
  - Datei: `components/dashboard/open-tickets.tsx` · lines 81-86 (badge className)
  - Problem: OpenTickets section header badge (line 82-86) applies 'bg-chart-2/15 text-chart-2' inline className to a secondary variant badge. PageHeader component (page-header.tsx line 41) uses identical 'bg-chart-2/15 text-chart-2' for all page header badges. However, companies-table.tsx (line 211) and kundenakte-panels.tsx (line 159-161) use 'variant="secondary"' (gray) for count badges. Dark mode: chart-2 is oklch(0.62 0.10 250) in dark, but secondary is oklch(0.27 0.008 65). Semantic mismatch across areas.
  - Fix: Standardize: Either all count badges use 'variant="secondary"' (consistent with gray neutral), OR create a dedicated 'count' variant that consistently uses chart-2 across all areas (PageHeader, OpenTickets, companies, contacts, projects). Currently inconsistent between dashboard (chart-2) and list pages (secondary). Document choice in design system.
- [ ] **[HIGH]** StatusDot uses hardcoded hex colors, breaking dark mode consistency  `color-token` · _alle_
  - Datei: `components/status-indicator.tsx` · lines 14-19 (StatusDot component)
  - Problem: StatusDot renders inline style with backgroundColor from statusColor() which returns hardcoded hex strings (#eab308, #ef4444, #3b82f6, etc.) instead of semantic tokens. These colors are not adjusted for dark mode, creating contrast issues. Everywhere else (badges, buttons) uses semantic tokens (bg-destructive, text-success, etc.). Evidence: style={{ backgroundColor: statusColor(status) }} with hardcoded hex map in mappers.ts lines 56-77.
  - Fix: Replace statusColor() hex map with OKLCH semantic token map. Create statusColorToken() function returning token names like 'bg-destructive', 'bg-success', 'bg-chart-2' and apply via className instead of inline style. Map status IDs to token names: New=warning, Escalated/Overdue/Claim=destructive, Approved=success, Rejected=warning, Closed/Awaiting=secondary, default=chart-1 (muted).
- [ ] **[MEDIUM]** ContractsPanel hardcodes contract status badge logic instead of using contractStatusVariant mapper  `component-sourcing` · _alle_
  - Datei: `components/companies/kundenakte-panels.tsx` · lines 157-161 (ContractsPanel status cell)
  - Problem: ContractsPanel renders contract status with hardcoded inline logic (lines 158-162): r.status === 1 ? <Badge>Aktiv</Badge> : r.status === 0 ? <Badge variant="secondary">Inaktiv</Badge>. This duplicates contractStatusVariant() from mappers.ts (line 198-199) which already handles this. If contract status logic changes, this panel won't follow. Other panels (invoices, quotes) correctly use their mappers (invoiceStatusVariant, quoteStatusVariant).
  - Fix: Replace inline logic with: <Badge variant={contractStatusVariant(r.status)}>{contractStatusLabel(r.status)}</Badge>. Apply consistent pattern across all status badges: use centralized mappers exclusively, never hardcode variant selection in components.
- [ ] **[MEDIUM]** Count badge styling diverges between dashboard and standard pages  `consistency` · _alle_
  - Datei: `components/dashboard/open-tickets.tsx,components/page-header.tsx` · open-tickets.tsx line 82-86, page-header.tsx line 39-45
  - Problem: Dashboard OpenTickets section and PageHeader component both use count badges, but with different treatment. OpenTickets explicitly adds 'bg-chart-2/15 text-chart-2 tabular-nums' inline to the Badge (line 83), while PageHeader does the same (line 41). However, when PageHeader is used on companies/contacts pages, the badge style might differ from the list page's own count badges. Companies-table line 211 uses just 'variant="secondary" className="tabular-nums"', visually different from the chart-2 treatment. Consistency audit shows this is a cross-area divergence.
  - Fix: Choose single count badge pattern and apply uniformly: (1) Define a 'count' className or Badge variant that encapsulates 'bg-chart-2/15 text-chart-2 tabular-nums' OR (2) use 'variant="secondary" className="tabular-nums"' everywhere. Update all files: page-header.tsx, open-tickets.tsx, companies-table.tsx, contacts-table.tsx, projects-list.tsx to use identical pattern. Document in design system.
- [ ] **[MEDIUM]** PageHeader badge uses chart-2 semantic token, inconsistent with companies/contacts list secondary badges  `consistency` · _alle_
  - Datei: `components/page-header.tsx` · line 41 (badge className)
  - Problem: PageHeader component (used by all major pages) renders count badge with 'bg-chart-2/15 text-chart-2' (line 41), applying chart-2 (blue-toned) semantic token. However, OpenTickets in dashboard also uses this, while companies-table (line 211), contacts-table (likely), and projects-list all show count badges using 'variant="secondary"' (gray). Dark mode impact: chart-2 is different hue/lightness than secondary in both light and dark modes, creating visual inconsistency. Audit shows this is the ONLY place PageHeader badge appears, so impact is high.
  - Fix: Align PageHeader badge styling with list page badges. Either: (1) change PageHeader to variant="secondary" OR (2) update all list pages to use chart-2. Recommend option 1 (secondary) as neutral count indicator, reserving chart-2 for data-driven visualizations. Update globals.css comment if semantic change impacts color strategy.
- [ ] **[MEDIUM]** PriorityBadge manually overrides colors for priority 1 instead of using centralized mapper  `color-token` · _alle_
  - Datei: `components/priority-indicator.tsx` · lines 18-26
  - Problem: PriorityBadge hardcodes priority 1 badge as 'variant="outline" className="border-destructive/40 text-destructive"' (lines 20-22), duplicating the logic that should be in priorityVariant() mapper. This violates DRY and creates a maintenance risk: if destructive token changes, this inline override won't follow. All other priorities use priorityVariant() from mappers.ts. Evidence: priority-indicator.tsx lines 18-26 vs mappers.ts line 232-240 which has priorityVariant() with case 1 returning 'default'.
  - Fix: Add dedicated mapping for priority 1 in priorityVariant(): case 1 should return a new variant like 'priority-high' or updated 'default' should render as 'outline' with 'border-destructive/40 text-destructive'. Then remove the manual override in PriorityBadge and always use variant={priorityVariant(priority)}.
- [ ] **[MEDIUM]** statusColor() returns hardcoded hex strings with no dark mode support  `darkmode` · _alle_
  - Datei: `lib/autotask/mappers.ts` · lines 56-77 (statusColor function)
  - Problem: statusColor() function is used exclusively by StatusDot component to render colored dots. It returns hardcoded hex values like #eab308, #ef4444, #3b82f6, #64748b, etc. These hex values are not OKLCH tokens and do not have dark mode variants defined in globals.css. The app uses OKLCH semantic tokens (--destructive, --success, --chart-2, etc.) for all other colors, but StatusDot bypasses this system. In dark mode, these hex colors may have insufficient contrast or look visually inconsistent.
  - Fix: Refactor statusColor() to return semantic token names instead of hex strings. Map status IDs to token names: case 1 (Neu) → 'warning' (amber), case 11/21 (Escalated/Claim) → 'destructive' (red), case 22 (Approved) → 'success' (green), case 23 (Rejected) → 'warning', default → 'chart-1' (neutral). Update StatusDot to accept tokenName prop and render via data-color attribute or CSS variable. This ensures dark mode automatically inherits correct OKLCH values from :root/.dark scope.

### cross:Empty, Loading (Skeleton), and Error states. Consistency of component sourcing, breakpoint alignment, and patterns across areas.

_12 Befunde — 3 High · 8 Medium · 1 Low · 0 Nit_

- [ ] **[HIGH]** Zeiten loading skeleton uses KpiTilesSkeleton grid layout instead of flex row for stats  `state` · _mobile: grid-cols-2 vs flex-wrap creates visual discontinuity_
  - Datei: `c:\dev\pauls-autotask-ui\app\(app)\zeiten\loading.tsx` · skeleton loading config
  - Problem: Per pattern table: zeiten/loading.tsx renders stats with KpiTilesSkeleton (grid 3-col layout) but actual page renders stats as flex-wrap text row. This mismatch causes hydration shift on mobile: skeleton shows 3-column grid while real content shows single-row flex layout. Contrast: all other areas use correctly mirrored skeletons (e.g., TicketsList TableSkeleton matches card/table toggle, Companies KpiTilesSkeleton matches grid layout).
  - Fix: Create StatsRowSkeleton that mirrors the actual flex-wrap layout of zeiten page stats, or refactor stats to use consistent grid-based layout matching the skeleton.
- [ ] **[HIGH]** StatusDot uses hardcoded hex colors from statusColor() instead of semantic tokens  `color-token` · _dark-mode: alle_
  - Datei: `c:\dev\pauls-autotask-ui\components\status-indicator.tsx` · StatusDot rendering (inline style)
  - Problem: Per pattern table: StatusDot renders `<div style={{ backgroundColor: statusColor(status) }}>` with inline hex colors from statusColor mapping, not semantic tokens. This breaks dark mode: status colors are hardcoded oklch values that don't respect dark: overrides. Compare: PriorityBadge (priority-indicator.tsx) uses variant mapping to semantic tokens (destructive, success, outline, secondary). The pattern table flags this as 'color-token' violation with 'high' severity.
  - Fix: Replace inline style hex colors with semantic token-based Badge variants, similar to PriorityBadge and StatusBadge in projects/ProjectsList.
- [ ] **[HIGH]** TicketsList uses lg:hidden breakpoint for mobile cards, misaligned with Companies/Contacts xl pattern  `responsive` · _lg (1024px) vs xl (1280px)_
  - Datei: `c:\dev\pauls-autotask-ui\components\tickets\tickets-list.tsx` · line 727
  - Problem: TicketsList renders mobile cards with `grid-cols-1 gap-2 lg:hidden` (line 727) and table with `hidden lg:block` (line 747), toggling at lg (1024px). But CompaniesTable uses `grid-cols-1 gap-2 md:grid-cols-2 xl:hidden` (companies-table.tsx line 303) and `hidden xl:block` (line 340), toggling at xl (1280px). ContactsTable is identical: `grid-cols-1 gap-2 md:grid-cols-2 xl:hidden` and `hidden xl:block` (contacts-table.tsx lines 252, 286). This 256px divergence (lg vs xl) creates asymmetry: at 1024–1280px TicketsList shows table while others show cards, violating consistency across list pages.
  - Fix: Align TicketsList to use `xl:hidden` for cards and `xl:block` for table, matching the Companies/Contacts baseline. This maintains consistent responsive behavior across all list pages.
- [ ] **[MEDIUM]** Dashboard page uses Alert directly; OpenTickets and Ticket Detail diverge on error pattern  `consistency` · _alle_
  - Datei: `c:\dev\pauls-autotask-ui\app\(app)\page.tsx` · lines 114–126 (error handling)
  - Problem: Dashboard page (lines 114–126) uses `<Alert variant="destructive"><AlertCircleIcon /><AlertTitle>...</AlertTitle><AlertDescription>...</AlertDescription></Alert>` with icon + title. OpenTickets (dashboard/open-tickets.tsx lines 111–115) uses Alert + AlertDescription only (no title, no icon). DataError component (data-error.tsx) provides the icon + title + description pattern. Three different error renderings exist: (1) full Alert+title+icon (dashboard), (2) Alert+description only (OpenTickets), (3) DataError wrapper (ticket-detail). This violates DRY and creates visual inconsistency.
  - Fix: Standardize all error handling to use DataError component or a unified Alert pattern. Either use DataError everywhere or ensure all Alert usages include icon + title + description.
- [ ] **[MEDIUM]** MyProjectsSection uses raw text paragraph instead of Empty component for empty state  `component-sourcing` · _alle_
  - Datei: `c:\dev\pauls-autotask-ui\components\dashboard\my-projects-section.tsx` · lines 41-46
  - Problem: Empty state renders `<p className="text-muted-foreground rounded-lg border p-4 text-sm">` with inline copy, violating the shared Empty/EmptyHeader/EmptyMedia/EmptyTitle pattern. All other list areas (TicketsList, CompaniesTable, ContactsTable, ProjectsList) use the unified Empty component from @/components/ui/empty. This creates inconsistency in spacing (p-4 from paragraph vs p-6 from Empty), icon handling (none vs EmptyMedia variant), and maintenance burden.
  - Fix: Replace inline paragraph with Empty/EmptyHeader/EmptyMedia/EmptyTitle structure to match TicketsList (lines 711-721), CompaniesTable (lines 286-298), and ContactsTable (lines 235-247) patterns.
- [ ] **[MEDIUM]** OpenTickets uses Alert variant='destructive' directly instead of DataError wrapper  `component-sourcing` · _alle_
  - Datei: `c:\dev\pauls-autotask-ui\components\dashboard\open-tickets.tsx` · lines 111–115 (error handling)
  - Problem: OpenTickets renders errors as `<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>` (lines 111–115). The DataError component exists (components/data-error.tsx) to provide a unified error pattern with icon + title + description, but OpenTickets doesn't use it. Contrast: ticket-detail.tsx (per pattern table) uses DataError for consistency. This creates two divergent error rendering patterns in the codebase.
  - Fix: Use DataError component from @/components/data-error instead of raw Alert, or ensure all error messages use the same Alert+AlertDescription pattern for consistency.
- [ ] **[MEDIUM]** ProjectsList correctly uses Empty component, but Projects detail panels use md breakpoint instead of xl  `component-sourcing` · _768 (md) vs 1024 (lg) vs 1280 (xl)_
  - Datei: `c:\dev\pauls-autotask-ui\components\projects\projects-list.tsx` · lines 32-37 (import)
  - Problem: ProjectsList itself correctly imports and uses Empty (lines 32–37) with EmptyHeader/EmptyTitle/EmptyDescription pattern. However, the pattern table notes that project detail tabs render panels with `md:hidden / hidden md:block` (md breakpoint = 768px) while TicketsList uses lg (1024px), creating inconsistency in tablet layout. The list correctly uses xl toggle (inferred from imports), but detail views diverge to md, breaking consistency between areas.
  - Fix: Verify ProjectsList rendering breakpoints in actual implementation; if panels/tabs use md, align them to lg or xl to match TicketsList (lg) and Companies/Contacts (xl).
- [ ] **[MEDIUM]** ResultColumn renders empty/loading states as raw text instead of Empty component  `component-sourcing` · _alle_
  - Datei: `c:\dev\pauls-autotask-ui\components\search\result-column.tsx` · lines 71-75
  - Problem: Empty state uses `<p className="text-muted-foreground px-2 py-1.5 text-sm">Keine Treffer</p>` (line 74) and loading uses `<p>Suchen …</p>` (line 72), bypassing the Empty and Skeleton components used across the app. The text-only pattern has no icon affordance and incorrect padding (px-2 py-1.5 vs p-6 in Empty). Contrast: TicketsList (lines 711-721), CompaniesTable (lines 286-298), and ContactsTable (lines 235-247) all use structured Empty with EmptyMedia/EmptyTitle/EmptyDescription.
  - Fix: Use Empty component with EmptyMedia variant='icon' for empty state; use Skeleton components for loading state instead of raw text.
- [ ] **[MEDIUM]** FiltersSkeleton uses grid layout while real filter toolbars use flex flex-wrap  `consistency` · _sm (640px), md (768px): grid vs flex behavior differs_
  - Datei: `c:\dev\pauls-autotask-ui\components\skeletons.tsx` · lines 29–58 (FiltersSkeleton)
  - Problem: FiltersSkeleton (lines 29–58) renders filters in a `grid w-full gap-2 grid-cols-2 sm:grid-cols-4` structure. But real toolbar examples (TicketsList lines 565–673, CompaniesTable lines 229–276) use `flex flex-wrap items-center gap-2` layout. Grid layout locks column counts; flex-wrap adapts to content width. This mismatch means skeleton doesn't mirror real layout, violating the "skeletons match content" principle (skeletons.tsx comment line 12).
  - Fix: Refactor FiltersSkeleton to use `flex flex-wrap` layout matching real toolbars, or add a `layout` parameter to choose grid vs flex rendering.
- [ ] **[MEDIUM]** Mobile card grid breakpoints vary across list pages without consistent column progression  `responsive` · _md (768px): 1 vs 2 columns_
  - Datei: `c:\dev\pauls-autotask-ui\components\tickets\tickets-list.tsx` · line 727, and projects/projects-list.tsx detail panels
  - Problem: TicketsList cards: `grid-cols-1` only (no md:grid-cols-2 step). CompaniesTable/ContactsTable cards: `grid-cols-1 md:grid-cols-2`. ProjectsList: cards only on mobile, no explicit md step (inferred from loading.tsx). Zeiten/Vertrieb: similar variance. The majority pattern is 1→2 columns at md, but TicketsList skips this, creating inconsistent tablet UX: TicketsList shows single-column cards on tablet while others show 2-column.
  - Fix: Add `md:grid-cols-2` to TicketsList card grid (line 727) to match Companies/Contacts pattern and provide better tablet UX.
- [ ] **[MEDIUM]** Empty component uses p-6 padding which compounds with app layout's p-4 md:p-6  `spacing` · _alle_
  - Datei: `c:\dev\pauls-autotask-ui\components\ui\empty.tsx` · lines 5–15 (Empty component)
  - Problem: Empty component (lines 5–15) renders with `p-6` padding and `flex-1` (which expands to fill container height). App layout (app/(app)/layout.tsx line 94) uses `p-4 md:p-6` for content wrapper. When Empty is rendered inside the page (e.g., TicketsList line 711), it creates double padding: page has p-6, Empty has p-6, totaling p-12. This violates spacing consistency. Contrast: most components use no internal padding and rely on page/section gaps (gap-6) for spacing.
  - Fix: Remove `p-6` from Empty component base styles; let page layout control outer padding via gap-6. If icon/text need internal spacing, use gap-* instead of p-*.
- [ ] **[LOW]** TableSkeleton defaults to breakpoint='md' but most lists use 'xl' or 'lg'  `responsive` · _768 (md) vs 1024 (lg) vs 1280 (xl)_
  - Datei: `c:\dev\pauls-autotask-ui\components\skeletons.tsx` · lines 62–76 (TableSkeleton breakpoint default)
  - Problem: TableSkeleton function signature (line 62–76) defaults to `breakpoint = "md"`, but actual usage across loading.tsx files shows: TicketsList pages use `breakpoint="lg"` (tickets/my, team, ball), Companies/Contacts/Zeiten use `breakpoint="xl"`, Vertrieb uses `breakpoint="xl"`, Projects detail uses `breakpoint="md"`. The default is only correct for Projects detail; all other major lists override it, indicating the default is misleading and error-prone. This violates the principle that component defaults should match the most common usage.
  - Fix: Change default to `breakpoint = "xl"` (the mode used by Companies/Contacts/Zeiten/Vertrieb). Projects detail can explicitly pass `breakpoint="md"`.

---
_222 Befunde exportiert._
