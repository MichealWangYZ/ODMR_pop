// Entry point: wire everything together

import { computeSteadyState, computeODMRSpectrum, rateEquationsRHS } from './physics.js';
import { integrate } from './solver.js';
import { initBarChart, updateBarChart, initODMRSpectrum, updateODMRSpectrum, initTimeEvolution, updateTimeEvolution } from './plots.js';
import { initSliders, readParams, resetSliders } from './ui.js';

let showTimeEvolution = false;
let debounceTimer = null;

function update() {
    const params = readParams();

    // Steady-state populations
    const pops = computeSteadyState(params);
    updateBarChart('bar-chart', pops);

    // ODMR spectrum (debounced slightly for the sweep)
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        const spectrum = computeODMRSpectrum(params, 2600, 3200, 300);
        updateODMRSpectrum('odmr-spectrum', spectrum, params.omegaMW);
    }, 30);

    // Time evolution
    if (showTimeEvolution) {
        const tMax = Math.max(5 * params.T1, 0.5 / (params.gammaP || 0.01));
        const dt = tMax / 500;
        const { times, states } = integrate(rateEquationsRHS, [1 / 3, 1 / 3], tMax, dt, params);
        updateTimeEvolution('time-evolution', times, states);
    }
}

function toggleTimeEvolution() {
    showTimeEvolution = !showTimeEvolution;
    const container = document.getElementById('time-evolution-container');
    container.style.display = showTimeEvolution ? 'block' : 'none';
    document.getElementById('btn-time-evo').textContent =
        showTimeEvolution ? 'Hide Time Evolution' : 'Show Time Evolution';
    if (showTimeEvolution) update();
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize charts
    initBarChart('bar-chart');
    initODMRSpectrum('odmr-spectrum');
    initTimeEvolution('time-evolution');

    // Initialize sliders and wire updates
    initSliders(update);

    // Buttons
    document.getElementById('btn-reset').addEventListener('click', () => resetSliders(update));
    document.getElementById('btn-time-evo').addEventListener('click', toggleTimeEvolution);

    // Initial computation
    update();
});
