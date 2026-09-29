import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';

export const statusBadgeVariants = cva(
  'inline-flex items-center font-medium transition-colors select-none shrink-0 border whitespace-nowrap',
  {
    variants: {
      status: {
        verified: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/25',
        review: 'bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-500/30',
        original: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-400/25',
        customized: 'bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/25',
        success: 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/25',
        warning: 'bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-500/30',
        error: 'bg-destructive/10 text-destructive border-destructive/25',
        info: 'bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/25',
        neutral: 'bg-muted/60 text-muted-foreground border-border/80'
      },
      size: {
        sm: 'h-5 px-1.5 py-0.25 text-[11px] gap-1 rounded-md [&_svg]:size-3',
        default: 'h-6 px-2.5 py-0.5 text-xs gap-1.5 rounded-md [&_svg]:size-3.5',
        lg: 'h-7 px-3 py-1 text-xs font-semibold gap-1.5 rounded-md [&_svg]:size-4'
      }
    },
    defaultVariants: {
      status: 'neutral',
      size: 'default'
    }
  }
);

export type StatusBadgeStatus = NonNullable<VariantProps<typeof statusBadgeVariants>['status']>;
export type StatusBadgeSize = NonNullable<VariantProps<typeof statusBadgeVariants>['size']>;

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof statusBadgeVariants> {
  label?: React.ReactNode;
  icon?: React.ReactNode;
  showIcon?: boolean;
}

const DEFAULT_STATUS_LABELS: Record<StatusBadgeStatus, string> = {
  verified: 'Verified Grounded',
  review: 'Requires Review',
  original: 'Master Content',
  customized: 'Customized',
  success: 'Success',
  warning: 'Warning',
  error: 'Error',
  info: 'Information',
  neutral: 'Status'
};

function getDefaultIcon(status: StatusBadgeStatus) {
  switch (status) {
    case 'verified':
    case 'success':
      return <Icons.check aria-hidden='true' />;
    case 'review':
    case 'warning':
      return <Icons.warning aria-hidden='true' />;
    case 'original':
      return <Icons.fileTypeDoc aria-hidden='true' />;
    case 'customized':
      return <Icons.edit aria-hidden='true' />;
    case 'error':
      return <Icons.close aria-hidden='true' />;
    case 'info':
      return <Icons.info aria-hidden='true' />;
    case 'neutral':
    default:
      return null;
  }
}

export function StatusBadge({
  status = 'neutral',
  size = 'default',
  label,
  icon,
  showIcon = true,
  children,
  className,
  ...props
}: StatusBadgeProps) {
  const resolvedStatus = status || 'neutral';
  const renderedContent = children ?? label ?? DEFAULT_STATUS_LABELS[resolvedStatus];
  const renderedIcon = showIcon ? (icon ?? getDefaultIcon(resolvedStatus)) : null;

  return (
    <span
      data-slot='status-badge'
      data-status={resolvedStatus}
      data-size={size}
      className={cn(statusBadgeVariants({ status: resolvedStatus, size, className }))}
      {...props}
    >
      {renderedIcon}
      <span>{renderedContent}</span>
    </span>
  );
}
