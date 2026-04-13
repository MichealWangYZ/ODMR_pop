(() => {
// Entry point

const {
    computeODMRSpectrum,
    computeODMRSpectrumEnsemble,
    computeLinewidths,
    rateEquationsRHS,
} = window.ODMRPhysics;
const { integrate } = window.ODMRSolver;
const {
    initEnergyLevels,
    initODMRSpectrum,
    updateODMRSpectrum,
    initTimeEvolution,
    updateTimeEvolution,
} = window.ODMRPlots;
const { initSliders, readParams, resetSliders, toggleEnsembleMode } = window.ODMRUI;

let showTimeEvolution = false;
let spectrumTimer = null;
const SPECTRUM_POINTS = 2400;

function updateReadout(lw, ensemble) {
    const el = document.getElementById('readout-text');
    if (!el) return;
    if (ensemble) {
        el.innerHTML =
            `<span class="ro-label">Ensemble mode</span>` +
            ` FWHM and contrast are orientation-dependent; use the spectrum ` +
            `dips directly rather than the single-NV readout.`;
        return;
    }
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

    // Linewidth readout
    const lw = computeLinewidths(params);
    updateReadout(lw, ensemble);

    // ODMR spectrum (debounced)
    clearTimeout(spectrumTimer);
    spectrumTimer = setTimeout(() => {
        const spectrumData = ensemble
            ? computeODMRSpectrumEnsemble(params, 2600, 3200, SPECTRUM_POINTS)
            : computeODMRSpectrum(params, 2600, 3200, SPECTRUM_POINTS);
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
    initEnergyLevels('energy-levels');
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
