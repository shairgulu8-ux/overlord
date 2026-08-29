import axios from "axios";

const axiosConfig = {
    headers: {
        "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        Accept: "application/json",
    },
    timeout: 15000,
};


// =====================================================
// Yahoo Symbol Helpers
// =====================================================

function getAssetInfo(symbol) {

    const value =
        String(symbol || "")
            .trim()
            .toUpperCase();


    // =================================================
    // Forex
    // =================================================

    const forexMap = {

        "EURUSD=X": "EURUSD",
        "GBPUSD=X": "GBPUSD",
        "USDJPY=X": "USDJPY",
        "USDCHF=X": "USDCHF",
        "AUDUSD=X": "AUDUSD",
        "USDCAD=X": "USDCAD",
        "NZDUSD=X": "NZDUSD",

        "USDINR=X": "USDINR",
        "EURINR=X": "EURINR",
        "GBPINR=X": "GBPINR",
        "JPYINR=X": "JPYINR",

        "EURGBP=X": "EURGBP",
        "EURJPY=X": "EURJPY",
        "EURCHF=X": "EURCHF",
        "EURAUD=X": "EURAUD",
        "EURCAD=X": "EURCAD",
        "EURNZD=X": "EURNZD",

        "GBPJPY=X": "GBPJPY",
        "GBPCHF=X": "GBPCHF",
        "GBPAUD=X": "GBPAUD",
        "GBPCAD=X": "GBPCAD",
        "GBPNZD=X": "GBPNZD",

        "CHFJPY=X": "CHFJPY",
        "CADJPY=X": "CADJPY",
        "AUDJPY=X": "AUDJPY",
        "NZDJPY=X": "NZDJPY",

        "AUDNZD=X": "AUDNZD",
        "AUDCAD=X": "AUDCAD",
        "AUDCHF=X": "AUDCHF",

        "NZDCAD=X": "NZDCAD",
        "NZDCHF=X": "NZDCHF",

        "CADCHF=X": "CADCHF",

        "USDSEK=X": "USDSEK",
        "USDNOK=X": "USDNOK",
        "USDDKK=X": "USDDKK",

        "EURSEK=X": "EURSEK",
        "EURNOK=X": "EURNOK",
        "EURDKK=X": "EURDKK",

        "USDSGD=X": "USDSGD",
        "USDHKD=X": "USDHKD",
        "USDTHB=X": "USDTHB",
        "USDZAR=X": "USDZAR",
        "USDMXN=X": "USDMXN",
        "USDBRL=X": "USDBRL",
        "USDTRY=X": "USDTRY",
        "USDCNH=X": "USDCNH",
    };


    if (forexMap[value]) {

        return {
            type: "FOREX",
            displaySymbol: forexMap[value],
        };

    }


    // =================================================
    // Crypto
    // =================================================

    const cryptoMap = {

        "BTC-USD": "BTCUSD",
        "ETH-USD": "ETHUSD",
        "BNB-USD": "BNBUSD",
        "XRP-USD": "XRPUSD",
        "SOL-USD": "SOLUSD",
    };


    if (cryptoMap[value]) {

        return {
            type: "CRYPTO",
            displaySymbol: cryptoMap[value],
        };

    }


    // =================================================
    // Metals
    // =================================================

    const metalMap = {

        "GC=F": "XAUUSD",
        "SI=F": "XAGUSD",
    };


    if (metalMap[value]) {

        return {
            type: "METAL",
            displaySymbol: metalMap[value],
        };

    }


    // =================================================
    // Oil
    // =================================================

    const oilMap = {

        "CL=F": "USOIL",
        "BZ=F": "UKOIL",
    };


    if (oilMap[value]) {

        return {
            type: "OIL",
            displaySymbol: oilMap[value],
        };

    }


    // =================================================
    // Indices
    // =================================================

    const indexMap = {

        "^DJI": "US30",
        "^GSPC": "US500",
        "^IXIC": "NAS100",

        "^FTSE": "UK100",
        "^GDAXI": "GER30",
        "^FCHI": "FRA40",

        "^N225": "JPN225",
        "^AXJO": "AUS200",

        "^IBEX": "ESP35",
    };


    if (indexMap[value]) {

        return {
            type: "INDEX",
            displaySymbol: indexMap[value],
        };

    }


    // =================================================
    // Regular Stock
    // =================================================

    return {

        type: "STOCK",

        displaySymbol: value,

    };

}


// =====================================================
// Yahoo Symbol Resolver
// =====================================================

