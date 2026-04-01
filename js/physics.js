// ODMR Spin-1 Physics Engine
// Hamiltonian: H = D·S_z² + γB·S_z
// All internal units: MHz (rates/frequencies), microseconds (time), mT (field)

export const CONSTANTS = {
    D: 2870,         // Zero-field splitting in MHz (2.87 GHz)
    gamma: 28.025,   // Gyromagnetic ratio in MHz/mT (= 28.025 GHz/T)
};

export const DEFAULTS = {
    omega: 5,           // Rabi frequency (MHz)
    omegaMW: 2870,      // MW frequency (MHz) — on resonance with D
    thetaDeg: 45,       // Polarization angle (degrees) — linear
    gammaP: 10,         // Optical pumping rate (MHz)
    T1: 6.0,            // Spin-lattice relaxation (μs)
    T2: 0.3,            // Dephasing time (μs)
    B: 5.0,             // Magnetic field (mT)
};

/**
 * Compute microwave transition rates W+ and W-
 * W± = Ω±² T2 / (1 + Δ±² T2² + Ω±² T1 T2)
 */
export function computeTransitionRates(params) {
    const { omega, thetaDeg, omegaMW, B, T1, T2 } = params;
    const thetaRad = thetaDeg * Math.PI / 180;

    const omegaPlus = omega * Math.cos(thetaRad);
    const omegaMinus = omega * Math.sin(thetaRad);

    // Transition frequencies: D ± γB (in MHz)
    const freqPlus = CONSTANTS.D + CONSTANTS.gamma * B;
    const freqMinus = CONSTANTS.D - CONSTANTS.gamma * B;

    // Detunings (MHz)
    const deltaPlus = omegaMW - freqPlus;
    const deltaMinus = omegaMW - freqMinus;

    // Transition rates (MHz)
    const Wp = (omegaPlus * omegaPlus * T2) /
        (1 + deltaPlus * deltaPlus * T2 * T2 + omegaPlus * omegaPlus * T1 * T2);
    const Wm = (omegaMinus * omegaMinus * T2) /
        (1 + deltaMinus * deltaMinus * T2 * T2 + omegaMinus * omegaMinus * T1 * T2);

    return { Wp, Wm, deltaPlus, deltaMinus, freqPlus, freqMinus };
}

/**
 * Analytical steady-state populations via Cramer's rule on 2×2 system.
 * Returns { rhoPlus, rhoZero, rhoMinus }
 */
export function computeSteadyState(params) {
    const { gammaP, T1 } = params;
    const gamma1 = 1 / T1; // Relaxation rate (MHz)
    const { Wp, Wm } = computeTransitionRates(params);

    const aPlus = gammaP + gamma1 / 3 + Wp;
    const aMinus = gammaP + gamma1 / 3 + Wm;
    const bPlus = gamma1 / 3 + Wp;
    const bMinus = gamma1 / 3 + Wm;

    const det = aPlus * aMinus - bPlus * bMinus;

    if (Math.abs(det) < 1e-15) {
        return { rhoPlus: 1 / 3, rhoZero: 1 / 3, rhoMinus: 1 / 3 };
    }

    const rhoPlus = (bPlus * gammaP) / det;
    const rhoMinus = (bMinus * gammaP) / det;
    const rhoZero = 1 - rhoPlus - rhoMinus;

    return { rhoPlus, rhoZero, rhoMinus };
}

/**
 * Rate equations right-hand side for ODE integration.
 * state = [rhoPlus, rhoMinus] (rhoZero = 1 - sum)
 */
export function rateEquationsRHS(state, params) {
    const [rhoPlus, rhoMinus] = state;
    const rhoZero = 1 - rhoPlus - rhoMinus;
    const { gammaP, T1 } = params;
    const gamma1 = 1 / T1;
    const { Wp, Wm } = computeTransitionRates(params);

    const dRhoPlus = -gammaP * rhoPlus + gamma1 * (rhoZero - rhoPlus) / 3 + Wp * (rhoZero - rhoPlus);
    const dRhoMinus = -gammaP * rhoMinus + gamma1 * (rhoZero - rhoMinus) / 3 + Wm * (rhoZero - rhoMinus);

    return [dRhoPlus, dRhoMinus];
}

/**
 * Compute ODMR spectrum: sweep MW frequency, return steady-state ρ₀ at each point.
 */
export function computeODMRSpectrum(params, freqMin, freqMax, nPoints) {
    const frequencies = [];
    const rhoZeroValues = [];
    const step = (freqMax - freqMin) / (nPoints - 1);

    for (let i = 0; i < nPoints; i++) {
        const freq = freqMin + i * step;
        const sweepParams = { ...params, omegaMW: freq };
        const { rhoZero } = computeSteadyState(sweepParams);
        frequencies.push(freq);
        rhoZeroValues.push(rhoZero);
    }

    return { frequencies, rhoZeroValues };
}
