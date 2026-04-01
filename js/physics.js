// ODMR Spin-1 Physics Engine
// Hamiltonian: H = D·S_z² + γB·S_z
// All internal units: MHz (rates/frequencies), microseconds (time), mT (field)

export const CONSTANTS = {
    D: 2870,         // Zero-field splitting in MHz (2.87 GHz)
    gamma: 28.025,   // Gyromagnetic ratio in MHz/mT (= 28.025 GHz/T)
};

const OPTICAL_RATES = {
    // Minimal NV optical cycle: excited-state ISC is much stronger for m_s = ±1,
    // and singlet decay preferentially returns population to m_s = 0.
    kRad: 65,
    kISC0: 5,
    kISCpm: 35,
    kSinglet0: 6,
    kSingletPm: 0.5,
};

export const DEFAULTS = {
    omega: 2,           // Rabi frequency (MHz) — start narrow; increase to see power broadening
    omegaMW: 2870,      // MW frequency (MHz)
    thetaDeg: 45,       // Polarization angle (degrees) — linear
    gammaP: 10,         // Optical pumping rate (MHz)
    T1: 6.0,            // Spin-lattice relaxation (μs)
    T2: 0.3,            // Dephasing time (μs)
    // Single-NV mode
    B: 5.0,             // Magnetic field magnitude (mT)
    // Ensemble mode
    Bmag: 5.0,          // Field magnitude (mT)
    Btheta: 80,         // Polar angle θ (deg) — asymmetric direction → 8 distinct peaks
    Bphi: 27,           // Azimuthal angle φ (deg)
    ensembleMode: false,
};

// Four NV crystallographic orientations along ⟨111⟩ in a cubic lattice
const NV_ORIENTATIONS = [
    [ 1,  1,  1].map(v => v / Math.sqrt(3)),
    [ 1, -1, -1].map(v => v / Math.sqrt(3)),
    [-1,  1, -1].map(v => v / Math.sqrt(3)),
    [-1, -1,  1].map(v => v / Math.sqrt(3)),
];

const IDX = Object.freeze({
    gPlus: 0,
    gZero: 1,
    gMinus: 2,
    ePlus: 3,
    eZero: 4,
    eMinus: 5,
    singlet: 6,
});

/** Convert spherical angles to Cartesian B vector */
export function bVectorFromAngles(Bmag, Btheta, Bphi) {
    const t = Btheta * Math.PI / 180;
    const p = Bphi * Math.PI / 180;
    return [
        Bmag * Math.sin(t) * Math.cos(p),
        Bmag * Math.sin(t) * Math.sin(p),
        Bmag * Math.cos(t),
    ];
}

/** Dot-product projection of B vector onto an NV orientation axis */
function projectB(BVec, orient) {
    return BVec[0] * orient[0] + BVec[1] * orient[1] + BVec[2] * orient[2];
}

/**
 * Core: compute MW transition rates for an explicit B_parallel value.
 * W± = Ω±² T2 / (1 + Δ±² T2² + Ω±² T1 T2)
 */
function transitionRatesForB(params, Bparallel) {
    const { omega, thetaDeg, omegaMW, T1, T2 } = params;
    const thetaRad = thetaDeg * Math.PI / 180;
    const omegaPlus  = omega * Math.cos(thetaRad);
    const omegaMinus = omega * Math.sin(thetaRad);

    const freqPlus  = CONSTANTS.D + CONSTANTS.gamma * Bparallel;
    const freqMinus = CONSTANTS.D - CONSTANTS.gamma * Bparallel;

    const deltaPlus  = omegaMW - freqPlus;
    const deltaMinus = omegaMW - freqMinus;

    const Wp = (omegaPlus  * omegaPlus  * T2) /
               (1 + deltaPlus  * deltaPlus  * T2 * T2 + omegaPlus  * omegaPlus  * T1 * T2);
    const Wm = (omegaMinus * omegaMinus * T2) /
               (1 + deltaMinus * deltaMinus * T2 * T2 + omegaMinus * omegaMinus * T1 * T2);

    return { Wp, Wm, freqPlus, freqMinus };
}

/**
 * Core: analytical steady-state populations for a given B_parallel.
 * Solves 2×2 system via Cramer's rule.
 */
function addTransition(matrix, from, to, rate) {
    matrix[to][from] += rate;
    matrix[from][from] -= rate;
}

