"use client";

import { useState } from "react";
import { TransferTabs } from "@/components/ui/TransferTabs";
import { SingleTransferForm } from "./SingleTransferForm";
import { BatchTransferForm } from "./BatchTransferForm";

export function TransferSection() {
  const [activeTab, setActiveTab] = useState<"single" | "batch">("single");

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-6">
        <TransferTabs activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {activeTab === "single" ? <SingleTransferForm /> : <BatchTransferForm />}
    </div>
  );
}
