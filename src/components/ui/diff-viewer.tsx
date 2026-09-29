'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';

export type DiffChangeType = 'equal' | 'added' | 'removed';

export interface DiffToken {
  type: DiffChangeType;
  value: string;
}

/**
 * Tokenizes text into words and whitespace/punctuation tokens to preserve 100% formatting.
 */
function tokenizeText(text: string): string[] {
  if (!text) return [];
  return text.match(/\S+|\s+/g) || [];
}

/**
 * Computes token-level LCS diff between original and modified strings.
 * Includes prefix/suffix trimming for optimal performance.
 */
export function computeWordDiff(original: string, modified: string): DiffToken[] {
  const origTokens = tokenizeText(original);
  const modTokens = tokenizeText(modified);

  if (origTokens.length === 0 && modTokens.length === 0) return [];
  if (origTokens.length === 0) {
    return modTokens.map((t) => ({ type: 'added', value: t }));
  }
  if (modTokens.length === 0) {
    return origTokens.map((t) => ({ type: 'removed', value: t }));
  }

  // 1. Trim common prefix
  let prefixCount = 0;
  while (
    prefixCount < origTokens.length &&
    prefixCount < modTokens.length &&
    origTokens[prefixCount] === modTokens[prefixCount]
  ) {
    prefixCount++;
  }

  // 2. Trim common suffix
  let suffixCount = 0;
  while (
    suffixCount < origTokens.length - prefixCount &&
    suffixCount < modTokens.length - prefixCount &&
    origTokens[origTokens.length - 1 - suffixCount] ===
      modTokens[modTokens.length - 1 - suffixCount]
  ) {
    suffixCount++;
  }

  const midOrig = origTokens.slice(prefixCount, origTokens.length - suffixCount);
  const midMod = modTokens.slice(prefixCount, modTokens.length - suffixCount);

  // 3. Compute LCS on middle tokens
  const n = midOrig.length;
  const m = midMod.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (midOrig[i - 1] === midMod[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 4. Backtrack to reconstruct diff tokens
  const midDiff: DiffToken[] = [];
  let i = n;
  let j = m;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && midOrig[i - 1] === midMod[j - 1]) {
      midDiff.push({ type: 'equal', value: midOrig[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      midDiff.push({ type: 'added', value: midMod[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      midDiff.push({ type: 'removed', value: midOrig[i - 1] });
      i--;
    }
  }
  midDiff.reverse();

  // Combine prefix + middle diff + suffix
  const result: DiffToken[] = [];
  for (let p = 0; p < prefixCount; p++) {
    result.push({ type: 'equal', value: origTokens[p] });
  }
  result.push(...midDiff);
  for (let s = origTokens.length - suffixCount; s < origTokens.length; s++) {
    result.push({ type: 'equal', value: origTokens[s] });
  }

  // Merge contiguous tokens of the same type for cleaner DOM rendering
  const merged: DiffToken[] = [];
  for (const token of result) {
    if (merged.length > 0 && merged[merged.length - 1].type === token.type) {
      merged[merged.length - 1].value += token.value;
    } else {
      merged.push({ ...token });
    }
  }

  return merged;
}

export interface DiffViewerProps extends React.HTMLAttributes<HTMLDivElement> {
  originalText: string;
  proposedText: string;
  originalLabel?: string;
  proposedLabel?: string;
  defaultMode?: 'split' | 'unified';
  mode?: 'split' | 'unified';
  onModeChange?: (mode: 'split' | 'unified') => void;
  showModeToggle?: boolean;
  status?: 'verified' | 'review' | 'customized' | 'neutral';
  grounded?: boolean;
  rationale?: string;
  jobRequirement?: string;
  sourceKnowledgeItemIds?: string[];
  sourceCandidateEvidence?: string;
  compact?: boolean;
}

export function DiffViewer({
  originalText,
  proposedText,
  originalLabel = 'Original Master Content',
  proposedLabel = 'Proposed Tailored Formulation',
  defaultMode = 'split',
  mode: controlledMode,
  onModeChange,
  showModeToggle = true,
  status = 'verified',
  grounded = true,
  rationale,
  jobRequirement,
  sourceKnowledgeItemIds,
  sourceCandidateEvidence,
  compact = false,
  className,
  ...props
}: DiffViewerProps) {
  const [internalMode, setInternalMode] = React.useState<'split' | 'unified'>(defaultMode);
  const activeMode = controlledMode ?? internalMode;

  const handleModeChange = (newMode: 'split' | 'unified') => {
    setInternalMode(newMode);
    onModeChange?.(newMode);
  };

  const diffTokens = React.useMemo(() => {
    return computeWordDiff(originalText || '', proposedText || '');
  }, [originalText, proposedText]);

  const hasModifications = diffTokens.some((t) => t.type !== 'equal');
  const isReviewRequired = status === 'review' || grounded === false;

  // Render tokens for original view (equal + removed)
  const renderOriginalTokens = () => {
    return diffTokens.map((token, idx) => {
      if (token.type === 'added') return null;
      if (token.type === 'removed') {
        return (
          <del
            key={`orig-${idx}`}
            aria-label={`Removed: ${token.value}`}
            className='line-through decoration-rose-500/60 bg-rose-500/15 text-rose-800 dark:text-rose-300 rounded-xs px-0.5 font-medium not-italic'
          >
            {token.value}
          </del>
        );
      }
      return <span key={`orig-${idx}`}>{token.value}</span>;
    });
  };

  // Render tokens for proposed view (equal + added)
  const renderProposedTokens = () => {
    return diffTokens.map((token, idx) => {
      if (token.type === 'removed') return null;
      if (token.type === 'added') {
        const additionStyles = isReviewRequired
          ? 'underline decoration-amber-500/70 bg-amber-500/15 text-amber-900 dark:text-amber-200 rounded-xs px-0.5 font-medium not-italic'
          : 'underline decoration-emerald-500/70 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 rounded-xs px-0.5 font-medium not-italic';

        return (
          <ins key={`prop-${idx}`} aria-label={`Added: ${token.value}`} className={additionStyles}>
            {token.value}
          </ins>
        );
      }
      return <span key={`prop-${idx}`}>{token.value}</span>;
    });
  };

  // Render unified tokens (equal + removed + added in single inline stream)
  const renderUnifiedTokens = () => {
    return diffTokens.map((token, idx) => {
      if (token.type === 'removed') {
        return (
          <del
            key={`uni-${idx}`}
            aria-label={`Removed: ${token.value}`}
            className='line-through decoration-rose-500/60 bg-rose-500/15 text-rose-800 dark:text-rose-300 rounded-xs px-0.5 font-medium inline-block not-italic'
          >
            {token.value}
          </del>
        );
      }
      if (token.type === 'added') {
        const additionStyles = isReviewRequired
          ? 'underline decoration-amber-500/70 bg-amber-500/15 text-amber-900 dark:text-amber-200 rounded-xs px-0.5 font-medium inline-block not-italic'
          : 'underline decoration-emerald-500/70 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 rounded-xs px-0.5 font-medium inline-block not-italic';

        return (
          <ins key={`uni-${idx}`} aria-label={`Added: ${token.value}`} className={additionStyles}>
            {token.value}
          </ins>
        );
      }
      return <span key={`uni-${idx}`}>{token.value}</span>;
    });
  };

  return (
    <div data-slot='diff-viewer' className={cn('w-full space-y-3', className)} {...props}>
      {/* Top Controls & Legend Bar */}
      <div className='flex flex-wrap items-center justify-between gap-2 text-xs'>
        <div className='flex items-center gap-2'>
          <div className='flex items-center gap-1.5 text-muted-foreground text-[11px]'>
            <span className='inline-flex items-center gap-1 font-medium'>
              <span className='size-2 rounded-full bg-rose-500' aria-hidden='true' />
              <span>Removed</span>
            </span>
            <span>•</span>
            <span className='inline-flex items-center gap-1 font-medium'>
              <span
                className={cn(
                  'size-2 rounded-full',
                  isReviewRequired ? 'bg-amber-500' : 'bg-emerald-500'
                )}
                aria-hidden='true'
              />
              <span>{isReviewRequired ? 'Added (Requires Review)' : 'Added (Verified)'}</span>
            </span>
          </div>

          {!hasModifications && (
            <Badge variant='secondary' className='text-[10px] h-5'>
              No text changes
            </Badge>
          )}
        </div>

        {showModeToggle && (
          <div
            role='radiogroup'
            aria-label='Diff view mode'
            className='inline-flex items-center rounded-md border border-border/80 bg-muted/40 p-0.5 text-[11px]'
          >
            <button
              type='button'
              role='radio'
              aria-checked={activeMode === 'split'}
              onClick={() => handleModeChange('split')}
              className={cn(
                'flex items-center gap-1 rounded-sm px-2 py-0.5 font-medium transition-colors cursor-pointer',
                activeMode === 'split'
                  ? 'bg-background text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icons.kanban className='size-3' aria-hidden='true' />
              <span>Split</span>
            </button>
            <button
              type='button'
              role='radio'
              aria-checked={activeMode === 'unified'}
              onClick={() => handleModeChange('unified')}
              className={cn(
                'flex items-center gap-1 rounded-sm px-2 py-0.5 font-medium transition-colors cursor-pointer',
                activeMode === 'unified'
                  ? 'bg-background text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icons.page className='size-3' aria-hidden='true' />
              <span>Inline</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Diff Display Body */}
      {activeMode === 'split' ? (
        <div className='grid grid-cols-1 md:grid-cols-2 gap-3 text-xs'>
          {/* Original Master Column */}
          <div
            className={cn(
              'rounded-lg border border-border/80 bg-muted/20 p-3 space-y-1.5 transition-colors',
              compact ? 'p-2.5 text-[11px]' : 'p-3'
            )}
          >
            <div className='flex items-center justify-between gap-1'>
              <span className='type-caption font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5'>
                <Icons.fileTypeDoc className='size-3.5 text-muted-foreground' aria-hidden='true' />
                <span>{originalLabel}</span>
              </span>
            </div>
            <div className='text-foreground/80 leading-relaxed font-normal select-text'>
              {renderOriginalTokens()}
            </div>
          </div>

          {/* Proposed Tailored Column */}
          <div
            className={cn(
              'rounded-lg border p-3 space-y-1.5 transition-colors',
              isReviewRequired
                ? 'border-amber-500/30 bg-amber-500/5'
                : 'border-primary/25 bg-primary/5',
              compact ? 'p-2.5 text-[11px]' : 'p-3'
            )}
          >
            <div className='flex items-center justify-between gap-1'>
              <span
                className={cn(
                  'type-caption font-semibold uppercase tracking-wider flex items-center gap-1.5',
                  isReviewRequired ? 'text-amber-800 dark:text-amber-300' : 'text-primary'
                )}
              >
                <Icons.sparkles className='size-3.5' aria-hidden='true' />
                <span>{proposedLabel}</span>
              </span>
            </div>
            <div className='text-foreground font-medium leading-relaxed select-text'>
              {renderProposedTokens()}
            </div>
          </div>
        </div>
      ) : (
        /* Unified Inline View */
        <div
          className={cn(
            'rounded-lg border border-border/80 bg-muted/20 p-3.5 space-y-1.5 transition-colors text-xs leading-relaxed select-text',
            compact ? 'p-2.5 text-[11px]' : 'p-3.5'
          )}
        >
          <div className='flex items-center justify-between pb-1 border-b border-border/60 text-muted-foreground type-caption'>
            <span className='font-semibold uppercase tracking-wider flex items-center gap-1.5'>
              <Icons.post className='size-3.5' aria-hidden='true' />
              <span>Unified Diff View</span>
            </span>
          </div>
          <div className='text-foreground font-normal leading-relaxed pt-1'>
            {renderUnifiedTokens()}
          </div>
        </div>
      )}

      {/* Rationale & Evidence Explainability Section */}
      {(rationale ||
        jobRequirement ||
        sourceCandidateEvidence ||
        (sourceKnowledgeItemIds && sourceKnowledgeItemIds.length > 0)) && (
        <div className='rounded-lg bg-muted/40 p-3 space-y-1.5 text-muted-foreground border border-border/60 text-[11px] leading-relaxed'>
          {rationale && (
            <p>
              <strong className='text-foreground font-medium'>Why this change: </strong>
              <span>{rationale}</span>
            </p>
          )}
          {jobRequirement && (
            <p>
              <strong className='text-foreground font-medium'>Targeted Requirement: </strong>
              <span>{jobRequirement}</span>
            </p>
          )}
          {sourceKnowledgeItemIds && sourceKnowledgeItemIds.length > 0 && (
            <p>
              <strong className='text-foreground font-medium'>Knowledge Source IDs: </strong>
              <code className='text-[10px] font-mono px-1 py-0.5 rounded bg-muted text-foreground'>
                {sourceKnowledgeItemIds.join(', ')}
              </code>
            </p>
          )}
          {sourceCandidateEvidence && (
            <p>
              <strong className='text-foreground font-medium'>Verified Candidate Evidence: </strong>
              <span>{sourceCandidateEvidence}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
