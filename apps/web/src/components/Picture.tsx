import type { ImgHTMLAttributes } from 'react';

/**
 * A photo from /images/<name>.jpg served as WebP (480/960 widths) with the JPEG as a fallback
 * for older iPhones. Fixed width/height avoid layout shift; images below the fold load lazily.
 */
export const Picture = ({ src, alt, width, height, sizes = '(min-width: 640px) 480px, 100vw', priority = false, wide = false, className, ...rest }: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'width' | 'height'> & {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  priority?: boolean;
  /** The photo also has a 1400 px version (full-width heroes; see scripts/build-images.mjs) */
  wide?: boolean;
}) => {
  const m = /^\/images\/([\w-]+)\.jpg$/.exec(src);
  const img = (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      // React 18 passes unknown lowercase attributes through; camel-cased fetchPriority needs React 19
      {...(priority ? ({ fetchpriority: 'high' } as Record<string, string>) : {})}
      className={className}
      {...rest}
    />
  );
  if (!m) return img;
  const base = `/images/${m[1] ?? ''}`;
  return (
    // display: contents keeps <picture> out of layout, so the <img> classes size the photo
    <picture className="contents">
      <source type="image/webp" srcSet={`${base}-480.webp 480w, ${base}-960.webp 960w${wide ? `, ${base}-1400.webp 1400w` : ''}`} sizes={sizes} />
      {img}
    </picture>
  );
};
