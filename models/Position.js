import mongoose from "mongoose";

/*
|--------------------------------------------------------------------------
| Position Schema
|--------------------------------------------------------------------------
|
| Supports:
| - Existing NSE / BSE normal positions
| - Forex / Metal / Oil / Crypto / Index positions
| - Long / Short positions
| - Leverage
| - Lots / contract size
| - Margin / notional value
| - Trading fee
| - Take Profit / Stop Loss
| - Unrealized / realized P&L
| - Existing Block Trade positions
| - Admin-controlled Market positions
|
| Existing fields are intentionally preserved so the current stock
| trading / block-trade code does not lose its existing data.
|
*/

const positionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        username: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index: true,
        },

        symbol: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            index: true,
        },

        /*
        |--------------------------------------------------------------------------
        | Market Information
        |--------------------------------------------------------------------------
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
            index: true,
        },

        company: {
            type: String,
            required: true,
            trim: true,
            default: "",
        },

        /*
        | Existing stock positions use NSE/BSE.
        | New asset classes do not have to use NSE/BSE.
        */
        exchange: {
            type: String,
            trim: true,
            uppercase: true,
            default: "",
        },

        logo: {
            type: String,
            default: "",
        },

        /*
        |--------------------------------------------------------------------------
        | Position Direction
        |--------------------------------------------------------------------------
        |
        | LONG  = Buy position
        | SHORT = Sell position
        |
        | Existing positions without side are treated as LONG by default.
        |
        */
        side: {
            type: String,
            enum: ["LONG", "SHORT"],
            default: "LONG",
            index: true,
        },

        /*
        |--------------------------------------------------------------------------
        | Quantity / Lots
        |--------------------------------------------------------------------------
        */

        quantity: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },

        lots: {
            type: Number,
            default: 0,
            min: 0,
        },

        /*
        | Number of underlying units represented by one lot.
        | This is configurable because Forex/CFD/commodity contract sizes
        | can differ from the existing stock quantity model.
        */
        lotSize: {
            type: Number,
            default: 1,
            min: 0.00000001,
        },

        /*
        |--------------------------------------------------------------------------
        | Entry / Current Price
        |--------------------------------------------------------------------------
        |
        | averagePrice is preserved for the existing application.
        | entryPrice is the explicit leveraged-trading entry price.
        |
        */

        averagePrice: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },

        entryPrice: {
            type: Number,
            default: 0,
            min: 0,
        },

        currentPrice: {
            type: Number,
            default: 0,
            min: 0,
        },

        /*
        |--------------------------------------------------------------------------
        | Exposure / Margin / Leverage
        |--------------------------------------------------------------------------
        */

        leverage: {
            type: Number,
            default: 1,
            min: 1,
        },

        notionalValue: {
            type: Number,
            default: 0,
            min: 0,
        },

        margin: {
            type: Number,
            default: 0,
            min: 0,
        },

        /*
        | Existing field retained.
        | For normal stock positions this can continue to represent the
        | invested amount. For leveraged positions it can represent the
        | amount associated with the position according to tradeService.
        */
        investedAmount: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },

        userInvestedAmount: {
            type: Number,
            default: 0,
            min: 0,
        },

        /*
        |--------------------------------------------------------------------------
        | Trading Costs
        |--------------------------------------------------------------------------
        */

        fee: {
            type: Number,
            default: 0,
            min: 0,
        },

        /*
        |--------------------------------------------------------------------------
        | Take Profit / Stop Loss
        |--------------------------------------------------------------------------
        |
        | null means that the feature is not enabled for this position.
        |
        | Existing fields are preserved for backward compatibility.
        | New Market-controlled positions will keep these as null.
        |
        */

        takeProfit: {
            type: Number,
            default: null,
            min: 0,
        },

        stopLoss: {
            type: Number,
            default: null,
            min: 0,
        },

        /*
        |--------------------------------------------------------------------------
        | Current Value / P&L
        |--------------------------------------------------------------------------
        */

        currentValue: {
            type: Number,
            default: 0,
            min: 0,
        },

        profitLoss: {
            type: Number,
            default: 0,
        },

        profitLossPercent: {
            type: Number,
            default: 0,
        },

        /*
        | Explicit leveraged-trading aliases.
        | Existing code can continue using profitLoss/profitLossPercent.
        */
        unrealizedPnl: {
            type: Number,
            default: 0,
        },

        unrealizedPnlPercent: {
            type: Number,
            default: 0,
        },

        realizedPnl: {
            type: Number,
            default: 0,
        },

        /*
        |--------------------------------------------------------------------------
        | Position Status
        |--------------------------------------------------------------------------
        */

        status: {
            type: String,
            enum: ["OPEN", "CLOSED"],
            default: "OPEN",
            index: true,
        },

        openedAt: {
            type: Date,
            default: Date.now,
        },

        closedAt: {
            type: Date,
            default: null,
        },

        lastPriceUpdated: {
            type: Date,
            default: null,
        },

        /*
        |--------------------------------------------------------------------------
        | Admin-Controlled Market Position
        |--------------------------------------------------------------------------
        |
        | A Market position created through the new Market Request system
        | is linked to a MarketRequest document.
        |
        | marketControlled = true
        | means the position's P&L/result is controlled by the admin-set
        | percentage and duration rather than normal TP/SL execution.
        |
        */

        marketRequestId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MarketRequest",
            default: null,
            index: true,
        },

        marketControlled: {
            type: Boolean,
            default: false,
            index: true,
        },

        /*
        | Percentage selected by the admin.
        |
        | Examples:
        | +0.30
        | -0.50
        | +10
        | -25
        |
        | This is stored as the numeric percentage value.
        */
        adminPercent: {
            type: Number,
            default: null,
        },

        /*
        | When the admin presses SET.
        */
        marketStartedAt: {
            type: Date,
            default: null,
        },

        /*
        | Exact time at which the configured Market duration expires.
        */
        marketExpiresAt: {
            type: Date,
            default: null,
            index: true,
        },

        /*
        | The moment the final admin percentage becomes locked.
        | This is normally approximately 5 seconds before expiry.
        */
        marketLockedAt: {
            type: Date,
            default: null,
        },

        /*
        | Final percentage that must be used when the Market trade settles.
        */
        marketFinalPercent: {
            type: Number,
            default: null,
        },

        /*
        | Whether the Market position has already been financially settled.
        |
        | false = still active / not settled
        | true  = balance settlement has already happened
        */
        marketSettled: {
            type: Boolean,
            default: false,
            index: true,
        },

        /*
        | Duration configured by the admin, stored in minutes.
        |
        | Examples:
        | 15
        | 30
        | 60
        | 120
        */
        marketDurationMinutes: {
            type: Number,
            default: null,
            min: 0,
        },

        /*
        |--------------------------------------------------------------------------
        | Block Trade Reference
        |--------------------------------------------------------------------------
        |
        | Normal position:
        | blockTradeId = null
        |
        | Block Trade position:
        | blockTradeId = related BlockTrade document ID
        |
        | Isse same user + same symbol ki normal aur Block Trade
        | positions ko alag identify kiya ja sakta hai.
        |
        */
        blockTradeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BlockTrade",
            default: null,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

