// =====================================================
// BobStock - Yahoo Finance Forex Symbols
// File: backend/data/forexSymbols.js
// =====================================================
//
// Only the Forex pairs shown on the BobStock dashboard
// are included here.
//
// Yahoo Finance forex symbols use the format:
// CURRENCYPAIR=X
//
// =====================================================

const forexSymbols = [

    // =================================================
    // Major Forex Pairs
    // =================================================

    "EURUSD=X",     // EUR / USD
    "GBPUSD=X",     // GBP / USD
    "USDJPY=X",     // USD / JPY
    "USDCHF=X",     // USD / CHF
    "USDCAD=X",     // USD / CAD
    "AUDUSD=X",     // AUD / USD
    "NZDUSD=X",     // NZD / USD


    // =================================================
    // EUR Cross Pairs
    // =================================================

    "EURGBP=X",     // EUR / GBP
    "EURJPY=X",     // EUR / JPY
    "EURCAD=X",     // EUR / CAD
    "EURAUD=X",     // EUR / AUD
    "EURNZD=X",     // EUR / NZD
    "EURCHF=X",     // EUR / CHF


    // =================================================
    // GBP Cross Pairs
    // =================================================

    "GBPJPY=X",     // GBP / JPY
    "GBPNZD=X",     // GBP / NZD
    "GBPAUD=X",     // GBP / AUD


    // =================================================
    // JPY Cross Pairs
    // =================================================

    "NZDJPY=X",     // NZD / JPY
    "CADJPY=X",     // CAD / JPY
    "AUDJPY=X",     // AUD / JPY


    // =================================================
    // AUD / NZD
    // =================================================

    "AUDNZD=X",     // AUD / NZD

];


// =====================================================
// Export
// =====================================================

export default forexSymbols;