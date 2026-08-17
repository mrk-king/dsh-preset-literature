export interface VisionEvidence {
    summary?: string;
    ocr: {
        full_text: string;
        lines: Array<{
            text: string;
            language?: string;
        }>;
    };
    layout: {
        regions: Array<{
            type: string;
            reading_order: number;
            text: string;
        }>;
    };
    semantics: {
        scene?: string;
        intent?: string;
        entities: Array<{
            name: string;
            type: string;
            evidence?: string;
        }>;
        relations?: Array<{
            subject: string;
            predicate: string;
            object: string;
        }>;
    };
    visual?: {
        dominant_colors?: string[];
        style?: string;
        notes?: string[];
    };
    uncertainty?: string[];
}
export declare const VISION_TIMEOUT_MS = 180000;
export declare function resolveModlensBin(cfg: string): string | null;
/**
 * Read an image through modlens. `pathOrUrl` is a local absolute path or an
 * http(s) URL. `prompt` is optional extra focus. Returns the evidence object
 * (`parsed.result` of the CLI JSON), the same shape the built-in
 * `modlens_read_image` tool returns.
 */
export declare function readImage(bin: string, pathOrUrl: string, opts?: {
    prompt?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
}): Promise<VisionEvidence>;
/** Compact human-readable rendering of evidence for notes / chat messages. */
export declare function renderEvidence(ev: VisionEvidence, maxChars?: number): string;
