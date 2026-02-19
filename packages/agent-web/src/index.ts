import { tool } from "@langchain/core/tools";
import * as cheerio from "cheerio";
import { z } from "zod";

/**
 * Fetch and extract content from a URL (internal helper)
 */
async function extractUrlContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HorizonAgent/1.0)",
      },
    });

    if (!response.ok) {
      return "";
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove script and style elements
    $("script").remove();
    $("style").remove();
    $("nav").remove();
    $("footer").remove();
    $("header").remove();
    $("aside").remove();

    // Extract main text (simple heuristic: look for main, article, or body)
    let content = $("main").text().trim() || $("article").text().trim() || $("body").text().trim();

    // Clean up whitespace
    content = content.replace(/\s+/g, " ").slice(0, 3000); // Limit to 3000 chars per result

    return content;
  } catch {
    return "";
  }
}

/**
 * Search the web using DuckDuckGo HTML search
 * No API key required - uses the HTML version of DuckDuckGo
 * Optionally fetches content from top results for more context
 */
export const searchWeb = tool(
  async ({ query, fetchContent = true }) => {
    try {
      // Use DuckDuckGo HTML search (no API key needed)
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

      const response = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
      });

      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const results: Array<{ title: string; url: string; snippet: string }> = [];

      // Parse search results from DuckDuckGo HTML
      $(".result").each((_, element) => {
        const $result = $(element);
        const $link = $result.find(".result__a");
        const $snippet = $result.find(".result__snippet");

        const title = $link.text().trim();
        const url = $link.attr("href") || "";
        const snippet = $snippet.text().trim();

        if (title && url) {
          results.push({ title, url, snippet });
        }
      });

      if (results.length === 0) {
        return `No search results found for '${query}'.`;
      }

      // Limit to top 5 results
      const topResults = results.slice(0, 5);

      let output = `## Search results for '${query}'\n\n`;

      // If fetchContent is enabled, fetch content from top 3 results
      if (fetchContent && topResults.length > 0) {
        output += `### Summary of Results\n\n`;

        // Fetch content from top 3 results in parallel
        const fetchPromises = topResults.slice(0, 3).map(async (result) => {
          const content = await extractUrlContent(result.url);
          return { ...result, content };
        });

        const resultsWithContent = await Promise.all(fetchPromises);

        for (const result of resultsWithContent) {
          output += `#### [${result.title}](${result.url})\n`;
          if (result.snippet) {
            output += `> ${result.snippet}\n\n`;
          }
          if (result.content) {
            output += `${result.content.slice(0, 1500)}\n\n`;
          }
          output += "---\n\n";
        }

        // Add remaining results as links only
        if (topResults.length > 3) {
          output += `### Additional Results\n\n`;
          for (let i = 3; i < topResults.length; i++) {
            const result = topResults[i];
            if (result) {
              output += `- [${result.title}](${result.url})`;
              if (result.snippet) {
                output += ` - ${result.snippet}`;
              }
              output += "\n";
            }
          }
        }
      } else {
        // Just return links and snippets
        for (let i = 0; i < topResults.length; i++) {
          const result = topResults[i];
          if (result) {
            output += `### ${i + 1}. [${result.title}](${result.url})\n`;
            if (result.snippet) {
              output += `${result.snippet}\n`;
            }
            output += "\n";
          }
        }
      }

      return output;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Search failed: ${errorMessage}`;
    }
  },
  {
    name: "search_web",
    description:
      "Search the web for information using DuckDuckGo. Returns relevant search results with titles, URLs, snippets, and optionally fetches content from top results for more context.",
    schema: z.object({
      query: z.string().describe("The search query to look up."),
      fetchContent: z
        .boolean()
        .nullable()
        .default(true)
        .describe(
          "Whether to fetch and include content from top results. Set to false for faster results with just links and snippets."
        ),
    }),
  }
);

/**
 * Get weather information for a city using Open-Meteo API (free, no API key required)
 */
export const getWeather = tool(
  async ({ city }) => {
    try {
      // First, geocode the city to get coordinates
      const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;

      const geocodeResponse = await fetch(geocodeUrl);
      if (!geocodeResponse.ok) {
        throw new Error(`Geocoding failed with status ${geocodeResponse.status}`);
      }

      const geocodeData = await geocodeResponse.json();

      if (!geocodeData.results || geocodeData.results.length === 0) {
        return `City '${city}' not found. Please check the city name and try again.`;
      }

      const location = geocodeData.results[0];
      const latitude = location.latitude;
      const longitude = location.longitude;
      const cityName = location.name;
      const country = location.country || "";

      // Get weather data from Open-Meteo
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;

      const weatherResponse = await fetch(weatherUrl);
      if (!weatherResponse.ok) {
        throw new Error(`Weather fetch failed with status ${weatherResponse.status}`);
      }

      const weatherData = await weatherResponse.json();
      const current = weatherData.current;

      // Map weather code to condition
      const weatherCodeMap: Record<number, string> = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Foggy",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        71: "Slight snow",
        73: "Moderate snow",
        75: "Heavy snow",
        77: "Snow grains",
        80: "Slight rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Slight snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with slight hail",
        99: "Thunderstorm with heavy hail",
      };

      const condition = weatherCodeMap[current.weather_code] || "Unknown";

      // Return JSON for easy parsing by the UI
      return JSON.stringify({
        city: cityName,
        country: country,
        temperature: Math.round(current.temperature_2m),
        condition: condition,
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m),
        units: "celsius",
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return `Weather lookup failed: ${errorMessage}`;
    }
  },
  {
    name: "get_weather",
    description:
      "Get current weather information for a city. Returns temperature, conditions, humidity, and wind speed.",
    schema: z.object({
      city: z
        .string()
        .describe("The city name to get weather for (e.g., 'London', 'New York', 'Tokyo')."),
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
          "User-Agent": "Mozilla/5.0 (compatible; HorizonAgent/1.0)",
        },
      });

      if (!response.ok) {
        return `Failed to fetch content from: ${url} (Status: ${response.status})`;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove script and style elements
      $("script").remove();
      $("style").remove();
      $("nav").remove();
      $("footer").remove();
      $("header").remove();

      // Extract title
      const title = $("title").text().trim() || "No Title";

      // Extract main text (simple heuristic: look for main, article, or body)
      let content =
        $("main").text().trim() || $("article").text().trim() || $("body").text().trim();

      // Clean up whitespace
      content = content.replace(/\s+/g, " ").slice(0, 10_000); // Limit to 10k chars

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

export const webTools = [searchWeb, getWeather, fetchUrlContent];
