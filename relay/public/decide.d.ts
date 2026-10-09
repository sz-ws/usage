/* Types for decide.js, for the tests. Not deployed: see .assetsignore. */

export declare const RETURN_PATH: "/connect/return";
export declare const MAX_STATE_LENGTH: number;
export declare const MAX_ORIGIN_LENGTH: number;
export declare const MAX_CODE_LENGTH: number;

export interface ReturnState {
  /** The origin of the usage page that started the sign-in. */
  o: string;
  n: string;
}

export type ReturnFields = { code: string; state: string } | { error: string; state: string };

export type Decision =
  | { show: "problem" }
  | {
      show: "confirm";
      /** Whether Cloudflare sent a code or an error. */
      outcome: "approved" | "refused";
      origin: string;
      action: string;
      fields: ReturnFields;
    };

export declare function isReturnOrigin(value: unknown): value is string;
export declare function decodeState(state: unknown): ReturnState | null;
export declare function decide(search: string): Decision;
