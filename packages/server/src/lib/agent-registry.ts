import type { AgentConfig } from "@KL-CODE/shared";

type AgentDefinition = {
    name: string;
    mode: "PLAN" | "BUILD";
    systemPrompt?: string;
    tools: string[];
    description?: string;
};

const DEFAULT_AGENTS: AgentDefinition[] = [
    {
        name: "plan",
        mode: "PLAN",
        description: "Read-only analysis and planning mode",
        tools: ["readFile", "listDirectory", "glob", "grep", "webfetch", "websearch", "skill", "lsp", "question", "todowrite"],
    },
    {
        name: "build",
        mode: "BUILD",
        description: "Full implementation with read and write tools",
        tools: [
            "readFile", "writeFile", "editFile", "applyPatch",
            "listDirectory", "glob", "grep", "bash",
            "webfetch", "websearch", "skill", "lsp",
            "question", "todowrite",
        ],
    },
    {
        name: "debug",
        mode: "BUILD",
        description: "Debug mode focused on troubleshooting and fixing issues",
        tools: ["readFile", "listDirectory", "glob", "grep", "bash", "webfetch", "websearch", "question", "todowrite"],
    },
    {
        name: "review",
        mode: "PLAN",
        description: "Code review mode for analyzing changes",
        tools: ["readFile", "listDirectory", "glob", "grep", "webfetch", "question", "todowrite"],
    },
];

let customAgents: AgentConfig[] = [];

export function registerCustomAgents(agents: AgentConfig[]) {
    customAgents = agents;
}

export function getAllAgents(): AgentDefinition[] {
    const agents = [...DEFAULT_AGENTS];

    for (const custom of customAgents) {
        const existing = agents.findIndex((a) => a.name === custom.name);
        const agentDef: AgentDefinition = {
            name: custom.name,
            mode: custom.mode ?? "BUILD",
            systemPrompt: custom.systemPrompt,
            tools: custom.tools ?? [],
            description: custom.description,
        };

        if (existing >= 0) {
            agents[existing] = agentDef;
        } else {
            agents.push(agentDef);
        }
    }

    return agents;
}

export function getAgent(name: string): AgentDefinition | undefined {
    return getAllAgents().find((a) => a.name === name);
}

export function getAgentTools(name: string): string[] {
    const agent = getAgent(name);
    if (!agent) return [];
    return agent.tools;
}
