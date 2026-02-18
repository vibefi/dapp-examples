import vibefiJson from "../vibefi.json";

export type Addresses = typeof vibefiJson.addresses.mainnet;

export const addresses = vibefiJson.addresses.mainnet;

export const MAINNET_CHAIN_ID = 1 as const;
