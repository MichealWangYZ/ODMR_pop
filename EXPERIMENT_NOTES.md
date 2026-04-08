# Experiment Notes

## Microwave Power Anchor

- Manuscript folder consulted: `/Users/mac/Simultaneous/Simultaneous_Determination_arxiv_ready`
- The nanodiamond ODMR measurements are described as using microwave power "typically around `-20 dBm`".
- `-20 dBm = 0.01 mW = 10 uW`.

Relevant manuscript references:

- `/Users/mac/Simultaneous/Simultaneous_Determination_arxiv_ready/appendix_to_main_text.tex`
- `/Users/mac/Simultaneous/Simultaneous_Determination_arxiv_ready/referee_a.tex`

## Simulator Interpretation

- We do not have a measured in-repo calibration from source power to local NV `B1`.
- For a non-resonant but reasonably efficient microwave delivery setup, `-20 dBm` is taken as a sub-MHz Rabi regime.
- Working estimate adopted for this simulator:
  - `-20 dBm -> Omega ~= 0.15 MHz`

This is used as the default Rabi frequency in the UI/model.

## Polarization-Dependent Couplings

The simulator should not treat the microwave drive as a scalar that excites both spin transitions equally.

Ground-state spin Hamiltonian used here:

- `H/h = D S_z^2 + gamma B0.S + gamma B1(t).S`
- Resonance frequencies are still approximated by `omega_pm = D +/- gamma B_parallel` when the static field projection along a given NV axis dominates.
- Transition probabilities are set by the circular microwave components transverse to each NV axis:
  - `Omega_+ proportional |(B1,e1 + i B1,e2)/sqrt(2)|`
  - `Omega_- proportional |(B1,e1 - i B1,e2)/sqrt(2)|`
  - `e1` and `e2` span the plane perpendicular to that NV orientation.

This follows the polarization-selection-rule point used in Li et al., *Sensors* 19, 2347 (2019), which describes the MW field as counter-rotating circular components and uses the NV spin-1 transitions as polarization-selective probes of those components:

- https://doi.org/10.3390/s19102347

The laser polarization also changes the optical pumping weight for each NV orientation. The optical transition is modeled as two identical dipoles in the plane orthogonal to the NV axis, so a linearly polarized laser with field `E_L` excites an NV family with relative factor:

- `P_i proportional |E_L x n_i|^2 = 1 - (E_L . n_i)^2`

The simulator uses this factor both for the optical pumping rate and as the relative brightness weight when averaging NV families. It is normalized by the four-orientation average for an in-plane lab polarization, so the slider redistributes the ensemble contribution without changing the nominal average pump-rate scale. This is consistent with the optical polarization dependence in Alegre et al., *Phys. Rev. B* 76, 165205 (2007), and the polarimetric NV ensemble treatment in Magaletti et al., *Scientific Reports* 14, 11793 (2024), which describes NV absorption and emission as governed by two perpendicular identical dipoles in the plane orthogonal to the NV center axis:

- https://doi.org/10.1103/PhysRevB.76.165205
- https://doi.org/10.1038/s41598-024-60199-z

## Scaling Rule

If a later calibration point is available, microwave power can be mapped with:

- `Omega(P_dBm) = Omega_ref * 10^((P_dBm - P_ref)/20)`

Using the current anchor:

- `P_ref = -20 dBm`
- `Omega_ref = 0.15 MHz`

Examples:

- `-10 dBm -> ~0.47 MHz`
- `0 dBm -> ~1.5 MHz`
- `10 dBm -> ~4.7 MHz`

## ¹⁴N Hyperfine Triplet

Each electronic transition `|0> <-> |±1>` is split into three lines by the
hyperfine coupling to the host ¹⁴N nucleus (I = 1):

- Ground-state axial coupling `A∥ ≈ -2.16 MHz` (sign immaterial for the
  symmetric triplet structure used here).
- Three nuclear sub-states `m_I = -1, 0, +1` give equally weighted lines at
  `ω_e + m_I · A∥`, i.e. offsets `{-2.16, 0, +2.16}` MHz from the electronic
  resonance.

Implementation (`js/physics.js`):

- `CONSTANTS.A_N14 = 2.16` MHz, `HYPERFINE_OFFSETS_N14 = [-A, 0, +A]`.
- `transitionRatesForB` averages the Lorentzian rate `W±` over the three
  hyperfine offsets with equal nuclear weights `1/3`. This is a mean-field
  treatment of the spectator nucleus — exact in the unsaturated limit
  (`Ω² T1 T2 ≪ 1`) and a small overestimate of saturation in the saturated
  regime, but adequate for the visualization.
- `expandHyperfine()` is used by `computeODMRSpectrum` and
  `computeODMRSpectrumEnsemble` to seed the dense local sampling cluster
  around every hyperfine sub-line, not just the electronic centers. This
  prevents undersampling once `T2` is long enough that the linewidth
  approaches or falls below `A∥`.

Visibility regimes:

- `T2 ≲ 1 µs`: power-broadened FWHM (≈ a few MHz) ≫ `A∥`. The triplet stays
  merged into a single dip whose effective width includes the hyperfine
  spread (~`A∥`).
- `T2 ≈ 3 µs`: FWHM crosses below `A∥`. The triplet just resolves; valleys
  between sub-peaks become visible.
- `T2 ≳ 5 µs`: three clean sub-dips of approximately equal depth at
  `{-A∥, 0, +A∥}`, with valleys an order of magnitude shallower.

References:

- ¹⁴N ground-state hyperfine: Felton et al., *Phys. Rev. B* **79**, 075203 (2009).
  https://doi.org/10.1103/PhysRevB.79.075203
- Smeltzer, McIntyre & Childress, *Phys. Rev. A* **80**, 050302(R) (2009),
  resolving the ¹⁴N triplet in cw-ODMR. https://doi.org/10.1103/PhysRevA.80.050302

### Plot interaction

Because the triplet spans only ~4 MHz against a default 600 MHz x-window,
the structure is sub-pixel at the default zoom. The spectrum chart now has
Plotly's drag-to-zoom, scroll-zoom and reset enabled
(`SPECTRUM_CONFIG` in `js/plots.js`), and `uirevision: 'spectrum'` so the
user-driven zoom survives slider updates. Drag a ~10 MHz box around a dashed
resonance marker to see the triplet.

## TODO — Isotopically Purified Diamond (¹²C-Enriched)

Natural-abundance diamond contains ~1.1 % ¹³C (I = 1/2), whose dipolar
coupling to the NV electronic spin is the dominant decoherence source for
the bulk ensemble — capping `T2` at a few µs at room temperature. In
isotopically purified ([¹²C] > 99.99 %) samples, `T2` lengthens by 1–3
orders of magnitude (hundreds of µs to ms; Balasubramanian et al.,
*Nature Materials* **8**, 383 (2009),
https://doi.org/10.1038/nmat2420), and the inhomogeneous-broadening
contribution from the ¹³C bath should be replaced with a much narrower
nuclear-spin-bath model.

Future work for the simulator:

- Expose a `¹³C abundance` slider, mapping abundance to a `T2*` /
  `T2`-Hahn pair via a published parameterization (e.g. Maze et al.,
  *Nature* **455**, 644 (2008); Mizuochi et al., *Phys. Rev. B* **80**,
  041201(R) (2009)).
- At very low ¹³C, expose the residual hyperfine satellites (single ¹³C
  sites) rather than treating them as broadening.
- Distinguish the ensemble inhomogeneous `T2*` from the single-NV
  intrinsic `T2` rather than collapsing both into one parameter.
