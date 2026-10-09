import { useCallback, useEffect, useState } from "react";

function read(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * One value kept in the address bar, so a link reopens the page the way it was
 * left. Changes replace the history entry instead of adding one.
 */
export function useQueryParam(name: string): [string | null, (value: string | null) => void] {
  const [value, setValue] = useState(() => read(name));

  useEffect(() => {
    const onPop = () => setValue(read(name));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [name]);

  const update = useCallback(
    (next: string | null) => {
      const url = new URL(window.location.href);
      if (next === null) url.searchParams.delete(name);
      else url.searchParams.set(name, next);
      window.history.replaceState(null, "", url);
      setValue(next);
    },
    [name],
  );

  return [value, update];
}