function buildRateMatrix(params, Bparallel) {
    const n = 7;
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));
    const { gammaP, T1 } = params;
    const gamma1 = 1 / T1;
    const { Wp, Wm } = transitionRatesForB(params, Bparallel);

    // Microwave-driven spin flips in the ground state manifold.
    addTransition(matrix, IDX.gZero,  IDX.gPlus,  Wp);
    addTransition(matrix, IDX.gPlus,  IDX.gZero,  Wp);
    addTransition(matrix, IDX.gZero,  IDX.gMinus, Wm);
    addTransition(matrix, IDX.gMinus, IDX.gZero,  Wm);

    // High-temperature spin-lattice relaxation in the ground state manifold.
    addTransition(matrix, IDX.gZero,  IDX.gPlus,  gamma1 / 3);
    addTransition(matrix, IDX.gPlus,  IDX.gZero,  gamma1 / 3);
    addTransition(matrix, IDX.gZero,  IDX.gMinus, gamma1 / 3);
    addTransition(matrix, IDX.gMinus, IDX.gZero,  gamma1 / 3);

    // Optical excitation.
    addTransition(matrix, IDX.gPlus,  IDX.ePlus,  gammaP);
    addTransition(matrix, IDX.gZero,  IDX.eZero,  gammaP);
    addTransition(matrix, IDX.gMinus, IDX.eMinus, gammaP);

    // Spin-conserving radiative decay.
    addTransition(matrix, IDX.ePlus,  IDX.gPlus,  OPTICAL_RATES.kRad);
    addTransition(matrix, IDX.eZero,  IDX.gZero,  OPTICAL_RATES.kRad);
    addTransition(matrix, IDX.eMinus, IDX.gMinus, OPTICAL_RATES.kRad);

    // Spin-selective intersystem crossing from the excited state.
    addTransition(matrix, IDX.ePlus,  IDX.singlet, OPTICAL_RATES.kISCpm);
    addTransition(matrix, IDX.eMinus, IDX.singlet, OPTICAL_RATES.kISCpm);
    addTransition(matrix, IDX.eZero,  IDX.singlet, OPTICAL_RATES.kISC0);

    // Preferential return from singlet to m_s = 0.
    addTransition(matrix, IDX.singlet, IDX.gZero,  OPTICAL_RATES.kSinglet0);
    addTransition(matrix, IDX.singlet, IDX.gPlus,  OPTICAL_RATES.kSingletPm);
    addTransition(matrix, IDX.singlet, IDX.gMinus, OPTICAL_RATES.kSingletPm);

    return matrix;
}

function solveLinearSystem(matrix, rhs) {
    const n = rhs.length;
    const a = matrix.map((row, i) => row.slice().concat(rhs[i]));

    for (let col = 0; col < n; col++) {
        let pivot = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
        }
        if (Math.abs(a[pivot][col]) < 1e-12) return null;
        if (pivot !== col) [a[col], a[pivot]] = [a[pivot], a[col]];

        const pivotVal = a[col][col];
        for (let j = col; j <= n; j++) a[col][j] /= pivotVal;

        for (let row = 0; row < n; row++) {
            if (row === col) continue;
            const factor = a[row][col];
            if (factor === 0) continue;
            for (let j = col; j <= n; j++) a[row][j] -= factor * a[col][j];
        }
    }

    return a.map(row => row[n]);
}

function populationsFromState(state) {
    return {
        rhoPlus: state[IDX.gPlus],
        rhoZero: state[IDX.gZero],
        rhoMinus: state[IDX.gMinus],
    };
}

