import { Toaster } from '@nurserylink/ui';
import { en } from '../copy/en';

/** Loaded just after the first paint (Layout), so Radix Toast isn't part of the first download. */
const AppToaster = () => <Toaster closeLabel={en.app.dismiss} />;
export default AppToaster;
