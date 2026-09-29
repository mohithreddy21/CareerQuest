'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icons } from '@/components/icons';

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

export interface FilterItem {
  id: string;
  label: string;
  value?: string;
  placeholder?: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  filters?: FilterItem[];
  activeFilterCount?: number;
  onResetAll?: () => void;
  isCollapsible?: boolean;
  extraActions?: React.ReactNode;
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  activeFilterCount = 0,
  onResetAll,
  isCollapsible = true,
  extraActions,
  className,
  children,
  ...props
}: FilterBarProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const hasActiveFilters =
    activeFilterCount > 0 || Boolean(searchQuery && searchQuery.trim().length > 0);

  return (
    <div
      data-slot='filter-bar'
      className={cn(
        'w-full space-y-3 rounded-lg border border-border/80 bg-card p-3 shadow-xs transition-all',
        className
      )}
      {...props}
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        {/* Left side: Search input + primary filter dropdowns */}
        <div className='flex flex-1 flex-wrap items-center gap-2.5 min-w-[260px]'>
          {onSearchChange !== undefined && (
            <div className='relative flex-1 min-w-[180px] max-w-sm'>
              <Icons.search
                className='absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none'
                aria-hidden='true'
              />
              <input
                type='search'
                value={searchQuery ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className='h-8 w-full rounded-md border border-border/80 bg-background pl-8 pr-3 type-body-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'
                aria-label={searchPlaceholder}
              />
              {searchQuery && (
                <button
                  type='button'
                  onClick={() => onSearchChange('')}
                  className='absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer'
                  aria-label='Clear search'
                >
                  <Icons.close className='size-3.5' />
                </button>
              )}
            </div>
          )}

          {/* Children or Filter Select Items */}
          {children ? (
            <div className='flex flex-wrap items-center gap-2'>{children}</div>
          ) : (
            filters.map((filter) => {
              const isSelected = Boolean(
                filter.value && filter.value !== 'all' && filter.value !== ''
              );
              return (
                <div key={filter.id} className='relative inline-flex items-center'>
                  <label htmlFor={`filter-${filter.id}`} className='sr-only'>
                    {filter.label}
                  </label>
                  <select
                    id={`filter-${filter.id}`}
                    value={filter.value ?? ''}
                    onChange={(e) => filter.onChange(e.target.value)}
                    className={cn(
                      'h-8 rounded-md border px-2.5 pr-7 type-body-sm appearance-none bg-background text-foreground transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring',
                      isSelected
                        ? 'border-primary/50 bg-primary/5 text-primary font-medium'
                        : 'border-border/80 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <option value=''>
                      {filter.label}: {filter.placeholder || 'All'}
                    </option>
                    {filter.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} {opt.count !== undefined ? `(${opt.count})` : ''}
                      </option>
                    ))}
                  </select>
                  <Icons.chevronDown
                    className='pointer-events-none absolute right-2 size-3.5 text-muted-foreground'
                    aria-hidden='true'
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Right side: Active count, Reset, Extra actions, and Mobile Collapse Toggle */}
        <div className='flex items-center gap-2 shrink-0'>
          {hasActiveFilters && (
            <div className='flex items-center gap-1.5'>
              <Badge variant='secondary' className='h-6 gap-1 px-2 text-[11px] font-normal'>
                <Icons.adjustments className='size-3 text-muted-foreground' aria-hidden='true' />
                <span>{activeFilterCount} active</span>
              </Badge>
              {onResetAll && (
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={onResetAll}
                  className='h-7 px-2 text-xs text-muted-foreground hover:text-foreground'
                >
                  <Icons.trash className='size-3 mr-1' aria-hidden='true' />
                  <span>Reset</span>
                </Button>
              )}
            </div>
          )}

          {extraActions}

          {isCollapsible && (
            <button
              type='button'
              onClick={() => setIsExpanded(!isExpanded)}
              className='md:hidden flex items-center justify-center size-8 rounded-md border border-border/80 bg-background text-muted-foreground hover:text-foreground'
              aria-label={isExpanded ? 'Collapse secondary filters' : 'Expand secondary filters'}
              aria-expanded={isExpanded}
            >
              <Icons.adjustments className='size-4' />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
