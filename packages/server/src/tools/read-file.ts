import { resolve,relative} from "path"
import {readFile} from "fs/promises"
import {tool} from "ai"
import {z} from "zod"

const MAX_FILE_SIZE=50_000

export function createReadFileTool(cwd:string) {
    return tool ({
        description:
        "Read contents of a file in the project. Supports reading specific line ranges. Returns file text, truncated if very large. Use offset and limit to read specific sections of large files.",
        inputSchema: z.object({
            path:z.string().describe("Relative path to the file to read"),
            offset: z
            .number()
            .int()
            .min(1)
            .describe("Starting line number (1-indexed). Use this to read from a specific line.")
            .optional(),
            limit: z
            .number()
            .int()
            .min(1)
            .max(2000)
            .describe("Maximum number of lines to read (max 2000). Defaults to 2000.")
            .optional(),
        }),

        execute: async ({ path, offset, limit}) => {
            const resolved =resolve(cwd,path);
            const rel = relative(cwd,resolved);

            if(rel.startsWith("..") || (resolve(resolved)!== resolved && rel.startsWith(".."))) {
                return { error:"path is outsid the project directory"}
            }

            if (!resolved.startsWith(cwd)) {
                return { error:"path is outside the project directory"}
            }

            try {
                const content = await readFile(resolved,"utf-8");
                const lines = content.split("\n");
                const totalLines = lines.length;

                if (offset !== undefined) {
                    const startLine = Math.max(0, offset - 1);
                    const effectiveLimit = limit ?? 2000;
                    const sliced = lines.slice(startLine, startLine + effectiveLimit);
                    const result = sliced.join("\n");
                    const isTruncated = startLine + effectiveLimit < totalLines;

                    return {
                        content: result,
                        lineStart: startLine + 1,
                        lineEnd: Math.min(startLine + effectiveLimit, totalLines),
                        totalLines,
                        ...(isTruncated ? { truncated: true } : {}),
                    };
                }

                if(content.length>MAX_FILE_SIZE) {
                    const isTruncated = limit !== undefined ? limit < totalLines : true;
                    const maxLines = limit ?? Math.floor(MAX_FILE_SIZE / 80);
                    return {
                        content: lines.slice(0, maxLines).join("\n"),
                        truncated: true,
                        totalLength: content.length,
                        totalLines,
                        lineStart: 1,
                        lineEnd: maxLines,
                    }
                }

                return {
                    content,
                    totalLines,
                    lineStart: 1,
                    lineEnd: totalLines,
                };

            } catch(err) {
                const message = err instanceof Error? err.message:String(err);
                return { error: `failed to read file:${message}`}
            }

        }
    })
}