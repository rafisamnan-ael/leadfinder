"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiSend } from "@/lib/client";
import type { TemplateDto } from "@/lib/mappers";
import { CATEGORY_LABELS, SEARCH_SOURCES, type CategoryId } from "@/lib/query-engine";
import { searchTemplateInputSchema } from "@/lib/validations";

const CATEGORY_OPTIONS = Object.keys(CATEGORY_LABELS) as CategoryId[];

/** Source labels are the user-facing values of the MultiSelect component. */
const SOURCE_OPTIONS = SEARCH_SOURCES.map((s) => s.label);
const SOURCE_LABEL_BY_ID: Record<string, string> = Object.fromEntries(
  SEARCH_SOURCES.map((s) => [s.id, s.label])
);
const SOURCE_ID_BY_LABEL: Record<string, string> = Object.fromEntries(
  SEARCH_SOURCES.map((s) => [s.label, s.id])
);

interface FormState {
  name: string;
  description: string;
  category: string;
  template: string;
  engine: "google" | "maps";
  /** Source ids (not labels). */
  sources: string[];
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  category: "custom",
  template: "",
  engine: "google",
  sources: [],
};

function formFromTemplate(template: TemplateDto | null): FormState {
  if (!template) return EMPTY_FORM;
  return {
    name: template.name,
    description: template.description,
    category: template.category,
    template: template.template,
    engine: template.engine === "maps" ? "maps" : "google",
    sources: template.sources ?? [],
  };
}

function TemplateForm({
  template,
  onSaved,
  onOpenChange,
}: {
  template: TemplateDto | null;
  onSaved: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = React.useState<FormState>(() => formFromTemplate(template));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  const isEdit = template !== null;

  const patch = (p: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...p }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(p).forEach((k) => delete next[k]);
      return next;
    });
  };

  const selectedLabels = React.useMemo(
    () => form.sources.map((id) => SOURCE_LABEL_BY_ID[id] ?? id),
    [form.sources]
  );

  const handleSourcesChange = (labels: string[]) => {
    const ids = labels
      .map((l) => SOURCE_ID_BY_LABEL[l])
      .filter((id): id is string => Boolean(id));
    patch({ sources: ids });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const parsed = searchTemplateInputSchema.safeParse({
      name: form.name,
      description: form.description,
      category: form.category,
      template: form.template,
      engine: form.engine,
      sources: form.sources,
      isFavorite: template?.isFavorite ?? false,
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.length > 0 ? String(issue.path[0]) : "form";
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      toast.error("Please fix the highlighted fields");
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      if (template) {
        await apiSend("PUT", `/api/templates/${template.id}`, parsed.data);
        toast.success("Template updated");
      } else {
        await apiSend("POST", "/api/templates", parsed.data);
        toast.success("Template created");
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit template" : "New template"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update the query pattern used by this template."
            : "Save a reusable query pattern. Placeholders are filled in from your Lead Search filters."}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="tpl-name" className="text-xs">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="tpl-name"
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="LinkedIn owners in city"
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tpl-description" className="text-xs">
            Description
          </Label>
          <Textarea
            id="tpl-description"
            rows={2}
            value={form.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Decision-maker profiles in a specific city and industry."
            aria-invalid={Boolean(errors.description)}
          />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description}</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-category" className="text-xs">
              Category <span className="text-destructive">*</span>
            </Label>
            <Select value={form.category} onValueChange={(v) => patch({ category: v })}>
              <SelectTrigger id="tpl-category" aria-invalid={Boolean(errors.category)}>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {CATEGORY_LABELS[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-xs text-destructive">{errors.category}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Engine <span className="text-destructive">*</span>
            </Label>
            <Tabs
              value={form.engine}
              onValueChange={(v) => patch({ engine: v as "google" | "maps" })}
            >
              <TabsList className="h-9">
                <TabsTrigger value="google" className="text-xs">
                  Google
                </TabsTrigger>
                <TabsTrigger value="maps" className="text-xs">
                  Google Maps
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {errors.engine && <p className="text-xs text-destructive">{errors.engine}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tpl-template" className="text-xs">
            Template <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="tpl-template"
            rows={4}
            value={form.template}
            onChange={(e) => patch({ template: e.target.value })}
            placeholder='site:linkedin.com/in/ "{role}" "{city}" "{industry}"'
            aria-invalid={Boolean(errors.template)}
            className="font-mono text-xs"
          />
          {errors.template && <p className="text-xs text-destructive">{errors.template}</p>}
          <p className="text-[11px] text-muted-foreground">
            {"Placeholders: {industry} {city} {state} {country} {role} {keyword} {year}"}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Sources</Label>
          <MultiSelect
            options={SOURCE_OPTIONS}
            value={selectedLabels}
            onChange={handleSourcesChange}
            placeholder="Select sources"
          />
          {errors.sources && <p className="text-xs text-destructive">{errors.sources}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {isEdit ? "Save changes" : "Create template"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

export function TemplateFormDialog({
  open,
  onOpenChange,
  template,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create a new template, otherwise the template being edited. */
  template: TemplateDto | null;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="lg">
        <TemplateForm
          key={`${template?.id ?? "new"}-${open ? "open" : "closed"}`}
          template={template}
          onSaved={onSaved}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}
