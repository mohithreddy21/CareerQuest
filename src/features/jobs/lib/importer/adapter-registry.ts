import { JobSourceAdapter, SourceDetectionResult } from './types';
import { greenhouseAdapter } from './adapters/greenhouse';
import { leverAdapter } from './adapters/lever';
import { genericHtmlAdapter } from './adapters/generic-html';
import { manualTextAdapter } from './adapters/manual-text';

const ADAPTERS: JobSourceAdapter[] = [
  greenhouseAdapter,
  leverAdapter,
  manualTextAdapter,
  genericHtmlAdapter // Generic fallback at the end
];

export function resolveAdapter(detection: SourceDetectionResult, url?: URL): JobSourceAdapter {
  for (const adapter of ADAPTERS) {
    if (adapter.canHandle(detection, url)) {
      return adapter;
    }
  }
  return genericHtmlAdapter;
}

export function getAdapterById(id: string): JobSourceAdapter | null {
  return ADAPTERS.find((a) => a.id === id) || null;
}

export function getAllAdapters(): JobSourceAdapter[] {
  return [...ADAPTERS];
}

export { greenhouseAdapter, leverAdapter, genericHtmlAdapter, manualTextAdapter };
