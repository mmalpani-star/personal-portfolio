'use client';

import { useEffect, useState } from 'react';

const visitedKey = 'missions-visited';
const shownKey = 'missions-ace-shown';
const changeEvent = 'missions-change';

function read(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(visitedKey) ?? '[]');
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/** Records a flagship page visit. Returns true the first time every flagship has been seen. */
export function recordMission(slug: string, all: string[]) {
  const visited = Array.from(new Set([...read(), slug]));
  try {
    localStorage.setItem(visitedKey, JSON.stringify(visited));
    window.dispatchEvent(new Event(changeEvent));
    if (all.every((item) => visited.includes(item)) && !localStorage.getItem(shownKey)) {
      localStorage.setItem(shownKey, '1');
      return true;
    }
  } catch {
    // Storage blocked: no progress tracking, and no banner.
  }
  return false;
}

/** Which flagship projects this browser has opened. Empty until mounted. */
export function useMissionsVisited() {
  const [visited, setVisited] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setVisited(read());
    sync();
    window.addEventListener(changeEvent, sync);
    return () => window.removeEventListener(changeEvent, sync);
  }, []);

  return visited;
}
