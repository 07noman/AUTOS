import { forwardRef, InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconClick?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, rightIcon, onRightIconClick, id, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-text-secondary mb-1.5">
          {label}
        </label>
      )}
      <div
        className={clsx(
          'relative flex items-center border rounded-md transition-colors bg-bg-elevated',
          error ? 'border-error' : 'border-border focus-within:ring-2 focus-within:ring-primary',
          className
        )}
      >
        {leftIcon && <div className="pl-3 text-text-muted">{leftIcon}</div>}
        <input
          ref={ref}
          id={id}
          className={clsx(
            'w-full bg-transparent text-text placeholder:text-text-muted py-2 px-3 text-sm focus:outline-none',
            leftIcon && 'pl-2'
          )}
          {...props}
        />
        {rightIcon && (
          <div
            className={clsx('pr-3 text-text-muted', onRightIconClick && 'cursor-pointer')}
            onClick={onRightIconClick}
            onKeyDown={() => {}}
            role={onRightIconClick ? 'button' : undefined}
          >
            {rightIcon}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-error">{error}</p>}
    </div>
  )
);

Input.displayName = 'Input';
