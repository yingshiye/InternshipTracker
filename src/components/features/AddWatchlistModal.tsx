"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const EMPTY_FORM = {
  company: "",
  url: "",
};

export function AddWatchlistModal() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const router = useRouter();

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Not authenticated.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("user_watchlist").insert({
      user_id: user.id,
      company: form.company,
      url: form.url,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    // Registers the URL for the next cron run — the cron populates
    // content_hash on its first pass using the service role key.
    await supabase
      .from("url_snapshots")
      .upsert({ url: form.url }, { onConflict: "url", ignoreDuplicates: true });

    setOpen(false);
    setForm(EMPTY_FORM);
    setLoading(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add site
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">
            Add site
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company">Company name</Label>
            <Input
              id="company"
              placeholder="Acme Corp"
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="url">Careers page URL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://company.com/careers"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding…" : "Add site"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
