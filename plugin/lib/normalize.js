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
const PAGE_NUMBER_RE = /^\s*[-–—]?\s*(?:page\s*)?\d{1,4}\s*(?:\/\s*\d{1,4})?\s*[-–—]?\s*$/i;
const PAGE_X_OF_Y_RE = /^\s*(?:page\s*)?\d{1,4}\s+of\s+\d{1,4}\s*$/i;
const ARXIV_RE = /^\s*arXiv:\s*\d{4}\.\d{4,5}(?:v\d+)?\s*$/i;
const DOI_RE = /^\s*doi:\s*10\.\d{4,9}\/\S+\s*$/i;
const SENTENCE_END_RE = /[.!?。！？;；:]$/;
const MATH_LINE_RE = /(\$|\\begin\{|\\end\{|\\[a-zA-Z]+|\$\$|\[(eq|align|equation)|\\label\{)/;
const LOWERCASE_START_RE = /^[a-z0-9(\[{<'"‘“]/;
export function normalizePastedText(raw) {
    let text = raw.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ');
    const lines = text.split('\n');
    let droppedLines = 0;
    let joinedHyphens = 0;
    let joinedLines = 0;
    // ── pass 1: drop junk lines (page numbers, repeated headers/footers) ──
    const freq = new Map();
    for (const line of lines) {
        const t = line.trim();
        if (t.length >= 4)
            freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    const clean = [];
    for (const line of lines) {
        const t = line.trim();
        if (t.length === 0) {
            clean.push('');
            continue;
        }
        if (PAGE_NUMBER_RE.test(t) && t.replace(/[^\d]/g, '').length <= 4) {
            droppedLines += 1;
            continue;
        }
        if (PAGE_X_OF_Y_RE.test(t)) {
            droppedLines += 1;
            continue;
        }
        if (ARXIV_RE.test(t) || DOI_RE.test(t)) {
            droppedLines += 1;
            continue;
        }
        if ((freq.get(t) ?? 0) >= 3 && t.length >= 6) {
            droppedLines += 1;
            continue;
        }
        clean.push(line);
    }
    // ── pass 2: rebuild paragraphs by joining soft line breaks ──
    const out = [];
    let skipNext = false;
    for (let i = 0; i < clean.length; i += 1) {
        if (skipNext) {
            skipNext = false;
            continue;
        }
        let line = clean[i].trimEnd();
        if (line.length === 0) {
            out.push('');
            continue;
        }
        const next = i + 1 < clean.length ? clean[i + 1].trim() : '';
        const prev = out.length > 0 ? out[out.length - 1].trimEnd() : '';
        const isMath = MATH_LINE_RE.test(line);
        const nextIsMath = next.length > 0 && MATH_LINE_RE.test(next);
        const prevIsMath = prev.length > 0 && MATH_LINE_RE.test(prev);
        if (!isMath && !nextIsMath && next.length > 0 && !prevIsMath) {
            // hyphenation: "word-" + lowercase/digit continuation → glue
            if (/[A-Za-z]\-$/.test(line) && LOWERCASE_START_RE.test(next)) {
                out.push(line.slice(0, -1) + next);
                skipNext = true;
                joinedHyphens += 1;
                continue;
            }
        }
        if (!isMath && !prevIsMath && prev.length > 0 && LOWERCASE_START_RE.test(line) && !SENTENCE_END_RE.test(prev)) {
            // soft break inside a sentence → join with the previous line
            if (/[A-Za-z]\-$/.test(prev)) {
                // hyphenation continuation: "word-" + "rest" → "wordrest"
                out[out.length - 1] = prev.slice(0, -1) + line;
                joinedHyphens += 1;
            }
            else {
                out[out.length - 1] = prev + ' ' + line;
                joinedLines += 1;
            }
            continue;
        }
        out.push(line);
    }
    // ── pass 3: collapse whitespace / blank runs ──
    let joined = out.join('\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    // tidy spaces glued around punctuation introduced by joining
    joined = joined
        .replace(/ ,/g, ',')
        .replace(/ \./g, '.')
        .replace(/ ;/g, ';')
        .replace(/ :/g, ':');
    return { text: joined, droppedLines, joinedHyphens, joinedLines };
}
//# sourceMappingURL=normalize.js.map