import {tool} from "ai";
import {z} from "zod"

const MAX_RESULTS = 8;

export function createWebSearchTool() {
    return tool({
        description:
        "Search the web for information. Returns relevant snippets and URLs. Use this to find current information, documentation, or research topics.",
        inputSchema: z.object({
            query: z.string().describe("The search query"),
            count: z
            .number()
            .describe("Number of results to return (default: 5, max: 10)")
            .default(5),
        }),
        execute: async ({query, count}) => {
            const numResults = Math.min(Math.max(1, count), MAX_RESULTS);

            try {
                const searchUrl = new URL("https://html.duckduckgo.com/html/");
                searchUrl.searchParams.set("q", query);

                const response = await fetch(searchUrl.toString(), {
                    headers: {
                        "User-Agent": "KL-CODE/1.0",
                        "Accept": "text/html",
                    },
                });

                if (!response.ok) {
                    return { error: `Search failed: HTTP ${response.status}` };
                }

                const html = await response.text();

                const results: { title: string; url: string; snippet: string }[] = [];
                const resultRegex = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

                let match;
                while ((match = resultRegex.exec(html)) !== null && results.length < numResults) {
                    let url = match[1]!.replace(/\/\/duckduckgo\.com\/l\/\?uddg=/, "");
                    url = decodeURIComponent(url);
                    const title = match[2]!.replace(/<[^>]+>/g, "").trim();
                    const snippet = match[3]!.replace(/<[^>]+>/g, "").trim();
                    results.push({ title, url, snippet });
                }

                if (results.length === 0) {
                    const altRegex = /<h2[^>]*>([\s\S]*?)<\/h2>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi;
                    while ((match = altRegex.exec(html)) !== null && results.length < numResults) {
                        const title = match[1]!.replace(/<[^>]+>/g, "").trim();
                        const snippet = match[2]!.replace(/<[^>]+>/g, "").trim();
                        if (title && snippet) {
                            results.push({ title, url: "", snippet });
                        }
                    }
                }

                return {
                    query,
                    results,
                    totalResults: results.length,
                };
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                return { error: `Search failed: ${message}` };
            }
        },
    });
}
