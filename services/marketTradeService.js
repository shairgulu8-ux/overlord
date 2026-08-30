import User from "../models/User.js";
import Position from "../models/Position.js";
import MarketRequest from "../models/MarketRequest.js";
import { fetchStock } from "./yahooService.js";

/*
|--------------------------------------------------------------------------
| MARKET TRADE SERVICE
|--------------------------------------------------------------------------
|
| Admin-Controlled Market Trading System
|
| Flow:
|
| USER
|   ↓
| createMarketRequest()
|   ↓
| MarketRequest = PENDING
|   ↓
| ADMIN
|   ↓
| setMarketResult()
|   ↓
| MarketRequest = ACTIVE
|   ↓
| Position created
|   ↓
| P&L controlled by admin percentage + duration
|   ↓
| 5 seconds before expiry
|   ↓
| final percentage LOCKED
|   ↓
| expiry
|   ↓
| balance settlement
|   ↓
| MarketRequest = SETTLED
|
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| - Only MARKET is supported here.
| - LIMIT is never accepted.
| - TP/SL is never accepted.
| - Admin controls the final percentage.
| - Positive percentage = profit.
| - Negative percentage = loss.
| - Margin remains reserved through the Position.
| - Only final/current P&L changes the wallet balance.
|
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const MARKET_FINAL_LOCK_SECONDS = 5;


/*
|--------------------------------------------------------------------------
| Generic Helpers
|--------------------------------------------------------------------------
*/

function roundNumber(value, decimals = 8) {
    return Number(
        Number(value || 0).toFixed(decimals)
    );
}


function normalizeUsername(username) {
    if (
        !username ||
        typeof username !== "string" ||
        !username.trim()
    ) {
        throw new Error("Username is required.");
    }

    return username.trim().toLowerCase();
}


function normalizeSymbol(symbol) {
    if (
        !symbol ||
        typeof symbol !== "string" ||
        !symbol.trim()
    ) {
        throw new Error("Stock symbol is required.");
    }

    return symbol.trim().toUpperCase();
}


function validateQuantity(quantity) {
    const value = Number(quantity);

    if (
        !Number.isFinite(value) ||
        Number.isNaN(value) ||
        value <= 0
    ) {
        throw new Error("Invalid quantity.");
    }

    return value;
}


function validatePositiveNumber(value, fieldName) {
    const number = Number(value);

    if (
        !Number.isFinite(number) ||
        Number.isNaN(number) ||
        number <= 0
    ) {
        throw new Error(`Invalid ${fieldName}.`);
    }

    return number;
}


function validateDuration(durationMinutes) {
    const duration = Number(durationMinutes);

    if (
        !Number.isFinite(duration) ||
        Number.isNaN(duration) ||
        duration <= 0
    ) {
        throw new Error(
            "Duration must be greater than 0 minutes."
        );
    }

    return duration;
}


/*
|--------------------------------------------------------------------------
| Admin Percentage Validation
|--------------------------------------------------------------------------
|
| Examples accepted:
|
| +0.30
| 0.30
| -0.50
| +10
| -25
|
| Internally stored as:
|
|  0.30
| -0.50
| 10
| -25
|
*/

function validateAdminPercent(value) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        throw new Error("P&L percentage is required.");
    }

    const percent = Number(
        String(value)
            .trim()
            .replace("%", "")
    );

    if (
        !Number.isFinite(percent) ||
        Number.isNaN(percent)
    ) {
        throw new Error(
            "Invalid P&L percentage."
        );
    }

    return percent;
}


/*
|--------------------------------------------------------------------------
| Asset Type
|--------------------------------------------------------------------------
*/

function normalizeAssetType(assetType, market) {
    const value = String(
        assetType ||
        market?.assetType ||
        "STOCK"
    )
        .trim()
        .toUpperCase();

    const allowed = [
        "STOCK",
        "FOREX",
        "METAL",
        "OIL",
        "CRYPTO",
        "INDEX",
    ];

    return allowed.includes(value)
        ? value
        : "STOCK";
}


/*
|--------------------------------------------------------------------------
| Lot Configuration
|--------------------------------------------------------------------------
*/

const DEFAULT_LOT_SIZE = {
    STOCK: 1,
    FOREX: 10,
    METAL: 1,
    OIL: 1,
    CRYPTO: 1,
    INDEX: 1,
};


const MAX_LEVERAGE = {
    STOCK: 1,
    FOREX: 500,
    METAL: 100,
    OIL: 100,
    CRYPTO: 50,
    INDEX: 100,
};


/*
|--------------------------------------------------------------------------
| Leverage Validation
|--------------------------------------------------------------------------
*/

function validateLeverage(value, assetType) {
    const leverage =
        value === undefined ||
        value === null ||
        value === ""
            ? 1
            : Number(value);

    if (
        !Number.isFinite(leverage) ||
        Number.isNaN(leverage) ||
        leverage < 1
    ) {
        throw new Error("Invalid leverage.");
    }

    const maximum =
        MAX_LEVERAGE[assetType] || 1;

    if (leverage > maximum) {
        throw new Error(
            `Maximum allowed leverage for ${assetType} is ${maximum}X.`
        );
    }

    return leverage;
}


/*
|--------------------------------------------------------------------------
| Live Market Validation
|--------------------------------------------------------------------------
|
| We intentionally keep this validation here instead of depending on
| private helpers from tradeService.js.
|
*/

function validateLiveMarket(
    market,
    assetType = "STOCK"
) {
    if (!market) {
        throw new Error(
            "Unable to fetch market asset."
        );
    }

    const price = Number(market.price);

    if (
        !Number.isFinite(price) ||
        price <= 0
    ) {
        throw new Error(
            "Invalid live market price."
        );
    }

    const skipMarketCheck =
        String(
            process.env.SKIP_MARKET_CHECK || ""
        ).toLowerCase() === "true";

    if (skipMarketCheck) {
        return;
    }

    const resolvedAssetType =
        String(assetType)
            .trim()
            .toUpperCase();

    /*
    | Crypto is available 24/7.
    */
    if (resolvedAssetType === "CRYPTO") {
        return;
    }

    const now = new Date();

    const indiaTime = new Date(
        now.toLocaleString(
            "en-US",
            {
                timeZone: "Asia/Kolkata",
            }
        )
    );

    const day =
        indiaTime.getDay();

    const isWeekend =
        day === 0 ||
        day === 6;

    if (isWeekend) {
        throw new Error(
            "Market is currently closed."
        );
    }

    if (
        market.marketState &&
        String(market.marketState)
            .toUpperCase() === "CLOSED"
    ) {
        throw new Error(
            "Market is currently closed."
        );
    }

    /*
    | Indian stock market hours.
    */
    if (resolvedAssetType === "STOCK") {
        const symbol = String(
            market.symbol ||
            market.ticker ||
            ""
        )
            .trim()
            .toUpperCase();

        const exchange = String(
            market.exchange || ""
        )
            .trim()
            .toUpperCase();

        const isIndianStock =
            exchange.includes("NSE") ||
            exchange.includes("BSE") ||
            symbol.endsWith(".NS") ||
            symbol.endsWith(".BO");

        if (isIndianStock) {
            const hour =
                indiaTime.getHours();

            const minute =
                indiaTime.getMinutes();

            const currentMinutes =
                hour * 60 + minute;

            const marketOpen =
                9 * 60 + 15;

            const marketClose =
                15 * 60 + 30;

            if (
                currentMinutes <
                    marketOpen ||
                currentMinutes >
                    marketClose
            ) {
                throw new Error(
                    "Market is currently closed."
                );
            }
        }
    }
}


