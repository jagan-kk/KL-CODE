import {tool} from "ai";
import {z} from "zod"
import { resolve, relative, dirname } from "path";
import { readFile, writeFile, mkdir, unlink } from "fs/promises";
import { recordMutation } from "../lib/undo-redo";

export function createApplyPatchTool(cwd: string, sessionId?: string) {
    return tool({
        description:
        "Apply a unified diff/patch to files in the project. Supports creating new files (marked with 'Add File:'), updating existing files (marked with 'Update File:'), renaming files ('Move to:'), and deleting files ('Delete File:'). Use this as an alternative to editFile for larger changes or when you want to apply structured diffs.",
        inputSchema: z.object({
            patchText: z.string().describe(
                "The patch/diff to apply. Use marker lines to indicate operations:\n" +
                "- `*** Add File: path/to/new-file.ts` - Create a new file\n" +
                "- `*** Update File: path/to/existing.ts` - Update an existing file\n" +
                "- `*** Move to: path/to/renamed.ts` - Rename/move a file\n" +
                "- `*** Delete File: path/to/obsolete.ts` - Delete a file\n\n" +
                "For Add/Update, include the file content after the marker line."
            ),
        }),
        execute: async ({patchText}) => {
            try {
                const operations: { type: "add" | "update" | "move" | "delete"; path: string; content?: string }[] = [];
                const lines = patchText.split("\n");

                let currentOp: { type: "add" | "update" | "move" | "delete"; path: string; content: string } | null = null;

                for (const line of lines) {
                    const addMatch = line.match(/^\*\*\*\s*Add File:\s*(.+)$/i);
                    const updateMatch = line.match(/^\*\*\*\s*Update File:\s*(.+)$/i);
                    const moveMatch = line.match(/^\*\*\*\s*Move to:\s*(.+)$/i);
                    const deleteMatch = line.match(/^\*\*\*\s*Delete File:\s*(.+)$/i);

                    if (addMatch) {
                        if (currentOp) operations.push(currentOp);
                        currentOp = { type: "add", path: addMatch[1]!.trim(), content: "" };
                    } else if (updateMatch) {
                        if (currentOp) operations.push(currentOp);
                        currentOp = { type: "update", path: updateMatch[1]!.trim(), content: "" };
                    } else if (moveMatch) {
                        if (currentOp) operations.push(currentOp);
                        operations.push({ type: "move", path: moveMatch[1]!.trim() });
                        currentOp = null;
                    } else if (deleteMatch) {
                        if (currentOp) operations.push(currentOp);
                        operations.push({ type: "delete", path: deleteMatch[1]!.trim() });
                        currentOp = null;
                    } else if (currentOp) {
                        currentOp.content += line + "\n";
                    }
                }

                if (currentOp) operations.push(currentOp);

                if (operations.length === 0) {
                    return { error: "No operations found in patch text. Use marker lines like '*** Add File: path/to/file', '*** Update File: path/to/file', etc." };
                }

                const results: { type: string; path: string; success: boolean; error?: string }[] = [];

                for (const op of operations) {
                    const resolved = resolve(cwd, op.path);
                    if (!resolved.startsWith(cwd)) {
                        results.push({ type: op.type, path: op.path, success: false, error: "Path is outside the project directory" });
                        continue;
                    }

                    try {
                        switch (op.type) {
                            case "add": {
                                await mkdir(dirname(resolved), { recursive: true });
                                const content = (op.content || "").trimEnd();
                                await writeFile(resolved, content, "utf-8");
                                if (sessionId) {
                                    recordMutation(sessionId, {
                                        type: "write",
                                        path: relative(cwd, resolved),
                                        previousContent: null,
                                        newContent: content,
                                    });
                                }
                                results.push({
                                    type: "add",
                                    path: relative(cwd, resolved),
                                    success: true,
                                });
                                break;
                            }
                            case "update": {
                                const content = (op.content || "").trimEnd();

                                const existing = await readFile(resolved, "utf-8");
                                if (existing === content) {
                                    results.push({ type: "update", path: relative(cwd, resolved), success: true });
                                    break;
                                }
                                await writeFile(resolved, content, "utf-8");
                                if (sessionId) {
                                    recordMutation(sessionId, {
                                        type: "edit",
                                        path: relative(cwd, resolved),
                                        previousContent: existing,
                                        newContent: content,
                                    });
                                }
                                results.push({
                                    type: "update",
                                    path: relative(cwd, resolved),
                                    success: true,
                                });
                                break;
                            }
                            case "move": {
                                const marker = patchText.match(
                                    new RegExp(`\\*\\*\\*\\s*Move to:\\s*${escapeRegex(op.path)}[\\s\\S]*?\\*\\*\\*\\s*Update File:\\s*(.+)$`, "m")
                                );
                                if (marker) {
                                    const sourcePath = resolve(cwd, marker[1]!.trim());
                                    await mkdir(dirname(resolved), { recursive: true });
                                    const content = await readFile(sourcePath, "utf-8");
                                    await writeFile(resolved, content, "utf-8");
                                    await unlink(sourcePath).catch(() => {});
                                }
                                results.push({ type: "move", path: relative(cwd, resolved), success: true });
                                break;
                            }
                            case "delete": {
                                let deletedContent: string | null = null;
                                try {
                                    deletedContent = await readFile(resolved, "utf-8");
                                } catch {}
                                await unlink(resolved);
                                if (sessionId && deletedContent !== null) {
                                    recordMutation(sessionId, {
                                        type: "delete",
                                        path: relative(cwd, resolved),
                                        previousContent: deletedContent,
                                        newContent: null,
                                    });
                                }
                                results.push({ type: "delete", path: relative(cwd, resolved), success: true });
                                break;
                            }
                        }
                    } catch (err) {
                        const message = err instanceof Error ? err.message : String(err);
                        results.push({ type: op.type, path: op.path, success: false, error: message });
                    }
                }

                const successCount = results.filter((r) => r.success).length;
                const failCount = results.filter((r) => !r.success).length;

                return {
                    summary: `Applied ${operations.length} operations: ${successCount} succeeded${failCount > 0 ? `, ${failCount} failed` : ""}`,
                    results,
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { error: `Failed to apply patch: ${message}` };
            }
        },
    });
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
