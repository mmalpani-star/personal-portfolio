'use client';

import { useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

/** True only for hover-capable fine pointers with motion allowed. False during SSR. */
export function useFinePointer() {
  const reduceMotion = useReducedMotion();
  const [fine, setFine] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sync = () => setFine(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return fine && !reduceMotion;
}
