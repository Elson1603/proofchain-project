import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createProject, type ApiProject, type ApiUser } from "@/lib/proofchain-api";

type DraftMilestone = {
  title: string;
  description: string;
  amount: string;
};

type CreateProjectDialogProps = {
  owner: ApiUser | null;
  onCreated?: (project: ApiProject) => void;
  triggerLabel?: string;
};

const emptyMilestone = (): DraftMilestone => ({
  title: "",
  description: "",
  amount: "",
});

export function CreateProjectDialog({ owner, onCreated, triggerLabel = "Create project" }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [milestones, setMilestones] = useState<DraftMilestone[]>([emptyMilestone()]);

  const totalMilestones = useMemo(
    () => milestones.reduce((sum, milestone) => sum + (Number.parseFloat(milestone.amount) || 0), 0),
    [milestones],
  );

  const reset = () => {
    setTitle("");
    setDescription("");
    setBudget("");
    setDeadline("");
    setMilestones([emptyMilestone()]);
  };

  const updateMilestone = (index: number, patch: Partial<DraftMilestone>) => {
    setMilestones((current) =>
      current.map((milestone, milestoneIndex) =>
        milestoneIndex === index ? { ...milestone, ...patch } : milestone,
      ),
    );
  };

  const removeMilestone = (index: number) => {
    setMilestones((current) => (current.length === 1 ? current : current.filter((_, milestoneIndex) => milestoneIndex !== index)));
  };

  const submit = async () => {
    if (!owner) {
      toast.error("Connect as a client before creating a project");
      return;
    }

    const parsedBudget = Number.parseFloat(budget);
    const normalizedMilestones = milestones
      .map((milestone) => ({
        title: milestone.title.trim(),
        description: milestone.description.trim() || undefined,
        amount: Number.parseFloat(milestone.amount),
      }))
      .filter((milestone) => milestone.title && Number.isFinite(milestone.amount) && milestone.amount > 0);

    if (!title.trim()) {
      toast.error("Project title is required");
      return;
    }

    if (!Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      toast.error("Budget must be greater than 0");
      return;
    }

    if (!normalizedMilestones.length) {
      toast.error("Add at least one milestone");
      return;
    }

    setSaving(true);
    try {
      const project = await createProject({
        ownerId: owner.id,
        title: title.trim(),
        description: description.trim() || undefined,
        budget: parsedBudget,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        status: "open",
        milestones: normalizedMilestones,
      });

      if (!project) {
        throw new Error("Project creation failed");
      }

      toast.success("Project created");
      reset();
      setOpen(false);
      onCreated?.(project);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Project creation failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Create a real open project with milestones. Freelancers can accept it from their projects page.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="project-title">
                Title
              </label>
              <Input id="project-title" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground" htmlFor="project-budget">
                Budget
              </label>
              <Input
                id="project-budget"
                inputMode="decimal"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="project-description">
              Description
            </label>
            <Textarea
              id="project-description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground" htmlFor="project-deadline">
              Deadline
            </label>
            <Input
              id="project-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </div>

          <div className="rounded-lg border border-border/70 bg-secondary/25 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">Milestones</p>
                <p className="text-xs text-muted-foreground">Total planned: {totalMilestones.toLocaleString()} mUSD</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setMilestones((current) => [...current, emptyMilestone()])}>
                Add milestone
              </Button>
            </div>

            <div className="mt-3 space-y-3">
              {milestones.map((milestone, index) => (
                <div key={index} className="rounded-lg border border-border/70 bg-background/45 p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
                    <Input
                      value={milestone.title}
                      onChange={(event) => updateMilestone(index, { title: event.target.value })}
                      placeholder="Milestone title"
                    />
                    <Input
                      inputMode="decimal"
                      value={milestone.amount}
                      onChange={(event) => updateMilestone(index, { amount: event.target.value })}
                      placeholder="Amount"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeMilestone(index)}
                      disabled={milestones.length === 1}
                      aria-label="Remove milestone"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    className="mt-3"
                    rows={2}
                    value={milestone.description}
                    onChange={(event) => updateMilestone(index, { description: event.target.value })}
                    placeholder="Milestone acceptance notes"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submit} disabled={saving || !owner}>
              {saving ? "Creating..." : "Create project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
