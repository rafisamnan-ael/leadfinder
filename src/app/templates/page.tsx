import type { Metadata } from "next";

import { TemplatesView } from "@/components/templates/templates-view";

export const metadata: Metadata = {
  title: "Search Templates",
  description:
    "Browse, favorite, duplicate and edit the reusable Google and Google Maps search templates behind every LeadFinder query.",
};

export default function TemplatesPage() {
  return <TemplatesView />;
}
