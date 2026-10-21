import type { Metadata } from "next";

import { HistoryView } from "@/components/history/history-view";

export const metadata: Metadata = {
  title: "Search History",
  description:
    "Every Google and Google Maps search you have run, with saved entries you can re-run or copy at any time.",
};

export default function HistoryPage() {
  return <HistoryView />;
}
