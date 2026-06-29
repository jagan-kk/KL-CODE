import { writeFile, unlink } from "fs/promises";
import { resolve } from "path";

type FileMutation = {
    type: "edit" | "write" | "delete";
    path: string;
    previousContent: string | null;
    newContent: string | null;
    timestamp: number;
};

const sessionHistory = new Map<string, FileMutation[]>();
const sessionPosition = new Map<string, number>();

export function recordMutation(
    sessionId: string,
    mutation: Omit<FileMutation, "timestamp">
) {
    const history = sessionHistory.get(sessionId) || [];
    const pos = sessionPosition.get(sessionId) ?? 0;

    // Clear any redo history beyond current position
    history.length = pos;

    history.push({ ...mutation, timestamp: Date.now() });
    sessionHistory.set(sessionId, history);
    sessionPosition.set(sessionId, history.length);
}

export async function undoMutation(
    sessionId: string,
    cwd: string
): Promise<{ success: boolean; description?: string; error?: string }> {
    const history = sessionHistory.get(sessionId);
    if (!history || history.length === 0) {
        return { success: false, error: "Nothing to undo" };
    }

    const pos = sessionPosition.get(sessionId) ?? history.length;
    if (pos <= 0) {
        return { success: false, error: "Nothing to undo" };
    }

    const mutation = history[pos - 1]!;
    const resolvedPath = resolve(cwd, mutation.path);

    try {
        if (mutation.type === "delete" && mutation.previousContent !== null) {
            await writeFile(resolvedPath, mutation.previousContent, "utf-8");
        } else if (mutation.type === "edit") {
            await writeFile(resolvedPath, mutation.previousContent ?? "", "utf-8");
        } else if (mutation.type === "write") {
            if (mutation.previousContent !== null) {
                await writeFile(resolvedPath, mutation.previousContent, "utf-8");
            } else {
                await unlink(resolvedPath).catch(() => {});
            }
        }

        sessionPosition.set(sessionId, pos - 1);
        return {
            success: true,
            description: `Undid ${mutation.type} on ${mutation.path}`,
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Failed to undo: ${message}` };
    }
}

export async function redoMutation(
    sessionId: string,
    cwd: string
): Promise<{ success: boolean; description?: string; error?: string }> {
    const history = sessionHistory.get(sessionId);
    if (!history) {
        return { success: false, error: "Nothing to redo" };
    }

    const pos = sessionPosition.get(sessionId) ?? history.length;
    if (pos >= history.length) {
        return { success: false, error: "Nothing to redo" };
    }

    const mutation = history[pos]!;
    const resolvedPath = resolve(cwd, mutation.path);

    try {
        if (mutation.type === "delete") {
            await unlink(resolvedPath).catch(() => {});
        } else if (mutation.newContent !== null) {
            await writeFile(resolvedPath, mutation.newContent, "utf-8");
        }

        sessionPosition.set(sessionId, pos + 1);
        return {
            success: true,
            description: `Redid ${mutation.type} on ${mutation.path}`,
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: `Failed to redo: ${message}` };
    }
}

export function clearSessionHistory(sessionId: string) {
    sessionHistory.delete(sessionId);
    sessionPosition.delete(sessionId);
}
