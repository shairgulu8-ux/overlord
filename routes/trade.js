import express from "express";

import {
    buy,
    sell,
    position,
    positions,
    pendingOrders,
    createOrder,
    executeOrder,
    executePending,
    checkPositionRisk,
    checkAllPositionsRisk,
} from "../controllers/tradeController.js";

import {
    createMarketRequest,
    sellMarketPosition,
    getUserMarketRequests,
    getUserActiveMarketPositions,
    getUserMarketHistory,
    getMarketRequest,
} from "../services/marketTradeService.js";

const router = express.Router();


// =====================================================
// BUY STOCK
// =====================================================
//
// POST /api/trade/buy
//
// Existing endpoint retained for compatibility.
//
// Body:
//
// {
//     "username": "yusuf",
//     "symbol": "RELIANCE.NS",
//     "quantity": 5
// }
//

router.post(
    "/buy",
    buy
);


// =====================================================
// SELL STOCK
// =====================================================
//
// POST /api/trade/sell
//
// Existing endpoint retained for compatibility.
//
// Body:
//
// {
//     "username": "yusuf",
//     "symbol": "RELIANCE.NS",
//     "quantity": 2
// }
//

router.post(
    "/sell",
    sell
);


// =====================================================
// GET SINGLE POSITION
// =====================================================
//
// GET /api/trade/position/:symbol
//
// Query:
//
// ?username=yusuf
//
// Example:
//
// GET /api/trade/position/EURUSD?username=yusuf
//

router.get(
    "/position/:symbol",
    position
);


// =====================================================
// GET ALL POSITIONS
// =====================================================
//
// GET /api/trade/positions
//
// Query:
//
// ?username=yusuf
//

router.get(
    "/positions",
    positions
);


// =====================================================
// GET PENDING LIMIT ORDERS
// =====================================================
//
// GET /api/trade/orders
//
// IMPORTANT:
//
// This endpoint remains for the existing LIMIT order system.
//
// New admin-controlled MARKET requests do NOT use this endpoint.
// Therefore Market BUY requests will not appear in the normal
// Pending Orders tab.
//

router.get(
    "/orders",
    pendingOrders
);


// =====================================================
// CREATE TRADING ORDER
// =====================================================
//
// POST /api/trade/order
//
// Existing endpoint retained.
//
// Supports the existing trading flow.
//
// MARKET requests are routed by tradeService into the new
// MarketRequest workflow.
// LIMIT requests continue through the existing LIMIT workflow.
//

router.post(
    "/order",
    createOrder
);


// =====================================================
// EXECUTE ONE PENDING LIMIT ORDER
// =====================================================
//
// POST /api/trade/order/:orderId/execute
//
// Existing LIMIT execution endpoint.
//

router.post(
    "/order/:orderId/execute",
    executeOrder
);


// =====================================================
// EXECUTE ALL PENDING LIMIT ORDERS
// =====================================================
//
// POST /api/trade/orders/execute-pending
//
// Existing LIMIT scheduler/worker endpoint.
//

router.post(
    "/orders/execute-pending",
    executePending
);


// =====================================================
// CHECK ONE POSITION TP / SL
// =====================================================
//
// POST /api/trade/position/:positionId/risk
//
// Existing normal-position TP/SL endpoint.
//
// Market-controlled positions use marketTradeService instead
// and should have takeProfit/stopLoss set to null.
//

router.post(
    "/position/:positionId/risk",
    checkPositionRisk
);


// =====================================================
// CHECK ALL OPEN POSITIONS TP / SL
// =====================================================
//
// POST /api/trade/positions/check-risk
//
// Existing normal-position risk endpoint.
//

router.post(
    "/positions/check-risk",
    checkAllPositionsRisk
);


// =====================================================
// ADMIN-CONTROLLED MARKET TRADE
// =====================================================
//
// The following endpoints belong to the NEW Market system.
//
// Market BUY does NOT become a normal LIMIT pending order.
//
// It creates a MarketRequest with:
//
// PENDING
//
// Until Admin presses SET:
//
// P&L = +0.0000
//
// The frontend will show it outside the normal Pending tab.
//
// After Admin SET:
//
// PENDING → ACTIVE
//
// =====================================================


// =====================================================
// CREATE MARKET REQUEST
// =====================================================
//
// POST /api/trade/market-request
//
// User presses BUY on stockdetails.tsx.
//
// Body:
//
// {
//     "username": "yusuf",
//     "symbol": "EURUSD",
//     "side": "BUY",
//     "quantity": 10,
//     "lots": 1,
//     "leverage": 500
// }
//
// Response:
//
// MarketRequest
//
// status = PENDING
//
// No normal LIMIT Order is created.
//

router.post(
    "/market-request",
    async (req, res) => {
        try {
            const {
                username,
                symbol,
                side = "BUY",
                quantity,
                lots,
                leverage,
            } = req.body || {};

            const result =
                await createMarketRequest({
                    username,
                    symbol,
                    side,
                    quantity,
                    lots,
                    leverage,
                });

            return res.status(201).json(
                result
            );
        } catch (error) {
            console.error(
                "Create Market request error:",
                error
            );

            return res.status(400).json({
                success: false,
                message:
                    error.message ||
                    "Unable to create Market request.",
            });
        }
    }
);


