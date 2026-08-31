import {
    processAllMarketRequests,
} from "../services/marketTradeService.js";


// ======================================================
// MARKET TRADE SCHEDULER
// ======================================================
//
// File:
//
// backend/jobs/marketTradeScheduler.js
//
// Purpose:
//
// Automatically process Admin-controlled Market trades.
//
// Flow:
//
// PENDING
//    |
//    | Admin SET
//    v
// ACTIVE
//    |
//    | Until last 5 seconds
//    v
// LOCKED
//    |
//    | Duration expires
//    v
// SETTLED
//
// IMPORTANT:
//
// PENDING Market requests are NOT processed here.
//
// They wait until Admin presses SET.
//
// ======================================================


// ======================================================
// DYNAMIC DURATION / PERCENTAGE UPDATES
// ======================================================
//
// Admin edits are persisted by marketTradeService.js to the MarketRequest
// (including expiresAt and the current admin/final percentage). The scheduler
// intentionally remains a thin 1-second dispatcher, so the next processing
// cycle automatically observes the updated values.
//
// No separate in-memory duration cache is used here. This prevents a stale
// scheduler value from overriding an Admin edit.
//
// ======================================================

// ======================================================
// CONFIGURATION
// ======================================================
//
// Scheduler interval:
//
// 1 second
//
// This gives us enough precision for:
//
// - 5 second final lock
// - duration expiry
//
// ======================================================

const SCHEDULER_INTERVAL_MS = 1000;


// ======================================================
// SCHEDULER STATE
// ======================================================

let schedulerTimer = null;

let isProcessing = false;


// ======================================================
// PROCESS MARKET TRADES
// ======================================================
//
// Calls marketTradeService:
//
// processAllMarketRequests()
//
// That function handles:
//
// ACTIVE
// LOCKED
//
// requests.
//
// ======================================================

async function processMarketTrades() {

    /*
    |--------------------------------------------------------------------------
    | Prevent overlapping scheduler executions
    |--------------------------------------------------------------------------
    |
    | If one cycle takes longer than one second, we don't want another
    | cycle to start before the previous cycle has finished.
    |
    */

    if (isProcessing) {
        return;
    }


    isProcessing = true;


    try {

        await processAllMarketRequests();

    } catch (error) {

        /*
        |--------------------------------------------------------------------------
        | Scheduler must stay alive
        |--------------------------------------------------------------------------
        |
        | A single failed Market request must NOT stop the scheduler.
        |
        */

        console.error(
            "[Market Scheduler] Processing error:",
            error
        );

    } finally {

        isProcessing = false;

    }

}


// ======================================================
// START SCHEDULER
// ======================================================
//
// Call this once after MongoDB connection is ready.
//
// Example:
//
// import {
//     startMarketTradeScheduler
// } from "./jobs/marketTradeScheduler.js";
//
// startMarketTradeScheduler();
//
// ======================================================

export function startMarketTradeScheduler() {

    /*
    |--------------------------------------------------------------------------
    | Prevent duplicate scheduler
    |--------------------------------------------------------------------------
    */

    if (schedulerTimer) {

        return schedulerTimer;

    }


    /*
    |--------------------------------------------------------------------------
    | Run immediately
    |--------------------------------------------------------------------------
    |
    | This is important after server restart.
    |
    | If an existing Market trade is already near expiry, we don't
    | have to wait one full second for the first check.
    |
    */

    processMarketTrades();


    /*
    |--------------------------------------------------------------------------
    | Run every second
    |--------------------------------------------------------------------------
    */

    schedulerTimer =
        setInterval(
            processMarketTrades,
            SCHEDULER_INTERVAL_MS
        );


    return schedulerTimer;

}


// ======================================================
// STOP SCHEDULER
// ======================================================
//
// Optional.
//
// Useful for graceful shutdown or tests.
//

export function stopMarketTradeScheduler() {

    if (!schedulerTimer) {

        return;

    }


    clearInterval(
        schedulerTimer
    );


    schedulerTimer =
        null;

}


// ======================================================
// GET SCHEDULER STATUS
// ======================================================
//
// Optional helper.
//
// ======================================================

export function isMarketTradeSchedulerRunning() {

    return Boolean(
        schedulerTimer
    );

}


// ======================================================
// DEFAULT EXPORT
// ======================================================

export default {
    startMarketTradeScheduler,
    stopMarketTradeScheduler,
    isMarketTradeSchedulerRunning,
};