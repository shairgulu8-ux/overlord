import User from "../models/User.js";
import Position from "../models/Position.js";
import Order from "../models/Order.js";
import MarketRequest from "../models/MarketRequest.js";
import { fetchStock } from "./yahooService.js";
import {
    createMarketRequest,
    sellMarketPosition,
    getUserMarketRequests,
    getUserActiveMarketPositions,
    getUserMarketHistory,
    getMarketRequest,
    getAdminMarketRequests,
    setMarketResult,
    lockFinalPercent,
    settleMarketTrade,
    processMarketRequest,
    processAllMarketRequests,
    cancelPendingMarketRequest,
} from "./marketTradeService.js";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

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
    const qty = Number(quantity);

    if (
        !Number.isFinite(qty) ||
        Number.isNaN(qty) ||
        qty <= 0
    ) {
        throw new Error("Invalid quantity.");
    }

    return qty;
}

/*
|--------------------------------------------------------------------------
| Position Direction Helpers
|--------------------------------------------------------------------------
|
| Order side and Position side intentionally use different vocabularies:
|
|   BUY  order  -> LONG  position
|   SELL order  -> SHORT position
|
| The Position model stores only LONG / SHORT. These helpers keep all
| trading calculations in BUY / SELL terms while safely supporting legacy
| documents that may still contain BUY / SELL in `position.side`.
|
*/

function orderSideToPositionSide(side) {
    const normalized =
        String(side || "").trim().toUpperCase();

    if (
        normalized === "BUY" ||
        normalized === "LONG"
    ) {
        return "LONG";
    }

    if (
        normalized === "SELL" ||
        normalized === "SHORT"
    ) {
        return "SHORT";
    }

    throw new Error(
        "Invalid position direction. Expected BUY/SELL or LONG/SHORT."
    );
}

function positionSideToOrderSide(
    side,
    fallback = "BUY"
) {
    const normalized =
        String(side || "").trim().toUpperCase();

    if (
        normalized === "LONG" ||
        normalized === "BUY"
    ) {
        return "BUY";
    }

    if (
        normalized === "SHORT" ||
        normalized === "SELL"
    ) {
        return "SELL";
    }

    return fallback;
}

function normalizeStoredPositionSide(position) {
    if (!position) {
        return position;
    }

    const normalized =
        orderSideToPositionSide(
            position.side || "LONG"
        );

    if (position.side !== normalized) {
        position.side = normalized;
    }

    return position;
}

/*
|--------------------------------------------------------------------------
| Exchange Helper
|--------------------------------------------------------------------------
*/

function normalizeExchange(stock, symbol) {
    if (
        symbol &&
        symbol.endsWith(".BO")
    ) {
        return "BSE";
    }

    if (
        stock &&
        stock.exchange === "BSE"
    ) {
        return "BSE";
    }

    return "NSE";
}

/*
|--------------------------------------------------------------------------
| Regular Position Filter
|--------------------------------------------------------------------------
|
| IMPORTANT:
|
| Block Trade positions have blockTradeId.
|
| Normal stock trading must NEVER pick a Block Trade position.
|
| Normal positions have:
|
| blockTradeId = null
|
*/

function regularPositionFilter(
    userId,
    symbol
) {
    return {
        userId,
        symbol,
        blockTradeId: null,
    };
}

/*
|--------------------------------------------------------------------------
| Live Stock Validation
|--------------------------------------------------------------------------
|
| Ensures the stock exists BEFORE any of its properties are accessed.
|
*/

function validateLiveStock(stock, assetType = null) {
    if (!stock) {
        throw new Error("Unable to fetch market asset.");
    }

    const resolvedAssetType = String(
        assetType || stock.assetType || "STOCK"
    ).trim().toUpperCase();

    const skipMarketCheck =
        String(process.env.SKIP_MARKET_CHECK || "").toLowerCase() === "true";

    if (!skipMarketCheck) {
        if (resolvedAssetType === "CRYPTO") {
            // Crypto trades 24/7. Do not apply weekend or Indian
            // stock-hours restrictions to crypto.
        } else {
            // Determine current day/time in Asia/Kolkata for all
            // non-crypto assets (weekend rule applies to all of them).
            const now = new Date();

            const indiaTime = new Date(
                now.toLocaleString("en-US", {
                    timeZone: "Asia/Kolkata",
                })
            );

            const day = indiaTime.getDay();

            const isWeekend = day === 0 || day === 6;

            if (isWeekend) {
                throw new Error("Market is currently closed.");
            }

            // Respect explicit Yahoo marketState information for
            // non-crypto assets.
            if (
                stock.marketState &&
                String(stock.marketState).toUpperCase() === "CLOSED"
            ) {
                throw new Error("Market is currently closed.");
            }

            if (resolvedAssetType === "STOCK") {
                const symbol = String(
                    stock.symbol || stock.ticker || ""
                ).trim().toUpperCase();

                const exchange = String(
                    stock.exchange || ""
                ).trim().toUpperCase();

                const isIndianStock =
                    exchange.includes("NSE") ||
                    exchange.includes("BSE") ||
                    symbol.endsWith(".NS") ||
                    symbol.endsWith(".BO");

                if (isIndianStock) {
                    const hour = indiaTime.getHours();
                    const minute = indiaTime.getMinutes();
                    const currentMinutes = hour * 60 + minute;

                    const marketOpen = 9 * 60 + 15;
                    const marketClose = 15 * 60 + 30;

                    if (
                        currentMinutes < marketOpen ||
                        currentMinutes > marketClose
                    ) {
                        throw new Error("Market is currently closed.");
                    }
                }
            }

            // For FOREX, METAL, OIL, INDEX and any other non-crypto,
            // non-Indian-stock asset type, the weekend rule and the
            // Yahoo marketState check above already apply. Indian
            // 09:15-15:30 hours are intentionally NOT applied here.
        }
    }

    if (!Number.isFinite(Number(stock.price)) || Number(stock.price) <= 0) {
        throw new Error("Invalid live market price.");
    }
}

/*
|--------------------------------------------------------------------------
| Update Position Values
|--------------------------------------------------------------------------
*/

function roundMoney(value, decimals = 8) {
    return Number(
        Number(value || 0).toFixed(decimals)
    );
}

