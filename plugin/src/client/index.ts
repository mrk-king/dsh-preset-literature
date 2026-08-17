/**
 * @dsh-external/dsh-paper-reading — client 面板（conversation.view slot）。
 *
 * 阅读文献时把文字/图片"喂"给 harness:
 *  - 文本框粘贴 PDF 复制出来的乱排版文字 → 「收藏整理」清洗归档 / 「提问解释」归档并发送给 AI;
 *  - 直接在文本框 Ctrl+V 粘贴图片 → 自动走「解读图片」;
 *  - 快速动作:总结/精读/翻译/公式/批判提问/术语表/今日小结(推送给 AI 执行);
 *  - 笔记抽屉:查看当前论文的片段/问答、图表转录与术语表。
 *
 * 构建: npm run build:client(tsdown,产物 lib/client.js,ModuleLoader.load 注册)。
 */
import type { SlotsService } from '@deepseek-ai/dsh-client-ui-slots'

type ClientContext = {
  slots: SlotsService
  sessions?: { current?: string | null }
}

export const inject = ['slots', 'sessions']

const API = '/dsh-paper-reading/api'

interface PaperSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

async function post(path: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${API}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  return res.json()
}

async function getJson(path: string): Promise<any> {
  const res = await fetch(`${API}/${path}`)
  return res.json()
}

// ═══ 样式工具 ═══════════════════════════════════════════════════════════
const S = {
  root: 'padding:10px 12px;font-family:system-ui,sans-serif;font-size:12.5px;line-height:1.55;color:#1f2937;background:#f8fafc;border-bottom:1px solid #e5e7eb',
  row: 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px',
  label: 'font-weight:600;font-size:12px;color:#334155',
  select: 'flex:1;min-width:120px;padding:3px 6px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;font-size:12px;color:#1f2937',
  input: 'flex:1;min-width:120px;padding:3px 6px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;font-size:12px;color:#1f2937',
  textarea: 'width:100%;box-sizing:border-box;min-height:64px;max-height:180px;resize:vertical;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;font-size:12px;color:#1f2937;font-family:inherit',
  btn: (color: string, danger = false) => `margin-right:0;padding:3px 9px;border-radius:5px;border:1px solid ${danger ? '#fca5a5' : '#cbd5e1'};background:${danger ? '#fef2f2' : '#fff'};color:${danger ? '#b91c1c' : '#334155'};cursor:pointer;font-size:12px`,
  status: 'font-size:11.5px;color:#64748b;margin-top:4px;min-height:16px;white-space:pre-wrap',
  details: 'margin-top:6px;border:1px solid #e2e8f0;border-radius:6px;background:#fff',
  summary: 'padding:4px 8px;cursor:pointer;font-size:12px;color:#334155;user-select:none',
  pre: 'white-space:pre-wrap;max-height:200px;overflow:auto;background:#fff;border-top:1px solid #e2e8f0;padding:6px 8px;margin:0;font-size:11.5px;color:#334155',
}

const TAB_ON = 'flex:1;padding:3px 0;border:1px solid #94a3b8;border-radius:5px;background:#e2e8f0;color:#0f172a;cursor:pointer;font-size:12px;font-weight:600'
const TAB_OFF = 'flex:1;padding:3px 0;border:1px solid #e2e8f0;border-radius:5px;background:#fff;color:#64748b;cursor:pointer;font-size:12px'

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '?'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, style: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.style.cssText = style
  if (text !== undefined) node.textContent = text
  return node
}

// ── 悬停提示(hover tooltip)───────────────────────────────────────────
const LIST_ITEM = 'display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;cursor:pointer;font-size:12.5px;color:#334155;user-select:none'
const HINT_STYLE = [
  'position:fixed;z-index:2147483999;pointer-events:none;',
  'max-width:310px;padding:8px 10px;border-radius:8px;',
  'background:#1f2937;color:#f8fafc;font-size:12px;line-height:1.5;',
  'white-space:pre-wrap;box-shadow:0 6px 20px rgba(15,23,42,.35);',
  'border:1px solid #334155;',
].join('')

