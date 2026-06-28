import { spawn, type ChildProcess } from "child_process";
import { createInterface } from "readline";
import type { MCPServerConfig } from "@KL-CODE/shared";

type MCPConnection = {
    process: ChildProcess;
    requestId: number;
    capabilities: {
        tools?: { name: string; description?: string; inputSchema?: unknown }[];
    };
    pending: Map<number, { resolve: (value: unknown) => void; reject: (err: Error) => void }>;
};

const connections = new Map<string, MCPConnection>();

export async function connectMCPServer(
    name: string,
    config: MCPServerConfig
): Promise<{ success: boolean; error?: string }> {
    try {
        if (connections.has(name)) {
            await disconnectMCPServer(name);
        }

        const proc = spawn(config.command, config.args || [], {
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, ...config.env },
        });

        const conn: MCPConnection = {
            process: proc,
            requestId: 1,
            capabilities: {},
            pending: new Map(),
        };

        const rl = createInterface({ input: proc.stdout! });
        rl.on("line", (line) => {
            try {
                const msg = JSON.parse(line);
                if (msg.id != null && conn.pending.has(msg.id)) {
                    const pending = conn.pending.get(msg.id)!;
                    if (msg.error) {
                        pending.reject(new Error(msg.error.message));
                    } else {
                        pending.resolve(msg.result);
                    }
                    conn.pending.delete(msg.id);
                }
            } catch {
                // ignore malformed JSON
            }
        });

        proc.on("exit", () => {
            connections.delete(name);
        });

        connections.set(name, conn);

        // Initialize
        const initResult = await sendMCPRequest(conn, "initialize", {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "KL-CODE", version: "1.0.0" },
        }) as { capabilities?: { tools?: Record<string, unknown> } };

        await sendMCPNotification(conn, "notifications/initialized", {});

        // List tools
        const toolsResult = await sendMCPRequest(conn, "tools/list", {}) as {
            tools?: { name: string; description?: string; inputSchema?: unknown }[];
        };

        conn.capabilities.tools = toolsResult.tools || [];

        return { success: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
    }
}

export async function disconnectMCPServer(name: string) {
    const conn = connections.get(name);
    if (conn) {
        conn.process.kill();
        connections.delete(name);
    }
}

export function getMCPToolNames(): string[] {
    const names: string[] = [];
    for (const [serverName, conn] of connections) {
        for (const tool of conn.capabilities.tools || []) {
            names.push(`mcp_${serverName}_${tool.name}`);
        }
    }
    return names;
}

export function getMCPTool(name: string): {
    name: string;
    description?: string;
    inputSchema?: unknown;
    execute: (args: unknown) => Promise<unknown>;
} | null {
    const parts = name.split("_");
    if (parts.length < 3 || parts[0] !== "mcp") return null;

    const serverName = parts.slice(1, -1).join("_");
    const toolName = parts[parts.length - 1]!;

    const conn = connections.get(serverName);
    if (!conn) return null;

    const toolDef = conn.capabilities.tools?.find((t) => t.name === toolName);
    if (!toolDef) return null;

    return {
        name: toolDef.name,
        description: toolDef.description,
        inputSchema: toolDef.inputSchema,
        execute: async (args: unknown) => {
            return sendMCPRequest(conn, "tools/call", {
                name: toolName,
                arguments: args,
            });
        },
    };
}

export async function connectAllMCPServers(configs: Record<string, MCPServerConfig>) {
    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const [name, config] of Object.entries(configs)) {
        if (config.disabled) continue;
        const result = await connectMCPServer(name, config);
        results.push({ name, ...result });
    }

    return results;
}

export function disconnectAllMCPServers() {
    for (const name of connections.keys()) {
        disconnectMCPServer(name);
    }
}

function sendMCPRequest(conn: MCPConnection, method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const id = conn.requestId++;
        const request = JSON.stringify({jsonrpc: "2.0", id, method, params});

        const timeout = setTimeout(() => {
            conn.pending.delete(id);
            reject(new Error(`MCP request timed out: ${method}`));
        }, 30_000);

        conn.pending.set(id, {
            resolve: (value) => {
                clearTimeout(timeout);
                resolve(value);
            },
            reject: (err) => {
                clearTimeout(timeout);
                reject(err);
            },
        });

        if (conn.process.stdin?.writable) {
            conn.process.stdin.write(request + "\n");
        } else {
            clearTimeout(timeout);
            reject(new Error("MCP server stdin not available"));
        }
    });
}

function sendMCPNotification(conn: MCPConnection, method: string, params: unknown) {
    const notification = JSON.stringify({jsonrpc: "2.0", method, params});
    if (conn.process.stdin?.writable) {
        conn.process.stdin.write(notification + "\n");
    }
}
