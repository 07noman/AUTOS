import { ReactNode } from 'react';
import { clsx } from 'clsx';

const variants = {
  info: 'border-info/30 bg-info/10 text-text',
  success: 'border-success/30 bg-success/10 text-text',
  warning: 'border-warning/30 bg-warning/10 text-text',
  error: 'border-error/30 bg-error/10 text-text',
} as const;

export function Alert({
  variant = 'info',
  title,
  children,
  className,
}: {
  variant?: keyof typeof variants;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={clsx('rounded-lg border px-4 py-3 text-sm', variants[variant], className)}
    >
      {title && <div className="font-semibold mb-1">{title}</div>}
      {children}
    </div>
  );
}
