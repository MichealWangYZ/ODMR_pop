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
