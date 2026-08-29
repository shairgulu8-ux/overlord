import {
    buyStock,
    sellStock,
    getPosition,
    getPositions,
    getPendingOrders,

    createTradingOrder,
    executePendingOrder,
    executePendingOrders,
    checkPositionTakeProfitStopLoss,
    checkAllPositionsTakeProfitStopLoss,
} from "../services/tradeService.js";

// =====================================================
// BUY STOCK
// =====================================================
//
// POST /api/trade/buy
//
// Existing normal stock BUY endpoint.
// Kept for backward compatibility.
//


export async function buy(req, res) {

    try {

        const {
            username,
            symbol,
            quantity,
        } = req.body;


        const result =
            await buyStock(
                username,
                symbol,
                quantity
            );


        return res
            .status(200)
            .json(result);


    } catch (err) {

        console.error(
            "❌ Buy Stock Error:",
            err
        );


        return res
            .status(400)
            .json({

                success: false,

                message:
                    err.message ||
                    "Failed to buy stock.",

            });

    }

}


// =====================================================
// SELL STOCK
// =====================================================
//
// POST /api/trade/sell
//
// Existing normal stock SELL endpoint.
// Kept for backward compatibility.
//


export async function sell(req, res) {

    try {

        const {
            username,
            symbol,
            quantity,
        } = req.body;


        const result =
            await sellStock(
                username,
                symbol,
                quantity
            );


        return res
            .status(200)
            .json(result);


    } catch (err) {

        console.error(
            "❌ Sell Stock Error:",
            err
        );


        return res
            .status(400)
            .json({

                success: false,

                message:
                    err.message ||
                    "Failed to sell stock.",

            });

    }

}


// =====================================================
// GET SINGLE POSITION
// =====================================================
//
// GET /api/trade/position/:symbol?username=USERNAME
//
// Existing endpoint.
//


export async function position(
    req,
    res
) {

    try {

        const {
            username,
        } = req.query;


        const {
            symbol,
        } = req.params;


        const result =
            await getPosition(
                username,
                symbol
            );


        return res.json(
            result
        );


    } catch (err) {

        console.error(
            "❌ Get Position Error:",
            err
        );


        return res
            .status(400)
            .json({

                success: false,

                message:
                    err.message,

            });

    }

}


// =====================================================
// GET ALL POSITIONS
// =====================================================
//
// GET /api/trade/positions?username=USERNAME
//
// Existing endpoint.
//


export async function positions(
    req,
    res
) {

    try {

        const {
            username,
        } = req.query;


        const result =
            await getPositions(
                username
            );


        return res.json(
            result
        );


    } catch (err) {

        console.error(
            "❌ Get Positions Error:",
            err
        );


        return res
            .status(400)
            .json({

                success: false,

                message:
                    err.message,

            });

    }

}
// =====================================================
// GET USER PENDING ORDERS
// =====================================================
//
// GET /api/trade/orders?username=USERNAME
//

export async function pendingOrders(req, res) {
    try {
        const {
            username,
        } = req.query;

        const result = await getPendingOrders(
            username
        );

        return res.json(result);

    } catch (err) {

        console.error(
            "❌ Get Pending Orders Error:",
            err
        );

        return res
            .status(400)
            .json({
                success: false,
                message:
                    err.message ||
                    "Failed to load pending orders.",
            });
    }
}


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
//
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
// TP
// SL
//
// Example body:
//
// {
//     "username": "user",
//     "symbol": "EURUSD",
//     "side": "BUY",
//     "quantity": 10,
//     "lots": 1,
//     "leverage": 500,
//     "orderType": "MARKET",
//     "takeProfit": 1.20,
//     "stopLoss": 1.15
// }
//
// For LIMIT:
//
// {
//     "username": "user",
//     "symbol": "EURUSD",
//     "side": "BUY",
//     "quantity": 10,
//     "lots": 1,
//     "leverage": 500,
//     "orderType": "LIMIT",
//     "price": 1.1650,
//     "takeProfit": 1.1800,
//     "stopLoss": 1.1500
// }
//


