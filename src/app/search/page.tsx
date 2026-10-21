import type { Metadata } from "next";

import { SearchWorkspace } from "@/components/search/search-workspace";

export const metadata: Metadata = {
  title: "Lead Search",
  description:
    "Build targeted Google, Google Maps and LinkedIn-indexed searches for business owners, founders and CEOs.",
};

export default function LeadSearchPage() {
  return <SearchWorkspace />;
}
