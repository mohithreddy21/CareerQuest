# Page Structure

## Information Architecture

The application is a signed-in workspace organized around the
candidate's job-search lifecycle.

### Primary navigation

1.  Dashboard
2.  Discover Jobs
3.  Applications
4.  Resume & Profile
5.  Settings

Contextual navigation should appear inside job and application workflows
rather than expanding the global navigation unnecessarily.

## Global App Shell

### Desktop

-   Persistent left sidebar or compact vertical navigation.
-   Main content area with a clear page title and contextual actions.
-   Optional right-side contextual panel for AI insights where useful.
-   User/profile menu in the global shell.

### Mobile

-   Simplified top navigation.
-   Primary actions remain easy to reach.
-   Use bottom navigation only if it materially improves task switching;
    otherwise use a compact menu.
-   Avoid reproducing the desktop sidebar as a cramped drawer-only
    experience.

------------------------------------------------------------------------

# 1. Dashboard

## Purpose

Give the candidate an immediate view of what deserves attention and
provide a starting point for the next action.

## Sections

### A. Welcome / Search Status

Purpose: orient the candidate and summarize the current search.

Content: - Short personalized greeting. - Target role or search focus. -
High-level application activity.

Primary CTA: - **Discover Jobs**

Secondary CTA: - **Add Job by URL**

### B. Recommended Opportunities

Purpose: surface the highest-value jobs without requiring the user to
browse everything.

Each opportunity preview should show: - Role - Company - Location/work
arrangement - Match score - Short reason for recommendation - Current
application status

CTA: - **Review Job**

### C. Application Pipeline

Purpose: make the lifecycle visible.

Stages: - Discovered - Interested - Preparing - Applied - Interview -
Offer / Rejected

Show counts and optionally a compact visual pipeline.

CTA: - **View Applications**

### D. Tasks / Next Actions

Purpose: turn the dashboard into an actionable workspace.

Examples: - Review a strong match. - Finish a tailored resume. - Review
an application answer. - Follow up on an application.

### E. Search Insights

Purpose: provide useful aggregated observations without overwhelming the
user.

Examples: - Frequently requested skills. - Number of relevant jobs
found. - Common missing skills. - Application response trends.

This can be reduced or deferred in the MVP.

------------------------------------------------------------------------

# 2. Discover Jobs

## Purpose

Provide a single place to find, import, filter, and prioritize
opportunities.

## Sections

### A. Search / Import Header

Primary actions: - Search jobs from supported sources. - **Add Job by
URL**

The URL import should be prominent, not hidden.

### B. Source Controls

Allow filtering by supported source/platform.

Display the source for every job.

### C. Job List

Each standardized job card should include: - Job title - Company -
Location - Remote/hybrid/onsite - Match score - Salary if available -
Posting age/date if available - Source - Status - Short fit explanation

Primary CTA: - **View Match**

Secondary actions: - Save / Interested - Dismiss - Add to application
pipeline

### D. Filters

Useful filters: - Role/category - Location - Work arrangement -
Experience level - Match score - Salary when available - Source -
Application status

### E. URL Import Flow

A modal or dedicated panel: 1. Paste URL. 2. Fetch and parse. 3. Show
parsing state. 4. Show normalized job preview. 5. Run analysis. 6.
Present job detail.

Failure state should explain that the page could not be parsed and offer
a retry/manual review path rather than silently failing.

------------------------------------------------------------------------

# 3. Job Detail / Match Analysis

## Purpose

Help the candidate decide whether a job deserves their time.

## Sections

### A. Job Header

Show: - Title - Company - Location - Work arrangement - Source -
Original posting link - Save/status action

Primary CTA: - **Start Application**

Secondary CTA: - **Mark Interested** - **Dismiss**

### B. Match Summary

Make the fit score prominent but contextual.

Show: - Match percentage - Plain-language recommendation - Short
explanation of what drives the score

Example: **91% match --- Strong opportunity** "Your backend experience
aligns well with the core requirements. Kubernetes is the main gap."

### C. Requirement Breakdown

Separate: - Strong matches - Partial matches - Missing requirements -
Required skills - Preferred skills

Do not rely on a single score.

### D. Responsibilities

Show normalized responsibilities from the posting.

### E. Candidate Evidence

For relevant requirements, show the candidate experience that supports
the match.

### F. Full Job Description

Preserve access to the original normalized description.

