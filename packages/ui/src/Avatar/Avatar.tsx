import { clsx } from 'clsx';

export function Avatar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('h-8 w-8 rounded-full overflow-hidden flex items-center justify-center', className)}>
      {children}
    </div>
  );
}

export function AvatarImage({ src, alt }: { src: string; alt?: string }) {
  return <img src={src} alt={alt} className="h-full w-full object-cover" />;
}

export function AvatarFallback({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('h-full w-full flex items-center justify-center', className)}>{children}</div>
  );
}
