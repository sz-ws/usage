import { z } from "zod";

import type { ResourceNames } from "../shared/types";

/**
 * Names for the things the analytics API only knows by id: D1 databases, KV
 * namespaces, Durable Object namespaces and Queues.
 *
 * A token with Account Analytics Read alone cannot list any of them, and the
 * page then shows the start of each id. Whoever wants names adds read
 * permissions to the token, knowing that the ones for D1 and KV also allow
 * reading what is stored there. Each list is tried on its own and a refusal is
 * simply a list without names.
 */

const API = "https://api.cloudflare.com/client/v4/accounts";
const REQUEST_TIMEOUT_MS = 10_000;

const listing = z.object({ result: z.array(z.record(z.string(), z.unknown())) });

type Row = Record<string, unknown>;

interface Source {
  path: string;
  /** The id the analytics API reports for the row, and what to call it. */
  entry: (row: Row) => [id: unknown, name: unknown];
}

const SOURCES: readonly Source[] = [
  { path: "d1/database", entry: (row) => [row.uuid, row.name] },
  { path: "storage/kv/namespaces", entry: (row) => [row.id, row.title] },
  {
    path: "workers/durable_objects/namespaces",
    entry: (row) => [row.id, row.script && row.class ? `${String(row.script)} · ${String(row.class)}` : row.name],
  },
  { path: "queues", entry: (row) => [row.queue_id, row.queue_name] },
];

const PAGE_SIZE = 100;
/** Past this many of one kind, the rest go by their ids. */
const MAX_PAGES = 5;

async function list(token: string, accountId: string, source: Source): Promise<ResourceNames> {
  const names: ResourceNames = {};

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await fetch(`${API}/${accountId}/${source.path}?per_page=${PAGE_SIZE}&page=${page}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) break;

    const body = listing.safeParse(await response.json());
    if (!body.success) break;

    let added = 0;
    for (const row of body.data.result) {
      const [id, name] = source.entry(row);
      if (typeof id !== "string" || id.length === 0 || typeof name !== "string" || name.length === 0) continue;
      // An endpoint that ignores `page` would hand back the same rows forever.
      if (!Object.hasOwn(names, id)) added += 1;
      names[id] = name;
    }
    if (body.data.result.length < PAGE_SIZE || added === 0) break;
  }
  return names;
}

/** Whatever names the token is allowed to see, added to the ones already known. */
export async function readNames(token: string, accountId: string, known: ResourceNames): Promise<ResourceNames> {
  const lists = await Promise.all(
    SOURCES.map((source) => list(token, accountId, source).catch((): ResourceNames => ({}))),
  );
  // Known names first: a list that fails today keeps yesterday's names.
  return Object.assign(Object.create(null) as ResourceNames, known, ...lists);
}
