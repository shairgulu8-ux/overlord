import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
    {
        // =====================================================
        // User Reference
        // =====================================================

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        username: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            index: true,
        },

        // =====================================================
        // Asset Information
        // =====================================================

        symbol: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            index: true,
        },

        company: {
            type: String,
            required: true,
            trim: true,
        },

        /*
        |--------------------------------------------------------------------------
        | Asset Type
        |--------------------------------------------------------------------------
        |
        | STOCK  = NSE / BSE stocks
        | FOREX  = Currency pairs
        | METAL  = Gold / Silver
        | OIL    = Crude oil
        | CRYPTO = Cryptocurrency
        | INDEX  = Market indices
        |
        */

        assetType: {
            type: String,
            enum: [
                "STOCK",
                "FOREX",
                "METAL",
                "OIL",
                "CRYPTO",
                "INDEX",
            ],
            default: "STOCK",
            uppercase: true,
            trim: true,
            index: true,
        },

        exchange: {
            type: String,
            required: true,
            trim: true,
        },

        // =====================================================
        // Block Trade Reference
        // =====================================================

        blockTradeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BlockTrade",
            default: null,
            index: true,
        },

        // =====================================================
        // BUY / SELL
        // =====================================================

        type: {
            type: String,
            enum: ["BUY", "SELL"],
            required: true,
            uppercase: true,
            index: true,
        },

        // =====================================================
        // Order Type
        // =====================================================
        //
        // MARKET
        //   Execute using current market price.
        //
        // LIMIT
        //   Wait for the requested price before execution.
        //
        // COMPLETED is retained in status below for backward
        // compatibility with the existing trading system.
        //

        orderType: {
            type: String,
            enum: ["MARKET", "LIMIT"],
            default: "MARKET",
            uppercase: true,
            index: true,
        },

        // =====================================================
        // Quantity
        // =====================================================

        quantity: {
            type: Number,
            required: true,
            min: 1,
        },

        // =====================================================
        // Lots
        // =====================================================

        lots: {
            type: Number,
            default: 0,
            min: 0,
        },

        // =====================================================
        // Lot Size
        // =====================================================
        //
        // Example:
        // 1 lot = 10 units
        //
        // This value is stored with the order so that a later
        // configuration change does not alter old orders.
        //

        lotSize: {
            type: Number,
            default: 0,
            min: 0,
        },

        // =====================================================
        // Requested / Order Price
        // =====================================================
        //
        // For MARKET order this can contain the price available
        // when the order request was created.
        //
        // For LIMIT order this is the user's requested price.
        //

        price: {
            type: Number,
            required: true,
            min: 0,
        },

        // =====================================================
        // Actual Execution Price
        // =====================================================

        executedPrice: {
            type: Number,
            default: 0,
            min: 0,
        },

        // =====================================================
        // Notional / Position Value
        // =====================================================
        //
        // Approx:
        // quantity × execution/requested price
        //
        // Final calculation must be performed by backend service.
        //

        notionalValue: {
            type: Number,
            default: 0,
            min: 0,
        },

        // =====================================================
        // Total Amount
        // =====================================================
        //
        // Existing field retained for compatibility.
        //

        totalAmount: {
            type: Number,
            required: true,
            min: 0,
        },

        // =====================================================
        // Leverage
        // =====================================================

        leverage: {
            type: Number,
            default: 1,
            min: 1,
        },

        // =====================================================
        // Margin
        // =====================================================
        //
        // Amount required/locked for leveraged position.
        //

        margin: {
            type: Number,
            default: 0,
            min: 0,
        },

        // =====================================================
        // Trading Fee
        // =====================================================

        fee: {
            type: Number,
            default: 0,
            min: 0,
        },

        // =====================================================
        // Take Profit
        // =====================================================

        takeProfit: {
            type: Number,
            default: null,
            min: 0,
        },

        // =====================================================
        // Stop Loss
        // =====================================================

        stopLoss: {
            type: Number,
            default: null,
            min: 0,
        },

        // =====================================================
        // Existing Average Buy Price
        // =====================================================

        averageBuyPrice: {
            type: Number,
            default: 0,
        },

        // =====================================================
        // Realized Profit / Loss
        // =====================================================

        realizedProfit: {
            type: Number,
            default: 0,
        },

        // =====================================================
        // Unrealized Profit / Loss Snapshot
        // =====================================================
        //
        // Useful for order/position information returned to the
        // frontend. The authoritative live P&L should still come
        // from the position/trading service.
        //

        unrealizedProfit: {
            type: Number,
            default: 0,
        },

        // =====================================================
        // Order Status
        // =====================================================
        //
        // PENDING
        //   Limit order waiting for target price.
        //
        // FILLED
        //   Order executed.
        //
        // OPEN
        //   Position/order currently active.
        //
        // COMPLETED
        //   Existing status retained for old records/API
        //   compatibility.
        //
        // CANCELLED
        //   Pending order cancelled.
        //
        // CLOSED
        //   Position/order closed.
        //

        status: {
            type: String,
            enum: [
                "PENDING",
                "FILLED",
                "OPEN",
                "COMPLETED",
                "CANCELLED",
                "CLOSED",
            ],
            default: "PENDING",
            uppercase: true,
            index: true,
        },

        // =====================================================
        // Order Time
        // =====================================================

        orderTime: {
            type: Date,
            default: Date.now,
            index: true,
        },

        // =====================================================
        // Execution / Position Timing
        // =====================================================

        executedAt: {
            type: Date,
            default: null,
        },

        openedAt: {
            type: Date,
            default: null,
        },

        closedAt: {
            type: Date,
            default: null,
        },

        // =====================================================
        // Last Price Used For Order/Position Check
        // =====================================================

        lastCheckedPrice: {
            type: Number,
            default: 0,
            min: 0,
        },

        lastPriceCheckedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// =====================================================
// User → Latest Orders
// =====================================================

orderSchema.index({
    userId: 1,
    orderTime: -1,
});

// =====================================================
// User → Symbol
// =====================================================

orderSchema.index({
    userId: 1,
    symbol: 1,
});

// =====================================================
// User → Status
// =====================================================

orderSchema.index({
    userId: 1,
    status: 1,
    orderTime: -1,
});

// =====================================================
// Symbol → Status
// =====================================================
//
// Useful when the trading engine checks pending orders.
//

orderSchema.index({
    symbol: 1,
    status: 1,
    orderTime: -1,
});

// =====================================================
// Pending Limit Orders
// =====================================================
//
// Helps the execution service quickly find pending orders.
//

orderSchema.index({
    orderType: 1,
    status: 1,
    symbol: 1,
});

// =====================================================
// Asset Type → Status
// =====================================================

orderSchema.index({
    assetType: 1,
    status: 1,
    orderTime: -1,
});


// =====================================================
// Export
// =====================================================

export default mongoose.model("Order", orderSchema);