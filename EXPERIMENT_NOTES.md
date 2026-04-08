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
