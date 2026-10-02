import { Field, Input, cn } from '@nurserylink/ui';
import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { en } from '../../copy/en';
import { usePageTitle } from '../../components/usePageTitle';
import { Picture } from '../../components/Picture';
import { IMAGES } from '../../data/images';
import { useFeatures } from '../orders/api';

/** The narrow centred card every sign-in screen uses. */
export const AuthCard = ({ title, intro, children, footer }: { title: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) => {
  usePageTitle(title);
  const photo = IMAGES['community-planting'];
  const features = useFeatures();
  return (
    // Wider screens: a photo panel (why join) beside the form. Phones: just the form.
    <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-lg bg-paper shadow-lift ring-1 ring-line md:grid-cols-[1fr_1.1fr]">
      <aside aria-hidden className="on-dark relative isolate hidden flex-col justify-end gap-3 bg-canopy p-8 md:flex">
        {photo && <Picture src={photo.src} alt="" width={960} height={641} sizes="45vw" className="absolute inset-0 -z-10 size-full object-cover object-[60%_40%]" />}
        <span className="absolute inset-0 -z-10 bg-gradient-to-t from-canopy via-canopy/70 to-canopy/10" />
        <p className="text-2xl leading-snug font-bold text-paper">{en.auth.panel.title}</p>
        <ul className="flex flex-col gap-1.5 text-mist/90">
          {(features.data?.payments === false ? en.auth.panel.pointsTrial : en.auth.panel.points).map(point => (
            <li key={point} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-sun" />{point}</li>
          ))}
        </ul>
      </aside>
      <div className="flex flex-col gap-6 p-5 sm:p-8 md:p-10">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl md:text-3xl">{title}</h1>
            <span aria-hidden className="block h-1 w-10 rounded-full bg-murram" />
            {intro && <p className="text-bark-muted">{intro}</p>}
          </div>
          {children}
        </div>
        {footer && <div className="text-center">{footer}</div>}
      </div>
    </div>
  );
};

/** A form-level message (e.g. "Phone number, email or password is not correct"). */
export const FormAlert = ({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'info' }) => (
  <p role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-sm px-3 py-2 font-bold', tone === 'error' ? 'bg-laterite-tint text-laterite' : 'bg-forest-tint text-forest')}>
    {children}
  </p>
);

type PasswordProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string; hint?: string; error?: string | undefined };

/** Password with a show/hide toggle (easier to type correctly on a phone keyboard). */
export const PasswordField = forwardRef<HTMLInputElement, PasswordProps>(({ label, hint, error, ...props }, ref) => {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <Input ref={ref} id={id} type={visible ? 'text' : 'password'} aria-describedby={describedBy} invalid={invalid} className="pr-12" {...props} />
          <button
            type="button"
            onClick={() => { setVisible(v => !v); }}
            aria-label={visible ? en.auth.hidePassword : en.auth.showPassword}
            aria-pressed={visible}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-bark-muted hover:text-forest"
          >
            {visible ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
          </button>
        </div>
      )}
    </Field>
  );
});
PasswordField.displayName = 'PasswordField';