function getUserBalance(user) {
    return roundMoney(user?.balance || 0);
}

function getUserUsedMargin(user) {
    return roundMoney(user?.usedMargin || 0);
}

function getUserAvailableBalance(user) {
    return roundMoney(
        getUserBalance(user) -
        getUserUsedMargin(user)
    );
}

async function refreshUserMarginState(user) {
    const openPositions = await Position.find({
        userId: user._id,
        blockTradeId: null,
        status: "OPEN",
    }).select("margin investedAmount");

    const usedMargin = roundMoney(
        openPositions.reduce(
            (total, position) =>
                total +
                Number(
                    position.margin ??
                    position.investedAmount ??
                    0
                ),
            0
        )
    );

    const balance = getUserBalance(user);

    user.usedMargin = usedMargin;
    user.availableBalance = roundMoney(
        balance - usedMargin
    );

    return {
        balance,
        usedMargin,
        availableBalance: getUserAvailableBalance(user),
    };
}

async function saveUserWithMarginState(user) {
    const wallet = await refreshUserMarginState(user);
    await user.save();
    return wallet;
}

function walletResponse(user) {
    return {
        balance: getUserBalance(user),
        usedMargin: getUserUsedMargin(user),
        availableBalance: getUserAvailableBalance(user),
    };
}

function getCurrencySymbol(assetType) {
    return String(assetType || "STOCK").toUpperCase() === "STOCK"
        ? "₹"
        : "$";
}

function updatePosition(
    position,
    currentPrice
) {
    position.currentPrice =
        currentPrice;

    position.currentValue =
        Number(
            (
                position.quantity *
                currentPrice
            ).toFixed(2)
        );

    position.profitLoss =
        Number(
            (
                position.currentValue -
                position.investedAmount
            ).toFixed(2)
        );

    position.profitLossPercent =
        position.investedAmount === 0
            ? 0
            : Number(
                (
                    (
                        position.profitLoss /
                        position.investedAmount
                    ) *
                    100
                ).toFixed(2)
            );

    position.lastPriceUpdated =
        new Date();

    return position;
}

/*
|--------------------------------------------------------------------------
| BUY STOCK
|--------------------------------------------------------------------------
*/

export async function buyStock(
    username,
    symbol,
    quantity
) {
    username = normalizeUsername(username);
    symbol = normalizeSymbol(symbol);
    quantity = validateQuantity(quantity);

    const user = await User.findOne({ username });

    if (!user) {
        throw new Error("User not found.");
    }

    const stock = await fetchStock(symbol);
    validateLiveStock(stock);

    const totalAmount = Number(
        (stock.price * quantity).toFixed(2)
    );

    const currentBalance = Number(user.balance || 0);
    const updatedBalance = Number(
        (currentBalance - totalAmount).toFixed(2)
    );

    if (updatedBalance < 0) {
        throw new Error(
            `Insufficient balance. Required ₹${totalAmount}`
        );
    }

    let position = await Position.findOne(
        regularPositionFilter(user._id, symbol)
    );

    if (!position) {
        position = new Position({
            userId: user._id,
            username: user.username,
            symbol,
            company: stock.companyName || symbol,
            exchange: normalizeExchange(stock, symbol),
            logo: stock.logo || "",
            quantity,
            averagePrice: stock.price,
            investedAmount: totalAmount,
            blockTradeId: null,
        });

        updatePosition(position, stock.price);
    } else {
        const updatedQuantity = position.quantity + quantity;
        const updatedInvestment = position.investedAmount + totalAmount;
        const updatedAveragePrice = updatedInvestment / updatedQuantity;

        position.quantity = updatedQuantity;
        position.averagePrice = Number(updatedAveragePrice.toFixed(2));
        position.investedAmount = Number(updatedInvestment.toFixed(2));

        updatePosition(position, stock.price);
    }

    if (position.quantity <= 0) {
        throw new Error("Invalid position quantity.");
    }

    await position.save();

    await Order.create({
        userId: user._id,
        username: user.username,
        symbol,
        company: stock.companyName || symbol,
        exchange: normalizeExchange(stock, symbol),
        type: "BUY",
        quantity,
        price: stock.price,
        totalAmount,
        averageBuyPrice: stock.price,
        realizedProfit: 0,
    });

    user.balance = updatedBalance;
    await saveUserWithMarginState(user);

    return {
        success: true,
        message: "Stock purchased successfully.",
        order: {
            type: "BUY",
            symbol: position.symbol,
            company: position.company,
            exchange: position.exchange,
            quantity,
            price: stock.price,
            totalAmount,
            orderTime: new Date(),
        },
        position: {
            symbol: position.symbol,
            company: position.company,
            quantity: position.quantity,
            averagePrice: position.averagePrice,
            investedAmount: position.investedAmount,
            currentPrice: position.currentPrice,
            currentValue: position.currentValue,
            profitLoss: position.profitLoss,
            profitLossPercent: position.profitLossPercent,
        },
        wallet: walletResponse(user),
    };
}

/*
|--------------------------------------------------------------------------
| SELL STOCK
|--------------------------------------------------------------------------
*/

