/**
 * Stands in for the `cloudflare:workers` module when the tests run in Node. The
 * OAuth library imports it for a base class the tests never instantiate.
 */
export class WorkerEntrypoint {}
