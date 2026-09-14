import {
  AdapterError,
  AdapterExtractionContext,
  JobSourceAdapter,
  RawJobExtraction,
  SourceDetectionResult
} from '../types';
import {
  extractListSections,
  extractSalaryInfo,
  normalizeWorkArrangement
} from '../html-extract-utils';
import { sanitizeHtmlToText, sanitizeInlineText } from '../sanitizer';

export class ManualTextAdapter implements JobSourceAdapter {
  readonly id = 'manual';
  readonly name = 'Manual Job Text';

  canHandle(detection: SourceDetectionResult): boolean {
    return detection.source === 'manual';
  }

  async extract(context: AdapterExtractionContext): Promise<RawJobExtraction> {
    const rawContent = context.content || '';
    const cleanText = sanitizeHtmlToText(rawContent);

    if (!cleanText || cleanText.length < 10) {
      throw new AdapterError(
        'MISSING_REQUIRED_JOB_FIELD',
        'Manual job text is too short or empty to extract a valid opportunity.'
      );
    }

    const lines = cleanText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    // 1. Extract Title
    let title: string | null = null;
    let company: string | null = null;
    let location = 'Unknown';

    for (const line of lines.slice(0, 8)) {
      const titleMatch = /^(?:title|role|position|job\s*title)\s*[:=-]\s*(.*)$/i.exec(line);
      if (titleMatch && titleMatch[1]) {
        title = sanitizeInlineText(titleMatch[1]);
      }

      const compMatch = /^(?:company|organization|employer)\s*[:=-]\s*(.*)$/i.exec(line);
      if (compMatch && compMatch[1]) {
        company = sanitizeInlineText(compMatch[1]);
      }

      const locMatch = /^(?:location|workplace|city)\s*[:=-]\s*(.*)$/i.exec(line);
      if (locMatch && locMatch[1]) {
        location = sanitizeInlineText(locMatch[1]);
      }
    }

    // Fallback title from first line
    if (!title && lines.length > 0) {
      const firstLine = lines[0];
      const atMatch = /^(.*?)\s+at\s+([A-Za-z0-9\s._-]+)$/i.exec(firstLine);
      if (atMatch) {
        title = sanitizeInlineText(atMatch[1]);
        if (!company) company = sanitizeInlineText(atMatch[2]);
      } else if (firstLine.length < 100) {
        title = sanitizeInlineText(firstLine);
      }
    }

    if (!title) {
      title = 'Software Engineer';
    }

    if (!company) {
      company = 'Direct Import';
    }

    // 2. Work Arrangement
    const workArrangement = normalizeWorkArrangement(`${cleanText.slice(0, 1000)} ${location}`);

    // 3. Sections
    const responsibilities = extractListSections(cleanText, [
      'responsibilities',
      'duties',
      'what you will do',
      'the role',
      'key tasks'
    ]);

    const requiredSkills = extractListSections(cleanText, [
      'requirements',
      'required skills',
      'qualifications',
      'must have',
      'what you bring',
      'what we look for'
    ]);

    const preferredSkills = extractListSections(cleanText, [
      'preferred qualifications',
      'preferred skills',
      'nice to have',
      'bonus skills',
      'bonus'
    ]);

    // 4. Salary
    const salary = extractSalaryInfo(cleanText);

    const sourceUrl = context.url || `manual:${Date.now()}`;

    return {
      title,
      company,
      location,
      workArrangement,
      description: cleanText,
      responsibilities,
      requiredSkills,
      preferredSkills,
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      salaryInterval: salary.interval,
      postedDate: null,
      source: 'manual',
      sourceJobId: null,
      sourceUrl
    };
  }
}

export const manualTextAdapter = new ManualTextAdapter();
