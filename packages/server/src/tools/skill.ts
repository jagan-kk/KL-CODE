import {tool} from "ai";
import {z} from "zod"
import { resolve, relative } from "path";
import { readFile, access } from "fs/promises";
import { readdir } from "fs/promises";

const SKILL_DIRS = [".opencode/skills", ".KL-CODE/skills"];

const SKILL_EXTENSIONS = [".md", ".mdx"];

export function createSkillTool(cwd: string) {
    return tool({
        description:
        "Load a skill file (SKILL.md) and return its content. Skills provide specialized instructions and workflows for specific tasks. Use this when you need guided workflows for common patterns.",
        inputSchema: z.object({
            name: z.string().describe(
                "Name of the skill to load (e.g. 'customize-opencode', 'react-component'). Omit to list available skills."
            ).optional(),
        }),
        execute: async ({name}) => {
            try {
                if (!name) {
                    const available: string[] = [];

                    for (const dir of SKILL_DIRS) {
                        const dirPath = resolve(cwd, dir);
                        try {
                            await access(dirPath);
                            const entries = await readdir(dirPath);
                            for (const entry of entries) {
                                const ext = SKILL_EXTENSIONS.find((e) => entry.toLowerCase().endsWith(e));
                                if (ext) {
                                    available.push(entry.replace(ext, ""));
                                }
                            }
                        } catch {
                            // Directory doesn't exist, skip
                        }
                    }

                    const rootSkill = resolve(cwd, "SKILL.md");
                    try {
                        await access(rootSkill);
                        available.push("(root SKILL.md)");
                    } catch {
                        // No root skill
                    }

                    return {
                        skills: available,
                        skillDir: SKILL_DIRS[0],
                    };
                }

                let skillContent: string | null = null;
                let loadedFrom: string | null = null;

                for (const dir of SKILL_DIRS) {
                    for (const ext of SKILL_EXTENSIONS) {
                        const skillPath = resolve(cwd, dir, `${name}${ext}`);
                        try {
                            skillContent = await readFile(skillPath, "utf-8");
                            loadedFrom = relative(cwd, skillPath);
                            break;
                        } catch {
                            // Try next extension
                        }
                    }
                    if (skillContent) break;
                }

                if (!skillContent) {
                    const skillPath = resolve(cwd, "SKILL.md");
                    try {
                        skillContent = await readFile(skillPath, "utf-8");
                        loadedFrom = "SKILL.md";
                    } catch {
                        // No root skill
                    }
                }

                if (!skillContent) {
                    return { error: `Skill '${name}' not found. Use the tool without a name to list available skills.` };
                }

                return {
                    name,
                    content: skillContent,
                    path: loadedFrom,
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { error: `Failed to load skill: ${message}` };
            }
        },
    });
}
