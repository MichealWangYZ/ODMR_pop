// ODMR Spin-1 Physics Engine
// Hamiltonian: H = D·S_z² + γB·S_z
// All internal units: MHz (rates/frequencies), microseconds (time), mT (field)

export const CONSTANTS = {
    D: 2870,         // Zero-field splitting in MHz (2.87 GHz)
    gamma: 28.025,   // Gyromagnetic ratio in MHz/mT (= 28.025 GHz/T)
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
function steadyStateForB(params, Bparallel) {
    const { gammaP, T1 } = params;
    const gamma1 = 1 / T1;
    const { Wp, Wm } = transitionRatesForB(params, Bparallel);

    const aPlus  = gammaP + gamma1 / 3 + Wp;
    const aMinus = gammaP + gamma1 / 3 + Wm;
    const bPlus  = gamma1 / 3 + Wp;
    const bMinus = gamma1 / 3 + Wm;

    const det = aPlus * aMinus - bPlus * bMinus;
    if (Math.abs(det) < 1e-15) {
        return { rhoPlus: 1 / 3, rhoZero: 1 / 3, rhoMinus: 1 / 3 };
    }

    const rhoPlus  = (bPlus  * gammaP) / det;
    const rhoMinus = (bMinus * gammaP) / det;
    return { rhoPlus, rhoZero: 1 - rhoPlus - rhoMinus, rhoMinus };
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
    const [rhoPlus, rhoMinus] = state;
    const rhoZero = 1 - rhoPlus - rhoMinus;
    const { gammaP, T1 } = params;
    const gamma1 = 1 / T1;
    const { Wp, Wm } = transitionRatesForB(params, params.B);

    return [
        -gammaP * rhoPlus  + gamma1 * (rhoZero - rhoPlus)  / 3 + Wp * (rhoZero - rhoPlus),
        -gammaP * rhoMinus + gamma1 * (rhoZero - rhoMinus) / 3 + Wm * (rhoZero - rhoMinus),
    ];
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
