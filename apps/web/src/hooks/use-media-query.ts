import * as React from 'react';

/** Matches Tailwind's `md` breakpoint, below which the sidebar is a drawer. */
const MOBILE_BREAKPOINT = 768;

/**
 * Tracks whether the viewport is narrow enough to require the mobile layout.
 *
 * `useMediaQuery` (rather than a `matchMedia` call in a layout effect) keeps
 * the first render correct on the server-less client boot, which avoids the
 * sidebar flashing open on a phone before collapsing.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}
