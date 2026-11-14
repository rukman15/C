import { redirect } from "next/navigation";

/** Buku Agenda tidak dipakai lagi (28 Okt 2026): nomor surat diketik pembuat surat. Tautan lama dialihkan ke Persuratan. */
export default function Agenda() {
  redirect("/dashboard/persuratan");
}
