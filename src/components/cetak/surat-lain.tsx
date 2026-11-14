import { Fragment } from "react";
import { KOP_SURAT } from "@/lib/aplikasi";
import { nipBerspasi, tanggalPanjang, terbilang } from "@/lib/dokumen";
import { barisNomor, blokPenandatangan } from "@/lib/tata-naskah";
import { INSTRUKSI_DISPOSISI, PERHATIAN_SPD, PERNYATAAN_SPD, teksNotaDinasCuti, teksSuratIzinCuti } from "@/lib/persuratan";
import type { SetSpdRecord } from "@/lib/server/repositories/spd";
import type { SuratCutiRecord } from "@/lib/server/repositories/cuti";
import type { SuratMasukRecord } from "@/lib/server/repositories/surat-masuk";
import { KopNaskah, TtdNaskah } from "./naskah";

const CSS_SPD = `
.spd { font-size: 10pt; }
.spd table { border-collapse: collapse; width: 100%; }
.spd td { vertical-align: top; padding: 2px 4px; }
.spd .bingkai td { border: 1px solid #000; }
.spd .bingkai .dalam { padding: 3px; }
.spd .bingkai tr { break-inside: avoid; }
.spd .no { width: 1cm; text-align: center; }
.spd .kiri { width: 6.4cm; }
.spd .dua td { width: 50%; }
.spd .kanan-blok { width: 7cm; }
.spd .judul { text-align: center; font-weight: 700; text-decoration: underline; margin: 0.4em 0 0.6em; }
.spd .tengah { text-align: center; }
.spd .tebal { font-weight: 700; }
.spd .rata { text-align: justify; }
.spd .atas { margin-top: 0.3em; }
.spd .catatan { margin-top: 0.2em; }
.spd .terbit { margin: 0.8em 0 0 9cm; }
.spd .terbit .ttd-ppk { margin-top: 0.4em; text-align: left; }
.spd .ruang { height: 1.4cm; }
.spd .ruang.kecil { height: 1cm; }
.spd .halaman-baru { break-before: page; page-break-before: always; }
`;

/**
 * SPD lembar I & II (Lampiran I PMK 113/PMK.05/2012 s.t.d.d. PMK 119/2023) untuk setiap pegawai satu surat tugas; isi sama dengan
 * Word. Ditandatangani PPK di luar aplikasi.
 */
