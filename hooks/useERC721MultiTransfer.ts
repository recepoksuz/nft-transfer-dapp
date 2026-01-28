"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWriteContract } from "wagmi";
import { usePublicClient } from "wagmi";
import { erc721Abi } from "@/lib/abi/erc721";
import type { Address, Hash } from "viem";

export interface ERC721MultiTransferParams {
  contractAddress: Address;
  to: Address;
  tokenIds: bigint[];
}

interface TransferResult {
  tokenId: bigint;
  hash: Hash;
  status: "pending" | "success" | "failed";
}

export function useERC721MultiTransfer() {
  // Transfer queue state
  const [queue, setQueue] = useState<bigint[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransferring, setIsTransferring] = useState(false);
  const [completedTransfers, setCompletedTransfers] = useState<TransferResult[]>([]);
  const [transferParams, setTransferParams] = useState<{
    contractAddress: Address;
    to: Address;
    from: Address;
  } | null>(null);

  // Track if we've already moved to next for current hash
  const movedToNextRef = useRef(false);
  const publicClient = usePublicClient();

  // Wagmi hooks
  const {
    data: currentHash,
    writeContract,
    isPending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const currentTokenId = queue[currentIndex];
  const totalCount = queue.length;

  // Check if all transfers are done (either success or failed, not pending)
  const allTransfersSubmitted = currentIndex >= totalCount && totalCount > 0;
  const allTransfersConfirmed = completedTransfers.length === totalCount &&
    totalCount > 0 &&
    completedTransfers.every(t => t.status === "success" || t.status === "failed");
  const isComplete = allTransfersConfirmed;

  // Count pending confirmations
  const pendingConfirmations = completedTransfers.filter(t => t.status === "pending").length;
  const isConfirming = pendingConfirmations > 0;

  // Execute transfer for current token
  const executeCurrentTransfer = useCallback(() => {
    if (!transferParams || currentIndex >= queue.length) return;

    movedToNextRef.current = false;
    const tokenId = queue[currentIndex];
    writeContract({
      address: transferParams.contractAddress,
      abi: erc721Abi,
      functionName: "safeTransferFrom",
      args: [transferParams.from, transferParams.to, tokenId],
    });
  }, [transferParams, currentIndex, queue, writeContract]);

  // Start the multi-transfer process
  const startTransfer = useCallback(
    (params: ERC721MultiTransferParams, from: Address) => {
      if (params.tokenIds.length === 0) return;

      setQueue(params.tokenIds);
      setCurrentIndex(0);
      setIsTransferring(true);
      setCompletedTransfers([]);
      movedToNextRef.current = false;
      setTransferParams({
        contractAddress: params.contractAddress,
        to: params.to,
        from,
      });
    },
    []
  );

  // Auto-execute first transfer when params are set
  useEffect(() => {
    if (transferParams && isTransferring && currentIndex === 0 && queue.length > 0 && !currentHash && !isPending) {
      executeCurrentTransfer();
    }
  }, [transferParams, isTransferring, currentIndex, queue.length, currentHash, isPending, executeCurrentTransfer]);

  // When we get a hash, immediately move to next token (don't wait for confirmation)
  useEffect(() => {
    if (currentHash && isTransferring && !movedToNextRef.current && currentIndex < queue.length) {
      movedToNextRef.current = true;
      const tokenId = queue[currentIndex];

      // Add to completed transfers as "pending"
      setCompletedTransfers((prev) => [
        ...prev,
        { tokenId, hash: currentHash, status: "pending" },
      ]);

      // Start watching for confirmation in the background
      const hashToWatch = currentHash;

      if (publicClient) {
        publicClient.waitForTransactionReceipt({ hash: hashToWatch })
          .then(() => {
            // Update status to success
            setCompletedTransfers((prev) =>
              prev.map((t) =>
                t.hash === hashToWatch ? { ...t, status: "success" as const } : t
              )
            );
          })
          .catch(() => {
            // Update status to failed
            setCompletedTransfers((prev) =>
              prev.map((t) =>
                t.hash === hashToWatch ? { ...t, status: "failed" as const } : t
              )
            );
          });
      }

      // Move to next token immediately
      const nextIndex = currentIndex + 1;
      if (nextIndex < queue.length) {
        setCurrentIndex(nextIndex);
        resetWrite();
      } else {
        // All transfers submitted, but may still be confirming
        setCurrentIndex(nextIndex);
      }
    }
  }, [currentHash, isTransferring, currentIndex, queue, resetWrite, publicClient]);

  // Execute next transfer after moving to next index
  useEffect(() => {
    if (isTransferring && currentIndex > 0 && currentIndex < queue.length && !currentHash && !isPending) {
      executeCurrentTransfer();
    }
  }, [isTransferring, currentIndex, queue.length, currentHash, isPending, executeCurrentTransfer]);

  // Check if we're done
  useEffect(() => {
    if (allTransfersConfirmed && isTransferring) {
      setIsTransferring(false);
    }
  }, [allTransfersConfirmed, isTransferring]);

  // Skip failed transfer and continue
  const skip = useCallback(() => {
    if (!isTransferring || writeError === null) return;

    const tokenId = queue[currentIndex];
    setCompletedTransfers((prev) => [
      ...prev,
      { tokenId, hash: "0x" as Hash, status: "failed" },
    ]);

    movedToNextRef.current = true;
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      setCurrentIndex(nextIndex);
      resetWrite();
    } else {
      setCurrentIndex(nextIndex);
    }
  }, [isTransferring, writeError, currentIndex, queue, resetWrite]);

  // Retry failed transfer
  const retry = useCallback(() => {
    if (!isTransferring || writeError === null) return;
    resetWrite();
    movedToNextRef.current = false;
    // Small delay before retry
    setTimeout(() => {
      executeCurrentTransfer();
    }, 100);
  }, [isTransferring, writeError, resetWrite, executeCurrentTransfer]);

  // Reset everything
  const reset = useCallback(() => {
    setQueue([]);
    setCurrentIndex(0);
    setIsTransferring(false);
    setCompletedTransfers([]);
    setTransferParams(null);
    movedToNextRef.current = false;
    resetWrite();
  }, [resetWrite]);

  return {
    // Transfer control
    startTransfer,
    skip,
    retry,
    reset,

    // Queue state
    queue,
    currentIndex,
    totalCount,
    currentTokenId,

    // Transfer status
    isTransferring,
    isComplete,
    isPending,
    isConfirming,
    pendingConfirmations,
    allTransfersSubmitted,

    // Results
    currentHash,
    completedTransfers,

    // Error handling
    error: writeError,
    failedTokenId: writeError ? currentTokenId : undefined,
  };
}
