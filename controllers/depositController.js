import {
    createDeposit,
    getPendingDeposits,
    acceptDeposit,
    rejectDeposit,
    getDepositAddress,
} from "../services/depositService.js";


// =====================================================
// CREATE DEPOSIT REQUEST
// =====================================================
// POST /api/deposit
// =====================================================

export const createDepositController =
    async (
        req,
        res
    ) => {

        try {

            // =========================================
            // User ID
            // =========================================
            //
            // IMPORTANT:
            // User ID should come from the authenticated
            // user/session system.
            //
            // Do not trust an arbitrary userId sent
            // from the frontend when authentication
            // middleware is available.
            // =========================================

            const userId =
                req.user?._id ||
                req.user?.id ||
                req.body?.userId;


            // =========================================
            // Amount
            // =========================================

            const {
                amount,
            } = req.body || {};


            // =========================================
            // Create Deposit
            // =========================================

            const deposit =
                await createDeposit(
                    userId,
                    amount
                );


            // =========================================
            // Response
            // =========================================

            return res.status(201).json({

                success:
                    true,

                message:
                    "Deposit request submitted successfully.",

                deposit: {

                    _id:
                        deposit._id,

                    userId:
                        deposit.userId,

                    username:
                        deposit.username,

                    amount:
                        deposit.amount,

                    address:
                        deposit.address,

                    status:
                        deposit.status,

                    createdAt:
                        deposit.createdAt,

                },

            });

        }

        catch (error) {

            console.error(
                "Create Deposit Error:",
                error
            );


            return res.status(400).json({

                success:
                    false,

                message:
                    error.message ||
                    "Failed to create deposit request.",

            });

        }

    };


// =====================================================
// GET DEPOSIT ADDRESS
// =====================================================
// GET /api/deposit/address
// =====================================================

export const getDepositAddressController =
    async (
        req,
        res
    ) => {

        try {

            const result =
                await getDepositAddress();


            return res.status(200).json({

                success:
                    true,

                address:
                    result.address,

            });

        }

        catch (error) {

            console.error(
                "Get Deposit Address Error:",
                error
            );


            return res.status(500).json({

                success:
                    false,

                message:
                    error.message ||
                    "Failed to get deposit address.",

            });

        }

    };


// =====================================================
// GET PENDING DEPOSITS
// =====================================================
// GET /api/deposit/admin
// =====================================================

export const getPendingDepositsController =
    async (
        req,
        res
    ) => {

        try {

            const deposits =
                await getPendingDeposits();


            return res.status(200).json({

                success:
                    true,

                count:
                    deposits.length,

                deposits,

            });

        }

        catch (error) {

            console.error(
                "Get Pending Deposits Error:",
                error
            );


            return res.status(500).json({

                success:
                    false,

                message:
                    error.message ||
                    "Failed to fetch deposit requests.",

            });

        }

    };


// =====================================================
// ACCEPT DEPOSIT
// =====================================================
// POST /api/deposit/admin/:id/accept
// =====================================================

export const acceptDepositController =
    async (
        req,
        res
    ) => {

        try {

            const {
                id,
            } = req.params;


            // =========================================
            // Accept Deposit
            // =========================================

            const result =
                await acceptDeposit(
                    id
                );


            // =========================================
            // Response
            // =========================================

            return res.status(200).json({

                success:
                    true,

                message:
                    result.message ||
                    "Deposit approved successfully.",

                depositId:
                    result.depositId,

                userId:
                    result.userId,

                username:
                    result.username,

                amount:
                    result.amount,

                balance:
                    result.balance,

            });

        }

        catch (error) {

            console.error(
                "Accept Deposit Error:",
                error
            );


            const message =
                error.message ||
                "Failed to approve deposit.";


            let statusCode =
                400;


            if (
                message.includes(
                    "not found"
                )
            ) {

                statusCode =
                    404;

            }


            return res.status(
                statusCode
            ).json({

                success:
                    false,

                message,

            });

        }

    };


// =====================================================
// REJECT DEPOSIT
// =====================================================
// POST /api/deposit/admin/:id/reject
// =====================================================

export const rejectDepositController =
    async (
        req,
        res
    ) => {

        try {

            const {
                id,
            } = req.params;


            // =========================================
            // Reject Deposit
            // =========================================

            const result =
                await rejectDeposit(
                    id
                );


            // =========================================
            // Response
            // =========================================

            return res.status(200).json({

                success:
                    true,

                message:
                    result.message ||
                    "Deposit rejected successfully.",

                depositId:
                    result.depositId,

                userId:
                    result.userId,

                username:
                    result.username,

                amount:
                    result.amount,

            });

        }

        catch (error) {

            console.error(
                "Reject Deposit Error:",
                error
            );


            const message =
                error.message ||
                "Failed to reject deposit.";


            let statusCode =
                400;


            if (
                message.includes(
                    "not found"
                )
            ) {

                statusCode =
                    404;

            }


            return res.status(
                statusCode
            ).json({

                success:
                    false,

                message,

            });

        }

    };