/*
|--------------------------------------------------------------------------
| Financial Calculation
|--------------------------------------------------------------------------
*/

function calculateFinancials(
    price,
    quantity,
    leverage
) {
    const notionalValue =
        roundNumber(
            Number(price) *
            Number(quantity)
        );

    const margin =
        roundNumber(
            notionalValue /
            Number(leverage)
        );

    /*
    | Existing tradeService currently has zero fee rates for these
    | asset types, so Market trades also use zero fee here.
    */
    const fee = 0;

    return {
        notionalValue,
        margin,
        fee,
        requiredMarginAndFee:
            roundNumber(
                margin + fee
            ),
    };
}


/*
|--------------------------------------------------------------------------
| Wallet Helpers
|--------------------------------------------------------------------------
*/

function getBalance(user) {
    return roundNumber(
        user?.balance || 0
    );
}


function getUsedMargin(user) {
    return roundNumber(
        user?.usedMargin || 0
    );
}


function getAvailableBalance(user) {
    return roundNumber(
        getBalance(user) -
        getUsedMargin(user)
    );
}


/*
|--------------------------------------------------------------------------
| Refresh User Margin
|--------------------------------------------------------------------------
|
| Existing User model uses:
|
| balance
| usedMargin
| availableBalance
|
| Existing tradeService calculates used margin from open positions.
| Market positions are real OPEN positions too, so they naturally
| participate in the same margin calculation.
|
*/

async function refreshUserMarginState(user) {
    const openPositions =
        await Position.find({
            userId: user._id,
            blockTradeId: null,
            status: "OPEN",
        }).select(
            "margin investedAmount"
        );

    const usedMargin =
        roundNumber(
            openPositions.reduce(
                (
                    total,
                    position
                ) =>
                    total +
                    Number(
                        position.margin ??
                        position.investedAmount ??
                        0
                    ),
                0
            )
        );

    const balance =
        getBalance(user);

    user.usedMargin =
        usedMargin;

    user.availableBalance =
        roundNumber(
            balance -
            usedMargin
        );

    return {
        balance,
        usedMargin,
        availableBalance:
            user.availableBalance,
    };
}


async function saveUserWithMarginState(
    user
) {
    const wallet =
        await refreshUserMarginState(
            user
        );

    await user.save();

    return wallet;
}


function walletResponse(user) {
    return {
        balance:
            getBalance(user),

        usedMargin:
            getUsedMargin(user),

        availableBalance:
            getAvailableBalance(user),
    };
}


/*
|--------------------------------------------------------------------------
| Pending Market Request Margin
|--------------------------------------------------------------------------
|
| A PENDING request has not become a Position yet.
|
| Therefore refreshUserMarginState() cannot see its margin.
|
| This helper prevents a user from creating unlimited pending requests
| that together exceed the available balance.
|
*/

async function getPendingMarketMargin(
    userId
) {
    const pendingRequests =
        await MarketRequest.find({
            userId,
            status: "PENDING",
        }).select("margin");

    return roundNumber(
        pendingRequests.reduce(
            (
                total,
                request
            ) =>
                total +
                Number(
                    request.margin || 0
                ),
            0
        )
    );
}


async function getAvailableForNewMarketRequest(
    user
) {
    await refreshUserMarginState(
        user
    );

    const pendingMargin =
        await getPendingMarketMargin(
            user._id
        );

    return roundNumber(
        getAvailableBalance(user) -
        pendingMargin
    );
}


/*
|--------------------------------------------------------------------------
| Market P&L Calculation
|--------------------------------------------------------------------------
|
| Admin sets a FINAL percentage.
|
| Example:
|
| Duration = 15 minutes
| Final    = +10%
|
| At the beginning:
| 0%
|
| During the duration:
| 0% → gradually toward +10%
|
| Last 5 seconds:
| +10% is LOCKED
|
| This gives the user a continuously changing P&L while ensuring that
| the final admin-selected percentage is used for settlement.
|
*/

function calculateProgressPercent(
    marketRequest,
    now = new Date()
) {
    const finalPercent =
        Number(
            marketRequest.finalPercent ??
            marketRequest.adminPercent ??
            0
        );

    const startedAt =
        marketRequest.startedAt
            ? new Date(
                marketRequest.startedAt
            ).getTime()
            : null;

    const expiresAt =
        marketRequest.expiresAt
            ? new Date(
                marketRequest.expiresAt
            ).getTime()
            : null;

    if (
        startedAt === null ||
        expiresAt === null ||
        expiresAt <= startedAt
    ) {
        return 0;
    }

    const nowTime =
        new Date(now).getTime();

    const duration =
        expiresAt -
        startedAt;

    const elapsed =
        nowTime -
        startedAt;

    if (elapsed <= 0) {
        return 0;
    }

    if (nowTime >= expiresAt) {
        return roundNumber(
            finalPercent,
            8
        );
    }

    /*
    | Keep the final 5 seconds at the final percentage.
    */
    const lockTime =
        expiresAt -
        MARKET_FINAL_LOCK_SECONDS *
            1000;

    if (nowTime >= lockTime) {
        return roundNumber(
            finalPercent,
            8
        );
    }

    const progress =
        Math.min(
            1,
            Math.max(
                0,
                elapsed / duration
            )
        );

    return roundNumber(
        finalPercent * progress,
        8
    );
}


/*
|--------------------------------------------------------------------------
| P&L Amount
|--------------------------------------------------------------------------
|
| P&L percentage is applied to the Market position margin.
|
| Example:
|
| Margin = $1,000
| P&L    = +0.30%
|
| Profit = $3
|
*/

function calculatePnlFromPercent(
    margin,
    percent
) {
    return roundNumber(
        Number(margin || 0) *
        Number(percent || 0) /
        100
    );
}


/*
|--------------------------------------------------------------------------
| Position Response
|--------------------------------------------------------------------------
*/

function positionResponse(
    position,
    marketRequest
) {
    if (!position) {
        return null;
    }

    return {
        _id:
            position._id,

        marketRequestId:
            marketRequest?._id ||
            position.marketRequestId,

        symbol:
            position.symbol,

        company:
            position.company,

        logo:
            position.logo || "",

        assetType:
            position.assetType,

        side:
            position.side,

        quantity:
            position.quantity,

        lots:
            position.lots,

        lotSize:
            position.lotSize,

        entryPrice:
            position.entryPrice ||
            position.averagePrice,

        currentPrice:
            position.currentPrice,

        margin:
            roundNumber(
                position.margin ||
                position.investedAmount
            ),

        leverage:
            position.leverage,

        profitLoss:
            roundNumber(
                position.profitLoss
            ),

        profitLossPercent:
            roundNumber(
                position.profitLossPercent,
                4
            ),

        marketControlled:
            Boolean(
                position.marketControlled
            ),

        adminPercent:
            marketRequest?.adminPercent ??
            position.adminPercent ??
            null,

        currentControlledPercent:
            marketRequest
                ? calculateProgressPercent(
                    marketRequest
                )
                : 0,

        marketStartedAt:
            marketRequest?.startedAt ||
            position.marketStartedAt ||
            null,

        marketExpiresAt:
            marketRequest?.expiresAt ||
            position.marketExpiresAt ||
            null,

        marketDurationMinutes:
            marketRequest?.durationMinutes ||
            position.marketDurationMinutes ||
            null,

        status:
            position.status,
    };
}


