import mongoose from "mongoose";

/*
|--------------------------------------------------------------------------
| Market Request Schema
|--------------------------------------------------------------------------
|
| This model is used for the new Admin-Controlled Market Trade system.
|
| Flow:
|
| User places BUY
|       ↓
| MarketRequest created
|       ↓
| Admin sees request
|       ↓
| Admin sets Duration + P&L %
|       ↓
| Request becomes ACTIVE
|       ↓
| Market position runs
|       ↓
| Final percentage is locked ~5 seconds before expiry
|       ↓
| Trade is settled
|       ↓
| Balance is updated
|       ↓
| Request is marked/removed after settlement
|
|--------------------------------------------------------------------------
*/

const marketRequestSchema = new mongoose.Schema(
    {
        /*
        |--------------------------------------------------------------------------
        | User Information
        |--------------------------------------------------------------------------
        */

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

        /*
        |--------------------------------------------------------------------------
        | User-Facing Order ID
        |--------------------------------------------------------------------------
        |
        | This is an EXTRA display-only identifier shown to the user in the
        | Market Trade History (e.g. Orders: OR986547292764536793).
        |
        | This is NOT a replacement for MongoDB's `_id`.
        |
        | - `_id` remains the internal/relational identifier used everywhere
        |   (Position linking, lookups, etc.) and is never touched.
        | - `orderId` is only for user-facing display purposes.
        |
        | Format: "OR" + 18 random numeric digits.
        |
        */

        orderId: {
            type: String,
            trim: true,
            uppercase: true,
        },

        /*
        |--------------------------------------------------------------------------
        | Market / Instrument Information
        |--------------------------------------------------------------------------
        */

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
            default: "",
        },

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
        | Trade Side
        |--------------------------------------------------------------------------
        |
        | BUY  = LONG
        | SELL = SHORT
        |
        | For the new Market flow, BUY is the normal opening request.
        | SELL is also retained so the model can safely support both sides
        | if required by the existing trading system.
        |
        */

        side: {
            type: String,
            enum: ["BUY", "SELL"],
            required: true,
            index: true,
        },

        /*
        |--------------------------------------------------------------------------
        | Order Type
        |--------------------------------------------------------------------------
        |
        | The new system supports MARKET only.
        |
        | LIMIT is intentionally not allowed in this model.
        |
        */

        orderType: {
            type: String,
            enum: ["MARKET"],
            default: "MARKET",
            required: true,
        },

        /*
        |--------------------------------------------------------------------------
        | Quantity / Lots
        |--------------------------------------------------------------------------
        */

        quantity: {
            type: Number,
            required: true,
            min: 0,
        },

        lots: {
            type: Number,
            default: 0,
            min: 0,
        },

        lotSize: {
            type: Number,
            default: 1,
            min: 0.00000001,
        },

        /*
        |--------------------------------------------------------------------------
        | Entry / Market Price
        |--------------------------------------------------------------------------
        |
        | This is the price captured when the user places the Market request.
        |
        */

        entryPrice: {
            type: Number,
            required: true,
            min: 0,
        },

        currentPrice: {
            type: Number,
            default: 0,
            min: 0,
        },

        /*
        |--------------------------------------------------------------------------
        | Exposure / Leverage / Margin
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
            required: true,
            min: 0,
        },

        /*
        | Actual amount associated with the user's trade.
        |
        | This is preserved separately from margin so the settlement
        | calculation can use the correct value according to the trade.
        */
        investedAmount: {
            type: Number,
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
        | Trading Fee
        |--------------------------------------------------------------------------
        */

        fee: {
            type: Number,
            default: 0,
            min: 0,
        },

        /*
        |--------------------------------------------------------------------------
        | Admin-Controlled Result
        |--------------------------------------------------------------------------
        |
        | adminPercent is the percentage selected by the admin.
        |
        | Examples:
        |
        |  0.30  = +0.30%
        | -0.50  = -0.50%
        | 10.00  = +10%
        | -25.00 = -25%
        |
        | Positive = profit
        | Negative = loss
        |
        */

        adminPercent: {
            type: Number,
            default: null,
        },

        /*
        | The final percentage that is locked approximately 5 seconds
        | before expiry.
        |
        | Once this value is written, the settlement engine must use this
        | value and should not change it again.
        */

        finalPercent: {
            type: Number,
            default: null,
        },

        /*
        |--------------------------------------------------------------------------
        | Admin Duration
        |--------------------------------------------------------------------------
        |
        | Duration is configured by the admin in minutes.
        |
        | Examples:
        | 15
        | 30
        | 60
        | 120
        |
        */

        durationMinutes: {
            type: Number,
            default: null,
            min: 0,
        },

        /*
        |--------------------------------------------------------------------------
        | Market Timing
        |--------------------------------------------------------------------------
        */

        /*
        | Request creation time is automatically handled by timestamps.
        |
        | startedAt is set when admin presses SET.
        */

        startedAt: {
            type: Date,
            default: null,
            index: true,
        },

        /*
        | Exact expiry time:
        |
        | startedAt + durationMinutes
        |
        */

        expiresAt: {
            type: Date,
            default: null,
            index: true,
        },

        /*
        | Approximately 5 seconds before expiresAt, the final percentage
        | is locked.
        */

        lockedAt: {
            type: Date,
            default: null,
        },

        /*
        |--------------------------------------------------------------------------
        | State
        |--------------------------------------------------------------------------
        |
        | PENDING
        |   User submitted request but admin has not pressed SET.
        |
        | ACTIVE
        |   Admin has set duration + percentage and the trade is running.
        |
        | LOCKED
        |   Final percentage has been locked before expiry.
        |
        | SETTLED
        |   Balance settlement has been completed.
        |
        | CLOSED
        |   User manually sold/closed the position before expiry.
        |
        */

        status: {
            type: String,
            enum: [
                "PENDING",
                "ACTIVE",
                "LOCKED",
                "SETTLED",
                "CLOSED",
            ],
            default: "PENDING",
            index: true,
        },

        /*
        |--------------------------------------------------------------------------
        | Position Reference
        |--------------------------------------------------------------------------
        |
        | Once the Market request becomes a real Position, this field
        | connects the request with that Position document.
        |
        */

        positionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Position",
            default: null,
        },

        /*
        |--------------------------------------------------------------------------
        | Settlement Information
        |--------------------------------------------------------------------------
        */

        /*
        | Final P&L amount in account currency.
        |
        | Example:
        | margin = 1000
        | finalPercent = 0.30
        | finalPnl = 3
        |
        */

        finalPnl: {
            type: Number,
            default: null,
        },

        /*
        | Final balance adjustment.
        |
        | Positive = amount added to user's balance.
        | Negative = amount deducted from user's balance.
        */

        balanceAdjustment: {
            type: Number,
            default: null,
        },

        /*
        | Whether balance settlement has already happened.
        |
        | This protects against duplicate balance updates.
        */

        settled: {
            type: Boolean,
            default: false,
            index: true,
        },

        settledAt: {
            type: Date,
            default: null,
        },

        /*
        |--------------------------------------------------------------------------
        | Early Sell / Close Information
        |--------------------------------------------------------------------------
        */

        /*
        | If user sells before the admin-configured duration expires,
        | the current controlled P&L percentage is stored here.
        */

        closedPercent: {
            type: Number,
            default: null,
        },

        closedPnl: {
            type: Number,
            default: null,
        },

        closedAt: {
            type: Date,
            default: null,
        },

        /*
        |--------------------------------------------------------------------------
        | Currency
        |--------------------------------------------------------------------------
        */

        currency: {
            type: String,
            default: "USD",
            uppercase: true,
            trim: true,
        },

        /*
        |--------------------------------------------------------------------------
        | Admin Information
        |--------------------------------------------------------------------------
        |
        | Stores which admin configured the result.
        |
        */

        setByAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        setByAdminUsername: {
            type: String,
            default: "",
            trim: true,
        },

        /*
        |--------------------------------------------------------------------------
        | Notes / Metadata
        |--------------------------------------------------------------------------
        |
        | Optional internal note for future admin-side use.
        |
        */

        adminNote: {
            type: String,
            default: "",
            trim: true,
            maxlength: 1000,
        },
    },
    {
        timestamps: true,
    }
);

