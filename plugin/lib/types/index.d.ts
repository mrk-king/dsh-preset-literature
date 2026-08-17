/**
 * @dsh-external/dsh-paper-reading — 论文阅读伴侣 (host).
 *
 * 阅读文献时,把复制下来的文字或图片交给 harness:本插件提供
 *  1. 模型工具集 (paper_*): 归档/清洗/读图/术语/问答/检索/回顾,
 *  2. Web 面板 API (conversation.view 面板的 REST 后端),
 *  3. 面板「发送到对话」通道: 把捕获内容作为用户消息推给当前 GUI agent。
 *
 * 识图能力(visionMode=auto,默认):
 *  - 当前会话模型自带识图(inputModalities 含 image)→ 图片直接发给模型,不调用 ModLens;
 *  - 否则 → 复用本机已装的 ModLens (~/.modlens/config.json + web profile 的
 *    @liustack/modlens CLI);
 * 论文库默认落在 ~/Documents/papers-library。
 */
import type { Context } from 'cordis';
import z from 'schemastery';
export declare const name = "@dsh-external/dsh-paper-reading";
export declare const inject: string[];
export interface Config {
    libraryRoot: string;
    modlensBin: string;
    maxCaptureChars: number;
    chatPush: boolean;
    promptSection: boolean;
    allowedPresets: string[];
    /** 识图模式:auto=模型自带识图优先,否则 ModLens;modlens=永远走 ModLens;model=永远直接发图给模型。 */
    visionMode: 'auto' | 'modlens' | 'model';
}
export declare const Config: z<Schemastery.ObjectS<{
    libraryRoot: z<string, string>;
    modlensBin: z<string, string>;
    maxCaptureChars: z<number, number>;
    chatPush: z<boolean, boolean>;
    promptSection: z<boolean, boolean>;
    allowedPresets: z<string[], string[]>;
    visionMode: z<"modlens" | "auto" | "model", "modlens" | "auto" | "model">;
}>, Schemastery.ObjectT<{
    libraryRoot: z<string, string>;
    modlensBin: z<string, string>;
    maxCaptureChars: z<number, number>;
    chatPush: z<boolean, boolean>;
    promptSection: z<boolean, boolean>;
    allowedPresets: z<string[], string[]>;
    visionMode: z<"modlens" | "auto" | "model", "modlens" | "auto" | "model">;
}>>;
type AppContext = Context & {
    tools: {
        register(def: Record<string, unknown>): unknown;
    };
    agents: {
        get(id: string): {
            followup(message: unknown): void;
            options?: {
                provider?: string;
                model?: string;
            };
            session?: {
                id: string;
                requestHeader?: () => {
                    config?: {
                        provider?: string;
                        model?: string;
                    };
                };
            };
        } | undefined;
    };
};
export declare function apply(ctx: AppContext, config: Config): void;
export {};
