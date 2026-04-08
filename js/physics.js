(() => {
// ODMR Spin-1 Physics Engine
// Hamiltonian: H/h = D S_z² + γ B0·S + γ B1(t)·S.
// MW transition strengths use the circular transverse components of B1 in
// each NV's local frame. Optical pumping can be weighted by laser polarization.
// All internal units: MHz (rates/frequencies), microseconds (time), mT (field)

const CONSTANTS = {
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

const DEFAULTS = {
    omega: 0.15,        // Rabi frequency (MHz) — manuscript anchor: ~-20 dBm corresponds to sub-MHz drive
    omegaMW: 2870,      // MW frequency (MHz)
    thetaDeg: 45,       // MW ellipticity (degrees): 0 σ+, 45 linear, 90 σ-
    laserPolDeg: 0,     // Laser E-field angle in the lab x-y plane (degrees)
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
const SINGLE_NV_ORIENTATION = NV_ORIENTATIONS[0];

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
function bVectorFromAngles(Bmag, Btheta, Bphi) {
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

function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ];
}

function norm(v) {
    return Math.sqrt(dot(v, v));
}

function normalize(v) {
    const n = norm(v);
    return n > 1e-12 ? v.map(x => x / n) : [1, 0, 0];
}

function localBasis(nvAxis) {
    const n = normalize(nvAxis);
    const ref = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const e1 = normalize(cross(ref, n));
    const e2 = cross(n, e1);
    return { e1, e2 };
}

function laserPolarizationVector(params) {
    const phi = (params.laserPolDeg || 0) * Math.PI / 180;
    return [Math.cos(phi), Math.sin(phi), 0];
}

function opticalWeight(params, nvAxis) {
    if (!nvAxis) return 1;

    // NV optical absorption comes from two orthogonal dipoles transverse to the
    // NV axis, so linearly polarized excitation scales as |E × n_NV|².
    const eLaser = laserPolarizationVector(params);
    const absorption = Math.max(0, 1 - Math.pow(dot(eLaser, normalize(nvAxis)), 2));
    return absorption / (2 / 3);
}

function opticalPumpRate(params, nvAxis) {
    return params.gammaP * opticalWeight(params, nvAxis);
}

function weightedPopulationAverage(entries) {
    let weightSum = 0;
    let rhoPlus = 0, rhoZero = 0, rhoMinus = 0;
    for (const entry of entries) {
        const weight = entry.weight;
        weightSum += weight;
        rhoPlus  += entry.pop.rhoPlus  * weight;
        rhoZero  += entry.pop.rhoZero  * weight;
        rhoMinus += entry.pop.rhoMinus * weight;
    }
    if (weightSum <= 1e-15) return { rhoPlus: 1 / 3, rhoZero: 1 / 3, rhoMinus: 1 / 3 };
    return { rhoPlus: rhoPlus / weightSum, rhoZero: rhoZero / weightSum, rhoMinus: rhoMinus / weightSum };
}

function complexDotReal(complexVec, realVec) {
    return {
        re: complexVec.re[0] * realVec[0] + complexVec.re[1] * realVec[1] + complexVec.re[2] * realVec[2],
        im: complexVec.im[0] * realVec[0] + complexVec.im[1] * realVec[1] + complexVec.im[2] * realVec[2],
    };
}

function complexAbs(z) {
    return Math.sqrt(z.re * z.re + z.im * z.im);
}

function mwComplexVector(params) {
    const chi = params.thetaDeg * Math.PI / 180;
    const aPlus = Math.cos(chi);
    const aMinus = Math.sin(chi);
    const invSqrt2 = 1 / Math.sqrt(2);

    // Lab-frame circular basis around z: e_+ = (x - i y)/sqrt(2),
    // e_- = (x + i y)/sqrt(2). chi = 45° gives a linear x-polarized B1.
    return {
        re: [(aPlus + aMinus) * invSqrt2, 0, 0],
        im: [0, (-aPlus + aMinus) * invSqrt2, 0],
    };
}

function mwRabiFrequencies(params, nvAxis) {
    const { e1, e2 } = localBasis(nvAxis || [0, 0, 1]);
    const bMw = mwComplexVector(params);
    const b1 = complexDotReal(bMw, e1);
    const b2 = complexDotReal(bMw, e2);
    const invSqrt2 = 1 / Math.sqrt(2);

    const circularPlus = {
        re: (b1.re - b2.im) * invSqrt2,
        im: (b1.im + b2.re) * invSqrt2,
    };
    const circularMinus = {
        re: (b1.re + b2.im) * invSqrt2,
        im: (b1.im - b2.re) * invSqrt2,
    };

    return {
        omegaPlus: params.omega * complexAbs(circularPlus),
        omegaMinus: params.omega * complexAbs(circularMinus),
    };
}

/**
 * Core: compute MW transition rates for an explicit B_parallel value.
 * W± = Ω±² T2 / (1 + Δ±² T2² + Ω±² T1 T2)
 */
function transitionRatesForB(params, Bparallel, nvAxis) {
    const { omegaMW, T1, T2 } = params;
    const { omegaPlus, omegaMinus } = mwRabiFrequencies(params, nvAxis);

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

function buildRateMatrix(params, Bparallel, nvAxis) {
    const n = 7;
    const matrix = Array.from({ length: n }, () => Array(n).fill(0));
    const { T1 } = params;
    const gammaP = opticalPumpRate(params, nvAxis);
    const gamma1 = 1 / T1;
    const { Wp, Wm } = transitionRatesForB(params, Bparallel, nvAxis);

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
    const groundTotal = state[IDX.gPlus] + state[IDX.gZero] + state[IDX.gMinus];
    if (groundTotal <= 1e-15) {
        return { rhoPlus: 1 / 3, rhoZero: 1 / 3, rhoMinus: 1 / 3 };
    }
    return {
        rhoPlus: state[IDX.gPlus] / groundTotal,
        rhoZero: state[IDX.gZero] / groundTotal,
        rhoMinus: state[IDX.gMinus] / groundTotal,
    };
}

function steadyStateForB(params, Bparallel, nvAxis) {
    const matrix = buildRateMatrix(params, Bparallel, nvAxis);
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

/** Transition rates for single-NV mode. */
function computeTransitionRates(params) {
    const rates = transitionRatesForB(params, params.B, SINGLE_NV_ORIENTATION);
    return { ...rates, deltaPlus: params.omegaMW - rates.freqPlus, deltaMinus: params.omegaMW - rates.freqMinus };
}

/** Steady-state populations for single-NV mode. */
function computeSteadyState(params) {
    return steadyStateForB(params, params.B, SINGLE_NV_ORIENTATION);
}

/** Rate equations RHS for ODE integrator (single-NV). */
function rateEquationsRHS(state, params) {
    const matrix = buildRateMatrix(params, params.B, SINGLE_NV_ORIENTATION);
    return matrix.map(row =>
        row.reduce((sum, coeff, i) => sum + coeff * state[i], 0)
    );
}

/**
 * ODMR spectrum for single NV.
 * Returns raw rhoZero, ODMR contrast (%), and resonance frequency markers.
 * Contrast = (ρ₀_off − ρ₀(f)) / ρ₀_off × 100
 */
function computeODMRSpectrum(params, freqMin, freqMax, nPoints) {
    const rhoZero_off = steadyStateForB({ ...params, omega: 0 }, params.B, SINGLE_NV_ORIENTATION).rhoZero;
    const step = (freqMax - freqMin) / (nPoints - 1);

    const frequencies = [], rhoZeroValues = [], contrastValues = [];
    for (let i = 0; i < nPoints; i++) {
        const freq = freqMin + i * step;
        const { rhoZero } = steadyStateForB({ ...params, omegaMW: freq }, params.B, SINGLE_NV_ORIENTATION);
        frequencies.push(freq);
        rhoZeroValues.push(rhoZero);
        contrastValues.push((rhoZero_off - rhoZero) / rhoZero_off * 100);
    }

    const { freqPlus, freqMinus } = transitionRatesForB(params, params.B, SINGLE_NV_ORIENTATION);
    return { frequencies, rhoZeroValues, contrastValues, resonanceFreqs: [freqPlus, freqMinus] };
}

/**
 * ODMR spectrum for NV ensemble (4 orientations → 8 peaks).
 * B field given as magnitude + spherical angles; equal weight per orientation.
 */
function computeODMRSpectrumEnsemble(params, freqMin, freqMax, nPoints) {
    const BVec = bVectorFromAngles(params.Bmag, params.Btheta, params.Bphi);
    const Bparallels = NV_ORIENTATIONS.map(u => projectB(BVec, u));

    // Off-resonance background (average across orientations, no MW drive)
    const offParams = { ...params, omega: 0 };
    const rhoZero_off = weightedPopulationAverage(Bparallels.map((Bp, i) => ({
        pop: steadyStateForB(offParams, Bp, NV_ORIENTATIONS[i]),
        weight: opticalWeight(params, NV_ORIENTATIONS[i]),
    }))).rhoZero;

    const step = (freqMax - freqMin) / (nPoints - 1);
    const frequencies = [], rhoZeroValues = [], contrastValues = [];

    for (let i = 0; i < nPoints; i++) {
        const freq = freqMin + i * step;
        const sweepParams = { ...params, omegaMW: freq };
        const avgRhoZero = weightedPopulationAverage(Bparallels.map((Bp, j) => ({
            pop: steadyStateForB(sweepParams, Bp, NV_ORIENTATIONS[j]),
            weight: opticalWeight(params, NV_ORIENTATIONS[j]),
        }))).rhoZero;
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
function computeLinewidths(params) {
    const { T1, T2 } = params;
    const { omegaPlus, omegaMinus } = mwRabiFrequencies(params, SINGLE_NV_ORIENTATION);

    const fwhmPlus  = 2 * Math.sqrt(1 + omegaPlus  * omegaPlus  * T1 * T2) / T2;
    const fwhmMinus = 2 * Math.sqrt(1 + omegaMinus * omegaMinus * T1 * T2) / T2;

    // Contrast at each resonance.
    const Bparam = params.B;
    const rhoOff = steadyStateForB({ ...params, omega: 0 }, Bparam, SINGLE_NV_ORIENTATION).rhoZero;
    const rhoPlusOn  = steadyStateForB({ ...params, omegaMW: CONSTANTS.D + CONSTANTS.gamma * Bparam }, Bparam, SINGLE_NV_ORIENTATION).rhoZero;
    const rhoMinusOn = steadyStateForB({ ...params, omegaMW: CONSTANTS.D - CONSTANTS.gamma * Bparam }, Bparam, SINGLE_NV_ORIENTATION).rhoZero;
    const contrastPlus  = (rhoOff - rhoPlusOn)  / rhoOff * 100;
    const contrastMinus = (rhoOff - rhoMinusOn) / rhoOff * 100;

    return { fwhmPlus, fwhmMinus, contrastPlus, contrastMinus };
}

/**
 * Compute the off-resonance baseline populations (omega = 0).
 * Used by bar chart to show fractional change.
 */
function computeBaseline(params) {
    if (params.ensembleMode) {
        const BVec = bVectorFromAngles(params.Bmag, params.Btheta, params.Bphi);
        const Bparallels = NV_ORIENTATIONS.map(u => projectB(BVec, u));
        const offParams = { ...params, omega: 0 };
        return weightedPopulationAverage(Bparallels.map((Bp, i) => ({
            pop: steadyStateForB(offParams, Bp, NV_ORIENTATIONS[i]),
            weight: opticalWeight(params, NV_ORIENTATIONS[i]),
        })));
    }
    return steadyStateForB({ ...params, omega: 0 }, params.B, SINGLE_NV_ORIENTATION);
}

function computeEnsembleSteadyState(params) {
    const BVec = bVectorFromAngles(params.Bmag, params.Btheta, params.Bphi);
    const Bparallels = NV_ORIENTATIONS.map(u => projectB(BVec, u));
    return weightedPopulationAverage(Bparallels.map((Bp, i) => ({
        pop: steadyStateForB(params, Bp, NV_ORIENTATIONS[i]),
        weight: opticalWeight(params, NV_ORIENTATIONS[i]),
    })));
}

window.ODMRPhysics = {
    CONSTANTS,
    DEFAULTS,
    bVectorFromAngles,
    computeTransitionRates,
    computeSteadyState,
    computeEnsembleSteadyState,
    rateEquationsRHS,
    computeODMRSpectrum,
    computeODMRSpectrumEnsemble,
    computeLinewidths,
    computeBaseline,
};
})();
