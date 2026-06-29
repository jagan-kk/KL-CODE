import {tool} from "ai";
import {z} from "zod"

type Todo = {
    content: string;
    status: "pending" | "in_progress" | "completed" | "cancelled";
    priority: "high" | "medium" | "low";
};

const sessionTodos = new Map<string, Todo[]>();

export function clearSessionTodos(sessionId: string) {
    sessionTodos.delete(sessionId);
}

export function getSessionTodos(sessionId: string): Todo[] {
    return sessionTodos.get(sessionId) || [];
}

export function createTodoWriteTool(sessionId: string) {
    return tool({
        description:
        "Create and maintain a structured task list for the current coding session. Use this to track progress, organize multi-step work, and manage complex tasks. Only one task should be 'in_progress' at a time.",
        inputSchema: z.object({
            todos: z.array(z.object({
                content: z.string().describe("Brief description of the task"),
                status: z
                .enum(["pending", "in_progress", "completed", "cancelled"])
                .describe("Current status of the task"),
                priority: z
                .enum(["high", "medium", "low"])
                .describe("Priority level of the task"),
            })).describe("The full updated todo list (include all items, not just changes)"),
        }),
        execute: async ({todos}) => {
            sessionTodos.set(sessionId, todos);

            const counts = {
                total: todos.length,
                pending: todos.filter((t) => t.status === "pending").length,
                inProgress: todos.filter((t) => t.status === "in_progress").length,
                completed: todos.filter((t) => t.status === "completed").length,
                cancelled: todos.filter((t) => t.status === "cancelled").length,
            };

            return {
                success: true,
                counts,
                todos: todos.map((t) => ({
                    content: t.content,
                    status: t.status,
                    priority: t.priority,
                })),
            };
        },
    });
}
