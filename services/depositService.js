import mongoose from "mongoose";

import Deposit from "../models/Deposit.js";
import User from "../models/User.js";

import { sendNotification } from "./notificationService.js";


// =====================================================
// Deposit Address
// =====================================================
//
// Backend-side deposit address.
// Frontend par address hard-code nahi kiya gaya.
//
// .env:
//
// DEPOSIT_ADDRESS=YOUR_ACTUAL_DEPOSIT_ADDRESS
//
// =====================================================

const DEPOSIT_ADDRESS =
    process.env.DEPOSIT_ADDRESS || "";


// =====================================================
// Validate ObjectId
// =====================================================

const isValidObjectId =
    (id) => {

        return mongoose.Types.ObjectId.isValid(
            id
        );

    };


// =====================================================
// Normalize Amount
// =====================================================

const normalizeAmount =
    (amount) => {

        const numericAmount =
            Number(amount);


        // =========================================
        // Validate Number
        // =========================================

        if (
            !Number.isFinite(
                numericAmount
            )
        ) {

            throw new Error(
                "Invalid deposit amount."
            );

        }


        // =========================================
        // Amount Must Be Greater Than Zero
        // =========================================

        if (
            numericAmount <= 0
        ) {

            throw new Error(
                "Deposit amount must be greater than 0."
            );

        }


        // =========================================
        // Maximum Decimal Precision
        // =========================================

        const normalized =
            Number(
                numericAmount.toFixed(8)
            );


        if (
            normalized <= 0
        ) {

            throw new Error(
                "Invalid deposit amount."
            );

        }


        return normalized;

    };


// =====================================================
// Send Deposit Notification Safely
// =====================================================
//
// Notification fail hone ki wajah se deposit/balance
// operation fail nahi hoga.
//
// =====================================================

const sendDepositNotification =
    async (
        username,
        title,
        message,
        type
    ) => {

        try {

            await sendNotification(
                username,
                title,
                message,
                type
            );

        }

        catch (notificationError) {

            console.error(
                "Deposit Notification Error:",
                notificationError
            );

        }

    };


// =====================================================
// Create Deposit Request
// =====================================================

export const createDeposit =
    async (
        userId,
        amount
    ) => {

        // =========================================
        // Validate User ID
        // =========================================

        if (
            !userId ||
            !isValidObjectId(
                userId
            )
        ) {

            throw new Error(
                "Invalid user."
            );

        }


        // =========================================
        // Validate Amount
        // =========================================

        const normalizedAmount =
            normalizeAmount(
                amount
            );


        // =========================================
        // Find User
        // =========================================

        const user =
            await User.findById(
                userId
            );


        if (
            !user
        ) {

            throw new Error(
                "User not found."
            );

        }


        // =========================================
        // Deposit Address
        // =========================================

        if (
            !DEPOSIT_ADDRESS
        ) {

            throw new Error(
                "Deposit address is not configured."
            );

        }


        // =========================================
        // Check Existing Pending Request
        // =========================================
        //
        // One pending deposit per user at a time.
        //
        // =========================================

        const existingPending =
            await Deposit.findOne({

                userId:
                    user._id,

                status:
                    "pending",

            });


        if (
            existingPending
        ) {

            throw new Error(
                "You already have a pending deposit request."
            );

        }


        // =========================================
        // Create Deposit Request
        // =========================================

        const deposit =
            await Deposit.create({

                userId:
                    user._id,

                username:
                    user.username,

                amount:
                    normalizedAmount,

                address:
                    DEPOSIT_ADDRESS,

                status:
                    "pending",

            });


        // =========================================
        // Return Created Deposit
        // =========================================

        return deposit;

    };


// =====================================================
// Get Pending Deposit Requests
// =====================================================

export const getPendingDeposits =
    async () => {

        const deposits =
            await Deposit.find({

                status:
                    "pending",

            })
                .sort({

                    createdAt:
                        -1,

                })
                .lean();


        return deposits;

    };


// =====================================================
// Accept Deposit
// =====================================================
//
// Flow:
//
// 1. Find pending deposit
// 2. Find exact User using deposit.userId
// 3. Add amount to that user's balance
// 4. Save User
// 5. Mark deposit approved
// 6. Transaction commits
// 7. Delete deposit request
// 8. Send user notification
//
// Username is NEVER used to decide whose balance
// gets updated.
//
// =====================================================