export async function createOrder(
    req,
    res
) {

    try {

        const {
            username,
            symbol,
            side,
            quantity,
            lots,
            leverage,
            orderType,
            price,
            takeProfit,
            stopLoss,
        } = req.body;


        const result =
            await createTradingOrder({

                username,

                symbol,

                side,

                quantity,

                lots,

                leverage,

                orderType,

                price,

                takeProfit,

                stopLoss,

            });


        return res
            .status(200)
            .json(
                result
            );


    } catch (err) {

        console.error(
            "❌ Create Trading Order Error:",
            err
        );


        return res
            .status(400)
            .json({

                success: false,

                message:
                    err.message ||
                    "Failed to create trading order.",

            });

    }

}


// =====================================================
// EXECUTE ONE PENDING LIMIT ORDER
// =====================================================
//
// POST /api/trade/order/:orderId/execute
//
// Normally this should be called by the backend execution
// worker after checking the latest Yahoo price.
//
// It is also useful for testing a pending order manually.
//


export async function executeOrder(
    req,
    res
) {

    try {

        const {
            orderId,
        } = req.params;


        if (!orderId) {

            return res
                .status(400)
                .json({

                    success: false,

                    message:
                        "Order ID is required.",

                });

        }


        const result =
            await executePendingOrder(
                orderId
            );


        return res
            .status(200)
            .json(
                result
            );


    } catch (err) {

        console.error(
            "❌ Execute Pending Order Error:",
            err
        );


        return res
            .status(400)
            .json({

                success: false,

                message:
                    err.message ||
                    "Failed to execute pending order.",

            });

    }

}


// =====================================================
// EXECUTE ALL PENDING LIMIT ORDERS
// =====================================================
//
// POST /api/trade/orders/execute-pending
//
// Backend worker / scheduler can call this endpoint.
//


export async function executePending(
    req,
    res
) {

    try {

        const result =
            await executePendingOrders();


        return res
            .status(200)
            .json(
                result
            );


    } catch (err) {

        console.error(
            "❌ Execute Pending Orders Error:",
            err
        );


        return res
            .status(400)
            .json({

                success: false,

                message:
                    err.message ||
                    "Failed to execute pending orders.",

            });

    }

}


// =====================================================
// CHECK ONE POSITION TP / SL
// =====================================================
//
// POST /api/trade/position/:positionId/risk
//
// Checks current Yahoo price against:
//
// Take Profit
// Stop Loss
//
// If triggered, the position is closed and the wallet is
// settled by tradeService.
//


export async function checkPositionRisk(
    req,
    res
) {

    try {

        const {
            positionId,
        } = req.params;


        if (!positionId) {

            return res
                .status(400)
                .json({

                    success: false,

                    message:
                        "Position ID is required.",

                });

        }


        const result =
            await checkPositionTakeProfitStopLoss(
                positionId
            );


        return res
            .status(200)
            .json(
                result
            );


    } catch (err) {

        console.error(
            "❌ Position TP/SL Check Error:",
            err
        );


        return res
            .status(400)
            .json({

                success: false,

                message:
                    err.message ||
                    "Failed to check position risk.",

            });

    }

}


// =====================================================
// CHECK ALL OPEN POSITIONS TP / SL
// =====================================================
//
// POST /api/trade/positions/check-risk
//
// Checks all OPEN normal positions.
//
// Useful for a backend worker running repeatedly.
//


export async function checkAllPositionsRisk(
    req,
    res
) {

    try {

        const result =
            await checkAllPositionsTakeProfitStopLoss();


        return res
            .status(200)
            .json(
                result
            );


    } catch (err) {

        console.error(
            "❌ All Positions TP/SL Check Error:",
            err
        );


        return res
            .status(400)
            .json({

                success: false,

                message:
                    err.message ||
                    "Failed to check open positions.",

            });

    }

}