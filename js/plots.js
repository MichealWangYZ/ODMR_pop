// Plotly chart initialization and update

const COLORS = {
    plus: '#ff6b6b',
    zero: '#4ecdc4',
    minus: '#45b7d1',
    bg: '#1a1a2e',
    paper: '#16213e',
    grid: '#333366',
    text: '#e0e0e0',
    accent: '#ffd93d',
};

const LAYOUT_BASE = {
    paper_bgcolor: COLORS.paper,
    plot_bgcolor: COLORS.bg,
    font: { color: COLORS.text, family: 'monospace' },
    margin: { t: 40, r: 20, b: 50, l: 60 },
};

const CONFIG = { responsive: true, displayModeBar: false };

export function initBarChart(divId) {
    const data = [{
        x: ['|+1\u27E9', '|0\u27E9', '|\u22121\u27E9'],
        y: [1 / 3, 1 / 3, 1 / 3],
        type: 'bar',
        marker: { color: [COLORS.plus, COLORS.zero, COLORS.minus] },
        text: ['0.3333', '0.3333', '0.3333'],
        textposition: 'outside',
        textfont: { color: COLORS.text, size: 14 },
    }];
    const layout = {
        ...LAYOUT_BASE,
        title: { text: 'Steady-State Populations', font: { size: 16 } },
        yaxis: { title: '\u03C1', range: [0, 1.05], gridcolor: COLORS.grid },
        xaxis: { tickfont: { size: 14 } },
    };
    Plotly.newPlot(divId, data, layout, CONFIG);
}

export function updateBarChart(divId, pops) {
    const y = [pops.rhoPlus, pops.rhoZero, pops.rhoMinus];
    const text = y.map(v => v.toFixed(4));
    Plotly.react(divId, [{
        x: ['|+1\u27E9', '|0\u27E9', '|\u22121\u27E9'],
        y,
        type: 'bar',
        marker: { color: [COLORS.plus, COLORS.zero, COLORS.minus] },
        text,
        textposition: 'outside',
        textfont: { color: COLORS.text, size: 14 },
    }], {
        ...LAYOUT_BASE,
        title: { text: 'Steady-State Populations', font: { size: 16 } },
        yaxis: { title: '\u03C1', range: [0, 1.05], gridcolor: COLORS.grid },
        xaxis: { tickfont: { size: 14 } },
    }, CONFIG);
}

export function initODMRSpectrum(divId) {
    const data = [{
        x: [],
        y: [],
        type: 'scatter',
        mode: 'lines',
        line: { color: COLORS.accent, width: 2 },
        name: '\u03C1\u2080',
    }];
    const layout = {
        ...LAYOUT_BASE,
        title: { text: 'ODMR Spectrum (\u03C1\u2080 vs MW Frequency)', font: { size: 16 } },
        xaxis: { title: '\u03C9_MW (GHz)', gridcolor: COLORS.grid },
        yaxis: { title: '\u03C1\u2080', gridcolor: COLORS.grid },
    };
    Plotly.newPlot(divId, data, layout, CONFIG);
}

export function updateODMRSpectrum(divId, spectrumData, currentFreq) {
    const freqGHz = spectrumData.frequencies.map(f => f / 1000);
    const traces = [{
        x: freqGHz,
        y: spectrumData.rhoZeroValues,
        type: 'scatter',
        mode: 'lines',
        line: { color: COLORS.accent, width: 2 },
        name: '\u03C1\u2080',
    }];
    // Add vertical line at current MW frequency
    const shapes = [{
        type: 'line',
        x0: currentFreq / 1000,
        x1: currentFreq / 1000,
        y0: 0,
        y1: 1,
        line: { color: '#ff4444', width: 1.5, dash: 'dash' },
    }];
    Plotly.react(divId, traces, {
        ...LAYOUT_BASE,
        title: { text: 'ODMR Spectrum (\u03C1\u2080 vs MW Frequency)', font: { size: 16 } },
        xaxis: { title: '\u03C9_MW (GHz)', gridcolor: COLORS.grid },
        yaxis: { title: '\u03C1\u2080', gridcolor: COLORS.grid },
        shapes,
    }, CONFIG);
}

export function initTimeEvolution(divId) {
    const data = [
        { x: [], y: [], type: 'scatter', mode: 'lines', name: '\u03C1\u208A\u2081', line: { color: COLORS.plus, width: 2 } },
        { x: [], y: [], type: 'scatter', mode: 'lines', name: '\u03C1\u2080', line: { color: COLORS.zero, width: 2 } },
        { x: [], y: [], type: 'scatter', mode: 'lines', name: '\u03C1\u208B\u2081', line: { color: COLORS.minus, width: 2 } },
    ];
    const layout = {
        ...LAYOUT_BASE,
        title: { text: 'Time Evolution', font: { size: 16 } },
        xaxis: { title: 'Time (\u03BCs)', gridcolor: COLORS.grid },
        yaxis: { title: '\u03C1', range: [0, 1.05], gridcolor: COLORS.grid },
        legend: { x: 0.8, y: 0.95 },
    };
    Plotly.newPlot(divId, data, layout, CONFIG);
}

export function updateTimeEvolution(divId, times, states) {
    const rhoPlus = states.map(s => s[0]);
    const rhoMinus = states.map(s => s[1]);
    const rhoZero = states.map((s, i) => 1 - s[0] - s[1]);

    const data = [
        { x: times, y: rhoPlus, type: 'scatter', mode: 'lines', name: '\u03C1\u208A\u2081', line: { color: COLORS.plus, width: 2 } },
        { x: times, y: rhoZero, type: 'scatter', mode: 'lines', name: '\u03C1\u2080', line: { color: COLORS.zero, width: 2 } },
        { x: times, y: rhoMinus, type: 'scatter', mode: 'lines', name: '\u03C1\u208B\u2081', line: { color: COLORS.minus, width: 2 } },
    ];
    Plotly.react(divId, data, {
        ...LAYOUT_BASE,
        title: { text: 'Time Evolution', font: { size: 16 } },
        xaxis: { title: 'Time (\u03BCs)', gridcolor: COLORS.grid },
        yaxis: { title: '\u03C1', range: [0, 1.05], gridcolor: COLORS.grid },
        legend: { x: 0.8, y: 0.95 },
    }, CONFIG);
}
