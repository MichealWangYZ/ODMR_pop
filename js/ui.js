// UI: slider bindings, parameter reading, event wiring

import { DEFAULTS } from './physics.js';

// Slider configuration: { id, default, min, max, step, log?, displayUnit, displayScale }
const SLIDER_CONFIG = [
    { id: 'omega', label: 'Rabi Frequency \u03A9', min: 0, max: 50, step: 0.1, default: DEFAULTS.omega, unit: 'MHz' },
    { id: 'omegaMW', label: 'MW Frequency \u03C9_MW', min: 2600, max: 3200, step: 1, default: DEFAULTS.omegaMW, unit: 'MHz', displayFn: v => (v / 1000).toFixed(3) + ' GHz' },
    { id: 'thetaDeg', label: 'Polarization \u03B8', min: 0, max: 90, step: 1, default: DEFAULTS.thetaDeg, unit: '\u00B0', polLabels: true },
    { id: 'gammaP', label: 'Pumping Rate \u0393_p', min: 0, max: 100, step: 0.5, default: DEFAULTS.gammaP, unit: 'MHz' },
    { id: 'T1', label: 'T\u2081 Relaxation', min: -1, max: 2, step: 0.01, default: Math.log10(DEFAULTS.T1), log: true, unit: '\u03BCs' },
    { id: 'T2', label: 'T\u2082 Dephasing', min: -3, max: 1, step: 0.01, default: Math.log10(DEFAULTS.T2), log: true, unit: '\u03BCs' },
    { id: 'B', label: 'Magnetic Field B', min: 0, max: 50, step: 0.1, default: DEFAULTS.B, unit: 'mT' },
];

export function getSliderConfig() {
    return SLIDER_CONFIG;
}

/**
 * Read all slider values and return a params object.
 */
export function readParams() {
    const params = {};
    for (const cfg of SLIDER_CONFIG) {
        const el = document.getElementById('slider-' + cfg.id);
        let val = parseFloat(el.value);
        if (cfg.log) val = Math.pow(10, val);
        params[cfg.id] = val;
    }
    return params;
}

/**
 * Update displayed values next to sliders.
 */
export function updateDisplayValues() {
    for (const cfg of SLIDER_CONFIG) {
        const el = document.getElementById('slider-' + cfg.id);
        const display = document.getElementById('value-' + cfg.id);
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

/**
 * Initialize all sliders with default values and wire input events.
 */
export function initSliders(onChange) {
    for (const cfg of SLIDER_CONFIG) {
        const el = document.getElementById('slider-' + cfg.id);
        el.min = cfg.min;
        el.max = cfg.max;
        el.step = cfg.step;
        el.value = cfg.default;
        el.addEventListener('input', () => {
            updateDisplayValues();
            onChange();
        });
    }
    updateDisplayValues();
}

/**
 * Reset all sliders to defaults.
 */
export function resetSliders(onChange) {
    for (const cfg of SLIDER_CONFIG) {
        const el = document.getElementById('slider-' + cfg.id);
        el.value = cfg.default;
    }
    updateDisplayValues();
    onChange();
}
