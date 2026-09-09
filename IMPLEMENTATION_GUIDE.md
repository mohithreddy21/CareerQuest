# Implementation Guide

## Architectural Goal

Build the product as a cohesive authenticated web application with
reusable domain components rather than separate page-specific
implementations.

The UI should reflect the product's core data flow:

**Candidate Profile + Job → Analysis → Match → Tailored Resume →
Application Materials → Tracking**

The frontend should consume normalized domain objects so the UI does not
care whether a job came from an integrated source or a pasted URL.

## Recommended Technology Direction

Use a modern component-based frontend framework suitable for an
AI-assisted coding workflow.

Recommended baseline: - React + TypeScript. - Next.js or an equivalent
full-stack React framework. - Utility-first CSS or a structured CSS
system. - Component primitives with accessible behavior. -
Server-side/API routes where secure processing is required.

Exact framework/vendor choices can remain flexible if the coding agent's
environment already establishes them.

## Suggested Application Structure

``` text
app/
  dashboard/
  discover/
  jobs/[jobId]/
  resume/
  resume/tailor/[jobId]/
  applications/
  applications/[applicationId]/
  settings/

components/
  layout/
  navigation/
  jobs/
  matching/
  resume/
  applications/
  ai/
  forms/
  feedback/
  ui/

lib/
  api/
  parsing/
  matching/
  validation/
  formatting/

types/
  candidate.ts
  job.ts
  application.ts
  resume.ts
  ai.ts
```

The exact folder names can vary, but the domain separation should
remain.

## Core Domain Models

### CandidateProfile

Conceptually contains: - identity/contact information - professional
summary - target roles - experience - education - skills - projects -
certifications - preferences

### Job

Normalized object: - id - title - company - location - workArrangement -
description - responsibilities\[\] - requiredSkills\[\] -
preferredSkills\[\] - experienceRequirement - educationRequirement -
salary - postedDate - source - originalUrl - normalizedAt -
duplicateGroupId where applicable

### JobAnalysis

Contains: - seniority - roleCategory - technicalRequirements\[\] -
softSkills\[\] - importantKeywords\[\] - extractedRequirements\[\] -
analysisStatus

### JobMatch

Contains: - score - recommendation - strongMatches\[\] -
partialMatches\[\] - missingRequirements\[\] -
supportingCandidateEvidence\[\] - reasoning

The score should be treated as an aid for prioritization, not a hiring
probability.

### ResumeVersion

Contains: - base/master resume reference - job reference when tailored -
generated sections - changes\[\] - approval state - createdAt

Each change should conceptually contain: - original content - proposed
content - rationale - jobRequirement - sourceCandidateEvidence - status:
pending/approved/rejected/edited

### Application

Contains: - jobId - status - dateDiscovered - dateApplied -
resumeVersionId - coverLetter - applicationAnswers - notes -
interviewStages\[\] - followUpDate - statusHistory\[\]

## Reusable Components

### Layout

-   `AppShell`
-   `Sidebar`
-   `MobileNavigation`
-   `PageHeader`
-   `Section`
-   `Breadcrumbs`

### Jobs

-   `JobCard`
-   `JobList`
-   `JobFilters`
-   `JobSourceBadge`
-   `JobStatusBadge`
-   `JobImportDialog`
-   `JobHeader`
-   `JobDescription`
-   `RequirementList`

### Matching

-   `MatchScore`
-   `MatchSummary`
-   `MatchBreakdown`
-   `Recommendation`
-   `CandidateEvidence`

### Resume

-   `ResumeSection`
-   `ResumePreview`
-   `ResumeChange`
-   `ResumeChangeList`
-   `ApprovalControls`
-   `ResumeVersionSelector`

### Applications

-   `ApplicationPipeline`
-   `ApplicationCard`
-   `ApplicationList`
-   `ApplicationStatus`
-   `ApplicationTimeline`
-   `FollowUpControl`

### AI / Feedback

-   `AIProcessingState`
-   `AIContentLabel`
-   `AIExplanation`
-   `GenerationControls`
-   `ErrorState`
-   `EmptyState`
-   `SuccessFeedback`

### General UI

Use a consistent primitive layer for: - Button - Input - Textarea -
Select - Dialog - Drawer - Tabs - Badge - Tooltip - Dropdown - Toast -
Skeleton - Progress indicator

Do not create one-off versions of these primitives per page.

## Important Interaction Requirements

### URL Job Import

Flow: 1. User pastes URL. 2. Validate URL format. 3. Start import. 4.
Show meaningful processing state. 5. Fetch/parse public content through
a secure server-side path. 6. Normalize into `Job`. 7. Detect possible
duplicate. 8. Run analysis. 9. Generate match against current candidate
profile. 10. Show standardized result. 11. Allow candidate to
save/ignore/review.

Never expose server-side credentials or scraping/API secrets in the
browser.

### Job Source Normalization

Create a source-adapter boundary.

Conceptually:

``` text
Source Adapter
    ↓
Raw Job Data
    ↓
Normalizer
    ↓
Normalized Job
    ↓
Analysis / Matching
```

