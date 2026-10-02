/** Species photos are either the public site's files (/images/...) or uploads served by the API (/media/...). */
export const mediaSrc = (url: string): string =>
  url.startsWith('/images/') ? `${import.meta.env.VITE_PUBLIC_WEB_URL ?? ''}${url}` : url;
