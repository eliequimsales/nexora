import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, getInitials } from '@/lib/utils';

const avatarVariants = cva(
  'relative inline-flex items-center justify-center rounded-full bg-brand-surface-2 border border-brand-border font-medium text-text-secondary shrink-0 overflow-hidden',
  {
    variants: {
      size: {
        sm: 'w-6 h-6 text-2xs',
        md: 'w-8 h-8 text-xs',
        lg: 'w-10 h-10 text-sm',
        xl: 'w-12 h-12 text-base',
      },
    },
    defaultVariants: { size: 'md' },
  }
);

export interface AvatarProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatarVariants> {
  src?: string | null;
  name?: string;
  alt?: string;
}

export function Avatar({ className, size, src, name, alt, ...props }: AvatarProps) {
  const [imgError, setImgError] = React.useState(false);
  const initials = name ? getInitials(name) : '?';

  return (
    <span className={cn(avatarVariants({ size }), className)} {...props}>
      {src && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt ?? name ?? 'Avatar'}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <span aria-label={name}>{initials}</span>
      )}
    </span>
  );
}
