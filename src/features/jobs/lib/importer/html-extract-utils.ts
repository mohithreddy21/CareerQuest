import { SalaryInterval } from './types';
import { sanitizeInlineText } from './sanitizer';

export interface JsonLdJobPosting {
  '@context'?: string;
  '@type'?: string | string[];
  title?: string;
  description?: string;
  datePosted?: string;
  validThrough?: string;
  employmentType?: string | string[];
  hiringOrganization?:
    | {
        '@type'?: string;
        name?: string;
      }
    | string;
  jobLocation?:
    | {
        '@type'?: string;
        address?:
          | {
              addressLocality?: string;
              addressRegion?: string;
              addressCountry?: string;
              streetAddress?: string;
            }
          | string;
        name?: string;
      }
    | Array<unknown>;
  jobLocationType?: string;
  baseSalary?: {
    '@type'?: string;
    currency?: string;
    value?:
      | {
          '@type'?: string;
          minValue?: number | string;
          maxValue?: number | string;
          value?: number | string;
          unitText?: string;
        }
      | number
      | string;
  };
  skills?: string | string[];
  responsibilities?: string | string[];
  qualifications?: string | string[];
  experienceRequirements?: string;
  educationRequirements?: string;
}

/**
 * Extracts JSON-LD JobPosting schemas from raw HTML.
 */
export function extractJsonLdJobPostings(html: string): JsonLdJobPosting[] {
  const scriptRegex =
    /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const results: JsonLdJobPosting[] = [];
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    const rawJson = match[1].trim();
    if (!rawJson) continue;

    try {
      const parsed = JSON.parse(rawJson);
      collectJobPostings(parsed, results);
    } catch {
      // Ignore malformed JSON-LD blocks gracefully
    }
  }

  return results;
}

function collectJobPostings(obj: unknown, results: JsonLdJobPosting[]): void {
  if (!obj || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      collectJobPostings(item, results);
    }
    return;
  }

  const record = obj as Record<string, unknown>;

  // Check @graph container
  if (Array.isArray(record['@graph'])) {
    collectJobPostings(record['@graph'], results);
    return;
  }

  // Check @type
  const type = record['@type'];
  const isJobPosting =
    type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'));

  if (isJobPosting) {
    results.push(record as JsonLdJobPosting);
  }
}

/**
 * Extracts content of meta tags (e.g. og:title, description).
 */
export function extractMetaContent(html: string, nameOrProperty: string): string | null {
  const escaped = nameOrProperty.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(
    `<meta\\s+[^>]*?(?:name|property)=["']${escaped}["'][^>]*?content=["']([^"']*)["'][^>]*>`,
    'i'
  );
  const match = regex.exec(html);
  if (match && match[1]) {
    return sanitizeInlineText(match[1]);
  }

  // Also check reverse attribute order: content="..." property="..."
  const reverseRegex = new RegExp(
    `<meta\\s+[^>]*?content=["']([^"']*)["'][^>]*?(?:name|property)=["']${escaped}["'][^>]*>`,
    'i'
  );
  const reverseMatch = reverseRegex.exec(html);
  if (reverseMatch && reverseMatch[1]) {
    return sanitizeInlineText(reverseMatch[1]);
  }

  return null;
}

/**
 * Extracts page <title> text.
 */
export function extractPageTitle(html: string): string | null {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (match && match[1]) {
    return sanitizeInlineText(match[1]);
  }
  return null;
}

/**
 * Extracts text of the first <h1> element.
 */
export function extractFirstH1(html: string): string | null {
  const match = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (match && match[1]) {
    return sanitizeInlineText(match[1]);
  }
  return null;
}

/**
 * Normalizes work arrangement string into domain enum.
 */
export function normalizeWorkArrangement(text: string): 'remote' | 'hybrid' | 'onsite' | 'unknown' {
  if (!text) return 'unknown';
  const lower = text.toLowerCase();

  if (/\b(remote|fully remote|work from home|wfh|telecommute|anywhere)\b/i.test(lower)) {
    return 'remote';
  }
  if (/\b(hybrid|hybrid remote|flexible work)\b/i.test(lower)) {
    return 'hybrid';
  }
  if (/\b(on-site|onsite|in-office|office based|in office)\b/i.test(lower)) {
    return 'onsite';
  }

  return 'unknown';
}

