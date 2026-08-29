import express from "express";

import {
    createDepositController,
    getDepositAddressController,
    getPendingDepositsController,
    acceptDepositController,
    rejectDepositController,
} from "../controllers/depositController.js";


const router = express.Router();


// =====================================================
// USER DEPOSIT ROUTES
// =====================================================


// =====================================================
// GET DEPOSIT ADDRESS
// GET /api/deposit/address
// =====================================================

router.get(
    "/address",
    getDepositAddressController
);


// =====================================================
// CREATE DEPOSIT REQUEST
// POST /api/deposit
//
// Body:
//
// amount
//
// User ID is taken by the controller/service from
// the existing request data.
// =====================================================

router.post(
    "/",
    createDepositController
);


// =====================================================
// ADMIN DEPOSIT ROUTES
// =====================================================


// =====================================================
// GET PENDING DEPOSIT REQUESTS
// GET /api/deposit/admin
// =====================================================

router.get(
    "/admin",
    getPendingDepositsController
);


// =====================================================
// ACCEPT DEPOSIT
// POST /api/deposit/admin/:id/accept
//
// On success:
//
// 1. Exact user's balance is increased
// 2. Deposit request is removed
// 3. Controller can trigger notification
// =====================================================

router.post(
    "/admin/:id/accept",
    acceptDepositController
);


// =====================================================
// REJECT DEPOSIT
// POST /api/deposit/admin/:id/reject
//
// On success:
//
// 1. Balance is NOT changed
// 2. Deposit request is removed
// 3. Controller can trigger notification
// =====================================================

router.post(
    "/admin/:id/reject",
    rejectDepositController
);


// =====================================================
// EXPORT ROUTER
// =====================================================

export default router;