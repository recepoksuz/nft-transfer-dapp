"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useERC1155BatchTransfer } from "@/hooks/useERC1155BatchTransfer";
import { useERC721MultiTransfer } from "@/hooks/useERC721MultiTransfer";
import { useContractType } from "@/hooks/useContractType";
import { NFTSelector } from "./NFTSelector";
import { ERC721MultiTransferStatus } from "./ERC721MultiTransferStatus";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { isValidAddress, shortenAddress } from "@/lib/utils";
import type { Address } from "viem";
import type { TokenItem } from "@/types";

// ERC-1155 Success Component
function ERC1155SuccessStatus({
  hash,
  onReset,
}: {
  hash?: `0x${string}`;
  onReset: () => void;
}) {
  const { chain } = useAccount();

  const getExplorerUrl = (txHash: string) => {
    if (chain?.blockExplorers?.default?.url) {
      return `${chain.blockExplorers.default.url}/tx/${txHash}`;
    }
    return `https://etherscan.io/tx/${txHash}`;
  };

  const getExplorerName = () => {
    return chain?.blockExplorers?.default?.name || "Explorer";
  };

  return (
    <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="h-5 w-5 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="font-medium text-green-700 dark:text-green-400">
            Batch transfer completed!
          </span>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-sm text-green-600 hover:text-green-500"
        >
          New Transfer
        </button>
      </div>
      {hash && (
        <a
          href={getExplorerUrl(hash)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block text-xs text-green-600 hover:text-green-500 dark:text-green-500 dark:hover:text-green-400"
        >
          View on {getExplorerName()}: {shortenAddress(hash)} ↗
        </a>
      )}
    </div>
  );
}

export function BatchTransferForm() {
  const { address, isConnected, chain } = useAccount();

  // ERC-1155 batch transfer hook
  const erc1155Transfer = useERC1155BatchTransfer();

  // ERC-721 multi-transfer hook
  const erc721Transfer = useERC721MultiTransfer();

  const [contractAddress, setContractAddress] = useState("");

  // Contract type detection
  const validContractAddress = isValidAddress(contractAddress)
    ? (contractAddress as Address)
    : undefined;
  const { contractType, isERC721, isERC1155, isLoading: isDetecting } =
    useContractType(validContractAddress);

  const [toAddress, setToAddress] = useState("");
  const [tokens, setTokens] = useState<TokenItem[]>([]);

  // Dynamic explorer URL based on connected chain
  const getExplorerUrl = (txHash: string) => {
    if (chain?.blockExplorers?.default?.url) {
      return `${chain.blockExplorers.default.url}/tx/${txHash}`;
    }
    return `https://etherscan.io/tx/${txHash}`;
  };

  // Determine which hook is active based on contract type
  const isProcessing = isERC721
    ? erc721Transfer.isTransferring || erc721Transfer.isPending || erc721Transfer.isConfirming
    : erc1155Transfer.isPending || erc1155Transfer.isConfirming;

  const addToken = () => {
    setTokens([
      ...tokens,
      { id: Date.now().toString(), tokenId: "", amount: isERC721 ? "1" : "" },
    ]);
  };

  const removeToken = (id: string) => {
    if (isProcessing) return;
    setTokens(tokens.filter((t) => t.id !== id));
  };

  const updateToken = (id: string, field: "tokenId" | "amount", value: string) => {
    if (isProcessing) return;
    setTokens(tokens.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const handleNFTSelect = (selectedTokenId: string, balance: string) => {
    const existingToken = tokens.find((t) => t.tokenId === selectedTokenId);
    if (!existingToken) {
      setTokens([
        ...tokens,
        {
          id: Date.now().toString(),
          tokenId: selectedTokenId,
          amount: isERC721 ? "1" : "1",
        },
      ]);
    }
  };

  // Validation for ERC-721 (no amount needed)
  const isERC721TokensValid =
    tokens.length > 0 &&
    tokens.every((t) => t.tokenId.trim() !== "" && !isNaN(Number(t.tokenId)));

  // Validation for ERC-1155 (amount required)
  const isERC1155TokensValid =
    tokens.length > 0 &&
    tokens.every(
      (t) =>
        t.tokenId.trim() !== "" &&
        t.amount.trim() !== "" &&
        !isNaN(Number(t.tokenId)) &&
        !isNaN(Number(t.amount)) &&
        Number(t.amount) > 0
    );

  const isFormValid =
    isValidAddress(contractAddress) &&
    isValidAddress(toAddress) &&
    ((isERC721 && isERC721TokensValid) || (isERC1155 && isERC1155TokensValid));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !isFormValid) return;

    if (isERC721) {
      erc721Transfer.startTransfer(
        {
          contractAddress: contractAddress as Address,
          to: toAddress as Address,
          tokenIds: tokens.map((t) => BigInt(t.tokenId)),
        },
        address
      );
    } else if (isERC1155) {
      await erc1155Transfer.batchTransfer(
        {
          contractAddress: contractAddress as Address,
          to: toAddress as Address,
          tokenIds: tokens.map((t) => BigInt(t.tokenId)),
          amounts: tokens.map((t) => BigInt(t.amount)),
        },
        address
      );
    }
  };

  const handleReset = () => {
    if (isERC721) {
      erc721Transfer.reset();
    } else {
      erc1155Transfer.reset();
    }
    setContractAddress("");
    setToAddress("");
    setTokens([]);
  };

  // Get transfer status for display
  const getTransferStatus = () => {
    if (isERC721) {
      if (erc721Transfer.isComplete) return "complete";
      if (erc721Transfer.error) return "error";
      if (erc721Transfer.isTransferring) return "transferring";
      return "idle";
    } else {
      if (erc1155Transfer.isSuccess) return "complete";
      if (erc1155Transfer.error) return "error";
      if (erc1155Transfer.isPending || erc1155Transfer.isConfirming)
        return "transferring";
      return "idle";
    }
  };

  const transferStatus = getTransferStatus();

  if (!isConnected) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-800">
        <p className="mb-4 text-zinc-600 dark:text-zinc-400">
          Please connect your wallet to transfer NFTs
        </p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Contract Address
          </label>
          <input
            type="text"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            placeholder="0x..."
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            disabled={isProcessing}
          />
        </div>

        {isValidAddress(contractAddress) && (
          <div className="space-y-3">
            {/* Contract Type Badge */}
            <div className="flex items-center gap-2">
              {isDetecting ? (
                <span className="rounded-md bg-zinc-200 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                  Detecting...
                </span>
              ) : contractType === "ERC721" ? (
                <span className="rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  ERC-721
                </span>
              ) : contractType === "ERC1155" ? (
                <span className="rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  ERC-1155
                </span>
              ) : (
                <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  Unknown
                </span>
              )}
            </div>

            {/* ERC-721 Info */}
            {isERC721 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  ℹ️ ERC-721 tokens will be transferred one by one. You&apos;ll
                  need to approve each transfer in your wallet.
                </p>
              </div>
            )}

            {/* NFT Selector - show for both contract types */}
            {(contractType === "ERC721" ||
              contractType === "ERC1155" ||
              contractType === "unknown") && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
                <h4 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Check Your NFTs (click Select to add)
                </h4>
                <NFTSelector
                  contractAddress={contractAddress}
                  onSelect={handleNFTSelect}
                  contractType={contractType}
                  selectedTokenIds={tokens.map(t => t.tokenId)}
                />
              </div>
            )}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Recipient Address
          </label>
          <input
            type="text"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            placeholder="0x..."
            className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            disabled={isProcessing}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Selected Tokens ({tokens.length})
            </label>
            <button
              type="button"
              onClick={addToken}
              disabled={isProcessing}
              className="text-sm text-yellow-600 hover:text-yellow-500 disabled:opacity-50"
            >
              + Add Manually
            </button>
          </div>

          {tokens.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center dark:border-zinc-600 dark:bg-zinc-800/50">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Select NFTs from above or add manually
              </p>
            </div>
          ) : (
            <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {tokens.map((token, index) => {
                // Check transfer status for this token (ERC-721 only)
                const tokenTransferStatus = isERC721
                  ? erc721Transfer.completedTransfers.find(
                      (t) => t.tokenId === BigInt(token.tokenId || "0")
                    )
                  : null;
                const isCurrentToken =
                  isERC721 &&
                  erc721Transfer.isTransferring &&
                  erc721Transfer.currentTokenId === BigInt(token.tokenId || "0");

                return (
                  <div
                    key={token.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 ${
                      tokenTransferStatus?.status === "success"
                        ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                        : tokenTransferStatus?.status === "failed"
                        ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                        : isCurrentToken
                        ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20"
                        : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800"
                    }`}
                  >
                    {/* Status indicator for ERC-721 */}
                    {isERC721 && erc721Transfer.isTransferring && (
                      <div className="flex h-6 w-6 items-center justify-center">
                        {tokenTransferStatus?.status === "success" ? (
                          <svg
                            className="h-5 w-5 text-green-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : tokenTransferStatus?.status === "failed" ? (
                          <svg
                            className="h-5 w-5 text-red-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        ) : isCurrentToken ? (
                          <svg
                            className="h-5 w-5 animate-spin text-yellow-500"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                        ) : (
                          <span className="text-xs text-zinc-400">
                            #{index + 1}
                          </span>
                        )}
                      </div>
                    )}

                    {!isERC721 ||
                      (!erc721Transfer.isTransferring && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          #{index + 1}
                        </span>
                      ))}

                    <input
                      type="text"
                      value={token.tokenId}
                      onChange={(e) =>
                        updateToken(token.id, "tokenId", e.target.value)
                      }
                      placeholder="Token ID"
                      className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-yellow-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
                      disabled={isProcessing}
                    />

                    {/* Amount field - only for ERC-1155 */}
                    {!isERC721 && (
                      <input
                        type="text"
                        value={token.amount}
                        onChange={(e) =>
                          updateToken(token.id, "amount", e.target.value)
                        }
                        placeholder="Amount"
                        className="w-24 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-yellow-500 focus:outline-none dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100 dark:placeholder-zinc-500"
                        disabled={isProcessing}
                      />
                    )}

                    {/* TX hash link for completed transfers */}
                    {tokenTransferStatus?.status === "success" && (
                      <a
                        href={getExplorerUrl(tokenTransferStatus.hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:text-blue-400"
                      >
                        {shortenAddress(tokenTransferStatus.hash)}
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => removeToken(token.id)}
                      disabled={isProcessing}
                      className="text-red-500 hover:text-red-400 disabled:opacity-50"
                    >
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isFormValid || isProcessing || isDetecting}
          className="w-full rounded-lg bg-yellow-500 py-3 text-sm font-medium text-black transition-colors hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isProcessing
            ? isERC721
              ? `Transferring ${erc721Transfer.currentIndex + 1}/${erc721Transfer.totalCount}...`
              : "Processing..."
            : tokens.length > 0
            ? `Transfer ${tokens.length} NFT${tokens.length > 1 ? "s" : ""}`
            : "Select NFTs to Transfer"}
        </button>
      </form>

      {/* ERC-721 Multi Transfer Status */}
      {isERC721 && (erc721Transfer.isTransferring || erc721Transfer.isComplete) && (
        <ERC721MultiTransferStatus
          isTransferring={erc721Transfer.isTransferring}
          isComplete={erc721Transfer.isComplete}
          isPending={erc721Transfer.isPending}
          isConfirming={erc721Transfer.isConfirming}
          currentIndex={erc721Transfer.currentIndex}
          totalCount={erc721Transfer.totalCount}
          currentTokenId={erc721Transfer.currentTokenId}
          currentHash={erc721Transfer.currentHash}
          completedTransfers={erc721Transfer.completedTransfers}
          error={erc721Transfer.error}
          failedTokenId={erc721Transfer.failedTokenId}
          onRetry={erc721Transfer.retry}
          onSkip={erc721Transfer.skip}
          onReset={handleReset}
        />
      )}

      {/* ERC-1155 Success Status */}
      {!isERC721 && erc1155Transfer.isSuccess && (
        <ERC1155SuccessStatus
          hash={erc1155Transfer.hash}
          onReset={handleReset}
        />
      )}

      {/* Error Status for ERC-1155 */}
      {!isERC721 && erc1155Transfer.error && !isProcessing && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <span className="font-medium text-red-700 dark:text-red-400">
                Transfer failed
              </span>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="text-sm text-red-600 hover:text-red-500"
            >
              Try Again
            </button>
          </div>
          <p className="mt-2 text-xs text-red-600 dark:text-red-500">
            {erc1155Transfer.error.message?.slice(0, 150)}
          </p>
        </div>
      )}
    </div>
  );
}
