/* Types for text.js, for the tests. Not deployed: see .assetsignore. */

export interface ConfirmText {
  title: string;
  lead: string;
  warning: string;
  submit: string;
  stop: string;
}

export interface RelayText {
  /** The value of `<html lang>`. */
  lang: string;
  product: string;
  home: { title: string; body: string; link: string };
  approved: ConfirmText;
  refused: ConfirmText;
  problem: { title: string; body: string };
}

export declare const TEXT: Readonly<Record<string, RelayText>>;
export declare const DEFAULT_LANGUAGE: string;
export declare function pickLanguage(languages: readonly string[] | null | undefined): string;
