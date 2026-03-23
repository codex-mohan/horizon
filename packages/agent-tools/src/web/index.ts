import { tool } from "@langchain/core/tools";
import * as cheerio from "cheerio";
import { z } from "zod";

interface GeocodeResult {
  latitude: number;
  longitude: number;
  name: string;
  country: string;
}

interface GeocodeResponse {
  results?: GeocodeResult[];
}

interface WeatherCurrent {
  temperature_2m: number;
  relative_humidity_2m: number;
  wind_speed_10m: number;
  weather_code: number;
}

interface WeatherResponse {
  current: WeatherCurrent;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface SearchSummary {
  resultIndex: number;
  url: string;
  title: string;
  content: string | null;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  totalResults: number;
  error?: string;
  summaries?: SearchSummary[];
}

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

    $("script").remove();
    $("style").remove();
    $("nav").remove();
    $("footer").remove();
    $("header").remove();
    $("aside").remove();

    let content = $("main").text().trim() || $("article").text().trim() || $("body").text().trim();

    content = content.replace(/\s+/g, " ").slice(0, 3000);

    return content;
  } catch {
    return "";
  }
}

export type { SearchResult, SearchResponse };

export const searchWeb = tool(
  async ({ query, fetchContent = false }) => {
    try {
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

      const results: SearchResult[] = [];

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
        return JSON.stringify({
          query,
          results: [],
          totalResults: 0,
          error: `No search results found for '${query}'.`,
        } satisfies SearchResponse);
      }

      const topResults = results.slice(0, 8);

      const searchResponse: SearchResponse = {
        query,
        results: topResults,
        totalResults: results.length,
      };

      if (fetchContent && topResults.length > 0) {
        const fetchPromises = topResults.slice(0, 3).map(async (result) => {
          const content = await extractUrlContent(result.url);
          return { ...result, content };
        });

        const resultsWithContent = await Promise.all(fetchPromises);

        // Add structured summaries to the response
        searchResponse.summaries = resultsWithContent.map((r, index) => ({
          resultIndex: index,
          url: r.url,
          title: r.title,
          content: r.content?.slice(0, 2000) || null,
        }));

        return JSON.stringify(searchResponse);
      }

      return JSON.stringify(searchResponse);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return JSON.stringify({
        query,
        results: [],
        totalResults: 0,
        error: `Search failed: ${errorMessage}`,
      } satisfies SearchResponse);
    }
  },
  {
    name: "search_web",
    description:
      "Search the web for information using DuckDuckGo. Returns structured search results with titles, URLs, and snippets. Use fetchContent=true to include brief content summaries from top results.",
    schema: z.object({
      query: z.string().describe("The search query to look up."),
      fetchContent: z
        .boolean()
        .default(false)
        .describe(
          "Whether to fetch and include brief content summaries from top 2 results. Default is false for faster results."
        ),
    }),
  }
);

export const getWeather = tool(
  async ({ city }) => {
    try {
      const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;

      const geocodeResponse = await fetch(geocodeUrl);
      if (!geocodeResponse.ok) {
        throw new Error(`Geocoding failed with status ${geocodeResponse.status}`);
      }

      const geocodeData = (await geocodeResponse.json()) as GeocodeResponse;

      if (!geocodeData.results || geocodeData.results.length === 0) {
        return `City '${city}' not found. Please check the city name and try again.`;
      }

      const location = geocodeData.results[0];
      const latitude = location.latitude;
      const longitude = location.longitude;
      const cityName = location.name;
      const country = location.country || "";

      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;

      const weatherResponse = await fetch(weatherUrl);
      if (!weatherResponse.ok) {
        throw new Error(`Weather fetch failed with status ${weatherResponse.status}`);
      }

      const weatherData = (await weatherResponse.json()) as WeatherResponse;
      const current = weatherData.current;

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

      $("script").remove();
      $("style").remove();
      $("nav").remove();
      $("footer").remove();
      $("header").remove();

      const title = $("title").text().trim() || "No Title";

      let content =
        $("main").text().trim() || $("article").text().trim() || $("body").text().trim();

      content = content.replace(/\s+/g, " ").slice(0, 10_000);

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
