# TODO

## Product Decisions Still to Make

-   [ ] Choose the product/brand name.
-   [ ] Define the initial target user segment more narrowly if needed.
-   [ ] Decide the first geographic market(s).
-   [ ] Decide which job sources are supported in the MVP.
-   [ ] Define exactly how source integrations will be accessed and what
    their permitted data usage is.
-   [ ] Define the authentication/account model.
-   [ ] Define whether the first release is free, paid, freemium, or
    another model.
-   [ ] Define usage limits for AI processing and job imports.
-   [ ] Decide whether users can have multiple target job searches
    simultaneously.
-   [ ] Define the initial notification strategy.
-   [ ] Decide what minimum profile completeness is required before
    matching jobs.

## Content To Replace

-   [ ] Replace placeholder company names.
-   [ ] Replace placeholder job titles.
-   [ ] Replace example match scores with real product data once
    available.
-   [ ] Finalize brand voice and product tagline.
-   [ ] Finalize onboarding copy.
-   [ ] Create real empty/error/loading-state copy after prototype
    testing.
-   [ ] Define help/education content for match scores and AI
    explanations.

## Design Questions

-   [ ] Select final typeface.
-   [ ] Select final brand accent color.
-   [ ] Establish final color tokens and semantic states.
-   [ ] Decide whether the desktop app uses a persistent sidebar or
    collapsible sidebar.
-   [ ] Decide whether Applications defaults to pipeline or list view.
-   [ ] Determine the ideal mobile navigation pattern.
-   [ ] Design the exact resume comparison/review interaction.
-   [ ] Decide how much of the original job description should be shown
    alongside normalized data.
-   [ ] Decide whether match scoring needs a visual meter or should
    remain primarily textual.
-   [ ] Establish company-logo treatment and fallback behavior.

## Technical Questions

-   [ ] Select the production frontend/full-stack framework.
-   [ ] Select database and hosting architecture.
-   [ ] Select AI model/provider strategy.
-   [ ] Design job-source adapter interfaces.
-   [ ] Determine public-page fetching/parsing architecture.
-   [ ] Define URL safety and SSRF protections for user-submitted job
    URLs.
-   [ ] Define job deduplication strategy and confidence thresholds.
-   [ ] Define the match-scoring methodology.
-   [ ] Define provenance storage for generated resume statements.
-   [ ] Define document export formats, if any.
-   [ ] Define observability and error-reporting approach.

## MVP Scope

### Must Have

-   [ ] Candidate profile/master resume.
-   [ ] Job discovery from an initial supported source.
-   [ ] Add any job by public URL.
-   [ ] Standardized job representation.
-   [ ] Job requirement extraction.
-   [ ] Candidate-job match score with explanation.
-   [ ] Job prioritization.
-   [ ] Resume tailoring from existing information.
-   [ ] Change-by-change review and approval.
-   [ ] Cover-letter generation.
-   [ ] Application-question assistance.
-   [ ] Human-controlled external application handoff.
-   [ ] Application tracking.
-   [ ] Dashboard.

### Defer

-   [ ] Autonomous application submission.
-   [ ] Large-scale source coverage.
-   [ ] Advanced career prediction.
-   [ ] Sophisticated outcome-learning models.
-   [ ] Automated recruiter communication.
-   [ ] Interview preparation suite.
-   [ ] Full career skill-development planning.
-   [ ] Advanced analytics.
-   [ ] Social/community features.

## Future Improvements

-   [ ] Learn candidate preferences from accepted/dismissed jobs.
-   [ ] Identify recurring skills across target roles.
-   [ ] Surface useful skill-gap trends.
-   [ ] Compare application outcomes across resume versions.
-   [ ] Recommend projects or learning based on recurring job
    requirements.
-   [ ] Add interview preparation based on specific applications.
-   [ ] Add smarter follow-up reminders.
-   [ ] Add additional job-source adapters.
-   [ ] Add richer career-search analytics.
-   [ ] Explore an eventual conversational career-assistant experience.

## Open Product Principle

Keep the product centered on one question:

> **"Is this opportunity worth my time, and can you help me prepare a
> strong application without taking away my control?"**

Any feature that does not strengthen that loop should be treated as
secondary.
