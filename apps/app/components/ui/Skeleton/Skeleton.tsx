interface SkeletonProps {
  variant?: 'line' | 'card' | 'table-row';
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({ variant = 'line', className = '', width, height }: SkeletonProps) {
  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  if (variant === 'card') {
    return (
      <div className={`skeleton rounded-xl ${className}`} style={{ height: height ?? '80px', ...style }} />
    );
  }

  if (variant === 'table-row') {
    return (
      <div className={`flex items-center gap-4 py-3 ${className}`}>
        <div className="w-8 h-8 skeleton rounded-full shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 skeleton rounded" style={{ width: '40%' }} />
          <div className="h-2.5 skeleton rounded" style={{ width: '25%' }} />
        </div>
        <div className="h-5 w-16 skeleton rounded-md shrink-0" />
        <div className="h-5 w-20 skeleton rounded-md shrink-0" />
      </div>
    );
  }

  return (
    <div
      className={`skeleton rounded ${className}`}
      style={{ height: height ?? '12px', width: width ?? '100%', ...style }}
    />
  );
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-0 divide-y divide-brand-border">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="table-row" />
      ))}
    </div>
  );
}