function parseSalaryNumber(s: string): number | null {
  if (!s) return null;
  const lower = s.toLowerCase().trim();
  if (lower.endsWith('k')) {
    const n = Number.parseFloat(lower.slice(0, -1));
    return Number.isNaN(n) ? null : Math.round(n * 1000);
  }
  const cleaned = s.replace(/,/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isNaN(n) ? null : Math.round(n);
}

/**
 * Extracts structured salary data from text or JSON-LD values.
 */
export function extractSalaryInfo(
  text: string,
  jsonLdSalary?: JsonLdJobPosting['baseSalary']
): {
  min: number | null;
  max: number | null;
  currency: string | null;
  interval: SalaryInterval | null;
} {
  // 1. Check JSON-LD baseSalary first if present
  if (jsonLdSalary) {
    const currency = jsonLdSalary.currency ? jsonLdSalary.currency.toUpperCase() : null;
    let min: number | null = null;
    let max: number | null = null;
    let interval: SalaryInterval | null = null;

    if (jsonLdSalary.value && typeof jsonLdSalary.value === 'object') {
      const v = jsonLdSalary.value;
      if (v.minValue) min = Number.parseInt(String(v.minValue).replace(/[^0-9]/g, ''), 10) || null;
      if (v.maxValue) max = Number.parseInt(String(v.maxValue).replace(/[^0-9]/g, ''), 10) || null;
      if (v.value && !min && !max) {
        const val = Number.parseInt(String(v.value).replace(/[^0-9]/g, ''), 10);
        if (!Number.isNaN(val)) min = val;
      }
      if (v.unitText) {
        const unit = v.unitText.toUpperCase();
        if (unit.includes('HOUR')) interval = 'hourly';
        else if (unit.includes('DAY')) interval = 'daily';
        else if (unit.includes('WEEK')) interval = 'weekly';
        else if (unit.includes('MONTH')) interval = 'monthly';
        else if (unit.includes('YEAR')) interval = 'yearly';
      }
    } else if (typeof jsonLdSalary.value === 'number') {
      min = jsonLdSalary.value;
    }

    if (min !== null || max !== null) {
      return {
        min,
        max: max || min,
        currency,
        interval: interval || 'yearly'
      };
    }
  }

  // 2. Parse from text using regex
  const salaryRegex =
    /(?:(\$|€|£|¥|USD|EUR|GBP|CAD|AUD)\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+k?)\s*(?:-|to|–)\s*(?:(\$|€|£|¥|USD|EUR|GBP|CAD|AUD)\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+k?)\s*(?:\/|\bper\b)?\s*(year|yr|annually|hour|hr|hourly|month|mo|day)?/i;

  const match = salaryRegex.exec(text);
  if (match) {
    const rawCurrency = match[1] || match[3] || null;
    let currency: string | null = null;
    if (rawCurrency) {
      const upper = rawCurrency.toUpperCase().trim();
      if (upper === '$' || upper === 'USD') currency = 'USD';
      else if (upper === '€' || upper === 'EUR') currency = 'EUR';
      else if (upper === '£' || upper === 'GBP') currency = 'GBP';
      else if (upper === '¥') currency = 'JPY';
      else currency = upper;
    }

    const min = parseSalaryNumber(match[2]);
    const max = parseSalaryNumber(match[4]);

    let interval: SalaryInterval = 'yearly';
    const rawInterval = (match[5] || '').toLowerCase();
    if (rawInterval.includes('hour') || rawInterval.includes('hr')) {
      interval = 'hourly';
    } else if (rawInterval.includes('day')) {
      interval = 'daily';
    } else if (rawInterval.includes('week')) {
      interval = 'weekly';
    } else if (rawInterval.includes('month') || rawInterval.includes('mo')) {
      interval = 'monthly';
    } else if (min && min < 500) {
      // Likely hourly rate if < $500
      interval = 'hourly';
    }

    if (min !== null) {
      return {
        min,
        max: max || min,
        currency,
        interval
      };
    }
  }

  return {
    min: null,
    max: null,
    currency: null,
    interval: null
  };
}

/**
 * Extracts bullet points or lines under section headings.
 */
export function extractListSections(text: string, sectionKeywords: string[]): string[] {
  const lines = text.split('\n').map((l) => l.trim());
  const items: string[] = [];
  let capturing = false;

  for (const line of lines) {
    const isSectionHeader = sectionKeywords.some((kw) => {
      const cleanHeader = line
        .replace(/[:#*_-]/g, '')
        .trim()
        .toLowerCase();
      return cleanHeader === kw || cleanHeader.startsWith(kw);
    });

    if (isSectionHeader) {
      capturing = true;
      continue;
    }

    // Stop capturing if we hit another distinct section header (with or without colon)
    const isAnotherHeader =
      !line.startsWith('•') &&
      !line.startsWith('-') &&
      !line.startsWith('*') &&
      !/^\d+\./.test(line) &&
      /^[A-Z][A-Za-z0-9\s/&'-]{2,40}:?$/.test(line);

    if (capturing && items.length > 0 && isAnotherHeader) {
      break;
    }

    if (capturing) {
      if (
        line.startsWith('•') ||
        line.startsWith('-') ||
        line.startsWith('*') ||
        /^\d+\./.test(line)
      ) {
        const item = line.replace(/^([•\-*]|\d+\.)\s*/, '').trim();
        if (item.length > 3) {
          items.push(item);
        }
      } else if (line.length > 5 && items.length > 0 && !line.endsWith(':')) {
        // Multi-line continuation
        items[items.length - 1] += ` ${line}`;
      }
    }
  }

  return items;
}
