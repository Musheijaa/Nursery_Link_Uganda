import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Our type scale replaces Tailwind's, so tell tailwind-merge which classes are font sizes
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'] }] } },
});

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
