import * as React from 'react';
import Link from 'next/link';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';

export const emptyStateVariants = cva(
  'flex w-full flex-col items-center justify-center text-center transition-colors',
  {
    variants: {
      variant: {
        default: 'py-10 px-4',
        compact: 'py-6 px-3',
        card: 'rounded-lg border border-border/80 bg-card p-8 shadow-xs',
        dashed: 'rounded-lg border border-dashed border-border/80 bg-muted/20 p-8'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

export interface EmptyStateProps
  extends
    Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof emptyStateVariants> {
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
}

export function EmptyState({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  variant = 'default',
  children,
  className,
  ...props
}: EmptyStateProps) {
  const renderIcon = () => {
    if (!icon) return null;

    if (React.isValidElement(icon)) {
      return (
        <div className='mb-3 flex size-10 items-center justify-center rounded-lg border border-border/80 bg-muted/60 text-muted-foreground shadow-2xs'>
          {icon}
        </div>
      );
    }

    const IconComponent = icon as React.ComponentType<{ className?: string }>;
    return (
      <div className='mb-3 flex size-10 items-center justify-center rounded-lg border border-border/80 bg-muted/60 text-muted-foreground shadow-2xs'>
        <IconComponent className='size-5' />
      </div>
    );
  };

  const renderAction = (action: EmptyStateAction, isPrimary = true) => {
    const IconComp = action.icon;
    const content = (
      <>
        {IconComp && <IconComp className='size-4' />}
        <span>{action.label}</span>
      </>
    );

    if (action.href) {
      return (
        <Link
          href={action.href}
          className={cn(buttonVariants({ variant: isPrimary ? 'default' : 'outline', size: 'sm' }))}
        >
          {content}
        </Link>
      );
    }

    return (
      <Button
        variant={isPrimary ? 'default' : 'outline'}
        size='sm'
        onClick={action.onClick}
        disabled={action.disabled}
      >
        {content}
      </Button>
    );
  };

  return (
    <div
      data-slot='empty-state'
      className={cn(emptyStateVariants({ variant }), className)}
      {...props}
    >
      {renderIcon()}
      <h3 className='type-subheading text-foreground'>{title}</h3>
      {description && (
        <p className='type-body-sm text-muted-foreground max-w-sm mt-1 text-balance'>
          {description}
        </p>
      )}

      {(primaryAction || secondaryAction) && (
        <div className='mt-4 flex flex-wrap items-center justify-center gap-2'>
          {primaryAction && renderAction(primaryAction, true)}
          {secondaryAction && renderAction(secondaryAction, false)}
        </div>
      )}

      {children && <div className='mt-4 w-full max-w-md'>{children}</div>}
    </div>
  );
}
