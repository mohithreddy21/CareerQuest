import { RawJobExtraction, NormalizedJobData } from './types';

export type JobExtractionQualityState = 'reliable' | 'partial' | 'insufficient';

export interface JobExtractionQualitySignals {
  hasPlausibleTitle: boolean;
  hasPlausibleCompany: boolean;
  hasMeaningfulDescription: boolean;
  hasJobMarkers: boolean;
  isSingleJobPosting: boolean;
  garbageKeywordCount: number;
  garbageContentRatio: number;
  hasSkillsOrResponsibilities: boolean;
}

export interface JobExtractionQualityResult {
  state: JobExtractionQualityState;
  score: number; // 0 - 100 confidence
  reasons: string[];
  signals: JobExtractionQualitySignals;
}

const GENERIC_NON_JOB_TITLES = new Set([
  'search jobs',
  'job search',
  'careers',
  'career portal',
  'careers portal',
  'career opportunities',
  'all jobs',
  'open positions',
  'openings',
  'job openings',
  'search results',
  'apply now',
  'sign in',
  'login',
  'create alert',
  'job alert',
  'job alerts',
  'home',
  'welcome',
  'explore jobs',
  'find a job',
  'join us',
  'recommended jobs'
]);

const JOB_MARKER_REGEX =
  /\b(responsibilities|requirements|qualifications|about the role|what you'll do|what you will do|what we're looking for|what we look for|key responsibilities|required skills|preferred skills|experience|duties|role overview|who you are)\b/i;

const GARBAGE_SEARCH_PATTERNS = [
  /search\s+jobs/gi,
  /recommended\s+for\s+you/gi,
  /recommended\s+jobs/gi,
  /similar\s+jobs/gi,
  /people\s+also\s+viewed/gi,
  /create\s+job\s+alert/gi,
  /sign\s+in\s+to\s+apply/gi,
  /sign\s+in\s+to\s+create/gi,
  /browse\s+jobs/gi,
  /jobs\s+you\s+may\s+be\s+interested\s+in/gi,
  /filter\s+jobs/gi,
  /refine\s+search/gi,
  /showing\s+results\s+for/gi,
  /view\s+all\s+jobs/gi,
  /see\s+more\s+jobs/gi,
  /privacy\s+policy/gi,
  /terms\s+of\s+(service|use)/gi,
  /cookie\s+(settings|preferences|notice|policy)/gi,
  /all\s+rights\s+reserved/gi,
  /copyright\s+\d{4}/gi,
  /sitemap/gi,
  /back\s+to\s+top/gi
];

/**
 * Evaluates whether extracted job content represents a genuine, usable, single job posting.
 * Prevents garbage/navigation/search page scrapes from becoming valid-looking jobs.
 */
