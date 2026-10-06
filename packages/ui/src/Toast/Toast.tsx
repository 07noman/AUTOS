import { clsx } from 'clsx';

export function Toast({
  message,
  variant = 'info',
  onDismiss,
}: {
  message: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
  onDismiss?: () => void;
}) {
  const colors = {
    info: 'border-info bg-bg-elevated',
    success: 'border-success bg-bg-elevated',
    warning: 'border-warning bg-bg-elevated',
    error: 'border-error bg-bg-elevated',
  };
  return (
    <div
      className={clsx(
        'fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-lg',
        colors[variant]
      )}
      role="status"
    >
      <p className="text-sm text-text flex-1">{message}</p>
      {onDismiss && (
        <button type="button" className="text-text-muted hover:text-text text-xs" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}