/*
|--------------------------------------------------------------------------
| Useful Indexes
|--------------------------------------------------------------------------
|
| These indexes are used by:
|
| - Admin Market request list
| - User Market request lookup
| - Market scheduler
| - Expiry detection
| - Active Market position lookup
|
*/

/*
| Admin:
| Quickly find pending requests.
*/
marketRequestSchema.index({
    status: 1,
    createdAt: -1,
});

/*
| Scheduler:
| Quickly find active requests ordered by expiry.
*/
marketRequestSchema.index({
    status: 1,
    expiresAt: 1,
});

/*
| User:
| Quickly find a user's active Market requests.
*/
marketRequestSchema.index({
    userId: 1,
    status: 1,
    createdAt: -1,
});

/*
| Position:
| Quickly find the Market request connected to a Position.
*/
marketRequestSchema.index({
    positionId: 1,
});

/*
| Symbol:
| Useful for Market-related queries.
*/
marketRequestSchema.index({
    symbol: 1,
    status: 1,
});

/*
| Order ID:
| Unique user-facing identifier used in Market Trade History.
|
| `sparse: true` is used so that existing/old documents which do not
| have an `orderId` (created before this feature) are NOT affected and
| do NOT break the unique constraint. Only documents that actually have
| an `orderId` value participate in the uniqueness check.
*/
marketRequestSchema.index(
    { orderId: 1 },
    { unique: true, sparse: true }
);

/*
|--------------------------------------------------------------------------
| Model
|--------------------------------------------------------------------------
*/

const MarketRequest = mongoose.model(
    "MarketRequest",
    marketRequestSchema
);

export default MarketRequest;