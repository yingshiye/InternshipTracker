"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import type { LayoutKind } from "@/lib/resume/types";
import { useEditor } from "./useEditorController";

export function AddSectionDialog() {
  const { addSection } = useEditor();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<LayoutKind>("entry");

  const close = () => {
    setOpen(false);
    setTitle("");
    setKind("entry");
  };

  const handleAdd = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    void addSection(trimmedTitle, kind);
    close();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="w-full gap-1.5">
        <Plus className="h-4 w-4" /> Add section
      </Button>
      <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : close())}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add section</DialogTitle>
            <DialogDescription>
              Create a section, then add compatible blocks from the module library.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-section-title">Section title</Label>
              <Input
                id="new-section-title"
                autoFocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleAdd();
                }}
                placeholder="Experience"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-section-kind">Type</Label>
              <Select value={kind} onValueChange={(value) => setKind(value as LayoutKind)}>
                <SelectTrigger id="new-section-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Experience</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="skills">Skills</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button disabled={!title.trim()} onClick={handleAdd}>
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
