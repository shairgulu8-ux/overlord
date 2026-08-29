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
| userId + symbol + blockTradeId(null)
|
| Block Trade position:
| userId + symbol + blockTradeId(BlockTrade ID)
|
| Isse same user ke same symbol ki normal aur
| Block Trade position alag documents ho sakti hain.
|
*/

positionSchema.index(
    {
        userId: 1,
        symbol: 1,
        blockTradeId: 1,
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

const Position = mongoose.model("Position", positionSchema);

export default Position;