export async function sellStock(
    username,
    symbol,
    quantity
) {
    username = normalizeUsername(username);
    symbol = normalizeSymbol(symbol);
    quantity = validateQuantity(quantity);

    const user = await User.findOne({ username });

    if (!user) {
        throw new Error("User not found.");
    }

    const position = await Position.findOne(
        regularPositionFilter(user._id, symbol)
    );

    if (!position) {
        throw new Error("You don't own this stock.");
    }

    if (quantity > position.quantity) {
        throw new Error(
            `You only own ${position.quantity} shares.`
        );
    }

    const stock = await fetchStock(symbol);
    validateLiveStock(stock);

    const sellAmount = Number(
        (stock.price * quantity).toFixed(2)
    );

    const averageCost = Number(
        Number(position.averagePrice).toFixed(2)
    );

    const soldInvestment = Number(
        (averageCost * quantity).toFixed(2)
    );

    const realizedProfit = Number(
        (sellAmount - soldInvestment).toFixed(2)
    );

    const remainingQuantity = position.quantity - quantity;

    if (remainingQuantity === 0) {
        await Position.deleteOne({ _id: position._id });
    } else {
        position.quantity = remainingQuantity;
        position.investedAmount = Number(
            (position.averagePrice * remainingQuantity).toFixed(2)
        );

        updatePosition(position, stock.price);
        await position.save();
    }

    await Order.create({
        userId: user._id,
        username: user.username,
        symbol,
        company: stock.companyName || symbol,
        exchange: normalizeExchange(stock, symbol),
        type: "SELL",
        quantity,
        price: stock.price,
        totalAmount: sellAmount,
        averageBuyPrice: averageCost,
        realizedProfit,
    });

    const currentBalance = Number(user.balance || 0);
    const updatedBalance = Number(
        (currentBalance + sellAmount).toFixed(2)
    );

    if (updatedBalance < 0) {
        throw new Error("Wallet balance became invalid.");
    }

    user.balance = updatedBalance;
    await saveUserWithMarginState(user);

    return {
        success: true,
        message: "Stock sold successfully.",
        order: {
            type: "SELL",
            symbol,
            company: position.company,
            exchange: position.exchange,
            quantity,
            sellPrice: stock.price,
            averageBuyPrice: averageCost,
            sellAmount,
            realizedProfit,
            orderTime: new Date(),
        },
        wallet: walletResponse(user),
        remainingPosition:
            remainingQuantity === 0
                ? null
                : {
                    symbol: position.symbol,
                    company: position.company,
                    quantity: position.quantity,
                    averagePrice: position.averagePrice,
                    investedAmount: position.investedAmount,
                    currentPrice: position.currentPrice,
                    currentValue: position.currentValue,
                    profitLoss: position.profitLoss,
                    profitLossPercent: position.profitLossPercent,
                },
    };
}

/*
|--------------------------------------------------------------------------
| Leveraged Trading Configuration
|--------------------------------------------------------------------------
*/

const LEVERAGED_ASSETS = new Set([
    "FOREX",
    "METAL",
    "OIL",
    "CRYPTO",
    "INDEX",
]);

const MAX_LEVERAGE = {
    STOCK: 1,
    FOREX: 500,
    METAL: 100,
    OIL: 100,
    CRYPTO: 50,
    INDEX: 100,
};

const DEFAULT_LOT_SIZE = {
    STOCK: 1,
    FOREX: 10,
    METAL: 1,
    OIL: 1,
    CRYPTO: 1,
    INDEX: 1,
};

const DEFAULT_FEE_RATE = {
    STOCK: 0,
    FOREX: 0,
    METAL: 0,
    OIL: 0,
    CRYPTO: 0,
    INDEX: 0,
};

function normalizeAssetType(assetType, market) {
    const value = String(
        assetType || market?.assetType || "STOCK"
    ).trim().toUpperCase();

    return [
        "STOCK",
        "FOREX",
        "METAL",
        "OIL",
        "CRYPTO",
        "INDEX",
    ].includes(value)
        ? value
        : "STOCK";
}

function validateTradingLeverage(value, assetType) {
    const leverage =
        value === undefined ||
            value === null ||
            value === ""
            ? 1
            : Number(value);

    if (!Number.isFinite(leverage) || leverage < 1) {
        throw new Error("Invalid leverage.");
    }

    const maximum = MAX_LEVERAGE[assetType] || 1;

    if (leverage > maximum) {
        throw new Error(
            `Maximum allowed leverage for ${assetType} is ${maximum}X.`
        );
    }

    return leverage;
}

function optionalPrice(value, fieldName) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const price = Number(value);

    if (!Number.isFinite(price) || price <= 0) {
        throw new Error(`Invalid ${fieldName} price.`);
    }

    return price;
}

function validateTPSL(side, entryPrice, takeProfit, stopLoss) {
    const tp = optionalPrice(takeProfit, "take-profit");
    const sl = optionalPrice(stopLoss, "stop-loss");

    if (side === "BUY") {
        if (tp !== null && tp <= entryPrice) {
            throw new Error(
                "For BUY, take-profit must be above the entry price."
            );
        }

        if (sl !== null && sl >= entryPrice) {
            throw new Error(
                "For BUY, stop-loss must be below the entry price."
            );
        }
    } else {
        if (tp !== null && tp >= entryPrice) {
            throw new Error(
                "For SELL, take-profit must be below the entry price."
            );
        }

        if (sl !== null && sl <= entryPrice) {
            throw new Error(
                "For SELL, stop-loss must be above the entry price."
            );
        }
    }

    return {
        takeProfit: tp,
        stopLoss: sl,
    };
}

function calculateOrderFinancials(
    price,
    quantity,
    leverage,
    feeRate
) {
    const notionalValue = Number(
        (Number(price) * Number(quantity)).toFixed(8)
    );

    const margin = Number(
        (notionalValue / Number(leverage)).toFixed(8)
    );

    const fee = Number(
        (notionalValue * Number(feeRate)).toFixed(8)
    );

    return {
        notionalValue,
        margin,
        fee,
        requiredMarginAndFee: Number(
            (margin + fee).toFixed(8)
        ),
    };
}

function calculatePositionPnL(
    side,
    entryPrice,
    currentPrice,
    quantity
) {
    const orderSide =
        positionSideToOrderSide(side);

    const direction =
        orderSide === "SELL"
            ? -1
            : 1;

    return Number(
        (
            (Number(currentPrice) - Number(entryPrice)) *
            Number(quantity) *
            direction
        ).toFixed(8)
    );
}

function shouldTakeProfit(
    side,
    currentPrice,
    takeProfit
) {
    if (takeProfit === null || takeProfit === undefined) {
        return false;
    }

    const orderSide =
        positionSideToOrderSide(side);

    return orderSide === "SELL"
        ? currentPrice <= takeProfit
        : currentPrice >= takeProfit;
}

function shouldStopLoss(
    side,
    currentPrice,
    stopLoss
) {
    if (stopLoss === null || stopLoss === undefined) {
        return false;
    }

    const orderSide =
        positionSideToOrderSide(side);

    return orderSide === "SELL"
        ? currentPrice >= stopLoss
        : currentPrice <= stopLoss;
}

