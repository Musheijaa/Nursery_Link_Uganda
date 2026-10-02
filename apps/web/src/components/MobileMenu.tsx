import * as RadixDialog from '@radix-ui/react-dialog';
import { Button } from '@nurserylink/ui';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { en } from '../copy/en';
import type { NavItem } from './Layout';

/** The phone menu: a panel from the right with the sections and the account links. Loaded on first open. */
const MobileMenu = ({ open, onOpenChange, nav, account, navLink }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nav: NavItem[];
  account: ReactNode;
  navLink: (state: { isActive: boolean }) => string;
}) => (
  <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-40 bg-canopy/40" />
      <RadixDialog.Content className="on-dark fixed inset-y-0 right-0 z-50 flex w-72 flex-col gap-2 bg-canopy p-4 shadow-float data-[state=open]:animate-drawer-in">
        <div className="flex items-center justify-between">
          <RadixDialog.Title className="font-bold text-paper">{en.app.menu}</RadixDialog.Title>
          <RadixDialog.Close asChild>
            <Button variant="ghost" size="icon" className="text-paper hover:bg-paper/10" aria-label={en.app.closeMenu}>
              <X aria-hidden />
            </Button>
          </RadixDialog.Close>
        </div>
        <RadixDialog.Description className="sr-only">{en.app.fullName}</RadixDialog.Description>
        <nav aria-label={en.app.menu} className="flex flex-col gap-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navLink} onClick={() => { onOpenChange(false); }}>
              <Icon aria-hidden className="size-5" />
              {label}
            </NavLink>
          ))}
        </nav>
        <hr className="my-2 border-paper/20" />
        {account}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  </RadixDialog.Root>
);
export default MobileMenu;