Adding a new job source should not require changing job cards, matching
UI, resume tailoring, or application tracking.

### Duplicate Detection

Use deterministic identifiers where available and conservative
similarity checks where needed.

If confidence is uncertain, surface a possible duplicate for user review
instead of silently merging unrelated jobs.

### Match Analysis

The UI should not render a percentage alone.

A match response should provide: - score - recommendation - evidence -
gaps - requirements

The UI must tolerate missing analysis data and show an appropriate
processing or unavailable state.

### Resume Tailoring

The frontend should represent resume tailoring as a review workflow, not
a single "Generate" action.

Each AI change needs an approval state.

Recommended interaction: - Pending changes visible by default. -
Approve/reject individually. - Approve all only after displaying a clear
summary. - Allow manual editing. - Preserve original master resume.

Never overwrite the master resume silently.

### Application Preparation

Generated content should be editable before use.

Provide: - generate - regenerate - edit - copy - reset where safe

The final action should open the original application destination or
otherwise clearly hand control back to the candidate.

Do not implement autonomous submission in the initial version.

### Application Tracking

Status changes should be explicit and persistable.

Drag-and-drop can be an enhancement, not the only way to change status.

Every status change should update the application timeline/history.

## Page Organization

Authenticated routes should share the same app shell.

Public/marketing pages, if added later, should use a separate marketing
shell so the product workspace remains focused.

Prefer route-level composition:

``` text
AppShell
  ├── PageHeader
  ├── Main Content
  └── Contextual Actions
```

Avoid duplicating navigation, headers, spacing, or status components
inside individual pages.

## State Management

Use local component state for ephemeral UI: - dialogs - tabs - expanded
sections - input drafts

Use server/query state for: - jobs - candidate profile - analysis -
applications - resume versions

Use a centralized client state mechanism only where cross-page state
genuinely requires it.

Do not introduce global state for simple local interactions.

## Async / Loading States

Every AI or parsing operation must have explicit states: - idle -
processing - success - error

Use skeletons for known page structures and meaningful status text for
AI processing.

Avoid blocking the entire application for a single AI operation where
possible.

## Error Handling

Errors should be actionable.

Examples: - URL inaccessible. - Job content could not be parsed. - AI
analysis unavailable. - Candidate profile incomplete. - Generated
content unavailable. - Save failed.

Provide retry or recovery actions whenever possible.

## Accessibility

Implement: - Semantic HTML. - Correct heading hierarchy. -
Keyboard-accessible controls. - Visible focus states. - Labels for all
inputs. - Accessible dialogs and drawers. - `aria-live` announcements
for important asynchronous state changes. - Non-color-only status
communication. - Reduced-motion support. - Adequate touch targets.

Drag-and-drop application movement must have an equivalent
keyboard/button interaction.

## Responsive Behavior

### Desktop

Use wide layouts for: - job + match comparison - resume tailoring -
application review

### Mobile

Transform multi-column layouts into a logical sequence: 1. Job context.
2. Match. 3. Requirements. 4. Candidate evidence. 5. Action.

For resume tailoring: 1. Job requirements. 2. Proposed change. 3.
Rationale. 4. Approve/edit/reject.

Keep critical actions accessible without requiring users to scroll back
to the top.

## Performance

-   Lazy-load heavy views when appropriate.
-   Avoid loading every job description in the initial dashboard.
-   Paginate or virtualize large job/application lists if necessary.
-   Cache normalized job data and analysis results appropriately.
-   Debounce search/filter interactions.
-   Use optimistic updates only when rollback behavior is clear.

## Security / Privacy

Candidate information is sensitive career data.

Implementation should: - Keep AI/API secrets server-side. - Validate
imported URLs server-side. - Sanitize parsed job content. - Prevent
arbitrary external content from being injected into the UI. - Enforce
authorization on every candidate-specific resource. - Avoid exposing
another user's profile, resume, or application data. - Treat generated
content as untrusted until reviewed. - Log sensitive operations
carefully and minimize unnecessary personal data in logs.

## Content Integrity

The system must preserve provenance for resume tailoring.

A generated resume statement should be traceable to candidate-provided
source information.

Do not implement generation in a way that makes provenance impossible to
inspect.

## Technical Boundaries

The coding agent should not prematurely build: - autonomous application
submission - complex career prediction - elaborate recommendation
models - large-scale analytics - dozens of job-source integrations -
social networking - recruiter functionality

Build the core loop first:

**Profile → Job Import/Discovery → Normalize → Analyze → Match → Tailor
→ Review → Apply → Track**

## Suggested MVP Build Order

1.  App shell and navigation.
2.  Candidate profile/master resume.
3.  Job data model and standardized job UI.
4.  Manual URL import.
5.  Job analysis and match presentation.
6.  Discover jobs from at least one supported source.
7.  Resume tailoring review workflow.
8.  Application preparation.
9.  Application tracking.
10. Dashboard aggregation.
11. Additional sources and long-term insights.

The implementation should remain modular so additional job sources can
be added without redesigning the core workflow.
