"use client";

import { useState } from "react";
import { CountryInput } from "@/models";

interface CountryFormProps {
  onSubmit: (input: CountryInput) => Promise<void>;
}

const initialState: CountryInput = {
  name: "",
  isoCode: "",
  regionIdentifier: "",
  sourceUrl: ""
};

export function CountryForm({ onSubmit }: CountryFormProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CountryInput>(initialState);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        isoCode: form.isoCode.toUpperCase(),
        sourceUrl: form.sourceUrl?.trim() || undefined
      });
      setForm(initialState);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="primary-btn"
        onClick={() => setOpen(true)}
      >
        Add Country
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="card w-full max-w-lg p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">Add Country / Region</h2>
            <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
              <input
                required
                placeholder="Country name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="soft-input"
              />
              <input
                required
                maxLength={2}
                placeholder="ISO code (e.g. US)"
                value={form.isoCode}
                onChange={(e) => setForm((prev) => ({ ...prev, isoCode: e.target.value }))}
                className="soft-input uppercase"
              />
              <input
                required
                placeholder="Region identifier (e.g. en-us)"
                value={form.regionIdentifier}
                onChange={(e) => setForm((prev) => ({ ...prev, regionIdentifier: e.target.value }))}
                className="soft-input"
              />
              <input
                placeholder="Optional source URL"
                value={form.sourceUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, sourceUrl: e.target.value }))}
                className="soft-input"
              />

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  className="soft-btn"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="primary-btn disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