function updateLeveragedPositionValues(
    position,
    currentPrice
) {
    const entryPrice = Number(
        position.entryPrice ??
        position.averagePrice ??
        0
    );

    const quantity = Number(
        position.quantity || 0
    );

    normalizeStoredPositionSide(position);

    const pnl = calculatePositionPnL(
        position.side,
        entryPrice,
        currentPrice,
        quantity
    );

    const margin = Number(
        position.margin ??
        position.investedAmount ??
        0
    );

    position.currentPrice = Number(currentPrice);
    position.currentValue = Number(
        (Number(currentPrice) * quantity).toFixed(8)
    );
    position.profitLoss = pnl;
    position.profitLossPercent =
        margin > 0
            ? Number(((pnl / margin) * 100).toFixed(4))
            : 0;

    if ("unrealizedProfit" in position) {
        position.unrealizedProfit = pnl;
    }

    position.lastPriceUpdated = new Date();

    return position;
}

/*
|--------------------------------------------------------------------------
| CREATE TRADING ORDER
|--------------------------------------------------------------------------
*/

export async function createTradingOrder({
    username,
    symbol,
    side,
    quantity,
    lots,
    leverage,
    orderType = "MARKET",
    price,
    takeProfit,
    stopLoss,
    marketRequestId,
}) {
    const normalizedUsername = normalizeUsername(username);
    const normalizedSymbol = normalizeSymbol(symbol);
    const normalizedSide = String(side || "").trim().toUpperCase();
    const normalizedOrderType =
        String(orderType || "MARKET").trim().toUpperCase();

    /*
    |--------------------------------------------------------------------------
    | ADMIN-CONTROLLED MARKET FLOW
    |--------------------------------------------------------------------------
    |
    | MARKET BUY is submitted to MarketRequest and waits for Admin SET.
    | MARKET SELL closes an active MarketRequest.
    | LIMIT continues through the existing legacy code below.
    | TP/SL are therefore never used by the new Market workflow.
    |--------------------------------------------------------------------------
    */
    if (normalizedOrderType === "MARKET") {
        if (normalizedSide === "BUY") {
            return await createMarketRequest({
                username: normalizedUsername,
                symbol: normalizedSymbol,
                side: "BUY",
                quantity,
                lots,
                leverage,
            });
        }

        if (normalizedSide === "SELL") {
            let resolvedMarketRequestId = marketRequestId || null;

            if (!resolvedMarketRequestId) {
                const user = await User.findOne({
                    username: normalizedUsername,
                });

                if (!user) {
                    throw new Error("User not found.");
                }

                const activeRequests = await MarketRequest.find({
                    userId: user._id,
                    symbol: normalizedSymbol,
                    status: {
                        $in: ["ACTIVE", "LOCKED"],
                    },
                })
                    .sort({ createdAt: -1 })
                    .limit(2);

                if (activeRequests.length === 1) {
                    resolvedMarketRequestId = activeRequests[0]._id;
                } else if (activeRequests.length > 1) {
                    throw new Error(
                        "Multiple active Market trades found for this symbol. Please provide marketRequestId."
                    );
                }
            }

            if (!resolvedMarketRequestId) {
                throw new Error(
                    "Active Market trade not found. Please provide marketRequestId."
                );
            }

            return await sellMarketPosition(
                normalizedUsername,
                resolvedMarketRequestId
            );
        }

        throw new Error("Market side must be BUY or SELL.");
    }

    if (!["BUY", "SELL"].includes(normalizedSide)) {
        throw new Error("Order side must be BUY or SELL.");
    }

    if (!["MARKET", "LIMIT"].includes(normalizedOrderType)) {
        throw new Error("Order type must be MARKET or LIMIT.");
    }

    const validatedQuantity = validateQuantity(quantity);

    const user = await User.findOne({
        username: normalizedUsername,
    });

    if (!user) {
        throw new Error("User not found.");
    }

    await refreshUserMarginState(user);

    const market = await fetchStock(normalizedSymbol);
    const assetType = normalizeAssetType(null, market);

    validateLiveStock(market, assetType);

    const resolvedLeverage =
        validateTradingLeverage(leverage, assetType);

    const lotSize =
        Number(DEFAULT_LOT_SIZE[assetType] || 1);

    const resolvedLots =
        lots === undefined ||
            lots === null ||
            lots === ""
            ? Number(
                (validatedQuantity / lotSize).toFixed(8)
            )
            : Number(lots);

    if (!Number.isFinite(resolvedLots) || resolvedLots <= 0) {
        throw new Error("Invalid lots.");
    }

    const expectedQuantityFromLots =
        roundMoney(resolvedLots * lotSize);

    if (
        Math.abs(
            expectedQuantityFromLots -
            validatedQuantity
        ) > 0.00000001
    ) {
        throw new Error(
            `Invalid lots. Quantity ${validatedQuantity} does not match ${resolvedLots} lots of size ${lotSize}.`
        );
    }

    const feeRate =
        Number(DEFAULT_FEE_RATE[assetType] || 0);

    const requestedPrice =
        normalizedOrderType === "LIMIT"
            ? optionalPrice(price, "limit")
            : Number(market.price);

    if (
        normalizedOrderType === "LIMIT" &&
        requestedPrice === null
    ) {
        throw new Error("Limit order price is required.");
    }

    const tpSl = validateTPSL(
        normalizedSide,
        requestedPrice,
        takeProfit,
        stopLoss
    );

    const financials = calculateOrderFinancials(
        requestedPrice,
        validatedQuantity,
        resolvedLeverage,
        feeRate
    );

    const balance = Number(user.balance || 0);

    if (
        normalizedOrderType === "LIMIT"
    ) {
        const availableBalance =
            getUserAvailableBalance(user);

        if (
            availableBalance <
            financials.requiredMarginAndFee
        ) {
            const currency =
                getCurrencySymbol(assetType);

            throw new Error(
                `Insufficient available margin. Required ${currency}${financials.requiredMarginAndFee.toFixed(2)} including margin and fee.`
            );
        }

        const order = await Order.create({
            userId: user._id,
            username: user.username,
            symbol: normalizedSymbol,
            company:
                market.companyName ||
                market.shortName ||
                normalizedSymbol,
            exchange:
                market.exchange ||
                "YAHOO",
            blockTradeId: null,
            type: normalizedSide,
            orderType: "LIMIT",
            assetType,
            quantity: validatedQuantity,
            lots: resolvedLots,
            lotSize,
            price: requestedPrice,
            executedPrice: 0,
            notionalValue: financials.notionalValue,
            totalAmount: financials.notionalValue,
            leverage: resolvedLeverage,
            margin: financials.margin,
            fee: financials.fee,
            takeProfit: tpSl.takeProfit,
            stopLoss: tpSl.stopLoss,
            averageBuyPrice:
                normalizedSide === "BUY"
                    ? requestedPrice
                    : 0,
            realizedProfit: 0,
            unrealizedProfit: 0,
            status: "PENDING",
            orderTime: new Date(),
        });

        return {
            success: true,
            message: "Limit order placed successfully.",
            order,
            wallet: walletResponse(user),
        };
    }

    /*
    |--------------------------------------------------------------------------
    | MARKET ORDER
    |--------------------------------------------------------------------------
    */

    const executionPrice = Number(market.price);

    const marketTPSL = validateTPSL(
        normalizedSide,
        executionPrice,
        takeProfit,
        stopLoss
    );

    const marketFinancials =
        calculateOrderFinancials(
            executionPrice,
            validatedQuantity,
            resolvedLeverage,
            feeRate
        );

    const availableBalance =
        getUserAvailableBalance(user);

    if (
        availableBalance <
        marketFinancials.requiredMarginAndFee
    ) {
        const currency =
            getCurrencySymbol(assetType);

        throw new Error(
            `Insufficient available margin. Required ${currency}${marketFinancials.requiredMarginAndFee.toFixed(2)} including margin and fee.`
        );
    }

    let position = await Position.findOne(
        regularPositionFilter(
            user._id,
            normalizedSymbol
        )
    );

    if (position) {
        normalizeStoredPositionSide(position);

        const existingSide =
            positionSideToOrderSide(
                position.side
            );

        if (existingSide === normalizedSide) {
            const existingLeverage =
                Number(position.leverage || resolvedLeverage);

            if (
                existingLeverage !==
                resolvedLeverage
            ) {
                throw new Error(
                    `Existing ${normalizedSide} position uses ${existingLeverage}X leverage. Close/reduce it before changing leverage.`
                );
            }

            const oldQuantity =
                Number(position.quantity || 0);

            const oldEntry =
                Number(
                    position.entryPrice ??
                    position.averagePrice ??
                    executionPrice
                );

            const newQuantity =
                oldQuantity +
                validatedQuantity;

            const newEntry =
                (
                    oldEntry * oldQuantity +
                    executionPrice * validatedQuantity
                ) / newQuantity;

            position.quantity = newQuantity;
            position.lots = Number(
                (newQuantity / lotSize).toFixed(8)
            );
            position.lotSize = lotSize;
            position.entryPrice = Number(
                newEntry.toFixed(8)
            );
            position.averagePrice = Number(
                newEntry.toFixed(8)
            );

            position.leverage = resolvedLeverage;

            position.margin = Number(
                (
                    Number(
                        position.margin ??
                        position.investedAmount ??
                        0
                    ) +
                    marketFinancials.margin
                ).toFixed(8)
            );

            position.investedAmount =
                position.margin;

            position.userInvestedAmount =
                position.margin;

            position.notionalValue = Number(
                (
                    Number(position.notionalValue || 0) +
                    marketFinancials.notionalValue
                ).toFixed(8)
            );

            position.fee = Number(
                (
                    Number(position.fee || 0) +
                    marketFinancials.fee
                ).toFixed(8)
            );

            position.tradingFee =
                position.fee;

            position.takeProfit =
                marketTPSL.takeProfit;

            position.stopLoss =
                marketTPSL.stopLoss;

            updateLeveragedPositionValues(
                position,
                executionPrice
            );

            await position.save();

            user.balance = roundMoney(
                getUserBalance(user) -
                marketFinancials.fee
            );

            await saveUserWithMarginState(user);
        } else {
            if (
                validatedQuantity >
                Number(position.quantity || 0)
            ) {
                throw new Error(
                    "Order quantity exceeds the current position quantity."
                );
            }

            const entryPrice =
                Number(
                    position.entryPrice ??
                    position.averagePrice ??
                    executionPrice
                );

            const realizedProfit =
                calculatePositionPnL(
                    existingSide,
                    entryPrice,
                    executionPrice,
                    validatedQuantity
                );

            const oldQuantity =
                Number(position.quantity || 0);

            const remainingQuantity =
                oldQuantity -
                validatedQuantity;

            if (remainingQuantity === 0) {
                await Position.deleteOne({
                    _id: position._id,
                });
            } else {
                position.quantity =
                    remainingQuantity;

                position.lots = Number(
                    (
                        remainingQuantity /
                        Number(
                            position.lotSize ||
                            lotSize
                        )
                    ).toFixed(8)
                );

                const ratio =
                    remainingQuantity /
                    oldQuantity;

                position.notionalValue =
                    Number(
                        (
                            Number(
                                position.notionalValue ||
                                0
                            ) * ratio
                        ).toFixed(8)
                    );

                position.margin =
                    Number(
                        (
                            Number(
                                position.margin ||
                                position.investedAmount ||
                                0
                            ) * ratio
                        ).toFixed(8)
                    );

                position.investedAmount =
                    position.margin;

                position.userInvestedAmount =
                    position.margin;

                position.realizedProfit =
                    Number(
                        (
                            Number(
                                position.realizedProfit ||
                                0
                            ) +
                            realizedProfit
                        ).toFixed(8)
                    );

                updateLeveragedPositionValues(
                    position,
                    executionPrice
                );

                await position.save();
            }

            user.balance = roundMoney(
                getUserBalance(user) +
                realizedProfit -
                marketFinancials.fee
            );

            await saveUserWithMarginState(user);

            const closeOrder =
                await Order.create({
                    userId: user._id,
                    username: user.username,
                    symbol: normalizedSymbol,
                    company:
                        market.companyName ||
                        market.shortName ||
                        normalizedSymbol,
                    exchange:
                        market.exchange ||
                        "YAHOO",
                    blockTradeId: null,
                    type: normalizedSide,
                    orderType: "MARKET",
                    assetType,
                    quantity: validatedQuantity,
                    lots: resolvedLots,
                    lotSize,
                    price: executionPrice,
                    executedPrice: executionPrice,
                    notionalValue:
                        marketFinancials.notionalValue,
                    totalAmount:
                        marketFinancials.notionalValue,
                    leverage: resolvedLeverage,
                    margin: marketFinancials.margin,
                    fee: marketFinancials.fee,
                    takeProfit:
                        marketTPSL.takeProfit,
                    stopLoss:
                        marketTPSL.stopLoss,
                    averageBuyPrice:
                        existingSide === "BUY"
                            ? entryPrice
                            : 0,
                    realizedProfit,
                    unrealizedProfit: 0,
                    status: "CLOSED",
                    orderTime: new Date(),
                    executedAt: new Date(),
                    closedAt: new Date(),
                    lastCheckedPrice:
                        executionPrice,
                    lastPriceCheckedAt:
                        new Date(),
                });

            return {
                success: true,
                message: "Order executed successfully.",
                order: closeOrder,
                position:
                    await Position.findOne(
                        regularPositionFilter(
                            user._id,
                            normalizedSymbol
                        )
                    ),
                wallet: walletResponse(user),
            };
        }
    } else {
        if (normalizedSide === "SELL" && assetType === "STOCK") {
            throw new Error(
                "You don't own this stock."
            );
        }

        position = new Position({
            userId: user._id,
            username: user.username,
            symbol: normalizedSymbol,
            company:
                market.companyName ||
                market.shortName ||
                normalizedSymbol,
            exchange:
                market.exchange ||
                "YAHOO",
            logo:
                market.logo || "",
            assetType,
            side:
                orderSideToPositionSide(
                    normalizedSide
                ),
            quantity: validatedQuantity,
            lots: resolvedLots,
            lotSize,
            entryPrice: executionPrice,
            averagePrice: executionPrice,
            investedAmount:
                marketFinancials.margin,
            userInvestedAmount:
                marketFinancials.margin,
            currentPrice:
                executionPrice,
            currentValue:
                marketFinancials.notionalValue,
            profitLoss: 0,
            profitLossPercent: 0,
            notionalValue:
                marketFinancials.notionalValue,
            margin:
                marketFinancials.margin,
            leverage:
                resolvedLeverage,
            fee:
                marketFinancials.fee,
            tradingFee:
                marketFinancials.fee,
            takeProfit:
                marketTPSL.takeProfit,
            stopLoss:
                marketTPSL.stopLoss,
            unrealizedProfit: 0,
            realizedProfit: 0,
            status: "OPEN",
            openedAt: new Date(),
            lastPriceUpdated: new Date(),
            blockTradeId: null,
        });

        updateLeveragedPositionValues(
            position,
            executionPrice
        );

        await position.save();

        user.balance = roundMoney(
            getUserBalance(user) -
            marketFinancials.fee
        );

        await saveUserWithMarginState(user);

        const openOrder =
            await Order.create({
                userId: user._id,
                username: user.username,
                symbol: normalizedSymbol,
                company:
                    market.companyName ||
                    market.shortName ||
                    normalizedSymbol,
                exchange:
                    market.exchange ||
                    "YAHOO",
                blockTradeId: null,
                type: normalizedSide,
                orderType: "MARKET",
                assetType,
                quantity: validatedQuantity,
                lots: resolvedLots,
                lotSize,
                price: executionPrice,
                executedPrice: executionPrice,
                notionalValue:
                    marketFinancials.notionalValue,
                totalAmount:
                    marketFinancials.notionalValue,
                leverage:
                    resolvedLeverage,
                margin:
                    marketFinancials.margin,
                fee:
                    marketFinancials.fee,
                takeProfit:
                    marketTPSL.takeProfit,
                stopLoss:
                    marketTPSL.stopLoss,
                averageBuyPrice:
                    normalizedSide === "BUY"
                        ? executionPrice
                        : 0,
                realizedProfit: 0,
                unrealizedProfit: 0,
                status: "OPEN",
                orderTime: new Date(),
                executedAt: new Date(),
                openedAt: new Date(),
                lastCheckedPrice:
                    executionPrice,
                lastPriceCheckedAt:
                    new Date(),
            });

        return {
            success: true,
            message: "Order executed successfully.",
            order: openOrder,
            position,
            wallet: walletResponse(user),
        };
    }
}

