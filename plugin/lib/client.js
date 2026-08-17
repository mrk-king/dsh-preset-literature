window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-paper-reading",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region src/client/index.ts
		const inject = ["slots", "sessions"];
		const API = "/dsh-paper-reading/api";
		async function post(path, body) {
			return (await fetch(`${API}/${path}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(body ?? {})
			})).json();
		}
		async function getJson(path) {
			return (await fetch(`${API}/${path}`)).json();
		}
		const S = {
			root: "padding:10px 12px;font-family:system-ui,sans-serif;font-size:12.5px;line-height:1.55;color:#1f2937;background:#f8fafc;border-bottom:1px solid #e5e7eb",
			row: "display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px",
			label: "font-weight:600;font-size:12px;color:#334155",
			select: "flex:1;min-width:120px;padding:3px 6px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;font-size:12px;color:#1f2937",
			input: "flex:1;min-width:120px;padding:3px 6px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;font-size:12px;color:#1f2937",
			textarea: "width:100%;box-sizing:border-box;min-height:64px;max-height:180px;resize:vertical;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;font-size:12px;color:#1f2937;font-family:inherit",
			btn: (color, danger = false) => `margin-right:0;padding:3px 9px;border-radius:5px;border:1px solid ${danger ? "#fca5a5" : "#cbd5e1"};background:${danger ? "#fef2f2" : "#fff"};color:${danger ? "#b91c1c" : "#334155"};cursor:pointer;font-size:12px`,
			status: "font-size:11.5px;color:#64748b;margin-top:4px;min-height:16px;white-space:pre-wrap",
			details: "margin-top:6px;border:1px solid #e2e8f0;border-radius:6px;background:#fff",
			summary: "padding:4px 8px;cursor:pointer;font-size:12px;color:#334155;user-select:none",
			pre: "white-space:pre-wrap;max-height:200px;overflow:auto;background:#fff;border-top:1px solid #e2e8f0;padding:6px 8px;margin:0;font-size:11.5px;color:#334155"
		};
		const TAB_ON = "flex:1;padding:3px 0;border:1px solid #94a3b8;border-radius:5px;background:#e2e8f0;color:#0f172a;cursor:pointer;font-size:12px;font-weight:600";
		const TAB_OFF = "flex:1;padding:3px 0;border:1px solid #e2e8f0;border-radius:5px;background:#fff;color:#64748b;cursor:pointer;font-size:12px";
		function fmtBytes(n) {
			if (!Number.isFinite(n) || n <= 0) return "?";
			if (n < 1024) return `${n} B`;
			if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
			return `${(n / 1024 / 1024).toFixed(1)} MB`;
		}
		function el(tag, style, text) {
			const node = document.createElement(tag);
			node.style.cssText = style;
			if (text !== void 0) node.textContent = text;
			return node;
		}
		const HINT_STYLE = [
			"position:fixed;z-index:2147483999;pointer-events:none;",
			"max-width:310px;padding:8px 10px;border-radius:8px;",
			"background:#1f2937;color:#f8fafc;font-size:12px;line-height:1.5;",
			"white-space:pre-wrap;box-shadow:0 6px 20px rgba(15,23,42,.35);",
			"border:1px solid #334155;"
		].join("");
		/** 鼠标悬停元素时显示用法提示气泡(自动避让视口边缘,移开即消失)。 */
		function attachHint(target, text) {
			let tip = null;
			const show = () => {
				if (tip) return;
				tip = el("div", HINT_STYLE, text);
				document.body.append(tip);
				const rect = target.getBoundingClientRect();
				const tw = tip.offsetWidth, th = tip.offsetHeight;
				const left = Math.max(8, Math.min(rect.left + rect.width / 2 - tw / 2, window.innerWidth - tw - 8));
				let top = rect.top - th - 8;
				if (top < 8) top = rect.bottom + 8;
				tip.style.left = `${left}px`;
				tip.style.top = `${top}px`;
			};
			const hide = () => {
				tip?.remove();
				tip = null;
			};
			target.addEventListener("mouseenter", show);
			target.addEventListener("mouseleave", hide);
		}
		function apply(ctx) {
			ctx.effect(() => ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "@dsh-external/dsh-paper-reading-panel",
				label: () => "📄 论文阅读",
				component: () => ({ render() {
					const root = el("div", S.root);
					const status = el("div", S.status, "加载中…");
					const paperSelect = el("select", S.select);
					paperSelect.title = "切换当前论文";
					const refreshBtn = el("button", S.btn(""), "🔄");
					refreshBtn.title = "刷新";
					const newPaperInput = el("input", S.input);
					newPaperInput.placeholder = "新论文标题(回车创建并切换)";
					newPaperInput.title = "输入论文标题后回车:创建并切换";
					const topRow = el("div", S.row);
					topRow.append(el("span", S.label, "📑 论文:"), paperSelect, refreshBtn);
					root.append(topRow);
					root.append(newPaperInput);
					const textarea = el("textarea", S.textarea);
					textarea.placeholder = "把文献里复制的文字粘贴到这里(可直接 Ctrl+V 粘贴图片),或在这里输入你的问题…";
					root.append(textarea);
					const askInput = el("input", S.input);
					askInput.placeholder = "可选:具体想问什么?(如\"解释这句的含义\")";
					const askRow = el("div", S.row);
					askRow.append(askInput);
					root.append(askRow);
					const captureBtn = el("button", S.btn(""), "🧹 收藏整理");
					captureBtn.title = "清洗排版并归档到当前论文,不发送给 AI";
					const askBtn = el("button", S.btn("", true), "❓ 提问解释");
					askBtn.title = "归档 + 发送给 AI 解释这段";
					const imageBtn = el("button", S.btn(""), "🖼️ 解读图片");
					imageBtn.title = "选择/粘贴图片 → OCR 归档 + 发送给 AI 解读";
					const imageInput = el("input", "display:none");
					imageInput.type = "file";
					imageInput.accept = "image/*";
					const actionRow = el("div", S.row);
					actionRow.append(captureBtn, askBtn, imageBtn, imageInput);
					root.append(actionRow);
					root.append(status);
					const quick = [
						["📖 总结全文", "请基于论文库归档内容(先 paper_summary scope=current)输出结构化全文总结:研究问题、方法、主要结果、局限与贡献;结尾用 paper_qa 把总结归档。"],
						["🔬 逐段精读", "请逐段精读论文库中已归档的内容(先 paper_summary scope=current),对每段给出通俗解释与关键信息,标记不懂处并主动提问。"],
						["🌐 翻译", "请将论文库中已归档的英文内容翻译为流畅的中文(先 paper_summary scope=current),术语给出中英对照,公式保留 LaTeX。"],
						["∑ 公式讲解", "请找出论文库归档内容中的全部公式(先 paper_summary scope=current),用 LaTeX 逐一写出并解释每个符号含义与推导思路。"],
						["🧠 批判性提问", "针对当前论文(先 paper_summary scope=current)提出 5-8 个批判性深挖问题(假设、数据、结论泛化、与相关工作对比等)。"],
						["📒 术语表", "提取当前论文归档内容中的术语(先 paper_summary scope=current),给出中文解释并用 paper_glossary add 逐条保存。"],
						["📓 今日小结", "请汇总今日阅读(paper_summary scope=today),输出一份读书笔记草稿:每篇论文一句话要点 + 我的疑问;结尾用 paper_qa 归档。"]
					];
					const quickRow = el("div", S.row);
					quickRow.style.borderTop = "1px solid #e2e8f0";
					quickRow.style.paddingTop = "6px";
					for (const [label, prompt] of quick) {
						const b = el("button", S.btn(""), label);
						b.onclick = () => {
							b.disabled = true;
							(async () => {
								const title = currentTitle();
								const r = await post("ask", { text: `【论文阅读 · ${label}】论文:${title || "(未选择)"}\n任务:${prompt}` });
								status.textContent = r?.chatPushed ? `✅ 已发送「${label}」给 AI(请查看对话区)` : "⚠️ 发送失败:未检测到活跃对话,请先在对话区发一条消息再试。";
							})().finally(() => {
								b.disabled = false;
							});
						};
						quickRow.append(b);
					}
					root.append(quickRow);
					const notesPre = el("pre", S.pre, "");
					const figuresPre = el("pre", S.pre, "");
					const glossaryPre = el("pre", S.pre, "");
					const notesDetails = el("details", S.details);
					const figuresDetails = el("details", S.details);
					const glossaryDetails = el("details", S.details);
					notesDetails.append(el("summary", S.summary, "📒 片段与问答(尾部)"), notesPre);
					figuresDetails.append(el("summary", S.summary, "🖼️ 图表转录"), figuresPre);
					glossaryDetails.append(el("summary", S.summary, "🔤 术语表"), glossaryPre);
					root.append(notesDetails, figuresDetails, glossaryDetails);
					let papers = [];
					let currentId = null;
					function currentTitle() {
						return papers.find((p) => p.id === currentId)?.title ?? "";
					}
					function renderPaperSelect() {
						const selected = currentId;
						paperSelect.innerHTML = "";
						const empty = el("option", "", "— 未选择论文 —");
						empty.value = "";
						paperSelect.append(empty);
						for (const p of papers) {
							const opt = el("option", "", p.title);
							opt.value = p.id;
							paperSelect.append(opt);
						}
						paperSelect.value = selected ?? "";
					}
					async function refreshStatus() {
						let s = null;
						try {
							s = await getJson("status");
						} catch {
							return;
						}
						if (!s?.ok) return;
						papers = s.papers ?? [];
						currentId = s.current?.id ?? null;
						renderPaperSelect();
						status.textContent = `论文库:${papers.length} 篇 · 当前:${s.current?.title ?? "(未选择)"} · 视觉:${s.vision ? "✅" : "❌"} · 对话推送:${s.chatPush ? "✅" : "❌(先在对话区发消息)"}`;
					}
					async function refreshNotes() {
						let n = null;
						try {
							n = await getJson("notes");
						} catch {
							return;
						}
						if (!n?.ok) return;
						if (notesDetails.open) notesPre.textContent = n.notes || "（空）";
						if (figuresDetails.open) figuresPre.textContent = n.figures || `（空 · 已存 ${n.figureCount ?? 0} 张图）`;
						if (glossaryDetails.open) glossaryPre.textContent = n.glossary || "（空）";
					}
					function setBusy(busy, ...btns) {
						for (const b of btns) b.disabled = busy;
					}
					function showError(e) {
						status.textContent = `❌ ${e instanceof Error ? e.message : String(e)}`;
					}
					paperSelect.onchange = () => {
						const id = paperSelect.value;
						if (!id) return;
						const p = papers.find((x) => x.id === id);
						if (!p) return;
						post("switch", { title: p.title }).then(() => refreshStatus()).catch(showError);
					};
					refreshBtn.onclick = () => {
						refreshStatus().catch(showError);
					};
					newPaperInput.onkeydown = (e) => {
						if (e.key !== "Enter") return;
						const title = newPaperInput.value.trim();
						if (!title) return;
						newPaperInput.value = "";
						post("switch", { title }).then(() => refreshStatus()).then(() => {
							status.textContent = `✅ 已切换:${title}`;
						}).catch(showError);
					};
					captureBtn.onclick = () => {
						const text = textarea.value;
						if (!text.trim()) {
							status.textContent = "⚠️ 先粘贴文字";
							return;
						}
						setBusy(true, captureBtn, askBtn, imageBtn);
						post("capture", {
							text,
							label: ""
						}).then((r) => {
							if (!r?.ok) throw new Error(r?.error ?? "capture failed");
							status.textContent = `✅ 已归档到《${r.paper?.title}》${r.duplicate ? "(重复内容,未重复保存)" : ""} · 清洗掉 ${r.droppedLines} 行杂项`;
							refreshNotes();
						}).catch(showError).finally(() => setBusy(false, captureBtn, askBtn, imageBtn));
					};
					askBtn.onclick = () => {
						const text = textarea.value;
						if (!text.trim()) {
							status.textContent = "⚠️ 先粘贴文字";
							return;
						}
						setBusy(true, captureBtn, askBtn, imageBtn);
						post("capture", {
							text,
							label: "",
							ask: true,
							question: askInput.value.trim() || void 0
						}).then((r) => {
							if (!r?.ok) throw new Error(r?.error ?? "capture failed");
							status.textContent = r.chatPushed ? `✅ 已归档并发送给 AI(清洗掉 ${r.droppedLines} 行杂项)` : "⚠️ 已归档,但发送失败:请先在对话区发一条消息激活对话。";
							textarea.value = "";
							askInput.value = "";
							refreshNotes();
						}).catch(showError).finally(() => setBusy(false, captureBtn, askBtn, imageBtn));
					};
					function handleImageFile(file) {
						if (!file.type.startsWith("image/")) {
							status.textContent = "⚠️ 仅支持图片文件";
							return;
						}
						setBusy(true, captureBtn, askBtn, imageBtn);
						const reader = new FileReader();
						reader.onload = () => {
							const data = String(reader.result ?? "");
							const question = askInput.value.trim() || void 0;
							post("read-image", {
								data,
								ext: `.${file.name.split(".").pop() ?? "png"}`,
								ask: true,
								question
							}).then((r) => {
								if (!r?.ok) throw new Error(r?.error ?? "read-image failed");
								status.textContent = r.chatPushed ? `✅ 图片已 OCR 归档并发送给 AI(${(r.transcript ?? "").length} 字转录)` : "⚠️ 图片已归档,但发送失败:请先在对话区发一条消息激活对话。";
								refreshNotes();
							}).catch(showError).finally(() => setBusy(false, captureBtn, askBtn, imageBtn));
						};
						reader.onerror = () => showError(/* @__PURE__ */ new Error("图片读取失败"));
						reader.readAsDataURL(file);
					}
					imageBtn.onclick = () => imageInput.click();
					imageInput.onchange = () => {
						const file = imageInput.files?.[0];
						if (file) handleImageFile(file);
						imageInput.value = "";
					};
					textarea.addEventListener("paste", (e) => {
						const file = e.clipboardData?.files?.[0];
						if (file && file.type.startsWith("image/")) {
							e.preventDefault();
							handleImageFile(file);
						}
					});
					const timer = window.setInterval(() => {
						refreshStatus().catch(() => {});
						refreshNotes().catch(() => {});
					}, 5e3);
					ctx.effect(() => () => {
						window.clearInterval(timer);
					}, "paper-reading: panel cleanup");
					refreshStatus().catch(() => {
						status.textContent = "⚠️ 后端 API 不可达(插件未注入?)";
					});
					return root;
				} })
			})), "@dsh-external/dsh-paper-reading: panel");
			setupRightWindow(ctx);
		}
		const WINDOW_ID = "dsh-paper-reading-window";
		const TOGGLE_ID = "dsh-paper-reading-toggle";
		let windowOpen = false;
		let windowTimer = 0;
		let currentPdfId = null;
		/** 预设门控:活跃会话属于允许预设时才有「📄 论文」按钮。 */
		let paperGateAllowed = false;
		/** 当前页面正在查看的会话 id(per-session 论文指针用)。 */
		let activeSid = "";
		/** 论文库快照(供标题搜索过滤)。 */
		let windowPapers = [];
		/** 文件夹快照。 */
		let windowFolders = [];
		/** 当前排序:'updated' | 'title' | 'created'。 */
		let windowSort = "updated";
		/** 归类弹窗正在编辑的论文标题。 */
		let folderModalPaper = null;
		/** 输入弹窗回调(提交时调用;关闭时清空)。 */
		let promptModalCb = null;
		let windowDom = null;
		function ensureWindowDom() {
			if (windowDom) return windowDom;
			const root = el("div", [
				"position:fixed;right:12px;top:52px;width:480px;height:min(740px,calc(100vh - 64px));min-width:360px;min-height:280px;z-index:2147483000;",
				"display:flex;flex-direction:column;border:1px solid #cbd5e1;border-radius:10px;",
				"background:#fff;box-shadow:0 8px 30px rgba(15,23,42,.18);",
				"font-family:system-ui,sans-serif;font-size:13.5px;line-height:1.6;color:#1f2937;"
			].join(""));
			root.id = WINDOW_ID;
			const header = el("div", "display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #e2e8f0;background:#f1f5f9;border-radius:10px 10px 0 0;cursor:grab;user-select:none");
			header.title = "拖动标题栏可移动窗口;拖四边或右下角可调整大小";
			header.append(el("span", "font-weight:700;font-size:14px", "📄 论文窗口"), el("button", "padding:3px 10px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;cursor:pointer;font-size:13px", "✕ 关闭"));
			header.lastElementChild.onclick = closeWindow;
			const BTN_SM = "padding:2px 8px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;cursor:pointer;font-size:12px";
			const toolRow = el("div", "display:flex;align-items:center;gap:6px;padding:6px 12px 4px");
			const search = el("input", "flex:1;min-width:0;padding:3px 8px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;font-size:12.5px");
			search.placeholder = "🔍 搜索论文标题…";
			const sortSel = el("select", "padding:2px 5px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;font-size:12px");
			sortSel.title = "排序方式";
			for (const [v, t] of [
				["updated", "最近更新"],
				["created", "创建时间"],
				["title", "标题"]
			]) {
				const opt = el("option", "", t);
				opt.value = v;
				sortSel.append(opt);
			}
			const dropHint = el("span", "flex:0 0 auto;font-size:11.5px;color:#64748b;border:1px dashed #cbd5e1;border-radius:999px;padding:2px 8px;white-space:nowrap", "📥 拖 PDF 添加");
			dropHint.title = "把 PDF 文件拖进窗口即可添加论文,标题默认取文件名(可随后重命名)";
			toolRow.append(search, sortSel, dropHint);
			sortSel.onchange = () => {
				windowSort = sortSel.value;
				renderPaperSelect();
			};
			const folderRow = el("div", "display:flex;align-items:center;gap:6px;padding:0 12px 4px");
			const folderSelect = el("select", "flex:1;min-width:0;padding:2px 5px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;font-size:12px");
			folderSelect.title = "按文件夹过滤(把论文条目拖到这里可移入所选文件夹)";
			const folderNewBtn = el("button", BTN_SM, "➕");
			folderNewBtn.title = "新建文件夹";
			const folderRenameBtn = el("button", BTN_SM, "✏️");
			folderRenameBtn.title = "重命名「文件夹」下拉中选中的文件夹";
			const folderDeleteBtn = el("button", BTN_SM, "🗑️");
			folderDeleteBtn.title = "删除「文件夹」下拉中选中的文件夹(论文移回未分类)";
			folderRow.append(el("span", "font-weight:600;font-size:12px", "📁"), folderSelect, folderNewBtn, folderRenameBtn, folderDeleteBtn);
			const paperRow = el("div", "display:flex;align-items:center;gap:6px;padding:0 12px 6px");
			const paperSelect = el("select", "flex:1;min-width:0;padding:2px 5px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;font-size:12px");
			paperSelect.title = "论文下拉(按搜索与文件夹过滤;拖 PDF 到此处添加)";
			const paperFoldBtn = el("button", BTN_SM, "📁");
			paperFoldBtn.title = "归类当前论文到文件夹(可多选)";
			const paperRenameBtn = el("button", BTN_SM, "✏️");
			paperRenameBtn.title = "重命名当前论文";
			const paperDeleteBtn = el("button", BTN_SM, "🗑️");
			paperDeleteBtn.title = "删除当前论文(进回收站,30 天后清除)";
			paperRow.append(el("span", "font-weight:600;font-size:12px", "📚"), paperSelect, paperFoldBtn, paperRenameBtn, paperDeleteBtn);
			paperSelect.addEventListener("dragover", (e) => {
				if (e.dataTransfer?.types.includes("Files")) {
					e.preventDefault();
					paperSelect.style.borderColor = "#38bdf8";
					paperSelect.style.borderStyle = "dashed";
					const f = e.dataTransfer.files?.[0];
					setWinStatus(f ? `📥 松开添加《${f.name}》(标题=文件名)` : "📥 松开添加 PDF");
				}
			});
			paperSelect.addEventListener("dragleave", () => {
				paperSelect.style.borderColor = "";
				paperSelect.style.borderStyle = "";
			});
			const folderModal = el("div", "position:absolute;inset:0;z-index:40;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.25);border-radius:10px");
			const folderModalCard = el("div", "width:260px;max-height:70%;display:flex;flex-direction:column;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 10px 30px rgba(15,23,42,.25);overflow:hidden");
			const folderModalTitle = el("span", "padding:8px 12px;font-size:13px;font-weight:600;color:#334155;border-bottom:1px solid #e2e8f0", "📁 归类");
			const folderModalList = el("div", "flex:1;overflow-y:auto;padding:8px 12px;font-size:12.5px");
			const modalBtnRow = el("div", "display:flex;gap:6px;justify-content:flex-end;padding:8px 12px;border-top:1px solid #e2e8f0");
			const folderModalSave = el("button", BTN_SM, "💾 保存");
			const folderModalCancel = el("button", BTN_SM, "↩️ 取消");
			modalBtnRow.append(folderModalSave, folderModalCancel);
			folderModalCard.append(folderModalTitle, folderModalList, modalBtnRow);
			folderModal.append(folderModalCard);
			folderModal.onclick = (e) => {
				if (e.target === folderModal) closeFolderModal();
			};
			folderModalCancel.onclick = closeFolderModal;
			folderModalSave.onclick = () => {
				const title = folderModalPaper;
				if (!title) {
					closeFolderModal();
					return;
				}
				const checked = [];
				for (const cb of folderModalList.querySelectorAll("input[type=checkbox]")) if (cb.checked) checked.push(cb.value);
				folderModalSave.disabled = true;
				post("folder-assign", {
					title,
					folders: checked
				}).then((r) => {
					if (!r?.ok) throw new Error(r?.error ?? "assign failed");
					setWinStatus(`📁 已更新《${title}》的文件夹(${checked.length} 个)`);
				}).catch((e) => setWinStatus(e)).finally(() => {
					folderModalSave.disabled = false;
					closeFolderModal();
					refreshWindow();
				});
			};
			const promptModal = el("div", "position:absolute;inset:0;z-index:41;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.25);border-radius:10px");
			const promptCard = el("div", "width:280px;display:flex;flex-direction:column;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 10px 30px rgba(15,23,42,.25);overflow:hidden");
			const promptTitle = el("span", "padding:8px 12px;font-size:13px;font-weight:600;color:#334155;border-bottom:1px solid #e2e8f0", "输入");
			const promptInput = el("input", "margin:10px 12px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px");
			const promptBtnRow = el("div", "display:flex;gap:6px;justify-content:flex-end;padding:0 12px 10px");
			const promptOk = el("button", BTN_SM, "✅ 确定");
			const promptCancel = el("button", BTN_SM, "↩️ 取消");
			promptBtnRow.append(promptOk, promptCancel);
			promptCard.append(promptTitle, promptInput, promptBtnRow);
			promptModal.append(promptCard);
			promptModal.onclick = (e) => {
				if (e.target === promptModal) closePromptModal();
			};
			promptCancel.onclick = closePromptModal;
			promptOk.onclick = () => {
				const cb = promptModalCb;
				const value = promptInput.value.trim();
				closePromptModal();
				if (cb && value) cb(value);
			};
			promptInput.onkeydown = (e) => {
				if (e.key !== "Enter") return;
				const cb = promptModalCb;
				const value = promptInput.value.trim();
				closePromptModal();
				if (cb && value) cb(value);
			};
			window.addEventListener("keydown", (e) => {
				if (e.key !== "Escape") return;
				closePromptModal();
				closeFolderModal();
			});
			search.oninput = () => renderPaperSelect();
			search.onkeydown = (e) => {
				if (e.key !== "Enter") return;
				const q = search.value.trim().toLowerCase();
				if (!q) return;
				const candidates = windowPapers.filter((p) => p.title.toLowerCase().includes(q));
				if (candidates.length === 0) {
					setWinStatus("⚠️ 没有匹配的论文");
					return;
				}
				applySort(candidates);
				const target = candidates[0];
				post(`switch?sid=${encodeURIComponent(activeSid)}`, { title: target.title }).then((r) => {
					if (!r?.ok) throw new Error(r?.error ?? "switch failed");
					setWinStatus(`🔍 已跳转到《${target.title}》`);
					refreshWindow();
				}).catch((e) => setWinStatus(e));
			};
			folderSelect.onchange = () => renderPaperSelect();
			paperSelect.onchange = () => {
				const id = paperSelect.value;
				const opt = Array.from(paperSelect.options).find((o) => o.value === id);
				if (!opt || !id) return;
				post(`switch?sid=${encodeURIComponent(activeSid)}`, { title: opt.textContent ?? id }).then((r) => {
					if (!r?.ok) throw new Error(r?.error ?? "switch failed");
					refreshWindow();
				}).catch((e) => setWinStatus(e));
			};
			paperFoldBtn.onclick = () => {
				const t = selectedPaperTitle();
				if (!t) {
					setWinStatus("⚠️ 先选择一篇论文");
					return;
				}
				openFolderModal(t);
			};
			paperRenameBtn.onclick = () => {
				const t = selectedPaperTitle();
				if (!t) {
					setWinStatus("⚠️ 先选择一篇论文");
					return;
				}
				renamePaperAction(t);
			};
			paperDeleteBtn.onclick = () => {
				const t = selectedPaperTitle();
				if (!t) {
					setWinStatus("⚠️ 先选择一篇论文");
					return;
				}
				deletePaperAction(t);
			};
			folderNewBtn.onclick = () => {
				windowPrompt("➕ 新建文件夹", "", "文件夹名称…", (name) => {
					post("folder-create", { name }).then((r) => {
						if (!r?.ok) throw new Error(r?.error ?? "create failed");
						setWinStatus(`📁 已新建文件夹《${r.folder.name}》`);
						refreshWindow();
					}).catch((e) => setWinStatus(e));
				});
			};
			folderRenameBtn.onclick = () => {
				const fid = folderSelect.value;
				if (fid === "all" || fid === "none") {
					setWinStatus("⚠️ 先在「文件夹」下拉选中一个文件夹");
					return;
				}
				renameFolderAction(fid);
			};
			folderDeleteBtn.onclick = () => {
				const fid = folderSelect.value;
				if (fid === "all" || fid === "none") {
					setWinStatus("⚠️ 先在「文件夹」下拉选中一个文件夹");
					return;
				}
				deleteFolderAction(fid);
			};
			folderSelect.addEventListener("dragover", (e) => {
				if (e.dataTransfer?.types.includes("text/plain")) {
					e.preventDefault();
					folderSelect.style.borderColor = "#94a3b8";
				}
			});
			folderSelect.addEventListener("dragleave", () => {
				folderSelect.style.borderColor = "";
			});
			folderSelect.addEventListener("drop", (e) => {
				e.preventDefault();
				folderSelect.style.borderColor = "";
				const title = e.dataTransfer?.getData("text/plain");
				if (!title) return;
				const fid = folderSelect.value;
				const paper = windowPapers.find((p) => p.title === title);
				if (fid === "all") {
					setWinStatus("⚠️ 请先在下拉里选中目标文件夹(或「未分类」)再拖放");
					return;
				}
				const own = paper?.folders ?? [];
				const folders = fid === "none" ? [] : own.includes(fid) ? own : [...own, fid];
				post("folder-assign", {
					title,
					folders
				}).then((r) => {
					if (!r?.ok) throw new Error(r?.error ?? "assign failed");
					setWinStatus(`📁 已更新《${title}》的文件夹(${folders.length} 个)`);
					refreshWindow();
				}).catch((e) => setWinStatus(e));
			});
			const status = el("div", "padding:0 12px 6px;font-size:12.5px;color:#475569", "");
			const tabRow = el("div", "display:flex;gap:4px;padding:0 10px 6px");
			const tabPdf = el("button", TAB_ON, "📄 论文 PDF");
			const tabNotes = el("button", TAB_OFF, "📒 笔记");
			tabRow.append(tabPdf, tabNotes);
			attachHint(tabPdf, "📄 论文 PDF\n\npdf.js 阅读器:文字/图片可直接选中复制;工具条支持缩放/搜索/翻页/旋转;PDF 可直接拖进窗口归档。");
			attachHint(tabNotes, "📒 笔记 = 论文阅读存档\n\n· 在对话中提问论文 → AI 自动归档问答\n· 解释过的术语 → 自动存入术语表\n· 粘贴的文字/图表 → 归档为片段与转录\n\n内容会自动出现在本 tab,每 5 秒刷新。\n查看本 tab 顶部提示了解完整用法。");
			const pdfPane = el("div", "flex:1;display:flex;flex-direction:column;margin:0 12px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;overflow:hidden");
			const pdfInfo = el("div", "padding:5px 10px;font-size:12.5px;color:#334155;border-bottom:1px solid #e2e8f0", "");
			const pdfFrame = document.createElement("iframe");
			pdfFrame.style.cssText = "flex:1;border:0;width:100%;background:#fff";
			pdfFrame.title = "论文 PDF";
			const pdfHint = el("div", "flex:1;display:flex;align-items:center;justify-content:center;padding:12px;font-size:13px;color:#64748b;text-align:center;border:2px dashed #e2e8f0;border-radius:6px;margin:8px;background:#f8fafc", "把 PDF 拖到这里添加论文\n标题默认 = 文件名(可重命名)\n同名论文则归档到它");
			pdfHint.style.whiteSpace = "pre-line";
			pdfPane.append(pdfInfo, pdfFrame, pdfHint);
			const notesPane = el("div", "flex:1;display:flex;flex-direction:column;margin:0 12px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;overflow:hidden");
			const notesHeader = el("div", "display:flex;align-items:center;gap:6px;padding:5px 10px;border-bottom:1px solid #e2e8f0;background:#f8fafc");
			const notesTitle = el("span", "font-size:13px;font-weight:600;color:#334155", "📒 笔记");
			const notesStats = el("span", "font-size:11.5px;color:#64748b", "");
			const notesEdit = el("button", BTN_SM, "✏️ 编辑");
			notesEdit.title = "在窗口内直接编辑本文的笔记(内容 = notes.md 全文)";
			const notesSave = el("button", BTN_SM, "💾 保存");
			const notesCancel = el("button", BTN_SM, "↩️ 取消");
			notesSave.style.display = "none";
			notesCancel.style.display = "none";
			notesHeader.append(notesTitle, notesStats, notesEdit, notesSave, notesCancel);
			notesPane.append(notesHeader);
			attachHint(notesHeader, [
				"📒 笔记如何形成:",
				"",
				"1) 自动:对话中问论文问题,AI 用 paper_qa 归档问答;",
				"   解释的术语存入术语表;粘贴文字/图表归档片段与转录。",
				"2) 主动:对话区「📄 论文阅读」面板的「🧹 收藏整理」",
				"   「❓ 提问解释」及快捷动作(总结全文/术语表/今日小结等)",
				"   会把结果写进当前论文笔记。",
				"3) 手动:点「✏️ 编辑」直接在窗口里改全文。",
				"",
				"📂 笔记文件(纯文本):",
				"~/Documents/papers-library/papers/<论文>/",
				"   notes.md  (问答与片段)",
				"   glossary.md (术语表)",
				"   figures.md (图表转录)",
				"",
				"🔎 跨论文检索:直接问 AI「哪篇论文写过 XXX」"
			].join("\n"));
			const notes = el("pre", "flex:1;overflow:auto;white-space:pre-wrap;padding:10px 12px;margin:0;font-size:13px;line-height:1.65;color:#1f2937", "");
			const notesArea = el("textarea", "flex:1;box-sizing:border-box;width:100%;resize:none;padding:10px 12px;border:0;outline:0;font-size:13px;line-height:1.65;font-family:inherit;color:#1f2937;background:#fff");
			notesArea.placeholder = "在此编辑当前论文的笔记(全文=notes.md)…";
			notesArea.style.display = "none";
			const exitEdit = () => {
				notes.style.display = "flex";
				notesArea.style.display = "none";
				notesEdit.style.display = "";
				notesSave.style.display = "none";
				notesCancel.style.display = "none";
			};
			notesEdit.onclick = () => {
				getJson(`notes?sid=${encodeURIComponent(activeSid)}`).then((n) => {
					if (!n?.ok) throw new Error(n?.error ?? "notes failed");
					notesArea.value = n.notesFull ?? n.notes ?? "";
					notes.style.display = "none";
					notesArea.style.display = "flex";
					notesEdit.style.display = "none";
					notesSave.style.display = "";
					notesCancel.style.display = "";
				}).catch((e) => setWinStatus(e));
			};
			notesSave.onclick = () => {
				notesSave.disabled = true;
				post(`save-notes?sid=${encodeURIComponent(activeSid)}`, { text: notesArea.value }).then((r) => {
					if (!r?.ok) throw new Error(r?.error ?? "save failed");
					exitEdit();
					setWinStatus(`💾 已保存(${r.savedChars} 字)`);
					refreshNotes();
				}).catch((e) => setWinStatus(e)).finally(() => {
					notesSave.disabled = false;
				});
			};
			notesCancel.onclick = exitEdit;
			notesPane.append(notes, notesArea);
			const hLeft = el("div", "position:absolute;left:-5px;top:0;bottom:0;width:6px;cursor:ew-resize;z-index:6");
			const hRight = el("div", "position:absolute;right:-5px;top:0;bottom:0;width:6px;cursor:ew-resize;z-index:6");
			const hTop = el("div", "position:absolute;left:0;right:0;top:-5px;height:6px;cursor:ns-resize;z-index:6");
			const hBottom = el("div", "position:absolute;left:0;right:0;bottom:-5px;height:6px;cursor:ns-resize;z-index:6");
			const hCorner = el("div", "position:absolute;right:-5px;bottom:-5px;width:14px;height:14px;cursor:nwse-resize;z-index:6;background:radial-gradient(circle at 100% 100%,#64748b 3px,transparent 4px)");
			root.append(header, toolRow, folderRow, paperRow, folderModal, promptModal, status, tabRow, pdfPane, notesPane, hLeft, hRight, hTop, hBottom, hCorner);
			bindMove(header);
			bindResize(hLeft, "w");
			bindResize(hRight, "e");
			bindResize(hTop, "n");
			bindResize(hBottom, "s");
			bindResize(hCorner, "sw");
			function showPane(which) {
				pdfPane.style.display = which === "pdf" ? "flex" : "none";
				notesPane.style.display = which === "notes" ? "flex" : "none";
				tabPdf.style.cssText = which === "pdf" ? TAB_ON : TAB_OFF;
				tabNotes.style.cssText = which === "notes" ? TAB_ON : TAB_OFF;
			}
			tabPdf.onclick = () => showPane("pdf");
			tabNotes.onclick = () => showPane("notes");
			showPane("pdf");
			root.addEventListener("dragover", (e) => {
				if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
			});
			root.addEventListener("drop", (e) => {
				const file = e.dataTransfer?.files?.[0];
				if (!file || !/\.pdf$/i.test(file.name)) return;
				e.preventDefault();
				paperSelect.style.borderColor = "";
				paperSelect.style.borderStyle = "";
				setWinStatus(`📤 上传 PDF:${file.name}(${fmtBytes(file.size)})…`);
				const reader = new FileReader();
				reader.onload = () => {
					post("attach-pdf", {
						data: String(reader.result ?? ""),
						title: file.name.replace(/\.pdf$/i, "").trim()
					}).then((r) => {
						if (!r?.ok) throw new Error(r?.error ?? "attach failed");
						setWinStatus(r.created ? `✅ 已添加《${r.title}》(${r.pages} 页,标题=文件名)` : `✅ 已归档到《${r.title}》(${r.pages} 页)`);
						refreshWindow();
					}).catch((e) => setWinStatus(e));
				};
				reader.onerror = () => setWinStatus("❌ PDF 读取失败");
				reader.readAsDataURL(file);
			});
			if (!root.isConnected) document.body.append(root);
			windowDom = {
				root,
				search,
				sortSel,
				folderSelect,
				folderNewBtn,
				folderRenameBtn,
				folderDeleteBtn,
				paperSelect,
				paperFoldBtn,
				paperRenameBtn,
				paperDeleteBtn,
				folderModal,
				folderModalList,
				folderModalSave,
				folderModalCancel,
				folderModalTitle,
				promptModal,
				promptTitle,
				promptInput,
				promptOk,
				promptCancel,
				curId: null,
				status,
				notes,
				notesStats,
				notesEdit,
				notesSave,
				notesCancel,
				notesArea,
				pdfPane,
				notesPane,
				pdfFrame,
				pdfHint,
				pdfInfo,
				tabPdf,
				tabNotes
			};
			return windowDom;
		}
		/** 当前下拉选中的论文标题;无选中返回 null。 */
		function selectedPaperTitle() {
			const dom = windowDom;
			if (!dom || !dom.paperSelect.value) return null;
			return Array.from(dom.paperSelect.options).find((o) => o.value === dom.paperSelect.value)?.textContent?.trim() || null;
		}
		/** 打开输入弹窗;onSubmit 收到非空值后执行。 */
		function windowPrompt(title, initial, placeholder, onSubmit) {
			const dom = windowDom;
			if (!dom) return;
			promptModalCb = onSubmit;
			dom.promptTitle.textContent = title;
			dom.promptInput.value = initial;
			dom.promptInput.placeholder = placeholder;
			dom.promptModal.style.display = "flex";
			dom.promptInput.focus();
			dom.promptInput.select();
		}
		function closePromptModal() {
			const dom = windowDom;
			if (!dom) return;
			dom.promptModal.style.display = "none";
			promptModalCb = null;
		}
		function renamePaperAction(oldTitle) {
			windowPrompt("✏️ 重命名论文", oldTitle, "新的论文标题…", (newTitle) => {
				if (newTitle === oldTitle) return;
				post("rename-paper", {
					title: oldTitle,
					newTitle
				}).then((r) => {
					if (!r?.ok) throw new Error(r?.error ?? "rename failed");
					setWinStatus(`✏️ 已重命名为《${r.paper.title}》`);
					refreshWindow();
				}).catch((e) => setWinStatus(e));
			});
		}
		function deletePaperAction(title) {
			if (!window.confirm(`确定删除《${title}》?\n将移入回收站(30 天后自动清除),可联系 AI 恢复。`)) return;
			post("delete-paper", { title }).then((r) => {
				if (!r?.ok) throw new Error(r?.error ?? "delete failed");
				setWinStatus(`🗑️ 已删除《${r.deleted}》`);
				refreshWindow();
			}).catch((e) => setWinStatus(e));
		}
		function renameFolderAction(fid) {
			const folder = windowFolders.find((f) => f.id === fid);
			if (!folder) return;
			windowPrompt("✏️ 重命名文件夹", folder.name, "新的文件夹名称…", (newName) => {
				if (newName === folder.name) return;
				post("folder-rename", {
					id: fid,
					newName
				}).then((r) => {
					if (!r?.ok) throw new Error(r?.error ?? "rename failed");
					setWinStatus(`📁 已重命名为《${newName}》`);
					refreshWindow();
				}).catch((e) => setWinStatus(e));
			});
		}
		function deleteFolderAction(fid) {
			const folder = windowFolders.find((f) => f.id === fid);
			if (!folder) return;
			if (!window.confirm(`确定删除文件夹《${folder.name}》?其中论文将移回「未分类」。`)) return;
			post("folder-delete", { id: fid }).then((r) => {
				if (!r?.ok) throw new Error(r?.error ?? "delete failed");
				setWinStatus(`🗑️ 已删除文件夹《${folder.name}》`);
				refreshWindow();
			}).catch((e) => setWinStatus(e));
		}
		/** 打开归类弹窗(勾选多个文件夹)。 */
		function openFolderModal(paperTitle) {
			const dom = windowDom;
			if (!dom) return;
			folderModalPaper = paperTitle;
			const own = windowPapers.find((p) => p.title === paperTitle)?.folders ?? [];
			dom.folderModalTitle.textContent = `📁 归类:《${paperTitle}》(可多选)`;
			dom.folderModalList.innerHTML = "";
			for (const f of windowFolders) {
				const row = el("label", "display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer");
				const cb = el("input", "");
				cb.type = "checkbox";
				cb.value = f.id;
				cb.checked = own.includes(f.id);
				row.append(cb, el("span", "", `📂 ${f.name}`));
				dom.folderModalList.append(row);
			}
			if (windowFolders.length === 0) dom.folderModalList.append(el("div", "color:#94a3b8;padding:4px 0", "还没有文件夹,先在下方 ➕ 新建"));
			dom.folderModal.style.display = "flex";
		}
		function closeFolderModal() {
			const dom = windowDom;
			if (!dom) return;
			dom.folderModal.style.display = "none";
			folderModalPaper = null;
		}
		/** 重建文件夹过滤下拉(全部/未分类/各文件夹),保留当前选择。 */
		function renderFolderSelect() {
			const dom = windowDom;
			if (!dom) return;
			const keep = dom.folderSelect.value;
			dom.folderSelect.innerHTML = "";
			const groups = [
				["all", "🗂️ 全部"],
				["none", "📄 未分类"],
				...windowFolders.map((f) => [f.id, `📂 ${f.name}`])
			];
			for (const [v, t] of groups) {
				const opt = el("option", "", t);
				opt.value = v;
				dom.folderSelect.append(opt);
			}
			dom.folderSelect.value = groups.some(([v]) => v === keep) ? keep : "all";
		}
		/** 渲染论文列表(搜索词 + 文件夹过滤 + 排序;hover 归类/重命名/删除;可拖出)。 */
		/** 按当前排序方式对论文列表排序(原地)。 */
		function applySort(papers) {
			papers.sort((a, b) => {
				if (windowSort === "title") return a.title.localeCompare(b.title, "zh");
				const ka = windowSort === "created" ? a.createdAt : a.updatedAt;
				return ((windowSort === "created" ? b.createdAt : b.updatedAt) || "").localeCompare(ka || "");
			});
		}
		/** 渲染论文下拉(搜索词 + 文件夹过滤 + 排序;值 = 当前论文)。 */
		function renderPaperSelect() {
			const dom = windowDom;
			if (!dom) return;
			const q = dom.search.value.trim().toLowerCase();
			const ff = dom.folderSelect.value;
			const papers = windowPapers.filter((p) => {
				if (q && !p.title.toLowerCase().includes(q)) return false;
				const own = p.folders ?? [];
				if (ff === "none") return own.length === 0;
				if (ff !== "all") return own.includes(ff);
				return true;
			});
			applySort(papers);
			const keep = dom.paperSelect.value;
			dom.paperSelect.innerHTML = "";
			if (papers.length === 0) {
				const empty = el("option", "", q ? "没有匹配的论文" : "还没有论文 — 拖 PDF 添加");
				empty.value = "";
				dom.paperSelect.append(empty);
			} else for (const p of papers) {
				const opt = el("option", "", p.title);
				opt.value = p.id;
				dom.paperSelect.append(opt);
			}
			if (keep && windowPapers.some((p) => p.id === keep)) dom.paperSelect.value = keep;
			const hasSel = Boolean(dom.paperSelect.value);
			dom.paperFoldBtn.disabled = !hasSel;
			dom.paperRenameBtn.disabled = !hasSel;
			dom.paperDeleteBtn.disabled = !hasSel;
		}
		function bindResize(handle, dir) {
			handle.addEventListener("pointerdown", (e) => {
				e.preventDefault();
				const root = windowDom.root;
				const sx = e.clientX, sy = e.clientY;
				const sw = root.offsetWidth, sh = root.offsetHeight;
				const rect = root.getBoundingClientRect();
				const ox = rect.left;
				const top0 = rect.top;
				const right0 = window.innerWidth - rect.right;
				const anchoredRight = root.style.right !== "auto" && root.style.right !== "";
				document.body.style.userSelect = "none";
				windowDom.pdfFrame.style.pointerEvents = "none";
				let last = null;
				let raf = 0;
				const apply = () => {
					raf = 0;
					if (!last) return;
					const ev = last;
					const dx = ev.clientX - sx;
					const dy = ev.clientY - sy;
					let w = sw, h = sh;
					if (dir === "w") {
						w = Math.max(360, sw - dx);
						if (!anchoredRight) root.style.left = `${Math.max(8, ox + dx)}px`;
					} else if (dir === "e") {
						w = Math.max(360, sw + dx);
						if (anchoredRight) root.style.right = `${Math.max(8, right0 - dx)}px`;
					} else if (dir === "sw") w = Math.max(360, anchoredRight ? sw - dx : sw + dx);
					if (dir === "n") {
						h = Math.max(280, sh - dy);
						root.style.top = `${Math.max(8, top0 + dy)}px`;
					} else if (dir === "s" || dir === "sw") h = Math.max(280, sh + dy);
					root.style.width = `${w}px`;
					root.style.height = `${h}px`;
					document.documentElement.style.setProperty("--paper-dock-w", `${w}px`);
				};
				const move = (ev) => {
					last = ev;
					if (!raf) raf = requestAnimationFrame(apply);
				};
				const up = () => {
					if (raf) cancelAnimationFrame(raf);
					last = null;
					windowDom.pdfFrame.style.pointerEvents = "";
					document.body.style.userSelect = "";
					window.removeEventListener("pointermove", move);
					window.removeEventListener("pointerup", up);
				};
				window.addEventListener("pointermove", move);
				window.addEventListener("pointerup", up);
			});
		}
		function bindMove(handle) {
			handle.addEventListener("pointerdown", (e) => {
				if (e.target.closest("button")) return;
				e.preventDefault();
				const root = windowDom.root;
				const rect = root.getBoundingClientRect();
				const sx = e.clientX, sy = e.clientY;
				const ox = rect.left, oy = rect.top;
				document.body.style.userSelect = "none";
				root.style.willChange = "transform";
				let lx = 0, ly = 0;
				const move = (ev) => {
					lx = Math.max(8 - ox, ev.clientX - sx);
					ly = Math.max(8 - oy, ev.clientY - sy);
					root.style.transform = `translate3d(${lx}px, ${ly}px, 0)`;
				};
				const up = () => {
					root.style.transform = "";
					root.style.willChange = "";
					root.style.right = "auto";
					root.style.left = `${Math.max(8, ox + lx)}px`;
					root.style.top = `${Math.max(8, oy + ly)}px`;
					document.body.style.userSelect = "";
					window.removeEventListener("pointermove", move);
					window.removeEventListener("pointerup", up);
				};
				window.addEventListener("pointermove", move);
				window.addEventListener("pointerup", up);
			});
		}
		function setWinStatus(e) {
			if (!windowDom) return;
			windowDom.status.textContent = e instanceof Error ? `❌ ${e.message}` : String(e);
		}
		async function refreshWindow() {
			if (!windowDom) return;
			let s = null;
			try {
				s = await getJson(`status?sid=${encodeURIComponent(activeSid)}`);
			} catch {
				return;
			}
			if (!s?.ok) return;
			windowFolders = (s.folders ?? []).map((f) => ({
				id: f.id,
				name: f.name
			}));
			windowPapers = (s.papers ?? []).map((p) => ({
				id: p.id,
				title: p.title,
				folders: Array.isArray(p.folders) ? p.folders : [],
				createdAt: p.createdAt ?? "",
				updatedAt: p.updatedAt ?? ""
			}));
			windowDom.curId = s.current?.id ?? null;
			renderFolderSelect();
			renderPaperSelect();
			const pid = s.current?.id ?? null;
			const pdf = s.pdf;
			if (pid && pdf) {
				if (currentPdfId !== pid) {
					currentPdfId = pid;
					const pdfUrl = `/dsh-paper-reading/api/paper-pdf/${encodeURIComponent(pid)}`;
					windowDom.pdfFrame.src = `/dsh-paper-reading/pdfjs-legacy/web/viewer.html?file=${encodeURIComponent(pdfUrl)}#zoom=page-width`;
					windowDom.pdfFrame.style.display = "block";
					windowDom.pdfHint.style.display = "none";
				}
				windowDom.pdfInfo.textContent = `📄 ${pdf.title} · ${pdf.pages} 页 · ${fmtBytes(pdf.bytes)} — 文字/图片可直接选中复制`;
			} else {
				currentPdfId = null;
				windowDom.pdfFrame.style.display = "none";
				windowDom.pdfFrame.removeAttribute("src");
				windowDom.pdfHint.style.display = "flex";
				windowDom.pdfInfo.textContent = pid ? "(未归档 PDF — 拖入或发给 AI)" : "(未选择论文)";
			}
			let n = null;
			try {
				n = await getJson(`notes?sid=${encodeURIComponent(activeSid)}`);
			} catch {
				return;
			}
			if (n?.ok && n.paper) {
				const full = n.notesFull ?? "";
				const qaCount = (full.match(/## 💬 Q&A/g) || []).length;
				windowDom.notesStats.textContent = qaCount > 0 ? `${qaCount} 条问答 · ${full.length} 字` : "";
				if (String(n.notes ?? "").trim()) {
					windowDom.notes.textContent = n.notes;
					windowDom.notes.style.color = "#1f2937";
				} else {
					windowDom.notes.textContent = "暂无笔记\n\n在对话中提问论文,AI 会自动归档问答与术语;也可以点「✏️ 编辑」手动写。";
					windowDom.notes.style.color = "#94a3b8";
				}
			} else {
				windowDom.notes.textContent = "(未选择论文)";
				windowDom.notes.style.color = "#94a3b8";
				windowDom.notesStats.textContent = "";
			}
		}
		function openWindow() {
			const dom = ensureWindowDom();
			dom.root.style.display = "flex";
			windowOpen = true;
			setDock(true);
			const toggle = document.getElementById(TOGGLE_ID);
			if (toggle) toggle.style.display = "none";
			refreshWindow().catch(() => {});
			if (!windowTimer) windowTimer = window.setInterval(() => {
				if (!windowOpen) return;
				refreshWindow().catch(() => {});
			}, 5e3);
		}
		function closeWindow() {
			windowOpen = false;
			setDock(false);
			if (windowDom) windowDom.root.style.display = "none";
			const toggle = document.getElementById(TOGGLE_ID);
			if (toggle) toggle.style.display = "flex";
			if (windowTimer) {
				window.clearInterval(windowTimer);
				windowTimer = 0;
			}
		}
		function ensureDockStyle() {
			if (document.getElementById("paper-dock-style")) return;
			const st = document.createElement("style");
			st.id = "paper-dock-style";
			st.textContent = ["[data-conversation-scroll]{transition:padding-right .18s ease}", "body.paper-docked [data-conversation-scroll]{padding-right:var(--paper-dock-w,480px) !important}"].join("\n");
			document.head.append(st);
		}
		/** 打开前的窗口高度(关闭停靠时恢复)。 */
		let dockPrevHeight = null;
		/** 开/关停靠:消息区让出窗口宽度;窗口高度上限 = 聊天框顶部之上。 */
		function setDock(open) {
			document.body.classList.toggle("paper-docked", open);
			const dom = windowDom;
			if (!dom) return;
			if (open) {
				document.documentElement.style.setProperty("--paper-dock-w", `${dom.root.offsetWidth}px`);
				const seat = document.querySelector("[data-composer-seat],[data-composer-card],[data-input-scroll]");
				if (seat) {
					const seatTop = seat.getBoundingClientRect().top;
					const maxH = Math.max(280, seatTop - 52 - 8);
					if (dom.root.offsetHeight > maxH) {
						dockPrevHeight = dom.root.offsetHeight;
						dom.root.style.height = `${maxH}px`;
					}
				}
			} else if (dockPrevHeight !== null) {
				dom.root.style.height = `${dockPrevHeight}px`;
				dockPrevHeight = null;
			}
		}
		function setupRightWindow(ctx) {
			ctx.effect(() => () => {
				document.removeEventListener("dragover", onPageDragOver, true);
				document.removeEventListener("drop", onPageDrop, true);
				closeWindow();
				document.body.classList.remove("paper-docked");
				document.getElementById(WINDOW_ID)?.remove();
				document.getElementById(TOGGLE_ID)?.remove();
			}, "paper-reading: right window cleanup");
			ensureDockStyle();
			let toggle = null;
			const ensureToggle = () => {
				if (toggle) return;
				toggle = el("button", [
					"position:fixed;right:14px;bottom:16px;z-index:2147483001;padding:7px 13px;",
					"border:1px solid #cbd5e1;border-radius:999px;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.15);",
					"cursor:pointer;font-size:13px;color:#334155;"
				].join(""), "📄 论文");
				toggle.id = TOGGLE_ID;
				toggle.onclick = () => openWindow();
				document.body.append(toggle);
			};
			const applyGate = (allowed) => {
				if (allowed === paperGateAllowed) return;
				paperGateAllowed = allowed;
				if (allowed) ensureToggle();
				else {
					closeWindow();
					toggle?.remove();
					toggle = null;
				}
			};
			const pollGate = () => {
				let sid = "";
				try {
					sid = ctx.sessions?.list?.getSnapshot?.().current ?? "";
				} catch {}
				if (sid !== activeSid && windowOpen) {
					activeSid = sid;
					refreshWindow().catch(() => {});
				} else activeSid = sid;
				getJson(`gate?sid=${encodeURIComponent(sid)}`).then((g) => {
					if (g?.ok) applyGate(g.allowed === true);
				}).catch(() => {});
			};
			pollGate();
			try {
				const unsub = ctx.sessions?.list?.subscribe?.(pollGate);
				ctx.effect(() => () => {
					unsub?.();
				}, "paper-reading: gate subscription cleanup");
			} catch {}
			const gateTimer = window.setInterval(pollGate, 2e3);
			ctx.effect(() => () => {
				window.clearInterval(gateTimer);
			}, "paper-reading: gate poll cleanup");
			document.addEventListener("dragover", onPageDragOver, true);
			document.addEventListener("drop", onPageDrop, true);
		}
		/** 从页面任意位置取 PDF 文件;窗口内交给窗口自身的处理。 */
		function pdfFromDrag(e) {
			if (!paperGateAllowed) return null;
			const files = e.dataTransfer?.files;
			if (!files || files.length === 0) return null;
			const pdf = Array.from(files).find((f) => /\.pdf$/i.test(f.name));
			if (!pdf) return null;
			if (e.target instanceof Element && e.target.closest(`#${WINDOW_ID}`)) return null;
			return pdf;
		}
		function onPageDragOver(e) {
			if (!pdfFromDrag(e)) return;
			e.preventDefault();
			e.stopPropagation();
		}
		function onPageDrop(e) {
			const pdf = pdfFromDrag(e);
			if (!pdf) return;
			e.preventDefault();
			e.stopPropagation();
			attachPdfFile(pdf);
		}
		/** 读取 PDF 并添加到论文库(标题 = 文件名);随后打开论文窗口反馈。 */
		function attachPdfFile(file) {
			const reader = new FileReader();
			reader.onload = () => {
				post("attach-pdf", {
					data: String(reader.result ?? ""),
					title: file.name.replace(/\.pdf$/i, "").trim()
				}).then((r) => {
					if (!r?.ok) throw new Error(r?.error ?? "attach failed");
					openWindow();
					window.setTimeout(() => {
						setWinStatus(r.created ? `✅ 已添加《${r.title}》(${r.pages} 页,标题=文件名)` : `✅ 已归档到《${r.title}》(${r.pages} 页)`);
					}, 120);
					refreshWindow();
				}).catch((e) => setWinStatus(e));
			};
			reader.onerror = () => setWinStatus("❌ PDF 读取失败");
			reader.readAsDataURL(file);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map