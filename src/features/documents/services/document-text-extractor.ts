import * as zlib from 'node:zlib';
import JSZip from 'jszip';
import { extractText as unpdfExtractText } from 'unpdf';

/**
 * Service to extract normalized plain text from uploaded PDF, DOCX, or text documents.
 */
export const DocumentTextExtractor = {
  /**
   * Extract plain text from an uploaded document buffer based on MIME type or extension.
   */
  async extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();

    // 1. Plain text files
    if (mimeType === 'text/plain' || ext === '.txt') {
      return buffer.toString('utf-8').trim();
    }

    // 2. DOCX documents (OpenXML zip archive containing word/document.xml)
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === '.docx'
    ) {
      return this.extractFromDocx(buffer);
    }

    // 3. PDF documents
    if (mimeType === 'application/pdf' || ext === '.pdf') {
      return this.extractFromPdf(buffer);
    }

    // Fallback: decode as UTF-8
    return buffer.toString('utf-8').trim();
  },

  /**
   * Extract plain text from DOCX archive by parsing word/document.xml.
   */
  async extractFromDocx(buffer: Buffer): Promise<string> {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const documentXmlFile = zip.file('word/document.xml');

      if (!documentXmlFile) {
        throw new Error('Invalid DOCX: missing word/document.xml');
      }

      const xml = await documentXmlFile.async('text');

      // Convert paragraph and break tags into newlines
      const withNewlines = xml
        .replace(/<\/w:p>/gi, '\n')
        .replace(/<w:br[^>]*>/gi, '\n')
        .replace(/<w:tab[^>]*>/gi, '\t');

      // Strip all remaining XML tags
      const text = withNewlines.replace(/<[^>]+>/g, '');

      // Decode XML entities
      const decoded = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");

      return decoded.trim();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown DOCX error';
      throw new Error(`Failed to extract text from DOCX document: ${msg}`, { cause: err });
    }
  },

  /**
   * Extract readable text from a PDF buffer using a standards-compliant engine (unpdf)
   * with a structured content-stream fallback that filters out embedded font programs
   * and binary artifacts.
   */
  async extractFromPdf(buffer: Buffer): Promise<string> {
    // 1. Primary: Use unpdf (Mozilla PDF.js engine) to correctly parse page trees,
    // CID/ToUnicode CMaps, TrueType/Type0 fonts, and spatial text flow.
    try {
      const { text } = await unpdfExtractText(new Uint8Array(buffer), { mergePages: true });
      if (text && text.trim().length > 0) {
        return text
          .replace(/\r\n/g, '\n')
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }
    } catch {
      // Fall through to content stream parser on unpdf failure
    }

    // 2. Fallback: Parse content streams, strictly skipping font programs and image streams
    return this.extractFromPdfContentsStreams(buffer);
  },

  /**
   * Fallback extractor that searches page /Contents streams specifically and ignores
   * binary font streams (/Length1, /FontFile) and image XObjects to prevent text inflation.
   */
  extractFromPdfContentsStreams(buffer: Buffer): string {
    const content = buffer.toString('binary');
    let extracted = '';

    // Step A: Search for Page objects and their referenced /Contents streams
    const pageRegex = /(\d+)\s+(\d+)\s+obj[\s\S]*?\/Type\s*\/Page\b([\s\S]*?)endobj/g;
    const contentObjIds = new Set<string>();
    let pageMatch: RegExpExecArray | null;

    while ((pageMatch = pageRegex.exec(content)) !== null) {
      const pageBody = pageMatch[3];
      const contentsMatch = pageBody.match(/\/Contents\s+(\d+\s+\d+\s+R|\[[^\]]+\])/);
      if (contentsMatch) {
        const refMatches = contentsMatch[1].matchAll(/(\d+)\s+(\d+)\s+R/g);
        for (const ref of refMatches) {
          contentObjIds.add(`${ref[1]} ${ref[2]}`);
        }
      }
    }

    // Step B: Iterate over PDF objects
    const objRegex = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g;
    let objMatch: RegExpExecArray | null;

    while ((objMatch = objRegex.exec(content)) !== null) {
      const objId = `${objMatch[1]} ${objMatch[2]}`;
      const objBody = objMatch[3];

      // If we found specific Page /Contents objects, only process those.
      // Otherwise, exclude known binary objects like fonts and images.
      if (contentObjIds.size > 0 && !contentObjIds.has(objId)) {
        continue;
      }

      // Skip font bytecode streams and image streams
      if (
        objBody.includes('/Length1') ||
        objBody.includes('/FontFile') ||
        objBody.includes('/Subtype/Image') ||
        objBody.includes('/Subtype /Image')
      ) {
        continue;
      }

      const streamMatch = objBody.match(/stream\r?\n([\s\S]*?)\r?\nendstream/);
      if (!streamMatch) continue;

      const rawStream = Buffer.from(streamMatch[1], 'binary');
      let streamText = '';

      try {
        streamText = zlib.inflateSync(rawStream).toString('latin1');
      } catch {
        try {
          streamText = zlib.unzipSync(rawStream).toString('latin1');
        } catch {
          streamText = rawStream.toString('latin1');
        }
      }

      // Extract text from (string) Tj operators
      const tjRegex = /\(([\s\S]*?)\)\s*(?:Tj|'|")/g;
      let textMatch: RegExpExecArray | null;
      while ((textMatch = tjRegex.exec(streamText)) !== null) {
        const clean = textMatch[1]
          .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
          .replace(/\\[()\\]/g, (m) => m[1]);
        extracted += clean + ' ';
      }

      // Extract text from [(array)] TJ operators
      const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
      while ((textMatch = tjArrayRegex.exec(streamText)) !== null) {
        const parts = textMatch[1].match(/\(([\s\S]*?)\)/g);
        if (parts) {
          const line = parts
            .map((p) =>
              p
                .slice(1, -1)
                .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
                .replace(/\\[()\\]/g, (m) => m[1])
            )
            .join('');
          extracted += line + ' ';
        }
      }
    }

    // Step C: Fallback for uncompressed direct text if no streams extracted
    if (!extracted.trim()) {
      const directRegex = /\(([\s\S]*?)\)\s*Tj/g;
      let match: RegExpExecArray | null;
      while ((match = directRegex.exec(content)) !== null) {
        extracted += match[1] + ' ';
      }
    }

    // Clean whitespace and filter out non-printable ASCII control characters
    const printableOnly = extracted
      .split('')
      .filter((ch) => {
        const code = ch.charCodeAt(0);
        return code >= 32 || code === 10 || code === 9 || code === 13;
      })
      .join('');

    return printableOnly
      .replace(/[ \t]+/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
};
