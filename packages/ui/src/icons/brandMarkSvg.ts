/**
 * The Nursery Link mark, after the owner's "Your Trusted Link to Quality Seedlings" logo: a seedling
 * rising from a map of Uganda (the official UBOS outline, simplified) inside a lake-blue chain link,
 * on a cream tile. One drawing for the header (BrandMark), the static app shell and both favicons.
 */
export const BRAND_MARK_VIEWBOX = '0 0 64 64';
export const BRAND_MARK_BODY =
  "<rect width=\"64\" height=\"64\" rx=\"14\" fill=\"#faf6ee\"/><path d=\"M27.53 58.53A21.5 21.5 0 0 1 19.98 19.68\" fill=\"none\" stroke=\"#2b6a97\" stroke-width=\"7.5\" stroke-linecap=\"round\"/><path d=\"M27.53 58.53A21.5 21.5 0 0 1 19.98 19.68\" fill=\"none\" stroke=\"#faf6ee\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><path d=\"M44.02 19.68A21.5 21.5 0 0 1 21.25 56.12\" fill=\"none\" stroke=\"#2b6a97\" stroke-width=\"7.5\" stroke-linecap=\"round\"/><path d=\"M44.02 19.68A21.5 21.5 0 0 1 21.25 56.12\" fill=\"none\" stroke=\"#faf6ee\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><path d=\"M32 33V12.5\" stroke=\"#2a7d45\" stroke-width=\"3\" stroke-linecap=\"round\"/><path d=\"M32 19.5C27.5 10.5 19.5 9.5 15 13C19.5 19.5 26.5 21 32 19.5Z\" fill=\"#2a7d45\"/><path d=\"M32 16.5C35.5 7.5 43.5 5.5 49 9C45.5 15.5 38.5 18 32 16.5Z\" fill=\"#5aa95e\"/><path d=\"M32 13C29.8 8.8 30.3 5 32.6 2.4C34.8 5.6 34.3 9.6 32 13Z\" fill=\"#2a7d45\"/><g transform=\"translate(20.3 26)\"><path d=\"M 3.9 23.2 L 3.3 23.2 2.0 24.8 1.4 25.0 1.0 24.2 0.0 24.5 0.6 18.2 1.7 16.2 1.7 14.8 2.5 14.7 3.0 13.4 4.2 13.0 7.5 9.3 7.0 8.5 5.0 7.8 5.7 6.2 5.1 5.2 6.0 2.5 7.4 1.9 8.4 2.6 9.8 1.8 10.3 2.8 11.5 3.2 12.4 2.2 15.0 1.5 17.2 2.0 19.2 0.0 19.9 1.3 19.7 1.6 20.2 1.6 20.0 2.0 21.4 2.5 21.0 3.3 21.2 4.7 23.5 7.7 23.6 10.8 22.7 12.4 22.8 13.2 21.6 13.8 18.9 18.1 19.2 19.1 19.0 22.8 3.9 23.2 Z\" fill=\"#9fcf6e\" stroke=\"#2a7d45\" stroke-width=\"1.1\" stroke-linejoin=\"round\"/></g>";

/** A standalone SVG document of the mark (favicons, PWA icons). */
export const brandMarkSvg = (): string => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${BRAND_MARK_VIEWBOX}">${BRAND_MARK_BODY}</svg>`;
