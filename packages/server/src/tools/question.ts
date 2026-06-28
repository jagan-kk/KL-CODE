import {tool} from "ai";
import {z} from "zod"

export type QuestionCallback = (question: {
    header: string;
    question: string;
    options: { label: string; description: string }[];
    multiple: boolean;
}) => void;

const pendingQuestions = new Map<string, {
    resolve: (value: string[]) => void;
    timeout: ReturnType<typeof setTimeout>;
}>();

let questionCounter = 0;

let questionCallback: QuestionCallback = () => {};

export function setQuestionCallback(cb: QuestionCallback) {
    questionCallback = cb;
}

export function resolvePendingQuestion(questionId: string, answers: string[]) {
    const pending = pendingQuestions.get(questionId);
    if (pending) {
        clearTimeout(pending.timeout);
        pending.resolve(answers);
        pendingQuestions.delete(questionId);
    }
}

export function createQuestionTool() {
    return tool({
        description:
        "Ask the user a question during a task. Use this when you need clarification, decisions on implementation choices, or user preferences. Provide clear options when possible.",
        inputSchema: z.object({
            question: z.string().describe("The question to ask the user"),
            header: z
            .string()
            .describe("A short label for the question (max 30 chars)")
            .max(30),
            options: z
            .array(z.object({
                label: z.string().describe("Display text (1-5 words, concise)"),
                description: z.string().describe("Explanation of the choice"),
            }))
            .describe("Available options for the user to choose from")
            .optional(),
            multiple: z
            .boolean()
            .describe("Allow selecting multiple options")
            .default(false),
        }),
        execute: async ({question, header, options, multiple}) => {
            const questionId = `q_${++questionCounter}_${Date.now()}`;

            // Notify the client about the question
            questionCallback({
                header,
                question,
                options: options || [],
                multiple,
            });

            // Wait for the user's answer (resolved via resolvePendingQuestion)
            const answerPromise = new Promise<string[]>((resolve) => {
                const timeout = setTimeout(() => {
                    pendingQuestions.delete(questionId);
                    resolve([]);
                }, 300_000);

                pendingQuestions.set(questionId, {resolve, timeout});
            });

            try {
                const answers = await answerPromise;

                return {
                    questionId,
                    question,
                    answers,
                    answered: answers.length > 0,
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { error: `Failed to get answer: ${message}` };
            }
        },
    });
}