/** 鼠标悬停元素时显示用法提示气泡(自动避让视口边缘,移开即消失)。 */
function attachHint(target: HTMLElement, text: string): void {
  let tip: HTMLDivElement | null = null
  const show = () => {
    if (tip) return
    tip = el('div', HINT_STYLE, text)
    document.body.append(tip)
    const rect = target.getBoundingClientRect()
    const tw = tip.offsetWidth, th = tip.offsetHeight
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - tw / 2, window.innerWidth - tw - 8))
    let top = rect.top - th - 8
    if (top < 8) top = rect.bottom + 8
    tip.style.left = `${left}px`
    tip.style.top = `${top}px`
  }
  const hide = () => {
    tip?.remove()
    tip = null
  }
  target.addEventListener('mouseenter', show)
  target.addEventListener('mouseleave', hide)
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.slots.inject('conversation.view', () =>
    ctx.slots.register({
      name: 'conversation.view',
      id: '@dsh-external/dsh-paper-reading-panel',
      label: () => '📄 论文阅读',
      component: () => ({
        render() {
          const root = el('div', S.root)
          const status = el('div', S.status, '加载中…')

          // ── 论文选择行 ──
          const paperSelect = el('select', S.select)
          paperSelect.title = '切换当前论文'
          const refreshBtn = el('button', S.btn(''), '🔄')
          refreshBtn.title = '刷新'
          const newPaperInput = el('input', S.input)
          newPaperInput.placeholder = '新论文标题(回车创建并切换)'
          newPaperInput.title = '输入论文标题后回车:创建并切换'
          const topRow = el('div', S.row)
          topRow.append(el('span', S.label, '📑 论文:'), paperSelect, refreshBtn)
          root.append(topRow)
          root.append(newPaperInput)

          // ── 捕获行 ──
          const textarea = el('textarea', S.textarea)
          textarea.placeholder = '把文献里复制的文字粘贴到这里(可直接 Ctrl+V 粘贴图片),或在这里输入你的问题…'
          root.append(textarea)
          const askInput = el('input', S.input)
          askInput.placeholder = '可选:具体想问什么?(如"解释这句的含义")'
          const askRow = el('div', S.row)
          askRow.append(askInput)
          root.append(askRow)

          const captureBtn = el('button', S.btn(''), '🧹 收藏整理')
          captureBtn.title = '清洗排版并归档到当前论文,不发送给 AI'
          const askBtn = el('button', S.btn('', true), '❓ 提问解释')
          askBtn.title = '归档 + 发送给 AI 解释这段'
          const imageBtn = el('button', S.btn(''), '🖼️ 解读图片')
          imageBtn.title = '选择/粘贴图片 → OCR 归档 + 发送给 AI 解读'
          const imageInput = el('input', 'display:none')
          imageInput.type = 'file'
          imageInput.accept = 'image/*'
          const actionRow = el('div', S.row)
          actionRow.append(captureBtn, askBtn, imageBtn, imageInput)
          root.append(actionRow)
          root.append(status)

          // ── 快速动作 ──
          const quick: Array<[string, string]> = [
            ['📖 总结全文', '请基于论文库归档内容(先 paper_summary scope=current)输出结构化全文总结:研究问题、方法、主要结果、局限与贡献;结尾用 paper_qa 把总结归档。'],
            ['🔬 逐段精读', '请逐段精读论文库中已归档的内容(先 paper_summary scope=current),对每段给出通俗解释与关键信息,标记不懂处并主动提问。'],
            ['🌐 翻译', '请将论文库中已归档的英文内容翻译为流畅的中文(先 paper_summary scope=current),术语给出中英对照,公式保留 LaTeX。'],
            ['∑ 公式讲解', '请找出论文库归档内容中的全部公式(先 paper_summary scope=current),用 LaTeX 逐一写出并解释每个符号含义与推导思路。'],
            ['🧠 批判性提问', '针对当前论文(先 paper_summary scope=current)提出 5-8 个批判性深挖问题(假设、数据、结论泛化、与相关工作对比等)。'],
            ['📒 术语表', '提取当前论文归档内容中的术语(先 paper_summary scope=current),给出中文解释并用 paper_glossary add 逐条保存。'],
            ['📓 今日小结', '请汇总今日阅读(paper_summary scope=today),输出一份读书笔记草稿:每篇论文一句话要点 + 我的疑问;结尾用 paper_qa 归档。'],
          ]
          const quickRow = el('div', S.row)
          quickRow.style.borderTop = '1px solid #e2e8f0'
          quickRow.style.paddingTop = '6px'
          for (const [label, prompt] of quick) {
            const b = el('button', S.btn(''), label)
            b.onclick = () => {
              b.disabled = true
              void (async () => {
                const title = currentTitle()
                const r = await post('ask', { text: `【论文阅读 · ${label}】论文:${title || '(未选择)'}\n任务:${prompt}` })
                status.textContent = r?.chatPushed
                  ? `✅ 已发送「${label}」给 AI(请查看对话区)`
                  : '⚠️ 发送失败:未检测到活跃对话,请先在对话区发一条消息再试。'
              })().finally(() => { b.disabled = false })
            }
            quickRow.append(b)
          }
          root.append(quickRow)

          // ── 笔记抽屉 ──
          const notesPre = el('pre', S.pre, '')
          const figuresPre = el('pre', S.pre, '')
          const glossaryPre = el('pre', S.pre, '')
          const notesDetails = el('details', S.details)
          const figuresDetails = el('details', S.details)
          const glossaryDetails = el('details', S.details)
          notesDetails.append(el('summary', S.summary, '📒 片段与问答(尾部)'), notesPre)
          figuresDetails.append(el('summary', S.summary, '🖼️ 图表转录'), figuresPre)
          glossaryDetails.append(el('summary', S.summary, '🔤 术语表'), glossaryPre)
          root.append(notesDetails, figuresDetails, glossaryDetails)

          let papers: PaperSummary[] = []
          let currentId: string | null = null

          function currentTitle(): string {
            return papers.find(p => p.id === currentId)?.title ?? ''
          }

          function renderPaperSelect(): void {
            const selected = currentId
            paperSelect.innerHTML = ''
            const empty = el('option', '', '— 未选择论文 —')
            empty.value = ''
            paperSelect.append(empty)
            for (const p of papers) {
              const opt = el('option', '', p.title)
              opt.value = p.id
              paperSelect.append(opt)
            }
            paperSelect.value = selected ?? ''
          }

          async function refreshStatus(): Promise<void> {
            let s: any = null
            try { s = await getJson('status') } catch { return }
            if (!s?.ok) return
            papers = s.papers ?? []
            currentId = s.current?.id ?? null
            renderPaperSelect()
            const visionLabel = s.visionMode === 'model' || s.modelVision
              ? '模型识图'
              : (s.vision ? 'ModLens' : '❌')
            status.textContent = `论文库:${papers.length} 篇 · 当前:${s.current?.title ?? '(未选择)'} · 识图:${visionLabel} · 对话推送:${s.chatPush ? '✅' : '❌(先在对话区发消息)'}`
          }

          async function refreshNotes(): Promise<void> {
            let n: any = null
            try { n = await getJson('notes') } catch { return }
            if (!n?.ok) return
            if (notesDetails.open) notesPre.textContent = n.notes || '（空）'
            if (figuresDetails.open) figuresPre.textContent = n.figures || `（空 · 已存 ${n.figureCount ?? 0} 张图）`
            if (glossaryDetails.open) glossaryPre.textContent = n.glossary || '（空）'
          }

          function setBusy(busy: boolean, ...btns: HTMLElement[]): void {
            for (const b of btns) (b as HTMLButtonElement).disabled = busy
          }

          function showError(e: unknown): void {
            status.textContent = `❌ ${e instanceof Error ? e.message : String(e)}`
          }

          // ── 事件 ──
          paperSelect.onchange = () => {
            const id = paperSelect.value
            if (!id) return
            const p = papers.find(x => x.id === id)
            if (!p) return
            void post('switch', { title: p.title }).then(() => refreshStatus()).catch(showError)
          }
          refreshBtn.onclick = () => { void refreshStatus().catch(showError) }
          newPaperInput.onkeydown = (e) => {
            if (e.key !== 'Enter') return
            const title = newPaperInput.value.trim()
            if (!title) return
            newPaperInput.value = ''
            void post('switch', { title })
              .then(() => refreshStatus())
              .then(() => { status.textContent = `✅ 已切换:${title}` })
              .catch(showError)
          }

          captureBtn.onclick = () => {
            const text = textarea.value
            if (!text.trim()) { status.textContent = '⚠️ 先粘贴文字'; return }
            setBusy(true, captureBtn, askBtn, imageBtn)
            void post('capture', { text, label: '' })
              .then(r => {
                if (!r?.ok) throw new Error(r?.error ?? 'capture failed')
                status.textContent = `✅ 已归档到《${r.paper?.title}》${r.duplicate ? '(重复内容,未重复保存)' : ''} · 清洗掉 ${r.droppedLines} 行杂项`
                void refreshNotes()
              })
              .catch(showError)
              .finally(() => setBusy(false, captureBtn, askBtn, imageBtn))
          }

          askBtn.onclick = () => {
            const text = textarea.value
            if (!text.trim()) { status.textContent = '⚠️ 先粘贴文字'; return }
            setBusy(true, captureBtn, askBtn, imageBtn)
            const question = askInput.value.trim() || undefined
            void post('capture', { text, label: '', ask: true, question })
              .then(r => {
                if (!r?.ok) throw new Error(r?.error ?? 'capture failed')
                status.textContent = r.chatPushed
                  ? `✅ 已归档并发送给 AI(清洗掉 ${r.droppedLines} 行杂项)`
                  : '⚠️ 已归档,但发送失败:请先在对话区发一条消息激活对话。'
                textarea.value = ''
                askInput.value = ''
                void refreshNotes()
              })
              .catch(showError)
              .finally(() => setBusy(false, captureBtn, askBtn, imageBtn))
          }

          function handleImageFile(file: File): void {
            if (!file.type.startsWith('image/')) { status.textContent = '⚠️ 仅支持图片文件'; return }
            setBusy(true, captureBtn, askBtn, imageBtn)
            const reader = new FileReader()
            reader.onload = () => {
              const data = String(reader.result ?? '')
              const question = askInput.value.trim() || undefined
              void post('read-image', { data, ext: `.${file.name.split('.').pop() ?? 'png'}`, ask: true, question })
                .then(r => {
                  if (!r?.ok) throw new Error(r?.error ?? 'read-image failed')
                  status.textContent = r.mode === 'model'
                    ? (r.chatPushed
                        ? '✅ 图片已归档并直接发送给模型识图(无需 ModLens),回复见对话区'
                        : '⚠️ 图片已归档,但发送失败:请先在对话区发一条消息激活对话。')
                    : (r.chatPushed
                        ? `✅ 图片已 OCR 归档并发送给 AI(${(r.transcript ?? '').length} 字转录)`
                        : '⚠️ 图片已归档,但发送失败:请先在对话区发一条消息激活对话。')
                  void refreshNotes()
                })
                .catch(showError)
                .finally(() => setBusy(false, captureBtn, askBtn, imageBtn))
            }
            reader.onerror = () => showError(new Error('图片读取失败'))
            reader.readAsDataURL(file)
          }

          imageBtn.onclick = () => imageInput.click()
          imageInput.onchange = () => {
            const file = imageInput.files?.[0]
            if (file) handleImageFile(file)
            imageInput.value = ''
          }
          // 在文本框里 Ctrl+V 粘贴图片 → 直接走图片解读
          textarea.addEventListener('paste', (e) => {
            const file = e.clipboardData?.files?.[0]
            if (file && file.type.startsWith('image/')) {
              e.preventDefault()
              handleImageFile(file)
            }
          })

          // ── 轮询 ──
          const timer = window.setInterval(() => {
            void refreshStatus().catch(() => {})
            void refreshNotes().catch(() => {})
          }, 5000)

          ctx.effect(() => () => {
            window.clearInterval(timer)
          }, 'paper-reading: panel cleanup')

          void refreshStatus().catch(() => { status.textContent = '⚠️ 后端 API 不可达(插件未注入?)' })
          return root
        },
      }),
    }),
  ), '@dsh-external/dsh-paper-reading: panel')

  // ═══ 右侧论文窗口:在对话输入框粘贴文字/图片 → 页面右侧自动弹出 ═══
  setupRightWindow(ctx)
}

// ── 右侧论文窗口 ─────────────────────────────────────────────────────────

const WINDOW_ID = 'dsh-paper-reading-window'
const TOGGLE_ID = 'dsh-paper-reading-toggle'

let windowOpen = false
let windowTimer = 0
let currentPdfId: string | null = null
/** 预设门控:活跃会话属于允许预设时才有「📄 论文」按钮。 */
let paperGateAllowed = false
/** 当前页面正在查看的会话 id(per-session 论文指针用)。 */
let activeSid = ''
/** 论文库快照(供标题搜索过滤)。 */
let windowPapers: Array<{ id: string; title: string; folders: string[]; createdAt: string; updatedAt: string }> = []
/** 文件夹快照。 */
let windowFolders: Array<{ id: string; name: string }> = []
/** 当前排序:'updated' | 'title' | 'created'。 */
let windowSort = 'updated'
/** 归类弹窗正在编辑的论文标题。 */
let folderModalPaper: string | null = null
/** 输入弹窗回调(提交时调用;关闭时清空)。 */
let promptModalCb: ((value: string) => void) | null = null
let windowDom: {
  root: HTMLDivElement
  search: HTMLInputElement
  sortSel: HTMLSelectElement
  folderSelect: HTMLSelectElement
  folderNewBtn: HTMLButtonElement
  folderRenameBtn: HTMLButtonElement
  folderDeleteBtn: HTMLButtonElement
  paperSelect: HTMLSelectElement
  paperFoldBtn: HTMLButtonElement
  paperRenameBtn: HTMLButtonElement
  paperDeleteBtn: HTMLButtonElement
  folderModal: HTMLDivElement
  folderModalList: HTMLDivElement
  folderModalSave: HTMLButtonElement
  folderModalCancel: HTMLButtonElement
  folderModalTitle: HTMLSpanElement
  promptModal: HTMLDivElement
  promptTitle: HTMLSpanElement
  promptInput: HTMLInputElement
  promptOk: HTMLButtonElement
  promptCancel: HTMLButtonElement
  curId: string | null
  status: HTMLDivElement
  notes: HTMLPreElement
  notesStats: HTMLSpanElement
  notesEdit: HTMLButtonElement
  notesSave: HTMLButtonElement
  notesCancel: HTMLButtonElement
  notesArea: HTMLTextAreaElement
  pdfPane: HTMLDivElement
  notesPane: HTMLDivElement
  pdfFrame: HTMLIFrameElement
  pdfHint: HTMLDivElement
  pdfInfo: HTMLDivElement
  pdfExtractBar: HTMLDivElement
  pdfExtractBtn: HTMLButtonElement
  pdfExtractPage: HTMLInputElement
  pdfExtractStatus: HTMLSpanElement
  tabPdf: HTMLButtonElement
  tabNotes: HTMLButtonElement
} | null = null

