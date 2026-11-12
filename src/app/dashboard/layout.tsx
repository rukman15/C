import { menuAkun } from "@/lib/navigasi";
import { roleProfiles } from "@/lib/roles";
import { rapikanJabatanSurat } from "@/lib/jabatan";
import { wajibPengguna } from "@/lib/server/halaman";
import { Kerangka } from "@/components/dasbor/kerangka";

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

  return (
    <Kerangka
      menu={p.wajibGantiSandi ? null : menu}
      pengguna={{ nama: p.name, email: p.email, keterangan }}
    >
      {children}
    </Kerangka>
  );
}
