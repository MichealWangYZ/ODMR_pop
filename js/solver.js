// 4th-order Runge-Kutta ODE integrator

/**
 * Single RK4 step.
 * f(state, params) → derivatives array
 */
function rk4Step(f, state, dt, params) {
    const n = state.length;
    const k1 = f(state, params);

    const s2 = new Array(n);
    for (let i = 0; i < n; i++) s2[i] = state[i] + 0.5 * dt * k1[i];
    const k2 = f(s2, params);

    const s3 = new Array(n);
    for (let i = 0; i < n; i++) s3[i] = state[i] + 0.5 * dt * k2[i];
    const k3 = f(s3, params);

    const s4 = new Array(n);
    for (let i = 0; i < n; i++) s4[i] = state[i] + dt * k3[i];
    const k4 = f(s4, params);

    const result = new Array(n);
    for (let i = 0; i < n; i++) {
        result[i] = state[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    }
    return result;
}

/**
 * Integrate ODE from t=0 to t=tMax with step dt.
 * Returns { times, states } where states[i] = state at times[i].
 */
export function integrate(f, initialState, tMax, dt, params) {
    const times = [0];
    const states = [initialState.slice()];
    let state = initialState.slice();
    let t = 0;

    while (t < tMax) {
        const step = Math.min(dt, tMax - t);
        state = rk4Step(f, state, step, params);
        t += step;
        times.push(t);
        states.push(state.slice());
    }

    return { times, states };
}
