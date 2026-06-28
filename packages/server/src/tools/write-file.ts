import {tool} from "ai";
import {z} from "zod"
import {resolve,relative,dirname} from "path"
import { readFile,writeFile,mkdir } from "fs/promises";
import { recordMutation } from "../lib/undo-redo";

export function createWriteFileTool(cwd:string, sessionId?: string) {
    return tool ({
        description:
        "Create or overwrite a file in the project. create parent directories if they don't exist.",
        inputSchema: z.object({
            path:z.string().describe("Relative path to the file to write"),
            content:z.string().describe("The full content to write to the file"),

        }),

        execute: async ({ path,content}) => {
            const resolved =resolve(cwd,path);

            if(!resolved.startsWith(cwd)) {
                return { error:"path is outsid the project directory"}
            }
            try {
                let previousContent: string | null = null;
                try {
                    previousContent = await readFile(resolved, "utf-8");
                } catch {
                    // File doesn't exist yet
                }

                await mkdir(dirname(resolved),{recursive:true});
                await writeFile(resolved,content,"utf-8");

                if (sessionId) {
                    recordMutation(sessionId, {
                        type: previousContent !== null ? "write" : "write",
                        path: relative(cwd, resolved),
                        previousContent,
                        newContent: content,
                    });
                }

                return {
                    success:true as const,
                    path:relative(cwd,resolved),
                    bytesWritten:Buffer.byteLength(content,"utf-8"),
                }
            } catch(err) {
                const message = err instanceof Error? err.message:String(err);
                return { error: `failed to write file:${message}`}
            }

        }
    })
}