"use client";

import React, { useState, useEffect, useMemo } from "react";
import { safeUUID } from "@/lib/uuid";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://tstuqwqktkjgxnopytmz.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdHVxd3FrdGtqZ3hub3B5dG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMzYzNDcsImV4cCI6MjEwNjcxMjM0N30.KFaKzSxXH-3EC4I0TcNxKinAEPC-HW86LNe7XfA5mvk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
);

const CATEGORIES = [
  "Rent",
  "Salary",
  "Utility",
  "Fuel",
  "Maintenance",
  "Tea / Food",
  "Supplies",
  "Marketing",
  "Other",
];

const PAYMENT_METHODS = ["Cash", "Bank", "JazzCash", "EasyPaisa", "Card", "Other"];

export default function ExpensesDashboardPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "Other",
    amount: "",
    payment_method: "Cash",
    description: "",
  });

  const getStoreId = () => {
    if (typeof window === "undefined") return "default_store";
    return (
      localStorage.getItem("store_id") ||
      localStorage.getItem("genx:store_id") ||
      "default_store"
    );
  };

  const loadExpenses = async () => {
    setLoading(true);
    const store_id = getStoreId();
    try {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("store_id", store_id)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setExpenses(data);
      } else {
        // Fallback to fetch API
        const res = await fetch(`/api/expenses?store_id=${encodeURIComponent(store_id)}`);
        const json = await res.json();
        if (Array.isArray(json)) setExpenses(json);
      }
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const addExpense = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }
    const store_id = getStoreId();
    const newRecord = {
      id: safeUUID(),
      store_id,
      date: form.date,
      category: form.category,
      amount: Number(form.amount),
      payment_method: form.payment_method,
      description: form.description,
      added_by: "Staff",
    };

    try {
      const { error } = await supabase.from("expenses").insert(newRecord);
      if (error) {
        await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newRecord),
        });
      }
    } catch {
      await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRecord),
      });
    }

    setForm({
      date: new Date().toISOString().split("T")[0],
      category: "Other",
      amount: "",
      payment_method: "Cash",
      description: "",
    });
    loadExpenses();
  };

  const deleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      await supabase.from("expenses").delete().eq("id", id);
    } catch {
      await fetch(`/api/expenses?id=${id}`, { method: "DELETE" });
    }
    loadExpenses();
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const currentMonth = todayStr.substring(0, 7);

  const todayTotal = expenses
    .filter((e) => e.date === todayStr)
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const monthTotal = expenses
    .filter((e) => (e.date || "").startsWith(currentMonth))
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const allTotal = expenses.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  return (
    <div className="p-6 space-y-6 bg-[#0f172a] min-h-screen text-white font-sans">
      <div className="flex items-center justify-between border-b border-slate-700 pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            💸 Global Expenses
            <span className="text-xs bg-slate-800 text-teal-400 px-2 py-0.5 rounded border border-slate-700">
              CORE FEATURE
            </span>
          </h1>
          <p className="text-xs text-slate-400">Store-isolated daily business expense tracker</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow">
          <div className="text-xs text-slate-400">Today's Expense</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">Rs. {todayTotal}</div>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow">
          <div className="text-xs text-slate-400">Month Total</div>
          <div className="text-2xl font-bold text-red-400 mt-1">Rs. {monthTotal}</div>
        </div>
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow">
          <div className="text-xs text-slate-400">Total Expenses</div>
          <div className="text-2xl font-bold text-teal-400 mt-1">Rs. {allTotal}</div>
        </div>
      </div>

      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow flex flex-wrap gap-2.5 items-center">
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="bg-slate-700 text-white p-2 text-sm rounded border border-slate-600 focus:outline-none"
        />
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="bg-slate-700 text-white p-2 text-sm rounded border border-slate-600 focus:outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          placeholder="Amount"
          type="number"
          min="1"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="bg-slate-700 text-white p-2 text-sm rounded border border-slate-600 w-32 focus:outline-none font-bold"
        />
        <select
          value={form.payment_method}
          onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
          className="bg-slate-700 text-white p-2 text-sm rounded border border-slate-600 focus:outline-none"
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="bg-slate-700 text-white p-2 text-sm rounded border border-slate-600 flex-1 min-w-[200px] focus:outline-none"
        />
        <button
          onClick={addExpense}
          className="bg-teal-500 hover:bg-teal-600 text-slate-900 px-6 py-2 rounded font-bold transition shadow"
        >
          Add Expense
        </button>
      </div>

      <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-700 text-xs uppercase text-slate-300">
            <tr>
              <th className="p-3">Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Method</th>
              <th className="text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-slate-400">
                  Loading expenses...
                </td>
              </tr>
            ) : expenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400">
                  No expenses recorded yet.
                </td>
              </tr>
            ) : (
              expenses.map((ex) => (
                <tr key={ex.id} className="border-t border-slate-700 hover:bg-slate-750">
                  <td className="p-3 font-mono text-xs">{ex.date}</td>
                  <td>
                    <span className="bg-slate-700 px-2 py-0.5 rounded text-xs">{ex.category}</span>
                  </td>
                  <td>{ex.description || "—"}</td>
                  <td className="font-bold text-white">Rs. {Number(ex.amount).toLocaleString()}</td>
                  <td>{ex.payment_method}</td>
                  <td className="text-center">
                    <button
                      onClick={() => deleteExpense(ex.id)}
                      className="text-red-400 hover:text-red-300 font-semibold"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