export function SpdCetak({ set }: { set: SetSpdRecord }) {
  const nipPpk = set.ppk.nip ? nipBerspasi(set.ppk.nip) : "……………………";
  const ttdPpk = (
    <div className="tengah ttd-ppk">
      <div>Pejabat Pembuat Komitmen,</div>
      <div className="ruang" />
      <div>{set.ppk.nama || "(……………………………)"}</div>
      {set.ppk.pangkat ? <div>{set.ppk.pangkat}</div> : null}
      <div>NIP {nipPpk}</div>
    </div>
  );
  const kotak = (judul: string, isi: string[]) => (
    <>
      {judul ? <div className="tebal">{judul}</div> : null}
      {isi.map((x, i) => (
        <div key={i}>{x}</div>
      ))}
      <div className="atas">Kepala/Pejabat,</div>
      <div className="ruang kecil" />
      <div>(……………………………)</div>
      <div>NIP</div>
    </>
  );
  return (
    <div className="spd">
      <style>{CSS_SPD}</style>
      {set.spd.map((d, n) => (
        <Fragment key={d.id}>
          <div className={n > 0 ? "halaman-baru" : undefined}>
            <KopNaskah />
            <table>
              <tbody>
                <tr>
                  <td />
                  <td className="kanan-blok">
                    Lembar ke : I<br />
                    Kode No. : …………
                    <br />
                    Nomor : {d.nomor?.trim() || "…………………"}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="judul">SURAT PERJALANAN DINAS (SPD)</div>
            <table className="bingkai">
              <tbody>
                <tr>
                  <td className="no">1.</td>
                  <td className="kiri">Pejabat Pembuat Komitmen</td>
                  <td>{set.ppk.nama || "-"}</td>
                </tr>
                <tr>
                  <td className="no">2.</td>
                  <td className="kiri">Nama/NIP Pegawai yang melaksanakan perjalanan dinas</td>
                  <td>
                    {d.pegawai.nama}
                    <br />
                    NIP {d.pegawai.nip}
                  </td>
                </tr>
                <tr>
                  <td className="no">3.</td>
                  <td className="kiri">
                    a. Pangkat dan Golongan
                    <br />
                    b. Jabatan/Instansi
                    <br />
                    c. Tingkat Biaya Perjalanan Dinas
                  </td>
                  <td>
                    a. {d.pegawai.pangkat}
                    <br />
                    b. {d.pegawai.jabatan} / {set.instansi}
                    <br />
                    c. {d.tingkatBiaya || "…"}
                  </td>
                </tr>
                <tr>
                  <td className="no">4.</td>
                  <td className="kiri">Maksud Perjalanan Dinas</td>
                  <td>{d.maksud}</td>
                </tr>
                <tr>
                  <td className="no">5.</td>
                  <td className="kiri">Alat angkutan yang dipergunakan</td>
                  <td>{d.alatAngkut}</td>
                </tr>
                <tr>
                  <td className="no">6.</td>
                  <td className="kiri">
                    a. Tempat berangkat
                    <br />
                    b. Tempat tujuan
                  </td>
                  <td>
                    a. {d.tempatBerangkat}
                    <br />
                    b. {d.tempatTujuan}
                  </td>
                </tr>
                <tr>
                  <td className="no">7.</td>
                  <td className="kiri">
                    a. Lamanya Perjalanan Dinas
                    <br />
                    b. Tanggal berangkat
                    <br />
                    c. Tanggal harus kembali/tiba di tempat baru *)
                  </td>
                  <td>
                    a. {d.lamaHari} ({terbilang(d.lamaHari)}) hari
                    <br />
                    b. {tanggalPanjang(d.tanggalBerangkat)}
                    <br />
                    c. {tanggalPanjang(d.tanggalKembali)}
                  </td>
                </tr>
                <tr>
                  <td className="no">8.</td>
                  <td colSpan={2} className="dalam">
                    <table className="bingkai">
                      <tbody>
                        <tr>
                          <td className="kiri">Pengikut: Nama</td>
                          <td className="tengah">Tanggal Lahir</td>
                          <td className="tengah">Keterangan</td>
                        </tr>
                        {[1, 2, 3].map((i) => (
                          <tr key={i}>
                            <td>{i}.</td>
                            <td />
                            <td />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td className="no">9.</td>
                  <td className="kiri">
                    Pembebanan Anggaran
                    <br />
                    a. Instansi
                    <br />
                    b. Akun
                  </td>
                  <td>
                    -<br />
                    a. {set.instansi}
                    <br />
                    b. {d.akun || "…"}
                  </td>
                </tr>
                <tr>
                  <td className="no">10.</td>
                  <td className="kiri">Keterangan lain-lain</td>
                  <td>{d.keterangan || "-"}</td>
                </tr>
              </tbody>
            </table>
            <div className="catatan">*) coret yang tidak perlu</div>
            <div className="terbit">
              <div>Dikeluarkan di : {set.tempatTerbit}</div>
              <div>Tanggal : {tanggalPanjang(d.tanggal)}</div>
              {ttdPpk}
            </div>
          </div>
          <div className="halaman-baru">
            <table className="bingkai dua">
              <tbody>
                <tr>
                  <td />
                  <td>
                    <div className="tebal">I.</div>
                    <div>Berangkat dari : {d.tempatBerangkat} (tempat kedudukan)</div>
                    <div>Ke : {d.tempatTujuan}</div>
                    <div>Pada tanggal : {tanggalPanjang(d.tanggalBerangkat)}</div>
                    {ttdPpk}
                  </td>
                </tr>
                <tr>
                  <td>{kotak("II.", [`Tiba di : ${d.tempatTujuan}`, "Pada tanggal :"])}</td>
                  <td>{kotak("", [`Berangkat dari : ${d.tempatTujuan}`, "Ke :", "Pada tanggal :"])}</td>
                </tr>
                {["III.", "IV."].map((no) => (
                  <tr key={no}>
                    <td>{kotak(no, ["Tiba di :", "Pada tanggal :"])}</td>
                    <td>{kotak("", ["Berangkat dari :", "Ke :", "Pada tanggal :"])}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <div className="tebal">V.</div>
                    <div>Tiba kembali di : {d.tempatBerangkat} (tempat kedudukan)</div>
                    <div>Pada tanggal : {tanggalPanjang(d.tanggalKembali)}</div>
                  </td>
                  <td>
                    <div className="rata">{PERNYATAAN_SPD}</div>
                    {ttdPpk}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2}>
                    <div className="tebal">VI. Catatan Lain-lain</div>
                    <div className="ruang kecil" />
                  </td>
                </tr>
                <tr>
                  <td colSpan={2}>
                    <div className="tebal">VII. PERHATIAN</div>
                    <div className="rata">{PERHATIAN_SPD}</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Fragment>
      ))}
    </div>
  );
}

const CSS_CUTI = `
.sc table { border-collapse: collapse; width: 100%; }
.sc td { vertical-align: top; padding: 1px 3px; }
.sc .judul { text-align: center; font-weight: 700; }
.sc .nomor { text-align: center; margin-bottom: 1.2em; }
.sc .l { width: 2.6cm; } .sc .l2 { width: 4cm; } .sc .t { width: 0.5cm; }
.sc .identitas { margin-left: 1cm; width: calc(100% - 1cm) !important; }
.sc hr { border: 0; border-top: 1px solid #000; margin: 0.6em 0 1em; }
.sc .par { text-align: justify; text-indent: 1cm; margin: 0 0 0.5em; }
.sc .j { text-align: justify; }
.sc .ttd { margin: 1.2em 0 0 8.5cm; }
.sc .ruang-tte { height: 2.2cm; }
.sc .halaman-baru { break-before: page; page-break-before: always; }
`;

/** Nota Dinas permohonan cuti (halaman 1) + Surat Izin Cuti (halaman 2, hanya bila izin diberikan balai); sama dengan Word. */
export function CutiCetak({ s }: { s: SuratCutiRecord }) {
  const nd = teksNotaDinasCuti(s.data, s.pemberiIzin, s.kepadaPemberi);
  const izin = teksSuratIzinCuti(s.data);
  const ttdNd = blokPenandatangan(s.ttdNotaDinas);
  const baris: [string, string][] = [
    ["Yth.", s.notaDinas.yth],
    ["Dari", s.notaDinas.dari],
    ["Tembusan", s.notaDinas.tembusan.join("; ") || "-"],
    ["Tanggal", tanggalPanjang(s.tanggal)],
    ["Nomor", s.cuti.nomorNotaDinas || "…………………"],
    ["Sifat", s.notaDinas.sifat],
    ["Lampiran", s.notaDinas.lampiran],
    ["Hal", nd.hal],
  ];
  return (
    <div className="sc">
      <style>{CSS_CUTI}</style>
      <KopNaskah />
      <div className="judul">NOTA DINAS</div>
      <table>
        <tbody>
          {baris.map(([l, v]) => (
            <tr key={l}>
              <td className="l">{l}</td>
              <td className="t">:</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <hr />
      {nd.paragraf.map((t, i) => (
        <p key={i} className="par">
          {t}
        </p>
      ))}
      <div className="ttd">
        {ttdNd.atas.map((b, i) => (
          <div key={`a${i}`}>{b}</div>
        ))}
        <div className="ruang-tte" />
        {ttdNd.bawah.map((b, i) => (
          <div key={`b${i}`}>{b}</div>
        ))}
      </div>
      {s.ttdIzin ? (
        <div className="halaman-baru">
          <KopNaskah />
          <div className="judul">{izin.judul}</div>
          <div className="nomor">{barisNomor(s.cuti.nomorSuratIzin)}</div>
          <p>{izin.pembuka}</p>
          <table className="identitas">
            <tbody>
              {izin.identitas.map(([l, v]) => (
                <tr key={l}>
                  <td className="l2">{l}</td>
                  <td className="t">:</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="j">{izin.isi}</p>
          <p className="j">{izin.penutup}</p>
          <TtdNaskah tempat={s.tempat} tanggal={s.tanggal} ttd={s.ttdIzin} />
        </div>
      ) : null}
    </div>
  );
}

const CSS_DISPOSISI = `
.ld { font-size: 10pt; }
.ld .kop { text-align: center; border-bottom: 3px double #000; padding-bottom: 4px; margin-bottom: 8px; }
.ld .b1 { font-weight: 700; font-size: 11pt; } .ld .b2 { font-weight: 700; font-size: 10pt; }
.ld .judul { text-align: center; font-weight: 700; margin: 6px 0; }
.ld .bingkai { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-bottom: 6px; }
.ld .bingkai td { border: 1px solid #000; padding: 3px 5px; vertical-align: top; }
.ld .setengah { width: 50%; } .ld .tebal { font-weight: 700; } .ld .kecil { font-size: 8.5pt; }
.ld .ttd { text-align: right; margin-top: 10px; } .ld .isi { break-inside: avoid; }
`;

/** Lembar Disposisi (Permendagri 18/2024 Lampiran E.3.h), kertas A5: identitas surat, diteruskan kepada, instruksi, catatan, pemberi. */
export function DisposisiCetak({ s }: { s: SuratMasukRecord }) {
  return (
    <div className="ld">
      <style>{CSS_DISPOSISI}</style>
      <div className="kop">
        {KOP_SURAT.baris.map((b, i) => (
          <div key={b} className={i < 2 ? "b1" : "b2"}>
            {b}
          </div>
        ))}
      </div>
      <div className="judul">L E M B A R &nbsp; D I S P O S I S I</div>
      <table className="bingkai">
        <tbody>
          <tr>
            <td>Surat dari</td>
            <td>: {s.asal}</td>
            <td>Diterima Tgl.</td>
            <td>: {tanggalPanjang(s.tanggalTerima)}</td>
          </tr>
          <tr>
            <td>No. Surat</td>
            <td>: {s.nomorSurat}</td>
            <td>No. Agenda</td>
            <td>
              : {s.nomorAgenda}/{s.tahun}
            </td>
          </tr>
          <tr>
            <td>Tgl. Surat</td>
            <td>: {s.tanggalSurat ? tanggalPanjang(s.tanggalSurat) : "-"}</td>
            <td>Sifat</td>
            <td>: {s.sifat}</td>
          </tr>
          <tr>
            <td>Hal</td>
            <td colSpan={3}>: {s.hal}</td>
          </tr>
        </tbody>
      </table>
      {s.disposisi.length ? (
        s.disposisi.map((d) => (
          <table key={d.id} className="bingkai isi">
            <tbody>
              <tr>
                <td className="setengah">
                  <div className="tebal">Diteruskan kepada Sdr.:</div>
                  <div>
                    {d.kepadaNama}
                    {d.kepadaJabatan ? ` (${d.kepadaJabatan})` : ""}
                  </div>
                  {d.batasWaktu ? <div className="kecil">Batas waktu: {tanggalPanjang(d.batasWaktu)}</div> : null}
                </td>
                <td className="setengah">
                  <div className="tebal">Dengan hormat harap:</div>
                  {INSTRUKSI_DISPOSISI.map((ins) => (
                    <div key={ins}>
                      {d.instruksi.includes(ins) ? "☑" : "☐"} {ins}
                    </div>
                  ))}
                </td>
              </tr>
              <tr>
                <td colSpan={2}>
                  <div className="tebal">Catatan:</div>
                  <div>{d.catatan || "-"}</div>
                  <div className="ttd">
                    {d.dariJabatan},<br />
                    <span className="kecil">{tanggalPanjang(d.createdAt.slice(0, 10))}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        ))
      ) : (
        <p className="kecil">Belum ada disposisi.</p>
      )}
    </div>
  );
}