function ensureWindowDom(): typeof windowDom {
  if (windowDom) return windowDom
  const root = el('div', [
    'position:fixed;right:12px;top:52px;width:480px;height:min(740px,calc(100vh - 64px));min-width:360px;min-height:280px;z-index:2147483000;',
    'display:flex;flex-direction:column;border:1px solid #cbd5e1;border-radius:10px;',
    'background:#fff;box-shadow:0 8px 30px rgba(15,23,42,.18);',
    'font-family:system-ui,sans-serif;font-size:13.5px;line-height:1.6;color:#1f2937;',
  ].join(''))
  root.id = WINDOW_ID

  const header = el('div', 'display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #e2e8f0;background:#f1f5f9;border-radius:10px 10px 0 0;cursor:grab;user-select:none')
  header.title = '拖动标题栏可移动窗口;拖四边或右下角可调整大小'
  header.append(
    el('span', 'font-weight:700;font-size:14px', '📄 论文窗口'),
    el('button', 'padding:3px 10px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;cursor:pointer;font-size:13px', '✕ 关闭'),
  )
  ;(header.lastElementChild as HTMLButtonElement).onclick = closeWindow

  // ── 样式常量(先声明,避免 TDZ)──
  const BTN_SM = 'padding:2px 8px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;cursor:pointer;font-size:12px'

  // ── 行1:搜索 + 排序 + 拖入添加提示 ──
  const toolRow = el('div', 'display:flex;align-items:center;gap:6px;padding:6px 12px 4px')
  const search = el('input', 'flex:1;min-width:0;padding:3px 8px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;font-size:12.5px')
  search.placeholder = '🔍 搜索论文标题…'
  const sortSel = el('select', 'padding:2px 5px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;font-size:12px')
  sortSel.title = '排序方式'
  for (const [v, t] of [['updated', '最近更新'], ['created', '创建时间'], ['title', '标题']] as const) {
    const opt = el('option', '', t)
    opt.value = v
    sortSel.append(opt)
  }
  const dropHint = el('span', 'flex:0 0 auto;font-size:11.5px;color:#64748b;border:1px dashed #cbd5e1;border-radius:999px;padding:2px 8px;white-space:nowrap', '📥 拖 PDF 添加')
  dropHint.title = '把 PDF 文件拖进窗口即可添加论文,标题默认取文件名(可随后重命名)'
  toolRow.append(search, sortSel, dropHint)
  sortSel.onchange = () => {
    windowSort = sortSel.value
    renderPaperSelect()
  }

  // ── 行2:文件夹过滤 + 管理 ──
  const folderRow = el('div', 'display:flex;align-items:center;gap:6px;padding:0 12px 4px')
  const folderSelect = el('select', 'flex:1;min-width:0;padding:2px 5px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;font-size:12px')
  folderSelect.title = '按文件夹过滤(把论文条目拖到这里可移入所选文件夹)'
  const folderNewBtn = el('button', BTN_SM, '➕')
  folderNewBtn.title = '新建文件夹'
  const folderRenameBtn = el('button', BTN_SM, '✏️')
  folderRenameBtn.title = '重命名「文件夹」下拉中选中的文件夹'
  const folderDeleteBtn = el('button', BTN_SM, '🗑️')
  folderDeleteBtn.title = '删除「文件夹」下拉中选中的文件夹(论文移回未分类)'
  folderRow.append(el('span', 'font-weight:600;font-size:12px', '📁'), folderSelect, folderNewBtn, folderRenameBtn, folderDeleteBtn)

  // ── 论文选择行:下拉框 + 操作按钮 ──
  const paperRow = el('div', 'display:flex;align-items:center;gap:6px;padding:0 12px 6px')
  const paperSelect = el('select', 'flex:1;min-width:0;padding:2px 5px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;font-size:12px')
  paperSelect.title = '论文下拉(按搜索与文件夹过滤;拖 PDF 到此处添加)'
  const paperFoldBtn = el('button', BTN_SM, '📁')
  paperFoldBtn.title = '归类当前论文到文件夹(可多选)'
  const paperRenameBtn = el('button', BTN_SM, '✏️')
  paperRenameBtn.title = '重命名当前论文'
  const paperDeleteBtn = el('button', BTN_SM, '🗑️')
  paperDeleteBtn.title = '删除当前论文(进回收站,30 天后清除)'
  paperRow.append(el('span', 'font-weight:600;font-size:12px', '📚'), paperSelect, paperFoldBtn, paperRenameBtn, paperDeleteBtn)

  // ── 拖 PDF 添加高亮提示(悬在下拉上时)──
  paperSelect.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault()
      paperSelect.style.borderColor = '#38bdf8'
      paperSelect.style.borderStyle = 'dashed'
      const f = e.dataTransfer.files?.[0]
      setWinStatus(f ? `📥 松开添加《${f.name}》(标题=文件名)` : '📥 松开添加 PDF')
    }
  })
  paperSelect.addEventListener('dragleave', () => {
    paperSelect.style.borderColor = ''
    paperSelect.style.borderStyle = ''
  })

  // ── 归类弹窗(勾选多个文件夹)──
  const folderModal = el('div', 'position:absolute;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.25);border-radius:10px')
  const folderModalCard = el('div', 'width:260px;max-height:70%;display:flex;flex-direction:column;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 10px 30px rgba(15,23,42,.25);overflow:hidden')
  const folderModalTitle = el('span', 'padding:8px 12px;font-size:13px;font-weight:600;color:#334155;border-bottom:1px solid #e2e8f0', '📁 归类')
  const folderModalList = el('div', 'flex:1;overflow-y:auto;padding:8px 12px;font-size:12.5px')
  const modalBtnRow = el('div', 'display:flex;gap:6px;justify-content:flex-end;padding:8px 12px;border-top:1px solid #e2e8f0')
  const folderModalSave = el('button', BTN_SM, '💾 保存')
  const folderModalCancel = el('button', BTN_SM, '↩️ 取消')
  modalBtnRow.append(folderModalSave, folderModalCancel)
  folderModalCard.append(folderModalTitle, folderModalList, modalBtnRow)
  folderModal.append(folderModalCard)
  folderModal.onclick = (e) => { if (e.target === folderModal) closeFolderModal() }
  folderModalCancel.onclick = closeFolderModal
  folderModalSave.onclick = () => {
    const title = folderModalPaper
    if (!title) { closeFolderModal(); return }
    const checked: string[] = []
    for (const cb of folderModalList.querySelectorAll<HTMLInputElement>('input[type=checkbox]')) {
      if (cb.checked) checked.push(cb.value)
    }
    folderModalSave.disabled = true
    void post('folder-assign', { title, folders: checked })
      .then(r => {
        if (!r?.ok) throw new Error(r?.error ?? 'assign failed')
        setWinStatus(`📁 已更新《${title}》的文件夹(${checked.length} 个)`)
      })
      .catch(e => setWinStatus(e))
      .finally(() => {
        folderModalSave.disabled = false
        // 无论成败都关闭遮罩,避免卡住整个窗口
        closeFolderModal()
        void refreshWindow()
      })
  }

  // ── 输入弹窗(替代 window.prompt —— Electron 不支持 prompt,会静默返回 null)──
  const promptModal = el('div', 'position:absolute;inset:0;z-index:41;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.25);border-radius:10px')
  const promptCard = el('div', 'width:280px;display:flex;flex-direction:column;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 10px 30px rgba(15,23,42,.25);overflow:hidden')
  const promptTitle = el('span', 'padding:8px 12px;font-size:13px;font-weight:600;color:#334155;border-bottom:1px solid #e2e8f0', '输入')
  const promptInput = el('input', 'margin:10px 12px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px') as HTMLInputElement
  const promptBtnRow = el('div', 'display:flex;gap:6px;justify-content:flex-end;padding:0 12px 10px')
  const promptOk = el('button', BTN_SM, '✅ 确定')
  const promptCancel = el('button', BTN_SM, '↩️ 取消')
  promptBtnRow.append(promptOk, promptCancel)
  promptCard.append(promptTitle, promptInput, promptBtnRow)
  promptModal.append(promptCard)
  promptModal.onclick = (e) => { if (e.target === promptModal) closePromptModal() }
  promptCancel.onclick = closePromptModal
  promptOk.onclick = () => {
    const cb = promptModalCb
    const value = promptInput.value.trim()
    closePromptModal()
    if (cb && value) cb(value)
  }
  promptInput.onkeydown = (e) => {
    if (e.key !== 'Enter') return
    const cb = promptModalCb
    const value = promptInput.value.trim()
    closePromptModal()
    if (cb && value) cb(value)
  }
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    closePromptModal()
    closeFolderModal()
  })

  // ── 事件 ──
  search.oninput = () => renderPaperSelect()
  search.onkeydown = (e) => {
    // 回车:在匹配结果中定位并跳转到第一篇
    if (e.key !== 'Enter') return
    const q = search.value.trim().toLowerCase()
    if (!q) return
    const candidates = windowPapers.filter(p => p.title.toLowerCase().includes(q))
    if (candidates.length === 0) { setWinStatus('⚠️ 没有匹配的论文'); return }
    applySort(candidates)
    const target = candidates[0]
    void post(`switch?sid=${encodeURIComponent(activeSid)}`, { title: target.title })
      .then(r => {
        if (!r?.ok) throw new Error(r?.error ?? 'switch failed')
        setWinStatus(`🔍 已跳转到《${target.title}》`)
        void refreshWindow()
      })
      .catch(e => setWinStatus(e))
  }
  folderSelect.onchange = () => renderPaperSelect()
  paperSelect.onchange = () => {
    const id = paperSelect.value
    const opt = Array.from(paperSelect.options).find(o => o.value === id)
    if (!opt || !id) return
    void post(`switch?sid=${encodeURIComponent(activeSid)}`, { title: opt.textContent ?? id })
      .then(r => { if (!r?.ok) throw new Error(r?.error ?? 'switch failed'); void refreshWindow() })
      .catch(e => setWinStatus(e))
  }
  paperFoldBtn.onclick = () => {
    const t = selectedPaperTitle()
    if (!t) { setWinStatus('⚠️ 先选择一篇论文'); return }
    openFolderModal(t)
  }
  paperRenameBtn.onclick = () => {
    const t = selectedPaperTitle()
    if (!t) { setWinStatus('⚠️ 先选择一篇论文'); return }
    renamePaperAction(t)
  }
  paperDeleteBtn.onclick = () => {
    const t = selectedPaperTitle()
    if (!t) { setWinStatus('⚠️ 先选择一篇论文'); return }
    deletePaperAction(t)
  }
  folderNewBtn.onclick = () => {
    windowPrompt('➕ 新建文件夹', '', '文件夹名称…', (name) => {
      void post('folder-create', { name })
        .then(r => {
          if (!r?.ok) throw new Error(r?.error ?? 'create failed')
          setWinStatus(`📁 已新建文件夹《${r.folder.name}》`)
          void refreshWindow()
        })
        .catch(e => setWinStatus(e))
    })
  }
  folderRenameBtn.onclick = () => {
    const fid = folderSelect.value
    if (fid === 'all' || fid === 'none') { setWinStatus('⚠️ 先在「文件夹」下拉选中一个文件夹'); return }
    renameFolderAction(fid)
  }
  folderDeleteBtn.onclick = () => {
    const fid = folderSelect.value
    if (fid === 'all' || fid === 'none') { setWinStatus('⚠️ 先在「文件夹」下拉选中一个文件夹'); return }
    deleteFolderAction(fid)
  }
  // 拖论文到文件夹下拉 = 加入该文件夹(可多文件夹);拖到「未分类」= 清空全部
  folderSelect.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes('text/plain')) {
      e.preventDefault()
      folderSelect.style.borderColor = '#94a3b8'
    }
  })
  folderSelect.addEventListener('dragleave', () => { folderSelect.style.borderColor = '' })
  folderSelect.addEventListener('drop', (e) => {
    e.preventDefault()
    folderSelect.style.borderColor = ''
    const title = e.dataTransfer?.getData('text/plain')
    if (!title) return
    const fid = folderSelect.value
    const paper = windowPapers.find(p => p.title === title)
    if (fid === 'all') { setWinStatus('⚠️ 请先在下拉里选中目标文件夹(或「未分类」)再拖放'); return }
    const own = paper?.folders ?? []
    const folders = fid === 'none'
      ? []
      : (own.includes(fid) ? own : [...own, fid])
    void post('folder-assign', { title, folders })
      .then(r => {
        if (!r?.ok) throw new Error(r?.error ?? 'assign failed')
        setWinStatus(`📁 已更新《${title}》的文件夹(${folders.length} 个)`)
        void refreshWindow()
      })
      .catch(e => setWinStatus(e))
  })

  const status = el('div', 'padding:0 12px 6px;font-size:12.5px;color:#475569', '')

  // ── tab bar:论文 PDF / 笔记 ──
  const tabRow = el('div', 'display:flex;gap:4px;padding:0 10px 6px')
  const tabPdf = el('button', TAB_ON, '📄 论文 PDF')
  const tabNotes = el('button', TAB_OFF, '📒 笔记')
  tabRow.append(tabPdf, tabNotes)
  // ── 悬停提示:功能用法 ──
  attachHint(tabPdf, '📄 论文 PDF\n\npdf.js 阅读器:文字可直接选中复制;图片请用「🖼 提取图片」复制/下载(pdf.js 把页面画在 canvas 上,浏览器不支持直接复制画布中的图片)。工具条支持缩放/搜索/翻页/旋转;PDF 可直接拖进窗口归档。')
  attachHint(tabNotes, '📒 笔记 = 论文阅读存档\n\n· 在对话中提问论文 → AI 自动归档问答\n· 解释过的术语 → 自动存入术语表\n· 粘贴的文字/图表 → 归档为片段与转录\n\n内容会自动出现在本 tab,每 5 秒刷新。\n查看本 tab 顶部提示了解完整用法。')

  // ── PDF pane ──
  const pdfPane = el('div', 'flex:1;display:flex;flex-direction:column;margin:0 12px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;overflow:hidden')
  const pdfInfo = el('div', 'padding:5px 10px;font-size:12.5px;color:#334155;border-bottom:1px solid #e2e8f0', '')
  const pdfExtractBar = el('div', 'display:none;align-items:center;gap:6px;padding:4px 10px;border-bottom:1px solid #e2e8f0;background:#f8fafc')
  const pdfExtractBtn = el('button', BTN_SM, '🖼 提取图片')
  const pdfExtractPage = document.createElement('input')
  pdfExtractPage.type = 'text'
  pdfExtractPage.placeholder = '页码(留空=全部)'
  pdfExtractPage.style.cssText = 'width:86px;font-size:12px;padding:2px 6px;border:1px solid #cbd5e1;border-radius:4px'
  const pdfExtractStatus = el('span', 'font-size:11.5px;color:#64748b', '')
  attachHint(pdfExtractBtn, '🖼 提取 PDF 图片\n\npdf.js 把页面渲染成 canvas,浏览器无法直接右键复制其中的图片——用本功能把当前论文里的图片提取出来:\n· 点击后弹出图片列表,每张可「📋 复制」到剪贴板或「⬇ 下载」;\n· 默认提取全部页面,可在输入框限定(如 3 或 2-5);\n· 自动按内容去重。')
  pdfExtractBar.append(pdfExtractBtn, pdfExtractPage, pdfExtractStatus)
  const pdfFrame = document.createElement('iframe')
  pdfFrame.style.cssText = 'flex:1;border:0;width:100%;background:#fff'
  pdfFrame.title = '论文 PDF'
  const pdfHint = el('div', 'flex:1;display:flex;align-items:center;justify-content:center;padding:12px;font-size:13px;color:#64748b;text-align:center;border:2px dashed #e2e8f0;border-radius:6px;margin:8px;background:#f8fafc', '把 PDF 拖到这里添加论文\n标题默认 = 文件名(可重命名)\n同名论文则归档到它')
  pdfHint.style.whiteSpace = 'pre-line'
  pdfPane.append(pdfInfo, pdfExtractBar, pdfFrame, pdfHint)

  // ── notes pane ──
  const notesPane = el('div', 'flex:1;display:flex;flex-direction:column;margin:0 12px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;overflow:hidden')
  // 头部:标题 + 统计 + 操作按钮(编辑/保存/取消)
  const notesHeader = el('div', 'display:flex;align-items:center;gap:6px;padding:5px 10px;border-bottom:1px solid #e2e8f0;background:#f8fafc')
  const notesTitle = el('span', 'font-size:13px;font-weight:600;color:#334155', '📒 笔记')
  const notesStats = el('span', 'font-size:11.5px;color:#64748b', '')
  const notesEdit = el('button', BTN_SM, '✏️ 编辑')
  notesEdit.title = '在窗口内直接编辑本文的笔记(内容 = notes.md 全文)'
  const notesSave = el('button', BTN_SM, '💾 保存')
  const notesCancel = el('button', BTN_SM, '↩️ 取消')
  notesSave.style.display = 'none'
  notesCancel.style.display = 'none'
  notesHeader.append(notesTitle, notesStats, notesEdit, notesSave, notesCancel)
  notesPane.append(notesHeader)
  attachHint(notesHeader, [
    '📒 笔记如何形成:',
    '',
    '1) 自动:对话中问论文问题,AI 用 paper_qa 归档问答;',
    '   解释的术语存入术语表;粘贴文字/图表归档片段与转录。',
    '2) 主动:对话区「📄 论文阅读」面板的「🧹 收藏整理」',
    '   「❓ 提问解释」及快捷动作(总结全文/术语表/今日小结等)',
    '   会把结果写进当前论文笔记。',
    '3) 手动:点「✏️ 编辑」直接在窗口里改全文。',
    '',
    '📂 笔记文件(纯文本):',
    '~/Documents/papers-library/papers/<论文>/',
    '   notes.md  (问答与片段)',
    '   glossary.md (术语表)',
    '   figures.md (图表转录)',
    '',
    '🔎 跨论文检索:直接问 AI「哪篇论文写过 XXX」',
  ].join('\n'))
  const notes = el('pre', 'flex:1;overflow:auto;white-space:pre-wrap;padding:10px 12px;margin:0;font-size:13px;line-height:1.65;color:#1f2937', '')
  const notesArea = el('textarea', 'flex:1;box-sizing:border-box;width:100%;resize:none;padding:10px 12px;border:0;outline:0;font-size:13px;line-height:1.65;font-family:inherit;color:#1f2937;background:#fff')
  notesArea.placeholder = '在此编辑当前论文的笔记(全文=notes.md)…'
  notesArea.style.display = 'none'
  const exitEdit = () => {
    notes.style.display = 'flex'
    notesArea.style.display = 'none'
    notesEdit.style.display = ''
    notesSave.style.display = 'none'
    notesCancel.style.display = 'none'
  }
  notesEdit.onclick = () => {
    void getJson(`notes?sid=${encodeURIComponent(activeSid)}`)
      .then(n => {
        if (!n?.ok) throw new Error(n?.error ?? 'notes failed')
        notesArea.value = n.notesFull ?? n.notes ?? ''
        notes.style.display = 'none'
        notesArea.style.display = 'flex'
        notesEdit.style.display = 'none'
        notesSave.style.display = ''
        notesCancel.style.display = ''
      })
      .catch(e => setWinStatus(e))
  }
  notesSave.onclick = () => {
    notesSave.disabled = true
    void post(`save-notes?sid=${encodeURIComponent(activeSid)}`, { text: notesArea.value })
      .then(r => {
        if (!r?.ok) throw new Error(r?.error ?? 'save failed')
        exitEdit()
        setWinStatus(`💾 已保存(${r.savedChars} 字)`)
        void refreshNotes()
      })
      .catch(e => setWinStatus(e))
      .finally(() => { notesSave.disabled = false })
  }
  notesCancel.onclick = exitEdit

  notesPane.append(notes, notesArea)

  // ── 缩放/移动手柄(窄命中区,尽量落在窗口外,避免遮挡控件)──
  const hLeft = el('div', 'position:absolute;left:-5px;top:0;bottom:0;width:6px;cursor:ew-resize;z-index:6')
  const hRight = el('div', 'position:absolute;right:-5px;top:0;bottom:0;width:6px;cursor:ew-resize;z-index:6')
  const hTop = el('div', 'position:absolute;left:0;right:0;top:-5px;height:6px;cursor:ns-resize;z-index:6')
  const hBottom = el('div', 'position:absolute;left:0;right:0;bottom:-5px;height:6px;cursor:ns-resize;z-index:6')
  const hCorner = el('div', 'position:absolute;right:-5px;bottom:-5px;width:14px;height:14px;cursor:nwse-resize;z-index:6;background:radial-gradient(circle at 100% 100%,#64748b 3px,transparent 4px)')
  root.append(header, toolRow, folderRow, paperRow, folderModal, promptModal, status, tabRow, pdfPane, notesPane, hLeft, hRight, hTop, hBottom, hCorner)

  bindMove(header)
  bindResize(hLeft, 'w')
  bindResize(hRight, 'e')
  bindResize(hTop, 'n')
  bindResize(hBottom, 's')
  bindResize(hCorner, 'sw')

  // ── tab 切换 ──
  function showPane(which: 'pdf' | 'notes'): void {
    pdfPane.style.display = which === 'pdf' ? 'flex' : 'none'
    notesPane.style.display = which === 'notes' ? 'flex' : 'none'
    tabPdf.style.cssText = which === 'pdf' ? TAB_ON : TAB_OFF
    tabNotes.style.cssText = which === 'notes' ? TAB_ON : TAB_OFF
  }
  tabPdf.onclick = () => showPane('pdf')
  tabNotes.onclick = () => showPane('notes')
  pdfExtractBtn.onclick = () => runExtractPdfImages()
  pdfExtractPage.onkeydown = (e) => {
    if (e.key === 'Enter') runExtractPdfImages()
  }
  showPane('pdf')

  // ── PDF 拖放上传:标题默认取文件名 ──
  root.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
  })
  root.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0]
    if (!file || !/\.pdf$/i.test(file.name)) return
    e.preventDefault()
    paperSelect.style.borderColor = ''
    paperSelect.style.borderStyle = ''
    setWinStatus(`📤 上传 PDF:${file.name}(${fmtBytes(file.size)})…`)
    const reader = new FileReader()
    reader.onload = () => {
      const data = String(reader.result ?? '')
      // 标题默认 = 文件名(去掉 .pdf 后缀);同名论文已存在则挂到它
      const title = file.name.replace(/\.pdf$/i, '').trim()
      void post('attach-pdf', { data, title })
        .then(r => {
          if (!r?.ok) throw new Error(r?.error ?? 'attach failed')
          setWinStatus(r.created
            ? `✅ 已添加《${r.title}》(${r.pages} 页,标题=文件名)`
            : `✅ 已归档到《${r.title}》(${r.pages} 页)`)
          void refreshWindow()
        })
        .catch(e => setWinStatus(e))
    }
    reader.onerror = () => setWinStatus('❌ PDF 读取失败')
    reader.readAsDataURL(file)
  })

  // 挂载到页面(按钮消失但窗口不出现的根因:root 从未 append 进 DOM)
  if (!root.isConnected) document.body.append(root)

  windowDom = { root, search, sortSel, folderSelect, folderNewBtn, folderRenameBtn, folderDeleteBtn, paperSelect, paperFoldBtn, paperRenameBtn, paperDeleteBtn, folderModal, folderModalList, folderModalSave, folderModalCancel, folderModalTitle, promptModal, promptTitle, promptInput, promptOk, promptCancel, curId: null, status, notes, notesStats, notesEdit, notesSave, notesCancel, notesArea, pdfPane, notesPane, pdfFrame, pdfHint, pdfInfo, pdfExtractBar, pdfExtractBtn, pdfExtractPage, pdfExtractStatus, tabPdf, tabNotes }
  return windowDom
}

