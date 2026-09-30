import React from 'react';
import { IMAGES } from '../../data/images';
import { Container, PageHeader } from '../ui';

export const CreditsPage: React.FC = () => (
  <Container className="space-y-8 py-10">
    <PageHeader
      title="Photo credits"
      intro="Photos on this site come from Wikimedia Commons and are used under the licences below. They have been resized and compressed for faster loading."
    />

    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(IMAGES).map(([key, image]) => (
        <li key={key} className="flex gap-3 rounded-lg border border-stone-200 bg-white p-3">
          <img src={image.src} alt="" loading="lazy" className="h-16 w-20 shrink-0 rounded object-cover" />
          <div className="min-w-0 text-sm">
            <p className="line-clamp-2 text-stone-800">{image.alt}</p>
            <p className="text-stone-500">
              {image.author} ·{' '}
              {image.licenseUrl ? (
                <a href={image.licenseUrl} target="_blank" rel="noreferrer" className="hover:underline">{image.license}</a>
              ) : (
                image.license
              )}{' '}
              ·{' '}
              <a href={image.source} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">Source</a>
            </p>
          </div>
        </li>
      ))}
    </ul>

    <p className="text-sm text-stone-600">
      Map data and tiles © OpenStreetMap contributors.
    </p>
  </Container>
);
