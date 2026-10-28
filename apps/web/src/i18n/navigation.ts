import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/** Ссылки и переходы с учётом префикса языка. */
export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
