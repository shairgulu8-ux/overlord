import topStocks from "../data/topStocks.js";
import topBseStocks from "../data/topBseStocks.js";

import forexSymbols from "../data/forexSymbols.js";
import cryptoSymbols from "../data/cryptoSymbols.js";
import metalSymbols from "../data/metalSymbols.js";
import oilSymbols from "../data/oilSymbols.js";
import indexSymbols from "../data/indexSymbols.js";

import {
    fetchMultipleStocks,
    fetchStock
} from "./yahooService.js";

import {
    searchStocks as searchLocalStocks
} from "./searchService.js";

import circuitService from "./circuitService.js";


// =====================================================
// Helpers
// =====================================================

function toNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
        ? number
        : null;
}


// =====================================================
// Normalize Market Asset
// =====================================================

function normalizeMarketAsset(stock) {

    if (!stock || typeof stock !== "object") {
        return null;
    }

    const price = toNumber(stock.price);

    const previousClose = toNumber(
        stock.previousClose
    );

    let change = toNumber(
        stock.change
    );

    let percentChange = toNumber(
        stock.percentChange
    );


    // =================================================
    // Calculate change when previousClose is valid
    // =================================================

    if (
        price !== null &&
        previousClose !== null &&
        previousClose !== 0
    ) {

        const calculatedChange =
            price - previousClose;

        const calculatedPercentChange =
            (calculatedChange / previousClose) * 100;


        /*
         * Only repair missing / invalid values.
         *
         * We don't blindly overwrite Yahoo's values
         * because Yahoo can provide market-specific
         * change calculations.
         */

        if (
            change === null ||
            !Number.isFinite(change)
        ) {

            change = calculatedChange;

        }


        if (
            percentChange === null ||
            !Number.isFinite(percentChange)
        ) {

            percentChange =
                calculatedPercentChange;

        }

    }


    return {
        ...stock,

        price:
            price !== null
                ? price
                : stock.price,

        previousClose:
            previousClose !== null
                ? previousClose
                : stock.previousClose,

        change:
            change !== null
                ? change
                : 0,

        percentChange:
            percentChange !== null
                ? percentChange
                : 0
    };
}


// =====================================================
// Normalize Stock Array
// =====================================================

function normalizeStocks(stocks) {

    if (!Array.isArray(stocks)) {
        return [];
    }

    return stocks
        .map(normalizeMarketAsset)
        .filter(Boolean);
}


// =====================================================
// Get Market Symbols
// =====================================================

function getMarketSymbols(selectedMarket) {

    switch (selectedMarket) {

        // =================================================
        // NSE
        // =================================================

        case "NSE":

            return Array.isArray(topStocks)
                ? topStocks
                : [];


        // =================================================
        // BSE
        // =================================================

        case "BSE":

            return Array.isArray(topBseStocks)
                ? topBseStocks.map(
                    stock =>
                        typeof stock === "string"
                            ? stock
                            : stock?.symbol
                ).filter(Boolean)
                : [];


        // =================================================
        // FOREX
        // =================================================

        case "FOREX":

            return Array.isArray(forexSymbols)
                ? forexSymbols
                : [];


        // =================================================
        // CRYPTO
        // =================================================

        case "CRYPTO":

            return Array.isArray(cryptoSymbols)
                ? cryptoSymbols
                : [];


        // =================================================
        // METALS
        // =================================================

        case "METALS":

        case "METAL":

            return Array.isArray(metalSymbols)
                ? metalSymbols
                : [];


        // =================================================
        // OIL / ENERGY
        // =================================================

        case "OIL":

        case "ENERGY":

            return Array.isArray(oilSymbols)
                ? oilSymbols
                : [];


        // =================================================
        // GLOBAL INDICES
        // =================================================

        case "INDICES":

        case "INDEX":

            return Array.isArray(indexSymbols)
                ? indexSymbols
                : [];


        // =================================================
        // DEFAULT
        // =================================================

        default:

            return Array.isArray(topStocks)
                ? topStocks
                : [];
    }
}


// =====================================================
// Get Market Stocks / Assets
// =====================================================

export async function getStocks(
    market = "NSE"
) {

    const selectedMarket =
        String(market || "NSE")
            .trim()
            .toUpperCase();


    // =================================================
    // Get symbols
    // =================================================

    const symbols =
        getMarketSymbols(
            selectedMarket
        );


    // =================================================
    // Safety
    // =================================================

    if (!Array.isArray(symbols)) {

        return {
            success: true,
            market: selectedMarket,
            total: 0,
            fetchedAt:
                new Date().toLocaleString(),
            stocks: []
        };

    }


    // =================================================
    // Fetch Yahoo Finance Data
    // =================================================

    let stocks = [];

    try {

        stocks =
            await fetchMultipleStocks(
                symbols
            );

    } catch (error) {

        console.error(
            `Failed to fetch ${selectedMarket} market data:`,
            error
        );

        return {
            success: false,
            market: selectedMarket,
            total: 0,
            fetchedAt:
                new Date().toLocaleString(),
            stocks: [],
            error:
                error?.message ||
                "Failed to fetch market data"
        };
    }


    // =================================================
    // Normalize response
    // =================================================

    const normalizedStocks =
        normalizeStocks(stocks);


    // =================================================
    // Final Response
    // =================================================

    return {

        success: true,

        market:
            selectedMarket,

        total:
            normalizedStocks.length,

        fetchedAt:
            new Date().toLocaleString(),

        stocks:
            normalizedStocks
    };
}


// =====================================================
// Search Stocks
// =====================================================

export async function searchStocks(
    query = ""
) {

    return await searchLocalStocks(
        query
    );

}


// =====================================================
// Get Single Stock / Asset Details
// =====================================================

export async function getStockDetails(
    symbol
) {

    if (!symbol) {

        throw new Error(
            "Stock symbol is required"
        );

    }


    return await fetchStock(
        symbol
    );

}


// =====================================================
// Get Upper Circuit Stocks
// =====================================================

export async function getUpperCircuitStocks() {

    const stocks =
        await circuitService.fetchUpperCircuit();


    return {

        success: true,

        total:
            Array.isArray(stocks)
                ? stocks.length
                : 0,

        fetchedAt:
            new Date().toLocaleString(),

        stocks:
            Array.isArray(stocks)
                ? stocks
                : []
    };

}