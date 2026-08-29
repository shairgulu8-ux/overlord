import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        // =====================================================
        // BASIC USER INFORMATION
        // =====================================================

        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            minlength: 4,
            maxlength: 20,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },

        phone: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        invitationCode: {
            type: String,
            required: true,
            trim: true,
            uppercase: true,
        },

        password: {
            type: String,
            required: true,
        },

        password1: {
            type: String,
            default: "",
        },


        // =====================================================
        // WALLET / BALANCE
        // =====================================================

        /*
        |--------------------------------------------------------------------------
        | Account Balance
        |--------------------------------------------------------------------------
        |
        | Existing deposit / withdrawal system uses this field.
        |
        | IMPORTANT:
        | We keep "balance" as the main wallet balance so existing
        | deposit/withdraw functionality does not break.
        |
        */

        balance: {
            type: Number,
            default: 0,
            min: 0,
        },


        /*
        |--------------------------------------------------------------------------
        | Used Margin
        |--------------------------------------------------------------------------
        |
        | Total margin currently locked in active leveraged positions.
        |
        | Example:
        |
        | Account Balance = 10,000
        | Used Margin    = 1,000
        | Available      = 9,000
        |
        | This value is maintained by the trading layer.
        |
        */

        usedMargin: {
            type: Number,
            default: 0,
            min: 0,
        },


        /*
        |--------------------------------------------------------------------------
        | Available Trading Balance
        |--------------------------------------------------------------------------
        |
        | This is kept as a cached value for fast frontend display.
        |
        | The authoritative wallet source remains "balance".
        | The trading service must update this value whenever margin
        | is reserved/released.
        |
        */

        availableBalance: {
            type: Number,
            default: 0,
            min: 0,
        },


        /*
        |--------------------------------------------------------------------------
        | Total Realized Trading P&L
        |--------------------------------------------------------------------------
        |
        | Keeps a running total of realized profit/loss from trading.
        |
        */

        realizedTradingProfit: {
            type: Number,
            default: 0,
        },


        /*
        |--------------------------------------------------------------------------
        | Total Trading Fees
        |--------------------------------------------------------------------------
        |
        | Running total of fees charged through trading.
        |
        */

        totalTradingFees: {
            type: Number,
            default: 0,
            min: 0,
        },


        // =====================================================
        // CREDIT SCORE
        // =====================================================

        creditScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },


        // =====================================================
        // USER ROLE
        // =====================================================

        role: {
            type: String,
            enum: ["user", "admin"],
            default: "user",
        },


        // =====================================================
        // KYC STATUS
        // =====================================================

        isKycVerified: {
            type: Boolean,
            default: false,
        },


        // =====================================================
        // EMAIL VERIFICATION
        // =====================================================

        isEmailVerified: {
            type: Boolean,
            default: false,
        },


        /*
        |--------------------------------------------------------------------------
        | KYC
        |--------------------------------------------------------------------------
        */

        kyc: {

            status: {
                type: String,
                enum: [
                    "not_started",
                    "pending",
                    "approved",
                    "rejected",
                ],
                default: "not_started",
            },

            fullName: {
                type: String,
                default: "",
                trim: true,
            },

            idNumber: {
                type: String,
                default: "",
                trim: true,
            },

            idFront: {
                type: String,
                default: "",
            },

            idBack: {
                type: String,
                default: "",
            },

            submittedAt: {
                type: Date,
                default: null,
            },

            approvedAt: {
                type: Date,
                default: null,
            },

            rejectedReason: {
                type: String,
                default: "",
            },

        },


        /*
        |--------------------------------------------------------------------------
        | BANK DETAILS
        |--------------------------------------------------------------------------
        */

        bankDetails: {

            bankName: {
                type: String,
                default: "",
                trim: true,
            },

            holderName: {
                type: String,
                default: "",
                trim: true,
            },

            accountNumber: {
                type: String,
                default: "",
                trim: true,
            },

            ifsc: {
                type: String,
                default: "",
                trim: true,
                uppercase: true,
            },

            isAdded: {
                type: Boolean,
                default: false,
            },

            addedAt: {
                type: Date,
                default: null,
            },

        },


        // =====================================================
        // LAST LOGIN
        // =====================================================

        lastLogin: {
            type: Date,
            default: null,
        },

    },

    {
        timestamps: true,
    }
);


// =====================================================
// USER MODEL
// =====================================================

const User = mongoose.model(
    "User",
    userSchema
);


export default User;