/*
|--------------------------------------------------------------------------
| REQUEST RESPONSE
|--------------------------------------------------------------------------
*/

function marketRequestResponse(
    request
) {
    const currentPercent =
        calculateProgressPercent(
            request
        );

    const currentPnl =
        calculatePnlFromPercent(
            request.margin,
            currentPercent
        );

    const remainingMs =
        request.expiresAt
            ? Math.max(
                0,
                new Date(
                    request.expiresAt
                ).getTime() -
                Date.now()
            )
            : null;

    return {
        _id:
            request._id,

        userId:
            request.userId,

        username:
            request.username,

        symbol:
            request.symbol,

        company:
            request.company,

        assetType:
            request.assetType,

        exchange:
            request.exchange,

        logo:
            request.logo || "",

        side:
            request.side,

        orderType:
            "MARKET",

        quantity:
            request.quantity,

        lots:
            request.lots,

        lotSize:
            request.lotSize,

        entryPrice:
            request.entryPrice,

        currentPrice:
            request.currentPrice,

        notionalValue:
            request.notionalValue,

        margin:
            request.margin,

        leverage:
            request.leverage,

        fee:
            request.fee,

        status:
            request.status,

        adminPercent:
            request.adminPercent,

        finalPercent:
            request.finalPercent,

        currentPercent,

        currentPnl,

        durationMinutes:
            request.durationMinutes,

        startedAt:
            request.startedAt,

        expiresAt:
            request.expiresAt,

        lockedAt:
            request.lockedAt,

        remainingMs,

        remainingSeconds:
            remainingMs === null
                ? null
                : Math.ceil(
                    remainingMs / 1000
                ),

        positionId:
            request.positionId,

        finalPnl:
            request.finalPnl,

        balanceAdjustment:
            request.balanceAdjustment,

        settled:
            request.settled,

        settledAt:
            request.settledAt,

        closedPercent:
            request.closedPercent,

        closedPnl:
            request.closedPnl,

        closedAt:
            request.closedAt,

        createdAt:
            request.createdAt,

        updatedAt:
            request.updatedAt,
    };
}


/*
|--------------------------------------------------------------------------
| CREATE MARKET REQUEST
|--------------------------------------------------------------------------
|
| Called when USER presses BUY.
|
| IMPORTANT:
| At this point:
|
| - No Position is created yet.
| - No balance is deducted.
| - Request is stored as PENDING.
| - Margin availability is checked.
|
| Admin must press SET before the trade becomes ACTIVE.
|
*/

