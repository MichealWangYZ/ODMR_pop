(() => {
// UI: slider bindings, parameter reading, event wiring

const { DEFAULTS: PHYSICS_DEFAULTS } = window.ODMRPhysics;

// ─── Slider definitions ───────────────────────────────────────────────────────

const SLIDERS_COMMON = [
    { id: 'omega',    label: 'Rabi Frequency \u03A9',  min: 0,   max: 5, step: 0.1, default: PHYSICS_DEFAULTS.omega,    unit: 'MHz' },
    { id: 'omegaMW',  label: 'MW Frequency \u03C9_MW', min: 2600, max: 3200, step: 1, default: PHYSICS_DEFAULTS.omegaMW,  unit: 'MHz', displayFn: v => (v / 1000).toFixed(3) + ' GHz' },
    { id: 'thetaDeg', label: 'MW Ellipticity \u03C7',  min: 0,   max: 90,  step: 1,   default: PHYSICS_DEFAULTS.thetaDeg, unit: '\u00B0', polLabels: true },
    { id: 'laserPolDeg', label: 'Laser Polarization \u03C6_L', min: 0, max: 180, step: 1, default: PHYSICS_DEFAULTS.laserPolDeg, unit: '\u00B0' },
    { id: 'gammaP',   label: 'Pumping Rate \u0393\u209A', min: 0, max: 20, step: 0.1, default: PHYSICS_DEFAULTS.gammaP,  unit: 'MHz' },
    { id: 'T1', label: 'T\u2081 Relaxation', min: -1, max: 2,  step: 0.01, default: Math.log10(PHYSICS_DEFAULTS.T1), log: true, unit: '\u03BCs' },
    { id: 'T2', label: 'T\u2082 Dephasing',  min: -3, max: 1,  step: 0.01, default: Math.log10(PHYSICS_DEFAULTS.T2), log: true, unit: '\u03BCs' },
];

const SLIDERS_SINGLE = [
    { id: 'B', label: 'Field B', min: 0, max: 15, step: 0.1, default: PHYSICS_DEFAULTS.B, unit: 'mT', group: 'single' },
];

const SLIDERS_ENSEMBLE = [
    { id: 'Bmag',   label: '|B| Magnitude', min: 0,   max: 15,  step: 0.1, default: PHYSICS_DEFAULTS.Bmag,   unit: 'mT',    group: 'ensemble' },
    { id: 'Btheta', label: 'B polar \u03B8_B',  min: 0,   max: 90,  step: 1,   default: PHYSICS_DEFAULTS.Btheta, unit: '\u00B0', group: 'ensemble' },
    { id: 'Bphi',   label: 'B azimuth \u03C6_B', min: 0,   max: 360, step: 1,   default: PHYSICS_DEFAULTS.Bphi,   unit: '\u00B0', group: 'ensemble' },
];

const ALL_SLIDERS = [...SLIDERS_COMMON, ...SLIDERS_SINGLE, ...SLIDERS_ENSEMBLE];

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// ─── Public API ───────────────────────────────────────────────────────────────

function readParams() {
    const params = {};
    for (const cfg of ALL_SLIDERS) {
        const el = document.getElementById('slider-' + cfg.id);
        if (!el) continue;
        let val = parseFloat(el.value);
        if (cfg.log) val = Math.pow(10, val);
        else val = clamp(val, cfg.min, cfg.max);
        params[cfg.id] = val;
    }
    params.ensembleMode = document.getElementById('btn-ensemble').dataset.active === 'true';
    return params;
}

function updateDisplayValues() {
    for (const cfg of ALL_SLIDERS) {
        const el = document.getElementById('slider-' + cfg.id);
        const display = document.getElementById('value-' + cfg.id);
        if (!el || !display) continue;
        const raw = parseFloat(el.value);

        if (cfg.displayFn) {
            display.textContent = cfg.displayFn(cfg.log ? Math.pow(10, raw) : raw);
        } else if (cfg.log) {
            const val = Math.pow(10, raw);
            display.textContent = val.toFixed(val < 1 ? 3 : val < 10 ? 2 : 1) + ' ' + cfg.unit;
        } else {
            display.textContent = raw.toFixed(cfg.step < 1 ? 1 : 0) + ' ' + cfg.unit;
        }
    }
}

function initSliders(onChange) {
    for (const cfg of ALL_SLIDERS) {
        const el = document.getElementById('slider-' + cfg.id);
        if (!el) continue;
        el.min   = cfg.min;
        el.max   = cfg.max;
        el.step  = cfg.step;
        el.value = cfg.default;
        el.addEventListener('input', () => { updateDisplayValues(); onChange(); });
    }
    updateDisplayValues();
}

function resetSliders(onChange) {
    for (const cfg of ALL_SLIDERS) {
        const el = document.getElementById('slider-' + cfg.id);
        if (el) el.value = cfg.default;
    }
    updateDisplayValues();
    onChange();
}

/**
 * Toggle between single-NV and ensemble mode.
 * Shows/hides the appropriate field-direction controls.
 */
function toggleEnsembleMode(onChange) {
    const btn = document.getElementById('btn-ensemble');
    const isNowEnsemble = btn.dataset.active !== 'true';
    btn.dataset.active = isNowEnsemble;
    btn.textContent = isNowEnsemble ? 'Mode: Ensemble (4 NV)' : 'Mode: Single NV';
    btn.classList.toggle('active', isNowEnsemble);

    document.getElementById('field-single').style.display   = isNowEnsemble ? 'none'  : 'block';
    document.getElementById('field-ensemble').style.display = isNowEnsemble ? 'block' : 'none';
    onChange();
}

window.ODMRUI = {
    readParams,
    updateDisplayValues,
    initSliders,
    resetSliders,
    toggleEnsembleMode,
};
})();
