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
  RefreshCw,
  Sun,
  Wind,
} from "lucide-react";
import { useTheme } from "@/components/theme/theme-provider";

interface WeatherToolProps {
  toolName?: string;
  status?: "pending" | "executing" | "completed" | "failed";
  args?: Record<string, unknown>;
  result?: string;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  isLoading?: boolean;
  city?: string;
  temperature?: number;
  condition?: string;
  humidity?: number;
  windSpeed?: number;
}

const weatherIcons: Record<string, typeof Sun> = {
  sunny: Sun,
  clear: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  snow: CloudSnow,
  fog: CloudFog,
  mist: CloudFog,
  storm: CloudLightning,
  thunderstorm: CloudLightning,
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

function parseWeatherResult(result?: string): Partial<WeatherToolProps> {
  if (!result) return {};
  try {
    const parsed = JSON.parse(result);
    return {
      city: parsed.city || parsed.location || parsed.name,
      temperature: parsed.temperature || parsed.temp || parsed.current?.temp,
      condition: parsed.condition || parsed.weather || parsed.current?.condition,
      humidity: parsed.humidity || parsed.current?.humidity,
      windSpeed: parsed.windSpeed || parsed.wind_speed || parsed.current?.wind_speed,
    };
  } catch {
    return {};
  }
}

export function WeatherTool(props: WeatherToolProps) {
  const { themeMode } = useTheme();
  const isLight = themeMode === "light";

  const data: {
    city: string | undefined;
    temperature: number | undefined;
    condition: string | undefined;
    humidity: number | undefined;
    windSpeed: number | undefined;
  } = {
    ...parseWeatherResult(props.result),
    city:
      props.city ||
      (props.args?.city as string | undefined) ||
      (props.args?.location as string | undefined),
    temperature: props.temperature,
    condition: props.condition,
    humidity: props.humidity,
    windSpeed: props.windSpeed,
  };

  const WeatherIcon = getWeatherIcon(data.condition);
  const isLoading = props.isLoading || props.status === "executing" || props.status === "pending";
  const hasError = props.status === "failed" || props.error;
  const hasResult = !isLoading && !hasError && data.temperature !== undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className={cn(
        "overflow-hidden rounded-xl border shadow-lg",
        isLight
          ? "border-border bg-gradient-to-br from-blue-50/80 to-cyan-50/80"
          : "border-blue-500/20 bg-gradient-to-br from-blue-950/40 to-cyan-950/40"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-3",
          isLight ? "border-border/50" : "border-blue-500/20"
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "rounded-xl p-2.5",
              isLight ? "bg-blue-100 text-blue-600" : "bg-blue-500/20 text-blue-400"
            )}
          >
            <Cloud className="h-5 w-5" />
          </div>
          <div>
            <span
              className={cn(
                "font-semibold text-sm",
                isLight ? "text-foreground" : "text-slate-200"
              )}
            >
              Weather
            </span>
            {data.city && (
              <p
                className={cn(
                  "text-xs flex items-center gap-1",
                  isLight ? "text-muted-foreground" : "text-slate-400"
                )}
              >
                <MapPin className="h-3 w-3" />
                {data.city}
              </p>
            )}
          </div>
        </div>
        {isLoading && (
          <RefreshCw
            className={cn("h-4 w-4 animate-spin", isLight ? "text-blue-500" : "text-blue-400")}
          />
        )}
      </div>

      <div className="p-4">
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-8 gap-3"
            >
              <div className="relative">
                <WeatherIcon
                  className={cn("h-12 w-12", isLight ? "text-blue-400" : "text-blue-500")}
                />
                <div className="absolute inset-0 animate-ping">
                  <WeatherIcon
                    className={cn(
                      "h-12 w-12 opacity-20",
                      isLight ? "text-blue-400" : "text-blue-500"
                    )}
                  />
                </div>
              </div>
              <p className={cn("text-sm", isLight ? "text-muted-foreground" : "text-slate-400")}>
                Fetching weather data...
              </p>
            </motion.div>
          )}

          {hasError && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-lg border border-destructive/20 bg-destructive/10 p-4"
            >
              <p className="text-destructive text-sm">{props.error || "Failed to fetch weather"}</p>
            </motion.div>
          )}

          {hasResult && (
            <motion.div
              key="result"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <WeatherIcon
                    className={cn("h-10 w-10", isLight ? "text-amber-500" : "text-amber-400")}
                  />
                  <div>
                    <span
                      className={cn(
                        "text-4xl font-bold",
                        isLight ? "text-foreground" : "text-slate-100"
                      )}
                    >
                      {Math.round(data.temperature as number)}°
                    </span>
                    <span
                      className={cn(
                        "text-lg ml-1",
                        isLight ? "text-muted-foreground" : "text-slate-400"
                      )}
                    >
                      C
                    </span>
                  </div>
                </div>
                {data.condition && (
                  <span
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium",
                      isLight ? "bg-blue-100 text-blue-700" : "bg-blue-500/20 text-blue-300"
                    )}
                  >
                    {data.condition}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {data.humidity !== undefined && (
                  <div
                    className={cn("rounded-lg p-3", isLight ? "bg-muted/50" : "bg-slate-800/50")}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Droplets
                        className={cn("h-4 w-4", isLight ? "text-blue-500" : "text-blue-400")}
                      />
                      <span
                        className={cn(
                          "text-xs",
                          isLight ? "text-muted-foreground" : "text-slate-400"
                        )}
                      >
                        Humidity
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-lg font-semibold",
                        isLight ? "text-foreground" : "text-slate-200"
                      )}
                    >
                      {data.humidity}%
                    </span>
                  </div>
                )}

                {data.windSpeed !== undefined && (
                  <div
                    className={cn("rounded-lg p-3", isLight ? "bg-muted/50" : "bg-slate-800/50")}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Wind
                        className={cn("h-4 w-4", isLight ? "text-teal-500" : "text-teal-400")}
                      />
                      <span
                        className={cn(
                          "text-xs",
                          isLight ? "text-muted-foreground" : "text-slate-400"
                        )}
                      >
                        Wind
                      </span>
                    </div>
                    <span
                      className={cn(
                        "text-lg font-semibold",
                        isLight ? "text-foreground" : "text-slate-200"
                      )}
                    >
                      {data.windSpeed} km/h
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
