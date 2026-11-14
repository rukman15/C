import { menuAkun } from "@/lib/navigasi";
import { roleProfiles } from "@/lib/roles";
import { rapikanJabatanSurat } from "@/lib/jabatan";
import { wajibPengguna } from "@/lib/server/halaman";
import { Kerangka } from "@/components/dasbor/kerangka";
import { PeranSementara } from "@/components/dasbor/peran-sementara";
import { penugasanBerlaku } from "@/lib/server/repositories/plt";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Halaman akun boleh dibuka dengan sandi sementara; halaman lain memeriksa sendiri.
  const p = await wajibPengguna({ bolehSandiSementara: true });
  const menu = menuAkun({
    role: p.role,
    pegawaiId: p.pegawaiId,
    koordinatorWi: p.koordinatorWi,
    anggotaTimDiklat: p.timDiklat.length > 0,
  });
  const labelPeran = roleProfiles.find((r) => r.id === p.role)?.label ?? p.role;
  const keterangan = p.sebagai ?? (p.jabatan ? rapikanJabatanSurat(p.jabatan) : labelPeran);

  // Pita Plt/Plh: penugasan sementara yang berlaku untuk pegawai ini (tidak saat wajib ganti sandi).
  const pilihanPlt = !p.wajibGantiSandi && p.pegawaiId && !p.sebagai ? await penugasanBerlaku(p.pegawaiId) : [];

  return (
    <Kerangka menu={p.wajibGantiSandi ? null : menu} pengguna={{ nama: p.name, email: p.email, keterangan }}>
      {!p.wajibGantiSandi ? <PeranSementara sebagai={p.sebagai ?? null} pilihan={pilihanPlt} /> : null}
      {children}
    </Kerangka>
  );
}
