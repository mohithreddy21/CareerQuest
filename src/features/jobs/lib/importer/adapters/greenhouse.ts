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

export class GreenhouseAdapter implements JobSourceAdapter {
  readonly id = 'greenhouse';
  readonly name = 'Greenhouse ATS';

  canHandle(detection: SourceDetectionResult, url?: URL): boolean {
    if (detection.source === 'greenhouse') return true;
    if (!url) return false;
    const host = url.hostname.toLowerCase();
    return (
      host.includes('greenhouse.io') ||
      url.pathname.toLowerCase().includes('/greenhouse/') ||
      url.searchParams.has('gh_jid')
    );
  }

  async extract(context: AdapterExtractionContext): Promise<RawJobExtraction> {
    const { content, url, sourceDetection } = context;

    if (!content || content.trim().length === 0) {
      throw new AdapterError(
        'MISSING_REQUIRED_JOB_FIELD',
        'Unable to extract job information from empty Greenhouse response.'
      );
    }

    // 1. Try structured JSON-LD JobPosting first
    const jsonLdPostings = extractJsonLdJobPostings(content);
    const jsonLd = jsonLdPostings.find((p) => Boolean(p.title));

    // 2. Extract Title
    let title = jsonLd?.title || null;
    if (!title) {
      const appTitleMatch =
        /<h1\b[^>]*class=["'][^"']*app-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i.exec(content);
      title = appTitleMatch ? sanitizeInlineText(appTitleMatch[1]) : null;
    }
    if (!title) {
      title = extractFirstH1(content);
    }
    if (!title) {
      title = extractMetaContent(content, 'og:title') || extractPageTitle(content);
    }

    if (!title) {
      throw new AdapterError(
        'MISSING_REQUIRED_JOB_FIELD',
        'Could not extract a valid job title from this Greenhouse posting.'
      );
    }

    // Clean up trailing " at Company" from title if present
    const atMatch = /^(.*?)\s+at\s+([A-Za-z0-9\s._-]+)$/i.exec(title);
    let inferredCompanyFromTitle: string | null = null;
    if (atMatch) {
      title = atMatch[1].trim();
      inferredCompanyFromTitle = atMatch[2].trim();
    }

    // 3. Extract Company
    let company: string | null = null;
    if (typeof jsonLd?.hiringOrganization === 'object' && jsonLd.hiringOrganization?.name) {
      company = sanitizeInlineText(jsonLd.hiringOrganization.name);
    } else if (typeof jsonLd?.hiringOrganization === 'string') {
      company = sanitizeInlineText(jsonLd.hiringOrganization);
    }

    if (!company) {
      const companyMatch =
        /<span\b[^>]*class=["'][^"']*company-name[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(content);
      if (companyMatch) {
        const rawCompany = sanitizeInlineText(companyMatch[1]).replace(/^at\s+/i, '');
        if (rawCompany) company = rawCompany;
      }
    }

    if (!company && inferredCompanyFromTitle) {
      company = inferredCompanyFromTitle;
    }

    if (!company && sourceDetection.metadata?.companySlug) {
      const slug = sourceDetection.metadata.companySlug;
      company = slug.charAt(0).toUpperCase() + slug.slice(1);
    }

    if (!company) {
      company = extractMetaContent(content, 'og:site_name') || 'Company';
    }

    // 4. Extract Location
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

    if (location === 'Unknown') {
      const locMatch = /<div\b[^>]*class=["'][^"']*location[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(
        content
      );
      if (locMatch) {
        location = sanitizeInlineText(locMatch[1]);
      }
    }

    // 5. Extract Description
    let description = '';
    if (jsonLd?.description) {
      description = sanitizeHtmlToText(jsonLd.description);
    } else {
      const contentDivMatch =
        /<div\b[^>]*id=["']content["'][^>]*>([\s\S]*?)<\/div>\s*<(?:footer|\/body)/i.exec(content);
      if (contentDivMatch) {
        description = sanitizeHtmlToText(contentDivMatch[1]);
      } else {
        description = sanitizeHtmlToText(content);
      }
    }

    if (!description || description.length < 20) {
      description = `Job posting for ${title} at ${company}.`;
    }

    // 6. Work arrangement
    let workArrangement: 'remote' | 'hybrid' | 'onsite' | 'unknown' = 'unknown';
    if (jsonLd?.jobLocationType === 'TELECOMMUTE') {
      workArrangement = 'remote';
    } else {
      workArrangement = normalizeWorkArrangement(
        `${title} ${location} ${description.slice(0, 500)}`
      );
    }

    // 7. Structured Sections
    const responsibilities = extractListSections(description, [
      'responsibilities',
      'what you will do',
      'what you will work on',
      'what you will achieve',
      'key responsibilities',
      'duties'
    ]);

    const requiredSkills = extractListSections(description, [
      'requirements',
      'what you will need',
      'qualifications',
      'basic qualifications',
      'minimum qualifications',
      'what we are looking for'
    ]);

    const preferredSkills = extractListSections(description, [
      'preferred qualifications',
      'preferred skills',
      'nice to have',
      'bonus points',
      'bonus qualifications'
    ]);

    // 8. Salary extraction
    const salary = extractSalaryInfo(description, jsonLd?.baseSalary);

    // 9. Posted Date
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
      source: 'greenhouse',
      sourceJobId: sourceDetection.metadata?.jobId || null,
      sourceUrl: url
    };
  }
}

export const greenhouseAdapter = new GreenhouseAdapter();
