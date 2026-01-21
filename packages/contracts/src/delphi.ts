export const DELPHI_PROXY = "0x3B5629d3a10C13B51F3DC7d5125A5abe5C20FaF1" as const;
export const DELPHI_IMPL  = "0xaC46F41Df8188034Eb459Bb4c8FaEcd6EE369fdf" as const;

// Paste the ABI you provided, but ideally keep it in JSON file.
// For brevity: export as `delphiAbi` from a JSON import.
import delphiAbiJson from "./delphi.abi.json";
export const delphiAbi = delphiAbiJson as const;
