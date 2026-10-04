import NextImage, { type ImageProps as NextImageProps } from 'next/image';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type ContentImageProps = Omit<
  NextImageProps,
  'src' | 'alt' | 'width' | 'height' | 'fill'
> & {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  caption?: ReactNode;
};

export function Image({
  src,
  alt,
  width = 1600,
  height = 900,
  caption,
  className,
  unoptimized = true,
  ...props
}: ContentImageProps) {
  return (
    <figure className="not-prose my-6">
      <NextImage
        {...props}
        src={src}
        alt={alt}
        width={width}
        height={height}
        unoptimized={unoptimized}
        className={cn('h-auto w-full rounded-xl border', className)}
      />
      {caption ? (
        <figcaption className="mt-2 text-center text-sm text-fd-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
