"use client";

import { useAccount } from "wagmi";
import { shortenAddress } from "@/lib/utils";
import type { Hash } from "viem";

interface TransferResult {
  tokenId: bigint;
  hash: Hash;
  status: "success" | "failed";
}

interface ERC721MultiTransferStatusProps {
  isTransferring: boolean;
  isComplete: boolean;
  isPending: boolean;
  isConfirming: boolean;
  currentIndex: number;
  totalCount: number;
  currentTokenId?: bigint;
  currentHash?: Hash;
  completedTransfers: TransferResult[];
  error: Error | null;
  failedTokenId?: bigint;
  onRetry: () => void;
  onSkip: () => void;
  onReset: () => void;
}

type StepStatus = "completed" | "active" | "pending";

function getStepStatus(stepIndex: number, currentIndex: number, totalCount: number, isComplete: boolean): StepStatus {
  if (isComplete || stepIndex < currentIndex) return "completed";
  if (stepIndex === currentIndex) return "active";
  return "pending";
}

export function ERC721MultiTransferStatus({
  isTransferring,
  isComplete,
  isPending,
  isConfirming,
  currentIndex,
  totalCount,
  currentTokenId,
  currentHash,
  completedTransfers,
  error,
  failedTokenId,
  onRetry,
  onSkip,
  onReset,
}: ERC721MultiTransferStatusProps) {
  const { chain } = useAccount();

  const getExplorerUrl = (hash: string) => {
    if (chain?.blockExplorers?.default?.url) {
      return `${chain.blockExplorers.default.url}/tx/${hash}`;
    }
    return `https://etherscan.io/tx/${hash}`;
  };

  const getExplorerName = () => {
    return chain?.blockExplorers?.default?.name || "Explorer";
  };

  const successCount = completedTransfers.filter(t => t.status === "success").length;
  const failedCount = completedTransfers.filter(t => t.status === "failed").length;
  const progressPercent = totalCount > 0 ? (completedTransfers.length / totalCount) * 100 : 0;

  // Get current action text
  const getCurrentAction = () => {
    if (error) return "Transaction failed";
    if (isPending) return "Waiting for wallet signature...";
    if (isConfirming) return "Confirming on blockchain...";
    return "Preparing transaction...";
  };

  if (!isTransferring && !isComplete) {
    return null;
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Main Progress Card */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
            {isComplete ? "Transfer Complete" : "Transferring NFTs"}
          </h3>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            isComplete
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
          }`}>
            {completedTransfers.length} / {totalCount}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="mb-2 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>Progress</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
            <div
              className={`h-full transition-all duration-500 ease-out ${
                isComplete ? "bg-green-500" : "bg-yellow-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Current Transfer Status */}
        {isTransferring && !error && currentTokenId !== undefined && (
          <div className="mb-4 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`h-10 w-10 rounded-full ${
                  isPending
                    ? "bg-yellow-100 dark:bg-yellow-900/30"
                    : "bg-blue-100 dark:bg-blue-900/30"
                }`}>
                  <svg
                    className={`h-10 w-10 animate-spin ${
                      isPending ? "text-yellow-500" : "text-blue-500"
                    }`}
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-white dark:bg-zinc-200 dark:text-zinc-800">
                  {currentIndex + 1}
                </span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  Token #{currentTokenId.toString()}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {getCurrentAction()}
                </p>
              </div>
              {isPending && (
                <div className="rounded-md bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                  Sign in Wallet
                </div>
              )}
              {isConfirming && (
                <div className="rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  Mining
                </div>
              )}
            </div>

            {/* Show TX hash when confirming */}
            {isConfirming && currentHash && (
              <div className="mt-2 flex items-center justify-between rounded-md bg-zinc-100 px-2 py-1.5 dark:bg-zinc-800">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">TX Hash</span>
                <a
                  href={getExplorerUrl(currentHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-blue-500 hover:text-blue-400"
                >
                  {shortenAddress(currentHash, 6)} ↗
                </a>
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {error && isTransferring && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-red-700 dark:text-red-400">
                  Failed: Token #{failedTokenId?.toString()}
                </p>
                <p className="mt-1 text-xs text-red-600 dark:text-red-500 break-words">
                  {error.message?.slice(0, 120)}
                  {(error.message?.length || 0) > 120 && "..."}
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={onRetry}
                className="flex-1 rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white hover:bg-red-700"
              >
                Retry This Transfer
              </button>
              <button
                onClick={onSkip}
                className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Skip & Continue
              </button>
            </div>
          </div>
        )}

        {/* Transfer List */}
        {completedTransfers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Completed Transfers
            </p>
            <div className="max-h-40 space-y-1.5 overflow-y-auto">
              {completedTransfers.map((transfer, index) => (
                <div
                  key={`${transfer.tokenId}-${index}`}
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                    transfer.status === "success"
                      ? "bg-green-50 dark:bg-green-900/20"
                      : "bg-red-50 dark:bg-red-900/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {transfer.status === "success" ? (
                      <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className={transfer.status === "success"
                      ? "text-green-700 dark:text-green-400"
                      : "text-red-700 dark:text-red-400"
                    }>
                      Token #{transfer.tokenId.toString()}
                    </span>
                  </div>
                  {transfer.status === "success" && transfer.hash !== "0x" && (
                    <a
                      href={getExplorerUrl(transfer.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-green-600 hover:text-green-500 dark:text-green-500 dark:hover:text-green-400"
                    >
                      {shortenAddress(transfer.hash, 4)} ↗
                    </a>
                  )}
                  {transfer.status === "failed" && (
                    <span className="text-xs text-red-500">Skipped</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Stats - Show when complete */}
        {isComplete && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-green-50 p-3 text-center dark:bg-green-900/20">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{successCount}</p>
              <p className="text-xs text-green-700 dark:text-green-500">Successful</p>
            </div>
            {failedCount > 0 && (
              <div className="rounded-lg bg-red-50 p-3 text-center dark:bg-red-900/20">
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{failedCount}</p>
                <p className="text-xs text-red-700 dark:text-red-500">Failed/Skipped</p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        {isComplete && (
          <button
            onClick={onReset}
            className="mt-4 w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Start New Transfer
          </button>
        )}
      </div>
    </div>
  );
}
