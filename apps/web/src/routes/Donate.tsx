import { formatPhone } from '@nurserylink/ui';
import { Mail, MessageCircle, Phone } from 'lucide-react';
import { useState } from 'react';
import { PageHero } from '../components/PageHero';
import { usePageTitle } from '../components/usePageTitle';
import { en } from '../copy/en';
import { usePageCopy } from '../features/content/api';
import { GeneralEnquiryForm, type GeneralEnquiryType } from '../features/content/EnquiryForms';
import { Markdown } from '../features/news/Markdown';
import { cn } from '@nurserylink/ui';

const t = en.donate;
const ACTIONS: { type: GeneralEnquiryType; label: string }[] = [
  { type: 'donation', label: t.donateNow },
  { type: 'partnership', label: t.partner },
  { type: 'contact', label: t.contact },
];

const asText = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/**
 * Donate: why support matters (the client's text, admin-editable), how to send a donation (payment
 * details set by an admin, never in the code), and forms to donate, partner or contact the team.
 * No money is taken on the site.
 */
const Donate = () => {
  usePageTitle(en.nav.donate);
  const page = usePageCopy('donate.page');
  const payment = usePageCopy('donate.payment_instructions');
  const contact = usePageCopy('site.contact');
  const [type, setType] = useState<GeneralEnquiryType>('donation');
  const phone = asText(contact.data.phone);
  const email = asText(contact.data.email);
  const whatsapp = asText(contact.data.whatsapp);

  return (
    <div className="flex flex-col gap-6">
      <PageHero title={page.title} intro={page.subtitle ?? undefined} photo="community-planting" focus="object-[60%_40%]" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex max-w-3xl flex-col gap-3">{page.body && <Markdown source={page.body} />}</div>

        <aside className="flex flex-col gap-4 self-start">
          {payment.body && (
            <section aria-labelledby="pay-heading" className="flex flex-col gap-2 rounded-lg bg-sun-tint p-5 ring-1 ring-line">
              <h2 id="pay-heading" className="text-h4">{payment.title}</h2>
              <Markdown source={payment.body} />
            </section>
          )}
          {(phone ?? email ?? whatsapp) && (
            <section aria-labelledby="contact-heading" className="flex flex-col gap-2 rounded-lg bg-paper p-5 shadow-card ring-1 ring-line">
              <h2 id="contact-heading" className="text-h4">{contact.title}</h2>
              <ul className="flex flex-col gap-1">
                {phone && <li><a href={`tel:${phone}`} className="flex min-h-11 items-center gap-2 font-bold"><Phone aria-hidden className="size-5" />{formatPhone(phone)}</a></li>}
                {whatsapp && <li><a href={`https://wa.me/${whatsapp.replace(/^\+/, '')}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 font-bold"><MessageCircle aria-hidden className="size-5" />{t.whatsapp}<span className="sr-only"> {en.home.opensNewTab}</span></a></li>}
                {email && <li><a href={`mailto:${email}`} className="flex min-h-11 items-center gap-2 font-bold"><Mail aria-hidden className="size-5" />{email}</a></li>}
              </ul>
            </section>
          )}
        </aside>
      </div>

      <section aria-labelledby="donate-forms" className="flex flex-col gap-4 rounded-lg bg-paper p-5 shadow-card ring-1 ring-line md:p-6">
        <h2 id="donate-forms" className="text-h3">{t.formsHeading}</h2>
        <div role="tablist" aria-label={t.formsHeading} className="flex flex-wrap gap-2">
          {ACTIONS.map(a => (
            <button
              key={a.type}
              type="button"
              role="tab"
              id={`tab-${a.type}`}
              aria-selected={type === a.type}
              aria-controls="donate-panel"
              onClick={() => { setType(a.type); }}
              className={cn(
                'min-h-11 rounded-full px-5 font-bold ring-1',
                type === a.type
                  ? a.type === 'donation' ? 'bg-sprout text-sprout-ink ring-sprout-ink' : 'bg-canopy text-paper ring-canopy'
                  : 'bg-paper text-canopy ring-line hover:ring-canopy'
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id="donate-panel" aria-labelledby={`tab-${type}`} className="flex flex-col gap-3">
          <p className="text-bark-muted">{en.enquiry.general[type].intro}</p>
          <GeneralEnquiryForm key={type} type={type} />
        </div>
      </section>
    </div>
  );
};
export default Donate;
