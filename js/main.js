(() => {
// Entry point

const {
    computeSteadyState,
    computeEnsembleSteadyState,
    computeODMRSpectrum,
    computeODMRSpectrumEnsemble,
    computeBaseline,
    computeLinewidths,
    rateEquationsRHS,
} = window.ODMRPhysics;
const { integrate } = window.ODMRSolver;
const {
    initBarChart,
    updateBarChart,
    initODMRSpectrum,
    updateODMRSpectrum,
    initTimeEvolution,
    updateTimeEvolution,
} = window.ODMRPlots;
const { initSliders, readParams, resetSliders, toggleEnsembleMode } = window.ODMRUI;

let showTimeEvolution = false;
let spectrumTimer = null;

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
    const pops = ensemble ? computeEnsembleSteadyState(params) : computeSteadyState(params);
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
})();