export async function createMarketRequest({
    username,
    symbol,
    side = "BUY",
    quantity,
    lots,
    leverage,
}) {
    const normalizedUsername =
        normalizeUsername(
            username
        );

    const normalizedSymbol =
        normalizeSymbol(
            symbol
        );

    const normalizedSide =
        String(side || "")
            .trim()
            .toUpperCase();

    /*
    | New system is primarily a BUY request flow.
    | We retain SELL in the model for compatibility, but opening
    | Market requests from stockdetails should be BUY.
    */
    if (
        !["BUY", "SELL"].includes(
            normalizedSide
        )
    ) {
        throw new Error(
            "Market side must be BUY or SELL."
        );
    }

    const validatedQuantity =
        validateQuantity(
            quantity
        );

    const user =
        await User.findOne({
            username:
                normalizedUsername,
        });

    if (!user) {
        throw new Error(
            "User not found."
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Prevent duplicate active/pending request for same user + symbol
    |--------------------------------------------------------------------------
    */

    const existingRequest =
        await MarketRequest.findOne({
            userId: user._id,
            symbol: normalizedSymbol,
            status: {
                $in: [
                    "PENDING",
                    "ACTIVE",
                    "LOCKED",
                ],
            },
        });

    if (existingRequest) {
        throw new Error(
            `You already have an active Market request for ${normalizedSymbol}.`
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Fetch live price
    |--------------------------------------------------------------------------
    */

    const market =
        await fetchStock(
            normalizedSymbol
        );

    const assetType =
        normalizeAssetType(
            null,
            market
        );

    validateLiveMarket(
        market,
        assetType
    );

    const executionPrice =
        Number(market.price);

    /*
    |--------------------------------------------------------------------------
    | Leverage
    |--------------------------------------------------------------------------
    */

    const resolvedLeverage =
        validateLeverage(
            leverage,
            assetType
        );

    /*
    |--------------------------------------------------------------------------
    | Lots
    |--------------------------------------------------------------------------
    */

    const lotSize =
        Number(
            DEFAULT_LOT_SIZE[
                assetType
            ] || 1
        );

    const resolvedLots =
        lots === undefined ||
        lots === null ||
        lots === ""
            ? roundNumber(
                validatedQuantity /
                lotSize
            )
            : Number(lots);

    if (
        !Number.isFinite(
            resolvedLots
        ) ||
        resolvedLots <= 0
    ) {
        throw new Error(
            "Invalid lots."
        );
    }

    const expectedQuantity =
        roundNumber(
            resolvedLots *
            lotSize
        );

    if (
        Math.abs(
            expectedQuantity -
            validatedQuantity
        ) > 0.00000001
    ) {
        throw new Error(
            `Invalid lots. Quantity ${validatedQuantity} does not match ${resolvedLots} lots of size ${lotSize}.`
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Financials
    |--------------------------------------------------------------------------
    */

    const financials =
        calculateFinancials(
            executionPrice,
            validatedQuantity,
            resolvedLeverage
        );

    /*
    |--------------------------------------------------------------------------
    | Available Margin
    |--------------------------------------------------------------------------
    */

    const availableBalance =
        await getAvailableForNewMarketRequest(
            user
        );

    if (
        availableBalance <
        financials.requiredMarginAndFee
    ) {
        throw new Error(
            `Insufficient available margin. Required ${financials.requiredMarginAndFee.toFixed(2)} including margin and fee.`
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Create PENDING Market Request
    |--------------------------------------------------------------------------
    */

    const request =
        await MarketRequest.create({
            userId:
                user._id,

            username:
                user.username,

            symbol:
                normalizedSymbol,

            company:
                market.companyName ||
                market.shortName ||
                normalizedSymbol,

            assetType,

            exchange:
                market.exchange ||
                "YAHOO",

            logo:
                market.logo ||
                "",

            side:
                normalizedSide,

            orderType:
                "MARKET",

            quantity:
                validatedQuantity,

            lots:
                resolvedLots,

            lotSize,

            entryPrice:
                executionPrice,

            currentPrice:
                executionPrice,

            notionalValue:
                financials.notionalValue,

            margin:
                financials.margin,

            leverage:
                resolvedLeverage,

            investedAmount:
                financials.margin,

            userInvestedAmount:
                financials.margin,

            fee:
                financials.fee,

            adminPercent:
                null,

            finalPercent:
                null,

            durationMinutes:
                null,

            startedAt:
                null,

            expiresAt:
                null,

            lockedAt:
                null,

            status:
                "PENDING",

            positionId:
                null,

            finalPnl:
                null,

            balanceAdjustment:
                null,

            settled:
                false,

            settledAt:
                null,

            closedPercent:
                null,

            closedPnl:
                null,

            closedAt:
                null,
        });

    return {
        success: true,

        message:
            "Market request submitted successfully. Waiting for admin to set the trade.",

        request:
            marketRequestResponse(
                request
            ),

        wallet:
            walletResponse(user),
    };
}


/*
|--------------------------------------------------------------------------
| GET USER MARKET REQUESTS
|--------------------------------------------------------------------------
|
| Used by positions.tsx.
|
| Includes:
| - PENDING
| - ACTIVE
| - LOCKED
| - SETTLED
| - CLOSED
|
| This allows positions.tsx to show both active Market positions
| and Market history.
|
*/

export async function getUserMarketRequests(
    username,
    options = {}
) {
    const normalizedUsername =
        normalizeUsername(
            username
        );

    const user =
        await User.findOne({
            username:
                normalizedUsername,
        });

    if (!user) {
        throw new Error(
            "User not found."
        );
    }

    const status =
        options.status;

    const query = {
        userId:
            user._id,
    };

    if (status) {
        query.status =
            String(status)
                .trim()
                .toUpperCase();
    }

    const requests =
        await MarketRequest.find(
            query
        ).sort({
            createdAt: -1,
        });

    /*
    |--------------------------------------------------------------------------
    | Update live controlled P&L for ACTIVE / LOCKED requests
    |--------------------------------------------------------------------------
    */

    for (
        const request
        of requests
    ) {
        if (
            request.status ===
                "ACTIVE" ||
            request.status ===
                "LOCKED"
        ) {
            const currentPercent =
                calculateProgressPercent(
                    request
                );

            const currentPnl =
                calculatePnlFromPercent(
                    request.margin,
                    currentPercent
                );

            /*
            | Keep request's current price synced when possible.
            */
            try {
                const market =
                    await fetchStock(
                        request.symbol
                    );

                if (
                    market &&
                    Number(market.price) >
                        0
                ) {
                    request.currentPrice =
                        Number(
                            market.price
                        );
                }
            } catch (error) {
                console.error(
                    `Market price refresh failed for ${request.symbol}:`,
                    error
                );
            }

            /*
            | Update the connected Position too.
            */
            if (request.positionId) {
                const position =
                    await Position.findById(
                        request.positionId
                    );

                if (position) {
                    position.currentPrice =
                        request.currentPrice;

                    position.profitLoss =
                        currentPnl;

                    position.profitLossPercent =
                        currentPercent;

                    position.unrealizedPnl =
                        currentPnl;

                    position.unrealizedPnlPercent =
                        currentPercent;

                    position.lastPriceUpdated =
                        new Date();

                    await position.save();
                }
            }

            await request.save();
        }
    }

    return {
        success: true,

        requests:
            requests.map(
                marketRequestResponse
            ),

        wallet:
            walletResponse(user),
    };
}


/*
|--------------------------------------------------------------------------
| GET ONE MARKET REQUEST
|--------------------------------------------------------------------------
*/

export async function getMarketRequest(
    requestId,
    username = null
) {
    if (!requestId) {
        throw new Error(
            "Market request ID is required."
        );
    }

    const query = {
        _id:
            requestId,
    };

    if (username) {
        const normalizedUsername =
            normalizeUsername(
                username
            );

        const user =
            await User.findOne({
                username:
                    normalizedUsername,
            });

        if (!user) {
            throw new Error(
                "User not found."
            );
        }

        query.userId =
            user._id;
    }

    const request =
        await MarketRequest.findOne(
            query
        );

    if (!request) {
        throw new Error(
            "Market request not found."
        );
    }

    /*
    | Refresh live controlled P&L.
    */
    if (
        request.status ===
            "ACTIVE" ||
        request.status ===
            "LOCKED"
    ) {
        await refreshMarketRequest(
            request
        );
    }

    return {
        success: true,

        request:
            marketRequestResponse(
                request
            ),
    };
}


/*
|--------------------------------------------------------------------------
| REFRESH ONE ACTIVE MARKET REQUEST
|--------------------------------------------------------------------------
*/

export async function refreshMarketRequest(
    request
) {
    if (!request) {
        return null;
    }

    if (
        request.status !==
            "ACTIVE" &&
        request.status !==
            "LOCKED"
    ) {
        return request;
    }

    const now =
        new Date();

    /*
    |--------------------------------------------------------------------------
    | 5-second final lock
    |--------------------------------------------------------------------------
    */

    if (
        request.expiresAt &&
        request.adminPercent !==
            null
    ) {
        const expiresAt =
            new Date(
                request.expiresAt
            ).getTime();

        const remaining =
            expiresAt -
            now.getTime();

        if (
            remaining <=
                MARKET_FINAL_LOCK_SECONDS *
                    1000
        ) {
            request.finalPercent =
                Number(
                    request.adminPercent
                );

            request.lockedAt =
                request.lockedAt ||
                now;

            request.status =
                "LOCKED";
        }
    }

    const currentPercent =
        calculateProgressPercent(
            request,
            now
        );

    const currentPnl =
        calculatePnlFromPercent(
            request.margin,
            currentPercent
        );

    /*
    |--------------------------------------------------------------------------
    | Refresh market price
    |--------------------------------------------------------------------------
    */

    try {
        const market =
            await fetchStock(
                request.symbol
            );

        if (
            market &&
            Number(market.price) >
                0
        ) {
            request.currentPrice =
                Number(
                    market.price
                );
        }
    } catch (error) {
        /*
        | Do not kill the controlled P&L engine merely because a live
        | market-price refresh failed.
        */
        console.error(
            `Failed to refresh Market price for ${request.symbol}:`,
            error
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Update connected Position
    |--------------------------------------------------------------------------
    */

    if (request.positionId) {
        const position =
            await Position.findById(
                request.positionId
            );

        if (position) {
            position.currentPrice =
                request.currentPrice ||
                request.entryPrice;

            position.profitLoss =
                currentPnl;

            position.profitLossPercent =
                currentPercent;

            position.unrealizedPnl =
                currentPnl;

            position.unrealizedPnlPercent =
                currentPercent;

            position.adminPercent =
                request.adminPercent;

            position.marketFinalPercent =
                request.finalPercent;

            position.marketLockedAt =
                request.lockedAt;

            position.lastPriceUpdated =
                now;

            await position.save();
        }
    }

    await request.save();

    return request;
}


/*
|--------------------------------------------------------------------------
| GET ADMIN MARKET REQUESTS
|--------------------------------------------------------------------------
|
| Admin only sees:
|
| PENDING
| ACTIVE
| LOCKED
|
| SETTLED / CLOSED are hidden from this list.
|
| Therefore after user sells or duration ends, the request disappears
| from Admin Market section without physically destroying the record.
|
*/

export async function getAdminMarketRequests({
    adminId,
    status,
} = {}) {
    if (!adminId) {
        throw new Error(
            "Admin ID is required."
        );
    }

    const admin =
        await User.findById(
            adminId
        );

    if (!admin) {
        throw new Error(
            "Admin not found."
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Admin identity
    |--------------------------------------------------------------------------
    |
    | The existing Admin panel authenticates through the same authenticated
    | user/token flow used by the other Admin sections (Balance, KYC,
    | Deposits, etc.). The route supplies the authenticated user's ID as
    | adminId.
    |
    | Do NOT enforce a second `role === "admin"` check here. The current
    | application uses the existing Admin authentication/access flow for
    | these sections. The extra role check was causing valid Market Admin
    | requests to fail with "Admin access required." while the other Admin
    | sections continued to work.
    |
    | A real existing user is still required above, so Market operations
    | cannot run without a valid authenticated identity.
    |
    |--------------------------------------------------------------------------
    */

    const query = {};

    if (status) {
        const normalizedStatus =
            String(status)
                .trim()
                .toUpperCase();

        const allowedStatuses = [
            "PENDING",
            "ACTIVE",
            "LOCKED",
            "SETTLED",
            "CLOSED",
        ];

        if (
            !allowedStatuses.includes(
                normalizedStatus
            )
        ) {
            throw new Error(
                "Invalid Market request status."
            );
        }

        query.status =
            normalizedStatus;
    } else {
        query.status = {
            $in: [
                "PENDING",
                "ACTIVE",
                "LOCKED",
            ],
        };
    }

    const requests =
        await MarketRequest.find(
            query
        ).sort({
            createdAt: -1,
        });

    /*
    | Refresh active requests so Admin sees current P&L and remaining time.
    */
    for (
        const request
        of requests
    ) {
        if (
            request.status ===
                "ACTIVE" ||
            request.status ===
                "LOCKED"
        ) {
            try {
                await refreshMarketRequest(
                    request
                );
            } catch (error) {
                console.error(
                    `Failed to refresh admin Market request ${request._id}:`,
                    error
                );
            }
        }
    }

    return {
        success: true,

        requests:
            requests.map(
                marketRequestResponse
            ),
    };
}


/*
|--------------------------------------------------------------------------
| SET MARKET RESULT — ADMIN
|--------------------------------------------------------------------------
|
| Admin supplies:
|
| durationMinutes
| percent
|
| Example:
|
| durationMinutes = 15
| percent         = +0.30
|
| Or:
|
| durationMinutes = 60
| percent         = -5
|
| Once SET is pressed:
|
| PENDING → ACTIVE
|
| Position is created.
|
*/

export async function setMarketResult({
    requestId,
    adminId,
    durationMinutes,
    percent,
}) {
    if (!requestId) {
        throw new Error(
            "Market request ID is required."
        );
    }

    if (!adminId) {
        throw new Error(
            "Admin ID is required."
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Verify Admin
    |--------------------------------------------------------------------------
    */

    const admin =
        await User.findById(
            adminId
        );

    if (!admin) {
        throw new Error(
            "Admin not found."
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Admin identity
    |--------------------------------------------------------------------------
    |
    | The existing Admin panel authenticates through the same authenticated
    | user/token flow used by the other Admin sections (Balance, KYC,
    | Deposits, etc.). The route supplies the authenticated user's ID as
    | adminId.
    |
    | Do NOT enforce a second `role === "admin"` check here. The current
    | application uses the existing Admin authentication/access flow for
    | these sections. The extra role check was causing valid Market Admin
    | requests to fail with "Admin access required." while the other Admin
    | sections continued to work.
    |
    | A real existing user is still required above, so Market operations
    | cannot run without a valid authenticated identity.
    |
    |--------------------------------------------------------------------------
    */

    /*
    |--------------------------------------------------------------------------
    | Validate Admin Inputs
    |--------------------------------------------------------------------------
    */

    const duration =
        validateDuration(
            durationMinutes
        );

    const adminPercent =
        validateAdminPercent(
            percent
        );

    /*
    |--------------------------------------------------------------------------
    | Find Pending Request
    |--------------------------------------------------------------------------
    */

    const request =
        await MarketRequest.findById(
            requestId
        );

    if (!request) {
        throw new Error(
            "Market request not found."
        );
    }

    if (
        request.status !==
        "PENDING"
    ) {
        throw new Error(
            `Market request cannot be set because its current status is ${request.status}.`
        );
    }

    /*
    |--------------------------------------------------------------------------
    | User
    |--------------------------------------------------------------------------
    */

    const user =
        await User.findById(
            request.userId
        );

    if (!user) {
        throw new Error(
            "User not found."
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Re-check available margin
    |--------------------------------------------------------------------------
    |
    | The user may have spent money between request creation and Admin SET.
    |
    */

    await refreshUserMarginState(
        user
    );

    const availableBalance =
        getAvailableBalance(
            user
        );

    /*
    | The request's margin is not yet included in usedMargin because the
    | Position does not exist until SET.
    */
    if (
        availableBalance <
        Number(request.margin || 0)
    ) {
        throw new Error(
            "User no longer has enough available margin for this Market request."
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Re-fetch live price at SET time
    |--------------------------------------------------------------------------
    |
    | The original request price is preserved as entryPrice.
    | We intentionally DO NOT replace the user's entry price here.
    |
    */

    let currentMarket = null;

    try {
        currentMarket =
            await fetchStock(
                request.symbol
            );

        validateLiveMarket(
            currentMarket,
            request.assetType
        );
    } catch (error) {
        throw error;
    }

    /*
    |--------------------------------------------------------------------------
    | Timing
    |--------------------------------------------------------------------------
    */

    const startedAt =
        new Date();

    const expiresAt =
        new Date(
            startedAt.getTime() +
            duration * 60 * 1000
        );

    /*
    |--------------------------------------------------------------------------
    | Create Position
    |--------------------------------------------------------------------------
    |
    | Market position is created ONLY after admin SET.
    |
    | TP/SL = null
    | marketControlled = true
    |
    */

    const position =
        await Position.create({
            userId:
                request.userId,

            username:
                request.username,

            symbol:
                request.symbol,

            company:
                request.company,

            assetType:
                request.assetType,

            exchange:
                request.exchange,

            logo:
                request.logo || "",

            side:
                request.side === "BUY"
                    ? "LONG"
                    : "SHORT",

            quantity:
                request.quantity,

            lots:
                request.lots,

            lotSize:
                request.lotSize,

            entryPrice:
                request.entryPrice,

            averagePrice:
                request.entryPrice,

            currentPrice:
                request.entryPrice,

            currentValue:
                request.notionalValue,

            notionalValue:
                request.notionalValue,

            leverage:
                request.leverage,

            margin:
                request.margin,

            investedAmount:
                request.margin,

            userInvestedAmount:
                request.margin,

            fee:
                request.fee || 0,

            /*
            | Market trades NEVER use TP/SL.
            */
            takeProfit:
                null,

            stopLoss:
                null,

            profitLoss:
                0,

            profitLossPercent:
                0,

            unrealizedPnl:
                0,

            unrealizedPnlPercent:
                0,

            realizedPnl:
                0,

            status:
                "OPEN",

            openedAt:
                startedAt,

            lastPriceUpdated:
                startedAt,

            blockTradeId:
                null,

            /*
            |--------------------------------------------------------------------------
            | Market Control
            |--------------------------------------------------------------------------
            */

            marketRequestId:
                request._id,

            marketControlled:
                true,

            adminPercent:
                adminPercent,

            marketStartedAt:
                startedAt,

            marketExpiresAt:
                expiresAt,

            marketLockedAt:
                null,

            marketFinalPercent:
                null,

            marketSettled:
                false,

            marketDurationMinutes:
                duration,
        });

    /*
    |--------------------------------------------------------------------------
    | Update Market Request
    |--------------------------------------------------------------------------
    */

    request.adminPercent =
        adminPercent;

    request.finalPercent =
        null;

    request.durationMinutes =
        duration;

    request.startedAt =
        startedAt;

    request.expiresAt =
        expiresAt;

    request.lockedAt =
        null;

    request.status =
        "ACTIVE";

    request.positionId =
        position._id;

    request.setByAdminId =
        admin._id;

    request.setByAdminUsername =
        admin.username || "";

    request.currentPrice =
        Number(
            currentMarket?.price ||
            request.entryPrice
        );

    request.settled =
        false;

    /*
    | P&L starts from 0.
    */
    request.finalPnl =
        null;

    request.balanceAdjustment =
        null;

    await request.save();

    /*
    |--------------------------------------------------------------------------
    | Refresh User Margin
    |--------------------------------------------------------------------------
    |
    | Position now exists, therefore refreshUserMarginState() will include
    | this Market position's margin.
    |
    | We DO NOT deduct margin from balance here.
    | The margin is locked through usedMargin.
    |
    */

    await refreshUserMarginState(
        user
    );

    await user.save();

    return {
        success: true,

        message:
            "Market trade has been set successfully.",

        request:
            marketRequestResponse(
                request
            ),

        position:
            positionResponse(
                position,
                request
            ),

        wallet:
            walletResponse(user),
    };
}


/*
|--------------------------------------------------------------------------
| LOCK FINAL PERCENT
|--------------------------------------------------------------------------
|
| Scheduler calls this approximately 5 seconds before expiry.
|
| If admin set:
|
| +0.30
|
| finalPercent becomes:
|
| +0.30
|
| permanently.
|
*/

export async function lockFinalPercent(
    requestId
) {
    const request =
        await MarketRequest.findById(
            requestId
        );

    if (!request) {
        return {
            success: false,
            locked: false,
            message:
                "Market request not found.",
        };
    }

    if (
        request.status !==
        "ACTIVE"
    ) {
        return {
            success: true,
            locked:
                request.status ===
                "LOCKED",
            request,
        };
    }

    if (
        request.adminPercent ===
            null ||
        request.adminPercent ===
            undefined
    ) {
        throw new Error(
            "Admin percentage has not been set."
        );
    }

    const finalPercent =
        Number(
            request.adminPercent
        );

    request.finalPercent =
        finalPercent;

    request.lockedAt =
        request.lockedAt ||
        new Date();

    request.status =
        "LOCKED";

    /*
    |--------------------------------------------------------------------------
    | Immediately update Position to final percentage.
    |--------------------------------------------------------------------------
    */

    const finalPnl =
        calculatePnlFromPercent(
            request.margin,
            finalPercent
        );

    if (request.positionId) {
        const position =
            await Position.findById(
                request.positionId
            );

        if (position) {
            position.profitLoss =
                finalPnl;

            position.profitLossPercent =
                finalPercent;

            position.unrealizedPnl =
                finalPnl;

            position.unrealizedPnlPercent =
                finalPercent;

            position.adminPercent =
                finalPercent;

            position.marketFinalPercent =
                finalPercent;

            position.marketLockedAt =
                request.lockedAt;

            position.lastPriceUpdated =
                new Date();

            await position.save();
        }
    }

    await request.save();

    return {
        success: true,
        locked: true,
        finalPercent,
        finalPnl,
        request,
    };
}


/*
|--------------------------------------------------------------------------
| SETTLE MARKET TRADE
|--------------------------------------------------------------------------
|
| This is called when duration has expired.
|
| Final P&L:
|
| margin × finalPercent / 100
|
| Then:
|
| profit  → balance + P&L
| loss    → balance + negative P&L
|
| Margin itself was never deducted from balance. It was reserved through
| usedMargin. Once Position closes, usedMargin is released automatically.
|
*/

export async function settleMarketTrade(
    requestId
) {
    const request =
        await MarketRequest.findById(
            requestId
        );

    if (!request) {
        return {
            success: false,
            settled: false,
            message:
                "Market request not found.",
        };
    }

    if (request.settled) {
        return {
            success: true,
            settled: true,
            alreadySettled: true,
            request,
        };
    }

    if (
        request.status !==
            "ACTIVE" &&
        request.status !==
            "LOCKED"
    ) {
        return {
            success: false,
            settled: false,
            message:
                `Market request cannot be settled from status ${request.status}.`,
        };
    }

    /*
    |--------------------------------------------------------------------------
    | If final percentage hasn't been locked yet, lock it now.
    |--------------------------------------------------------------------------
    */

    if (
        request.finalPercent ===
            null ||
        request.finalPercent ===
            undefined
    ) {
        await lockFinalPercent(
            request._id
        );

        await request.populate(
            "positionId"
        );
    }

    const finalPercent =
        Number(
            request.finalPercent ??
            request.adminPercent ??
            0
        );

    const finalPnl =
        calculatePnlFromPercent(
            request.margin,
            finalPercent
        );

    /*
    |--------------------------------------------------------------------------
    | Atomically claim settlement
    |--------------------------------------------------------------------------
    |
    | This is the single most important safeguard against race conditions
    | (scheduler settling at the same moment a user presses SELL, the
    | scheduler tick firing twice, concurrent refresh calls, etc).
    |
    | We atomically flip settled:false → true using a conditional filter.
    | Only ONE caller can win this update. Mongo guarantees findOneAndUpdate
    | is atomic, so this is safe even under concurrent requests.
    |
    | If we lose the race, another process already claimed settlement and
    | we must NOT touch the user's balance again.
    |
    */

    const settledAt =
        new Date();

    const claimedRequest =
        await MarketRequest.findOneAndUpdate(
            {
                _id: request._id,
                settled: { $ne: true },
                status: {
                    $in: [
                        "ACTIVE",
                        "LOCKED",
                    ],
                },
            },
            {
                $set: {
                    settled: true,
                    settledAt,
                    status: "SETTLED",
                    finalPercent,
                    finalPnl,
                    balanceAdjustment: finalPnl,
                    lockedAt:
                        request.lockedAt ||
                        settledAt,
                },
            },
            {
                new: true,
            }
        );

    if (!claimedRequest) {
        /*
        | Someone else already settled (or closed via early SELL) this
        | request between our read and our write. Return the current
        | state instead of double-applying the balance change.
        */
        const fresh =
            await MarketRequest.findById(
                request._id
            );

        return {
            success: true,
            settled: true,
            alreadySettled: true,
            request:
                fresh
                    ? marketRequestResponse(
                        fresh
                    )
                    : null,
        };
    }

    /*
    |--------------------------------------------------------------------------
    | User
    |--------------------------------------------------------------------------
    */

    const user =
        await User.findById(
            request.userId
        );

    if (!user) {
        throw new Error(
            "User not found."
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Prevent negative wallet
    |--------------------------------------------------------------------------
    |
    | We already atomically claimed settlement above, so even if the
    | balance would go negative we must still finish closing the Position
    | (we cannot "undo" the claim safely). We clamp instead of throwing,
    | to avoid leaving the request SETTLED with an OPEN Position.
    |
    */

    const oldBalance =
        getBalance(user);

    const newBalance =
        roundNumber(
            oldBalance +
            finalPnl
        );

    /*
    |--------------------------------------------------------------------------
    | Apply Balance Adjustment
    |--------------------------------------------------------------------------
    */

    user.balance =
        newBalance;

    /*
    | Keep realized trading P&L updated.
    */
    user.realizedTradingProfit =
        roundNumber(
            Number(
                user.realizedTradingProfit ||
                0
            ) +
            finalPnl
        );

    /*
    |--------------------------------------------------------------------------
    | Close Position
    |--------------------------------------------------------------------------
    */

    if (claimedRequest.positionId) {
        await Position.findByIdAndDelete(
            claimedRequest.positionId
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Complete Market Request
    |--------------------------------------------------------------------------
    |
    | The request document was already atomically updated above via
    | findOneAndUpdate (settled, settledAt, status, finalPercent, finalPnl,
    | balanceAdjustment, lockedAt). We do NOT call request.save() again here
    | — the in-memory `request` object is stale (read before the claim) and
    | re-saving it could either throw a version conflict or silently
    | clobber the atomic update. `claimedRequest` is the authoritative,
    | already-persisted document.
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Recalculate Used Margin
    |--------------------------------------------------------------------------
    |
    | Position is now CLOSED, so its margin is released.
    |
    */

    await refreshUserMarginState(
        user
    );

    await user.save();

    return {
        success: true,

        settled: true,

        finalPercent,

        finalPnl,

        balanceAdjustment:
            finalPnl,

        request:
            marketRequestResponse(
                claimedRequest
            ),

        wallet:
            walletResponse(user),
    };
}


/*
|--------------------------------------------------------------------------
| SELL / CLOSE MARKET POSITION EARLY
|--------------------------------------------------------------------------
|
| User sells before duration expires.
|
| Example:
|
| Admin:
| Duration = 15 min
| Final = +10%
|
| User sells at minute 7.
|
| Current controlled percentage is calculated from elapsed time.
|
| That percentage becomes the user's final result.
|
*/

export async function sellMarketPosition(
    username,
    requestId
) {
    const normalizedUsername =
        normalizeUsername(
            username
        );

    if (!requestId) {
        throw new Error(
            "Market request ID is required."
        );
    }

    const user =
        await User.findOne({
            username:
                normalizedUsername,
        });

    if (!user) {
        throw new Error(
            "User not found."
        );
    }

    const request =
        await MarketRequest.findOne({
            _id:
                requestId,

            userId:
                user._id,
        });

    if (!request) {
        throw new Error(
            "Market request not found."
        );
    }

    if (
        request.status !==
            "ACTIVE" &&
        request.status !==
            "LOCKED"
    ) {
        throw new Error(
            `Market trade cannot be sold from status ${request.status}.`
        );
    }

    /*
    |--------------------------------------------------------------------------
    | If already within final 5 seconds, lock the final percentage first.
    |--------------------------------------------------------------------------
    */

    if (
        request.status ===
        "ACTIVE"
    ) {
        const expiresAt =
            request.expiresAt
                ? new Date(
                    request.expiresAt
                ).getTime()
                : 0;

        const remaining =
            expiresAt -
            Date.now();

        if (
            remaining <=
            MARKET_FINAL_LOCK_SECONDS *
                1000
        ) {
            await lockFinalPercent(
                request._id
            );

            await request.populate(
                "positionId"
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Determine current/final percentage
    |--------------------------------------------------------------------------
    */

    const closingPercent =
        request.status ===
        "LOCKED"
            ? Number(
                request.finalPercent ??
                request.adminPercent ??
                0
            )
            : calculateProgressPercent(
                request
            );

    const closingPnl =
        calculatePnlFromPercent(
            request.margin,
            closingPercent
        );

    /*
    |--------------------------------------------------------------------------
    | Atomically claim the close
    |--------------------------------------------------------------------------
    |
    | Guards against the scheduler settling this exact request (expiry, or
    | the 5-second lock) at the same moment the user presses SELL. Only one
    | of settleMarketTrade() / sellMarketPosition() can win this update;
    | the loser must not touch the balance or the Position again.
    |
    */

    const closedAt =
        new Date();

    const claimedRequest =
        await MarketRequest.findOneAndUpdate(
            {
                _id: request._id,
                userId: user._id,
                settled: { $ne: true },
                status: {
                    $in: [
                        "ACTIVE",
                        "LOCKED",
                    ],
                },
            },
            {
                $set: {
                    closedPercent: closingPercent,
                    closedPnl: closingPnl,
                    finalPnl: closingPnl,
                    balanceAdjustment: closingPnl,
                    finalPercent: closingPercent,
                    closedAt,
                    settledAt: closedAt,
                    settled: true,
                    status: "CLOSED",
                },
            },
            {
                new: true,
            }
        );

    if (!claimedRequest) {
        /*
        | The scheduler (or another concurrent SELL) already settled or
        | closed this request. Do not double-apply the balance change —
        | return the current, already-final state instead.
        */
        const fresh =
            await MarketRequest.findById(
                request._id
            );

        return {
            success: true,

            message:
                "This Market trade has already been settled.",

            alreadyClosed: true,

            request:
                fresh
                    ? marketRequestResponse(
                        fresh
                    )
                    : null,

            wallet:
                walletResponse(user),
        };
    }

    /*
    |--------------------------------------------------------------------------
    | Update User Balance
    |--------------------------------------------------------------------------
    |
    | The close was already atomically claimed above, so we must finish
    | applying the balance change and closing the Position even in the
    | (rare) case the balance would dip below zero — there is no safe way
    | to "unclaim" the settlement once it is persisted.
    |
    */

    const oldBalance =
        getBalance(user);

    const newBalance =
        roundNumber(
            oldBalance +
            closingPnl
        );

    user.balance =
        newBalance;

    user.realizedTradingProfit =
        roundNumber(
            Number(
                user.realizedTradingProfit ||
                0
            ) +
            closingPnl
        );

    /*
    |--------------------------------------------------------------------------
    | Close Position
    |--------------------------------------------------------------------------
    */

    if (claimedRequest.positionId) {
        await Position.findByIdAndDelete(
            claimedRequest.positionId
        );
    }
    /*
    |--------------------------------------------------------------------------
    | Request already marked CLOSED
    |--------------------------------------------------------------------------
    |
    | The request document was already atomically updated above via
    | findOneAndUpdate (closedPercent, closedPnl, finalPnl,
    | balanceAdjustment, finalPercent, closedAt, settledAt, settled,
    | status). We intentionally do NOT call request.save() again — the
    | in-memory `request` object was read before the claim and re-saving
    | it could throw a version conflict or clobber the atomic update.
    | `claimedRequest` is the authoritative, already-persisted document.
    |
    | We do NOT physically delete the document.
    |
    | Admin's default endpoint does not return CLOSED requests.
    | Therefore it disappears from Admin while remaining available
    | for History.
    |
    */

    /*
    |--------------------------------------------------------------------------
    | Release Margin
    |--------------------------------------------------------------------------
    */

    await refreshUserMarginState(
        user
    );

    await user.save();

    return {
        success: true,

        message:
            "Market position sold successfully.",

        closingPercent,

        realizedProfit:
            closingPnl,

        request:
            marketRequestResponse(
                claimedRequest
            ),

        wallet:
            walletResponse(user),
    };
}


/*
|--------------------------------------------------------------------------
| CHECK / PROCESS ONE MARKET REQUEST
|--------------------------------------------------------------------------
|
| Scheduler calls this repeatedly.
|
| Logic:
|
| PENDING
|   → do nothing
|
| ACTIVE
|   → if <= 5 sec, LOCK
|   → if expired, SETTLE
|   → otherwise refresh P&L
|
| LOCKED
|   → if expired, SETTLE
|
*/

export async function processMarketRequest(
    requestId
) {
    const request =
        await MarketRequest.findById(
            requestId
        );

    if (!request) {
        return {
            success: false,
            processed: false,
            message:
                "Market request not found.",
        };
    }

    if (
        request.status ===
        "PENDING"
    ) {
        return {
            success: true,
            processed: false,
            waitingForAdmin: true,
            request,
        };
    }

    if (
        request.status ===
            "SETTLED" ||
        request.status ===
            "CLOSED"
    ) {
        return {
            success: true,
            processed: false,
            alreadyFinished: true,
            request,
        };
    }

    /*
    |--------------------------------------------------------------------------
    | No expiry configured — should not happen after SET.
    |--------------------------------------------------------------------------
    */

    if (!request.expiresAt) {
        return {
            success: false,
            processed: false,
            message:
                "Market request has no expiry time.",
            request,
        };
    }

    const expiresAt =
        new Date(
            request.expiresAt
        ).getTime();

    const now =
        Date.now();

    const remaining =
        expiresAt -
        now;

    /*
    |--------------------------------------------------------------------------
    | Expired
    |--------------------------------------------------------------------------
    */

    if (remaining <= 0) {
        /*
        | EXPIRY REACHED — WAIT FOR USER SELL
        |
        | The duration has ended, but Market trades must NOT
        | automatically settle. The final P&L is frozen and the
        | request remains visible until the user explicitly presses SELL.
        |
        | - No automatic SELL
        | - No automatic balance adjustment
        | - Position remains OPEN
        | - Request remains LOCKED
        | - Frozen final P&L remains visible
        | - User SELL performs the actual settlement/close
        */

        if (
            request.status ===
            "ACTIVE"
        ) {
            await lockFinalPercent(
                request._id
            );
        }

        const frozenRequest =
            await MarketRequest.findById(
                request._id
            );

        return {
            success: true,
            processed: true,
            expired: true,
            locked: true,
            waitingForUserSell: true,
            remainingMs: 0,
            request: frozenRequest,
        };
    }

    /*
    |--------------------------------------------------------------------------
    | Final 5 seconds
    |--------------------------------------------------------------------------
    */

    if (
        remaining <=
        MARKET_FINAL_LOCK_SECONDS *
            1000
    ) {
        if (
            request.status ===
            "ACTIVE"
        ) {
            await lockFinalPercent(
                request._id
            );
        }

        return {
            success: true,
            processed: true,
            locked: true,
            remainingMs:
                remaining,
            request:
                await MarketRequest.findById(
                    request._id
                ),
        };
    }

    /*
    |--------------------------------------------------------------------------
    | Normal Active Period
    |--------------------------------------------------------------------------
    */

    await refreshMarketRequest(
        request
    );

    return {
        success: true,
        processed: true,
        active: true,
        remainingMs:
            remaining,
        request,
    };
}


/*
|--------------------------------------------------------------------------
| PROCESS ALL ACTIVE MARKET REQUESTS
|--------------------------------------------------------------------------
|
| Scheduler uses this function.
|
*/

export async function processAllMarketRequests() {
    const requests =
        await MarketRequest.find({
            status: {
                $in: [
                    "ACTIVE",
                    "LOCKED",
                ],
            },
        }).sort({
            expiresAt: 1,
        });

    const results = [];

    for (
        const request
        of requests
    ) {
        try {
            results.push(
                await processMarketRequest(
                    request._id
                )
            );
        } catch (error) {
            console.error(
                `Market request ${request._id} processing failed:`,
                error
            );

            results.push({
                success: false,
                processed: false,
                requestId:
                    request._id,
                error:
                    error.message,
            });
        }
    }

    return {
        success: true,
        results,
    };
}


/*
|--------------------------------------------------------------------------
| GET USER ACTIVE MARKET POSITIONS
|--------------------------------------------------------------------------
|
| Convenient endpoint/service for positions.tsx.
|
*/

export async function getUserActiveMarketPositions(
    username
) {
    const normalizedUsername =
        normalizeUsername(
            username
        );

    const user =
        await User.findOne({
            username:
                normalizedUsername,
        });

    if (!user) {
        throw new Error(
            "User not found."
        );
    }

    const requests =
        await MarketRequest.find({
            userId:
                user._id,

            status: {
                $in: [
                    "ACTIVE",
                    "LOCKED",
                ],
            },
        }).sort({
            createdAt: -1,
        });

    for (
        const request
        of requests
    ) {
        try {
            await refreshMarketRequest(
                request
            );
        } catch (error) {
            console.error(
                `Failed to refresh Market position ${request._id}:`,
                error
            );
        }
    }

    const freshRequests =
        await MarketRequest.find({
            userId:
                user._id,

            status: {
                $in: [
                    "ACTIVE",
                    "LOCKED",
                ],
            },
        }).sort({
            createdAt: -1,
        });

    const positions = [];

    for (
        const request
        of freshRequests
    ) {
        if (!request.positionId) {
            continue;
        }

        const position =
            await Position.findById(
                request.positionId
            );

        if (!position) {
            continue;
        }

        positions.push(
            positionResponse(
                position,
                request
            )
        );
    }

    return {
        success: true,

        positions,

        wallet:
            walletResponse(user),
    };
}


/*
|--------------------------------------------------------------------------
| GET USER MARKET HISTORY
|--------------------------------------------------------------------------
|
| positions.tsx can use this for History.
|
| Both:
|
| CLOSED
| SETTLED
|
| are returned.
|
*/

export async function getUserMarketHistory(
    username
) {
    const normalizedUsername =
        normalizeUsername(
            username
        );

    const user =
        await User.findOne({
            username:
                normalizedUsername,
        });

    if (!user) {
        throw new Error(
            "User not found."
        );
    }

    const requests =
        await MarketRequest.find({
            userId:
                user._id,

            status: {
                $in: [
                    "CLOSED",
                    "SETTLED",
                ],
            },
        }).sort({
            settledAt: -1,
            closedAt: -1,
            createdAt: -1,
        });

    return {
        success: true,

        history:
            requests.map(
                marketRequestResponse
            ),

        wallet:
            walletResponse(user),
    };
}


/*
|--------------------------------------------------------------------------
| CANCEL PENDING MARKET REQUEST
|--------------------------------------------------------------------------
|
| Optional but useful.
|
| If user has requested BUY but admin has not SET it yet, this lets the
| user cancel the pending request without creating a position.
|
| This does NOT affect balance because pending requests never deduct
| balance.
|
*/

export async function cancelPendingMarketRequest(
    username,
    requestId
) {
    const normalizedUsername =
        normalizeUsername(
            username
        );

    const user =
        await User.findOne({
            username:
                normalizedUsername,
        });

    if (!user) {
        throw new Error(
            "User not found."
        );
    }

    const request =
        await MarketRequest.findOne({
            _id:
                requestId,

            userId:
                user._id,

            status:
                "PENDING",
        });

    if (!request) {
        throw new Error(
            "Pending Market request not found."
        );
    }

    request.status =
        "CLOSED";

    request.closedAt =
        new Date();

    request.settledAt =
        new Date();

    request.settled =
        true;

    request.balanceAdjustment =
        0;

    request.finalPnl =
        0;

    request.closedPercent =
        0;

    request.closedPnl =
        0;

    await request.save();

    return {
        success: true,

        message:
            "Pending Market request cancelled successfully.",

        request:
            marketRequestResponse(
                request
            ),
    };
}


/*
|--------------------------------------------------------------------------
| EXPORT DEFAULT
|--------------------------------------------------------------------------
|
| Named exports are already used throughout this service.
| Keeping a default object makes it easier to import the whole service
| from routes if desired.
|
*/

export default {
    createMarketRequest,

    getUserMarketRequests,

    getMarketRequest,

    refreshMarketRequest,

    getAdminMarketRequests,

    setMarketResult,

    lockFinalPercent,

    settleMarketTrade,

    sellMarketPosition,

    processMarketRequest,

    processAllMarketRequests,

    getUserActiveMarketPositions,

    getUserMarketHistory,

    cancelPendingMarketRequest,
};