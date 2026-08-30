import express from "express";

import { protect } from "../middleware/auth.js";
// Future:
// import { adminProtect } from "../middleware/adminMiddleware.js";

import {
    getPendingKycsController,
    getApprovedKycsController,
    getRejectedKycsController,
    approveKycController,
    rejectKycController,
} from "../controllers/kycController.js";

import {
    getAllWithdrawRequests,
    approveWithdraw,
    rejectWithdraw,
} from "../controllers/withdrawController.js";

import {
    getAllUsersController,
    addBalanceController,
    deductBalanceController,
    updateCreditScoreController,
} from "../controllers/adminController.js";

import {
    sendNotificationController,
} from "../controllers/notificationController.js";

import {
    getAdminMarketRequests,
    setMarketResult,
} from "../services/marketTradeService.js";

const router = express.Router();


// ======================================================
// Pending KYC
// ======================================================

router.get(
    "/kyc/pending",
    protect,
    // adminProtect,
    getPendingKycsController
);


// ======================================================
// Approved KYC
// ======================================================

router.get(
    "/kyc/approved",
    protect,
    // adminProtect,
    getApprovedKycsController
);


// ======================================================
// Rejected KYC
// ======================================================

router.get(
    "/kyc/rejected",
    protect,
    // adminProtect,
    getRejectedKycsController
);


// ======================================================
// Approve KYC
// ======================================================

router.patch(
    "/kyc/approve/:id",
    protect,
    // adminProtect,
    approveKycController
);


// ======================================================
// Reject KYC
// ======================================================

router.patch(
    "/kyc/reject/:id",
    protect,
    // adminProtect,
    rejectKycController
);


// ======================================================
// Withdraw Requests
// ======================================================


// Get All Withdraw Requests

router.get(
    "/withdraw/all",
    protect,
    // adminProtect,
    getAllWithdrawRequests
);


// ======================================================
// Approve Withdraw
// ======================================================

router.patch(
    "/withdraw/approve/:id",
    protect,
    // adminProtect,
    approveWithdraw
);


// ======================================================
// Reject Withdraw
// ======================================================

router.patch(
    "/withdraw/reject/:id",
    protect,
    // adminProtect,
    rejectWithdraw
);


// ======================================================
// Users
// ======================================================

router.get(
    "/users",
    protect,
    // adminProtect,
    getAllUsersController
);


// ======================================================
// Add Balance
// ======================================================

router.patch(
    "/balance/add",
    protect,
    // adminProtect,
    addBalanceController
);


// ======================================================
// Deduct Balance
// ======================================================

router.patch(
    "/balance/deduct",
    protect,
    // adminProtect,
    deductBalanceController
);


// ======================================================
// Update Credit Score
// ======================================================

router.patch(
    "/credit-score",
    protect,
    // adminProtect,
    updateCreditScoreController
);


// ======================================================
// Send Notification
// ======================================================

router.post(
    "/notification/send",
    protect,
    // adminProtect,
    sendNotificationController
);


// ======================================================
// ADMIN MARKET TRADING
// ======================================================
//
// USER FLOW:
//
// stockdetails.tsx
//       |
//       | BUY
//       v
// POST /trade/market-request
//       |
//       v
// MarketRequest = PENDING
//       |
//       v
// GET /admin/market
//       |
//       v
// ADMIN SEES REQUEST
//       |
//       v
// duration + percentage
//       |
//       v
// PATCH /admin/market/:id/set
//       |
//       v
// PENDING -> ACTIVE
//       |
//       v
// Position created
//       |
//       v
// P&L starts
//
// IMPORTANT:
//
// Market requests are separate from the normal /orders
// pending LIMIT system.
//
// Therefore a Market request will NOT appear in the user's
// normal Pending Orders tab just because its status is
// PENDING.
//
// ======================================================


// ======================================================
// GET ADMIN MARKET REQUESTS
// ======================================================
//
// GET /api/admin/market
//
// Default:
//
// PENDING
// ACTIVE
// LOCKED
//
// Optional:
//
// GET /api/admin/market?status=PENDING
//
// GET /api/admin/market?status=ACTIVE
//
// GET /api/admin/market?status=LOCKED
//
// Completed:
//
// CLOSED
// SETTLED
//
// are not returned by default.
//
// So when a Market trade is sold or expires, it disappears
// from the active Admin Market section.
//
// ======================================================

router.get(
    "/market",
    protect,
    // adminProtect,
    async (req, res) => {
        try {

            /*
            |--------------------------------------------------------------------------
            | JWT PAYLOAD
            |--------------------------------------------------------------------------
            |
            | Your jwt.js stores:
            |
            | {
            |     id: userId
            | }
            |
            | auth.js puts decoded JWT into:
            |
            | req.user
            |
            | Therefore the correct ID is:
            |
            | req.user.id
            |
            |--------------------------------------------------------------------------
            */

            const adminId =
                req.user?.id;


            /*
            |--------------------------------------------------------------------------
            | Optional Status
            |--------------------------------------------------------------------------
            */

            const status =
                req.query?.status;


            /*
            |--------------------------------------------------------------------------
            | Get Market Requests
            |--------------------------------------------------------------------------
            */

            const result =
                await getAdminMarketRequests({
                    adminId,
                    status,
                });


            return res.json(
                result
            );

        } catch (error) {

            console.error(
                "Get Admin Market requests error:",
                error
            );


            return res.status(400).json({
                success: false,

                message:
                    error.message ||
                    "Unable to get Market requests.",
            });
        }
    }
);


// ======================================================
// SET MARKET RESULT
// ======================================================
//
// PATCH /api/admin/market/:id/set
//
// Admin sends:
//
// {
//     "durationMinutes": 15,
//     "percent": 0.30
// }
//
// OR:
//
// {
//     "durationMinutes": 15,
//     "percent": "+0.30"
// }
//
// OR negative:
//
// {
//     "durationMinutes": 15,
//     "percent": "-0.50"
// }
//
// Examples:
//
// +0.30
// -0.50
// +5
// -10
//
// The Market service accepts the +/- percentage.
//
// Once SET is pressed:
//
// PENDING
//     |
//     v
// ACTIVE
//
// Position is created.
//
// P&L starts running.
//
// ======================================================

router.patch(
    "/market/:id/set",
    protect,
    // adminProtect,
    async (req, res) => {

        try {

            /*
            |--------------------------------------------------------------------------
            | Admin Input
            |--------------------------------------------------------------------------
            */

            const {
                durationMinutes,
                percent,
            } = req.body || {};


            /*
            |--------------------------------------------------------------------------
            | Logged-in Admin ID
            |--------------------------------------------------------------------------
            |
            | jwt.js -> { id: userId }
            |
            */

            const adminId =
                req.user?.id;


            /*
            |--------------------------------------------------------------------------
            | Set Market Trade
            |--------------------------------------------------------------------------
            */

            const result =
                await setMarketResult({
                    requestId:
                        req.params.id,

                    adminId,

                    durationMinutes,

                    percent,
                });


            return res.json(
                result
            );

        } catch (error) {

            console.error(
                "Set Admin Market result error:",
                error
            );


            return res.status(400).json({
                success: false,

                message:
                    error.message ||
                    "Unable to set Market result.",
            });
        }
    }
);


// ======================================================
// EXPORT
// ======================================================

export default router;