"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Save, Trash2, X, Plus, ArrowLeft } from "lucide-react";
import { upsertMilestoneAction, deleteMilestoneAction } from "../actions";
import type {
  CampaignDefinition,
  CampaignMilestone,
  MilestoneTriggerType,
} from "@/lib/adapters/supabase/campaigns";

/**
 * Admin UI: edit campaign milestones inline. Each campaign is a section;
 * within it, milestones are rendered as editable rows. The mini-form lets
 * the user adjust label, day offset, trigger type, etc., then saves via
 * server action — page revalidates and the new cadence shows on /campanas.
 */
export function MilestoneEditor({
  campaigns,
  milestones,
}: {
  campaigns: CampaignDefinition[];
  milestones: CampaignMilestone[];
}) {
  const byCampaign = new Map<string, CampaignMilestone[]>();
  for (const m of milestones) {
    const arr = byCampaign.get(m.campaignId) ?? [];
    arr.push(m);
    byCampaign.set(m.campaignId, arr);
  }

  return (
    <div className="space-y-8">
      <Link
        href="/campanas"
        className="inline-flex items-center gap-1.5 text-xs text-neutral-600 transition hover:text-neutral-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al timeline
      </Link>

      {campaigns.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No hay campañas creadas. Aplica el SQL inicial (
          <code className="rounded bg-amber-100 px-1">0003_seed_campaigns.sql</code>) en Supabase
          para sembrar Bono de Bienvenida y Retención Proactiva con sus cadencias por default.
        </div>
      )}

      {campaigns.map((c) => (
        <CampaignSection
          key={c.id}
          campaign={c}
          milestones={(byCampaign.get(c.id) ?? []).sort((a, b) => a.position - b.position)}
        />
      ))}
    </div>
  );
}

function CampaignSection({
  campaign,
  milestones,
}: {
  campaign: CampaignDefinition;
  milestones: CampaignMilestone[];
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center gap-3">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ background: campaign.accentColor }}
        />
        <h2 className="text-base font-semibold text-neutral-900">{campaign.name}</h2>
        <span className="text-xs text-neutral-500">
          {campaign.defaultDurationDays} días totales · {milestones.length} milestones
        </span>
      </header>

      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 text-left text-[11px] tracking-wider text-neutral-500 uppercase">
          <tr>
            <th className="py-2 pr-2 font-semibold">#</th>
            <th className="py-2 pr-2 font-semibold">Label</th>
            <th className="py-2 pr-2 font-semibold">Descripción</th>
            <th className="py-2 pr-2 font-semibold">Disparador</th>
            <th className="py-2 pr-2 font-semibold">Día / Flag</th>
            <th className="py-2 pr-2 font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {milestones.map((m) => (
            <MilestoneRow key={m.id} milestone={m} />
          ))}
          <AddRow campaignId={campaign.id} nextPosition={milestones.length} />
        </tbody>
      </table>
    </section>
  );
}

function MilestoneRow({ milestone }: { milestone: CampaignMilestone }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <MilestoneFormRow
        initial={milestone}
        onCancel={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    );
  }
  return (
    <tr>
      <td className="py-2 pr-2 align-top font-mono text-xs text-neutral-500 tabular-nums">
        {milestone.position}
      </td>
      <td className="py-2 pr-2 align-top font-medium text-neutral-900">{milestone.label}</td>
      <td className="py-2 pr-2 align-top text-xs text-neutral-600">{milestone.description}</td>
      <td className="py-2 pr-2 align-top">
        <TriggerBadge type={milestone.triggerType} />
      </td>
      <td className="py-2 pr-2 align-top text-xs whitespace-nowrap text-neutral-700 tabular-nums">
        {milestone.triggerType === "time" ? `D+${milestone.dayOffset ?? 0}` : "—"}
        {milestone.flag !== null && ` · F${milestone.flag}`}
      </td>
      <td className="py-2 pr-2 align-top">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100"
            aria-label="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <DeleteButton id={milestone.id} />
        </div>
      </td>
    </tr>
  );
}

function AddRow({ campaignId, nextPosition }: { campaignId: string; nextPosition: number }) {
  const [adding, setAdding] = useState(false);
  if (adding) {
    return (
      <MilestoneFormRow
        initial={{
          campaignId,
          position: nextPosition,
          label: "",
          description: "",
          dayOffset: 0,
          triggerType: "time",
          flag: null,
        }}
        onCancel={() => setAdding(false)}
        onSaved={() => setAdding(false)}
      />
    );
  }
  return (
    <tr>
      <td colSpan={6} className="py-2">
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 transition hover:text-neutral-900"
        >
          <Plus className="h-3 w-3" />
          Agregar milestone
        </button>
      </td>
    </tr>
  );
}