/*
|--------------------------------------------------------------------------
| Position Uniqueness
|--------------------------------------------------------------------------
|
| Normal position:
| userId + symbol + blockTradeId(null) + marketRequestId(null)
|
| Block Trade position:
| userId + symbol + blockTradeId(BlockTrade ID) + marketRequestId(null)
|
| Admin-controlled Market position:
| userId + symbol + marketRequestId(MarketRequest ID)
|
| Isse:
| - existing normal position ka behaviour preserve hota hai
| - Block Trade position separate rehti hai
| - Market-controlled position existing normal position se conflict
|   nahi karti
|
*/

positionSchema.index(
    {
        userId: 1,
        symbol: 1,
        blockTradeId: 1,
        marketRequestId: 1,
    },
    {
        unique: true,
    }
);

/*
|--------------------------------------------------------------------------
| Useful Query Indexes
|--------------------------------------------------------------------------
|
| These indexes help the trading engine quickly find open positions
| and positions for a particular market/asset.
|
*/

positionSchema.index({
    userId: 1,
    status: 1,
});

positionSchema.index({
    symbol: 1,
    status: 1,
});

positionSchema.index({
    assetType: 1,
    status: 1,
});

/*
|--------------------------------------------------------------------------
| Market Trade Query Indexes
|--------------------------------------------------------------------------
|
| These indexes help the Market scheduler and Market service quickly
| find active admin-controlled positions and positions approaching
| their expiry time.
|
*/

positionSchema.index({
    marketControlled: 1,
    status: 1,
    marketExpiresAt: 1,
});

positionSchema.index({
    userId: 1,
    marketControlled: 1,
    status: 1,
});

const Position = mongoose.model("Position", positionSchema);

export default Position;