import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@KL-CODE/database/client";
import { undoMutation, redoMutation, clearSessionHistory, recordMutation } from "../lib/undo-redo";

export { recordMutation, clearSessionHistory };

const undoRedoSchema = z.object({
    action: z.enum(["undo", "redo"]),
});

const undoValidator = zValidator("json", undoRedoSchema, (result, c) => {
    if (!result.success) {
        return c.json({ error: "Invalid request body" }, 400);
    }
});

const app = new Hono()
    .post("/:sessionId/undo", undoValidator, async (c) => {
        const sessionId = c.req.param("sessionId");
        const { action } = c.req.valid("json");

        const session = await db.session.findUnique({ where: { id: sessionId } });
        if (!session) {
            return c.json({ error: "Session not found" }, 404);
        }

        if (!session.cwd) {
            return c.json({ error: "Session has no working directory" }, 400);
        }

        const result = action === "undo"
            ? await undoMutation(sessionId, session.cwd)
            : await redoMutation(sessionId, session.cwd);

        return c.json(result);
    })
    .post("/:sessionId/clear", async (c) => {
        const sessionId = c.req.param("sessionId");
        clearSessionHistory(sessionId);
        return c.json({ success: true });
    });

export default app;
