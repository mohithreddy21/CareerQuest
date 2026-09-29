/**
 * Deterministic string and field normalizers for cross-source deduplication.
 * These normalizers operate strictly on string representations to establish
 * reliable equivalence without destructive mutation of canonical job data.
 */

const LEGAL_SUFFIX_REGEX =
  /\b(inc|incorporated|llc|ltd|limited|corp|corporation|co|company|gmbh|pte|pvt|plc)\b/gi;

const COMMON_STOP_WORDS = new Set([
  'a',
  'about',
  'above',
  'after',
  'again',
  'against',
  'all',
  'am',
  'an',
  'and',
  'any',
  'are',
  "aren't",
  'as',
  'at',
  'be',
  'because',
  'been',
  'before',
  'being',
  'below',
  'between',
  'both',
  'but',
  'by',
  'can',
  'cannot',
  'could',
  "couldn't",
  'did',
  "didn't",
  'do',
  'does',
  "doesn't",
  'doing',
  "don't",
  'down',
  'during',
  'each',
  'few',
  'for',
  'from',
  'further',
  'had',
  "hadn't",
  'has',
  "hasn't",
  'have',
  "haven't",
  'having',
  'he',
  'her',
  'here',
  'hers',
  'herself',
  'him',
  'himself',
  'his',
  'how',
  'i',
  'if',
  'in',
  'into',
  'is',
  "isn't",
  'it',
  "it's",
  'its',
  'itself',
  "let's",
  'me',
  'more',
  'most',
  "mustn't",
  'my',
  'myself',
  'no',
  'nor',
  'not',
  'of',
  'off',
  'on',
  'once',
  'only',
  'or',
  'other',
  'ought',
  'our',
  'ours',
  'ourselves',
  'out',
  'over',
  'own',
  'same',
  "shan't",
  'she',
  'should',
  "shouldn't",
  'so',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'theirs',
  'them',
  'themselves',
  'then',
  'there',
  'these',
  'they',
  'this',
  'those',
  'through',
  'to',
  'too',
  'under',
  'until',
  'up',
  'very',
  'was',
  "wasn't",
  'we',
  'were',
  "weren't",
  'what',
  'when',
  'where',
  'which',
  'while',
  'who',
  'whom',
  'why',
  'with',
  "won't",
  'would',
  "wouldn't",
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves'
]);

/**
 * Normalizes company name for comparison.
 * Strips legal suffixes and punctuation while preserving core identity.
 */
export function normalizeCompany(company: string): string {
  if (!company) return '';

  let cleaned = company.toLowerCase().trim();

  // Strip legal entity suffixes
  cleaned = cleaned.replace(LEGAL_SUFFIX_REGEX, '');

  // Remove punctuation except alphanumeric and spaces
  cleaned = cleaned.replace(/[^\w\s]/g, ' ');

  // Collapse multiple spaces
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes job title for comparison.
 * Standardizes common seniority abbreviations and removes trailing location tags
 * while strictly preserving seniority distinctions (Senior != Junior != Staff).
 */
export function normalizeTitle(title: string): string {
  if (!title) return '';

  let cleaned = title.toLowerCase().trim();

  // Strip common trailing location/work-arrangement brackets or tags
  // e.g. "Software Engineer (Remote)", "Platform Engineer - Hybrid", "SRE [US]"
  cleaned = cleaned.replace(/\s*(\([^)]*\)|\[[^\]]*\]|\{[^}]*\})\s*$/, '');
  cleaned = cleaned.replace(
    /\s*[-|/•]\s*(remote|hybrid|onsite|on-site|office|work from home|us|usa|emea|apac)\s*$/i,
    ''
  );

  // Standardize abbreviations
  cleaned = cleaned.replace(/\bsr\.?\b/g, 'senior');
  cleaned = cleaned.replace(/\bjr\.?\b/g, 'junior');
  cleaned = cleaned.replace(/\bmgr\.?\b/g, 'manager');
  cleaned = cleaned.replace(/\beng\.?\b/g, 'engineer');
  cleaned = cleaned.replace(/\bdev\.?\b/g, 'developer');
  cleaned = cleaned.replace(/\badmin\.?\b/g, 'administrator');
  cleaned = cleaned.replace(/\bsw\b/g, 'software');
  cleaned = cleaned.replace(/\bswe\b/g, 'software engineer');
  cleaned = cleaned.replace(/\bsre\b/g, 'site reliability engineer');

  // Remove remaining special characters except alphanumeric and spaces
  cleaned = cleaned.replace(/[^\w\s]/g, ' ');

  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes location string for comparison.
 * Handles remote aliases and common city abbreviations.
 */
export function normalizeLocation(location: string): string {
  if (!location) return 'unknown';

  let cleaned = location.toLowerCase().trim();

  // Check remote equivalence
  if (
    cleaned === 'remote' ||
    cleaned === 'fully remote' ||
    cleaned === 'work from home' ||
    cleaned === 'telecommute' ||
    cleaned === 'anywhere' ||
    cleaned === 'virtual' ||
    cleaned === 'remote, us' ||
    cleaned === 'us - remote' ||
    cleaned === 'remote - us' ||
    cleaned === 'united states - remote'
  ) {
    return 'remote';
  }

  // Standardize common locations
  cleaned = cleaned.replace(/\bnyc\b/g, 'new york ny');
  cleaned = cleaned.replace(/\bnew york city,?\s*(ny|new york)?\b/g, 'new york ny');
  cleaned = cleaned.replace(/\bsan francisco,?\s*(ca|california)?\b/g, 'san francisco ca');
  cleaned = cleaned.replace(/\bsf,?\s*(ca|california)?\b/g, 'san francisco ca');
  cleaned = cleaned.replace(/\bsan francisco bay area\b/g, 'san francisco ca');
  cleaned = cleaned.replace(/\bbay area\b/g, 'san francisco ca');
  cleaned = cleaned.replace(/\bseattle,?\s*(wa|washington)?\b/g, 'seattle wa');
  cleaned = cleaned.replace(/\baustin,?\s*(tx|texas)?\b/g, 'austin tx');
  cleaned = cleaned.replace(/\blondon,?\s*(uk|united kingdom|england)?\b/g, 'london uk');

  // Strip remaining punctuation
  cleaned = cleaned.replace(/[^\w\s]/g, ' ');

  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Tokenizes text into normalized unique words, removing English stop words.
 */
export function tokenizeText(text: string): Set<string> {
  if (!text) return new Set();

  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !COMMON_STOP_WORDS.has(w));

  return new Set(words);
}