function getYahooSymbol(symbol) {

    const value =
        String(symbol || "")
            .trim()
            .toUpperCase();


    if (!value) {
        return value;
    }


    if (
        value.endsWith("=X") ||
        value.startsWith("^") ||
        value.endsWith("=F") ||
        value.includes("-")
    ) {

        return value;

    }


    const displayToYahoo = {

        // Forex

        EURUSD: "EURUSD=X",
        GBPUSD: "GBPUSD=X",
        USDJPY: "USDJPY=X",
        USDCHF: "USDCHF=X",
        AUDUSD: "AUDUSD=X",
        USDCAD: "USDCAD=X",
        NZDUSD: "NZDUSD=X",

        EURGBP: "EURGBP=X",
        EURJPY: "EURJPY=X",
        EURCHF: "EURCHF=X",
        EURAUD: "EURAUD=X",
        EURCAD: "EURCAD=X",
        EURNZD: "EURNZD=X",

        GBPJPY: "GBPJPY=X",
        GBPCHF: "GBPCHF=X",
        GBPAUD: "GBPAUD=X",
        GBPCAD: "GBPCAD=X",
        GBPNZD: "GBPNZD=X",

        CHFJPY: "CHFJPY=X",
        CADJPY: "CADJPY=X",
        AUDJPY: "AUDJPY=X",
        NZDJPY: "NZDJPY=X",

        AUDNZD: "AUDNZD=X",
        AUDCAD: "AUDCAD=X",
        AUDCHF: "AUDCHF=X",

        NZDCAD: "NZDCAD=X",
        NZDCHF: "NZDCHF=X",

        CADCHF: "CADCHF=X",

        USDINR: "USDINR=X",
        EURINR: "EURINR=X",
        GBPINR: "GBPINR=X",
        JPYINR: "JPYINR=X",

        USDSEK: "USDSEK=X",
        USDNOK: "USDNOK=X",
        USDDKK: "USDDKK=X",

        EURSEK: "EURSEK=X",
        EURNOK: "EURNOK=X",
        EURDKK: "EURDKK=X",

        USDSGD: "USDSGD=X",
        USDHKD: "USDHKD=X",
        USDTHB: "USDTHB=X",
        USDZAR: "USDZAR=X",
        USDMXN: "USDMXN=X",
        USDBRL: "USDBRL=X",
        USDTRY: "USDTRY=X",
        USDCNH: "USDCNH=X",


        // Crypto

        BTCUSD: "BTC-USD",
        ETHUSD: "ETH-USD",
        BNBUSD: "BNB-USD",
        XRPUSD: "XRP-USD",
        SOLUSD: "SOL-USD",


        // Metals

        XAUUSD: "GC=F",
        XAGUSD: "SI=F",


        // Oil

        USOIL: "CL=F",
        UKOIL: "BZ=F",


        // Indices

        US30: "^DJI",
        US500: "^GSPC",
        NAS100: "^IXIC",
        UK100: "^FTSE",
        GER30: "^GDAXI",
        FRA40: "^FCHI",
        JPN225: "^N225",
        AUS200: "^AXJO",
        ESP35: "^IBEX",
    };


    return displayToYahoo[value] ?? value;

}


// =====================================================
// Number Helper
// =====================================================

function toNumber(value) {

    const number =
        Number(value);


    return Number.isFinite(number)
        ? number
        : null;

}


// =====================================================
// Currency
// =====================================================

function getCurrency(
    meta,
    assetType
) {

    if (meta?.currency) {
        return meta.currency;
    }


    if (assetType === "CRYPTO") {
        return "USD";
    }


    if (assetType === "METAL") {
        return "USD";
    }


    if (assetType === "OIL") {
        return "USD";
    }


    if (assetType === "INDEX") {
        return "USD";
    }


    return "INR";

}


// =====================================================
// Price Precision
// =====================================================

function getPricePrecision(
    price,
    assetType
) {

    if (!Number.isFinite(price)) {
        return 2;
    }


    switch (assetType) {

        case "FOREX":

            if (price >= 100) {
                return 3;
            }

            return 5;


        case "METAL":
            return 4;


        case "OIL":
            return 4;


        case "CRYPTO":

            if (price >= 1000) {
                return 2;
            }

            if (price >= 1) {
                return 4;
            }

            return 8;


        case "INDEX":
            return 2;


        default:
            return 4;

    }

}


// =====================================================
// Normal Change
// =====================================================

function calculateNormalChange(
    currentPrice,
    previousClose
) {

    if (
        !Number.isFinite(currentPrice) ||
        currentPrice <= 0 ||
        !Number.isFinite(previousClose) ||
        previousClose <= 0
    ) {

        return {
            change: 0,
            percentChange: 0,
        };

    }


    const change =
        Number(
            (
                currentPrice -
                previousClose
            ).toFixed(2)
        );


    const percentChange =
        Number(
            (
                (
                    change /
                    previousClose
                ) * 100
            ).toFixed(2)
        );


    return {
        change,
        percentChange,
    };

}


