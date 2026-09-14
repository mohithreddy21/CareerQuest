import {
  AdapterError,
  AdapterExtractionContext,
  JobSourceAdapter,
  RawJobExtraction,
  SourceDetectionResult
} from '../types';
import {
  extractFirstH1,
  extractJsonLdJobPostings,
  extractListSections,
  extractMetaContent,
  extractPageTitle,
  extractSalaryInfo,
  normalizeWorkArrangement
} from '../html-extract-utils';
import { sanitizeHtmlToText, sanitizeInlineText } from '../sanitizer';

export class GenericHtmlAdapter implements JobSourceAdapter {
  readonly id = 'generic';
  readonly name = 'Generic Web Job Page';

  canHandle(detection: SourceDetectionResult): boolean {
    return detection.source === 'generic' || detection.isSupported;
  }

  async extract(context: AdapterExtractionContext): Promise<RawJobExtraction> {
    const { content, url } = context;

    if (!content || content.trim().length === 0) {
      throw new AdapterError(
        'MISSING_REQUIRED_JOB_FIELD',
        'Cannot extract job information from empty page content.'
      );
    }

    // PRIORITY 1: JSON-LD JobPosting
    const jsonLdPostings = extractJsonLdJobPostings(content);
    const jsonLd = jsonLdPostings.find((p) => Boolean(p.title));

    // PRIORITY 2: Structured Metadata
    const metaTitle =
      extractMetaContent(content, 'og:title') || extractMetaContent(content, 'twitter:title');
    const metaDescription =
      extractMetaContent(content, 'og:description') ||
      extractMetaContent(content, 'description') ||
      extractMetaContent(content, 'twitter:description');
    const metaSiteName = extractMetaContent(content, 'og:site_name');

    // PRIORITY 3: Semantic HTML Elements
    const h1Title = extractFirstH1(content);
    const pageTitle = extractPageTitle(content);

    // Determine Job Title
    let title: string | null = jsonLd?.title || metaTitle || h1Title || pageTitle || null;
    if (title) {
      // Clean up common suffix like " - Careers", " | Work at Company"
      title = title
        .replace(/\s*[-|–—]\s*(careers|jobs|lever|greenhouse|workable|greenhouse\.io).*$/i, '')
        .trim();
    }

    if (!title || title.length < 3) {
      throw new AdapterError(
        'MISSING_REQUIRED_JOB_FIELD',
        'Could not locate a recognizable job title on this page.'
      );
    }

    // Determine Company Name
    let company: string | null = null;
    if (typeof jsonLd?.hiringOrganization === 'object' && jsonLd.hiringOrganization?.name) {
      company = sanitizeInlineText(jsonLd.hiringOrganization.name);
    } else if (typeof jsonLd?.hiringOrganization === 'string') {
      company = sanitizeInlineText(jsonLd.hiringOrganization);
    }

    if (!company && metaSiteName) {
      company = metaSiteName;
    }

    // Infer from hostname as fallback
    if (!company) {
      try {
        const parsedUrl = new URL(url);
        const hostParts = parsedUrl.hostname.split('.');
        if (hostParts.length >= 2) {
          const mainPart = hostParts[hostParts.length - 2];
          if (mainPart && mainPart.length > 2) {
            company = mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
          }
        }
      } catch {
        // Leave null/default
      }
    }

    if (!company) {
      company = 'Company';
    }

    // Determine Location
    let location = 'Unknown';
    if (
      jsonLd?.jobLocation &&
      typeof jsonLd.jobLocation === 'object' &&
      'address' in jsonLd.jobLocation
    ) {
      const addr = jsonLd.jobLocation.address;
      if (typeof addr === 'object' && addr !== null) {
        const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(
          Boolean
        );
        if (parts.length > 0) location = parts.join(', ');
      } else if (typeof addr === 'string') {
        location = sanitizeInlineText(addr);
      }
    }

    // Determine Description
    let description = '';
    if (jsonLd?.description) {
      description = sanitizeHtmlToText(jsonLd.description);
    } else {
      // Look for semantic article or main or job-description container
      const containerMatch =
        /<(?:article|main|div)\b[^>]*class=["'][^"']*(?:job[-_]description|job[-_]details|posting[-_]content|job[-_]body)[^"']*["'][^>]*>([\s\S]*?)<\/(?:article|main|div)>/i.exec(
          content
        );
      if (containerMatch) {
        description = sanitizeHtmlToText(containerMatch[1]);
      } else {
        description = sanitizeHtmlToText(content);
      }
    }

    if (!description || description.length < 30) {
      if (metaDescription && metaDescription.length >= 30) {
        description = metaDescription;
      } else {
        description = `Job listing for ${title} at ${company}.`;
      }
    }

    // Work arrangement
    let workArrangement: 'remote' | 'hybrid' | 'onsite' | 'unknown' = 'unknown';
    if (jsonLd?.jobLocationType === 'TELECOMMUTE') {
      workArrangement = 'remote';
    } else {
      workArrangement = normalizeWorkArrangement(
        `${title} ${location} ${description.slice(0, 500)}`
      );
    }

    // Structured Sections
    const responsibilities = extractListSections(description, [
      'responsibilities',
      'what you will do',
      'the role',
      'key duties',
      'duties'
    ]);

    const requiredSkills = extractListSections(description, [
      'requirements',
      'what you will need',
      'qualifications',
      'minimum qualifications',
      'what we look for',
      'skills'
    ]);

    const preferredSkills = extractListSections(description, [
      'preferred qualifications',
      'nice to have',
      'bonus points',
      'preferred skills'
    ]);

    // Salary extraction
    const salary = extractSalaryInfo(description, jsonLd?.baseSalary);

    // Posted date
    let postedDate: string | null = null;
    if (jsonLd?.datePosted) {
      const parsedDate = new Date(jsonLd.datePosted);
      if (!Number.isNaN(parsedDate.getTime())) {
        postedDate = parsedDate.toISOString().slice(0, 10);
      }
    }

    return {
      title,
      company,
      location,
      workArrangement,
      description,
      responsibilities,
      requiredSkills,
      preferredSkills,
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      salaryInterval: salary.interval,
      postedDate,
      source: 'generic',
      sourceJobId: null,
      sourceUrl: url
    };
  }
}

export const genericHtmlAdapter = new GenericHtmlAdapter();
