import { tool } from "@langchain/core/tools";
import { z } from "zod";
import * as cheerio from "cheerio";

// Configuration for DuckDuckGo
const DDG_API_URL = "https://api.duckduckgo.com/";

/**
 * Search the web using DuckDuckGo API
 */
export const searchWeb = tool(
    async ({ query }) => {
        try {
            const response = await fetch(`${DDG_API_URL}?q=${encodeURIComponent(query)}&format=json&no_html=1`);
            if (!response.ok) {
                throw new Error(`Search failed with status ${response.status}`);
            }

            const data = await response.json();
            const abstract = data.AbstractText || "";
            const relatedTopics = data.RelatedTopics || [];

            let result = `Search results for '${query}':\n`;

            if (abstract) {
                result += `\n## Summary\n${abstract}\n`;
            }

            if (relatedTopics.length > 0) {
                result += `\n## Related Topics\n`;
                // Limit to 5 topics
                for (const topic of relatedTopics.slice(0, 5)) {
                    if (topic.Text && topic.FirstURL) {
                        result += `- [${topic.Text}](${topic.FirstURL})\n`;
                    }
                }
            }

            if (!abstract && relatedTopics.length === 0) {
                return "No results found.";
            }

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return `Search failed: ${errorMessage}`;
        }
    },
    {
        name: "search_web",
        description: "Search the web for information using DuckDuckGo.",
        schema: z.object({
            query: z.string().describe("The search query to look up."),
        }),
    }
);

/**
 * Fetch and extract content from a URL
 */
export const fetchUrlContent = tool(
    async ({ url }) => {
        try {
            let targetUrl = url;
            if (!targetUrl.startsWith("http")) {
                targetUrl = `https://${targetUrl}`;
            }

            const response = await fetch(targetUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; HorizonAgent/1.0)"
                }
            });

            if (!response.ok) {
                return `Failed to fetch content from: ${url} (Status: ${response.status})`;
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            // Remove script and style elements
            $('script').remove();
            $('style').remove();
            $('nav').remove();
            $('footer').remove();
            $('header').remove();

            // Extract title
            const title = $('title').text().trim() || 'No Title';

            // Extract main text (simple heuristic: look for main, article, or body)
            let content = $('main').text().trim() || $('article').text().trim() || $('body').text().trim();

            // Clean up whitespace
            content = content.replace(/\s+/g, ' ').slice(0, 10000); // Limit to 10k chars

            return `# ${title}\n\n${content}`;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return `Error fetching ${url}: ${errorMessage}`;
        }
    },
    {
        name: "fetch_url_content",
        description: "Fetch and extract text content from a URL.",
        schema: z.object({
            url: z.string().describe("The URL to fetch content from."),
        }),
    }
);

export const webTools = [searchWeb, fetchUrlContent];
