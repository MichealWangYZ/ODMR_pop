// Entry point

import {
    computeSteadyState, computeODMRSpectrum,
    computeODMRSpectrumEnsemble, computeBaseline,
    rateEquationsRHS,
} from './physics.js';
import { integrate } from './solver.js';
import {
    initBarChart, updateBarChart,
    initODMRSpectrum, updateODMRSpectrum,
    initTimeEvolution, updateTimeEvolution,
} from './plots.js';
import { initSliders, readParams, resetSliders, toggleEnsembleMode } from './ui.js';

let showTimeEvolution = false;
let spectrumTimer = null;

function update() {
    const params = readParams();
    const ensemble = params.ensembleMode;

    // ── Bar chart: current populations + baseline ──────────────────────────
    const pops = ensemble
        ? (() => {
            // Average populations across 4 orientations
            const { bVectorFromAngles, CONSTANTS } = window._physics;  // unused path; inline below
            // We use computeBaseline with omega active for "on" state
            // Build ensemble pops manually
            return computeSteadyState({ ...params, B: params.Bmag }); // fallback single
          })()
        : computeSteadyState(params);

    const baseline = computeBaseline(params);
    updateBarChart('bar-chart', pops, baseline);

    // ── ODMR spectrum (debounced) ──────────────────────────────────────────
    clearTimeout(spectrumTimer);
    spectrumTimer = setTimeout(() => {
        const spectrumData = ensemble
            ? computeODMRSpectrumEnsemble(params, 2600, 3200, 400)
            : computeODMRSpectrum(params, 2600, 3200, 400);
        updateODMRSpectrum('odmr-spectrum', spectrumData, params.omegaMW);
    }, 30);

    // ── Time evolution ─────────────────────────────────────────────────────
    if (showTimeEvolution && !ensemble) {
        const tMax = Math.max(5 * params.T1, 0.5 / (params.gammaP || 0.01));
        const dt = tMax / 600;
        const { times, states } = integrate(rateEquationsRHS, [1 / 3, 1 / 3], tMax, dt, params);
        updateTimeEvolution('time-evolution', times, states);
    }
}

// Fix the ensemble bar chart path — compute actual ensemble average
function updateEnsembleBarChart(params, baseline) {
    // For ensemble bar chart, average populations across 4 orientations at current params
    // We reuse computeBaseline logic but with MW on
    const { bVectorFromAngles: bvfa, CONSTANTS: C } = { bVectorFromAngles: null, CONSTANTS: null };

    // Inline NV orientations projection (mirrors physics.js)
    const s3 = 1 / Math.sqrt(3);
    const orientations = [
        [ s3,  s3,  s3], [ s3, -s3, -s3], [-s3,  s3, -s3], [-s3, -s3,  s3],
    ];
    const t = params.Btheta * Math.PI / 180;
    const p = params.Bphi   * Math.PI / 180;
    const BVec = [
        params.Bmag * Math.sin(t) * Math.cos(p),
        params.Bmag * Math.sin(t) * Math.sin(p),
        params.Bmag * Math.cos(t),
    ];
    const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    const Bps = orientations.map(u => dot(BVec, u));

    let rhoPlus = 0, rhoZero = 0, rhoMinus = 0;
    for (const Bp of Bps) {
        const pop = computeSteadyState({ ...params, B: Bp });
        rhoPlus  += pop.rhoPlus;
        rhoZero  += pop.rhoZero;
        rhoMinus += pop.rhoMinus;
    }
    return { rhoPlus: rhoPlus / 4, rhoZero: rhoZero / 4, rhoMinus: rhoMinus / 4 };
}

function fullUpdate() {
    const params = readParams();
    const ensemble = params.ensembleMode;

    const pops = ensemble ? updateEnsembleBarChart(params) : computeSteadyState(params);
    const baseline = computeBaseline(params);
    updateBarChart('bar-chart', pops, baseline);

    clearTimeout(spectrumTimer);
    spectrumTimer = setTimeout(() => {
        const spectrumData = ensemble
            ? computeODMRSpectrumEnsemble(params, 2600, 3200, 400)
            : computeODMRSpectrum(params, 2600, 3200, 400);
        updateODMRSpectrum('odmr-spectrum', spectrumData, params.omegaMW);
    }, 30);

    if (showTimeEvolution && !ensemble) {
        const tMax = Math.max(5 * params.T1, 0.5 / (params.gammaP || 0.01));
        const { times, states } = integrate(rateEquationsRHS, [1/3, 1/3], tMax, tMax / 600, params);
        updateTimeEvolution('time-evolution', times, states);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initBarChart('bar-chart');
    initODMRSpectrum('odmr-spectrum');
    initTimeEvolution('time-evolution');

    initSliders(fullUpdate);

    document.getElementById('btn-reset').addEventListener('click',    () => resetSliders(fullUpdate));
    document.getElementById('btn-ensemble').addEventListener('click', () => toggleEnsembleMode(fullUpdate));

    document.getElementById('btn-time-evo').addEventListener('click', () => {
        showTimeEvolution = !showTimeEvolution;
        const container = document.getElementById('time-evolution-container');
        container.style.display = showTimeEvolution ? 'block' : 'none';
        document.getElementById('btn-time-evo').textContent =
            showTimeEvolution ? 'Hide Time Evo' : 'Show Time Evo';
        if (showTimeEvolution) fullUpdate();
    });

    fullUpdate();
});
