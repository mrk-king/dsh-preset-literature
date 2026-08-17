export interface PaperMeta {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    captures: Array<{
        hash: string;
        ts: string;
        label?: string;
    }>;
    pdf?: {
        title: string;
        pages: number;
        bytes: number;
        extractedAt: string;
    };
}
export interface PaperSummary {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    /** 所属文件夹 id 列表(虚拟收藏集:一篇论文可属于多个文件夹;空数组 = 未分类)。 */
    folders?: string[] | null;
}
export interface FolderSummary {
    id: string;
    name: string;
    createdAt: string;
}
export interface LibraryIndex {
    current: string | null;
    papers: PaperSummary[];
    folders: FolderSummary[];
}
/** 拖入对话自动归档论文的默认归属文件夹。 */
export declare const DEFAULT_FOLDER: FolderSummary;
export declare function slugify(title: string): string;
export declare function paperId(title: string): string;
export declare function ensureLibrary(root: string): LibraryIndex;
export declare function listPapers(root: string): {
    index: LibraryIndex;
    papers: PaperSummary[];
};
/** Switch to an existing paper by exact id or title match; create when missing. */
export declare function switchPaper(root: string, title: string): {
    paper: PaperSummary;
    created: boolean;
};
export declare function listFolders(root: string): FolderSummary[];
/** 创建文件夹(同名已存在则直接返回);id 由名称生成。 */
export declare function createFolder(root: string, name: string): FolderSummary;
/** 删除文件夹(拥有它的论文从该文件夹移出,其余文件夹保留)。 */
export declare function removeFolder(root: string, id: string): void;
/** 重命名文件夹:只改名称,id 不变(论文归属稳定)。 */
export declare function renameFolder(root: string, id: string, newName: string): FolderSummary | null;
/** 设置论文的完整文件夹归属列表(空数组 = 未分类)。 */
export declare function setPaperFolders(root: string, id: string, folderIds: string[]): void;
/** 重命名论文:只改标题与 meta,保持 id 不变(笔记/PDF/引用稳定)。 */
export declare function renamePaper(root: string, id: string, newTitle: string): PaperSummary | null;
/** 删除论文:移入回收站(<root>/trash/<id>-<ts>),30 天后自动清除,防误删/意外丢失。 */
export declare function removePaper(root: string, id: string): PaperSummary | null;
/** 清理超过 maxAgeMs 的回收站内容,返回清理条数。 */
export declare function purgeTrash(root: string, maxAgeMs?: number): number;
/** 回收站内待清理的论文数量。 */
export declare function trashCount(root: string): number;
export declare function currentPaper(root: string): PaperSummary | null;
export declare function touchPaper(root: string, id: string): void;
export declare function paperDir(root: string, id: string): string;
/** Append a raw block to notes.md (caller pre-formats). */
export declare function appendNote(root: string, id: string, block: string): string;
export declare function appendFigure(root: string, id: string, block: string): string;
export declare function appendGlossary(root: string, id: string, term: string, explanation: string): string;
export declare function readTail(file: string, maxChars: number): string;
export declare function readGlossary(root: string, id: string): string;
export declare function listGlossary(root: string, id: string): Array<{
    term: string;
    explanation: string;
}>;
export declare function captureHash(text: string): string;
export declare function rememberCapture(root: string, id: string, hash: string, label?: string): boolean;
export declare function isDuplicate(root: string, id: string, hash: string): boolean;
export declare function readPaperNotes(root: string, id: string): {
    notes: string;
    figures: string;
};
/** Count figures saved under the paper's figures/ dir. */
export declare function figureCount(root: string, id: string): number;
/** Collect snippets for the current day (from `## 📌 片段 [YYYY-MM-DD` headers). */
export declare function todaysEntries(root: string, today: string): Array<{
    title: string;
    entry: string;
}>;
/** Search every paper's notes for a query; returns capped matches. */
export declare function findInLibrary(root: string, query: string, maxResults?: number): Array<{
    paper: string;
    match: string;
}>;
export declare function nowStamp(): string;
export declare function newSnippetId(): string;
export interface PdfMeta {
    pdfPath: string;
    textPath: string;
    title: string;
    pages: number;
    bytes: number;
    extractedAt: string;
}
/** Extract PDF metadata via `pdfinfo` (best-effort; missing fields → defaults). */
/** 从 PDF 元信息/文件名推导默认论文标题。 */
export declare function titleFromPdf(srcPath: string): string;
/**
 * Attach a PDF to a paper: copy it to papers/<id>/paper.pdf and extract the
 * full text to paper.txt via pdftotext. Returns the metadata. The title
 * resolution order: caller-provided title > pdfinfo Title > file name.
 */
export declare function attachPdf(root: string, id: string, srcPath: string, callerTitle?: string): PdfMeta;
/** PDF metadata persisted in meta.json, or null. */
export declare function pdfMetaOf(root: string, id: string): PaperMeta['pdf'] | null;
/** Absolute path of the attached PDF for a paper, or null. */
export declare function pdfPathOf(root: string, id: string): string | null;
/** Extracted PDF text (paper.txt), or '' when absent. */
export declare function pdfTextOf(root: string, id: string, maxChars?: number): string;
