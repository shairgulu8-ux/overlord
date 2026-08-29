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
// Supports:
//
// MARKET BUY
// MARKET SELL
// LIMIT BUY
// LIMIT SELL
//
// FOREX
// METAL
// OIL
// CRYPTO
// INDEX
// STOCK
//
// Leverage
// Lots
// Take Profit
// Stop Loss
//
// MARKET example:
//
// {
//     "username": "yusuf",
//     "symbol": "EURUSD",
//     "side": "BUY",
//     "quantity": 10,
//     "lots": 1,
//     "leverage": 500,
//     "orderType": "MARKET",
//     "takeProfit": 1.18000,
//     "stopLoss": 1.15000
// }
//
// LIMIT example:
//
// {
//     "username": "yusuf",
//     "symbol": "EURUSD",
//     "side": "BUY",
//     "quantity": 10,
//     "lots": 1,
//     "leverage": 500,
//     "orderType": "LIMIT",
//     "price": 1.16500,
//     "takeProfit": 1.18000,
//     "stopLoss": 1.15000
// }
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
// Used by the backend execution layer after checking
// the current market price.
//
// Also useful for testing manually.
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
// The backend scheduler/worker can call this repeatedly
// to check whether pending LIMIT orders have reached
// their requested price.
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
// Checks the live Yahoo price against:
//
// Take Profit
// Stop Loss
//
// If TP or SL is triggered, the backend closes the
// position and settles the wallet.
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
// Checks all OPEN positions.
//
// This endpoint is intended for the backend scheduler/
// worker that periodically checks live market prices.
//


router.post(
    "/positions/check-risk",
    checkAllPositionsRisk
);


// =====================================================
// EXPORT
// =====================================================

export default router;