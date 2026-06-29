import {z} from "zod";

export const permissionLevelSchema = z.enum(["allow", "deny", "ask"]);
export type PermissionLevel = z.infer<typeof permissionLevelSchema>;

export const mcpServerConfigSchema = z.object({
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    disabled: z.boolean().optional(),
});
export type MCPServerConfig = z.infer<typeof mcpServerConfigSchema>;

export const agentConfigSchema = z.object({
    name: z.string(),
    mode: z.enum(["PLAN", "BUILD"]).optional(),
    systemPrompt: z.string().optional(),
    tools: z.array(z.string()).optional(),
    description: z.string().optional(),
});
export type AgentConfig = z.infer<typeof agentConfigSchema>;

export const klConfigSchema = z.object({
    permission: z.record(z.string(), permissionLevelSchema).optional(),
    tools: z.object({
        enabled: z.array(z.string()).optional(),
        disabled: z.array(z.string()).optional(),
    }).optional(),
    model: z.object({
        provider: z.string().optional(),
        modelId: z.string().optional(),
    }).optional(),
    mcpServers: z.record(z.string(), mcpServerConfigSchema).optional(),
    agents: z.array(agentConfigSchema).optional(),
    cwd: z.string().optional(),
}).passthrough();

export type KLConfig = z.infer<typeof klConfigSchema>;

export const DEFAULT_CONFIG: KLConfig = {
    permission: {
        bash: "ask",
        editFile: "allow",
        writeFile: "ask",
        applyPatch: "ask",
        readFile: "allow",
        listDirectory: "allow",
        glob: "allow",
        grep: "allow",
        webfetch: "allow",
        websearch: "allow",
        skill: "allow",
        lsp: "ask",
        question: "allow",
        todowrite: "allow",
    },
    tools: {
        enabled: [
            "readFile",
            "writeFile",
            "editFile",
            "applyPatch",
            "listDirectory",
            "glob",
            "grep",
            "bash",
            "webfetch",
            "websearch",
            "skill",
            "lsp",
            "question",
            "todowrite",
        ],
    },
    agents: [
        {
            name: "plan",
            mode: "PLAN",
            description: "Read-only analysis and planning",
            tools: ["readFile", "listDirectory", "glob", "grep", "webfetch", "websearch", "skill", "lsp", "question", "todowrite"],
        },
        {
            name: "build",
            mode: "BUILD",
            description: "Full implementation with read and write tools",
        },
    ],
};

export function mergeConfig(userConfig: Partial<KLConfig>): KLConfig {
    const merged: KLConfig = { ...DEFAULT_CONFIG };

    if (userConfig.permission) {
        merged.permission = { ...merged.permission, ...userConfig.permission };
    }

    if (userConfig.tools) {
        merged.tools = { ...merged.tools, ...userConfig.tools };
    }

    if (userConfig.model) {
        merged.model = { ...merged.model, ...userConfig.model };
    }

    if (userConfig.mcpServers) {
        merged.mcpServers = { ...merged.mcpServers, ...userConfig.mcpServers };
    }

    if (userConfig.agents) {
        merged.agents = [...(merged.agents || []), ...userConfig.agents];
    }

    if (userConfig.cwd) {
        merged.cwd = userConfig.cwd;
    }

    return merged;
}

export function getPermission(config: KLConfig, toolName: string): PermissionLevel {
    if (config.permission) {
        const wildcardKey = Object.keys(config.permission).find((k) => {
            if (k.includes("*")) {
                const pattern = k.replace(/\*/g, ".*");
                return new RegExp(`^${pattern}$`).test(toolName);
            }
            return k === toolName;
        });
        if (wildcardKey) {
            return config.permission[wildcardKey]!;
        }
    }
    return "allow";
}
