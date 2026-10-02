import { en } from '../copy/en';
import { IMAGES } from '../data/images';
import { Picture } from '../components/Picture';
import { usePageTitle } from '../components/usePageTitle';

/** Attribution for the map data and every photo (required by their licences). */
const Credits = () => {
  usePageTitle(en.credits.title);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{en.credits.title}</h1>
      <section aria-labelledby="credits-data" className="flex flex-col gap-3">
        <h2 id="credits-data" className="text-xl">{en.credits.dataHeading}</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {en.credits.data.map(d => (
            <li key={d.name} className="flex flex-col gap-1 rounded-lg bg-paper p-4 text-sm shadow-card ring-1 ring-line">
              <p className="font-bold text-canopy">{d.name}</p>
              <p className="text-bark-muted">
                {d.by} ·{' '}
                <a href={d.licenseUrl} rel="noopener noreferrer license" className="underline">{d.license}</a> ·{' '}
                <a href={d.source} rel="noopener noreferrer" className="underline">{en.credits.source}</a>
              </p>
            </li>
          ))}
        </ul>
      </section>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl">{en.credits.photosHeading}</h2>
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