// =====================================================
// Crypto 24H Reference
// =====================================================
//
// Crypto is treated separately because it trades 24/7.
// We fetch hourly candles and find the candle closest
// to exactly 24 hours before Yahoo's current timestamp.
//
// =====================================================

async function getCrypto24HReference(
    yahooSymbol,
    currentTimestamp
) {

    try {

        const response =
            await axios.get(

                `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`,

                {
                    ...axiosConfig,

                    params: {

                        range: "5d",

                        interval: "1h",

                        events: "div,splits",

                    },

                }

            );


        const result =
            response.data
                ?.chart
                ?.result
                ?.[0];


        if (!result) {
            return null;
        }


        const timestamps =
            Array.isArray(
                result.timestamp
            )
                ? result.timestamp
                : [];


        const closes =
            result
                ?.indicators
                ?.quote
                ?.[0]
                ?.close;


        if (
            timestamps.length === 0 ||
            !Array.isArray(closes)
        ) {

            return null;

        }


        const now =
            toNumber(
                currentTimestamp
            ) ??
            Math.floor(
                Date.now() / 1000
            );


        const target =
            now -
            (24 * 60 * 60);


        let referencePrice = null;

        let smallestDifference =
            Infinity;


        for (
            let i = 0;
            i < timestamps.length;
            i++
        ) {

            const timestamp =
                toNumber(
                    timestamps[i]
                );


            const close =
                toNumber(
                    closes[i]
                );


            if (
                timestamp === null ||
                close === null ||
                close <= 0
            ) {

                continue;

            }


            const difference =
                Math.abs(
                    timestamp -
                    target
                );


            if (
                difference <
                smallestDifference
            ) {

                smallestDifference =
                    difference;

                referencePrice =
                    close;

            }

        }


        return referencePrice;

    } catch (err) {

        console.error(

            `❌ Crypto 24H reference failed: ${yahooSymbol}`,

            err.response?.status || "",
            err.message

        );


        return null;

    }

}


// =====================================================
// Fetch Single Stock / Asset
// =====================================================

