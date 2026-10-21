"use client";

import { AlertTriangle } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { KeywordInput } from "@/components/search/keyword-input";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiSend } from "@/lib/client";
import { COUNTRIES, getCities, getStates, INDUSTRIES } from "@/lib/geo";
import { joinTags, splitTags } from "@/lib/utils";
import { leadInputSchema, LEAD_STATUSES, type LeadStatus } from "@/lib/validations";

/** Shape of a lead as returned by the API (nullable optional fields). */
export interface Lead {
  id: string;
  businessName: string;
  website?: string | null;
  founderName?: string | null;
  jobTitle?: string | null;
  industry?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedinUrl?: string | null;
  sourceUrl?: string | null;
  notes?: string | null;
  tags?: string | null;
  status: string;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  lists?: { id: string; name: string }[];
}

const NONE = "__any__";

interface FormState {
  businessName: string;
  website: string;
  founderName: string;
  jobTitle: string;
  industry: string;
  country: string;
  state: string;
  city: string;
  email: string;
  phone: string;
  linkedinUrl: string;
  sourceUrl: string;
  notes: string;
  tags: string[];
  status: LeadStatus;
}

const EMPTY_FORM: FormState = {
  businessName: "",
  website: "",
  founderName: "",
  jobTitle: "",
  industry: "",
  country: "",
  state: "",
  city: "",
  email: "",
  phone: "",
  linkedinUrl: "",
  sourceUrl: "",
  notes: "",
  tags: [],
  status: "New",
};

function toStatus(value: string | null | undefined): LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as LeadStatus)
    : "New";
}

