import {Hono} from "hono"
import {streamSSE} from "hono/streaming";
import {zValidator} from "@hono/zod-validator"
import {z} from "zod"
import {streamText as aiStreamText, stepCountIs} from "ai";
import {db} from "@KL-CODE/database/client"
import type {Prisma} from "@KL-CODE/database"
import {Mode,MessageStatus} from "@KL-CODE/database/enums"
import { createTools, setQuestionCallback, resolvePendingQuestion } from "../tools"; 
import { buildSystemPrompt } from "../system-prompt";
import { type ChatStreamEvent,type MessagePart,toolCallArgsSchema,messagePartsSchema, messagePartSchema, getPermission, mergeConfig, DEFAULT_CONFIG, type KLConfig, type PermissionLevel } from "@KL-CODE/shared"
import { isSupportedChatModel, resolveChatModel } from "../lib/models";

const THINKING_TAG_RE = /<\/?(?:thinking|reasoning|thought|think|Thought|Thinking)>/gi;
const THINKING_BLOCK_RE = /<(?:thinking|reasoning|Thought|Thinking)>[\s\S]*?<\/(?:thinking|reasoning|Thought|Thinking)>/gi;

function stripThinkingTags(text: string): { clean: string; thinking: string[] } {
    const thinking: string[] = [];
    const clean = text.replace(THINKING_BLOCK_RE, (match) => {
        const inner = match.replace(THINKING_TAG_RE, "").trim();
        if (inner) thinking.push(inner);
        return "";
    });
    const finalText = clean.replace(THINKING_TAG_RE, "").replace(/ +/g, " ");
    return { clean: finalText, thinking };
}

const submitSchema =z.object({
    content:z.string(),
    mode:z.enum(Mode),
    model:z.string().refine(isSupportedChatModel,"Unsupported model"),
});

const submitValidator =zValidator("json",submitSchema,(result,c)=>{
    if(!result.success) {
        return c.json({error:"Invalid request body"},400);

    }
});

const activeResumeSessionIds =new Set<string>()

type SSESTREAM = Parameters<Parameters<typeof streamSSE>[1]>[0];

function buildConversationHistory (
    messages:{role:"USER" | "ASSISTANT" | "ERROR";content:string;status:MessageStatus}[],
) {
    const history:{role:"user"|"assistant";content:string}[]=[];

    for(const m of messages){
        if(m.role==="ERROR") continue;
        if(m.role==="ASSISTANT" && m.content.length===0) continue;

        history.push({
            role:m.role ==="USER" ? ("user" as const) : ("assistant" as const),
            content:m.content,
        });
    }

    return history;
}

function getResumableUserMessage(
    messages:{
        role:"USER"|"ASSISTANT"|"ERROR";
        model:string;mode:Mode
    }[],
){
    const lastMessage=messages[messages.length-1];
    if(!lastMessage || lastMessage.role!="USER") {
        return null;
    }
    return lastMessage;
}

async function loadConfig(cwd: string | null): Promise<KLConfig> {
    if (!cwd) return DEFAULT_CONFIG;
    try {
        const {readFile} = await import("fs/promises");
        const {resolve} = await import("path");
        const configPaths = [
            resolve(cwd, "kl-code.json"),
            resolve(cwd, ".klcoderc"),
            resolve(cwd, ".kl-code.json"),
        ];
        for (const configPath of configPaths) {
            try {
                const content = await readFile(configPath, "utf-8");
                const parsed = JSON.parse(content);
                return mergeConfig(parsed);
            } catch {
                continue;
            }
        }
    } catch {
        // ignore
    }
    return DEFAULT_CONFIG;
}

type StreamParams ={
    sessionId:string;
    model:string;
    cwd:string|null;
    history: {
        role:"user" | "assistant";content:string 
    }[];
    mode:Mode;
    abortController:AbortController;
    stream: SSESTREAM;
    config: KLConfig;
}

