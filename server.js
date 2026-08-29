import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";

import connectDB from "./config/db.js";

import stockRoutes from "./routes/stocks.js";
import chartRoutes from "./routes/chart.js";
import searchRoutes from "./routes/search.js";
import ipoRoutes from "./routes/ipo.js";
import ucStockRoutes from "./routes/ucstocks.js";
import authRoutes from "./routes/auth.js";
import kycRoutes from "./routes/kycRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import withdrawRoutes from "./routes/withdrawRoutes.js";
import historyRoutes from "./routes/historyRoutes.js";
import tradeRoutes from "./routes/trade.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import adminIpoRoutes from "./routes/adminIPO.js";
import adminBlockTradeRoutes from "./routes/adminBlockTrade.js";
import blockTradeUserRoutes from "./routes/blockTrade.js";

// =====================================================
// NEWS ROUTES
// =====================================================

import newsRoutes from "./routes/newsRoutes.js";

// =====================================================
// DEPOSIT ROUTES
// =====================================================

import depositRoutes from "./routes/depositRoutes.js";

// =====================================================
// TRADE SERVICE (for automatic pending order execution)
// =====================================================

import { executePendingOrders } from "./services/tradeService.js";


const app = express();


// =====================================================
// Database
// =====================================================

connectDB();


// =====================================================
// Security
// =====================================================

app.disable("x-powered-by");

app.set(
    "trust proxy",
    1
);


// =====================================================
// Middlewares
// =====================================================

app.use(
    helmet()
);

app.use(
    compression()
);


app.use(
    cors({

        origin:
            process.env.NODE_ENV === "production"
                ? process.env.FRONTEND_URL
                : "http://localhost:5173",

        credentials:
            true,

    })
);


app.use(
    express.json()
);


app.use(
    express.urlencoded({
        extended: true,
    })
);


// =====================================================
// API Routes
// =====================================================

app.use(
    "/api/stocks",
    stockRoutes
);


app.use(
    "/api/chart",
    chartRoutes
);


app.use(
    "/api/search",
    searchRoutes
);


app.use(
    "/api/ipo",
    ipoRoutes
);


app.use(
    "/api/admin/ipo",
    adminIpoRoutes
);


app.use(
    "/api/ucstocks",
    ucStockRoutes
);


app.use(
    "/api/blocktrade",
    blockTradeUserRoutes
);


app.use(
    "/api/admin/blocktrade",
    adminBlockTradeRoutes
);


// =====================================================
// Authentication Routes
// =====================================================

app.use(
    "/api/auth",
    authRoutes
);


app.use(
    "/api/kyc",
    kycRoutes
);


app.use(
    "/api/admin",
    adminRoutes
);


app.use(
    "/api/withdraw",
    withdrawRoutes
);


app.use(
    "/api/history",
    historyRoutes
);


app.use(
    "/api/trade",
    tradeRoutes
);


app.use(
    "/api/notification",
    notificationRoutes
);


// =====================================================
// NEWS ROUTES
// =====================================================

app.use(
    "/api/news",
    newsRoutes
);


// =====================================================
// DEPOSIT ROUTES
// =====================================================

app.use(
    "/api/deposit",
    depositRoutes
);


// =====================================================
// Health Check
// =====================================================

app.get(
    "/",
    (req, res) => {

        res.status(200).json({

            success:
                true,

            app:
                "BobStock Backend",

            version:
                "1.0.0",

            status:
                "Running 🚀",

            environment:
                process.env.NODE_ENV ||
                "development",

        });

    }
);


// =====================================================
// 404 Handler
// =====================================================

app.use(
    (req, res) => {

        res.status(404).json({

            success:
                false,

            message:
                "API Route Not Found",

        });

    }
);


// =====================================================
// Global Error Handler
// =====================================================

app.use(
    (
        err,
        req,
        res,
        next
    ) => {

        console.error(
            "Server Error:",
            err
        );


        res.status(
            err.status || 500
        ).json({

            success:
                false,

            message:
                err.message ||
                "Internal Server Error",

        });

    }
);


// =====================================================
// Automatic Pending Order Execution Scheduler
// =====================================================

let pendingExecutionRunning = false;

async function runPendingOrderExecution() {
    if (pendingExecutionRunning) {
        return;
    }

    pendingExecutionRunning = true;

    try {
        await executePendingOrders();
    } catch (error) {
        console.error(
            "❌ Automatic Pending Order Execution Error:",
            error
        );
    } finally {
        pendingExecutionRunning = false;
    }
}


// =====================================================
// Server
// =====================================================

const PORT =
    process.env.PORT ||
    5000;


app.listen(
    PORT,
    () => {

        console.log("");

        console.log(
            "===================================="
        );

        console.log(
            "🚀 BobStock Backend Started"
        );

        console.log(
            `🌐 http://localhost:${PORT}`
        );

        console.log(
            `🛢️ MongoDB : Connected`
        );

        console.log(
            `🌍 Environment : ${
                process.env.NODE_ENV ||
                "development"
            }`
        );

        console.log(
            "===================================="
        );

        console.log("");

        // Start the automatic pending order execution scheduler
        setInterval(
            runPendingOrderExecution,
            1000
        );

        console.log(
            "🔄 Automatic pending order execution started (1s interval)"
        );

        console.log("");

    }
);