/*
|--------------------------------------------------------------------------
| Execute One Pending LIMIT Order
|--------------------------------------------------------------------------
*/

export async function executePendingOrder(orderId) {
    const order = await Order.findById(orderId);

    if (!order) {
        throw new Error("Order not found.");
    }

    if (order.status !== "PENDING") {
        return {
            success: true,
            executed: false,
            order,
        };
    }

    const market = await fetchStock(order.symbol);

    try {
        validateLiveStock(market, order.assetType);
    } catch (error) {
        if (error && error.message === "Market is currently closed.") {
            // Market is legitimately closed (weekend, Indian market
            // hours, or Yahoo marketState CLOSED). Do NOT treat this
            // as a failed pending order. Leave the order untouched
            // and PENDING so the scheduler can retry it once the
            // market reopens.
            return {
                success: true,
                executed: false,
                marketClosed: true,
                order,
                currentPrice: Number(market?.price || 0),
            };
        }

        throw error;
    }

    const currentPrice = Number(market.price);
    const targetPrice = Number(order.price);
    const side = String(order.type).toUpperCase();

    const shouldExecute =
        side === "BUY"
            ? currentPrice <= targetPrice
            : currentPrice >= targetPrice;

    if (!shouldExecute) {
        return {
            success: true,
            executed: false,
            order,
            currentPrice,
        };
    }

    const user = await User.findById(order.userId);
    if (!user) {
        throw new Error("User not found.");
    }

    await refreshUserMarginState(user);

    const position = await Position.findOne(
        regularPositionFilter(user._id, order.symbol)
    );

    const executionPrice = currentPrice;
    const quantity = Number(order.quantity);
    const leverage = Number(order.leverage || 1);
    const feeRate = DEFAULT_FEE_RATE[order.assetType] || 0;

    const financials = calculateOrderFinancials(
        executionPrice,
        quantity,
        leverage,
        feeRate
    );

    const availableBalanceForPending = getUserAvailableBalance(user);

    if (availableBalanceForPending < financials.requiredMarginAndFee) {
        const currency = getCurrencySymbol(order.assetType);
        throw new Error(
            `Insufficient available margin to execute pending order. Required ${currency}${financials.requiredMarginAndFee.toFixed(2)} including margin and fee.`
        );
    }

    if (!position) {
        const newPosition = await Position.create({
            userId: user._id,
            username: user.username,
            symbol: order.symbol,
            company: order.company || order.symbol,
            exchange: order.exchange || "YAHOO",
            assetType: order.assetType || "STOCK",
            side: orderSideToPositionSide(side),
            quantity,
            lots: Number(
                order.lots ||
                quantity / Number(order.lotSize || 1)
            ),
            lotSize: Number(order.lotSize || 1),
            entryPrice: executionPrice,
            averagePrice: executionPrice,
            investedAmount: financials.margin,
            userInvestedAmount: financials.margin,
            currentPrice: executionPrice,
            currentValue: financials.notionalValue,
            notionalValue: financials.notionalValue,
            margin: financials.margin,
            leverage,
            fee: financials.fee,
            tradingFee: financials.fee,
            takeProfit: order.takeProfit,
            stopLoss: order.stopLoss,
            profitLoss: 0,
            profitLossPercent: 0,
            unrealizedProfit: 0,
            realizedProfit: 0,
            status: "OPEN",
            openedAt: new Date(),
            lastPriceUpdated: new Date(),
            blockTradeId: null,
        });

        user.balance = roundMoney(
            getUserBalance(user) - financials.fee
        );

        await saveUserWithMarginState(user);

        order.executedPrice = executionPrice;
        order.notionalValue = financials.notionalValue;
        order.totalAmount = financials.notionalValue;
        order.margin = financials.margin;
        order.fee = financials.fee;
        order.status = "FILLED";
        order.executedAt = new Date();
        order.openedAt = new Date();
        order.lastCheckedPrice = currentPrice;
        order.lastPriceCheckedAt = new Date();

        await order.save();

        return {
            success: true,
            executed: true,
            order,
            position: newPosition,
            wallet: walletResponse(user),
        };
    }

    normalizeStoredPositionSide(position);
    const existingPendingSide = positionSideToOrderSide(position.side);

    if (existingPendingSide === side) {
        // Removed leverage mismatch restriction.
        // Allow merging even if leverage differs.

        const oldQuantity = Number(position.quantity || 0);
        const oldEntry = Number(
            position.entryPrice || position.averagePrice || executionPrice
        );

        const newQuantity = oldQuantity + quantity;
        const weightedEntry =
            (oldEntry * oldQuantity + executionPrice * quantity) /
            newQuantity;

        position.quantity = newQuantity;
        position.lots = Number(
            (newQuantity / Number(order.lotSize || 1)).toFixed(8)
        );
        position.entryPrice = Number(weightedEntry.toFixed(8));
        position.averagePrice = position.entryPrice;
        position.margin = Number(
            (
                Number(position.margin || position.investedAmount || 0) +
                financials.margin
            ).toFixed(8)
        );
        position.investedAmount = position.margin;
        position.userInvestedAmount = position.margin;
        position.notionalValue = Number(
            (
                Number(position.notionalValue || 0) +
                financials.notionalValue
            ).toFixed(8)
        );
        // Calculate effective leverage from combined notional and margin.
        const totalNotional = Number(position.notionalValue);
        const totalMargin = Number(position.margin || position.investedAmount || 0);
        position.leverage = totalMargin > 0
            ? Number((totalNotional / totalMargin).toFixed(8))
            : leverage;

        position.fee = Number(
            (Number(position.fee || 0) + financials.fee).toFixed(8)
        );
        position.tradingFee = position.fee;
        position.takeProfit = order.takeProfit;
        position.stopLoss = order.stopLoss;

        updateLeveragedPositionValues(position, executionPrice);
        await position.save();

        user.balance = roundMoney(
            getUserBalance(user) - financials.fee
        );

        await saveUserWithMarginState(user);

        order.executedPrice = executionPrice;
        order.status = "FILLED";
        order.executedAt = new Date();
        order.lastCheckedPrice = currentPrice;
        order.lastPriceCheckedAt = new Date();

        await order.save();

        return {
            success: true,
            executed: true,
            order,
            position,
            wallet: walletResponse(user),
        };
    }

    throw new Error(
        "Pending order conflicts with the existing opposite-side position. Close/reduce the position through the trading flow."
    );
}

