import { useEffect, useState } from 'react';

/** True while the CSS media query matches (updates on resize / rotation). */
export function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const update = () => setOn(m.matches);
    update();
    m.addEventListener('change', update);
    return () => m.removeEventListener('change', update);
  }, [query]);
  return on;
}

/** Phone-sized screens (below Tailwind's `sm`, 640px). */
export const useIsPhone = () => useMedia('(max-width: 639px)');
