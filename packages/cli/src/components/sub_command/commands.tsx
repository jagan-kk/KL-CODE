import { useCallback, useRef, useState } from "react";
import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { useKeyboard } from "@opentui/react"
import { format } from "date-fns"
import { useNavigate } from "react-router"
import { writeFile } from "fs/promises"
import { join, resolve } from "path"
import {AgentDialogContent,ModelDialogContent,SessionDialogContent,ThemeDialogContent } from "../dialogs";
import { useDialog } from "../../providers/dialog";
import { useKeyboardLayer } from "../../providers/keyboard-layer";
import { useTheme } from "../../providers/theme";
import { apiClient } from "../../lib/api-clients";
import { getErrorMessage } from "../../lib/http-errors";
import type { Command, CommandContext } from "./types";
import type { InferResponseType } from "hono";
import { SUPPORTED_CHAT_MODELS } from "@KL-CODE/shared";

const MAX_VISIBLE_ITEMS = 5

type Session = InferResponseType<(typeof apiClient.sessions)["$get"], 200>[number]

function SessionList({ sessions }: { sessions: Session[] }) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const { close } = useDialog()
    const navigate = useNavigate()
    const scrollRef = useRef<ScrollBoxRenderable>(null)
    const { isTopLayer } = useKeyboardLayer()
    const { colors } = useTheme()

    const handleSelect = useCallback((session: Session) => {
        close();
        navigate(`/sessions/${session.id}`);
    }, [close, navigate])

    useKeyboard((key) => {
        if (!isTopLayer("dialog")) return

        if (key.name === "return" || key.name === "enter") {
            const item = sessions[selectedIndex]
            if (item) handleSelect(item)
        } else if (key.name === "up") {
            setSelectedIndex((i) => {
                const newIndex = Math.max(0, i - 1)
                const sb = scrollRef.current
                if (sb && newIndex < sb.scrollTop) {
                    sb.scrollTo(newIndex)
                }
                return newIndex
            })
        } else if (key.name === "down") {
            setSelectedIndex((i) => {
                const newIndex = Math.min(sessions.length - 1, i + 1)
                const sb = scrollRef.current
                if (sb) {
                    const viewportHeight = sb.viewport.height
                    const visibleEnd = sb.scrollTop + viewportHeight - 1
                    if (newIndex > visibleEnd) {
                        sb.scrollTo(newIndex - viewportHeight + 1)
                    }
                }
                return newIndex
            })
        }
    })

    if (sessions.length === 0) {
        return (
            <text attributes={TextAttributes.DIM}>No sessions found</text>
        )
    }

    const visibleHeight = Math.min(sessions.length, MAX_VISIBLE_ITEMS)

    return (
        <scrollbox ref={scrollRef} height={visibleHeight}>
            {sessions.map((session, i) => {
                const isSelected = i === selectedIndex
                return (
                    <box
                        key={session.id}
                        flexDirection="row"
                        height={1}
                        overflow="hidden"
                        backgroundColor={isSelected ? colors.selection : undefined}
                        onMouseMove={() => { setSelectedIndex(i) }}
                        onMouseDown={() => handleSelect(session)}
                    >
                        <text selectable={false} fg={isSelected ? "black" : "white"}>
                            {session.title}
                        </text>
                        <box flexGrow={1} />
                        <text
                            selectable={false}
                            fg={isSelected ? "black" : undefined}
                            attributes={TextAttributes.DIM}
                        >
                            {format(new Date(session.createdAt), "hh:mm a")}
                        </text>
                    </box>
                )
            })}
        </scrollbox>
    )
}

function buildExportMarkdown(messages: { role: string; content: string }[]): string {
    const lines: string[] = ["# KL-CODE Session Export", "", `Exported: ${new Date().toISOString()}`, "", "---", ""];
    for (const msg of messages) {
        const role = msg.role === "user" ? "**User**" : msg.role === "assistant" ? "**Assistant**" : "**Error**";
        lines.push(`### ${role}`, "", msg.content, "", "---", "");
    }
    return lines.join("\n");
}

