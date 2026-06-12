"use client";

import { useCallback, useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Approval {
  id: string;
  approver: string;
  decision: string;
  notes: string | null;
  decided_at: string;
}

interface Capa {
  id: string;
  finding_id: string;
  root_cause: string;
  containment_action: string;
  corrective_action: string;
  regulatory_context: string | null;
  precedent_summary: string | null;
  status: string;
  drafted_at: string;
  approvals: Approval[];
}

interface Finding {
  id: string;
  title: string;
  description: string;
  regulatory_refs: string[];
  severity: string;
  created_at: string;
  capas: Capa[];
}

interface BatchRecord {
  id: string;
  batch_number: string;
  line: string;
  parameter: string;
  measured_value: number;
  spec_min: number;
  spec_max: number;
  recorded_at: string;
  status: string;
  findings: Finding[];
}

// ── Small UI helpers ──────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-slate-700 text-slate-300",
  flagged: "bg-red-900/60 text-red-300",
  reviewed: "bg-green-900/60 text-green-300",
  draft: "bg-yellow-900/60 text-yellow-300",
  pending_approval: "bg-orange-900/60 text-orange-300",
  approved: "bg-green-900/60 text-green-300",
  rejected: "bg-red-900/60 text-red-300",
};

const SEVERITY_COLOR: Record<string, string> = {
  low: "bg-blue-900/60 text-blue-300",
  medium: "bg-yellow-900/60 text-yellow-300",
  high: "bg-orange-900/60 text-orange-300",
  critical: "bg-red-900/60 text-red-300",
};

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {label.replace("_", " ")}
    </span>
  );
}

function Step({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={`text-xs ${done ? "text-emerald-400 font-medium" : "text-slate-500"}`}>
      {label}
    </span>
  );
}

// ── Expandable section ────────────────────────────────────────────────────────

