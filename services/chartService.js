import axios from "axios";

/*
=========================================
YAHOO FINANCE CHART CONFIG
=========================================

Range and candle interval are intentionally
independent.

The frontend can request:
  range=1d
  interval=1m

instead of the old behaviour where the
interval was automatically hard-coded from
the selected range.
*/

const RANGE_CONFIG = {
  "1d": { range: "1d", fallbackInterval: "5m" },
  "5d": { range: "5d", fallbackInterval: "15m" },
  "1mo": { range: "1mo", fallbackInterval: "1h" },
  "3mo": { range: "3mo", fallbackInterval: "1d" },
  "6mo": { range: "6mo", fallbackInterval: "1d" },
  "1y": { range: "1y", fallbackInterval: "1d" },
  "2y": { range: "2y", fallbackInterval: "1wk" },
  "5y": { range: "5y", fallbackInterval: "1mo" },
  "max": { range: "max", fallbackInterval: "1mo" },
};

/*
=========================================
SUPPORTED CANDLE INTERVALS
=========================================
*/

const SUPPORTED_INTERVALS = new Set([
  "1m",
  "2m",
  "5m",
  "15m",
  "30m",
  "90m",
  "1h",
  "1d",
  "5d",
  "1wk",
  "1mo",
  "3mo",
]);

/*
=========================================
NORMALIZE RANGE
=========================================
*/

function normalizeRange(selectedRange = "1d") {
  const value =
    String(selectedRange || "1d")
      .trim()
      .toLowerCase();

  /*
  Accept common frontend aliases while keeping
  the existing Yahoo-compatible range values.
  */
  const aliases = {
    "1day": "1d",
    "day": "1d",
    "5day": "5d",
    "5days": "5d",
    "1m": "1mo",
    "1month": "1mo",
    "3month": "3mo",
    "6month": "6mo",
    "1year": "1y",
    "2year": "2y",
    "5year": "5y",
  };

  return aliases[value] || value;
}

/*
=========================================
NORMALIZE INTERVAL
=========================================
*/

function normalizeInterval(selectedInterval) {
  if (
    selectedInterval === undefined ||
    selectedInterval === null ||
    selectedInterval === ""
  ) {
    return null;
  }

  const value =
    String(selectedInterval)
      .trim()
      .toLowerCase();

  return SUPPORTED_INTERVALS.has(value)
    ? value
    : null;
}

/*
=========================================
VALIDATE RANGE + INTERVAL
=========================================

Yahoo Finance has restrictions on how far
back very small intervals can be requested.

Instead of silently requesting an invalid
combination, choose a safe interval for the
selected range.

This still keeps the user's interval whenever
Yahoo can reasonably support it.
*/

function getSafeInterval(range, requestedInterval) {
  const config =
    RANGE_CONFIG[range] || RANGE_CONFIG["1d"];

  const interval =
    normalizeInterval(requestedInterval);

  if (!interval) {
    return config.fallbackInterval;
  }

  /*
  1-minute data is only available for a very
  short historical window. Keep it for 1d/5d.
  */
  if (
    interval === "1m" &&
    !["1d", "5d"].includes(range)
  ) {
    return config.fallbackInterval;
  }

  /*
  2m data has a short Yahoo historical window.
  */
  if (
    interval === "2m" &&
    !["1d", "5d"].includes(range)
  ) {
    return config.fallbackInterval;
  }

  /*
  5m/15m/30m/90m intraday data should not be
  requested for long multi-month/year ranges.
  */
  if (
    ["5m", "15m", "30m", "90m"].includes(interval) &&
    !["1d", "5d", "1mo", "3mo"].includes(range)
  ) {
    return config.fallbackInterval;
  }

  /*
  1h is suitable for month-level and shorter
  periods. For very long ranges use daily data.
  */
  if (
    interval === "1h" &&
    ["5y", "max"].includes(range)
  ) {
    return config.fallbackInterval;
  }

  return interval;
}

/*
=========================================
YAHOO SYMBOL CANDIDATES
=========================================
*/

function getYahooSymbols(symbol) {
  const cleanSymbol =
    String(symbol || "")
      .trim()
      .toUpperCase();

  if (!cleanSymbol) {
    return [];
  }

  /*
  Do not append .NS/.BO to symbols that are
  already explicitly qualified or are common
  non-Indian Yahoo symbols.
  */
  const isQualified =
    cleanSymbol.endsWith(".NS") ||
    cleanSymbol.endsWith(".BO") ||
    cleanSymbol.endsWith("=X") ||
    cleanSymbol.endsWith("-USD") ||
    cleanSymbol.endsWith("-USDT") ||
    cleanSymbol.includes("^");

  if (isQualified) {
    return [cleanSymbol];
  }

  return [
    `${cleanSymbol}.NS`,
    cleanSymbol,
    `${cleanSymbol}.BO`,
  ];
}

/*
=========================================
GET CHART
=========================================

Usage:

getChart("EURUSD=X", "1d", "1m")

or, for backwards compatibility:

getChart("EURUSD=X", "1d")

*/

