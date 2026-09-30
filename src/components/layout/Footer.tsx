import React from 'react';
import { Page, useApp } from '../../context/AppContext';
import { Container } from '../ui';
import { LogoMark } from './Logo';

const COLUMNS: { heading: string; links: { page: Page; label: string }[] }[] = [
  {
    heading: 'Buy seedlings',
    links: [
      { page: 'seedlings', label: 'Find a nursery' },
      { page: 'trees', label: 'Tree guide' },
      { page: 'orders', label: 'Track an order' },
    ],
  },
  {
    heading: 'Programmes & data',
    links: [
      { page: 'programmes', label: 'Free seedling programmes' },
      { page: 'gaps', label: 'Planting gaps' },
    ],
  },
  {
    heading: 'About',
    links: [
      { page: 'nursery', label: 'For nursery owners' },
      { page: 'credits', label: 'Photo credits' },
    ],
  },
];

export const Footer: React.FC = () => {
  const { navigate } = useApp();

  return (
    <footer className="mt-16 border-t border-stone-200 bg-white">
      <Container className="grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <LogoMark className="h-7 w-7" />
            <span className="font-bold">Nursery Link Uganda</span>
          </div>
          <p className="text-sm text-stone-600">
            Connecting farmers, schools and restoration projects with registered tree nurseries across Uganda.
          </p>
        </div>

        {COLUMNS.map(column => (
          <div key={column.heading}>
            <h2 className="text-sm font-semibold">{column.heading}</h2>
            <ul className="mt-3 space-y-2">
              {column.links.map(link => (
                <li key={link.page}>
                  <button onClick={() => navigate(link.page)} className="text-sm text-stone-600 hover:text-brand-700">
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>

      <div className="border-t border-stone-200">
        <Container className="flex flex-col gap-2 py-5 text-xs text-stone-500 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Nursery Link Uganda</p>
          <p>Prototype with sample data. Payments are simulated.</p>
        </Container>
      </div>
    </footer>
  );
};