// =====================================================
// CREATE MARKET TRADE (BUY / SELL)
// =====================================================
//
// POST /api/trade/market-trade
//
// Opens a NEW admin-controlled Market trade.
// This is intentionally separate from the existing
// /market-request/:requestId/sell endpoint, which CLOSES
// an existing Market position.
//
// =====================================================

router.post(
    "/market-trade",
    async (req, res) => {
        try {
            const {
                username,
                symbol,
                side = "BUY",
                quantity,
                lots,
                leverage,
            } = req.body || {};

            const normalizedSide =
                String(side || "BUY")
                    .trim()
                    .toUpperCase();

            if (
                normalizedSide !== "BUY" &&
                normalizedSide !== "SELL"
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Market trade side must be BUY or SELL.",
                });
            }

            const result =
                await createMarketRequest({
                    username,
                    symbol,
                    side: normalizedSide,
                    quantity,
                    lots,
                    leverage,
                });

            return res.status(201).json(result);

        } catch (error) {
            console.error(
                "Create Market trade error:",
                error
            );

            return res.status(400).json({
                success: false,
                message:
                    error.message ||
                    "Unable to create Market trade.",
            });
        }
    }
);


// =====================================================
// SELL / CLOSE MARKET POSITION
// =====================================================
//
// POST /api/trade/market-request/:requestId/sell
//
// Body:
//
// {
//     "username": "yusuf"
// }
//
// User can sell an ACTIVE Market position before
// the configured duration expires.
//
// The Market service calculates the current controlled
// P&L and settles the balance.
//

router.post(
    "/market-request/:requestId/sell",
    async (req, res) => {
        try {
            const {
                username,
            } = req.body || {};

            const result =
                await sellMarketPosition(
                    username,
                    req.params.requestId
                );

            return res.json(
                result
            );
        } catch (error) {
            console.error(
                "Sell Market position error:",
                error
            );

            return res.status(400).json({
                success: false,
                message:
                    error.message ||
                    "Unable to sell Market position.",
            });
        }
    }
);


// =====================================================
// GET USER MARKET REQUESTS
// =====================================================
//
// GET /api/trade/market-requests?username=yusuf
//
// Returns the user's MarketRequest records.
//
// Possible statuses:
//
// PENDING
// ACTIVE
// LOCKED
// SETTLED
// CLOSED
//
// IMPORTANT:
//
// positions.tsx can use this endpoint separately from
// the normal /orders endpoint.
//
// Therefore a Market PENDING request does not need to
// appear inside the normal Pending Orders tab.
//

router.get(
    "/market-requests",
    async (req, res) => {
        try {
            const {
                username,
                status,
            } = req.query || {};

            const result =
                await getUserMarketRequests(
                    username,
                    {
                        status,
                    }
                );

            return res.json(
                result
            );
        } catch (error) {
            console.error(
                "Get user Market requests error:",
                error
            );

            return res.status(400).json({
                success: false,
                message:
                    error.message ||
                    "Unable to get Market requests.",
            });
        }
    }
);


// =====================================================
// GET USER ACTIVE MARKET POSITIONS
// =====================================================
//
// GET /api/trade/market-positions?username=yusuf
//
// Used by positions.tsx.
//
// Only ACTIVE and LOCKED Market positions are returned.
//
// PENDING Market requests are NOT returned here as active
// positions until Admin presses SET.
//

router.get(
    "/market-positions",
    async (req, res) => {
        try {
            const {
                username,
            } = req.query || {};

            const result =
                await getUserActiveMarketPositions(
                    username
                );

            return res.json(
                result
            );
        } catch (error) {
            console.error(
                "Get active Market positions error:",
                error
            );

            return res.status(400).json({
                success: false,
                message:
                    error.message ||
                    "Unable to get active Market positions.",
            });
        }
    }
);


// =====================================================
// GET USER MARKET HISTORY
// =====================================================
//
// GET /api/trade/market-history?username=yusuf
//
// Used by positions.tsx History.
//
// Completed Market trades:
//
// CLOSED
// SETTLED
//
// are returned here.
//
// This means the request can disappear from Admin's active
// Market list while still remaining available for user's
// History.
//

router.get(
    "/market-history",
    async (req, res) => {
        try {
            const {
                username,
            } = req.query || {};

            const result =
                await getUserMarketHistory(
                    username
                );

            return res.json(
                result
            );
        } catch (error) {
            console.error(
                "Get Market history error:",
                error
            );

            return res.status(400).json({
                success: false,
                message:
                    error.message ||
                    "Unable to get Market history.",
            });
        }
    }
);


// =====================================================
// GET SINGLE MARKET REQUEST
// =====================================================
//
// GET /api/trade/market-request/:requestId?username=yusuf
//
// Used when positions.tsx needs to refresh one Market
// request/position.
//

router.get(
    "/market-request/:requestId",
    async (req, res) => {
        try {
            const {
                username,
            } = req.query || {};

            const result =
                await getMarketRequest(
                    req.params.requestId,
                    username
                );

            return res.json(
                result
            );
        } catch (error) {
            console.error(
                "Get Market request error:",
                error
            );

            return res.status(400).json({
                success: false,
                message:
                    error.message ||
                    "Unable to get Market request.",
            });
        }
    }
);


// =====================================================
// EXPORT
// =====================================================

export default router;