export async function getChart(
  symbol,
  selectedRange = "1d",
  selectedInterval = null
) {
  const normalizedRange =
    normalizeRange(selectedRange);

  const rangeConfig =
    RANGE_CONFIG[normalizedRange] ||
    RANGE_CONFIG["1d"];

  const range =
    rangeConfig.range;

  const interval =
    getSafeInterval(
      normalizedRange,
      selectedInterval
    );

  const symbolsToTry =
    getYahooSymbols(symbol);

  if (!symbolsToTry.length) {
    throw new Error("Chart symbol is required.");
  }

  let data = null;
  let lastError = null;
  let yahooSymbolUsed = null;

  /*
  =========================================
  FETCH FROM YAHOO
  =========================================
  */

  for (const yahooSymbol of symbolsToTry) {
    try {
      const response = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
          yahooSymbol
        )}?range=${encodeURIComponent(
          range
        )}&interval=${encodeURIComponent(
          interval
        )}&events=div%2Csplits`,
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Accept: "application/json,text/plain,*/*",
          },

          timeout: 10000,
        }
      );

      if (!response.data?.chart?.error) {
        const result =
          response.data?.chart?.result?.[0];

        /*
        Yahoo can return HTTP 200 with an empty
        result for an unsupported combination.
        Treat that as a failed candidate.
        */
        if (
          result &&
          Array.isArray(result.timestamp) &&
          result.timestamp.length
        ) {
          data = response.data;
          yahooSymbolUsed = yahooSymbol;
          break;
        }

        lastError =
          new Error(
            `No chart data returned for ${yahooSymbol} (${range}/${interval}).`
          );

        continue;
      }

      const yahooError =
        response.data?.chart?.error;

      lastError =
        new Error(
          yahooError?.description ||
            yahooError?.code ||
            "Yahoo Finance chart request failed."
        );
    } catch (err) {
      lastError = err;
    }
  }

  if (!data) {
    throw (
      lastError ||
      new Error("Chart data not found.")
    );
  }

  /*
  =========================================
  RESULT
  =========================================
  */

  const result =
    data.chart?.result?.[0];

  if (!result) {
    throw new Error(
      "Chart data not found."
    );
  }

  const meta =
    result.meta || {};

  const quote =
    result.indicators?.quote?.[0];

  if (
    !quote ||
    !Array.isArray(result.timestamp)
  ) {
    throw new Error(
      "Invalid chart data."
    );
  }

  /*
  =========================================
  BUILD CHART DATA
  =========================================
  */

  const timestamps =
    result.timestamp;

  const chartData =
    timestamps
      .map((time, index) => {
        const close =
          quote.close?.[index] ?? null;

        return {
          time,

          /*
          Lightweight Charts LineSeries
          uses "value".
          */
          value: close,

          close,

          open:
            quote.open?.[index] ?? null,

          high:
            quote.high?.[index] ?? null,

          low:
            quote.low?.[index] ?? null,

          volume:
            quote.volume?.[index] ?? 0,
        };
      })
      .filter(
        (item) =>
          item.value !== null &&
          Number.isFinite(
            Number(item.value)
          )
      );

  if (!chartData.length) {
    throw new Error(
      "No valid chart data available."
    );
  }

  /*
  =========================================
  CURRENCY
  =========================================

  Yahoo normally supplies meta.currency.
  Keep that value exactly when available.

  For non-NSE/BSE symbols, USD is a safer
  fallback than INR because StockDetails also
  supports Forex, Crypto, Oil and Metals.
  */

  const currency =
    meta.currency ||
    (
      yahooSymbolUsed?.endsWith(".NS") ||
      yahooSymbolUsed?.endsWith(".BO")
        ? "INR"
        : "USD"
    );

  /*
  =========================================
  RETURN
  =========================================
  */

  return {
    success: true,

    symbol:
      meta.symbol ||
      yahooSymbolUsed ||
      symbol,

    companyName:
      meta.longName ||
      meta.shortName ||
      meta.symbol ||
      yahooSymbolUsed ||
      symbol,

    shortName:
      meta.shortName ||
      meta.symbol ||
      yahooSymbolUsed ||
      symbol,

    /*
    Return the actual normalized range and
    actual interval used by Yahoo.
    */
    range:
      normalizedRange,

    interval,

    exchange:
      meta.fullExchangeName ||
      meta.exchangeName ||
      "",

    currency,

    regularMarketPrice:
      meta.regularMarketPrice ?? 0,

    previousClose:
      meta.previousClose ?? 0,

    chartPreviousClose:
      meta.chartPreviousClose ?? 0,

    dayHigh:
      meta.regularMarketDayHigh ?? 0,

    dayLow:
      meta.regularMarketDayLow ?? 0,

    week52High:
      meta.fiftyTwoWeekHigh ?? 0,

    week52Low:
      meta.fiftyTwoWeekLow ?? 0,

    volume:
      meta.regularMarketVolume ?? 0,

    marketState:
      meta.marketState ?? "UNKNOWN",

    lastUpdated:
      meta.regularMarketTime ?? null,

    timezone:
      meta.timezone ?? "",

    exchangeTimezone:
      meta.exchangeTimezoneName ?? "",

    data: chartData,
  };
}