/** 当前下拉选中的论文标题;无选中返回 null。 */
function selectedPaperTitle(): string | null {
  const dom = windowDom
  if (!dom || !dom.paperSelect.value) return null
  const opt = Array.from(dom.paperSelect.options).find(o => o.value === dom.paperSelect.value)
  return opt?.textContent?.trim() || null
}

// ── PDF 图片提取(弥补 pdf.js canvas 无法原生复制图片)──────────────────

let pdfjsModule: any = null

/** 动态加载插件自带的 pdf.js(legacy build,与 viewer 同版本)。 */
async function loadPdfjs(): Promise<any> {
  if (pdfjsModule) return pdfjsModule
  const pdfUrl = '/dsh-paper-reading/pdfjs-legacy/build/pdf.mjs'
  const mod = await import(pdfUrl)
  mod.GlobalWorkerOptions.workerSrc = '/dsh-paper-reading/pdfjs-legacy/build/pdf.worker.mjs'
  pdfjsModule = mod
  return mod
}

/** 把 pdf.js 图像对象(kind: 0=1bpp灰 1=RGB 2=RGBA 3=8bpp灰)转成 canvas。 */
function imgDataToCanvas(img: any): HTMLCanvasElement {
  const w = img.width
  const h = img.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx2d = canvas.getContext('2d')
  if (!ctx2d) return canvas
  const im = ctx2d.createImageData(w, h)
  const out = im.data
  const data: Uint8Array = img.data
  if (img.kind === 2) {
    out.set(data)
  } else if (img.kind === 1) {
    for (let i = 0, j = 0; i < out.length; i += 4, j += 3) {
      out[i] = data[j]; out[i + 1] = data[j + 1]; out[i + 2] = data[j + 2]; out[i + 3] = 255
    }
  } else if (img.kind === 3) {
    for (let i = 0, j = 0; i < out.length; i += 4, j++) {
      const v = data[j]; out[i] = v; out[i + 1] = v; out[i + 2] = v; out[i + 3] = 255
    }
  } else if (img.kind === 0) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const bit = (data[(y * w + x) >> 3] >> (7 - ((y * w + x) & 7))) & 1
        const o = (y * w + x) * 4
        const v = bit ? 255 : 0
        out[o] = v; out[o + 1] = v; out[o + 2] = v; out[o + 3] = 255
      }
    }
  }
  ctx2d.putImageData(im, 0, 0)
  return canvas
}

