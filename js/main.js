// Entry point

import {
    computeSteadyState, computeODMRSpectrum,
    computeODMRSpectrumEnsemble, computeBaseline,
    computeLinewidths, rateEquationsRHS,
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

// Inline NV orientation projection (mirrors physics.js internals)
const s3 = 1 / Math.sqrt(3);
const NV_ORIENTATIONS = [[ s3, s3, s3],[ s3,-s3,-s3],[-s3, s3,-s3],[-s3,-s3, s3]];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];

function ensembleAvgPops(params) {
    const t = params.Btheta * Math.PI / 180;
    const p = params.Bphi   * Math.PI / 180;
    const BVec = [
        params.Bmag * Math.sin(t) * Math.cos(p),
        params.Bmag * Math.sin(t) * Math.sin(p),
        params.Bmag * Math.cos(t),
    ];
    let rhoPlus = 0, rhoZero = 0, rhoMinus = 0;
    for (const u of NV_ORIENTATIONS) {
        const pop = computeSteadyState({ ...params, B: dot(BVec, u) });
        rhoPlus  += pop.rhoPlus;
        rhoZero  += pop.rhoZero;
        rhoMinus += pop.rhoMinus;
    }
    return { rhoPlus: rhoPlus / 4, rhoZero: rhoZero / 4, rhoMinus: rhoMinus / 4 };
}

function updateReadout(lw) {
    const el = document.getElementById('readout-text');
    if (!el) return;
    const fmt = v => v >= 1000 ? (v/1000).toFixed(2)+' GHz' : v.toFixed(1)+' MHz';
    el.innerHTML =
        `<span class="ro-label">|0\u27E9\u2194|+1\u27E9</span>` +
        ` FWHM <span class="ro-val">${fmt(lw.fwhmPlus)}</span>` +
        ` &nbsp;|&nbsp; Contrast <span class="ro-val">${lw.contrastPlus.toFixed(2)}%</span>` +
        `<br>` +
        `<span class="ro-label">|0\u27E9\u2194|\u22121\u27E9</span>` +
        ` FWHM <span class="ro-val">${fmt(lw.fwhmMinus)}</span>` +
        ` &nbsp;|&nbsp; Contrast <span class="ro-val">${lw.contrastMinus.toFixed(2)}%</span>`;
}

function fullUpdate() {
    const params = readParams();
    const ensemble = params.ensembleMode;

    // Bar chart
    const pops = ensemble ? ensembleAvgPops(params) : computeSteadyState(params);
    const baseline = computeBaseline(params);
    updateBarChart('bar-chart', pops, baseline);

    // Linewidth readout
    const lw = computeLinewidths(params);
    updateReadout(lw);

    // ODMR spectrum (debounced)
    clearTimeout(spectrumTimer);
    spectrumTimer = setTimeout(() => {
        const spectrumData = ensemble
            ? computeODMRSpectrumEnsemble(params, 2600, 3200, 400)
            : computeODMRSpectrum(params, 2600, 3200, 400);
        updateODMRSpectrum('odmr-spectrum', spectrumData, params.omegaMW, ensemble ? null : lw);
    }, 30);

    // Time evolution
    if (showTimeEvolution && !ensemble) {
        const tMax = Math.max(5 * params.T1, 0.5 / (params.gammaP || 0.01));
        const initialState = [1/3, 1/3, 1/3, 0, 0, 0, 0];
        const dt = Math.min(tMax / 1200, 0.002);
        const { times, states } = integrate(rateEquationsRHS, initialState, tMax, dt, params);
        updateTimeEvolution('time-evolution', times, states);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initBarChart('bar-chart');
    initODMRSpectrum('odmr-spectrum');
    initTimeEvolution('time-evolution');

    initSliders(fullUpdate);

    document.getElementById('btn-reset').addEventListener('click', () => resetSliders(fullUpdate));
    document.getElementById('btn-ensemble').addEventListener('click', () => toggleEnsembleMode(fullUpdate));

    document.getElementById('btn-time-evo').addEventListener('click', () => {
        showTimeEvolution = !showTimeEvolution;
        document.getElementById('time-evolution-container').style.display =
            showTimeEvolution ? 'block' : 'none';
        document.getElementById('btn-time-evo').textContent =
            showTimeEvolution ? 'Hide Time Evo' : 'Show Time Evo';
        if (showTimeEvolution) fullUpdate();
    });

    fullUpdate();
});
