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

export class LeverAdapter implements JobSourceAdapter {
  readonly id = 'lever';
  readonly name = 'Lever ATS';

  canHandle(detection: SourceDetectionResult, url?: URL): boolean {
    if (detection.source === 'lever') return true;
    if (!url) return false;
    const host = url.hostname.toLowerCase();
    return host.includes('lever.co') || url.pathname.toLowerCase().includes('/lever/');
  }

  async extract(context: AdapterExtractionContext): Promise<RawJobExtraction> {
    const { content, url, sourceDetection } = context;

    if (!content || content.trim().length === 0) {
      throw new AdapterError(
        'MISSING_REQUIRED_JOB_FIELD',
        'Unable to extract job information from empty Lever response.'
      );
    }

    // 1. Try structured JSON-LD JobPosting first
    const jsonLdPostings = extractJsonLdJobPostings(content);
    const jsonLd = jsonLdPostings.find((p) => Boolean(p.title));

    // 2. Extract Title
    let title = jsonLd?.title || null;
    if (!title) {
      const headlineMatch =
        /<div\b[^>]*class=["'][^"']*posting-headline[^"']*["'][^>]*>\s*<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(
          content
        );
      if (headlineMatch) {
        title = sanitizeInlineText(headlineMatch[1]);
      }
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
        'Could not extract a valid job title from this Lever posting.'
      );
    }

    // 3. Extract Company
    let company: string | null = null;
    if (typeof jsonLd?.hiringOrganization === 'object' && jsonLd.hiringOrganization?.name) {
      company = sanitizeInlineText(jsonLd.hiringOrganization.name);
    } else if (typeof jsonLd?.hiringOrganization === 'string') {
      company = sanitizeInlineText(jsonLd.hiringOrganization);
    }

    if (!company && sourceDetection.metadata?.companySlug) {
      const slug = sourceDetection.metadata.companySlug;
      company = slug.charAt(0).toUpperCase() + slug.slice(1);
    }

    if (!company) {
      company = extractMetaContent(content, 'og:site_name') || 'Company';
    }

    // 4. Extract Location and Categories
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
      }
    }

    let categoriesText = '';
    const categoriesMatch =
      /<div\b[^>]*class=["'][^"']*posting-categories[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i.exec(
        content
      );
    if (categoriesMatch) {
      categoriesText = sanitizeHtmlToText(categoriesMatch[1]);
      if (location === 'Unknown' && categoriesText) {
        const firstLine = categoriesText.split('\n')[0];
        if (firstLine) location = firstLine.trim();
      }
    }

    // 5. Extract Description
    let description = '';
    if (jsonLd?.description) {
      description = sanitizeHtmlToText(jsonLd.description);
    } else {
      const sectionMatch =
        /<div\b[^>]*class=["'][^"']*content-wrapper[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div\b[^>]*class=["'][^"']*section-page/i.exec(
          content
        );
      if (sectionMatch) {
        description = sanitizeHtmlToText(sectionMatch[1]);
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
        `${title} ${categoriesText} ${location} ${description.slice(0, 500)}`
      );
    }

    // 7. Structured Sections
    const responsibilities = extractListSections(description, [
      'responsibilities',
      'what you will do',
      'what you will work on',
      'the role',
      'in this role you will',
      'what you will be doing'
    ]);

    const requiredSkills = extractListSections(description, [
      'requirements',
      'what you will need',
      'qualifications',
      'what we are looking for',
      'the ideal candidate will have',
      'who you are'
    ]);

    const preferredSkills = extractListSections(description, [
      'preferred qualifications',
      'nice to have',
      'bonus points',
      'preferred experience',
      'bonus skills'
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
      source: 'lever',
      sourceJobId: sourceDetection.metadata?.jobId || null,
      sourceUrl: url
    };
  }
}

export const leverAdapter = new LeverAdapter();
