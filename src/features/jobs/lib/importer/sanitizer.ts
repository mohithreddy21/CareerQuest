/**
 * HTML entities lookup map for common characters.
 */
const ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
  '&mdash;': '—',
  '&ndash;': '–',
  '&bull;': '•',
  '&middot;': '·',
  '&euro;': '€',
  '&pound;': '£',
  '&yen;': '¥'
};

/**
 * Decodes standard and numeric HTML entities.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(
      /&(?:amp|lt|gt|quot|#39|apos|nbsp|copy|reg|trade|mdash|ndash|bull|middot|euro|pound|yen);/gi,
      (match) => {
        return ENTITY_MAP[match.toLowerCase()] || match;
      }
    )
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(Number.parseInt(dec, 10));
      } catch {
        return '';
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      try {
        return String.fromCharCode(Number.parseInt(hex, 16));
      } catch {
        return '';
      }
    });
}

/**
 * Sanitizes external HTML content into safe, readable plain text.
 * Strips executable elements, scripts, styles, iframes, and dangerous attributes.
 * Preserves structural paragraph breaks and bullet points.
 */
export function sanitizeHtmlToText(html: string): string {
  if (!html) return '';

  let cleaned = html
    // 1. Remove dangerous script, style, iframe, object, embed tags and their contents
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    // 2. Remove comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // 3. Convert structural elements to newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|tr|h[1-6])>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ')
    // 4. Strip all remaining HTML tags
    .replace(/<[^>]+>/g, '');

  // 5. Decode HTML entities
  cleaned = decodeHtmlEntities(cleaned);

  // 6. Clean up line formatting and excessive whitespace
  const lines = cleaned.split('\n').map((l) => l.trim());
  const normalizedLines: string[] = [];
  let emptyCount = 0;

  for (const line of lines) {
    if (line.length === 0) {
      emptyCount++;
      if (emptyCount <= 1) {
        normalizedLines.push('');
      }
    } else {
      emptyCount = 0;
      normalizedLines.push(line);
    }
  }

  return normalizedLines.join('\n').trim();
}

/**
 * Sanitizes single-line fields (e.g., job title, company name, location).
 * Strips all tags, decodes entities, and collapses spaces.
 */
export function sanitizeInlineText(rawText: string): string {
  if (!rawText) return '';
  return decodeHtmlEntities(
    rawText
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Sanitizes and normalizes an array of requirement or responsibility items.
 */
export function sanitizeStringList(items: (string | unknown)[]): string[] {
  if (!Array.isArray(items)) return [];
  const result: string[] = [];

  for (const item of items) {
    if (typeof item === 'string') {
      const sanitized = sanitizeInlineText(item);
      if (sanitized.length > 0 && !result.includes(sanitized)) {
        result.push(sanitized);
      }
    }
  }

  return result;
}
