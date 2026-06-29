import {z} from "zod";

export const toolCallArgsSchema=z.record(z.string(),z.json());

export const messagePartSchema = z.discriminatedUnion("type", [
    z.object({
        type:z.literal("reasoning"),
        text:z.string(),
    }),
    z.object({
        type:z.literal("tool-call"),
        id:z.string(),
        name:z.string(),
        args:toolCallArgsSchema,
        result:z.string().optional(),
    }),
    z.object({
        type:z.literal("text"),
        text:z.string(),
    }),
    z.object({
        type:z.literal("question"),
        questionId:z.string(),
        header:z.string(),
        question:z.string(),
        options:z.array(z.object({
            label:z.string(),
            description:z.string(),
        })).optional(),
        multiple:z.boolean().default(false),
    }),
    z.object({
        type:z.literal("todo"),
        todos:z.array(z.object({
            content:z.string(),
            status:z.enum(["pending","in_progress","completed","cancelled"]),
            priority:z.enum(["high","medium","low"]),
        })),
    }),
])

export const messagePartsSchema=z.array(messagePartSchema);

export type MessagePart = z.infer<typeof messagePartSchema>;

export const chatStreamEventSchema = z.discriminatedUnion("type",[
    z.object({
        type:z.literal("text-delta"),
        text:z.string(),
    }),
    z.object({
        type:z.literal("reasoning-delta"),
        text:z.string(),
    }),
    z.object({
        type: z.literal("tool-call"),
        toolCallId: z.string(),
        toolName:z.string(),
        args:toolCallArgsSchema,

    }),
    z.object({
        type: z.literal("tool-result"),
        toolCallId: z.string(),
        result:z.string()
    }),
    z.object({
        type: z.literal("done"),
        messageId:z.string(),
        durationMs: z.number(),
    }),
    z.object({
        type:z.literal("error"),
        message:z.string()
    }),
    z.object({
        type: z.literal("question"),
        questionId: z.string(),
        header: z.string(),
        question: z.string(),
        options: z.array(z.object({
            label: z.string(),
            description: z.string(),
        })).optional(),
        multiple: z.boolean().default(false),
    }),
    z.object({
        type: z.literal("permission-request"),
        toolCallId: z.string(),
        toolName: z.string(),
        args: toolCallArgsSchema,
    }),
]);

export type ChatStreamEvent=z.infer<typeof chatStreamEventSchema>;
