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
COMMODITY FUTURES
=========================================
*/

const COMMODITY_SYMBOLS = new Set([
  "GC=F",
  "SI=F",
  "CL=F",
  "BZ=F",
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
*/

function getSafeInterval(
  range,
  requestedInterval,
  symbol = ""
) {

  const config =
    RANGE_CONFIG[range] ||
    RANGE_CONFIG["1d"];

  let interval =
    normalizeInterval(
      requestedInterval
    );

  if (!interval) {
    interval =
      config.fallbackInterval;
  }


  /*
  =========================================
  COMMODITY FUTURES
  =========================================

  For 1-minute commodity requests we initially
  use 5m. The fetch logic below can additionally
  fall back to 15m / 30m / 1h / 1d if Yahoo
  returns no data.
  */

  const cleanSymbol =
    String(symbol || "")
      .trim()
      .toUpperCase();

  if (
    COMMODITY_SYMBOLS.has(cleanSymbol) &&
    interval === "1m"
  ) {
    return "5m";
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
    ![
      "1d",
      "5d",
      "1mo",
      "3mo",
    ].includes(range)
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
    cleanSymbol.endsWith("=F") ||
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
RANGE FALLBACKS
=========================================
*/

function getRangeCandidates(
  range,
  symbol
) {

  const cleanSymbol =
    String(symbol || "")
      .trim()
      .toUpperCase();


  /*
  =========================================
  COMMODITY FUTURES
  =========================================

  Important:

  Oil and Metals are futures.

  If the current day is closed / has no
  intraday candles, Yahoo may return an
  empty result for:

      1d + 5m

  Therefore try the previous few trading
  days automatically.

  Example:

      1d
       ↓
      5d
       ↓
      1mo
  */

  if (
    COMMODITY_SYMBOLS.has(cleanSymbol)
  ) {

    if (range === "1d") {

      return [
        "1d",
        "5d",
        "1mo",
      ];
    }


    if (range === "5d") {

      return [
        "5d",
        "1mo",
      ];
    }


    if (range === "1mo") {

      return [
        "1mo",
        "3mo",
      ];
    }
  }


  /*
  Normal symbols keep their requested range.
  */

  return [range];
}


/*
=========================================
INTERVAL FALLBACKS
=========================================
*/

function getIntervalCandidates(
  interval,
  symbol
) {

  const cleanSymbol =
    String(symbol || "")
      .trim()
      .toUpperCase();


  /*
  =========================================
  COMMODITY FUTURES
  =========================================
  */

  if (
    COMMODITY_SYMBOLS.has(cleanSymbol)
  ) {

    if (interval === "1m") {

      return [
        "5m",
        "15m",
        "30m",
        "1h",
        "1d",
      ];
    }


    if (interval === "5m") {

      return [
        "5m",
        "15m",
        "30m",
        "1h",
        "1d",
      ];
    }


    if (interval === "15m") {

      return [
        "15m",
        "30m",
        "1h",
        "1d",
      ];
    }


    if (interval === "30m") {

      return [
        "30m",
        "1h",
        "1d",
      ];
    }


    if (interval === "1h") {

      return [
        "1h",
        "1d",
      ];
    }


    return [interval];
  }


  /*
  =========================================
  NORMAL SYMBOLS
  =========================================
  */

  const fallbackMap = {

    "1m": [
      "1m",
      "2m",
      "5m",
    ],

    "2m": [
      "2m",
      "5m",
    ],

    "5m": [
      "5m",
      "15m",
    ],

    "15m": [
      "15m",
      "30m",
      "1h",
    ],

    "30m": [
      "30m",
      "1h",
    ],

    "90m": [
      "90m",
      "1h",
    ],

    "1h": [
      "1h",
      "1d",
    ],

    "1d": [
      "1d",
    ],

    "5d": [
      "5d",
      "1wk",
    ],

    "1wk": [
      "1wk",
      "1mo",
    ],

    "1mo": [
      "1mo",
    ],

    "3mo": [
      "3mo",
      "1mo",
    ],
  };


  return (
    fallbackMap[interval] || [
      interval,
    ]
  );
}


/*
=========================================
GET CHART
=========================================

Usage:

getChart(
  "EURUSD=X",
  "1d",
  "1m"
)

or:

getChart(
  "EURUSD=X",
  "1d"
)
*/

export async function getChart(
  symbol,
  selectedRange = "1d",
  selectedInterval = null
) {

  const normalizedRange =
    normalizeRange(
      selectedRange
    );


  const rangeConfig =
    RANGE_CONFIG[
      normalizedRange
    ] ||
    RANGE_CONFIG["1d"];


  const requestedRange =
    rangeConfig.range;


  const interval =
    getSafeInterval(
      normalizedRange,
      selectedInterval,
      symbol
    );


  const symbolsToTry =
    getYahooSymbols(
      symbol
    );


  if (!symbolsToTry.length) {

    throw new Error(
      "Chart symbol is required."
    );
  }


  let data = null;

  let lastError = null;

  let yahooSymbolUsed = null;

  let actualRangeUsed =
    requestedRange;

  let actualIntervalUsed =
    interval;


  /*
  =========================================
  FETCH FROM YAHOO
  =========================================
  */

  for (
    const yahooSymbol
    of symbolsToTry
  ) {

    const rangeCandidates =
      getRangeCandidates(
        requestedRange,
        yahooSymbol
      );


    const intervalCandidates =
      getIntervalCandidates(
        interval,
        yahooSymbol
      );


    /*
    Range first, then interval.

    This is important for commodities:
    
    1d / 5m
       ↓
    5d / 5m
       ↓
    1mo / 5m
       ↓
    1d / 15m
       ↓
    ...
    */

    for (
      const tryRange
      of rangeCandidates
    ) {

      for (
        const tryInterval
        of intervalCandidates
      ) {

        try {

          const response =
            await axios.get(

              `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
                yahooSymbol
              )}`,

              {
                params: {
                  range:
                    tryRange,

                  interval:
                    tryInterval,

                  events:
                    "div,splits",

                  includePrePost:
                    false,
                },

                headers: {
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36",

                  Accept:
                    "application/json,text/plain,*/*",
                },

                timeout: 10000,
              }
            );


          /*
          =========================================
          YAHOO ERROR
          =========================================
          */

          if (
            response.data?.chart?.error
          ) {

            const yahooError =
              response.data.chart.error;


            lastError =
              new Error(
                yahooError?.description ||
                yahooError?.code ||
                "Yahoo Finance chart request failed."
              );


            continue;
          }


          /*
          =========================================
          RESULT
          =========================================
          */

          const result =
            response.data
              ?.chart
              ?.result
              ?.[0];


          /*
          Yahoo can return HTTP 200 with an empty
          result.

          Treat that as a failed combination and
          continue to the next range/interval.
          */

          if (
            result &&
            Array.isArray(
              result.timestamp
            ) &&
            result.timestamp.length
          ) {

            data =
              response.data;

            yahooSymbolUsed =
              yahooSymbol;

            actualRangeUsed =
              tryRange;

            actualIntervalUsed =
              tryInterval;

            break;
          }


          lastError =
            new Error(
              `No chart data returned for ${yahooSymbol} (${tryRange}/${tryInterval}).`
            );

        } catch (err) {

          /*
          Continue trying the next valid
          Yahoo range/interval.
          */

          lastError =
            err;
        }
      }


      if (data) {
        break;
      }
    }


    if (data) {
      break;
    }
  }


  /*
  =========================================
  NO DATA
  =========================================
  */

  if (!data) {

    throw (
      lastError ||
      new Error(
        `No chart data returned for ${symbol} (${requestedRange}/${interval}).`
      )
    );
  }


  /*
  =========================================
  RESULT
  =========================================
  */

  const result =
    data
      .chart
      ?.result
      ?.[0];


  if (!result) {

    throw new Error(
      "Chart data not found."
    );
  }


  /*
  =========================================
  META
  =========================================
  */

  const meta =
    result.meta || {};


  /*
  =========================================
  QUOTE
  =========================================
  */

  const quote =
    result
      .indicators
      ?.quote
      ?.[0];


  if (
    !quote ||
    !Array.isArray(
      result.timestamp
    )
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
      .map(
        (time, index) => {

          const close =
            quote.close?.[
              index
            ] ?? null;


          return {

            time,

            /*
            Lightweight Charts LineSeries
            uses "value".
            */

            value:
              close,

            close,

            open:
              quote.open?.[
                index
              ] ?? null,

            high:
              quote.high?.[
                index
              ] ?? null,

            low:
              quote.low?.[
                index
              ] ?? null,

            volume:
              quote.volume?.[
                index
              ] ?? 0,
          };
        }
      )
      .filter(
        (item) =>
          item.value !== null &&
          Number.isFinite(
            Number(
              item.value
            )
          )
      );


  /*
  =========================================
  VALIDATION
  =========================================
  */

  if (
    !chartData.length
  ) {

    throw new Error(
      "No valid chart data available."
    );
  }


  /*
  =========================================
  CURRENCY
  =========================================
  */

  const currency =
    meta.currency ||
    (
      yahooSymbolUsed?.endsWith(
        ".NS"
      ) ||
      yahooSymbolUsed?.endsWith(
        ".BO"
      )
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
    IMPORTANT:

    Return the actual range that Yahoo
    successfully returned.

    Example:

    Requested:
      1d / 5m

    If today has no commodity candles:

      Actual:
      5d / 5m
    */

    range:
      actualRangeUsed,

    /*
    Return actual interval used.
    */

    interval:
      actualIntervalUsed,

    exchange:
      meta.fullExchangeName ||
      meta.exchangeName ||
      "",

    currency,

    regularMarketPrice:
      meta.regularMarketPrice ??
      0,

    previousClose:
      meta.previousClose ??
      0,

    chartPreviousClose:
      meta.chartPreviousClose ??
      0,

    dayHigh:
      meta.regularMarketDayHigh ??
      0,

    dayLow:
      meta.regularMarketDayLow ??
      0,

    week52High:
      meta.fiftyTwoWeekHigh ??
      0,

    week52Low:
      meta.fiftyTwoWeekLow ??
      0,

    volume:
      meta.regularMarketVolume ??
      0,

    marketState:
      meta.marketState ??
      "UNKNOWN",

    lastUpdated:
      meta.regularMarketTime ??
      null,

    timezone:
      meta.timezone ??
      "",

    exchangeTimezone:
      meta.exchangeTimezoneName ??
      "",

    data:
      chartData,
  };
}


/*
=========================================
DEFAULT EXPORT
=========================================
*/

export default {
  getChart,
};