function hashBytes(data: Uint8Array): string {
  let h1 = 0x811c9dc5
  const n = Math.min(data.length, 512)
  for (let i = 0; i < n; i++) {
    h1 ^= data[i]
    h1 = Math.imul(h1, 0x01000193)
  }
  return (h1 >>> 0).toString(16)
}

/** 提取当前论文 PDF 的图片(按内容去重,上限 60 张)。pageSpec:'' 全部 / '3' / '2-5'。 */
async function extractPdfImages(pageSpec: string): Promise<HTMLCanvasElement[]> {
  const mod = await loadPdfjs()
  if (!currentPdfId) throw new Error('当前论文没有 PDF')
  const resp = await fetch(`/dsh-paper-reading/api/paper-pdf/${encodeURIComponent(currentPdfId)}`)
  if (!resp.ok) throw new Error(`PDF 下载失败(${resp.status})`)
  const doc = await mod.getDocument({ data: await resp.arrayBuffer() }).promise
  const pages: number[] = []
  const spec = pageSpec.trim()
  if (!spec) {
    for (let i = 1; i <= doc.numPages; i++) pages.push(i)
  } else if (/^\d+$/.test(spec)) {
    const n = parseInt(spec, 10)
    if (n < 1 || n > doc.numPages) throw new Error(`页码超出范围(1-${doc.numPages})`)
    pages.push(n)
  } else if (/^(\d+)-(\d+)$/.test(spec)) {
    const m = spec.split('-').map(x => parseInt(x, 10))
    const lo = Math.min(m[0], m[1])
    const hi = Math.max(m[0], m[1])
    for (let i = lo; i <= hi && i <= doc.numPages; i++) pages.push(i)
  } else {
    throw new Error('页码格式:留空(全部) / 单页如 3 / 区间如 2-5')
  }
  const found: HTMLCanvasElement[] = []
  const seen = new Set<string>()
  for (const n of pages) {
    const page = await doc.getPage(n)
    const ops = await page.getOperatorList()
    for (let i = 0; i < ops.fnArray.length && found.length < 60; i++) {
      const fn = ops.fnArray[i]
      let img: any = null
      if (fn === mod.OPS.paintImageXObject) {
        try { img = await page.objs.get(ops.argsArray[i][0]) } catch { continue }
      } else if (fn === mod.OPS.paintInlineImageXObject) {
        img = ops.argsArray[i][0]
      } else {
        continue
      }
      if (!img || !img.data || !img.width || !img.height) continue
      const key = `${img.width}x${img.height}:${hashBytes(img.data)}`
      if (seen.has(key)) continue
      seen.add(key)
      try { found.push(imgDataToCanvas(img)) } catch { /* 跳过无法解码的图 */ }
    }
  }
  return found
}

