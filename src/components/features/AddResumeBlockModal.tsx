"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createLibraryBlock, libraryBlockFormToInput } from "@/lib/resume/library";
import { EMPTY_LIBRARY_BLOCK_FORM, LibraryBlockForm } from "./LibraryBlockForm";

export function AddResumeBlockModal({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_LIBRARY_BLOCK_FORM);
  const router = useRouter();

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await createLibraryBlock(supabase, userId, libraryBlockFormToInput(form));
      setOpen(false);
      setForm(EMPTY_LIBRARY_BLOCK_FORM);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add block
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Add block</DialogTitle>
          <DialogDescription>Create a reusable library block you can copy into any resume.</DialogDescription>
        </DialogHeader>
        <LibraryBlockForm
          idPrefix="block"
          values={form}
          onChange={setForm}
          onCancel={() => setOpen(false)}
          onSubmit={handleSubmit}
          loading={loading}
          error={error}
          submitLabel="Add block"
          submittingLabel="Adding…"
        />
      </DialogContent>
    </Dialog>
  );
}
