# Design System

## Visual Direction

Create a modern productivity application with the calm confidence of a
professional career tool.

The visual language should combine: - Editorial clarity. - SaaS
productivity patterns. - Strong information hierarchy. - Subtle AI
cues. - High readability.

The product should feel intelligent without looking like a futuristic AI
demo.

## Typography

Recommended direction: - Use a highly legible modern sans-serif. - Use
one primary typeface across the product. - Establish a clear hierarchy
rather than relying on many font weights.

Suggested scale: - Page title: 28--36px desktop. - Section title:
20--24px. - Card title: 16--18px. - Body: 14--16px. - Supporting text:
12--14px. - Small metadata: 12px.

Mobile headings should scale down without becoming visually weak.

## Color Direction

Use a restrained neutral foundation with one primary brand accent.

Recommended semantic roles: - Background: warm or cool near-white. -
Surface: white or slightly elevated neutral. - Primary text: very dark
neutral. - Secondary text: muted neutral. - Border: subtle neutral. -
Brand accent: confident blue/indigo or another trustworthy single
accent. - Success: reserved green. - Warning: amber. - Error: red.

Do not use gradients as the primary visual identity.

AI-generated content can use a subtle accent treatment, but do not make
every AI feature glow.

## Spacing

Use a consistent spacing scale based on approximately 4px increments.

Preferred values: - 4px: micro spacing. - 8px: icon/label spacing. -
12px: compact internal spacing. - 16px: default control/card spacing. -
24px: section spacing. - 32px: major grouping. - 48px+: page-level
separation.

Prefer generous whitespace over dense decoration.

## Layout Principles

-   Use a constrained content width for reading-heavy screens.
-   Use wider layouts for dashboards and comparison workspaces.
-   Align cards and sections to a consistent grid.
-   Avoid excessive full-width containers.
-   Maintain clear visual grouping.
-   Keep primary actions in predictable locations.

For complex workflows, favor a two-panel or three-panel layout only when
comparison materially benefits the user.

## Cards

Cards should communicate distinct pieces of information.

Use: - Subtle borders. - Small or restrained corner radii. - Minimal
shadows. - Consistent internal padding.

Avoid: - Excessively rounded "bubble" cards. - Heavy shadows. - Every
piece of content being wrapped in its own card.

Job cards should prioritize title, company, fit, and next action.

## Buttons

Primary: - Solid brand accent. - Strong contrast. - Clear action verb.

Secondary: - Neutral outline or subtle surface treatment.

Tertiary: - Text/button treatment for low-risk actions.

Destructive: - Use only for meaningful destructive operations.

Use action-oriented labels: - Discover Jobs - Add Job by URL - Review
Match - Tailor Resume - Approve Resume - Ready to Apply

Avoid vague labels such as "Continue" when a more specific action is
available.

## Forms

-   Labels must always be visible.
-   Use helpful descriptions only where necessary.
-   Show validation close to the relevant field.
-   Preserve entered data after errors.
-   Make URL import extremely simple: one clear field plus one clear
    action.
-   Avoid multi-step forms unless the task genuinely benefits from them.

## Navigation

Global navigation should remain stable.

Recommended order: 1. Dashboard 2. Discover Jobs 3. Applications 4.
Resume & Profile 5. Settings

The active destination should be obvious but understated.

Contextual navigation should use breadcrumbs or local tabs when users
move into job-specific workflows.

## Borders and Shadows

Prefer borders over shadows for most surfaces.

Use shadows only for: - Floating menus. - Modals. - Popovers. -
Important elevated panels.

Avoid heavy neumorphism and excessive depth.

## Match Scores

Do not communicate fit using color alone.

A match score should include: - Percentage. - Text label. -
Explanation. - Supporting requirement breakdown.

Example: **91% --- Strong opportunity**

Use semantic indicators for strong/partial/missing matches, plus
explicit text.

## AI Content

AI-generated material should be clearly identifiable but not visually
separated so aggressively that it feels untrustworthy.

Use: - Small AI label. - Subtle accent indicator. - Explainability
affordance. - Review/approve controls.

Never imply that AI output is automatically authoritative.

## Imagery

The core product does not require large decorative imagery.

Prefer: - Product UI. - Small illustrations only when they explain a
concept. - Company logos where appropriate and legally/technically
available. - Functional visualizations for application pipeline and
insights.

Avoid: - Generic stock photos of people at laptops. - Inspirational
career photography. - Decorative images that compete with job
information.

## Iconography

Use one consistent icon set.

Icons should: - Support recognition. - Never replace necessary text. -
Have consistent stroke/weight. - Be used sparingly.

Use icons for status, navigation, import, filtering, editing, and
lightweight actions.

## Animation / Motion

Motion should communicate state, not decorate the interface.

Use: - Short transitions for panels and modals. - Skeleton loading for
job parsing/analysis. - Clear progress states during AI processing. -
Subtle success feedback after approval/save.

Avoid: - Constant floating elements. - Large animated AI effects. - Long
transitions. - Motion that delays task completion.

## Loading and AI Processing

AI operations should always communicate: - What is happening. - Which
object is being processed. - Whether the user can leave the screen. -
Whether the result is complete.

Examples: - "Fetching job posting..." - "Extracting requirements..." -
"Comparing your experience..." - "Preparing tailored resume..."

Do not show a generic infinite spinner when meaningful progress can be
described.

## Empty States

Every major page needs a useful empty state.

Example: No applications yet: "Your application pipeline is empty. Start
by finding a role worth pursuing."

CTA: **Discover Jobs**

## Error States

Errors should be: - Specific. - Actionable. - Non-blaming.

For URL parsing: "We couldn't extract a job posting from this URL. The
page may require access we don't have. Try another public job URL or
review the job manually."

## Responsive / Mobile Principles

The product must be usable on small screens, not merely visually
compressed.

### Mobile

-   Single-column content by default.
-   Stack comparison panels.
-   Convert large tables into cards or horizontally scrollable regions
    only when necessary.
-   Keep primary actions visible.
-   Use sticky bottom actions for important approval steps where
    helpful.
-   Preserve readability of job descriptions and resumes.

### Tablet

-   Use two-column layouts selectively.
-   Preserve comfortable touch targets.

### Desktop

-   Take advantage of wider screens for job/profile comparisons and
    application review.

Minimum touch target should generally be approximately 44px.

## Accessibility

-   Meet WCAG 2.2 AA where practical.
-   Keyboard navigation for all interactions.
-   Visible focus states.
-   Semantic headings.
-   Proper form labels.
-   Do not communicate status by color alone.
-   Sufficient contrast.
-   Screen-reader-friendly status updates for AI processing.
-   Respect reduced-motion preferences.

## Things to Avoid

-   Generic AI SaaS landing-page aesthetics.
-   Excessive gradients.
-   Neon "AI" visuals.
-   Giant hero sections inside the authenticated product.
-   Overuse of rounded cards.
-   Dashboard clutter.
-   Mystery scores without explanations.
-   Fake precision around job-fit percentages.
-   Automatic application submission.
-   AI-generated claims presented as fact without review.
-   UI that encourages applying to everything.
-   Excessive gamification.
