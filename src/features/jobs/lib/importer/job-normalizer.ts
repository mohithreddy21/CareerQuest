import { NormalizedJobData, RawJobExtraction } from './types';
import { normalizeJobUrl } from './url-normalizer';
import { sanitizeHtmlToText, sanitizeInlineText, sanitizeStringList } from './sanitizer';

/**
 * Normalizes raw job extraction data into canonical domain fields.
 *
 * Invariants:
 * - workArrangement must be 'remote' | 'hybrid' | 'onsite' | 'unknown'
 * - salaryCurrency MUST remain null when unknown (no default USD)
 * - salary numbers are integer or null
 * - postedDate MUST remain null when unknown (no fake timestamps)
 * - original sourceUrl is preserved verbatim
 * - normalizedUrl is computed deterministically
 */
export function normalizeJobExtraction(raw: RawJobExtraction): NormalizedJobData {
  const title = sanitizeInlineText(raw.title) || 'Software Engineer';
  const company = sanitizeInlineText(raw.company) || 'Direct Import';
  const location = sanitizeInlineText(raw.location) || 'Unknown';

  // Work arrangement mapping
  let workArrangement: 'remote' | 'hybrid' | 'onsite' | 'unknown' = 'unknown';
  if (['remote', 'hybrid', 'onsite', 'unknown'].includes(raw.workArrangement)) {
    workArrangement = raw.workArrangement;
  }

  // Description sanitization
  const description =
    sanitizeHtmlToText(raw.description) || `Job posting for ${title} at ${company}.`;

  // Responsibilities & Skills sanitization
  const responsibilities = sanitizeStringList(raw.responsibilities);
  const requiredSkills = sanitizeStringList(raw.requiredSkills);
  const preferredSkills = sanitizeStringList(raw.preferredSkills);

  // Salary normalization
  let salaryMin: number | null = null;
  let salaryMax: number | null = null;
  let salaryCurrency: string | null = null;
  let salaryInterval: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | null = null;

  if (raw.salaryMin !== undefined && raw.salaryMin !== null && !Number.isNaN(raw.salaryMin)) {
    salaryMin = Math.round(raw.salaryMin);
  }
  if (raw.salaryMax !== undefined && raw.salaryMax !== null && !Number.isNaN(raw.salaryMax)) {
    salaryMax = Math.round(raw.salaryMax);
  }
  if (raw.salaryCurrency) {
    salaryCurrency = sanitizeInlineText(raw.salaryCurrency).toUpperCase();
  }
  if (
    raw.salaryInterval &&
    ['hourly', 'daily', 'weekly', 'monthly', 'yearly'].includes(raw.salaryInterval)
  ) {
    salaryInterval = raw.salaryInterval;
  }

  // Posted date normalization
  let postedDate: string | null = null;
  if (raw.postedDate) {
    const parsed = new Date(raw.postedDate);
    if (!Number.isNaN(parsed.getTime())) {
      postedDate = parsed.toISOString().slice(0, 10);
    }
  }

  // URLs
  const sourceUrl = raw.sourceUrl;
  const normalizedUrl = raw.normalizedUrl || normalizeJobUrl(sourceUrl);

  return {
    title,
    company,
    location,
    workArrangement,
    description,
    responsibilities,
    requiredSkills,
    preferredSkills,
    experienceRequirement: raw.experienceRequirement
      ? sanitizeInlineText(raw.experienceRequirement)
      : null,
    educationRequirement: raw.educationRequirement
      ? sanitizeInlineText(raw.educationRequirement)
      : null,
    salaryMin,
    salaryMax,
    salaryCurrency,
    salaryInterval,
    postedDate,
    source: raw.source,
    sourceJobId: raw.sourceJobId ? sanitizeInlineText(raw.sourceJobId) : null,
    sourceUrl,
    normalizedUrl
  };
}