export const COMMANDS: Command[] = [
    {
        name: "new",
        description: "Start a new conversation",
        value: "/new",
        action: (ctx) => {
            ctx.navigate("/")
        },
    },
    {
        name: "agents",
        description: "Select a agent",
        value: "/agent",
        action: (ctx) => {
            ctx.dialog.open({
                title: "select Mode",
                children: <AgentDialogContent currentMode={ctx.mode} onSelectMode={ctx.setMode}/>
            })
        },
    },
    {
        name: "login",
        description: "Sign In to your account",
        value: "/login",
    },
    {
        name: "sessions",
        description: "Select session",
        value: "/sessions",
        action: async (ctx: CommandContext) => {
            ctx.toast.show({ message: "Loading sessions..." });
            try {
                const res = await apiClient.sessions.$get();
                if (!res.ok) {
                    throw new Error(await getErrorMessage(res));
                }
                const data = await res.json() as Session[];
                ctx.dialog.open({
                    title: "Select session",
                    children: <SessionList sessions={data} />
                })
            } catch (error) {
                ctx.toast.show({
                    variant: "error",
                    message: error instanceof Error ? error.message : "Failed to fetch sessions"
                })
            }
        },
    },
    {
        name: "model",
        description: "select a model",
        value: "/model",
        action: (ctx) => {
            ctx.dialog.open({
                title: "select Model",
                children: <ModelDialogContent models={SUPPORTED_CHAT_MODELS.map((model)=>model.id)} onSelectModel={ctx.setModel}/>
            })
        },
    },
    {
        name: "themes",
        description: "Select a theme",
        value: "/themes",
        action: (ctx) => {
            ctx.dialog.open({
                title: "Select Theme",
                children: <ThemeDialogContent />
            })
        },
    },
    {
        name: "thinking",
        description: "Toggle reasoning visibility",
        value: "/thinking",
        action: (ctx) => {
            ctx.setShowReasoning(!ctx.showReasoning);
            ctx.toast.show({
                message: `Reasoning ${ctx.showReasoning ? "shown" : "hidden"}`,
            });
        },
    },
    {
        name: "export",
        description: "Export session to Markdown file",
        value: "/export",
        action: async (ctx: CommandContext) => {
            if (!ctx.messages || !ctx.sessionId) {
                ctx.toast.show({ variant: "error", message: "No active session to export" });
                return;
            }
            ctx.toast.show({ message: "Exporting session..." });
            try {
                const md = buildExportMarkdown(
                    ctx.messages.map((m) => ({ role: m.role, content: m.content }))
                );
                const filename = `kl-code-session-${ctx.sessionId.slice(0, 8)}-${Date.now()}.md`;
                await writeFile(join(process.cwd(), filename), md, "utf-8");
                ctx.toast.show({ message: `Exported to ${filename}` });
            } catch (error) {
                ctx.toast.show({
                    variant: "error",
                    message: error instanceof Error ? error.message : "Export failed",
                });
            }
        },
    },
    {
        name: "logout",
        description: "signout of account",
        value: "/logout",
    },
    {
        name: "upgrade",
        description: "buy more credit",
        value: "/upgrade",
    },
    {
        name: "usage",
        description: "open billing portal",
        value: "/usage",
    },
    {
        name: "exit",
        description: "quit the application",
        value: "/exit",
        action: (ctx) => {
            ctx.exit();
        },
    },
    {
        name: "workspace",
        description: "Set the working directory for sessions",
        value: "/workspace",
        action: (ctx) => {
            const pathArg = ctx.inputText?.slice("/workspace".length).trim();
            let newPath: string;
            if (pathArg) {
                newPath = resolve(process.cwd(), pathArg);
            } else {
                newPath = ctx.cwd;
            }
            ctx.setCwd(newPath);
            ctx.toast.show({ message: `Workspace set to: ${newPath}` });
        },
    },

];