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
import type { SlotsService } from '@deepseek-ai/dsh-client-ui-slots';
type ClientContext = {
    slots: SlotsService;
};
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
export {};