export const acceptDeposit =
    async (
        depositId
    ) => {

        // =========================================
        // Validate Deposit ID
        // =========================================

        if (
            !depositId ||
            !isValidObjectId(
                depositId
            )
        ) {

            throw new Error(
                "Invalid deposit ID."
            );

        }


        // =========================================
        // Start MongoDB Session
        // =========================================

        const session =
            await mongoose.startSession();


        try {

            let result =
                null;


            // =========================================
            // MongoDB Transaction
            // =========================================

            await session.withTransaction(
                async () => {

                    // =================================
                    // Find Pending Deposit
                    // =================================

                    const deposit =
                        await Deposit.findOne({

                            _id:
                                depositId,

                            status:
                                "pending",

                        }).session(
                            session
                        );


                    if (
                        !deposit
                    ) {

                        throw new Error(
                            "Deposit request not found or already processed."
                        );

                    }


                    // =================================
                    // Validate User ID
                    // =================================

                    if (
                        !deposit.userId ||
                        !isValidObjectId(
                            deposit.userId
                        )
                    ) {

                        throw new Error(
                            "Deposit request has an invalid user."
                        );

                    }


                    // =================================
                    // Validate Amount
                    // =================================

                    const amount =
                        normalizeAmount(
                            deposit.amount
                        );


                    // =================================
                    // Find Exact User
                    // =================================
                    //
                    // IMPORTANT:
                    // Balance update is based ONLY on
                    // deposit.userId.
                    //
                    // =================================

                    const user =
                        await User.findById(
                            deposit.userId
                        ).session(
                            session
                        );


                    if (
                        !user
                    ) {

                        throw new Error(
                            "User associated with this deposit was not found."
                        );

                    }


                    // =================================
                    // Validate Existing Balance
                    // =================================

                    const currentBalance =
                        Number(
                            user.balance || 0
                        );


                    if (
                        !Number.isFinite(
                            currentBalance
                        )
                    ) {

                        throw new Error(
                            "User balance is invalid."
                        );

                    }


                    // =================================
                    // Add Deposit Amount
                    // =================================

                    user.balance =
                        Number(
                            (
                                currentBalance +
                                amount
                            ).toFixed(8)
                        );


                    // =================================
                    // Save Updated User
                    // =================================

                    await user.save({

                        session,

                    });


                    // =================================
                    // Mark Deposit Approved
                    // =================================

                    deposit.status =
                        "approved";


                    deposit.processedAt =
                        new Date();


                    // =================================
                    // Save Deposit
                    // =================================

                    await deposit.save({

                        session,

                    });


                    // =================================
                    // Store Result
                    // =================================

                    result = {

                        depositId:
                            deposit._id,

                        userId:
                            user._id,

                        username:
                            user.username,

                        amount,

                        balance:
                            user.balance,

                    };

                }
            );


            // =========================================
            // Delete Processed Deposit Request
            // =========================================
            //
            // Transaction successfully committed,
            // therefore balance has already been added.
            //
            // =========================================

            await Deposit.deleteOne({

                _id:
                    depositId,

            });


            // =========================================
            // User Notification
            // =========================================

            await sendDepositNotification(

                result.username,

                "Deposit Approved",

                `Your deposit of ${result.amount} has been approved and added to your balance.`,

                "success"

            );


            // =========================================
            // Return Result
            // =========================================

            return {

                success:
                    true,

                message:
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

            };

        }

        catch (error) {

            console.error(
                "Accept Deposit Service Error:",
                error
            );


            throw error;

        }

        finally {

            // =========================================
            // Always Close Session
            // =========================================

            await session.endSession();

        }

    };


// =====================================================
// Reject Deposit
// =====================================================
//
// Flow:
//
// 1. Find pending request
// 2. Store user information
// 3. Delete request
// 4. DO NOT change balance
// 5. Send rejection notification
//
// =====================================================

export const rejectDeposit =
    async (
        depositId
    ) => {

        // =========================================
        // Validate Deposit ID
        // =========================================

        if (
            !depositId ||
            !isValidObjectId(
                depositId
            )
        ) {

            throw new Error(
                "Invalid deposit ID."
            );

        }


        // =========================================
        // Find Pending Deposit
        // =========================================

        const deposit =
            await Deposit.findOne({

                _id:
                    depositId,

                status:
                    "pending",

            });


        if (
            !deposit
        ) {

            throw new Error(
                "Deposit request not found or already processed."
            );

        }


        // =========================================
        // Validate User ID
        // =========================================

        if (
            !deposit.userId ||
            !isValidObjectId(
                deposit.userId
            )
        ) {

            throw new Error(
                "Deposit request has an invalid user."
            );

        }


        // =========================================
        // Validate Amount
        // =========================================

        const amount =
            normalizeAmount(
                deposit.amount
            );


        // =========================================
        // Store Information Before Delete
        // =========================================

        const result = {

            depositId:
                deposit._id,

            userId:
                deposit.userId,

            username:
                deposit.username,

            amount,

        };


        // =========================================
        // Delete Request
        // =========================================
        //
        // IMPORTANT:
        // No balance modification happens here.
        //
        // =========================================

        await Deposit.deleteOne({

            _id:
                deposit._id,

        });


        // =========================================
        // User Notification
        // =========================================

        await sendDepositNotification(

            result.username,

            "Deposit Rejected",

            `Your deposit request of ${result.amount} has been rejected.`,

            "error"

        );


        // =========================================
        // Return Result
        // =========================================

        return {

            success:
                true,

            message:
                "Deposit rejected successfully.",

            depositId:
                result.depositId,

            userId:
                result.userId,

            username:
                result.username,

            amount:
                result.amount,

        };

    };


// =====================================================
// Get Deposit Address
// =====================================================

export const getDepositAddress =
    async () => {

        // =========================================
        // Validate Configuration
        // =========================================

        if (
            !DEPOSIT_ADDRESS
        ) {

            throw new Error(
                "Deposit address is not configured."
            );

        }


        // =========================================
        // Return Address
        // =========================================

        return {

            address:
                DEPOSIT_ADDRESS,

        };

    };