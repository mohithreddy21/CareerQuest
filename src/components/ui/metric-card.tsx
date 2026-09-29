'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';

export interface MetricTrend {
  value: string | number;
  label?: string;
  direction?: 'up' | 'down' | 'neutral';
}

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value?: string | number | null;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  trend?: MetricTrend;
  status?: 'default' | 'verified' | 'review' | 'insufficient-data' | 'neutral';
  emptyMessage?: string;
  provenance?: string;
  badge?: React.ReactNode;
  href?: string;
}

export function MetricCard({
  title,
  value,
  description,
  icon,
  trend,
  status = 'default',
  emptyMessage,
  provenance,
  badge,
  href,
  className,
  ...props
}: MetricCardProps) {
  const isInsufficient =
    status === 'insufficient-data' ||
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.toLowerCase().includes('not enough data'));

  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return (
        <div className='flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/50 text-muted-foreground'>
          {icon}
        </div>
      );
    }
    const IconComp = icon as React.ComponentType<{ className?: string }>;
    return (
      <div className='flex size-8 shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/50 text-muted-foreground'>
        <IconComp className='size-4' />
      </div>
    );
  };

  const renderTrend = () => {
    if (!trend) return null;
    const isUp = trend.direction === 'up';
    const isDown = trend.direction === 'down';

    return (
      <div
        className={cn(
          'inline-flex items-center gap-1 type-caption font-medium',
          isUp && 'text-emerald-700 dark:text-emerald-400',
          isDown && 'text-rose-700 dark:text-rose-400',
          !isUp && !isDown && 'text-muted-foreground'
        )}
      >
        {isUp && <Icons.trendingUp className='size-3 shrink-0' aria-hidden='true' />}
        {isDown && <Icons.trendingDown className='size-3 shrink-0' aria-hidden='true' />}
        <span>
          {typeof trend.value === 'number' && trend.value > 0 ? `+${trend.value}` : trend.value}
        </span>
        {trend.label && <span className='text-muted-foreground font-normal'>{trend.label}</span>}
      </div>
    );
  };

  const cardContent = (
    <Card
      size='compact'
      className={cn(
        'group transition-colors relative overflow-hidden',
        href && 'hover:border-primary/50 hover:bg-muted/10 cursor-pointer',
        className
      )}
      {...props}
    >
      <CardContent className='p-4 space-y-2'>
        {/* Top Header: Title, Icon, Badge */}
        <div className='flex items-center justify-between gap-2'>
          <span className='type-subheading text-muted-foreground truncate font-medium'>
            {title}
          </span>
          <div className='flex items-center gap-1.5'>
            {badge}
            {renderIcon()}
          </div>
        </div>

        {/* Primary Metric Value */}
        <div className='flex items-baseline justify-between gap-2 pt-0.5'>
          {isInsufficient ? (
            <div className='flex items-center gap-1.5 text-muted-foreground'>
              <Icons.info className='size-4 shrink-0 text-muted-foreground/70' aria-hidden='true' />
              <span className='type-body font-medium italic text-muted-foreground'>
                {emptyMessage || 'Not enough data yet'}
              </span>
            </div>
          ) : (
            <div className='type-display text-foreground tracking-tight'>{value}</div>
          )}

          {renderTrend()}
        </div>

        {/* Supporting description or provenance */}
        {(description || provenance) && (
          <div className='space-y-0.5 pt-1 border-t border-border/40'>
            {description && (
              <p className='type-body-sm text-muted-foreground leading-normal'>{description}</p>
            )}
            {provenance && (
              <p className='type-caption text-muted-foreground/80 leading-normal'>{provenance}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className='block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg'
      >
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
