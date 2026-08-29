import express from "express";

import {
    getStocks,
    searchStocks,
    getStockDetails,
    getUpperCircuitStocks,
} from "../services/stockService.js";


const router = express.Router();


// =====================================================
// Supported Markets
// =====================================================

const SUPPORTED_MARKETS = new Set([

    "NSE",
    "BSE",

    "FOREX",
    "CRYPTO",
    "METAL",
    "METALS",

    "OIL",
    "ENERGY",

    "INDEX",
    "INDICES",

]);


// =====================================================
// GET TOP STOCKS / MARKET ASSETS
// =====================================================
//
// GET /api/stocks
// GET /api/stocks?market=NSE
// GET /api/stocks?market=BSE
// GET /api/stocks?market=FOREX
// GET /api/stocks?market=CRYPTO
// GET /api/stocks?market=METAL
// GET /api/stocks?market=OIL
// GET /api/stocks?market=INDICES
//
// =====================================================

router.get("/", async (req, res) => {

    try {

        const market = String(
            req.query.market || "NSE"
        )
            .trim()
            .toUpperCase();


        // =================================================
        // Validate Market
        // =================================================

        if (!SUPPORTED_MARKETS.has(market)) {

            return res.status(400).json({

                success: false,

                message:
                    "Unsupported market.",

                supportedMarkets: [

                    "NSE",
                    "BSE",

                    "FOREX",
                    "CRYPTO",

                    "METAL",
                    "METALS",

                    "OIL",
                    "ENERGY",

                    "INDEX",
                    "INDICES",

                ],

            });

        }


        // =================================================
        // Fetch Market Data
        // =================================================

        const data =
            await getStocks(market);


        // =================================================
        // Response
        // =================================================

        return res.status(200).json(
            data
        );

    } catch (err) {

        console.error(
            "❌ Stock Route Error:",
            err
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch market data.",

            error:
                err.message,

        });

    }

});


// =====================================================
// SEARCH STOCKS
// =====================================================
//
// GET /api/stocks/search?q=rel
//
// Existing search behaviour remains unchanged.
// =====================================================

router.get("/search", async (req, res) => {

    try {

        const query = String(
            req.query.q || ""
        ).trim();


        const data =
            await searchStocks(query);


        return res.status(200).json({

            success: true,

            total:
                data.length,

            stocks:
                data,

        });

    } catch (err) {

        console.error(
            "❌ Search Route Error:",
            err
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to search stocks.",

            error:
                err.message,

        });

    }

});


// =====================================================
// UPPER CIRCUIT STOCKS
// =====================================================
//
// GET /api/stocks/upper-circuit
//
// This remains specifically for stocks.
// =====================================================

router.get(
    "/upper-circuit",
    async (req, res) => {

        try {

            const data =
                await getUpperCircuitStocks();


            return res.status(200).json(
                data
            );

        } catch (err) {

            console.error(
                "❌ Upper Circuit Error:",
                err
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to fetch upper circuit stocks.",

                error:
                    err.message,

            });

        }

    }
);


// =====================================================
// SINGLE STOCK / ASSET DETAILS
// =====================================================
//
// GET /api/stocks/RELIANCE.NS
// GET /api/stocks/BTC-USD
// GET /api/stocks/GC=F
// GET /api/stocks/CL=F
// GET /api/stocks/^GSPC
//
// IMPORTANT:
// Yahoo symbols containing special characters such as
// ^ should be URL-encoded by the frontend/client.
//
// Example:
// ^GSPC -> %5EGSPC
//
// =====================================================

router.get(
    "/:symbol",
    async (req, res) => {

        try {

            const symbol =
                String(
                    req.params.symbol || ""
                ).trim();


            if (!symbol) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Symbol is required.",

                });

            }


            const data =
                await getStockDetails(
                    symbol
                );


            return res.status(200).json({

                success: true,

                stock:
                    data,

            });

        } catch (err) {

            console.error(
                "❌ Stock Details Error:",
                err
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to fetch stock details.",

                error:
                    err.message,

            });

        }

    }
);


// =====================================================
// Export
// =====================================================

export default router;