type Editable = {
  id?: string;
  campaignId: string;
  position: number;
  label: string;
  description: string;
  dayOffset: number | null;
  triggerType: MilestoneTriggerType;
  flag: number | null;
};

function MilestoneFormRow({
  initial,
  onCancel,
  onSaved,
}: {
  initial: Editable;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(initial.label);
  const [description, setDescription] = useState(initial.description);
  const [position, setPosition] = useState(initial.position);
  const [triggerType, setTriggerType] = useState<MilestoneTriggerType>(initial.triggerType);
  const [dayOffset, setDayOffset] = useState<string>(
    initial.dayOffset === null ? "" : String(initial.dayOffset),
  );
  const [flag, setFlag] = useState<string>(initial.flag === null ? "" : String(initial.flag));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onSave = () => {
    setError(null);
    if (!label.trim()) {
      setError("Falta el label.");
      return;
    }
    const dayOffsetNum = triggerType === "time" ? Number(dayOffset) : null;
    if (triggerType === "time" && !Number.isFinite(dayOffsetNum)) {
      setError("Día inválido para tipo 'time'.");
      return;
    }
    const flagNum = flag.trim() === "" ? null : Number(flag);
    if (flag.trim() !== "" && !Number.isFinite(flagNum)) {
      setError("Flag inválido.");
      return;
    }
    startTransition(async () => {
      const r = await upsertMilestoneAction({
        id: initial.id,
        campaignId: initial.campaignId,
        position,
        label: label.trim(),
        description: description.trim(),
        dayOffset: triggerType === "time" ? (dayOffsetNum as number) : null,
        triggerType,
        flag: flagNum,
      });
      if (!r.ok) setError(r.error);
      else onSaved();
    });
  };

  return (
    <tr className="bg-neutral-50">
      <td className="py-2 pr-2 align-top">
        <input
          type="number"
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          className="w-12 rounded border border-neutral-300 px-1 py-0.5 text-xs"
        />
      </td>
      <td className="py-2 pr-2 align-top">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Reminder 04"
          className="w-full rounded border border-neutral-300 px-1.5 py-0.5 text-xs"
        />
      </td>
      <td className="py-2 pr-2 align-top">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="45 días después de envío sin registro"
          className="w-full rounded border border-neutral-300 px-1.5 py-0.5 text-xs"
        />
      </td>
      <td className="py-2 pr-2 align-top">
        <select
          value={triggerType}
          onChange={(e) => setTriggerType(e.target.value as MilestoneTriggerType)}
          className="rounded border border-neutral-300 px-1 py-0.5 text-xs"
        >
          <option value="time">time</option>
          <option value="event">event</option>
          <option value="manual">manual</option>
        </select>
      </td>
      <td className="py-2 pr-2 align-top">
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={dayOffset}
            onChange={(e) => setDayOffset(e.target.value)}
            disabled={triggerType !== "time"}
            placeholder="D+"
            className="w-14 rounded border border-neutral-300 px-1 py-0.5 text-xs disabled:bg-neutral-100"
          />
          <span className="text-neutral-400">·</span>
          <input
            type="number"
            value={flag}
            onChange={(e) => setFlag(e.target.value)}
            placeholder="F"
            className="w-10 rounded border border-neutral-300 px-1 py-0.5 text-xs"
          />
        </div>
      </td>
      <td className="py-2 pr-2 align-top">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onSave}
            disabled={isPending}
            className="rounded bg-emerald-600 p-1 text-white transition hover:bg-emerald-700 disabled:opacity-50"
            aria-label="Guardar"
          >
            <Save className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-200"
            aria-label="Cancelar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {error && <div className="mt-1 text-[11px] text-red-700">{error}</div>}
      </td>
    </tr>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await deleteMilestoneAction(id);
              setConfirming(false);
            })
          }
          className="rounded bg-red-600 px-1.5 py-0.5 text-[11px] font-medium text-white hover:bg-red-700"
        >
          {isPending ? "…" : "Sí"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded px-1.5 py-0.5 text-[11px] font-medium text-neutral-500 hover:bg-neutral-100"
        >
          No
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="rounded p-1 text-neutral-500 hover:bg-red-50 hover:text-red-700"
      aria-label="Borrar"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

function TriggerBadge({ type }: { type: MilestoneTriggerType }) {
  const styles: Record<MilestoneTriggerType, string> = {
    time: "bg-blue-50 text-blue-700",
    event: "bg-emerald-50 text-emerald-700",
    manual: "bg-amber-50 text-amber-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wider uppercase ${styles[type]}`}
    >
      {type}
    </span>
  );
}
