import type { BadgeProps } from "@/components/ui/badge";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/validations";

export const STATUS_ORDER = LEAD_STATUSES;

export const STATUS_VARIANT: Record<LeadStatus, BadgeProps["variant"]> = {
  New: "muted",
  Researching: "info",
  Qualified: "success",
  Contacted: "warning",
  Replied: "default",
  Won: "success",
  Lost: "destructive",
};

export const STATUS_BAR_COLOR: Record<LeadStatus, string> = {
  New: "bg-muted-foreground/50",
  Researching: "bg-chart-3",
  Qualified: "bg-success",
  Contacted: "bg-warning",
  Replied: "bg-chart-2",
  Won: "bg-primary",
  Lost: "bg-destructive",
};

export function isLeadStatus(value: string): value is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value);
}
