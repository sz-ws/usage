/** A KV namespace that lives in a Map, for the parts of the Worker that only get and put. */
export function fakeKv(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]));
  const kv = {
    // As KV does: the text as it was put, unless JSON is asked for.
    get: async (key: string, type?: string | { type?: string }) => {
      const value = data.get(key);
      if (value === undefined) return null;
      return (typeof type === "string" ? type : type?.type) === "json" ? JSON.parse(value) : value;
    },
    put: async (key: string, value: string) => {
      data.set(key, value);
    },
  } as unknown as KVNamespace;
  const read = <T>(key: string): T | undefined => {
    const value = data.get(key);
    return value === undefined ? undefined : (JSON.parse(value) as T);
  };
  return { kv, read, keys: () => [...data.keys()] };
}

/** A fetch that answers from a table of URL prefix to response, and records what it was asked. */
export function fakeFetch(routes: Record<string, (request: Request) => Response | Promise<Response>>) {
  const calls: Request[] = [];
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input as string, init);
    calls.push(request);
    const match = Object.keys(routes)
      .sort((left, right) => right.length - left.length)
      .find((prefix) => request.url.startsWith(prefix));
    return match ? routes[match]!(request) : new Response("no route", { status: 599 });
  };
  return { fetcher, calls };
}

/** An execution context that collects what the Worker leaves running, so a test can wait for it. */
export function fakeContext() {
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (work: Promise<unknown>) => {
      pending.push(work.catch(() => undefined));
    },
    passThroughOnException: () => undefined,
    props: {},
  } as unknown as ExecutionContext;
  return { ctx, settled: () => Promise.all(pending) };
}
