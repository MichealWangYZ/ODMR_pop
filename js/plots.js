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

// ─── Bar chart ───────────────────────────────────────────────────────────────

export function initBarChart(divId) {
    Plotly.newPlot(divId, _barTraces({ rhoPlus: 1/3, rhoZero: 1/3, rhoMinus: 1/3 },
                                      { rhoPlus: 1/3, rhoZero: 1/3, rhoMinus: 1/3 }),
        _barLayout(), CONFIG);
}

export function updateBarChart(divId, pops, baseline) {
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

export function initODMRSpectrum(divId) {
    Plotly.newPlot(divId, [{ x: [], y: [], type: 'scatter', mode: 'lines',
        line: { color: COLORS.accent, width: 2 }, name: 'Contrast (%)' }],
        _spectrumLayout([]), CONFIG);
}

export function updateODMRSpectrum(divId, spectrumData, currentFreq) {
    const freqGHz = spectrumData.frequencies.map(f => f / 1000);
    const currentGHz = currentFreq / 1000;

    const traces = [{
        x: freqGHz,
        y: spectrumData.contrastValues,
        type: 'scatter',
        mode: 'lines',
        line: { color: COLORS.accent, width: 2 },
        name: 'Contrast (%)',
        fill: 'tozeroy',
        fillcolor: 'rgba(255,217,61,0.08)',
    }];

    // Vertical markers at resonance frequencies
    const shapes = spectrumData.resonanceFreqs
        .map(f => f / 1000)
        .filter(f => f >= freqGHz[0] && f <= freqGHz[freqGHz.length - 1])
        .map((f, i) => ({
            type: 'line', x0: f, x1: f, y0: 0, y1: 1, yref: 'paper',
            line: { color: i % 2 === 0 ? COLORS.plus : COLORS.minus, width: 1, dash: 'dot' },
        }));

    // Current MW frequency cursor
    shapes.push({
        type: 'line', x0: currentGHz, x1: currentGHz, y0: 0, y1: 1, yref: 'paper',
        line: { color: '#ffffff', width: 1.5, dash: 'dash' },
    });

    Plotly.react(divId, traces, _spectrumLayout(shapes), CONFIG);
}

function _spectrumLayout(shapes) {
    return {
        ...LAYOUT_BASE,
        title: { text: 'ODMR Spectrum — Contrast (%)', font: { size: 15 } },
        xaxis: { title: '\u03C9_MW (GHz)', gridcolor: COLORS.grid },
        yaxis: { title: 'ODMR Contrast (%)', gridcolor: COLORS.grid, rangemode: 'tozero' },
        shapes,
    };
}

// ─── Time evolution ────────────────────────────────────────────────────────────

export function initTimeEvolution(divId) {
    Plotly.newPlot(divId, _timeTraces([], []), _timeLayout(), CONFIG);
}

export function updateTimeEvolution(divId, times, states) {
    Plotly.react(divId, _timeTraces(times, states), _timeLayout(), CONFIG);
}

function _timeTraces(times, states) {
    return [
        { x: times, y: states.map(s => s[0]),            type: 'scatter', mode: 'lines', name: '\u03C1\u208A\u2081', line: { color: COLORS.plus,  width: 2 } },
        { x: times, y: states.map(s => 1 - s[0] - s[1]), type: 'scatter', mode: 'lines', name: '\u03C1\u2080',       line: { color: COLORS.zero,  width: 2 } },
        { x: times, y: states.map(s => s[1]),             type: 'scatter', mode: 'lines', name: '\u03C1\u208B\u2081', line: { color: COLORS.minus, width: 2 } },
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
