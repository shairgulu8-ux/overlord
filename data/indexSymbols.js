// =====================================================
// BobStock - Yahoo Finance Index Symbols
// File: backend/data/indexSymbols.js
// =====================================================
//
// Display name  -> Yahoo Finance symbol
//
// US30          -> ^DJI
// US500         -> ^GSPC
// NAS100        -> ^IXIC
// UK100         -> ^FTSE
// GER30         -> ^GDAXI
// FRA40         -> ^FCHI
// JPN225        -> ^N225
// AUS200        -> ^AXJO
// ESP35         -> ^IBEX
//
// stockService.js directly passes this array to
// fetchMultipleStocks(), therefore this file exports
// a simple array of Yahoo Finance symbols.
// =====================================================


const indexSymbols = [

    // =================================================
    // United States
    // =================================================

    "^DJI",       // US30 - Dow Jones Industrial Average

    "^GSPC",      // US500 - S&P 500

    "^IXIC",      // NAS100 - Nasdaq Composite


    // =================================================
    // Europe
    // =================================================

    "^FTSE",      // UK100 - FTSE 100

    "^GDAXI",     // GER30 - DAX

    "^FCHI",      // FRA40 - CAC 40


    // =================================================
    // Asia Pacific
    // =================================================

    "^N225",      // JPN225 - Nikkei 225

    "^AXJO",      // AUS200 - S&P/ASX 200


    // =================================================
    // Spain
    // =================================================

    "^IBEX",      // ESP35 - IBEX 35

];


// =====================================================
// Export
// =====================================================

export default indexSymbols;