async function copyCanvasImage(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
    if (!blob) return false
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}

function downloadCanvas(canvas: HTMLCanvasElement, name: string): void {
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = name
  a.click()
}

/** 弹出提取结果面板(缩略图 + 复制/下载)。 */
function showExtractResults(items: HTMLCanvasElement[], elapsedMs: number): void {
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:99999'
  const panel = document.createElement('div')
  panel.style.cssText = 'background:#fff;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.25);width:min(680px,92vw);max-height:82vh;display:flex;flex-direction:column;overflow:hidden'
  const head = document.createElement('div')
  head.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#334155;font-weight:600'
  head.textContent = `🖼 提取到 ${items.length} 张图片(${(elapsedMs / 1000).toFixed(1)}s)`
  const closeBtn = document.createElement('button')
  closeBtn.textContent = '✕ 关闭'
  closeBtn.style.cssText = 'margin-left:auto;font-size:12px;padding:2px 10px;border:1px solid #cbd5e1;border-radius:4px;background:#f8fafc;cursor:pointer'
  head.append(closeBtn)
  const grid = document.createElement('div')
  grid.style.cssText = 'flex:1;overflow:auto;padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px'
  if (items.length === 0) {
    const empty = document.createElement('div')
    empty.style.cssText = 'grid-column:1/-1;text-align:center;color:#94a3b8;padding:30px 0;font-size:13px'
    empty.textContent = '未找到图片(有些 PDF 的图是矢量绘制,或已被裁剪)。'
    grid.append(empty)
  }
  items.forEach((canvas, idx) => {
    const card = document.createElement('div')
    card.style.cssText = 'border:1px solid #e2e8f0;border-radius:6px;padding:6px;background:#f8fafc;display:flex;flex-direction:column;gap:6px'
    const thumb = document.createElement('canvas')
    thumb.width = canvas.width
    thumb.height = canvas.height
    thumb.getContext('2d')?.drawImage(canvas, 0, 0)
    thumb.style.cssText = 'max-width:100%;max-height:150px;object-fit:contain;margin:0 auto;background:#fff'
    const meta = document.createElement('div')
    meta.style.cssText = 'font-size:11px;color:#64748b;text-align:center'
    meta.textContent = `${canvas.width}×${canvas.height}`
    const row = document.createElement('div')
    row.style.cssText = 'display:flex;gap:6px;justify-content:center'
    const copyBtn = document.createElement('button')
    copyBtn.textContent = '📋 复制'
    copyBtn.style.cssText = 'font-size:11.5px;padding:2px 8px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;cursor:pointer'
    const dlBtn = document.createElement('button')
    dlBtn.textContent = '⬇ 下载'
    dlBtn.style.cssText = 'font-size:11.5px;padding:2px 8px;border:1px solid #cbd5e1;border-radius:4px;background:#fff;cursor:pointer'
    copyBtn.onclick = async () => {
      const ok = await copyCanvasImage(canvas)
      copyBtn.textContent = ok ? '✅ 已复制' : '❌ 复制失败(可用下载)'
      setTimeout(() => { copyBtn.textContent = '📋 复制' }, 2000)
    }
    dlBtn.onclick = () => downloadCanvas(canvas, `paper-fig-${idx + 1}.png`)
    row.append(copyBtn, dlBtn)
    card.append(thumb, meta, row)
    grid.append(card)
  })
  closeBtn.onclick = () => overlay.remove()
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove() }
  panel.append(head, grid)
  overlay.append(panel)
  document.body.append(overlay)
}

/** 提取按钮入口。 */
function runExtractPdfImages(): void {
  const dom = windowDom
  if (!dom) return
  const spec = dom.pdfExtractPage.value
  dom.pdfExtractBtn.disabled = true
  dom.pdfExtractStatus.textContent = '⏳ 提取中…'
  const t0 = performance.now()
  extractPdfImages(spec)
    .then(items => {
      dom.pdfExtractStatus.textContent = ''
      showExtractResults(items, performance.now() - t0)
    })
    .catch((e: unknown) => {
      dom.pdfExtractStatus.textContent = `❌ ${e instanceof Error ? e.message : String(e)}`
    })
    .finally(() => {
      dom.pdfExtractBtn.disabled = false
    })
}

// ── 输入弹窗(替代 window.prompt)────────────────────────────────────────

/** 打开输入弹窗;onSubmit 收到非空值后执行。 */
function windowPrompt(title: string, initial: string, placeholder: string, onSubmit: (value: string) => void): void {
  const dom = windowDom
  if (!dom) return
  promptModalCb = onSubmit
  dom.promptTitle.textContent = title
  dom.promptInput.value = initial
  dom.promptInput.placeholder = placeholder
  dom.promptModal.style.display = 'flex'
  dom.promptInput.focus()
  dom.promptInput.select()
}

function closePromptModal(): void {
  const dom = windowDom
  if (!dom) return
  dom.promptModal.style.display = 'none'
  promptModalCb = null
}

// ── 文件夹名 / 动作助手 ────────────────────────────────────────────────

function folderNameOf(folderId: string | null): string {
  if (!folderId) return '未分类'
  return windowFolders.find(f => f.id === folderId)?.name ?? '未分类'
}

function renamePaperAction(oldTitle: string): void {
  windowPrompt('✏️ 重命名论文', oldTitle, '新的论文标题…', (newTitle) => {
    if (newTitle === oldTitle) return
    void post('rename-paper', { title: oldTitle, newTitle })
      .then(r => {
        if (!r?.ok) throw new Error(r?.error ?? 'rename failed')
        setWinStatus(`✏️ 已重命名为《${r.paper.title}》`)
        void refreshWindow()
      })
      .catch(e => setWinStatus(e))
  })
}

function deletePaperAction(title: string): void {
  if (!window.confirm(`确定删除《${title}》?\n将移入回收站(30 天后自动清除),可联系 AI 恢复。`)) return
  void post('delete-paper', { title })
    .then(r => {
      if (!r?.ok) throw new Error(r?.error ?? 'delete failed')
      setWinStatus(`🗑️ 已删除《${r.deleted}》`)
      void refreshWindow()
    })
    .catch(e => setWinStatus(e))
}

function renameFolderAction(fid: string): void {
  const folder = windowFolders.find(f => f.id === fid)
  if (!folder) return
  windowPrompt('✏️ 重命名文件夹', folder.name, '新的文件夹名称…', (newName) => {
    if (newName === folder.name) return
    void post('folder-rename', { id: fid, newName })
      .then(r => {
        if (!r?.ok) throw new Error(r?.error ?? 'rename failed')
        setWinStatus(`📁 已重命名为《${newName}》`)
        void refreshWindow()
      })
      .catch(e => setWinStatus(e))
  })
}