function steadyStateForB(params, Bparallel) {
    const matrix = buildRateMatrix(params, Bparallel);
    const normalized = matrix.map(row => row.slice());
    const rhs = Array(7).fill(0);

    normalized[6] = Array(7).fill(1);
    rhs[6] = 1;

    const state = solveLinearSystem(normalized, rhs);
    if (!state) {
        return { rhoPlus: 1 / 3, rhoZero: 1 / 3, rhoMinus: 1 / 3 };
    }
    return populationsFromState(state);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Transition rates for single-NV mode (uses params.B scalar). */
export function computeTransitionRates(params) {
    const rates = transitionRatesForB(params, params.B);
    return { ...rates, deltaPlus: params.omegaMW - rates.freqPlus, deltaMinus: params.omegaMW - rates.freqMinus };
}

/** Steady-state populations for single-NV mode. */
export function computeSteadyState(params) {
    return steadyStateForB(params, params.B);
}

/** Rate equations RHS for ODE integrator (single-NV). */
export function rateEquationsRHS(state, params) {
    const matrix = buildRateMatrix(params, params.B);
    return matrix.map(row =>
        row.reduce((sum, coeff, i) => sum + coeff * state[i], 0)
    );
}

/**
 * ODMR spectrum for single NV.
 * Returns raw rhoZero, ODMR contrast (%), and resonance frequency markers.
 * Contrast = (ρ₀_off − ρ₀(f)) / ρ₀_off × 100
 */
export function computeODMRSpectrum(params, freqMin, freqMax, nPoints) {
    const rhoZero_off = steadyStateForB({ ...params, omega: 0 }, params.B).rhoZero;
    const step = (freqMax - freqMin) / (nPoints - 1);

    const frequencies = [], rhoZeroValues = [], contrastValues = [];
    for (let i = 0; i < nPoints; i++) {
        const freq = freqMin + i * step;
        const { rhoZero } = steadyStateForB({ ...params, omegaMW: freq }, params.B);
        frequencies.push(freq);
        rhoZeroValues.push(rhoZero);
        contrastValues.push((rhoZero_off - rhoZero) / rhoZero_off * 100);
    }

    const { freqPlus, freqMinus } = transitionRatesForB(params, params.B);
    return { frequencies, rhoZeroValues, contrastValues, resonanceFreqs: [freqPlus, freqMinus] };
}

/**
 * ODMR spectrum for NV ensemble (4 orientations → 8 peaks).
 * B field given as magnitude + spherical angles; equal weight per orientation.
 */
export function computeODMRSpectrumEnsemble(params, freqMin, freqMax, nPoints) {
    const BVec = bVectorFromAngles(params.Bmag, params.Btheta, params.Bphi);
    const Bparallels = NV_ORIENTATIONS.map(u => projectB(BVec, u));

    // Off-resonance background (average across orientations, no MW drive)
    const offParams = { ...params, omega: 0 };
    const rhoZero_off = Bparallels.reduce((sum, Bp) =>
        sum + steadyStateForB(offParams, Bp).rhoZero, 0) / 4;

    const step = (freqMax - freqMin) / (nPoints - 1);
    const frequencies = [], rhoZeroValues = [], contrastValues = [];

    for (let i = 0; i < nPoints; i++) {
        const freq = freqMin + i * step;
        const sweepParams = { ...params, omegaMW: freq };
        const avgRhoZero = Bparallels.reduce((sum, Bp) =>
            sum + steadyStateForB(sweepParams, Bp).rhoZero, 0) / 4;
        frequencies.push(freq);
        rhoZeroValues.push(avgRhoZero);
        contrastValues.push((rhoZero_off - avgRhoZero) / rhoZero_off * 100);
    }

    // All 8 resonance frequencies (may include negative → shown only if in sweep range)
    const resonanceFreqs = Bparallels.flatMap(Bp => [
        CONSTANTS.D + CONSTANTS.gamma * Bp,
        CONSTANTS.D - CONSTANTS.gamma * Bp,
    ]);

    return { frequencies, rhoZeroValues, contrastValues, resonanceFreqs, Bparallels };
}

/**
 * Compute FWHM (MHz) and peak on-resonance contrast (%) for both transitions.
 * FWHM = 2√(1 + Ω±² T₁T₂) / T₂  (power-broadened Lorentzian half-width)
 */
export function computeLinewidths(params) {
    const { omega, thetaDeg, T1, T2, gammaP } = params;
    const thetaRad = thetaDeg * Math.PI / 180;
    const omegaPlus  = omega * Math.cos(thetaRad);
    const omegaMinus = omega * Math.sin(thetaRad);

    const fwhmPlus  = 2 * Math.sqrt(1 + omegaPlus  * omegaPlus  * T1 * T2) / T2;
    const fwhmMinus = 2 * Math.sqrt(1 + omegaMinus * omegaMinus * T1 * T2) / T2;

    // Peak W at Δ=0
    const WmaxPlus  = (omegaPlus  * omegaPlus  * T2) / (1 + omegaPlus  * omegaPlus  * T1 * T2);
    const WmaxMinus = (omegaMinus * omegaMinus * T2) / (1 + omegaMinus * omegaMinus * T1 * T2);

    // Contrast at each resonance (single-NV approximation: ≈ W / (Γ_p + W))
    const Bparam = params.ensembleMode ? params.Bmag : params.B;
    const rhoOff = steadyStateForB({ ...params, omega: 0 }, Bparam).rhoZero;
    const rhoPlusOn  = steadyStateForB({ ...params, omegaMW: CONSTANTS.D + CONSTANTS.gamma * Bparam }, Bparam).rhoZero;
    const rhoMinusOn = steadyStateForB({ ...params, omegaMW: CONSTANTS.D - CONSTANTS.gamma * Bparam }, Bparam).rhoZero;
    const contrastPlus  = (rhoOff - rhoPlusOn)  / rhoOff * 100;
    const contrastMinus = (rhoOff - rhoMinusOn) / rhoOff * 100;

    return { fwhmPlus, fwhmMinus, contrastPlus, contrastMinus };
}

/**
 * Compute the off-resonance baseline populations (omega = 0).
 * Used by bar chart to show fractional change.
 */
export function computeBaseline(params) {
    if (params.ensembleMode) {
        const BVec = bVectorFromAngles(params.Bmag, params.Btheta, params.Bphi);
        const Bparallels = NV_ORIENTATIONS.map(u => projectB(BVec, u));
        const offParams = { ...params, omega: 0 };
        let rhoPlus = 0, rhoZero = 0, rhoMinus = 0;
        for (const Bp of Bparallels) {
            const p = steadyStateForB(offParams, Bp);
            rhoPlus  += p.rhoPlus;
            rhoZero  += p.rhoZero;
            rhoMinus += p.rhoMinus;
        }
        return { rhoPlus: rhoPlus / 4, rhoZero: rhoZero / 4, rhoMinus: rhoMinus / 4 };
    }
    return steadyStateForB({ ...params, omega: 0 }, params.B);
}
