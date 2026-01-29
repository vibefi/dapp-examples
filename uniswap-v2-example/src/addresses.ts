import addressesJson from "../addresses.json";

export type Addresses = typeof addressesJson;

export const addresses = addressesJson as Addresses;

export const MAINNET_CHAIN_ID = 1 as const;
