import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://tstuqwqktkjgxnopytmz.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzdHVxd3FrdGtqZ3hub3B5dG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExMzYzNDcsImV4cCI6MjEwNjcxMjM0N30.KFaKzSxXH-3EC4I0TcNxKinAEPC-HW86LNe7XfA5mvk";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
);

export async function GET(req: NextRequest) {
  const store_id = req.nextUrl.searchParams.get("store_id");
  if (!store_id) {
    const { data } = await supabase.from("expenses").select("*").order("created_at", { ascending: false });
    return NextResponse.json(data || []);
  }
  const { data } = await supabase
    .from("expenses")
    .select("*")
    .eq("store_id", store_id)
    .order("created_at", { ascending: false });
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { error } = await supabase.from("expenses").insert(body);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    await supabase.from("expenses").delete().eq("id", id);
  }
  return NextResponse.json({ success: true });
}
