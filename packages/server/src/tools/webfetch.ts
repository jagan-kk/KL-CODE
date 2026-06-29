import {tool} from "ai";
import {z} from "zod"

const MAX_RESPONSE_SIZE = 50_000;
const DEFAULT_TIMEOUT = 15_000;

export function createWebFetchTool() {
    return tool({
        description:
        "Fetch content from a URL and return it as text. Use this to read web pages, documentation, APIs, or any online resource.",
        inputSchema: z.object({
            url: z.string().url().describe("The URL to fetch content from"),
            format: z
            .enum(["markdown", "text", "html"])
            .describe("Desired output format (default: text)")
            .default("text"),
            timeout: z
            .number()
            .describe("Timeout in milliseconds (default: 15000)")
            .default(DEFAULT_TIMEOUT),
        }),
        execute: async ({url, format, timeout}) => {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(url, {
                    signal: controller.signal,
                    headers: {
                        "User-Agent": "KL-CODE/1.0",
                        "Accept": format === "html" ? "text/html" : "text/plain",
                    },
                });
                clearTimeout(timer);

                if (!response.ok) {
                    return { error: `HTTP ${response.status}: ${response.statusText}` };
                }

                const contentType = response.headers.get("content-type") || "";
                const isLikelyBinary = contentType.startsWith("image/") ||
                    contentType.startsWith("audio/") ||
                    contentType.startsWith("video/") ||
                    contentType.includes("application/pdf") ||
                    contentType.includes("application/zip") ||
                    contentType.includes("application/octet-stream");

                if (isLikelyBinary) {
                    return { error: `Cannot fetch binary content: ${contentType}` };
                }

                let content = await response.text();
                const truncated = content.length > MAX_RESPONSE_SIZE;

                if (truncated) {
                    content = content.slice(0, MAX_RESPONSE_SIZE) +
                        `\n... (truncated, ${content.length} total chars)`;
                }

                return {
                    content,
                    url,
                    format,
                    contentType,
                    truncated,
                };
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") {
                    return { error: "Request timed out" };
                }
                const message = err instanceof Error ? err.message : String(err);
                return { error: `Failed to fetch URL: ${message}` };
            }
        },
    });
}
