import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "./types";
import { COMMANDS } from "./commands";

type Klcoderc = {
    customCommands?: {
        name: string;
        description: string;
        value: string;
    }[];
    [key: string]: unknown;
};

function loadCustomCommands(): Command[] {
    try {
        const configPath = join(process.cwd(), ".klcoderc");
        if (existsSync(configPath)) {
            const raw = readFileSync(configPath, "utf-8");
            const config: Klcoderc = JSON.parse(raw);
            if (config.customCommands && Array.isArray(config.customCommands)) {
                return config.customCommands.map((c) => ({
                    name: c.name,
                    description: c.description,
                    value: c.value,
                    action: undefined,
                }));
            }
        }
    } catch {
        // silently fall through
    }
    return [];
}

const customCommands = loadCustomCommands();
export const ALL_COMMANDS = [...COMMANDS, ...customCommands];

export function getFilteredCommands(query: string): Command[] {
    if (query.length == 0) return ALL_COMMANDS;
    const cmdPrefix = query.split(" ")[0].toLowerCase();
    if (cmdPrefix.length == 0) return ALL_COMMANDS;
    return ALL_COMMANDS.filter((cmd) =>
        cmd.name.toLowerCase().startsWith(cmdPrefix)
    );
}
