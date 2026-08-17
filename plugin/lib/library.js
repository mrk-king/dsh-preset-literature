/**
 * Paper library store: per-paper markdown notes on disk.
 *
 * Layout:
 *   <libraryRoot>/
 *     index.json          # { current, papers: [{id,title,createdAt,updatedAt}] }
 *     papers/<id>/
 *       meta.json         # { id, title, createdAt, updatedAt, captures: [{hash,ts,label}] }
 *       notes.md          # captured snippets + Q&A, chronological
 *       figures.md        # figure transcripts
 *       glossary.md       # - **term** — explanation
 *       figures/          # saved image files
 *       paper.pdf         # attached original PDF (served to the browser)
 *       paper.txt         # pdftotext extraction of paper.pdf
 */
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync, } from 'node:fs';
import { basename, join } from 'node:path';
/** 拖入对话自动归档论文的默认归属文件夹。 */
export const DEFAULT_FOLDER = { id: 'default', name: '默认', createdAt: '' };
export function slugify(title) {
    const base = title.toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'paper';
    const hash = createHash('sha1').update(title).digest('hex').slice(0, 6);
    return `${base}-${hash}`;
}
export function paperId(title) {
    return slugify(title.trim());
}
function readIndex(root) {
    const file = join(root, 'index.json');
    if (!existsSync(file)) {
        return { current: null, papers: [], folders: [] };
    }
    try {
        const raw = JSON.parse(readFileSync(file, 'utf8'));
        const papers = Array.isArray(raw?.papers)
            ? raw.papers.map((p) => ({
                ...p,
                // 迁移:旧的单一 folder 字段 → folders 数组
                folders: Array.isArray(p.folders)
                    ? p.folders
                    : (typeof p.folder === 'string' && p.folder ? [p.folder] : []),
            }))
            : [];
        const folders = Array.isArray(raw?.folders) ? [...raw.folders] : [];
        return {
            current: typeof raw?.current === 'string' ? raw.current : null,
            papers,
            folders,
        };
    }
    catch {
        return { current: null, papers: [], folders: [] };
    }
}
function writeIndex(root, index) {
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
}
function readMeta(root, id) {
    const file = join(root, 'papers', id, 'meta.json');
    if (!existsSync(file))
        return undefined;
    try {
        return JSON.parse(readFileSync(file, 'utf8'));
    }
    catch {
        return undefined;
    }
}
function writeMeta(root, meta) {
    mkdirSync(join(root, 'papers', meta.id), { recursive: true });
    writeFileSync(join(root, 'papers', meta.id, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');
}
export function ensureLibrary(root) {
    mkdirSync(join(root, 'papers'), { recursive: true });
    const index = readIndex(root);
    // Drop stale entries whose dir vanished; keep the rest.
    const alive = index.papers.filter(p => existsSync(join(root, 'papers', p.id)));
    if (alive.length !== index.papers.length) {
        writeIndex(root, { ...index, papers: alive });
        return { ...index, papers: alive };
    }
    return index;
}
export function listPapers(root) {
    const index = ensureLibrary(root);
    return { index, papers: index.papers };
}
/** Switch to an existing paper by exact id or title match; create when missing. */
export function switchPaper(root, title) {
    const index = ensureLibrary(root);
    const wanted = title.trim();
    const existing = index.papers.find(p => p.id === wanted || p.title.toLowerCase() === wanted.toLowerCase());
    let paper;
    let created = false;
    if (existing) {
        paper = existing;
    }
    else {
        const id = paperId(wanted);
        const now = new Date().toISOString();
        paper = { id, title: wanted, createdAt: now, updatedAt: now, folders: [] };
        writeMeta(root, { ...paper, captures: [] });
        index.papers.unshift(paper);
        created = true;
    }
    writeIndex(root, { ...index, current: paper.id });
    return { paper, created };
}
export function listFolders(root) {
    return ensureLibrary(root).folders;
}
/** 创建文件夹(同名已存在则直接返回);id 由名称生成。 */
export function createFolder(root, name) {
    const index = ensureLibrary(root);
    const wanted = name.trim();
    if (!wanted)
        throw new Error('folder name required');
    const existing = index.folders.find(f => f.name === wanted);
    if (existing)
        return existing;
    const folder = { id: paperId(wanted), name: wanted, createdAt: new Date().toISOString() };
    index.folders.push(folder);
    writeIndex(root, index);
    return folder;
}
/** 删除文件夹(拥有它的论文从该文件夹移出,其余文件夹保留)。 */
export function removeFolder(root, id) {
    const index = ensureLibrary(root);
    index.folders = index.folders.filter(f => f.id !== id);
    for (const p of index.papers) {
        if (Array.isArray(p.folders) && p.folders.includes(id)) {
            p.folders = p.folders.filter(f => f !== id);
        }
    }
    writeIndex(root, index);
}
/** 重命名文件夹:只改名称,id 不变(论文归属稳定)。 */
export function renameFolder(root, id, newName) {
    const index = ensureLibrary(root);
    const folder = index.folders.find(f => f.id === id);
    if (!folder)
        return null;
    const wanted = newName.trim();
    if (!wanted)
        throw new Error('folder name required');
    if (index.folders.some(f => f.id !== id && f.name === wanted)) {
        throw new Error(`已存在同名文件夹:《${wanted}》`);
    }
    folder.name = wanted;
    writeIndex(root, index);
    return folder;
}
/** 设置论文的完整文件夹归属列表(空数组 = 未分类)。 */
export function setPaperFolders(root, id, folderIds) {
    const index = ensureLibrary(root);
    const paper = index.papers.find(p => p.id === id);
    if (!paper)
        return;
    paper.folders = [...new Set(folderIds.filter(Boolean))];
    writeIndex(root, index);
}
/** 重命名论文:只改标题与 meta,保持 id 不变(笔记/PDF/引用稳定)。 */
export function renamePaper(root, id, newTitle) {
    const index = ensureLibrary(root);
    const paper = index.papers.find(p => p.id === id);
    if (!paper)
        return null;
    const wanted = newTitle.trim();
    if (!wanted)
        throw new Error('title required');
    if (index.papers.some(p => p.id !== id && p.title.toLowerCase() === wanted.toLowerCase())) {
        throw new Error(`已存在同名论文:《${wanted}》`);
    }
    paper.title = wanted;
    const meta = readMeta(root, id);
    if (meta) {
        meta.title = wanted;
        writeMeta(root, meta);
    }
    writeIndex(root, index);
    return paper;
}
/** 删除论文:移入回收站(<root>/trash/<id>-<ts>),30 天后自动清除,防误删/意外丢失。 */
export function removePaper(root, id) {
    const index = ensureLibrary(root);
    const target = index.papers.find(p => p.id === id);
    if (!target)
        return null;
    const trashDir = join(root, 'trash');
    mkdirSync(trashDir, { recursive: true });
    const dest = join(trashDir, `${id}-${Date.now()}`);
    renameSync(paperDir(root, id), dest);
    const alive = index.papers.filter(p => p.id !== id);
    let current = index.current;
    if (current === id)
        current = alive[0]?.id ?? null;
    writeIndex(root, { ...index, current, papers: alive });
    return target;
}
/** 清理超过 maxAgeMs 的回收站内容,返回清理条数。 */
export function purgeTrash(root, maxAgeMs = 30 * 24 * 3600 * 1000) {
    const trashDir = join(root, 'trash');
    if (!existsSync(trashDir))
        return 0;
    let removed = 0;
    const now = Date.now();
    for (const entry of readdirSync(trashDir)) {
        const m = /-(\d+)$/.exec(entry);
        const ts = m ? Number(m[1]) : 0;
        if (ts > 0 && now - ts > maxAgeMs) {
            rmSync(join(trashDir, entry), { recursive: true, force: true });
            removed += 1;
        }
    }
    return removed;
}
/** 回收站内待清理的论文数量。 */
export function trashCount(root) {
    const trashDir = join(root, 'trash');
    if (!existsSync(trashDir))
        return 0;
    return readdirSync(trashDir).filter(e => /-\d+$/.test(e)).length;
}
export function currentPaper(root) {
    const index = ensureLibrary(root);
    if (!index.current)
        return null;
    return index.papers.find(p => p.id === index.current) ?? null;
}
export function touchPaper(root, id) {
    const index = ensureLibrary(root);
    const found = index.papers.find(p => p.id === id);
    if (!found)
        return;
    found.updatedAt = new Date().toISOString();
    const meta = readMeta(root, id);
    if (meta) {
        meta.updatedAt = found.updatedAt;
        writeMeta(root, meta);
    }
    writeIndex(root, { ...index, current: id });
}
export function paperDir(root, id) {
    return join(root, 'papers', id);
}
/** Append a raw block to notes.md (caller pre-formats). */
export function appendNote(root, id, block) {
    const dir = paperDir(root, id);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'notes.md');
    appendFileSync(file, `\n${block.trim()}\n`, 'utf8');
    touchPaper(root, id);
    return file;
}
export function appendFigure(root, id, block) {
    const dir = paperDir(root, id);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'figures.md');
    appendFileSync(file, `\n${block.trim()}\n`, 'utf8');
    touchPaper(root, id);
    return file;
}
export function appendGlossary(root, id, term, explanation) {
    const dir = paperDir(root, id);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'glossary.md');
    const line = `- **${term.trim()}** — ${explanation.trim()}`;
    if (existsSync(file) && readFileSync(file, 'utf8').includes(`**${term.trim()}**`)) {
        return file; // already present; no duplicate
    }
    appendFileSync(file, `${line}\n`, 'utf8');
    touchPaper(root, id);
    return file;
}
export function readTail(file, maxChars) {
    if (!existsSync(file))
        return '';
    const text = readFileSync(file, 'utf8');
    return text.length <= maxChars ? text : `…（前略）\n${text.slice(-maxChars)}`;
}
export function readGlossary(root, id) {
    const file = join(paperDir(root, id), 'glossary.md');
    return existsSync(file) ? readFileSync(file, 'utf8') : '';
}
export function listGlossary(root, id) {
    const raw = readGlossary(root, id);
    const out = [];
    for (const line of raw.split('\n')) {
        const m = line.match(/^\s*-\s*\*\*(.+?)\*\*\s*[—-]\s*(.+)$/);
        if (m)
            out.push({ term: m[1].trim(), explanation: m[2].trim() });
    }
    return out;
}
export function captureHash(text) {
    return createHash('sha1').update(text).digest('hex');
}
export function rememberCapture(root, id, hash, label) {
    const meta = readMeta(root, id) ?? {
        id, title: id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), captures: [],
    };
    if (meta.captures.some(c => c.hash === hash))
        return false;
    meta.captures.push({ hash, ts: new Date().toISOString(), label });
    if (meta.captures.length > 1000)
        meta.captures = meta.captures.slice(-1000);
    writeMeta(root, meta);
    return true;
}
export function isDuplicate(root, id, hash) {
    const meta = readMeta(root, id);
    return meta?.captures.some(c => c.hash === hash) ?? false;
}
export function readPaperNotes(root, id) {
    const dir = paperDir(root, id);
    return {
        notes: readTail(join(dir, 'notes.md'), 20000),
        figures: readTail(join(dir, 'figures.md'), 12000),
    };
}
/** Count figures saved under the paper's figures/ dir. */
export function figureCount(root, id) {
    const dir = join(paperDir(root, id), 'figures');
    if (!existsSync(dir))
        return 0;
    let n = 0;
    try {
        for (const entry of readdirSafe(dir)) {
            if (/\.(png|jpe?g|webp|gif|heic|heif)$/i.test(entry))
                n += 1;
        }
    }
    catch { /* ignore */ }
    return n;
}
function readdirSafe(dir) {
    return readdirSync(dir, { withFileTypes: true }).map(d => d.name);
}
/** Collect snippets for the current day (from `## 📌 片段 [YYYY-MM-DD` headers). */
export function todaysEntries(root, today) {
    const index = ensureLibrary(root);
    const out = [];
    for (const p of index.papers) {
        const file = join(paperDir(root, p.id), 'notes.md');
        if (!existsSync(file))
            continue;
        const text = readFileSync(file, 'utf8');
        const parts = text.split(/\n## /);
        for (const part of parts) {
            if (part.startsWith(`📌 片段 [${today}`) || part.startsWith(`💬 Q&A [${today}`)) {
                out.push({ title: p.title, entry: `## ${part.slice(0, 4000)}` });
            }
        }
    }
    return out;
}
/** Search every paper's notes for a query; returns capped matches. */
export function findInLibrary(root, query, maxResults = 12) {
    const index = ensureLibrary(root);
    const q = query.toLowerCase();
    const out = [];
    for (const p of index.papers) {
        const file = join(paperDir(root, p.id), 'notes.md');
        if (!existsSync(file))
            continue;
        const lines = readFileSync(file, 'utf8').split('\n');
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i];
            if (line.toLowerCase().includes(q)) {
                out.push({ paper: p.title, match: line.trim().slice(0, 300) });
                if (out.length >= maxResults)
                    return out;
            }
        }
    }
    return out;
}
export function nowStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function newSnippetId() {
    return randomUUID().slice(0, 8);
}
function runPdfTool(bin, args, timeoutMs = 60_000) {
    try {
        return execFileSync(bin, args, { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
    }
    catch (e) {
        const stderr = e?.stderr ? String(e.stderr).slice(0, 300) : String(e?.message ?? e).slice(0, 300);
        throw new Error(`PDF tool "${bin}" failed: ${stderr}`);
    }
}
/** Extract PDF metadata via `pdfinfo` (best-effort; missing fields → defaults). */
/** 从 PDF 元信息/文件名推导默认论文标题。 */
export function titleFromPdf(srcPath) {
    const info = parsePdfInfo(srcPath);
    return (info.title?.trim() || basename(srcPath).replace(/\.pdf$/i, '')).trim() || '未命名论文';
}
function parsePdfInfo(srcPath) {
    try {
        const out = runPdfTool('pdfinfo', [srcPath]);
        const title = /^Title:\s*(.+)$/m.exec(out)?.[1]?.trim();
        const pages = /^Pages:\s*(\d+)/m.exec(out)?.[1];
        const bytes = /^File size:\s*(\d+)/m.exec(out)?.[1];
        return {
            title: title && title.length > 0 && title.toLowerCase() !== 'untitled' ? title : undefined,
            pages: pages ? Number(pages) : undefined,
            bytes: bytes ? Number(bytes) : undefined,
        };
    }
    catch {
        return {};
    }
}
/**
 * Attach a PDF to a paper: copy it to papers/<id>/paper.pdf and extract the
 * full text to paper.txt via pdftotext. Returns the metadata. The title
 * resolution order: caller-provided title > pdfinfo Title > file name.
 */
export function attachPdf(root, id, srcPath, callerTitle) {
    const dir = paperDir(root, id);
    mkdirSync(dir, { recursive: true });
    const pdfPath = join(dir, 'paper.pdf');
    const textPath = join(dir, 'paper.txt');
    copyFileSync(srcPath, pdfPath);
    const info = parsePdfInfo(srcPath);
    const title = (callerTitle?.trim() || info.title || basename(srcPath).replace(/\.pdf$/i, '')).trim();
    try {
        runPdfTool('pdftotext', [srcPath, textPath]);
    }
    catch {
        // pdftotext failure: leave paper.txt absent; the PDF itself still works
    }
    const meta = readMeta(root, id) ?? {
        id, title, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), captures: [],
    };
    const pdf = {
        title,
        pages: info.pages ?? 0,
        bytes: info.bytes ?? (existsSync(pdfPath) ? readFileSync(pdfPath).length : 0),
        extractedAt: new Date().toISOString(),
    };
    meta.pdf = pdf;
    if (meta.title === id || meta.title === '')
        meta.title = title;
    writeMeta(root, meta);
    // 拖入对话自动归档的论文:未归入任何文件夹时,进入「默认」文件夹(若存在;
    // 用户删掉后不再自动重建,新建一个叫「默认」的文件夹即可恢复该行为)
    const summary = ensureLibrary(root).papers.find(p => p.id === id);
    if (summary && (!Array.isArray(summary.folders) || summary.folders.length === 0)) {
        const idx = ensureLibrary(root);
        const def = idx.folders.find(f => f.id === DEFAULT_FOLDER.id) ?? idx.folders.find(f => f.name === '默认');
        if (def)
            setPaperFolders(root, id, [def.id]);
    }
    touchPaper(root, id);
    return { pdfPath, textPath: existsSync(textPath) ? textPath : '', ...pdf };
}
/** PDF metadata persisted in meta.json, or null. */
export function pdfMetaOf(root, id) {
    return readMeta(root, id)?.pdf ?? null;
}
/** Absolute path of the attached PDF for a paper, or null. */
export function pdfPathOf(root, id) {
    const p = join(paperDir(root, id), 'paper.pdf');
    return existsSync(p) ? p : null;
}
/** Extracted PDF text (paper.txt), or '' when absent. */
export function pdfTextOf(root, id, maxChars = 40000) {
    const p = join(paperDir(root, id), 'paper.txt');
    if (!existsSync(p))
        return '';
    const text = readFileSync(p, 'utf8');
    return text.length <= maxChars ? text : text.slice(0, maxChars);
}
//# sourceMappingURL=library.js.map