function deleteFolderAction(fid: string): void {
  const folder = windowFolders.find(f => f.id === fid)
  if (!folder) return
  if (!window.confirm(`确定删除文件夹《${folder.name}》?其中论文将移回「未分类」。`)) return
  void post('folder-delete', { id: fid })
    .then(r => {
      if (!r?.ok) throw new Error(r?.error ?? 'delete failed')
      setWinStatus(`🗑️ 已删除文件夹《${folder.name}》`)
      void refreshWindow()
    })
    .catch(e => setWinStatus(e))
}

// ── 文件夹下拉 / 论文列表渲染 ──────────────────────────────────────────

/** 打开归类弹窗(勾选多个文件夹)。 */
function openFolderModal(paperTitle: string): void {
  const dom = windowDom
  if (!dom) return
  folderModalPaper = paperTitle
  const paper = windowPapers.find(p => p.title === paperTitle)
  const own = paper?.folders ?? []
  dom.folderModalTitle.textContent = `📁 归类:《${paperTitle}》(可多选)`
  dom.folderModalList.innerHTML = ''
  for (const f of windowFolders) {
    const row = el('label', 'display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer')
    const cb = el('input', '') as HTMLInputElement
    cb.type = 'checkbox'
    cb.value = f.id
    cb.checked = own.includes(f.id)
    row.append(cb, el('span', '', `📂 ${f.name}`))
    dom.folderModalList.append(row)
  }
  if (windowFolders.length === 0) {
    dom.folderModalList.append(el('div', 'color:#94a3b8;padding:4px 0', '还没有文件夹,先在下方 ➕ 新建'))
  }
  dom.folderModal.style.display = 'flex'
}

function closeFolderModal(): void {
  const dom = windowDom
  if (!dom) return
  dom.folderModal.style.display = 'none'
  folderModalPaper = null
}

/** 重建文件夹过滤下拉(全部/未分类/各文件夹),保留当前选择。 */
function renderFolderSelect(): void {
  const dom = windowDom
  if (!dom) return
  const keep = dom.folderSelect.value
  dom.folderSelect.innerHTML = ''
  const groups: Array<[string, string]> = [
    ['all', '🗂️ 全部'],
    ['none', '📄 未分类'],
    ...windowFolders.map(f => [f.id, `📂 ${f.name}`] as [string, string]),
  ]
  for (const [v, t] of groups) {
    const opt = el('option', '', t)
    opt.value = v
    dom.folderSelect.append(opt)
  }
  dom.folderSelect.value = groups.some(([v]) => v === keep) ? keep : 'all'
}

/** 渲染论文列表(搜索词 + 文件夹过滤 + 排序;hover 归类/重命名/删除;可拖出)。 */
/** 按当前排序方式对论文列表排序(原地)。 */
function applySort(papers: Array<{ id: string; title: string; folders: string[]; createdAt: string; updatedAt: string }>): void {
  papers.sort((a, b) => {
    if (windowSort === 'title') return a.title.localeCompare(b.title, 'zh')
    const ka = windowSort === 'created' ? a.createdAt : a.updatedAt
    const kb = windowSort === 'created' ? b.createdAt : b.updatedAt
    return (kb || '').localeCompare(ka || '')
  })
}

/** 渲染论文下拉(搜索词 + 文件夹过滤 + 排序;值 = 当前论文)。 */
function renderPaperSelect(): void {
  const dom = windowDom
  if (!dom) return
  const q = dom.search.value.trim().toLowerCase()
  const ff = dom.folderSelect.value
  const papers = windowPapers.filter(p => {
    if (q && !p.title.toLowerCase().includes(q)) return false
    const own = p.folders ?? []
    if (ff === 'none') return own.length === 0
    if (ff !== 'all') return own.includes(ff)
    return true
  })
  applySort(papers)
  const keep = dom.paperSelect.value
  dom.paperSelect.innerHTML = ''
  if (papers.length === 0) {
    const empty = el('option', '', q ? '没有匹配的论文' : '还没有论文 — 拖 PDF 添加')
    empty.value = ''
    dom.paperSelect.append(empty)
  } else {
    for (const p of papers) {
      const opt = el('option', '', p.title)
      opt.value = p.id
      dom.paperSelect.append(opt)
    }
  }
  if (keep && windowPapers.some(p => p.id === keep)) dom.paperSelect.value = keep
  const hasSel = Boolean(dom.paperSelect.value)
  dom.paperFoldBtn.disabled = !hasSel
  dom.paperRenameBtn.disabled = !hasSel
  dom.paperDeleteBtn.disabled = !hasSel
}

// ── 窗口移动 / 缩放 ──────────────────────────────────────────────────────

function bindResize(handle: HTMLElement, dir: 'w' | 'e' | 'n' | 's' | 'sw'): void {
  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    const root = windowDom!.root
    const sx = e.clientX, sy = e.clientY
    const sw = root.offsetWidth, sh = root.offsetHeight
    const rect = root.getBoundingClientRect()
    const ox = rect.left
    const top0 = rect.top
    const right0 = window.innerWidth - rect.right
    // 水平锚定方向:right 仍生效(未移动过)= 右锚定;移动后 right=auto = 左锚定
    const anchoredRight = root.style.right !== 'auto' && root.style.right !== ''
    document.body.style.userSelect = 'none'
    // 缩放期间暂停 iframe 交互,并按 rAF 合并帧——宽向缩放会触发 pdf.js 重渲染,
    // 逐事件提交会让拖动卡顿;合并到每帧一次后,跟手且渲染压力可控。
    windowDom!.pdfFrame.style.pointerEvents = 'none'
    let last: PointerEvent | null = null
    let raf = 0
    const apply = () => {
      raf = 0
      if (!last) return
      const ev = last
      const dx = ev.clientX - sx
      const dy = ev.clientY - sy
      let w = sw, h = sh
      if (dir === 'w') {
        // 左缘手柄:被拖的左缘跟手,右缘保持不动
        w = Math.max(360, sw - dx)
        if (!anchoredRight) root.style.left = `${Math.max(8, ox + dx)}px`
      } else if (dir === 'e') {
        // 右缘手柄:被拖的右缘跟手,左缘保持不动
        w = Math.max(360, sw + dx)
        if (anchoredRight) root.style.right = `${Math.max(8, right0 - dx)}px`
      } else if (dir === 'sw') {
        // 右下角:水平方向以锚定边为不动边
        w = Math.max(360, anchoredRight ? sw - dx : sw + dx)
      }
      if (dir === 'n') {
        // 上缘手柄:被拖的上缘跟手,下缘保持不动
        h = Math.max(280, sh - dy)
        root.style.top = `${Math.max(8, top0 + dy)}px`
      } else if (dir === 's' || dir === 'sw') {
        h = Math.max(280, sh + dy)
      }
      root.style.width = `${w}px`
      root.style.height = `${h}px`
      // 停靠模式下同步让位宽度
      document.documentElement.style.setProperty('--paper-dock-w', `${w}px`)
    }
    const move = (ev: PointerEvent) => {
      last = ev
      if (!raf) raf = requestAnimationFrame(apply)
    }
    const up = () => {
      if (raf) cancelAnimationFrame(raf)
      last = null
      windowDom!.pdfFrame.style.pointerEvents = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  })
}

function bindMove(handle: HTMLElement): void {
  handle.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('button')) return
    e.preventDefault()
    const root = windowDom!.root
    const rect = root.getBoundingClientRect()
    const sx = e.clientX, sy = e.clientY
    const ox = rect.left, oy = rect.top
    document.body.style.userSelect = 'none'
    // 拖动期间只改 transform(GPU 合成通道),避免逐帧触发布局重排导致卡顿;
    // 松手时一次性把 left/top 落位。
    root.style.willChange = 'transform'
    let lx = 0, ly = 0
    const move = (ev: PointerEvent) => {
      lx = Math.max(8 - ox, ev.clientX - sx)
      ly = Math.max(8 - oy, ev.clientY - sy)
      root.style.transform = `translate3d(${lx}px, ${ly}px, 0)`
    }
    const up = () => {
      root.style.transform = ''
      root.style.willChange = ''
      root.style.right = 'auto'
      root.style.left = `${Math.max(8, ox + lx)}px`
      root.style.top = `${Math.max(8, oy + ly)}px`
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  })
}

function setWinStatus(e: unknown): void {
  if (!windowDom) return
  windowDom.status.textContent = e instanceof Error ? `❌ ${e.message}` : String(e)
}

