import { clsx } from 'clsx';
import { cva, type VariantProps } from 'class-variance-authority';

const badgeVariants = cva('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-bg-subtle text-text-secondary',
      primary: 'bg-primary/10 text-primary',
      success: 'bg-success-bg text-success-text',
      warning: 'bg-warning-bg text-warning-text',
      error: 'bg-error-bg text-error-text',
      info: 'bg-info-bg text-info-text',
    },
  },
  defaultVariants: { variant: 'default' },
});

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant, children, className }: BadgeProps) {
  return <span className={clsx(badgeVariants({ variant }), className)}>{children}</span>;
}
