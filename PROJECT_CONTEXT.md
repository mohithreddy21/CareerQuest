# Project Context

## Product

The product is an AI-powered job-search workspace that helps candidates
move from job discovery to application preparation and tracking in one
place.

It is explicitly **not** an autonomous mass-application bot and not
merely an AI resume builder. Its core promise is to reduce repetitive
job-search work while keeping the candidate in control of decisions and
final submission.

Core flow:

**Discover → Parse & Normalize → Analyze → Match & Rank → Prioritize →
Tailor Resume → Prepare Application → Review → Apply → Track → Learn**

## Target Audience

Primary audience: - Job seekers actively applying to roles. -
Early-career and experienced candidates who apply to multiple relevant
positions. - Candidates who already have a resume or professional
history but find tailoring and tracking repetitive. - Candidates who
want AI assistance without surrendering judgment or submitting
applications automatically.

Initial product assumptions: - The first release should optimize for
individual candidates rather than recruiters or hiring teams. - The
interface should work for a broad range of professional roles, while
technical roles are a useful example. - Users may discover jobs on many
different websites, so the product must support both aggregated sources
and manual URL import.

## User Problem

Job searching is fragmented and repetitive. Candidates must: 1. Search
multiple job sources. 2. Open and interpret individual postings. 3.
Decide whether a role is worth pursuing. 4. Compare requirements with
their own experience. 5. Tailor a resume. 6. Write cover letters and
application answers. 7. Submit applications. 8. Remember what they
applied to and which materials they used. 9. Follow up and track
outcomes.

The product should reduce this administrative burden without reducing
the candidate's agency.

## Desired User Action

The primary desired action is for a candidate to turn a relevant job
into a reviewed, high-quality application efficiently.

At every stage, the product should guide the user toward a clear next
step: - Discover or add a job. - Understand the opportunity. - Decide
whether it is worth pursuing. - Tailor application materials. - Review
and approve. - Apply externally. - Track the outcome.

## Product Goals

### Primary goals

-   Reduce time spent searching and processing job postings.
-   Make job relevance understandable rather than presenting opaque AI
    scores.
-   Create a reliable source of truth for the candidate's professional
    information.
-   Make resume tailoring faster while preserving truthfulness.
-   Keep application materials consistent with the candidate's profile
    and the selected job.
-   Give candidates a useful application-tracking workspace.
-   Encourage quality and prioritization rather than indiscriminate
    application volume.

### Long-term goal

Evolve toward an AI career operating system that can learn from a
candidate's preferences, target roles, skills, applications, and
outcomes.

Long-term capabilities may include learning which roles and companies
the candidate prefers, identifying recurring skill gaps, and
understanding which application approaches produce better responses.

## Brand Personality

The brand should feel: - Intelligent - Calm - Practical - Trustworthy -
Focused - Modern - Human-controlled - Helpful without being overly
enthusiastic

The product should feel like a capable career co-pilot, not a flashy AI
toy.

Avoid: - Hype-heavy AI language. - Promises of guaranteed interviews or
jobs. - Aggressive gamification. - Dark patterns encouraging unnecessary
applications. - Visuals that make the product feel like an autonomous
bot.

## Overall Experience

The candidate should feel:

> "This product understands my background, helps me quickly understand
> which jobs deserve my attention, and takes care of the repetitive
> preparation work while I stay in control."

The experience should be progressive. The product should reveal
complexity only when useful: - Dashboard first: what needs attention. -
Job discovery: opportunities worth reviewing. - Job detail: why the
opportunity matters. - Application workspace: what the AI changed and
why. - Tracking: what is happening across the search.

The interface should consistently explain AI-generated recommendations
and make human approval explicit.

## Human-in-the-Loop Principle

**Automate the tedious parts of job hunting, not the candidate's
judgment.**

AI may: - Parse job descriptions. - Extract requirements. - Normalize
jobs. - Match candidate experience. - Rank opportunities. - Suggest
resume changes. - Rewrite existing candidate information. - Generate
application content. - Organize information.

The candidate must: - Decide which jobs to pursue. - Review generated
content. - Approve resume changes. - Submit applications. - Communicate
with recruiters. - Prepare for interviews.

## Important Assumptions

1.  Users maintain one master resume/profile as the source of truth.
2.  Every imported job is converted into a standardized internal
    representation regardless of source.
3.  Duplicate postings should be detected where reasonably possible.
4.  Manual URL import is a first-class feature, not a fallback hidden in
    settings.
5.  AI fit scores are prioritization aids, not predictions of hiring
    success.
6.  AI must never invent experience, skills, technologies, achievements,
    metrics, responsibilities, or employment history.
7.  Generated resume statements must be traceable to candidate-provided
    information.
8.  Users review generated application materials before external use.
9.  The initial website should prioritize a focused MVP experience over
    a large collection of AI utilities.
10. External application submission is human-controlled in the initial
    product.
11. Exact job-source integrations, authentication providers, AI vendors,
    and data infrastructure are implementation decisions rather than
    product decisions at this stage.
12. Salary, posting date, and other job fields may be unavailable and
    should gracefully show an unavailable state rather than fabricated
    information.
