import * as cheerio from "cheerio";

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

export type { SearchResult, SearchResponse };

async function extractUrlContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HorizonAgent/1.0)" },
    });
    if (!response.ok) return "";
    const html = await response.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header, aside").remove();
    const content = (
      $("main").text().trim() ||
      $("article").text().trim() ||
      $("body").text().trim()
    )
      .replace(/\s+/g, " ")
      .slice(0, 3000);
    return content;
  } catch {
    return "";
  }
}

// ─── Search Web ───────────────────────────────────────────────────────────────

async function searchWebFn({
  query,
  fetchContent = false,
}: {
  query: string;
  fetchContent?: boolean;
}): Promise<string> {
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

    if (!response.ok) throw new Error(`Search failed with status ${response.status}`);

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $(".result").each((_, element) => {
      const $result = $(element);
      const $link = $result.find(".result__a");
      const title = $link.text().trim();
      const url = $link.attr("href") || "";
      const snippet = $result.find(".result__snippet").text().trim();
      if (title && url) results.push({ title, url, snippet });
    });

    if (results.length === 0) {
      return JSON.stringify({
        query,
        results: [],
        totalResults: 0,
        error: `No results found for '${query}'.`,
      } satisfies SearchResponse);
    }

    const topResults = results.slice(0, 8);
    const searchResponse: SearchResponse = {
      query,
      results: topResults,
      totalResults: results.length,
    };

    if (fetchContent && topResults.length > 0) {
      const fetchPromises = topResults.slice(0, 3).map(async (result) => ({
        ...result,
        content: await extractUrlContent(result.url),
      }));
      const resultsWithContent = await Promise.all(fetchPromises);
      searchResponse.summaries = resultsWithContent.map((r, index) => ({
        resultIndex: index,
        url: r.url,
        title: r.title,
        content: r.content?.slice(0, 2000) || null,
      }));
    }

    return JSON.stringify(searchResponse);
  } catch (error) {
    return JSON.stringify({
      query,
      results: [],
      totalResults: 0,
      error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
    } satisfies SearchResponse);
  }
}

// ─── Get Weather ──────────────────────────────────────────────────────────────

async function getWeatherFn({ city }: { city: string }): Promise<string> {
  try {
    const geocodeUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;
    const geocodeResponse = await fetch(geocodeUrl);
    if (!geocodeResponse.ok)
      throw new Error(`Geocoding failed with status ${geocodeResponse.status}`);

    const geocodeData = (await geocodeResponse.json()) as GeocodeResponse;
    if (!geocodeData.results || geocodeData.results.length === 0) {
      return `City '${city}' not found. Please check the city name and try again.`;
    }

    const { latitude, longitude, name: cityName, country } = geocodeData.results[0]!;
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;
    const weatherResponse = await fetch(weatherUrl);
    if (!weatherResponse.ok)
      throw new Error(`Weather fetch failed with status ${weatherResponse.status}`);

    const { current } = (await weatherResponse.json()) as WeatherResponse;
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

    return JSON.stringify({
      city: cityName,
      country: country || "",
      temperature: Math.round(current.temperature_2m),
      condition: weatherCodeMap[current.weather_code] || "Unknown",
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m),
      units: "celsius",
    });
  } catch (error) {
    return `Weather lookup failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ─── Fetch URL Content ────────────────────────────────────────────────────────

async function fetchUrlContentFn({ url }: { url: string }): Promise<string> {
  try {
    const targetUrl = url.startsWith("http") ? url : `https://${url}`;
    const response = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HorizonAgent/1.0)" },
    });
    if (!response.ok) return `Failed to fetch content from: ${url} (Status: ${response.status})`;

    const html = await response.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header").remove();
    const title = $("title").text().trim() || "No Title";
    const content = (
      $("main").text().trim() ||
      $("article").text().trim() ||
      $("body").text().trim()
    )
      .replace(/\s+/g, " ")
      .slice(0, 10_000);
    return `# ${title}\n\n${content}`;
  } catch (error) {
    return `Error fetching ${url}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ─── Exported tool objects with .invoke() compat ─────────────────────────────
// The agent's tools/index.ts calls these via `.invoke()`. We expose plain
// objects with an `invoke` method so no changes are needed in the caller.

export const searchWeb = { invoke: searchWebFn };
export const getWeather = { invoke: getWeatherFn };
export const fetchUrlContent = { invoke: fetchUrlContentFn };

export const webTools = [searchWeb, getWeather, fetchUrlContent];
