export const DELPHI_CONTRACT = "0x3B5629d3a10C13B51F3DC7d5125A5abe5C20FaF1";
export const CHAIN_ID = 685685;
export const CHAIN_NAME = "Gensyn Testnet";
export const EXPLORER_URL = "https://gensyn-testnet.explorer.alchemy.com";
export const DELPHI_URL = "https://delphi.gensyn.ai";

export const LINKS = {
  explorer: EXPLORER_URL,
  delphi: DELPHI_URL,
  contract: `${EXPLORER_URL}/address/${DELPHI_CONTRACT}`,
  tx: (hash: string) => `${EXPLORER_URL}/tx/${hash}`,
  address: (addr: string) => `${EXPLORER_URL}/address/${addr}`,
};
