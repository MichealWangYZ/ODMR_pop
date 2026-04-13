(() => {
// Plotly chart initialization and update

const COLORS = {
    plus:   '#ff6b6b',
    zero:   '#4ecdc4',
    minus:  '#45b7d1',
    bg:     '#1a1a2e',
    paper:  '#16213e',
    grid:   '#2a2a4a',
    text:   '#e0e0e0',
    accent: '#ffd93d',
    dim:    '#555577',
};

const LAYOUT_BASE = {
    paper_bgcolor: COLORS.paper,
    plot_bgcolor:  COLORS.bg,
    font: { color: COLORS.text, family: 'monospace' },
    margin: { t: 44, r: 20, b: 50, l: 66 },
};

const CONFIG = { responsive: true, displayModeBar: false };
// Spectrum chart needs zoom/pan to expose narrow features (hyperfine triplet,
// power-narrowed dips). Drag to box-zoom; scroll to scale; double-click to reset.
const SPECTRUM_CONFIG = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    scrollZoom: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d', 'toggleSpikelines'],
};

// ─── Canonical NV energy-level diagram ───────────────────────────────────────

function initEnergyLevels(divId) {
    const el = document.getElementById(divId);
    if (!el) return;
    el.innerHTML = `
        <div class="energy-figure">
            <svg viewBox="0 0 900 500" class="energy-svg" aria-label="NV center energy level diagram">
                <defs>
                    <marker id="arrow-green" viewBox="0 0 10 10" markerWidth="18" markerHeight="18" refX="10" refY="5" markerUnits="userSpaceOnUse" orient="auto">
                        <path d="M0 0 L10 5 L0 10 z" fill="#2f7d32"></path>
                    </marker>
                    <marker id="arrow-red" viewBox="0 0 10 10" markerWidth="18" markerHeight="18" refX="10" refY="5" markerUnits="userSpaceOnUse" orient="auto">
                        <path d="M0 0 L10 5 L0 10 z" fill="#d55a1f"></path>
                    </marker>
                    <marker id="arrow-black" viewBox="0 0 10 10" markerWidth="12" markerHeight="12" refX="10" refY="5" markerUnits="userSpaceOnUse" orient="auto">
                        <path d="M0 0 L10 5 L0 10 z" fill="#222"></path>
                    </marker>
                </defs>
                <text x="86" y="150" class="manifold-label">³E</text>
                <text x="86" y="392" class="manifold-label">³A<tspan baseline-shift="sub" font-size="18">2</tspan></text>

                <line x1="175" y1="118" x2="325" y2="118" class="energy-level"></line>
                <line x1="175" y1="128" x2="325" y2="128" class="energy-level"></line>
                <line x1="175" y1="220" x2="305" y2="220" class="energy-level"></line>

                <line x1="175" y1="344" x2="325" y2="344" class="energy-level"></line>
                <line x1="175" y1="354" x2="325" y2="354" class="energy-level"></line>
                <line x1="165" y1="450" x2="262" y2="450" class="energy-level"></line>

                <text x="338" y="112" class="level-mark">±1</text>
                <text x="350" y="220" class="level-mark">0</text>
                <text x="338" y="338" class="level-mark">±1</text>
                <text x="350" y="450" class="level-mark">0</text>

                <line x1="430" y1="300" x2="610" y2="300" class="singlet-level"></line>
                <line x1="430" y1="300" x2="430" y2="338" class="shelf-leg"></line>
                <line x1="430" y1="338" x2="610" y2="338" class="singlet-level"></line>
                <line x1="514" y1="300" x2="514" y2="338" class="singlet-dashed"></line>

                <text x="630" y="314" class="singlet-label">¹A<tspan baseline-shift="sub" font-size="18">1</tspan></text>
                <text x="630" y="352" class="singlet-label">¹E</text>

                <line x1="212" y1="450" x2="212" y2="62" class="pump-arrow" marker-end="url(#arrow-green)"></line>
                <text x="54" y="285" class="pump-wavelength">532nm</text>

                <line x1="250" y1="130" x2="250" y2="344" class="fl-arrow" marker-end="url(#arrow-red)"></line>
                <line x1="276" y1="130" x2="276" y2="450" class="fl-arrow" marker-end="url(#arrow-red)"></line>

                <path d="M325 128 L476 298" class="diag-solid" marker-end="url(#arrow-black)"></path>
                <path d="M305 220 L470 298" class="diag-dotted" marker-end="url(#arrow-black)"></path>
                <path d="M430 338 L332 349" class="diag-dotted" marker-end="url(#arrow-black)"></path>
                <path d="M514 338 L286 446" class="diag-solid" marker-end="url(#arrow-black)"></path>

                <path d="M388 346 C402 354, 402 450, 388 458" class="split-brace"></path>
                <text x="424" y="408" class="split-big">2.87GHz</text>
            </svg>
        </div>`;
}

// ─── Bar chart ───────────────────────────────────────────────────────────────

function initBarChart(divId) {
    Plotly.newPlot(divId, _barTraces({ rhoPlus: 1/3, rhoZero: 1/3, rhoMinus: 1/3 },
                                      { rhoPlus: 1/3, rhoZero: 1/3, rhoMinus: 1/3 }),
        _barLayout(), CONFIG);
}

function updateBarChart(divId, pops, baseline) {
    Plotly.react(divId, _barTraces(pops, baseline), _barLayout(), CONFIG);
}

function _barTraces(pops, baseline) {
    // Absolute populations
    const absTrace = {
        x: ['|+1\u27E9', '|0\u27E9', '|\u22121\u27E9'],
        y: [pops.rhoPlus, pops.rhoZero, pops.rhoMinus],
        type: 'bar',
        name: 'Population',
        marker: { color: [COLORS.plus, COLORS.zero, COLORS.minus], opacity: 0.85 },
        text: [pops.rhoPlus, pops.rhoZero, pops.rhoMinus].map(v => v.toFixed(4)),
        textposition: 'outside',
        textfont: { color: COLORS.text, size: 13 },
        xaxis: 'x',
        yaxis: 'y',
    };

    // Fractional change from off-resonance baseline: (ρ - ρ_off) / ρ_off × 100 %
    const deltaPlus  = baseline.rhoPlus  > 0 ? (pops.rhoPlus  - baseline.rhoPlus)  / baseline.rhoPlus  * 100 : 0;
    const deltaZero  = baseline.rhoZero  > 0 ? (pops.rhoZero  - baseline.rhoZero)  / baseline.rhoZero  * 100 : 0;
    const deltaMinus = baseline.rhoMinus > 0 ? (pops.rhoMinus - baseline.rhoMinus) / baseline.rhoMinus * 100 : 0;

    const changeTrace = {
        x: ['|+1\u27E9', '|0\u27E9', '|\u22121\u27E9'],
        y: [deltaPlus, deltaZero, deltaMinus],
        type: 'bar',
        name: '\u0394\u03C1 / \u03C1\u2080 (%)',
        marker: {
            color: [
                deltaPlus  >= 0 ? COLORS.plus  : COLORS.dim,
                deltaZero  >= 0 ? COLORS.zero  : COLORS.dim,
                deltaMinus >= 0 ? COLORS.minus : COLORS.dim,
            ],
            opacity: 0.9,
        },
        text: [deltaPlus, deltaZero, deltaMinus].map(v => (v >= 0 ? '+' : '') + v.toFixed(2) + '%'),
        textposition: 'outside',
        textfont: { color: COLORS.text, size: 12 },
        xaxis: 'x2',
        yaxis: 'y2',
    };

    return [absTrace, changeTrace];
}

function _barLayout() {
    return {
        ...LAYOUT_BASE,
        title: { text: 'Spin Populations', font: { size: 15 } },
        grid: { rows: 1, columns: 2, pattern: 'independent' },
        xaxis:  { domain: [0, 0.45], tickfont: { size: 13 } },
        yaxis:  { title: '\u03C1 (absolute)', range: [0, 1.15], gridcolor: COLORS.grid },
        xaxis2: { domain: [0.55, 1], tickfont: { size: 13 } },
        yaxis2: { title: '\u0394\u03C1/\u03C1\u2080 (%)', gridcolor: COLORS.grid, zeroline: true, zerolinecolor: COLORS.dim },
        showlegend: false,
        margin: { t: 44, r: 20, b: 50, l: 66 },
        annotations: [
            { text: 'Absolute', showarrow: false, x: 0.225, xref: 'paper', y: 1.06, yref: 'paper', font: { color: COLORS.dim, size: 11 } },
            { text: 'MW-Induced Change', showarrow: false, x: 0.775, xref: 'paper', y: 1.06, yref: 'paper', font: { color: COLORS.dim, size: 11 } },
        ],
    };
}

// ─── ODMR spectrum ────────────────────────────────────────────────────────────

function initODMRSpectrum(divId) {
    Plotly.newPlot(divId, [{ x: [], y: [], type: 'scatter', mode: 'lines',
        line: { color: COLORS.accent, width: 2 }, name: 'Dip Contrast (%)' }],
        _spectrumLayout([], [], -0.01), SPECTRUM_CONFIG);
}

function updateODMRSpectrum(divId, spectrumData, currentFreq, linewidths) {
    const freqGHz = spectrumData.frequencies.map(f => f / 1000);
    const currentGHz = currentFreq / 1000;
    const dipValues = spectrumData.contrastValues.map(v => -v);
    const yMin = Math.min(...dipValues, -0.01);
    const dipDepth = Math.abs(yMin);

    const traces = [{
        x: freqGHz,
        y: dipValues,
        type: 'scatter',
        mode: 'lines',
        line: { color: COLORS.accent, width: 2 },
        name: 'Dip Contrast (%)',
        fill: 'tozeroy',
        fillcolor: 'rgba(255,217,61,0.08)',
    }];

    const shapes = [];
    const annotations = [];

    // Resonance markers + FWHM brackets
    if (linewidths) {
        const fwhms = [linewidths.fwhmPlus, linewidths.fwhmMinus];
        spectrumData.resonanceFreqs
            .slice(0, 2)   // single-NV: only 2 resonances; ensemble: all 8 handled below
            .forEach((f, i) => {
                const fGHz = f / 1000;
                const hw = fwhms[i] / 2 / 1000;  // half-width in GHz
                const col = i === 0 ? COLORS.plus : COLORS.minus;
                const bracketY = yMin * 0.5;
                const tickHalfHeight = dipDepth * 0.04;

                // Dashed resonance line
                shapes.push({
                    type: 'line', x0: fGHz, x1: fGHz, y0: 0, y1: 1, yref: 'paper',
                    line: { color: col, width: 1, dash: 'dot' },
                });
                // FWHM bracket (horizontal bar at half-max)
                shapes.push({
                    type: 'line', x0: fGHz - hw, x1: fGHz + hw, y0: bracketY, y1: bracketY,
                    line: { color: col, width: 2 },
                });
                // Bracket end ticks
                for (const x of [fGHz - hw, fGHz + hw]) {
                    shapes.push({
                        type: 'line', x0: x, x1: x, y0: bracketY - tickHalfHeight, y1: bracketY + tickHalfHeight,
                        line: { color: col, width: 2 },
                    });
                }
                // FWHM label
                const fwhmMHz = fwhms[i];
                annotations.push({
                    x: fGHz, y: bracketY + dipDepth * 0.08, xref: 'x', yref: 'y', showarrow: false,
                    text: fwhmMHz >= 1000 ? (fwhmMHz / 1000).toFixed(1) + ' GHz' : fwhmMHz.toFixed(0) + ' MHz',
                    font: { color: col, size: 11, family: 'monospace' },
                });
            });

        // Ensemble mode: just dot markers for all 8
        if (spectrumData.resonanceFreqs.length > 2) {
            spectrumData.resonanceFreqs.slice(2).forEach((f, i) => {
                const fGHz = f / 1000;
                if (fGHz < freqGHz[0] || fGHz > freqGHz[freqGHz.length - 1]) return;
                shapes.push({
                    type: 'line', x0: fGHz, x1: fGHz, y0: 0, y1: 1, yref: 'paper',
                    line: { color: i % 2 === 0 ? COLORS.plus : COLORS.minus, width: 1, dash: 'dot' },
                });
            });
        }
    }

    // Current MW frequency cursor
    shapes.push({
        type: 'line', x0: currentGHz, x1: currentGHz, y0: 0, y1: 1, yref: 'paper',
        line: { color: '#ffffff', width: 1.5, dash: 'dash' },
    });

    Plotly.react(divId, traces, _spectrumLayout(shapes, annotations, yMin), SPECTRUM_CONFIG);
}

function _spectrumLayout(shapes, annotations, yMin) {
    return {
        ...LAYOUT_BASE,
        title: { text: 'ODMR Spectrum — Contrast Dips (%)   (drag to zoom · scroll to scale · double-click to reset)', font: { size: 13 } },
        xaxis: { title: '\u03C9_MW (GHz)', gridcolor: COLORS.grid },
        yaxis: { title: 'ODMR Dip Contrast (%)', gridcolor: COLORS.grid, range: [yMin * 1.15, 0], zeroline: true, zerolinecolor: COLORS.dim },
        shapes,
        annotations: annotations || [],
        // Preserve user-driven zoom/pan across slider-triggered re-renders.
        uirevision: 'spectrum',
    };
}

// ─── Time evolution ────────────────────────────────────────────────────────────

function initTimeEvolution(divId) {
    Plotly.newPlot(divId, _timeTraces([], []), _timeLayout(), CONFIG);
}

function updateTimeEvolution(divId, times, states) {
    Plotly.react(divId, _timeTraces(times, states), _timeLayout(), CONFIG);
}

function _timeTraces(times, states) {
    const rhoPlus = states.map(s => s.length >= 7 ? s[0] : s[0]);
    const rhoZero = states.map(s => s.length >= 7 ? s[1] : 1 - s[0] - s[1]);
    const rhoMinus = states.map(s => s.length >= 7 ? s[2] : s[1]);

    return [
        { x: times, y: rhoPlus,  type: 'scatter', mode: 'lines', name: '\u03C1\u208A\u2081', line: { color: COLORS.plus,  width: 2 } },
        { x: times, y: rhoZero,  type: 'scatter', mode: 'lines', name: '\u03C1\u2080',       line: { color: COLORS.zero,  width: 2 } },
        { x: times, y: rhoMinus, type: 'scatter', mode: 'lines', name: '\u03C1\u208B\u2081', line: { color: COLORS.minus, width: 2 } },
    ];
}

function _timeLayout() {
    return {
        ...LAYOUT_BASE,
        title: { text: 'Time Evolution from Thermal Equilibrium', font: { size: 15 } },
        xaxis: { title: 'Time (\u03BCs)', gridcolor: COLORS.grid },
        yaxis: { title: '\u03C1', range: [0, 1.05], gridcolor: COLORS.grid },
        legend: { x: 0.78, y: 0.95 },
    };
}

window.ODMRPlots = {
    initEnergyLevels,
    initBarChart,
    updateBarChart,
    initODMRSpectrum,
    updateODMRSpectrum,
    initTimeEvolution,
    updateTimeEvolution,
};
})();