export function evaluateJobExtractionQuality(
  job: Partial<RawJobExtraction | NormalizedJobData>
): JobExtractionQualityResult {
  const reasons: string[] = [];
  const title = (job.title || '').trim();
  const titleLower = title.toLowerCase();
  const company = (job.company || '').trim();
  const description = (job.description || '').trim();
  const responsibilities = job.responsibilities || [];
  const requiredSkills = job.requiredSkills || [];

  // 1. Title Evaluation
  let hasPlausibleTitle = false;
  if (!title || title.length < 3) {
    reasons.push('Job title is missing or suspiciously short.');
  } else if (title.length > 130) {
    reasons.push('Job title exceeds plausible length.');
  } else if (GENERIC_NON_JOB_TITLES.has(titleLower)) {
    reasons.push(`Job title '${title}' appears to be a navigation header or search portal title.`);
  } else if (/^(search|browse|explore|find)\s+(jobs|positions|careers)/i.test(titleLower)) {
    reasons.push(`Job title '${title}' is a search action rather than a specific role.`);
  } else {
    hasPlausibleTitle = true;
  }

  // 2. Company Evaluation
  const hasPlausibleCompany = Boolean(company && company.length >= 2);
  if (!hasPlausibleCompany) {
    reasons.push('Company name is absent or unspecified.');
  }

  // 3. Description Evaluation
  const descLength = description.length;
  let hasMeaningfulDescription = false;
  if (descLength < 120) {
    reasons.push(
      `Job description is too short (${descLength} characters) to contain usable requirements.`
    );
  } else {
    hasMeaningfulDescription = true;
  }

  // 4. Job Marker Signals
  const hasJobMarkers = JOB_MARKER_REGEX.test(description);
  if (!hasJobMarkers) {
    reasons.push(
      'No standard job posting markers (responsibilities, qualifications, requirements) found in description.'
    );
  }

  // 5. Skills or Responsibilities
  const hasSkillsOrResponsibilities = responsibilities.length > 0 || requiredSkills.length > 0;
  if (!hasSkillsOrResponsibilities) {
    reasons.push('No discrete responsibilities or technical skills were successfully parsed.');
  }

  // 6. Garbage, Search Page, & Navigation Content Analysis
  let garbageKeywordCount = 0;
  for (const pattern of GARBAGE_SEARCH_PATTERNS) {
    const matches = description.match(pattern);
    if (matches) {
      garbageKeywordCount += matches.length;
    }
  }

  // Estimate ratio of search/portal boilerplate
  const garbageContentRatio = Math.min(1.0, (garbageKeywordCount * 25) / Math.max(descLength, 1));
  let isSingleJobPosting = true;

  if (garbageKeywordCount >= 2 && !hasJobMarkers && !hasSkillsOrResponsibilities) {
    isSingleJobPosting = false;
    reasons.push(
      'Extracted content is dominated by navigation, footer, or search portal text without job requirements.'
    );
  } else if (garbageKeywordCount >= 3 && !hasJobMarkers) {
    isSingleJobPosting = false;
    reasons.push(
      'Extracted content is dominated by job search portals or recommendation sidebars.'
    );
  } else if (garbageContentRatio > 0.25) {
    isSingleJobPosting = false;
    reasons.push(
      'Extracted content has an excessively high ratio of navigation/search boilerplate.'
    );
  }

  // Multi-job / Search result detection (e.g. repeated "Apply", "Save Job", "View Job", "Easy Apply")
  const listingMarkerMatches = (
    description.match(
      /\b(apply now|save job|view job|quick apply|easy apply|apply with|job alert)\b/gi
    ) || []
  ).length;
  if (listingMarkerMatches >= 3 && !hasSkillsOrResponsibilities) {
    isSingleJobPosting = false;
    reasons.push(
      'Content contains multiple repeating job card buttons or alerts, indicating a recommendation/search list.'
    );
  }

  // If completely lacking both job markers and any skills/responsibilities, and title was generic
  if (
    !hasJobMarkers &&
    !hasSkillsOrResponsibilities &&
    (!hasPlausibleTitle || garbageKeywordCount >= 1)
  ) {
    isSingleJobPosting = false;
    reasons.push(
      'Content lacks job markers, skills, and responsibilities, reflecting generic site content.'
    );
  }

  // 7. Calculate State & Confidence Score
  let score = 35;

  if (hasPlausibleTitle) score += 20;
  if (hasMeaningfulDescription) score += 15;
  if (descLength > 400) score += 10;
  if (hasJobMarkers) score += 15;
  if (hasSkillsOrResponsibilities) score += 15;
  if (garbageKeywordCount > 0) score -= Math.min(40, garbageKeywordCount * 12);
  if (!isSingleJobPosting) score -= 30;

  score = Math.max(0, Math.min(100, score));

  // Determine state
  let state: JobExtractionQualityState;

  if (
    !hasPlausibleTitle ||
    !hasMeaningfulDescription ||
    !isSingleJobPosting ||
    score < 45 ||
    (!hasJobMarkers && !hasSkillsOrResponsibilities) ||
    (garbageKeywordCount >= 2 && !hasSkillsOrResponsibilities)
  ) {
    state = 'insufficient';
  } else if (score >= 70 && hasJobMarkers && hasSkillsOrResponsibilities) {
    state = 'reliable';
  } else {
    state = 'partial';
  }

  return {
    state,
    score,
    reasons,
    signals: {
      hasPlausibleTitle,
      hasPlausibleCompany,
      hasMeaningfulDescription,
      hasJobMarkers,
      isSingleJobPosting,
      garbageKeywordCount,
      garbageContentRatio,
      hasSkillsOrResponsibilities
    }
  };
}
