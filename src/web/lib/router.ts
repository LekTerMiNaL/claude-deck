import { useCallback, useEffect, useState } from "react";

export interface Route {
  pathname: string;
  query: URLSearchParams;
}

function current(): Route {
  return { pathname: window.location.pathname, query: new URLSearchParams(window.location.search) };
}

/** Minimal history-API router — the server falls back to index.html for any path. */
export function useRoute(): [Route, (to: string) => void] {
  const [route, setRoute] = useState<Route>(current);

  useEffect(() => {
    const onPop = () => setRoute(current());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to: string) => {
    window.history.pushState(null, "", to);
    setRoute(current());
  }, []);

  return [route, navigate];
}

export function projectUrl(path: string, sessionId?: string): string {
  const q = new URLSearchParams({ path });
  if (sessionId) q.set("s", sessionId);
  return `/project?${q.toString()}`;
}
