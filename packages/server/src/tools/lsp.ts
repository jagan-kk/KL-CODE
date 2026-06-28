import {tool} from "ai";
import {z} from "zod"
import { resolve, relative } from "path";
import { access } from "fs/promises";
import { spawn } from "child_process";
import { createInterface } from "readline";

type LSPServer = {
    process: import("child_process").ChildProcess & {
        stdin: import("stream").Writable;
        stdout: import("stream").Readable;
        stderr: import("stream").Readable;
    };
    requestId: number;
    pending: Map<number, { resolve: (value: unknown) => void; reject: (err: Error) => void }>;
};

const activeServers = new Map<string, LSPServer>();

function getLanguageForFile(filePath: string): string | null {
    const ext = filePath.split(".").pop()?.toLowerCase();
    const extMap: Record<string, string> = {
        ts: "typescript",
        tsx: "typescript",
        js: "javascript",
        jsx: "javascript",
        py: "python",
        rs: "rust",
        go: "go",
        java: "java",
        rb: "ruby",
        php: "php",
        cs: "csharp",
        cpp: "cpp",
        c: "c",
        h: "c",
        hpp: "cpp",
        swift: "swift",
        kt: "kotlin",
    };
    return ext ? (extMap[ext] ?? null) : null;
}

function findServerCommand(language: string, _cwd: string): string[] | null {
    const commands: Record<string, string[]> = {
        typescript: ["typescript-language-server", "--stdio"],
        javascript: ["typescript-language-server", "--stdio"],
    };

    return commands[language] ?? null;
}

export function createLspTool(cwd: string) {
    return tool({
        description:
        "[EXPERIMENTAL] Query LSP (Language Server Protocol) servers for code intelligence. Supports goToDefinition, findReferences, hover, documentSymbol, and workspaceSymbol operations. Requires the appropriate language server to be installed.",
        inputSchema: z.object({
            operation: z.enum([
                "goToDefinition",
                "findReferences",
                "hover",
                "documentSymbol",
                "workspaceSymbol",
                "goToImplementation",
            ]).describe("The LSP operation to perform"),
            filePath: z.string().describe("Relative path to the source file"),
            line: z.number().describe("Line number (0-indexed)").optional(),
            character: z.number().describe("Character offset (0-indexed)").optional(),
            query: z.string().describe("Search query for workspaceSymbol").optional(),
        }),
        execute: async ({operation, filePath, line, character, query}) => {
            const resolved = resolve(cwd, filePath);
            if (!resolved.startsWith(cwd)) {
                return { error: "File path is outside the project directory" };
            }

            try {
                await access(resolved);
            } catch {
                return { error: `File not found: ${filePath}` };
            }

            const language = getLanguageForFile(resolved);
            if (!language) {
                return { error: `Unsupported language for file: ${filePath}` };
            }

            const serverCmd = findServerCommand(language, cwd);
            if (!serverCmd) {
                return { error: `No LSP server configured for language: ${language}. Install the appropriate language server.` };
            }

            const uri = `file:///${resolved.replace(/\\/g, "/")}`;
            const serverKey = `${language}-${cwd}`;

            try {
                let server = activeServers.get(serverKey);

                if (!server || server.process.killed) {
                    if (server) {
                        server.process.kill("SIGTERM");
                        activeServers.delete(serverKey);
                    }

                    const cmd = serverCmd[0]!;
                    const args = serverCmd.slice(1);
                    const proc = spawn(cmd, args, {
                        cwd,
                        stdio: ["pipe", "pipe", "pipe"],
                    }) as import("child_process").ChildProcess & {
                        stdin: import("stream").Writable;
                        stdout: import("stream").Readable;
                        stderr: import("stream").Readable;
                    };

                    server = {
                        process: proc,
                        requestId: 1,
                        pending: new Map(),
                    };
                    activeServers.set(serverKey, server);

                    const rl = createInterface({input: proc.stdout});
                    rl.on("line", (line: string) => {
                        try {
                            const msg = JSON.parse(line);
                            if (msg.id != null && server!.pending.has(msg.id)) {
                                const pending = server!.pending.get(msg.id)!;
                                if (msg.error) {
                                    pending.reject(new Error(msg.error.message));
                                } else {
                                    pending.resolve(msg.result);
                                }
                                server!.pending.delete(msg.id);
                            }
                        } catch {
                            // ignore malformed JSON
                        }
                    });

                    proc.on("error", () => {
                        activeServers.delete(serverKey);
                    });

                    await sendRequest(server, "initialize", {
                        processId: process.pid,
                        capabilities: {},
                        rootUri: `file:///${cwd.replace(/\\/g, "/")}`,
                    });
                    await sendNotification(server, "initialized", {});
                }

                let result: unknown;

                const posLine = line ?? 0;
                const posChar = character ?? 0;

                switch (operation) {
                    case "goToDefinition":
                        result = await sendRequest(server, "textDocument/definition", {
                            textDocument: {uri},
                            position: {line: posLine, character: posChar},
                        });
                        break;
                    case "findReferences":
                        result = await sendRequest(server, "textDocument/references", {
                            textDocument: {uri},
                            position: {line: posLine, character: posChar},
                            context: {includeDeclaration: true},
                        });
                        break;
                    case "hover":
                        result = await sendRequest(server, "textDocument/hover", {
                            textDocument: {uri},
                            position: {line: posLine, character: posChar},
                        });
                        break;
                    case "documentSymbol":
                        result = await sendRequest(server, "textDocument/documentSymbol", {
                            textDocument: {uri},
                        });
                        break;
                    case "workspaceSymbol":
                        result = await sendRequest(server, "workspace/symbol", {
                            query: query || "",
                        });
                        break;
                    case "goToImplementation":
                        result = await sendRequest(server, "textDocument/implementation", {
                            textDocument: {uri},
                            position: {line: posLine, character: posChar},
                        });
                        break;
                }

                return {
                    operation,
                    filePath: relative(cwd, resolved),
                    result: result as Record<string, unknown>,
                };
            } catch (err) {
                activeServers.delete(serverKey);
                const message = err instanceof Error ? err.message : String(err);
                return { error: `LSP ${operation} failed: ${message}` };
            }
        },
    });
}

function sendRequest(server: LSPServer, method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const id = server.requestId++;
        const request = JSON.stringify({jsonrpc: "2.0", id, method, params});

        const timeout = setTimeout(() => {
            server.pending.delete(id);
            reject(new Error(`LSP request timed out: ${method}`));
        }, 10_000);

        server.pending.set(id, {resolve, reject});

        const origPending = server.pending.get(id)!;
        server.pending.set(id, {
            resolve: (value: unknown) => {
                clearTimeout(timeout);
                origPending.resolve(value);
            },
            reject: (err: Error) => {
                clearTimeout(timeout);
                origPending.reject(err);
            },
        });

        const stdin = server.process.stdin;
        if (stdin?.writable) {
            stdin.write(request + "\n");
        } else {
            clearTimeout(timeout);
            reject(new Error("LSP server stdin not available"));
        }
    });
}

function sendNotification(server: LSPServer, method: string, params: unknown) {
    const notification = JSON.stringify({jsonrpc: "2.0", method, params});
    const stdin = server.process.stdin;
    if (stdin?.writable) {
        stdin.write(notification + "\n");
    }
}
