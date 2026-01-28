import { isAddress, getAddress } from "viem";

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function isValidAddress(address: string): boolean {
  return isAddress(address);
}

export function toChecksumAddress(address: string): string | null {
  try {
    return getAddress(address);
  } catch {
    return null;
  }
}
