"use client";

import { withBasePath } from "@/lib/basePath";
import { useEffect, useMemo, useRef, useState } from "react";

interface ContactRecord {
  id: string;
  timestamp: string;
  modifiedDate: string;
  name: string;
  phone: string;
  email: string;
  system: string;
  message: string;
  comment: string;
}

type SearchField = "all" | "name" | "phone" | "email" | "system" | "message";

const searchOptions: { value: SearchField; label: string }[] = [
  { value: "all", label: "All Fields" },
  { value: "name", label: "Name" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "system", label: "System" },
  { value: "message", label: "Message" },
];

const emptyContactRecord: ContactRecord = {
  id: "",
  timestamp: "",
  modifiedDate: "",
  name: "",
  phone: "",
  email: "",
  system: "",
  message: "",
  comment: "",
};

export default function ContactRecords() {
  const [records, setRecords] = useState<ContactRecord[]>([]);
  const [selected, setSelected] = useState<ContactRecord>(emptyContactRecord);
  const [searchField, setSearchField] = useState<SearchField>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!selected || saving) return;
    if (
      !selected ||
      saving ||
      !selected.name?.trim() ||
      !selected.phone?.trim() ||
      !selected.email?.trim() ||
      !selected.system?.trim() ||
      !selected.message?.trim()
    ) {
      return;
    }

    try {
      setSaving(true);

      const response = await fetch(withBasePath("/api/contact-records"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: selected.id,
          record: {
            name: selected.name,
            phone: selected.phone,
            email: selected.email,
            system: selected.system,
            message: selected.message,
            comment: selected.comment,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Update failed.");
      }
      const next = { ...selected, modifiedDate: result.modifiedDate };
      setSelected(next);
      setRecords((previous) =>
        previous.map((item) => (item.id === selected.id ? next : item)),
      );

      alert("Record updated successfully.");
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "Unable to update record.",
      );
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadRecords() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(withBasePath("/api/contact-records"), {
          method: "GET",
          cache: "no-store",
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load records.");
        }

        if (!active) return;

        setRecords(result.records);
        setSelected(emptyContactRecord);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Loading failed.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadRecords();

    return () => {
      active = false;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return records;

    return records.filter((record) => {
      if (searchField === "all") {
        return [
          record.name,
          record.phone,
          record.email,
          record.system,
          record.message,
          record.timestamp,
        ].some((value) => value.toLowerCase().includes(keyword));
      }

      return String(record[searchField] || "")
        .toLowerCase()
        .includes(keyword);
    });
  }, [records, search, searchField]);

  function formatDate(value: string) {
    if (!value) return "Date unavailable";

    const date = new Date(value.replace(" ", "T"));

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("en-HK", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const detailRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLElement | null>(null);

  type Dialog =
    | { type: "delete"; record: ContactRecord }
    | { type: "confirm"; record: ContactRecord }
    | null;
  const [dialog, setDialog] = useState<Dialog>(null);

  const isMobile = () => window.matchMedia("(max-width: 768px)").matches;

  const scrollToPanel = (el: HTMLElement | null) => {
    if (!el) return;
    requestAnimationFrame(() =>
      el.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  // Select a record; on mobile jump to the detail block
  const selectRecord = (record: ContactRecord) => {
    setSelected(record);
    if (isMobile()) scrollToPanel(detailRef.current);
  };

  // Delete popup -> confirmed
  const handleDeleteConfirmed = async () => {
    if (dialog?.type !== "delete") return;
    const { record } = dialog;
    try {
      // TODO: call your delete API / Firestore / Supabase here, e.g.
      // await deleteContact(record.id);
      setRecords((prev) => prev.filter((r) => r.id !== record.id));
      if (selected?.id === record.id) setSelected(emptyContactRecord);
    } catch (err) {
      console.error(err);
    } finally {
      setDialog(null);
    }
  };

  // Confirm popup -> confirmed (runs your existing handleConfirm)
  const handleConfirmPopup = async () => {
    setDialog(null);
    await handleConfirm();
    if (isMobile()) scrollToPanel(listRef.current); // jump back to the list
  };

  const canConfirm = (record: ContactRecord | null) => {
    if (!record) return false;

    return [
      record.name,
      record.phone,
      record.email,
      record.system,
      record.message,
    ].every((field) => field?.trim());
  };

  // CSV export (all records, with headers)
  const exportCsv = () => {
    const headers = [
      "Name",
      "Phone",
      "Email",
      "System",
      "Message",
      "Comment",
      "Date",
      "Modified Date",
    ];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = records.map((r) =>
      [
        r.name,
        r.phone,
        r.email,
        r.system,
        r.message,
        r.comment,
        formatDate(r.timestamp),
        r.modifiedDate ? formatDate(r.modifiedDate) : "",
      ]
        .map(esc)
        .join(","),
    );
    const csv = "\uFEFF" + [headers.map(esc).join(","), ...rows].join("\r\n"); // BOM so Excel reads UTF-8
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contact-records-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ------------------------------------------------------------------ */
  /* 2. New return block                                                 */
  /* ------------------------------------------------------------------ */

  return (
    <main className="contact-admin-page">
      <div className="contact-admin-header">
        <div>
          <h1>Contact Records</h1>
        </div>

        <div className="contact-header-actions">
          <div className="contact-record-count">{records.length} Records</div>
          <button
            type="button"
            className="contact-record-count"
            onClick={exportCsv}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="contact-admin-layout">
        {/* LEFT: Search and record list */}
        <section className="contact-list-panel" ref={listRef}>
          <div className="contact-list-heading">
            <h2>Contact Records</h2>
            <span>{filteredRecords.length} Results</span>
          </div>

          <div className="contact-search">
            <label htmlFor="contact-search-field">Search by</label>

            <select
              id="contact-search-field"
              value={searchField}
              onChange={(e) => setSearchField(e.target.value as SearchField)}
            >
              {searchOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contact records..."
              aria-label="Search contact records"
            />
          </div>

          <div className="contact-record-list">
            {loading ? (
              <div className="contact-list-message">Loading records...</div>
            ) : error ? (
              <div className="contact-list-message contact-error">{error}</div>
            ) : filteredRecords.length === 0 ? (
              <div className="contact-list-message">
                No matching records found.
              </div>
            ) : (
              filteredRecords.map((record) => (
                // Wrapper div: a <button> can't be nested inside another <button>
                <div className="contact-record-row" key={record.id}>
                  <button
                    type="button"
                    className={`contact-record-item ${selected?.id === record.id ? "selected" : ""}`}
                    onClick={() => selectRecord(record)}
                  >
                    <div className="contact-record-top">
                      <strong>{record.name || "Unnamed Contact"}</strong>
                    </div>

                    <div className="contact-record-meta">
                      <span className="contact-record-phone">
                        {record.phone || "No phone number"}
                      </span>
                      {/* <span className="contact-record-date">
                        {formatDate(record.timestamp)}
                      </span> */}
                    </div>
                    <div className="contact-record-meta">
                      <div className="contact-record-bottom">
                        {record.email || "No email provided"}
                      </div>
                      <span className="contact-record-date">
                        {formatDate(record.timestamp)}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className="contact-delete-button"
                    aria-label={`Delete ${record.name || "contact"}`}
                    onClick={() => setDialog({ type: "delete", record })}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      aria-hidden="true"
                    >
                      <path
                        d="M6 6l12 12M18 6L6 18"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* RIGHT: Selected record details */}
        <section className="contact-detail-panel" ref={detailRef}>
          <div className="contact-panel-heading">
            <h2>Contact Details</h2>
          </div>

          {selected ? (
            <div className="contact-detail-content">
              <div className="contact-form-grid">
                <div>
                  <label>Name *</label>
                  <input value={selected.name} readOnly />
                </div>

                <div>
                  <label>Phone *</label>
                  <input value={selected.phone} readOnly />
                </div>

                <div className="contact-full-width">
                  <label>Email</label>
                  <input value={selected.email} readOnly />
                </div>

                <div className="contact-full-width">
                  <label>What system do you want?</label>
                  <input value={selected.system} readOnly />
                </div>

                <div className="contact-full-width">
                  <label>Message</label>
                  <textarea rows={5} value={selected.message} readOnly />
                </div>

                <div className="contact-full-width">
                  <label>Comment</label>
                  <input
                    type="text"
                    value={selected.comment}
                    onChange={(e) =>
                      setSelected({ ...selected, comment: e.target.value })
                    }
                    placeholder="No internal comments yet."
                  />
                </div>
              </div>

              <div className="contact-detail-footer">
                <strong>
                  {selected.modifiedDate || selected.timestamp
                    ? formatDate(selected.modifiedDate || selected.timestamp)
                    : ""}
                </strong>
                <button
                  type="button"
                  className="contact-confirm-button"
                  onClick={() => {
                    if (!canConfirm(selected)) {
                      alert("No data to confirm.");
                      return;
                    }

                    setDialog({ type: "confirm", record: selected });
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          ) : (
            <div className="contact-empty-detail">
              {loading
                ? "Loading contact records..."
                : "Select a contact record from the left panel."}
            </div>
          )}
        </section>
      </div>

      {/* Popup for both Delete and Confirm */}
      {dialog && (
        <div className="contact-modal-backdrop" onClick={() => setDialog(null)}>
          <div
            className="contact-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="contact-modal-title">
              {dialog.type === "delete"
                ? "Delete this record?"
                : "Confirm this record?"}
            </h3>
            <p>
              {dialog.type === "delete"
                ? `${dialog.record.name || "This contact"} will be permanently removed. This can't be undone.`
                : `Save your changes to ${dialog.record.name || "this contact"}?`}
            </p>
            <div className="contact-modal-actions">
              <button
                type="button"
                className="contact-modal-cancel"
                onClick={() => setDialog(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  dialog.type === "delete"
                    ? "contact-modal-danger"
                    : "contact-confirm-button"
                }
                onClick={
                  dialog.type === "delete"
                    ? handleDeleteConfirmed
                    : handleConfirmPopup
                }
              >
                {dialog.type === "delete" ? "Delete" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
