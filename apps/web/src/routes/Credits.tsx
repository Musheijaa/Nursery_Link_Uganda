import { en } from '../copy/en';
import { IMAGES } from '../data/images';
import { Picture } from '../components/Picture';
import { usePageTitle } from '../components/usePageTitle';

/** Attribution for every photo (required by their Creative Commons licences). */
const Credits = () => {
  usePageTitle(en.credits.title);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl">{en.credits.title}</h1>
        <p className="max-w-2xl text-bark-muted">{en.credits.intro}</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(IMAGES).map(([key, img]) => (
          <li key={key} className="flex gap-3 rounded-lg bg-paper shadow-card p-3 ring-1 ring-line">
            <Picture src={img.src} alt={img.alt} width={96} height={72} sizes="96px" className="h-18 w-24 shrink-0 rounded-sm object-cover" />
            <div className="flex min-w-0 flex-col gap-1 text-sm">
              <p className="text-bark">{img.alt}</p>
              <p className="text-bark-muted">
                {en.credits.by} {img.author} ·{' '}
                <a href={img.licenseUrl} rel="noopener noreferrer license" className="underline">
                  {img.license}
                </a>{' '}
                ·{' '}
                <a href={img.source} rel="noopener noreferrer" className="underline">
                  {en.credits.source}
                </a>
                {img.changes && ` · ${en.credits.changed(img.changes)}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
export default Credits;
