/**
 * Pasted-text normalizer: turns messy PDF/EPUB copy into readable prose.
 *
 * Heuristics (conservative — never reorders or rewrites content):
 *  1. drop standalone page numbers / "Page X of Y" / arXiv ids / DOIs,
 *  2. drop repeated header/footer lines (same trimmed line appearing ≥ 3×),
 *  3. rejoin hyphenated line breaks ("word-\n" + lowercase start),
 *  4. rejoin soft line breaks inside a sentence (lowercase continuation),
 *  5. keep paragraph breaks (blank lines / sentence-ending punctuation),
 *  6. never touch lines that look like math ($, \, \begin, \[ ... \]).
 */
export interface NormalizeResult {
    text: string;
    droppedLines: number;
    joinedHyphens: number;
    joinedLines: number;
}
export declare function normalizePastedText(raw: string): NormalizeResult;