/*
|--------------------------------------------------------------------------
| Execute All Triggered Pending Orders
|--------------------------------------------------------------------------
*/

export async function executePendingOrders() {
    const pendingOrders = await Order.find({
        status: "PENDING",
        orderType: "LIMIT",
    }).sort({ orderTime: 1 });

    const results = [];

    for (const order of pendingOrders) {
        try {
            results.push(await executePendingOrder(order._id));
        } catch (error) {
            console.error(`Pending order ${order._id} failed:`, error);
            results.push({
                success: false,
                executed: false,
                orderId: order._id,
                error: error.message,
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
| Check One Position For TP / SL
|--------------------------------------------------------------------------
*/

export async function checkPositionTakeProfitStopLoss(positionId) {
    const position = await Position.findById(positionId);

    if (!position) {
        return {
            success: true,
            triggered: false,
            position: null,
        };
    }

    const market = await fetchStock(position.symbol);
    validateLiveStock(market, position.assetType);

    const currentPrice = Number(market.price);

    updateLeveragedPositionValues(position, currentPrice);
    normalizeStoredPositionSide(position);

    const side = positionSideToOrderSide(position.side);

    const hitTP = shouldTakeProfit(
        side,
        currentPrice,
        position.takeProfit
    );

    const hitSL = shouldStopLoss(
        side,
        currentPrice,
        position.stopLoss
    );

    if (!hitTP && !hitSL) {
        await position.save();
        return {
            success: true,
            triggered: false,
            position,
        };
    }

    const reason = hitTP ? "TAKE_PROFIT" : "STOP_LOSS";

    const user = await User.findById(position.userId);
    if (!user) {
        throw new Error("User not found.");
    }

    const entryPrice = Number(
        position.entryPrice ?? position.averagePrice ?? currentPrice
    );

    const quantity = Number(position.quantity || 0);

    const realizedProfit = calculatePositionPnL(
        side,
        entryPrice,
        currentPrice,
        quantity
    );

    // FIX: Do NOT deduct the opening fee again.
    // The fee was already subtracted from balance when the position was opened.
    user.balance = roundMoney(
        getUserBalance(user) + realizedProfit
    );

    const closeOrder = await Order.create({
        userId: user._id,
        username: user.username,
        symbol: position.symbol,
        company: position.company || position.symbol,
        exchange: position.exchange || "YAHOO",
        blockTradeId: null,
        type: side === "BUY" ? "SELL" : "BUY",
        orderType: "MARKET",
        assetType: position.assetType || "STOCK",
        quantity,
        lots: Number(position.lots || 0),
        lotSize: Number(position.lotSize || 1),
        price: currentPrice,
        executedPrice: currentPrice,
        notionalValue: Number((currentPrice * quantity).toFixed(8)),
        totalAmount: Number((currentPrice * quantity).toFixed(8)),
        leverage: Number(position.leverage || 1),
        margin: Number(position.margin || position.investedAmount || 0),
        fee: 0, // no additional fee for auto-close
        takeProfit: position.takeProfit,
        stopLoss: position.stopLoss,
        averageBuyPrice: side === "BUY" ? entryPrice : 0,
        realizedProfit,
        unrealizedProfit: 0,
        status: "CLOSED",
        orderTime: new Date(),
        executedAt: new Date(),
        closedAt: new Date(),
        lastCheckedPrice: currentPrice,
        lastPriceCheckedAt: new Date(),
    });

    await Position.deleteOne({ _id: position._id });
    await saveUserWithMarginState(user);

    return {
        success: true,
        triggered: true,
        reason,
        realizedProfit,
        price: currentPrice,
        order: closeOrder,
        wallet: walletResponse(user),
        position: null,
    };
}

/*
|--------------------------------------------------------------------------
| Check All Open Positions For TP / SL
|--------------------------------------------------------------------------
*/

export async function checkAllPositionsTakeProfitStopLoss() {
    const positions = await Position.find({
        blockTradeId: null,
        status: "OPEN",
    });

    const results = [];

    for (const position of positions) {
        try {
            results.push(
                await checkPositionTakeProfitStopLoss(position._id)
            );
        } catch (error) {
            console.error(`TP/SL check failed for ${position.symbol}:`, error);
            results.push({
                success: false,
                triggered: false,
                positionId: position._id,
                error: error.message,
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
| GET SINGLE NORMAL POSITION
|--------------------------------------------------------------------------
*/

export async function getPosition(username, symbol) {
    username = normalizeUsername(username);
    symbol = normalizeSymbol(symbol);

    const user = await User.findOne({ username });
    if (!user) {
        throw new Error("User not found.");
    }

    const position = await Position.findOne(
        regularPositionFilter(user._id, symbol)
    );

    if (position) {
        normalizeStoredPositionSide(position);
    }

    if (!position) {
        await refreshUserMarginState(user);
        await user.save();

        return {
            success: true,
            position: null,
            wallet: walletResponse(user),
        };
    }

    try {
        const stock = await fetchStock(position.symbol);

        if (stock && stock.price > 0) {
            if (position.assetType && position.assetType !== "STOCK") {
                updateLeveragedPositionValues(position, stock.price);
            } else {
                updatePosition(position, stock.price);
            }

            await position.save();
        }
    } catch (error) {
        console.error(
            `Failed to refresh live price for ${position.symbol}:`,
            error
        );
    }

    await refreshUserMarginState(user);
    await user.save();

    return {
        success: true,
        position,
        wallet: walletResponse(user),
    };
}

/*
|--------------------------------------------------------------------------
| GET ALL NORMAL POSITIONS
|--------------------------------------------------------------------------
*/

export async function getPositions(username) {
    username = normalizeUsername(username);

    const user = await User.findOne({ username });
    if (!user) {
        throw new Error("User not found.");
    }

    const positions = await Position.find({
        userId: user._id,
    });

    for (const position of positions) {
        normalizeStoredPositionSide(position);
    }

    await Promise.all(
        positions.map(async (position) => {
            if (position.blockTradeId) {
                return;
            }

            try {
                const stock = await fetchStock(position.symbol);

                if (stock && stock.price > 0) {
                    if (
                        position.assetType &&
                        position.assetType !== "STOCK"
                    ) {
                        updateLeveragedPositionValues(position, stock.price);
                    } else {
                        updatePosition(position, stock.price);
                    }

                    await position.save();
                }
            } catch (error) {
                console.error(
                    `Failed to refresh live price for ${position.symbol}:`,
                    error
                );
            }
        })
    );

    await refreshUserMarginState(user);
    await user.save();

    return {
        success: true,
        positions,
        wallet: walletResponse(user),
    };
}
/*
|--------------------------------------------------------------------------
| GET USER PENDING ORDERS
|--------------------------------------------------------------------------
*/

export async function getPendingOrders(username) {
    username = normalizeUsername(username);

    const user = await User.findOne({
        username,
    });

    if (!user) {
        throw new Error("User not found.");
    }

    const orders = await Order.find({
        userId: user._id,
        status: "PENDING",
    }).sort({
        orderTime: -1,
    });

    return {
        success: true,
        orders,
    };
}

/*
|--------------------------------------------------------------------------
| ADMIN-CONTROLLED MARKET SERVICE EXPORTS
|--------------------------------------------------------------------------
*/
export {
    createMarketRequest,
    sellMarketPosition,
    getUserMarketRequests,
    getUserActiveMarketPositions,
    getUserMarketHistory,
    getMarketRequest,
    getAdminMarketRequests,
    setMarketResult,
    lockFinalPercent,
    settleMarketTrade,
    processMarketRequest,
    processAllMarketRequests,
    cancelPendingMarketRequest,
};