### G. Application Actions

Primary: - **Tailor Resume**

Secondary: - Prepare application - Open original job - Change status

------------------------------------------------------------------------

# 4. Resume & Profile

## Purpose

Maintain the candidate's source-of-truth professional information.

## Sections

### A. Profile Overview

-   Name
-   Professional summary
-   Target roles
-   Location/preferences
-   Contact information

### B. Experience

-   Employer
-   Role
-   Dates
-   Responsibilities
-   Achievements
-   Candidate-authored evidence

### C. Education

-   Institution
-   Degree
-   Dates
-   Relevant details

### D. Skills

Group into: - Technical skills - Tools/technologies - Soft skills -
Other relevant skills

### E. Projects

-   Project name
-   Description
-   Technologies
-   Contributions
-   Outcomes

### F. Certifications / Additional Information

### G. Master Resume

Provide a clear representation of the master resume and make its role as
the source of truth explicit.

Primary CTA: - **Save Changes**

Secondary: - Preview master resume

------------------------------------------------------------------------

# 5. Resume Tailoring Workspace

## Purpose

Help the candidate create a job-specific resume from truthful existing
information.

## Layout

Use a comparison-oriented workspace.

### A. Job Context Panel

-   Target job
-   Key requirements
-   Match priorities

### B. Tailored Resume Panel

Show the proposed resume.

### C. Change Review

For each proposed change show: - Original content - Proposed content -
Why it changed - Job requirement motivating the change - Source
experience from the master profile

Actions: - **Approve** - Reject - Edit

### D. Integrity Indicator

Clearly communicate that generated content is grounded in
candidate-provided information.

Primary CTA: - **Approve Resume**

Secondary: - Edit manually - Save as version

------------------------------------------------------------------------

# 6. Application Preparation

## Purpose

Prepare all non-submission materials required for a specific job.

## Sections

### A. Application Context

Show: - Job - Company - Selected resume version

### B. Cover Letter

AI-generated draft based on candidate profile + job + approved resume.

Actions: - Generate - Regenerate - Edit - Copy

### C. Application Questions

For each question: - Question - Suggested answer - Source/context used -
Edit controls

### D. Professional Summary / Short Answers

Generate job-specific supporting content where useful.

### E. Final Review

Checklist: - Resume approved - Cover letter reviewed - Questions
reviewed - Candidate ready to apply

Primary CTA: - **Ready to Apply**

This should lead to the external job/application page rather than
submitting automatically.

------------------------------------------------------------------------

# 7. Applications

## Purpose

Track the candidate's complete job-search pipeline.

## Views

### A. Pipeline View

Columns: - Discovered - Interested - Preparing - Applied - Interview -
Offer / Rejected

Cards should be draggable on desktop if practical, but status controls
must also work without drag-and-drop.

### B. List View

Provide a sortable/filterable table or list for users managing many
applications.

Fields: - Company - Role - Match - Status - Date discovered - Date
applied - Resume version - Follow-up - Last updated

### C. Application Detail

Show: - Job information - Status history - Resume version used - Cover
letter - Notes - Interview stages - Follow-up dates - Original job URL

Primary contextual actions: - Update status - Add note - Set follow-up

------------------------------------------------------------------------

# 8. Settings

## Purpose

Manage product preferences and integrations.

Potential sections: - Account - Job-search preferences - Job sources -
Notifications - AI preferences - Privacy/data controls

Keep the MVP settings surface small.

------------------------------------------------------------------------

# User Journey

## First-time user

Landing / entry → Create profile → Add/import master resume → Define
target roles/preferences → Dashboard → Discover Jobs

## Returning user

Dashboard → Review recommended job → View match analysis → Decide →
Tailor resume → Review changes → Prepare application → Apply externally
→ Mark Applied → Track

## Manual job flow

Discover Jobs → Add Job by URL → Parse → Normalize → Analyze → Match →
Job Detail

## Multi-source flow

Supported sources → Parse → Normalize → Deduplicate → Analyze → Match →
Ranked job list

## Tracking flow

Job → Interested → Preparing → Applied → Interview → Offer/Rejected

## Core hierarchy

The product should consistently prioritize:

1.  **What should I pay attention to?**
2.  **Why is this opportunity worth my time?**
3.  **What should I do next?**
4.  **What did the AI change and why?**
5.  **What is the current state of my application?**
