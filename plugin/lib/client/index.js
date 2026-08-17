export const inject = ['slots'];
const API = '/dsh-paper-reading/api';
async function post(path, body) {
    const res = await fetch(`${API}/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
    });
    return res.json();
}
async function getJson(path) {
    const res = await fetch(`${API}/${path}`);
    return res.json();
}
// ═══ 样式工具 ═══════════════════════════════════════════════════════════
const S = {
    root: 'padding:10px 12px;font-family:system-ui,sans-serif;font-size:12.5px;line-height:1.55;color:#1f2937;background:#f8fafc;border-bottom:1px solid #e5e7eb',
    row: 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px',
    label: 'font-weight:600;font-size:12px;color:#334155',
    select: 'flex:1;min-width:120px;padding:3px 6px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;font-size:12px;color:#1f2937',
    input: 'flex:1;min-width:120px;padding:3px 6px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;font-size:12px;color:#1f2937',
    textarea: 'width:100%;box-sizing:border-box;min-height:64px;max-height:180px;resize:vertical;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;font-size:12px;color:#1f2937;font-family:inherit',
    btn: (color, danger = false) => `margin-right:0;padding:3px 9px;border-radius:5px;border:1px solid ${danger ? '#fca5a5' : '#cbd5e1'};background:${danger ? '#fef2f2' : '#fff'};color:${danger ? '#b91c1c' : '#334155'};cursor:pointer;font-size:12px`,
    status: 'font-size:11.5px;color:#64748b;margin-top:4px;min-height:16px;white-space:pre-wrap',
    details: 'margin-top:6px;border:1px solid #e2e8f0;border-radius:6px;background:#fff',
    summary: 'padding:4px 8px;cursor:pointer;font-size:12px;color:#334155;user-select:none',
    pre: 'white-space:pre-wrap;max-height:200px;overflow:auto;background:#fff;border-top:1px solid #e2e8f0;padding:6px 8px;margin:0;font-size:11.5px;color:#334155',
};
function el(tag, style, text) {
    const node = document.createElement(tag);
    node.style.cssText = style;
    if (text !== undefined)
        node.textContent = text;
    return node;
}
export function apply(ctx) {
    ctx.effect(() => ctx.slots.inject('conversation.view', () => ctx.slots.register({
        name: 'conversation.view',
        id: '@dsh-external/dsh-paper-reading-panel',
        label: () => '📄 论文阅读',
        component: () => ({
            render() {
                const root = el('div', S.root);
                const status = el('div', S.status, '加载中…');
                // ── 论文选择行 ──
                const paperSelect = el('select', S.select);
                paperSelect.title = '切换当前论文';
                const refreshBtn = el('button', S.btn(''), '🔄');
                refreshBtn.title = '刷新';
                const newPaperInput = el('input', S.input);
                newPaperInput.placeholder = '新论文标题(回车创建并切换)';
                newPaperInput.title = '输入论文标题后回车:创建并切换';
                const topRow = el('div', S.row);
                topRow.append(el('span', S.label, '📑 论文:'), paperSelect, refreshBtn);
                root.append(topRow);
                root.append(newPaperInput);
                // ── 捕获行 ──
                const textarea = el('textarea', S.textarea);
                textarea.placeholder = '把文献里复制的文字粘贴到这里(可直接 Ctrl+V 粘贴图片),或在这里输入你的问题…';
                root.append(textarea);
                const askInput = el('input', S.input);
                askInput.placeholder = '可选:具体想问什么?(如"解释这句的含义")';
                const askRow = el('div', S.row);
                askRow.append(askInput);
                root.append(askRow);
                const captureBtn = el('button', S.btn(''), '🧹 收藏整理');
                captureBtn.title = '清洗排版并归档到当前论文,不发送给 AI';
                const askBtn = el('button', S.btn('', true), '❓ 提问解释');
                askBtn.title = '归档 + 发送给 AI 解释这段';
                const imageBtn = el('button', S.btn(''), '🖼️ 解读图片');
                imageBtn.title = '选择/粘贴图片 → OCR 归档 + 发送给 AI 解读';
                const imageInput = el('input', 'display:none');
                imageInput.type = 'file';
                imageInput.accept = 'image/*';
                const actionRow = el('div', S.row);
                actionRow.append(captureBtn, askBtn, imageBtn, imageInput);
                root.append(actionRow);
                root.append(status);
                // ── 快速动作 ──
                const quick = [
                    ['📖 总结全文', '请基于论文库归档内容(先 paper_summary scope=current)输出结构化全文总结:研究问题、方法、主要结果、局限与贡献;结尾用 paper_qa 把总结归档。'],
                    ['🔬 逐段精读', '请逐段精读论文库中已归档的内容(先 paper_summary scope=current),对每段给出通俗解释与关键信息,标记不懂处并主动提问。'],
                    ['🌐 翻译', '请将论文库中已归档的英文内容翻译为流畅的中文(先 paper_summary scope=current),术语给出中英对照,公式保留 LaTeX。'],
                    ['∑ 公式讲解', '请找出论文库归档内容中的全部公式(先 paper_summary scope=current),用 LaTeX 逐一写出并解释每个符号含义与推导思路。'],
                    ['🧠 批判性提问', '针对当前论文(先 paper_summary scope=current)提出 5-8 个批判性深挖问题(假设、数据、结论泛化、与相关工作对比等)。'],
                    ['📒 术语表', '提取当前论文归档内容中的术语(先 paper_summary scope=current),给出中文解释并用 paper_glossary add 逐条保存。'],
                    ['📓 今日小结', '请汇总今日阅读(paper_summary scope=today),输出一份读书笔记草稿:每篇论文一句话要点 + 我的疑问;结尾用 paper_qa 归档。'],
                ];
                const quickRow = el('div', S.row);
                quickRow.style.borderTop = '1px solid #e2e8f0';
                quickRow.style.paddingTop = '6px';
                for (const [label, prompt] of quick) {
                    const b = el('button', S.btn(''), label);
                    b.onclick = () => {
                        b.disabled = true;
                        void (async () => {
                            const title = currentTitle();
                            const r = await post('ask', { text: `【论文阅读 · ${label}】论文:${title || '(未选择)'}\n任务:${prompt}` });
                            status.textContent = r?.chatPushed
                                ? `✅ 已发送「${label}」给 AI(请查看对话区)`
                                : '⚠️ 发送失败:未检测到活跃对话,请先在对话区发一条消息再试。';
                        })().finally(() => { b.disabled = false; });
                    };
                    quickRow.append(b);
                }
                root.append(quickRow);
                // ── 笔记抽屉 ──
                const notesPre = el('pre', S.pre, '');
                const figuresPre = el('pre', S.pre, '');
                const glossaryPre = el('pre', S.pre, '');
                const notesDetails = el('details', S.details);
                const figuresDetails = el('details', S.details);
                const glossaryDetails = el('details', S.details);
                notesDetails.append(el('summary', S.summary, '📒 片段与问答(尾部)'), notesPre);
                figuresDetails.append(el('summary', S.summary, '🖼️ 图表转录'), figuresPre);
                glossaryDetails.append(el('summary', S.summary, '🔤 术语表'), glossaryPre);
                root.append(notesDetails, figuresDetails, glossaryDetails);
                let papers = [];
                let currentId = null;
                function currentTitle() {
                    return papers.find(p => p.id === currentId)?.title ?? '';
                }
                function renderPaperSelect() {
                    const selected = currentId;
                    paperSelect.innerHTML = '';
                    const empty = el('option', '', '— 未选择论文 —');
                    empty.value = '';
                    paperSelect.append(empty);
                    for (const p of papers) {
                        const opt = el('option', '', p.title);
                        opt.value = p.id;
                        paperSelect.append(opt);
                    }
                    paperSelect.value = selected ?? '';
                }
                async function refreshStatus() {
                    let s = null;
                    try {
                        s = await getJson('status');
                    }
                    catch {
                        return;
                    }
                    if (!s?.ok)
                        return;
                    papers = s.papers ?? [];
                    currentId = s.current?.id ?? null;
                    renderPaperSelect();
                    status.textContent = `论文库:${papers.length} 篇 · 当前:${s.current?.title ?? '(未选择)'} · 视觉:${s.vision ? '✅' : '❌'} · 对话推送:${s.chatPush ? '✅' : '❌(先在对话区发消息)'}`;
                }
                async function refreshNotes() {
                    let n = null;
                    try {
                        n = await getJson('notes');
                    }
                    catch {
                        return;
                    }
                    if (!n?.ok)
                        return;
                    if (notesDetails.open)
                        notesPre.textContent = n.notes || '（空）';
                    if (figuresDetails.open)
                        figuresPre.textContent = n.figures || `（空 · 已存 ${n.figureCount ?? 0} 张图）`;
                    if (glossaryDetails.open)
                        glossaryPre.textContent = n.glossary || '（空）';
                }
                function setBusy(busy, ...btns) {
                    for (const b of btns)
                        b.disabled = busy;
                }
                function showError(e) {
                    status.textContent = `❌ ${e instanceof Error ? e.message : String(e)}`;
                }
                // ── 事件 ──
                paperSelect.onchange = () => {
                    const id = paperSelect.value;
                    if (!id)
                        return;
                    const p = papers.find(x => x.id === id);
                    if (!p)
                        return;
                    void post('switch', { title: p.title }).then(() => refreshStatus()).catch(showError);
                };
                refreshBtn.onclick = () => { void refreshStatus().catch(showError); };
                newPaperInput.onkeydown = (e) => {
                    if (e.key !== 'Enter')
                        return;
                    const title = newPaperInput.value.trim();
                    if (!title)
                        return;
                    newPaperInput.value = '';
                    void post('switch', { title })
                        .then(() => refreshStatus())
                        .then(() => { status.textContent = `✅ 已切换:${title}`; })
                        .catch(showError);
                };
                captureBtn.onclick = () => {
                    const text = textarea.value;
                    if (!text.trim()) {
                        status.textContent = '⚠️ 先粘贴文字';
                        return;
                    }
                    setBusy(true, captureBtn, askBtn, imageBtn);
                    void post('capture', { text, label: '' })
                        .then(r => {
                        if (!r?.ok)
                            throw new Error(r?.error ?? 'capture failed');
                        status.textContent = `✅ 已归档到《${r.paper?.title}》${r.duplicate ? '(重复内容,未重复保存)' : ''} · 清洗掉 ${r.droppedLines} 行杂项`;
                        void refreshNotes();
                    })
                        .catch(showError)
                        .finally(() => setBusy(false, captureBtn, askBtn, imageBtn));
                };
                askBtn.onclick = () => {
                    const text = textarea.value;
                    if (!text.trim()) {
                        status.textContent = '⚠️ 先粘贴文字';
                        return;
                    }
                    setBusy(true, captureBtn, askBtn, imageBtn);
                    const question = askInput.value.trim() || undefined;
                    void post('capture', { text, label: '', ask: true, question })
                        .then(r => {
                        if (!r?.ok)
                            throw new Error(r?.error ?? 'capture failed');
                        status.textContent = r.chatPushed
                            ? `✅ 已归档并发送给 AI(清洗掉 ${r.droppedLines} 行杂项)`
                            : '⚠️ 已归档,但发送失败:请先在对话区发一条消息激活对话。';
                        textarea.value = '';
                        askInput.value = '';
                        void refreshNotes();
                    })
                        .catch(showError)
                        .finally(() => setBusy(false, captureBtn, askBtn, imageBtn));
                };
                function handleImageFile(file) {
                    if (!file.type.startsWith('image/')) {
                        status.textContent = '⚠️ 仅支持图片文件';
                        return;
                    }
                    setBusy(true, captureBtn, askBtn, imageBtn);
                    const reader = new FileReader();
                    reader.onload = () => {
                        const data = String(reader.result ?? '');
                        const question = askInput.value.trim() || undefined;
                        void post('read-image', { data, ext: `.${file.name.split('.').pop() ?? 'png'}`, ask: true, question })
                            .then(r => {
                            if (!r?.ok)
                                throw new Error(r?.error ?? 'read-image failed');
                            status.textContent = r.chatPushed
                                ? `✅ 图片已 OCR 归档并发送给 AI(${(r.transcript ?? '').length} 字转录)`
                                : '⚠️ 图片已归档,但发送失败:请先在对话区发一条消息激活对话。';
                            void refreshNotes();
                        })
                            .catch(showError)
                            .finally(() => setBusy(false, captureBtn, askBtn, imageBtn));
                    };
                    reader.onerror = () => showError(new Error('图片读取失败'));
                    reader.readAsDataURL(file);
                }
                imageBtn.onclick = () => imageInput.click();
                imageInput.onchange = () => {
                    const file = imageInput.files?.[0];
                    if (file)
                        handleImageFile(file);
                    imageInput.value = '';
                };
                // 在文本框里 Ctrl+V 粘贴图片 → 直接走图片解读
                textarea.addEventListener('paste', (e) => {
                    const file = e.clipboardData?.files?.[0];
                    if (file && file.type.startsWith('image/')) {
                        e.preventDefault();
                        handleImageFile(file);
                    }
                });
                // ── 轮询 ──
                const timer = window.setInterval(() => {
                    void refreshStatus().catch(() => { });
                    void refreshNotes().catch(() => { });
                }, 5000);
                ctx.effect(() => () => {
                    window.clearInterval(timer);
                }, 'paper-reading: panel cleanup');
                void refreshStatus().catch(() => { status.textContent = '⚠️ 后端 API 不可达(插件未注入?)'; });
                return root;
            },
        }),
    })), '@dsh-external/dsh-paper-reading: panel');
}
//# sourceMappingURL=index.js.map