function ExpandableSection({
  label,
  content,
  accent,
}: {
  label: string;
  content: string;
  accent: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-slate-800 pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 text-xs font-medium ${accent} hover:opacity-80`}
      >
        <span>{open ? "▼" : "▶"}</span>
        {label}
      </button>
      {open && (
        <p className="mt-2 text-xs text-slate-400 bg-slate-800/50 rounded-lg p-3 leading-relaxed">
          {content}
        </p>
      )}
    </div>
  );
}

// ── BatchCard ─────────────────────────────────────────────────────────────────

function BatchCard({
  batch,
  onDraftCapa,
  draftingId,
  onOpenApproval,
}: {
  batch: BatchRecord;
  onDraftCapa: (id: string) => void;
  draftingId: string | null;
  onOpenApproval: (capaId: string, batchNumber: string) => void;
}) {
  const finding = batch.findings[0] ?? null;
  const capa = finding?.capas[0] ?? null;
  const approval = capa?.approvals[0] ?? null;

  const isOver = batch.measured_value > batch.spec_max;
  const deviationPct = isOver
    ? (((batch.measured_value - batch.spec_max) / batch.spec_max) * 100).toFixed(1)
    : null;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      {/* Pipeline breadcrumb */}
      <div className="px-5 py-2.5 border-b border-slate-800 bg-slate-900/80 flex items-center gap-2">
        <Step done label="① Batch" />
        <span className="text-slate-700 text-xs">→</span>
        <Step done={!!finding} label="② Finding" />
        <span className="text-slate-700 text-xs">→</span>
        <Step done={!!capa} label="③ CAPA Draft" />
        <span className="text-slate-700 text-xs">→</span>
        <Step done={!!approval} label="④ Approval" />
        <span className="ml-auto">
          <Badge label={batch.status} colorClass={STATUS_COLOR[batch.status] ?? "bg-slate-700 text-slate-300"} />
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Batch header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono font-bold text-white">{batch.batch_number}</p>
            <p className="text-sm text-slate-400 mt-0.5">
              {batch.line} · {batch.parameter}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono font-bold text-red-400 text-lg">
              {batch.measured_value.toFixed(2)} mm
            </p>
            <p className="text-xs text-slate-500">
              spec {batch.spec_min.toFixed(2)}–{batch.spec_max.toFixed(2)} mm
            </p>
            {deviationPct && (
              <p className="text-xs text-red-400 font-medium">+{deviationPct}% over limit</p>
            )}
          </div>
        </div>

        {/* Finding card */}
        {finding && (
          <div className="border border-slate-800 rounded-xl p-4 space-y-2 bg-slate-950/40">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Finding</span>
              <Badge
                label={finding.severity}
                colorClass={SEVERITY_COLOR[finding.severity] ?? "bg-slate-700 text-slate-300"}
              />
            </div>
            <p className="text-sm font-semibold text-white">{finding.title}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{finding.description}</p>
            <div className="flex flex-wrap gap-1 pt-1">
              {finding.regulatory_refs.map((ref) => (
                <span key={ref} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-xs">
                  {ref}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* CAPA card */}
        {capa ? (
          <div className="border border-slate-800 rounded-xl p-4 space-y-3 bg-slate-950/40">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">CAPA Draft</span>
              <Badge label={capa.status} colorClass={STATUS_COLOR[capa.status] ?? "bg-slate-700 text-slate-300"} />
            </div>

            <div className="space-y-3">
              {[
                { label: "Root Cause", value: capa.root_cause },
                { label: "Containment Action", value: capa.containment_action },
                { label: "Corrective Action", value: capa.corrective_action },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-slate-500 mb-1">{label}</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{value}</p>
                </div>
              ))}
            </div>

            {capa.regulatory_context && (
              <ExpandableSection
                label="Regulatory Context (Tavily)"
                content={capa.regulatory_context}
                accent="text-blue-400"
              />
            )}
            {capa.precedent_summary && (
              <ExpandableSection
                label="Prior Precedents (mem0)"
                content={capa.precedent_summary}
                accent="text-purple-400"
              />
            )}

            {/* Approval row */}
            {approval ? (
              <div
                className={`border-t border-slate-800 pt-3 flex items-center gap-2 text-sm font-medium ${
                  approval.decision === "approved" ? "text-emerald-400" : "text-red-400"
                }`}
              >
                <span>{approval.decision === "approved" ? "✓" : "✗"}</span>
                <span>
                  {approval.decision === "approved" ? "Approved" : "Rejected"} by {approval.approver}
                </span>
                {approval.notes && (
                  <span className="text-slate-500 text-xs font-normal">— {approval.notes}</span>
                )}
              </div>
            ) : capa.status === "pending_approval" ? (
              <div className="border-t border-slate-800 pt-3">
                <button
                  onClick={() => onOpenApproval(capa.id, batch.batch_number)}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm font-medium transition-colors"
                >
                  Review & Approve CAPA →
                </button>
              </div>
            ) : null}
          </div>
        ) : finding ? (
          /* Draft CAPA button */
          <button
            onClick={() => onDraftCapa(finding.id)}
            disabled={draftingId === finding.id}
            className="w-full py-2.5 border border-blue-600 text-blue-400 hover:bg-blue-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-colors"
          >
            {draftingId === finding.id
              ? "⏳ Drafting CAPA (mem0 + Tavily + OpenAI)…"
              : "+ Draft CAPA"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── Approval modal ────────────────────────────────────────────────────────────

function ApprovalModal({
  capaId,
  batchNumber,
  onClose,
  onSubmit,
}: {
  capaId: string;
  batchNumber: string;
  onClose: () => void;
  onSubmit: (capaId: string, data: { approver: string; decision: string; notes: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({ approver: "", decision: "approved", notes: "" });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!form.approver.trim()) return;
    setBusy(true);
    try {
      await onSubmit(capaId, form);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-1">Review CAPA</h3>
        <p className="text-sm text-slate-400 mb-6">Batch {batchNumber}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">QA Approver Name</label>
            <input
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="e.g. Dr. Sarah Chen"
              value={form.approver}
              onChange={(e) => setForm((f) => ({ ...f, approver: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Decision</label>
            <div className="flex gap-3">
              {(["approved", "rejected"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setForm((f) => ({ ...f, decision: d }))}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    form.decision === d
                      ? d === "approved"
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "bg-red-600 border-red-600 text-white"
                      : "border-slate-700 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {d === "approved" ? "✓ Approve" : "✗ Reject"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Notes (optional)</label>
            <textarea
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors h-20 resize-none"
              placeholder="Review notes…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-700 rounded-lg text-sm text-slate-400 hover:border-slate-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !form.approver.trim()}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
              form.decision === "approved"
                ? "bg-emerald-600 hover:bg-emerald-500"
                : "bg-red-600 hover:bg-red-500"
            }`}
          >
            {busy
              ? "Submitting…"
              : form.decision === "approved"
              ? "Submit Approval"
              : "Submit Rejection"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [records, setRecords] = useState<BatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ capaId: string; batchNumber: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      setRecords(json.batch_records ?? []);
    } catch {
      /* silent — refresh will retry */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 6000);
    return () => clearInterval(id);
  }, [fetchData]);

  const runDetection = async () => {
    setDetecting(true);
    try {
      const res = await fetch("/api/detect", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? "Detection failed");
      showToast(json.message ?? "Detection complete", true);
      await fetchData();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", false);
    } finally {
      setDetecting(false);
    }
  };

  const draftCapa = async (findingId: string) => {
    setDraftingId(findingId);
    try {
      const res = await fetch(`/api/draft-capa/${findingId}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? "Draft failed");
      showToast("CAPA drafted and sent to QA Slack channel ✓", true);
      await fetchData();
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Error", false);
    } finally {
      setDraftingId(null);
    }
  };

  const submitApproval = async (
    capaId: string,
    data: { approver: string; decision: string; notes: string }
  ) => {
    const res = await fetch(`/api/approve/${capaId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail ?? "Approval failed");
    showToast(`CAPA ${data.decision} ✓`, true);
    setModal(null);
    await fetchData();
  };

  const active = records.filter((b) => b.status !== "pending");
  const totalCapas = records.flatMap((b) => b.findings.flatMap((f) => f.capas));
  const pendingApproval = totalCapas.filter((c) => c.status === "pending_approval").length;
  const reviewed = records.filter((b) => b.status === "reviewed").length;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-slate-950/95 backdrop-blur z-10">
        <div>
          <h1 className="text-lg font-bold tracking-tight">AuditAI</h1>
          <p className="text-xs text-slate-500">Veridian MedTech · Surgical Stapler Cartridge Line</p>
        </div>
        <button
          onClick={runDetection}
          disabled={detecting}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
        >
          {detecting ? "⏳ Detecting…" : "▶ Run Detection"}
        </button>
      </header>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-16 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-sm font-medium transition-all ${
            toast.ok ? "bg-emerald-700" : "bg-red-700"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {loading ? (
          <p className="text-slate-500 text-center py-16">Loading dashboard…</p>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Total Batches", value: records.length, color: "text-white" },
                {
                  label: "Flagged",
                  value: records.filter((b) => b.status === "flagged").length,
                  color: "text-red-400",
                },
                { label: "Pending Approval", value: pendingApproval, color: "text-orange-400" },
                { label: "Reviewed", value: reviewed, color: "text-emerald-400" },
              ].map((s) => (
                <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                  <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Active investigations */}
            {active.length > 0 && (
              <section className="space-y-4">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Active Investigations
                </h2>
                {active.map((batch) => (
                  <BatchCard
                    key={batch.id}
                    batch={batch}
                    onDraftCapa={draftCapa}
                    draftingId={draftingId}
                    onOpenApproval={(capaId, batchNumber) => setModal({ capaId, batchNumber })}
                  />
                ))}
              </section>
            )}

            {/* Batch record table */}
            <section>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Batch Records
              </h2>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="text-left px-4 py-3">Batch</th>
                      <th className="text-left px-4 py-3">Line</th>
                      <th className="text-left px-4 py-3">Parameter</th>
                      <th className="text-right px-4 py-3">Measured</th>
                      <th className="text-right px-4 py-3">Spec</th>
                      <th className="text-left px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((b) => {
                      const out = b.measured_value > b.spec_max || b.measured_value < b.spec_min;
                      return (
                        <tr
                          key={b.id}
                          className={`border-b border-slate-800/60 last:border-0 ${out ? "bg-red-950/20" : ""}`}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-slate-300">{b.batch_number}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{b.line}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{b.parameter}</td>
                          <td
                            className={`px-4 py-3 text-right font-mono text-sm ${
                              out ? "text-red-400 font-bold" : "text-slate-300"
                            }`}
                          >
                            {b.measured_value.toFixed(2)} mm
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 font-mono text-xs">
                            {b.spec_min.toFixed(2)}–{b.spec_max.toFixed(2)} mm
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              label={b.status}
                              colorClass={STATUS_COLOR[b.status] ?? "bg-slate-700 text-slate-300"}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Approval modal */}
      {modal && (
        <ApprovalModal
          capaId={modal.capaId}
          batchNumber={modal.batchNumber}
          onClose={() => setModal(null)}
          onSubmit={submitApproval}
        />
      )}
    </div>
  );
}