function leadToForm(lead: Lead): FormState {
  return {
    businessName: lead.businessName ?? "",
    website: lead.website ?? "",
    founderName: lead.founderName ?? "",
    jobTitle: lead.jobTitle ?? "",
    industry: lead.industry ?? "",
    country: lead.country ?? "",
    state: lead.state ?? "",
    city: lead.city ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    linkedinUrl: lead.linkedinUrl ?? "",
    sourceUrl: lead.sourceUrl ?? "",
    notes: lead.notes ?? "",
    tags: splitTags(lead.tags),
    status: toStatus(lead.status),
  };
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [duplicate, setDuplicate] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const wasOpen = React.useRef(false);

  // Re-seed the form every time the dialog is opened (or a different lead is
  // handed to us while it is open).
  React.useEffect(() => {
    if (open && !wasOpen.current) {
      setForm(lead ? leadToForm(lead) : EMPTY_FORM);
      setErrors({});
      setDuplicate(null);
    }
    wasOpen.current = open;
  }, [open, lead]);

  const patch = (next: Partial<FormState>) => setForm((f) => ({ ...f, ...next }));

  const setCountry = (next: string) => {
    setForm((f) => {
      if (f.country === next) return f;
      return { ...f, country: next, state: "", city: "" };
    });
  };

  const countryOptions = React.useMemo(() => {
    const extra = form.country && !(COUNTRIES as readonly string[]).includes(form.country)
      ? [form.country]
      : [];
    return Array.from(new Set([...COUNTRIES, ...extra]));
  }, [form.country]);

  const stateOptions = React.useMemo(() => getStates(form.country), [form.country]);
  const cityOptions = React.useMemo(() => getCities(form.country), [form.country]);

  const validate = (): boolean => {
    const parsed = leadInputSchema.safeParse({
      businessName: form.businessName,
      website: form.website,
      founderName: form.founderName,
      jobTitle: form.jobTitle,
      industry: form.industry,
      country: form.country,
      state: form.state,
      city: form.city,
      email: form.email,
      phone: form.phone,
      linkedinUrl: form.linkedinUrl,
      sourceUrl: form.sourceUrl,
      notes: form.notes,
      tags: joinTags(form.tags),
      status: form.status,
    });

    if (parsed.success) {
      setErrors({});
      return true;
    }

    const next: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!next[key]) next[key] = issue.message;
    }
    setErrors(next);

    const first = parsed.error.issues[0]?.path[0];
    if (first) {
      const el = document.getElementById(`lead-${String(first)}`);
      if (el) el.focus();
    }
    return false;
  };

  const submit = async (force = false) => {
    if (!validate()) return;

    const payload: Record<string, unknown> = {
      businessName: form.businessName,
      website: form.website || undefined,
      founderName: form.founderName || undefined,
      jobTitle: form.jobTitle || undefined,
      industry: form.industry || undefined,
      country: form.country || undefined,
      state: form.state || undefined,
      city: form.city || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      linkedinUrl: form.linkedinUrl || undefined,
      sourceUrl: form.sourceUrl || undefined,
      notes: form.notes || undefined,
      tags: joinTags(form.tags),
      status: form.status,
    };
    if (force) payload.force = true;

    setSaving(true);
    try {
      if (lead) {
        await apiSend("PUT", `/api/leads/${lead.id}`, payload);
        toast.success("Lead updated");
      } else {
        await apiSend("POST", "/api/leads", payload);
        toast.success("Lead created");
      }
      setDuplicate(null);
      setForm(EMPTY_FORM);
      setErrors({});
      onSaved();
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && /duplicate/i.test(e.message)) {
        setDuplicate(e.message);
      } else {
        toast.error(e instanceof Error ? e.message : "Could not save lead");
      }
    } finally {
      setSaving(false);
    }
  };

  const isEdit = Boolean(lead);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit lead" : "Add lead"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details of this prospect."
              : "Save a prospect you found with Lead Search."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="lead-businessName">Business name *</Label>
            <Input
              id="lead-businessName"
              className="mt-1.5"
              value={form.businessName}
              onChange={(e) => patch({ businessName: e.target.value })}
              placeholder="Acme Plumbing Co."
              autoComplete="organization"
            />
            <FieldError message={errors.businessName} />
          </div>

          <div>
            <Label htmlFor="lead-website">Website</Label>
            <Input
              id="lead-website"
              className="mt-1.5"
              value={form.website}
              onChange={(e) => patch({ website: e.target.value })}
              placeholder="acmeplumbing.com"
            />
            <FieldError message={errors.website} />
          </div>

          <div>
            <Label htmlFor="lead-industry">Industry</Label>
            <div className="mt-1.5">
              <Combobox
                id="lead-industry"
                options={[...INDUSTRIES]}
                value={form.industry}
                onChange={(v) => patch({ industry: v })}
                placeholder="Select an industry"
                allowCustom
              />
            </div>
            <FieldError message={errors.industry} />
          </div>

          <div>
            <Label htmlFor="lead-founderName">Founder / Owner</Label>
            <Input
              id="lead-founderName"
              className="mt-1.5"
              value={form.founderName}
              onChange={(e) => patch({ founderName: e.target.value })}
              placeholder="Jane Doe"
            />
            <FieldError message={errors.founderName} />
          </div>

          <div>
            <Label htmlFor="lead-jobTitle">Job title</Label>
            <Input
              id="lead-jobTitle"
              className="mt-1.5"
              value={form.jobTitle}
              onChange={(e) => patch({ jobTitle: e.target.value })}
              placeholder="Owner"
            />
            <FieldError message={errors.jobTitle} />
          </div>

          <div>
            <Label htmlFor="lead-country">Country</Label>
            <div className="mt-1.5">
              <Select
                value={form.country || NONE}
                onValueChange={(v) => setCountry(v === NONE ? "" : v)}
              >
                <SelectTrigger id="lead-country">
                  <SelectValue placeholder="Select a country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not set</SelectItem>
                  {countryOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FieldError message={errors.country} />
          </div>

          <div>
            <Label htmlFor="lead-state">State</Label>
            <div className="mt-1.5">
              <Combobox
                id="lead-state"
                options={stateOptions}
                value={form.state}
                onChange={(v) => patch({ state: v })}
                placeholder="Select a state"
                allowCustom
              />
            </div>
            <FieldError message={errors.state} />
          </div>

          <div>
            <Label htmlFor="lead-city">City</Label>
            <div className="mt-1.5">
              <Combobox
                id="lead-city"
                options={cityOptions}
                value={form.city}
                onChange={(v) => patch({ city: v })}
                placeholder="Select a city"
                allowCustom
              />
            </div>
            <FieldError message={errors.city} />
          </div>

          <div>
            <Label htmlFor="lead-email">Email</Label>
            <Input
              id="lead-email"
              type="email"
              className="mt-1.5"
              value={form.email}
              onChange={(e) => patch({ email: e.target.value })}
              placeholder="jane@acmeplumbing.com"
            />
            <FieldError message={errors.email} />
          </div>

          <div>
            <Label htmlFor="lead-phone">Phone</Label>
            <Input
              id="lead-phone"
              className="mt-1.5"
              value={form.phone}
              onChange={(e) => patch({ phone: e.target.value })}
              placeholder="(555) 010-1234"
            />
            <FieldError message={errors.phone} />
          </div>

          <div>
            <Label htmlFor="lead-linkedinUrl">LinkedIn URL</Label>
            <Input
              id="lead-linkedinUrl"
              className="mt-1.5"
              value={form.linkedinUrl}
              onChange={(e) => patch({ linkedinUrl: e.target.value })}
              placeholder="linkedin.com/in/janedoe"
            />
            <FieldError message={errors.linkedinUrl} />
          </div>

          <div>
            <Label htmlFor="lead-sourceUrl">Source URL</Label>
            <Input
              id="lead-sourceUrl"
              className="mt-1.5"
              value={form.sourceUrl}
              onChange={(e) => patch({ sourceUrl: e.target.value })}
              placeholder="Where you found this lead"
            />
            <FieldError message={errors.sourceUrl} />
          </div>

          <div>
            <Label htmlFor="lead-status">Status</Label>
            <div className="mt-1.5">
              <Select
                value={form.status}
                onValueChange={(v) => patch({ status: v as LeadStatus })}
              >
                <SelectTrigger id="lead-status">
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <FieldError message={errors.status} />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="lead-tags">Tags</Label>
            <div className="mt-1.5">
              <KeywordInput
                id="lead-tags"
                value={form.tags}
                onChange={(tags) => patch({ tags })}
                placeholder="Add a tag and press Enter"
              />
            </div>
            <FieldError message={errors.tags} />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="lead-notes">Notes</Label>
            <Textarea
              id="lead-notes"
              className="mt-1.5"
              rows={4}
              value={form.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="Why this lead looks like a good fit…"
            />
            <FieldError message={errors.notes} />
          </div>
        </div>

        {duplicate && (
          <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{duplicate}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Save it anyway if it is a different branch, location or legal entity.
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  loading={saving}
                  onClick={() => void submit(true)}
                >
                  Save anyway
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDuplicate(null)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={saving} onClick={() => void submit(false)}>
            {isEdit ? "Save changes" : "Save lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
