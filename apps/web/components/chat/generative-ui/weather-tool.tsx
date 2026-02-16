"use client";

import { cn } from "@workspace/ui/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Droplets,
  MapPin,
  Sun,
  Wind,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTheme } from "@/components/theme/theme-provider";
import { ModernSpinner, ShimmerText, ToolStatusBadge } from "./loading-effects";

interface WeatherData {
  city: string;
  country?: string;
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  units?: string;
}

interface WeatherToolProps {
  toolName?: string;
  status?: "pending" | "executing" | "completed" | "failed";
  args?: Record<string, unknown>;
  result?: string;
  error?: string;
  isLoading?: boolean;
}

const weatherIcons: Record<string, typeof Sun> = {
  clear: Sun,
  sunny: Sun,
  mainly: Sun,
  cloudy: Cloud,
  overcast: Cloud,
  partly: Cloud,
  rain: CloudRain,
  drizzle: CloudRain,
  snow: CloudSnow,
  fog: CloudFog,
  mist: CloudFog,
  thunderstorm: CloudLightning,
  storm: CloudLightning,
  default: Cloud,
};

function getWeatherIcon(condition?: string): typeof Sun {
  if (!condition) return weatherIcons.default;
  const lower = condition.toLowerCase();
  for (const [key, icon] of Object.entries(weatherIcons)) {
    if (lower.includes(key)) return icon;
  }
  return weatherIcons.default;
}

function parseWeatherResult(result?: string): WeatherData | null {
  if (!result) return null;
  try {
    const parsed = JSON.parse(result);
    if (parsed.temperature !== undefined) {
      return {
        city: parsed.city || "Unknown",
        country: parsed.country,
        temperature: parsed.temperature,
        condition: parsed.condition || "Unknown",
        humidity: parsed.humidity || 0,
        windSpeed: parsed.windSpeed || 0,
        units: parsed.units || "celsius",
      };
    }
  } catch {
    // Not JSON, return null
  }
  return null;
}

/**
 * Weather Tool Component
 * Compact, ergonomic design with glassmorphic styling
 */
export function WeatherTool({ status, args, result, error, isLoading }: WeatherToolProps) {
  const [expanded, setExpanded] = useState(true);
  const { themeMode } = useTheme();
  const isLight = themeMode === "light";

  // Get city from args
  const city = (args?.city as string) || (args?.location as string) || "";

  // Parse weather data
  const weatherData = useMemo(() => parseWeatherResult(result), [result]);

  const WeatherIcon = getWeatherIcon(weatherData?.condition);
  const isSearching = (isLoading || status === "executing") && !result && !error;
  const hasResult = weatherData !== null;

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn("overflow-hidden rounded-xl", "glass")}
      initial={{ opacity: 0, y: 10 }}
    >
      {/* Compact Header */}
      <div
        className={cn(
          "flex cursor-pointer items-center justify-between px-3 py-2",
          "hover:bg-primary/5 transition-colors"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <div className={cn("rounded-lg p-1.5", "bg-blue-500/10 text-blue-500")}>
            <Cloud className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{city ? `Weather in ${city}` : "Weather"}</span>
            {hasResult && status === "completed" && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  isLight ? "bg-blue-100 text-blue-700" : "bg-blue-500/20 text-blue-300"
                )}
              >
                {weatherData.temperature}°C
              </span>
            )}
          </div>
        </div>
        <ToolStatusBadge status={status || "pending"} />
      </div>

      {/* Expandable Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
          >
            <div
              className={cn(
                "border-t px-3 py-2",
                isLight ? "border-border/50" : "border-primary/10"
              )}
            >
              {/* Loading State */}
              {isSearching && (
                <div className="flex items-center justify-center gap-3 py-4">
                  <ModernSpinner size="sm" />
                  <ShimmerText
                    className={cn("text-sm", isLight ? "text-foreground" : "")}
                    text="Fetching weather..."
                  />
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-2">
                  <p className="text-destructive text-xs">{error}</p>
                </div>
              )}

              {/* Weather Result */}
              {hasResult && !isSearching && (
                <div className="space-y-3">
                  {/* Main Weather Display */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <WeatherIcon
                        className={cn("h-10 w-10", isLight ? "text-amber-500" : "text-amber-400")}
                      />
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span
                            className={cn(
                              "text-3xl font-bold",
                              isLight ? "text-foreground" : "text-foreground"
                            )}
                          >
                            {weatherData.temperature}
                          </span>
                          <span
                            className={cn(
                              "text-lg",
                              isLight ? "text-muted-foreground" : "text-muted-foreground"
                            )}
                          >
                            °C
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {weatherData.city}
                          {weatherData.country && `, ${weatherData.country}`}
                        </div>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        isLight ? "bg-blue-100 text-blue-700" : "bg-blue-500/20 text-blue-300"
                      )}
                    >
                      {weatherData.condition}
                    </span>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-lg p-2",
                        isLight ? "bg-muted/30" : "bg-background/30"
                      )}
                    >
                      <Droplets
                        className={cn("h-4 w-4", isLight ? "text-blue-500" : "text-blue-400")}
                      />
                      <div>
                        <p className="text-xs text-muted-foreground">Humidity</p>
                        <p className="font-medium text-sm">{weatherData.humidity}%</p>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-lg p-2",
                        isLight ? "bg-muted/30" : "bg-background/30"
                      )}
                    >
                      <Wind
                        className={cn("h-4 w-4", isLight ? "text-teal-500" : "text-teal-400")}
                      />
                      <div>
                        <p className="text-xs text-muted-foreground">Wind</p>
                        <p className="font-medium text-sm">{weatherData.windSpeed} km/h</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Fallback: Raw result */}
              {!isSearching && !error && !hasResult && result && (
                <div className={cn("rounded-lg p-2", isLight ? "bg-muted/30" : "bg-background/30")}>
                  <pre className="whitespace-pre-wrap font-mono text-xs">{result}</pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
