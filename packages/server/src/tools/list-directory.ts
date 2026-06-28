import {tool} from "ai";
import {z} from "zod"
import { resolve,relative,join } from "path";
import { readdir,stat} from "fs/promises"

export function createListDirectoryTool(cwd:string) {
    return tool({
        description:
        "list files and directories in a project directory. returns names with type indicators.",
        inputSchema:z.object ({
            path:z.string()
            .describe("relative path to the directory to list (defaults to project root)")
            .default("."),
        }),

        execute : async ({path}) => {
            const resolved = resolve(cwd,path);

            if(!resolved.startsWith(cwd)) {
                return {error: "path is outside the project directory"}
            }

            try {
                const entries = await readdir(resolved)
                const results:{name:string;type:"file" | "directory"}[]=[];

                for (const entry of entries) {
                    if (entry.startsWith(".") || entry === "node_modules") continue;

                    try{
                        const entryPath = join(resolved,entry);
                        const info = await stat(entryPath)
                        results.push({
                            name:entry,
                            type:info.isDirectory() ? "directory" : "file",
                        })  
                    }catch {

                    }
                }
                results.sort((a,b) => {
                    if(a.type!=b.type) return a.type ==="directory" ? -1 :1;
                    return a.name.localeCompare(b.name)
                })

                return {
                    path:relative(cwd,resolved) || ".",
                    entries:results,
                };

            }catch (err){
                const message = err instanceof Error ? err.message : String(err);
                return { error:`Failed oto list directory:${message}`}
            }
        }
        

    })
}