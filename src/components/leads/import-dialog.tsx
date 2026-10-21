"use client";

import { Download, FileUp, Upload } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiGet } from "@/lib/client";
import { csvHeaderRow, toCsv } from "@/lib/csv";
import { downloadText } from "@/lib/utils";

const NONE = "__none__";

interface ListItem {
  id: string;
  name: string;
  createdAt?: string;
  leadCount?: number;
}

interface ImportResult {
  imported: number;
  skipped: number;
  invalid: number;
  total: number;
}

/** Minimal response → JSON helper (the import endpoint is a raw fetch). */
async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export function ImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [skipDuplicates, setSkipDuplicates] = React.useState(true);
  const [listId, setListId] = React.useState(NONE);
  const [lists, setLists] = React.useState<ListItem[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [result, setResult] = React.useState<ImportResult | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiGet<{ items: ListItem[] }>("/api/lists");
        if (!cancelled) setLists(data.items);
      } catch {
        if (!cancelled) setLists([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const downloadTemplate = () => {
    downloadText("leadfinder-leads-template.csv", toCsv([csvHeaderRow()]));
    toast.success("Template downloaded");
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("skipDuplicates", String(skipDuplicates));
      if (listId !== NONE) fd.append("listId", listId);

      const res = await fetch("/api/leads/import", { method: "POST", body: fd });
      const data = await readJson<ImportResult>(res);
      setResult(data);
      toast.success(
        `Imported ${data.imported} lead${data.imported === 1 ? "" : "s"}`
      );
      onImported();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not import the file");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent maxWidth="md">
        <DialogHeader>
          <DialogTitle>Import leads</DialogTitle>
          <DialogDescription>
            Upload a CSV file of prospects. Rows are validated against the same rules
            as the manual form.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="import-file">CSV file</Label>
            <input
              id="import-file"
              type="file"
              accept=".csv,text/csv"
              className="mt-1.5 block w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setResult(null);
              }}
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              CSV column headers: Business Name, Website, Founder/Owner Name, Job
              Title, Industry, Country, State, City, Email, Phone, LinkedIn URL,
              Source URL, Notes, Tags, Status — download the template for the exact
              list.
            </p>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border px-3 py-2.5">
            <div className="min-w-0">
              <Label htmlFor="import-skip">Skip duplicates</Label>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Ignore rows whose business name or website already exists.
              </p>
            </div>
            <Switch
              id="import-skip"
              checked={skipDuplicates}
              onCheckedChange={setSkipDuplicates}
            />
          </div>

          <div>
            <Label htmlFor="import-list">Add imported leads to a list</Label>
            <div className="mt-1.5">
              <Select value={listId} onValueChange={setListId}>
                <SelectTrigger id="import-list">
                  <SelectValue placeholder="No list" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No list</SelectItem>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {result && (
            <div className="space-y-2 rounded-lg border bg-muted/40 px-3 py-2.5">
              <p className="text-xs font-medium text-muted-foreground">
                Last import — {result.total} row{result.total === 1 ? "" : "s"} read
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="success">{result.imported} imported</Badge>
                <Badge variant="muted">{result.skipped} skipped</Badge>
                <Badge variant="destructive">{result.invalid} invalid</Badge>
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={downloadTemplate}
          >
            <Download className="h-3.5 w-3.5" />
            Download CSV template
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            loading={uploading}
            disabled={!file}
            onClick={() => void upload()}
          >
            {uploading ? <Upload className="h-4 w-4" /> : <FileUp className="h-4 w-4" />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