export async function fetchStock(symbol) {

    try {

        const originalSymbol =
            String(symbol || "")
                .trim()
                .toUpperCase();


        if (!originalSymbol) {

            throw new Error(
                "Yahoo Finance symbol is required."
            );

        }


        // =================================================
        // Resolve Yahoo Symbol
        // =================================================

        const yahooRawSymbol =
            getYahooSymbol(
                originalSymbol
            );


        // =================================================
        // Asset Info
        // =================================================

        const assetInfo =
            getAssetInfo(
                yahooRawSymbol
            );


        // =================================================
        // Main Yahoo Chart API
        // =================================================

        const response =
            await axios.get(

                `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooRawSymbol)}`,

                {
                    ...axiosConfig,

                    params: {

                        range: "5d",

                        interval: "1d",

                        events: "div,splits",

                    },

                }

            );


        // =================================================
        // Result
        // =================================================

        const result =
            response.data
                ?.chart
                ?.result
                ?.[0];


        if (!result) {

            throw new Error(
                "No market data received."
            );

        }


        // =================================================
        // Meta
        // =================================================

        const meta =
            result.meta || {};


        // =================================================
        // Current Price
        // =================================================

        const currentPrice =
            toNumber(
                meta.regularMarketPrice
            ) ??
            0;


        // =================================================
        // Previous Close
        // =================================================

        const previousClose =
            toNumber(
                meta.previousClose
            ) ??
            0;


        // =================================================
        // Change
        // =================================================

        let change = 0;

        let percentChange = 0;


        // =================================================
        // CRYPTO ONLY
        // =================================================
        //
        // Use rolling 24H reference.
        //
        // =================================================

        if (
            assetInfo.type === "CRYPTO"
        ) {

            const referencePrice =
                await getCrypto24HReference(

                    yahooRawSymbol,

                    meta.regularMarketTime

                );


            if (
                referencePrice !== null &&
                referencePrice > 0
            ) {

                change =
                    Number(
                        (
                            currentPrice -
                            referencePrice
                        ).toFixed(2)
                    );


                percentChange =
                    Number(
                        (
                            (
                                change /
                                referencePrice
                            ) * 100
                        ).toFixed(2)
                    );

            } else {

                const fallback =
                    calculateNormalChange(
                        currentPrice,
                        previousClose
                    );


                change =
                    fallback.change;


                percentChange =
                    fallback.percentChange;

            }

        } else {

            // =================================================
            // EVERYTHING EXCEPT CRYPTO
            // =================================================
            //
            // This is the OLD WORKING LOGIC.
            //
            // NSE/BSE
            // Forex
            // Metals
            // Oil
            // Indices
            //
            // =================================================

            const normal =
                calculateNormalChange(
                    currentPrice,
                    previousClose
                );


            change =
                normal.change;


            percentChange =
                normal.percentChange;

        }


        // =================================================
        // Currency
        // =================================================

        const currency =
            getCurrency(
                meta,
                assetInfo.type
            );


        // =================================================
        // Market State
        // =================================================

        const marketState =
            String(
                meta.marketState ||
                ""
            )
                .trim()
                .toUpperCase() ||
            (
                assetInfo.type === "FOREX" ||
                assetInfo.type === "CRYPTO"
                    ? "REGULAR"
                    : "UNKNOWN"
            );


        // =================================================
        // Precision
        // =================================================

        const pricePrecision =
            getPricePrecision(
                currentPrice,
                assetInfo.type
            );


        // =================================================
        // Return
        // =================================================

        return {

            symbol:
                meta.symbol ??
                yahooRawSymbol,


            displaySymbol:
                assetInfo.displaySymbol,


            assetType:
                assetInfo.type,


            companyName:
                meta.longName ??
                meta.shortName ??
                meta.displayName ??
                assetInfo.displaySymbol ??
                meta.symbol ??
                originalSymbol,


            shortName:
                meta.shortName ??
                meta.displayName ??
                assetInfo.displaySymbol ??
                meta.symbol ??
                originalSymbol,


            exchange:
                meta.fullExchangeName ??
                meta.exchangeName ??
                meta.exchange ??
                "",


            currency,


            price:
                currentPrice,


            pricePrecision,


            previousClose,


            open:
                toNumber(
                    meta.regularMarketOpen
                ) ??
                0,


            change,


            percentChange,


            dayHigh:
                toNumber(
                    meta.regularMarketDayHigh
                ) ??
                0,


            dayLow:
                toNumber(
                    meta.regularMarketDayLow
                ) ??
                0,


            week52High:
                toNumber(
                    meta.fiftyTwoWeekHigh
                ) ??
                0,


            week52Low:
                toNumber(
                    meta.fiftyTwoWeekLow
                ) ??
                0,


            volume:
                toNumber(
                    meta.regularMarketVolume
                ) ??
                0,


            marketCap:
                toNumber(
                    meta.marketCap
                ) ??
                0,


            exchangeTimezone:
                meta.exchangeTimezoneName ??
                "",


            marketState,


            lastUpdated:
                meta.regularMarketTime

                    ? new Date(
                        meta.regularMarketTime *
                        1000
                    ).toLocaleString()

                    : null,


            lastUpdatedUnix:
                meta.regularMarketTime ??
                null,


            serverTime:
                new Date().toLocaleString(),

        };

    } catch (err) {

        // =================================================
        // Error
        // =================================================

        console.error(

            `❌ Failed : ${symbol}`,

            err.response?.status ||
            "",

            err.message

        );


        const errorSymbol =
            String(symbol || "")
                .trim()
                .toUpperCase();


        const errorAssetInfo =
            getAssetInfo(
                getYahooSymbol(
                    errorSymbol
                )
            );


        return {

            symbol,

            displaySymbol:
                errorAssetInfo.displaySymbol,

            assetType:
                errorAssetInfo.type,

            companyName:
                symbol,

            shortName:
                symbol,

            exchange:
                "",

            currency:
                getCurrency(
                    null,
                    errorAssetInfo.type
                ),

            price:
                0,

            pricePrecision:
                2,

            previousClose:
                0,

            open:
                0,

            change:
                0,

            percentChange:
                0,

            dayHigh:
                0,

            dayLow:
                0,

            week52High:
                0,

            week52Low:
                0,

            volume:
                0,

            marketCap:
                0,

            exchangeTimezone:
                "",

            marketState:
                "UNKNOWN",

            lastUpdated:
                null,

            lastUpdatedUnix:
                null,

            serverTime:
                new Date().toLocaleString(),

        };

    }

}


// =====================================================
// Fetch Multiple Stocks / Assets
// =====================================================

export async function fetchMultipleStocks(
    symbols = []
) {

    if (!Array.isArray(symbols)) {

        return [];

    }


    const results = [];


    const batchSize = 10;


    for (
        let i = 0;
        i < symbols.length;
        i += batchSize
    ) {

        const batch =
            symbols.slice(
                i,
                i + batchSize
            );


        const response =
            await Promise.all(

                batch.map(
                    symbol =>
                        fetchStock(
                            symbol
                        )
                )

            );


        results.push(
            ...response
        );

    }


    return results;

}