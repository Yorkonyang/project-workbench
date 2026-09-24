/** 移动端断点判断钩子，返回 boolean；SSR/无 matchMedia 兜底 false */
import { useEffect, useState } from 'react';
export default function useMediaQuery(query) {
  const get = () =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener
      ? mql.addEventListener('change', onChange)
      : mql.addListener(onChange);
    return () =>
      mql.removeEventListener
        ? mql.removeEventListener('change', onChange)
        : mql.removeListener(onChange);
  }, [query]);
  return matches;
}
