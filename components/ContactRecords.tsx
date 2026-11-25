"use client";

import { withBasePath } from "@/lib/basePath";
import { useEffect, useMemo, useState } from "react";

interface ContactRecord {
  id: string;
  timestamp: string;
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

export default function ContactRecords() {
  const [records, setRecords] = useState<ContactRecord[]>([]);
  const [selected, setSelected] = useState<ContactRecord | null>(null);
  const [searchField, setSearchField] = useState<SearchField>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!selected || saving) return;

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

      setRecords((previous) =>
        previous.map((item) =>
          item.id === selected.id ? { ...selected } : item,
        ),
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

        if (result.records.length > 0) {
          setSelected(result.records[0]);
        } else {
          setSelected(null);
        }
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

  return (
    <main className="contact-admin-page">
      <div className="contact-admin-header">
        <div>
          <h1>Contact Records</h1>
        </div>

        <div className="contact-record-count">{records.length} Records</div>
      </div>

      <div className="contact-admin-layout">
        {/* LEFT: Selected record details */}
        <section className="contact-detail-panel">
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
                <strong>{formatDate(selected.timestamp)}</strong>
                <button
                  type="button"
                  className="contact-confirm-button"
                  onClick={handleConfirm}
                >
                  Confirm
                </button>
              </div>
            </div>
          ) : (
            <div className="contact-empty-detail">
              {loading
                ? "Loading contact records..."
                : "Select a contact record from the right panel."}
            </div>
          )}
        </section>

        {/* RIGHT: Search and record list */}
        <section className="contact-list-panel">
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
                <button
                  type="button"
                  key={record.id}
                  className={`contact-record-item ${
                    selected?.id === record.id ? "selected" : ""
                  }`}
                  onClick={() => setSelected(record)}
                >
                  <div className="contact-record-top">
                    <strong>{record.name || "Unnamed Contact"}</strong>
                    <span>{formatDate(record.timestamp)}</span>
                  </div>

                  <div className="contact-record-phone">
                    {record.phone || "No phone number"}
                  </div>

                  <div className="contact-record-bottom">
                    {/* <span>{record.system || "No system specified"}</span> */}
                    {record.email && <span>{record.email}</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