async function refreshWindow(): Promise<void> {
  if (!windowDom) return
  let s: any = null
  try { s = await getJson(`status?sid=${encodeURIComponent(activeSid)}`) } catch { return }
  if (!s?.ok) return
  windowFolders = (s.folders ?? []).map((f: any) => ({ id: f.id, name: f.name }))
  windowPapers = (s.papers ?? []).map((p: any) => ({
    id: p.id,
    title: p.title,
    folders: Array.isArray(p.folders) ? p.folders : [],
    createdAt: p.createdAt ?? '',
    updatedAt: p.updatedAt ?? '',
  }))
  windowDom.curId = s.current?.id ?? null
  renderFolderSelect()
  renderPaperSelect()
  // ── PDF pane ──
  const pid = s.current?.id ?? null
  const pdf = s.pdf
  if (pid && pdf) {
    if (currentPdfId !== pid) {
      currentPdfId = pid
      const pdfUrl = `/dsh-paper-reading/api/paper-pdf/${encodeURIComponent(pid)}`
      // 自托管 pdf.js viewer(legacy 构建,官方推荐生产环境):完整工具栏,文字图片可选中
      windowDom.pdfFrame.src = `/dsh-paper-reading/pdfjs-legacy/web/viewer.html?file=${encodeURIComponent(pdfUrl)}#zoom=page-width`
      windowDom.pdfFrame.style.display = 'block'
      windowDom.pdfHint.style.display = 'none'
    }
    windowDom.pdfInfo.textContent = `📄 ${pdf.title} · ${pdf.pages} 页 · ${fmtBytes(pdf.bytes)} — 文字可选中复制;图片用「🖼 提取图片」复制/下载`
    windowDom.pdfExtractBar.style.display = 'flex'
    windowDom.pdfExtractStatus.textContent = ''
  } else {
    currentPdfId = null
    windowDom.pdfFrame.style.display = 'none'
    windowDom.pdfFrame.removeAttribute('src')
    windowDom.pdfExtractBar.style.display = 'none'
    windowDom.pdfHint.style.display = 'flex'
    windowDom.pdfInfo.textContent = pid ? '(未归档 PDF — 拖入或发给 AI)' : '(未选择论文)'
  }
  let n: any = null
  try { n = await getJson(`notes?sid=${encodeURIComponent(activeSid)}`) } catch { return }
  if (n?.ok && n.paper) {
    const full = n.notesFull ?? ''
    const qaCount = (full.match(/## 💬 Q&A/g) || []).length
    windowDom.notesStats.textContent = qaCount > 0 ? `${qaCount} 条问答 · ${full.length} 字` : ''
    const body = String(n.notes ?? '').trim()
    if (body) {
      windowDom.notes.textContent = n.notes
      windowDom.notes.style.color = '#1f2937'
    } else {
      windowDom.notes.textContent = '暂无笔记\n\n在对话中提问论文,AI 会自动归档问答与术语;也可以点「✏️ 编辑」手动写。'
      windowDom.notes.style.color = '#94a3b8'
    }
  } else {
    windowDom.notes.textContent = '(未选择论文)'
    windowDom.notes.style.color = '#94a3b8'
    windowDom.notesStats.textContent = ''
  }
}

function openWindow(): void {
  const dom = ensureWindowDom()
  dom.root.style.display = 'flex'
  windowOpen = true
  setDock(true)
  const toggle = document.getElementById(TOGGLE_ID)
  if (toggle) toggle.style.display = 'none'
  void refreshWindow().catch(() => {})
  if (!windowTimer) {
    windowTimer = window.setInterval(() => {
      if (!windowOpen) return
      void refreshWindow().catch(() => {})
    }, 5000)
  }
}

function closeWindow(): void {
  windowOpen = false
  setDock(false)
  if (windowDom) windowDom.root.style.display = 'none'
  const toggle = document.getElementById(TOGGLE_ID)
  if (toggle) toggle.style.display = 'flex'
  if (windowTimer) {
    window.clearInterval(windowTimer)
    windowTimer = 0
  }
}

// ── 停靠模式:论文窗口打开时让对话内容让出右侧空间,互不遮挡 ──────────

function ensureDockStyle(): void {
  if (document.getElementById('paper-dock-style')) return
  const st = document.createElement('style')
  st.id = 'paper-dock-style'
  st.textContent = [
    '[data-conversation-scroll]{transition:padding-right .18s ease}',
    // 只给消息区让位;聊天输入框不碰(改为让窗口停在输入框上方)
    'body.paper-docked [data-conversation-scroll]{padding-right:var(--paper-dock-w,480px) !important}',
  ].join('\n')
  document.head.append(st)
}

/** 打开前的窗口高度(关闭停靠时恢复)。 */
let dockPrevHeight: number | null = null

/** 开/关停靠:消息区让出窗口宽度;窗口高度上限 = 聊天框顶部之上。 */
function setDock(open: boolean): void {
  document.body.classList.toggle('paper-docked', open)
  const dom = windowDom
  if (!dom) return
  if (open) {
    document.documentElement.style.setProperty('--paper-dock-w', `${dom.root.offsetWidth}px`)
    // 窗口底部不越过聊天框:按输入区顶部压缩窗口高度
    const seat = document.querySelector<HTMLElement>('[data-composer-seat],[data-composer-card],[data-input-scroll]')
    if (seat) {
      const seatTop = seat.getBoundingClientRect().top
      const maxH = Math.max(280, seatTop - 52 - 8)
      if (dom.root.offsetHeight > maxH) {
        dockPrevHeight = dom.root.offsetHeight
        dom.root.style.height = `${maxH}px`
      }
    }
  } else if (dockPrevHeight !== null) {
    dom.root.style.height = `${dockPrevHeight}px`
    dockPrevHeight = null
  }
}

function setupRightWindow(ctx: ClientContext): void {
  ctx.effect(() => () => {
    document.removeEventListener('dragover', onPageDragOver, true)
    document.removeEventListener('drop', onPageDrop, true)
    closeWindow()
    document.body.classList.remove('paper-docked')
    document.getElementById(WINDOW_ID)?.remove()
    document.getElementById(TOGGLE_ID)?.remove()
  }, 'paper-reading: right window cleanup')
  ensureDockStyle()

  // 预设门控:仅当活跃会话属于允许预设时才显示「📄 论文」按钮。
  // 轮询 /api/gate(host 根据 lastActiveSession 的预设判定)。
  let toggle: HTMLButtonElement | null = null
  const ensureToggle = (): void => {
    if (toggle) return
    toggle = el('button', [
      'position:fixed;right:14px;bottom:16px;z-index:2147483001;padding:7px 13px;',
      'border:1px solid #cbd5e1;border-radius:999px;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.15);',
      'cursor:pointer;font-size:13px;color:#334155;',
    ].join(''), '📄 论文')
    toggle.id = TOGGLE_ID
    toggle.onclick = () => openWindow()
    document.body.append(toggle)
  }
  const applyGate = (allowed: boolean): void => {
    if (allowed === paperGateAllowed) return
    paperGateAllowed = allowed
    if (allowed) {
      ensureToggle()
    } else {
      closeWindow()
      toggle?.remove()
      toggle = null
    }
  }
  const pollGate = (): void => {
    // 上报当前正在查看的会话 id(侧栏选中项),host 按该会话的预设判定
    let sid = ''
    try { sid = ctx.sessions?.list?.getSnapshot?.().current ?? '' } catch { /* ignore */ }
    // 切换会话 → 立即刷新论文窗口内容(论文指针是 per-session 的)
    if (sid !== activeSid && windowOpen) {
      activeSid = sid
      void refreshWindow().catch(() => {})
    } else {
      activeSid = sid
    }
    void getJson(`gate?sid=${encodeURIComponent(sid)}`)
      .then(g => { if (g?.ok) applyGate(g.allowed === true) })
      .catch(() => {})
  }
  pollGate()
  // 侧栏切换会话时立即重查门控(无需等轮询)
  try {
    const unsub = ctx.sessions?.list?.subscribe?.(pollGate)
    ctx.effect(() => () => { unsub?.() }, 'paper-reading: gate subscription cleanup')
  } catch { /* ignore */ }
  const gateTimer = window.setInterval(pollGate, 2000)
  ctx.effect(() => () => { window.clearInterval(gateTimer) }, 'paper-reading: gate poll cleanup')

  document.addEventListener('dragover', onPageDragOver, true)
  document.addEventListener('drop', onPageDrop, true)
}

/** 从页面任意位置取 PDF 文件;窗口内交给窗口自身的处理。 */
function pdfFromDrag(e: DragEvent): File | null {
  if (!paperGateAllowed) return null
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return null
  const pdf = Array.from(files).find(f => /\.pdf$/i.test(f.name))
  if (!pdf) return null
  if (e.target instanceof Element && e.target.closest(`#${WINDOW_ID}`)) return null
  return pdf
}

function onPageDragOver(e: DragEvent): void {
  const pdf = pdfFromDrag(e)
  if (!pdf) return
  e.preventDefault()
  e.stopPropagation()
}

function onPageDrop(e: DragEvent): void {
  const pdf = pdfFromDrag(e)
  if (!pdf) return
  e.preventDefault()
  e.stopPropagation()
  attachPdfFile(pdf)
}

/** 读取 PDF 并添加到论文库(标题 = 文件名);随后打开论文窗口反馈。 */
function attachPdfFile(file: File): void {
  const reader = new FileReader()
  reader.onload = () => {
    const data = String(reader.result ?? '')
    const title = file.name.replace(/\.pdf$/i, '').trim()
    void post('attach-pdf', { data, title })
      .then(r => {
        if (!r?.ok) throw new Error(r?.error ?? 'attach failed')
        openWindow()
        window.setTimeout(() => {
          setWinStatus(r.created
            ? `✅ 已添加《${r.title}》(${r.pages} 页,标题=文件名)`
            : `✅ 已归档到《${r.title}》(${r.pages} 页)`)
        }, 120)
        void refreshWindow()
      })
      .catch(e => setWinStatus(e))
  }
  reader.onerror = () => setWinStatus('❌ PDF 读取失败')
  reader.readAsDataURL(file)
}
