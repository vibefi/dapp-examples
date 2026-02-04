import addressesJson from "../addresses.json";

export type Addresses = typeof addressesJson.mainnet;

export const addresses = addressesJson.mainnet;

export const MAINNET_CHAIN_ID = 1 as const;