async function streamAIResponse(
    params:StreamParams,
){
    const {sessionId,model,history,mode,cwd,abortController, stream, config} =params;
    const startTime=Date.now();
    const tools=cwd ? createTools(cwd, mode, sessionId):undefined
    const parts:MessagePart[]=[]
    const resolvedModel = resolveChatModel(model);

    const permissionCache = new Map<string, PermissionLevel>();

    function checkPermission(toolName: string): PermissionLevel {
        if (!permissionCache.has(toolName)) {
            permissionCache.set(toolName, getPermission(config, toolName));
        }
        return permissionCache.get(toolName)!;
    }

    // Set up question callback to send question events to client
    if (tools && tools.question) {
        setQuestionCallback((q) => {
            const questionEvent: ChatStreamEvent = {
                type: "question",
                questionId: `q_${Date.now()}`,
                header: q.header,
                question: q.question,
                options: q.options,
                multiple: q.multiple,
            };
            stream.writeSSE({
                event: "question",
                data: JSON.stringify(questionEvent),
            }).catch(() => {});
        });
    }

    const persistInterruptedMessage = async () => {
        const fullText =parts
        .filter((p) => p.type==="text")
        .map((p) => p.text)
        .join("")

        if (fullText.length===0 && parts.length===0) {
            return;
        }

        const elapsedMs =Date.now() -startTime;
        const validatedParts:Prisma.InputJsonValue | undefined =
        parts.length >0? messagePartsSchema.parse(parts): undefined;

        await db.message.create({

            data: {
                sessionId,
                role:"ASSISTANT",
                status:MessageStatus.INTERRUPTED,
                model,
                content:fullText,
                parts:validatedParts,
                mode,
                duration:Math.round(elapsedMs/1000),
            }
        })
    }

    try {
        // Wrap tools with permission checking
        const wrappedTools = tools ? Object.fromEntries(
            Object.entries(tools).map(([name, tool]) => {
                const perm = checkPermission(name);
                if (perm === "deny") {
                    return [name, {
                        ...tool,
                        execute: async () => ({ error: `Tool '${name}' is denied by configuration` }),
                    }];
                }
                if (perm === "ask") {
                    return [name, {
                        ...tool,
                        execute: async (args: unknown) => {
                            const permissionEvent: ChatStreamEvent = {
                                type: "permission-request",
                                toolCallId: crypto.randomUUID(),
                                toolName: name,
                                args: toolCallArgsSchema.parse(args),
                            };
                            await stream.writeSSE({
                                event: "permission-request",
                                data: JSON.stringify(permissionEvent),
                            });
                            return { error: `Tool '${name}' requires user approval. Waiting for permission...` };
                        },
                    }];
                }
                return [name, tool];
            })
        ) : undefined;

        const result=aiStreamText ({
            model:resolvedModel.model,
            system:buildSystemPrompt({cwd,mode}),
            messages:history,
            tools: wrappedTools,
            maxSteps:50,
            stopWhen:tools? stepCountIs(50):undefined,
            abortSignal:abortController.signal,
            providerOptions:resolvedModel.providerOptions,
        } as any)

        for await (const part of result.fullStream) {
            if(stream.aborted) break;

            if(part.type ==="reasoning-delta") {
                const last =parts[parts.length-1];
                if(last&&last.type ==="reasoning") {
                    last.text += part.text;
                }else {
                    parts.push({ type:"reasoning",text:part.text})
                }
                const event: ChatStreamEvent = { type : "reasoning-delta" , text: part.text};
                await stream.writeSSE({
                    event:"reasoning-delta",data:JSON.stringify(event)
                })
            }

            if (part.type ==="text-delta") {
                const originalText = part.text;
                const { clean, thinking } = stripThinkingTags(originalText);

                for (const thought of thinking) {
                    const last = parts[parts.length - 1];
                    if (last && last.type === "reasoning") {
                        last.text += thought;
                    } else {
                        parts.push({ type: "reasoning", text: thought });
                    }
                    const event: ChatStreamEvent = { type: "reasoning-delta", text: thought };
                    await stream.writeSSE({ event: "reasoning-delta", data: JSON.stringify(event) });
                }

                if (clean) {
                    const last = parts[parts.length-1]
                    if(last && last.type ==="text") {
                        last.text += clean;
                    } else {
                        parts.push({ type:"text", text: clean })
                    }

                    const event:ChatStreamEvent ={
                        type:"text-delta",text:clean
                    }
                    await stream.writeSSE({event: "text-delta", data:JSON.stringify(event)})
                }
            }


                if (part.type ==="tool-call") {
                    const rawInput = (part as any).args ?? part.input
                    let args: z.infer<typeof toolCallArgsSchema>
                    try {
                        args = toolCallArgsSchema.parse(rawInput ?? {})
                    } catch {
                        if (typeof rawInput === "object" && rawInput !== null) {
                            args = Object.fromEntries(
                                Object.entries(rawInput).filter(([_, v]) =>
                                    typeof v !== "undefined" && !(v instanceof Date) && typeof v !== "symbol"
                                )
                            ) as z.infer<typeof toolCallArgsSchema>
                        } else {
                            args = {} as z.infer<typeof toolCallArgsSchema>
                        }
                    }

                    parts.push({
                        type: "tool-call",
                        id:part.toolCallId,
                        name:part.toolName,
                        args,
                    })

                    const event: ChatStreamEvent={
                        type:"tool-call",
                        toolCallId:part.toolCallId,
                        toolName:part.toolName,
                        args,
                    }
                    await stream.writeSSE({event:"tool-call",data: JSON.stringify(event)})
                }

                if (part.type ==="tool-result") {
                    const resultStr =
                    typeof part.output ==="string" ? part.output: JSON.stringify(part.output);

                    const tcPart = parts.find (
                        (p):p is Extract<MessagePart, {type:"tool-call"}> =>
                            p.type ==="tool-call" && p.id ===part.toolCallId
                    );

                    if(tcPart) {
                        tcPart.result=resultStr;
                    }

                    const event : ChatStreamEvent = {
                        type: "tool-result",
                        toolCallId:part.toolCallId,
                        result: resultStr,                
                        }
                        await stream.writeSSE({event:"tool-result", data: JSON.stringify(event)});
                }


            if (part.type==="error") {
                throw part.error;
            }
        }

        if(stream.aborted || abortController.signal.aborted) {
            await persistInterruptedMessage();
            return ;
        }

        // Check if we have tool results but no text output — auto-continue
        const hasToolResults = parts.some(p => p.type === "tool-call" && p.result);
        const hasTextOutput = parts.some(p => p.type === "text" && p.text.length > 0);
        if (hasToolResults && !hasTextOutput) {
            const toolResultsText = parts
                .filter((p): p is Extract<MessagePart, { type: "tool-call" }> => p.type === "tool-call" && !!p.result)
                .map(p => `Tool: ${p.name}\nArgs: ${JSON.stringify(p.args)}\nResult: ${p.result}`)
                .join("\n\n");

            const reasoningText = parts
                .filter(p => p.type === "reasoning")
                .map(p => p.text)
                .join("\n");

            const assistantContent = [reasoningText, toolResultsText].filter(Boolean).join("\n\n");

            const continuationMessages = [
                ...history,
                { role: "assistant" as const, content: assistantContent },
                { role: "user" as const, content: "Based on the above tool results, please provide a complete answer to my original request. Do not include XML tags or thinking blocks." },
            ];

            const continuationTools = cwd ? createTools(cwd, mode, sessionId) : undefined;

            try {
                const continuationResult = aiStreamText({
                    model: resolvedModel.model,
                    system: buildSystemPrompt({ cwd, mode }),
                    messages: continuationMessages,
                    tools: continuationTools,
                    maxSteps: 5,
                    abortSignal: abortController.signal,
                    providerOptions: resolvedModel.providerOptions,
                } as any);

                for await (const part of continuationResult.fullStream) {
                    if (stream.aborted) break;
                    if (part.type === "reasoning-delta") {
                        const last = parts[parts.length - 1];
                        if (last && last.type === "reasoning") {
                            last.text += part.text;
                        } else {
                            parts.push({ type: "reasoning", text: part.text });
                        }
                        const event: ChatStreamEvent = { type: "reasoning-delta", text: part.text };
                        await stream.writeSSE({ event: "reasoning-delta", data: JSON.stringify(event) });
                    } else if (part.type === "text-delta") {
                        const { clean, thinking } = stripThinkingTags(part.text);
                        for (const thought of thinking) {
                            const last = parts[parts.length - 1];
                            if (last && last.type === "reasoning") {
                                last.text += thought;
                            } else {
                                parts.push({ type: "reasoning", text: thought });
                            }
                            const event: ChatStreamEvent = { type: "reasoning-delta", text: thought };
                            await stream.writeSSE({ event: "reasoning-delta", data: JSON.stringify(event) });
                        }
                        if (clean) {
                            const last = parts[parts.length - 1];
                            if (last && last.type === "text") {
                                last.text += clean;
                            } else {
                                parts.push({ type: "text", text: clean });
                            }
                            const event: ChatStreamEvent = { type: "text-delta", text: clean };
                            await stream.writeSSE({ event: "text-delta", data: JSON.stringify(event) });
                        }
                    } else if (part.type === "tool-call") {
                        const rawInput = (part as any).args ?? part.input;
                        let args: z.infer<typeof toolCallArgsSchema>;
                        try { args = toolCallArgsSchema.parse(rawInput ?? {}); } catch { args = {} as any; }
                        parts.push({ type: "tool-call", id: part.toolCallId, name: part.toolName, args });
                        const event: ChatStreamEvent = { type: "tool-call", toolCallId: part.toolCallId, toolName: part.toolName, args };
                        await stream.writeSSE({ event: "tool-call", data: JSON.stringify(event) });
                    } else if (part.type === "tool-result") {
                        const resultStr = typeof part.output === "string" ? part.output : JSON.stringify(part.output);
                        const tcPart = parts.find((p): p is Extract<MessagePart, { type: "tool-call" }> => p.type === "tool-call" && p.id === part.toolCallId);
                        if (tcPart) tcPart.result = resultStr;
                        const event: ChatStreamEvent = { type: "tool-result", toolCallId: part.toolCallId, result: resultStr };
                        await stream.writeSSE({ event: "tool-result", data: JSON.stringify(event) });
                    } else if (part.type === "error") {
                        throw part.error;
                    }
                }
            } catch (err) {
                if (abortController.signal.aborted) throw err;
                const msg = err instanceof Error ? err.message : String(err);
                const errorEvent: ChatStreamEvent = { type: "error", message: msg };
                await stream.writeSSE({ event: "error", data: JSON.stringify(errorEvent) });
            }
            if (stream.aborted || abortController.signal.aborted) {
                await persistInterruptedMessage();
                return;
            }
        }

        const elapsedMs =Date.now() - startTime;

        const fullText =parts
        .filter((p) =>p.type ==="text")
        .map((p)=> p.text)
        .join("");

        const validatedParts:Prisma.InputJsonValue | undefined =
        parts.length > 0 ? messagePartsSchema.parse(parts): undefined;

        const assistantMessage = await db.message.create({
            data: {
                sessionId,
                role:"ASSISTANT",
                status:MessageStatus.COMPLETE,
                model,
                content:fullText,
                parts:validatedParts,
                mode,
                duration:Math.round(elapsedMs/1000),
            }
        })

        const doneEvent:ChatStreamEvent ={
            type:"done",
            messageId:assistantMessage.id,
            durationMs:elapsedMs,
        }
        await stream.writeSSE({event:"done",data:JSON.stringify(doneEvent)})
    } catch(err) 
    {
        if(abortController.signal.aborted) {
            await persistInterruptedMessage();
           return;
            }

            const message =err instanceof Error ? err.message :String(err);
            await db.message.create({
                data:{
                    sessionId,
                    role:"ERROR",
                    status:MessageStatus.COMPLETE,
                    model,
                    content:message,
                    mode,
                },
            })

            const errorEvent:ChatStreamEvent = {
                type:"error",message };
            await stream.writeSSE({
                event:"error",data:JSON.stringify(errorEvent)
            })
            }
        }

        const app=new Hono ()
        .post("/:sessionId/answer", async (c) => {
            const sessionId = c.req.param("sessionId");
            const body = await c.req.json<{ questionId: string; answers: string[] }>();
            const { questionId, answers } = body;

            if (!questionId || !answers) {
                return c.json({ error: "Invalid request body" }, 400);
            }

            resolvePendingQuestion(questionId, answers);
            return c.json({ success: true });
        })
        .post("/:sessionId/resume", async (c)=> {
            const sessionId = c.req.param("sessionId")

            const session = await db.session.findUnique({
                where: { id:sessionId},
                include:{messages: {orderBy: {createdAt:"asc"}}}
            })

            if(!session) {
                return c.json({error:"Session not found"})
            }
            const resumableMessage = getResumableUserMessage(session.messages)
            if(!resumableMessage) {
                return c.json({
                    error:"session has no pending user message to resume"
                },409)
            }

            if (!isSupportedChatModel(resumableMessage.model)) {
                return c.json({ error:`Session uses unsupported model: ${resumableMessage.model}`},409);
            }


            if(activeResumeSessionIds.has(sessionId)) {
                return c.json({
                    error:"Session already has active resume"
                },409)
            }

            activeResumeSessionIds.add(sessionId)

        const history=buildConversationHistory(session.messages);
        const abortController=new AbortController();
        const config = await loadConfig(session.cwd);


        try {
            return streamSSE(
                c,
                async (stream) => {
                    stream.onAbort(()=> {
                        abortController.abort()
                    })

                try{

                    await streamAIResponse({
                        stream,
                        sessionId,
                        model:resumableMessage.model,
                        cwd:session.cwd,
                        history,
                        mode:resumableMessage.mode,
                        abortController,
                        config,
                    })
                } finally {
                    activeResumeSessionIds.delete(sessionId)

                }
                },
                async (err,stream) => {
                    activeResumeSessionIds.delete(sessionId)
                    const message = err instanceof Error ? err.message:String(err);
                    const errorEvent:ChatStreamEvent = {type:"error",message};
                    await stream.writeSSE({
                        event:"error",
                        data:JSON.stringify(errorEvent)
                    })
                }
            )
    } catch(error) {
        activeResumeSessionIds.delete(sessionId);
        throw error;

    }
    })
        .post("/:sessionId",submitValidator,async (c)=> {
            const sessionId =c.req.param("sessionId");
            const session = await db.session.findUnique({
                where: {id:sessionId},
                include:{ messages:{orderBy:{createdAt:"asc"}}}
            });
            if(!session) {
                return c.json({ error:"session not found"},404)
            }

            const data = c.req.valid("json");

            await db.message.create({
                data: {
                    sessionId,
                    role:"USER",
                    status:MessageStatus.COMPLETE,
                    model:data.model,
                    content:data.content,
                    mode:data.mode
                }
            })

            const history = buildConversationHistory([
                ...session.messages,
                {
                    role:"USER" as const,
                    content:data.content,
                    status:MessageStatus.COMPLETE,
                }
            ])
            const abortController = new AbortController();
            const config = await loadConfig(session.cwd);

            return streamSSE(
                c,
                async (stream) => {
                    stream.onAbort(()=> {
                        abortController.abort();
                    });

                    await streamAIResponse({
                        stream,
                        sessionId,
                        model:data.model,
                        cwd:session.cwd,
                        history,
                        mode:data.mode,
                        abortController,
                        config,
                    })
                },

                async (err,stream) => {
                    const message =err instanceof Error ? err.message:String(err);
                    const errorEvent:ChatStreamEvent = { type:"error",message};
                    await stream.writeSSE({event:"error",data:JSON.stringify(errorEvent)})
                }
            )
        })

        export default app;
