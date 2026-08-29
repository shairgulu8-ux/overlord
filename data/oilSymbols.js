// =====================================================
// BobStock - Yahoo Finance Oil Symbols
// File: backend/data/oilSymbols.js
// =====================================================
//
// Oil instruments used by BobStock.
//
// USOIL -> WTI Crude Oil
// UKOIL -> Brent Crude Oil
//
// Yahoo Finance symbols:
// CL=F -> WTI Crude Oil Futures
// BZ=F -> Brent Crude Oil Futures
//
// stockService.js directly passes this array to
// fetchMultipleStocks(), therefore this file exports
// a simple array of Yahoo Finance symbols.
// =====================================================


const oilSymbols = [

    // =================================================
    // WTI Crude Oil
    // Display name: USOIL
    // Yahoo Finance: CL=F
    // =================================================

    "CL=F",


    // =================================================
    // Brent Crude Oil
    // Display name: UKOIL
    // Yahoo Finance: BZ=F
    // =================================================

    "BZ=F",

];


// =====================================================
// Export
// =====================================================

export default oilSymbols;