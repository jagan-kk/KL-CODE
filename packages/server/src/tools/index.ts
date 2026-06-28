import type {Mode} from "@KL-CODE/database/enums"
import { createReadFileTool } from "./read-file"
import { createListDirectoryTool } from "./list-directory"
import { createWriteFileTool } from "./write-file"
import { createEditFileTool } from "./edit-file"
import { createGlobTool } from "./glob"
import { createGrepTool } from "./grep"
import { createBashTool } from "./bash"
import { createWebFetchTool } from "./webfetch"
import { createWebSearchTool } from "./websearch"
import { createQuestionTool } from "./question"
import { createTodoWriteTool } from "./todowrite"
import { createSkillTool } from "./skill"
import { createApplyPatchTool } from "./apply-patch"
import { createLspTool } from "./lsp"

export { resolvePendingQuestion, setQuestionCallback } from "./question"
export type { QuestionCallback } from "./question"
export { clearSessionTodos, getSessionTodos } from "./todowrite"

export function createTools(cwd: string, mode: Mode, sessionId?: string) {
    const readOnlyTools = {
        readFile: createReadFileTool(cwd),
        listDirectory: createListDirectoryTool(cwd),
        grep: createGrepTool(cwd),
        glob: createGlobTool(cwd),
        webfetch: createWebFetchTool(),
        websearch: createWebSearchTool(),
        skill: createSkillTool(cwd),
        lsp: createLspTool(cwd),
    }

    if (mode === "PLAN") {
        return {
            ...readOnlyTools,
            question: createQuestionTool(),
            todowrite: createTodoWriteTool(sessionId ?? "default"),
        }
    }

    return {
        ...readOnlyTools,
        writeFile: createWriteFileTool(cwd, sessionId),
        editFile: createEditFileTool(cwd, sessionId),
        bash: createBashTool(cwd),
        applyPatch: createApplyPatchTool(cwd, sessionId),
        question: createQuestionTool(),
        todowrite: createTodoWriteTool(sessionId ?? "default"),
    }
}
