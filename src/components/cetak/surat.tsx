import { Fragment } from "react";
import { tanggalPanjang } from "@/lib/dokumen";
import {
  KATA_PERINTAH,
  KOLOM_LAMPIRAN,
  LABEL_PENERIMA,
  TEKS_DAFTAR_TERLAMPIR,
  barisNomor,
  blokPenandatangan,
  kepalaLampiran,
  pakaiLampiran,
  type Penandatangan,
} from "@/lib/tata-naskah";
import { jabatanSatuBaris, jenisNaskah, pembukaBeritaAcara, romawi, type PihakNaskah } from "@/lib/persuratan";
import type { PenerimaSurat } from "@/lib/server/repositories/dokumen";
import type { NaskahRecord } from "@/lib/server/repositories/persuratan";
import { KopNaskah, TtdNaskah } from "./naskah";

/** Gaya bersama naskah cetak (kelas berawalan `sn-` supaya tidak bertabrakan). Sama dengan aplikasi lama. */
const CSS = `
.sn table { border-collapse: collapse; width: 100%; }
.sn td, .sn th { vertical-align: top; padding: 1px 3px; }
.sn .judul { text-align: center; font-weight: 700; }
.sn .jarak { margin-bottom: 1.2em; }
.sn .nomor { text-align: center; margin-bottom: 0.9em; }
.sn .kanan { text-align: right; margin-bottom: 0.6em; }
.sn .isi .lbl { width: 2.4cm; } .sn .isi .tt { width: 0.5cm; } .sn .isi .no { width: 0.6cm; } .sn .isi .lbl2 { width: 2.8cm; }
.sn .isi .j { text-align: justify; padding-bottom: 1px; }
.sn .butir { padding-left: 0.6cm; text-indent: -0.6cm; }
.sn .butir .n { display: inline-block; width: 0.6cm; text-indent: 0; }
.sn .isi .awal td { padding-top: 3px; }
.sn .perintah { text-align: center; font-weight: 700; margin: 0.6em 0; }
.sn .untuk { margin-top: 0.6em; }
.sn .label .l { width: 2.6cm; } .sn .label .t { width: 0.5cm; } .sn .label .no { width: 0.8cm; }
.sn .acara { margin: 0.4em 0 0.6em 1cm; width: calc(100% - 1cm) !important; }
.sn .yth { margin: 1em 0; } .sn .yth .lanjut { padding-left: 0.9cm; }
.sn hr { border: 0; border-top: 1px solid #000; margin: 0.6em 0 1em; }
.sn .par { text-align: justify; text-indent: 1cm; margin: 0 0 0.5em; }
.sn .pj { text-align: justify; }
.sn .menjorok { margin-left: 0.8cm; }
.sn .bagian { font-weight: 700; margin: 1em 0 0.4em; break-after: avoid; }
.sn .ttd { margin: 1.2em 0 0 8.5cm; break-inside: avoid; }
.sn .ruang-tte { height: 2.2cm; }
.sn .tembusan { margin-top: 1.5em; }
.sn .pihak-ttd { display: grid; grid-template-columns: 1fr 1fr; gap: 1em; margin-top: 1.2em; text-align: center; break-inside: avoid; }
.sn .mengetahui { text-align: center; margin-top: 1.2em; break-inside: avoid; }
.sn .lampiran { break-before: page; page-break-before: always; }
.sn .kepala-lampiran { margin: 0 0 1em 9cm; }
.sn .judul-daftar { text-align: center; font-weight: 700; margin-bottom: 0.4em; }
.sn .daftar { margin-top: 0.4em; }
.sn .daftar th, .sn .daftar td { border: 1px solid #000; padding: 2px 4px; }
.sn .daftar thead { display: table-header-group; }
.sn .daftar tr { break-inside: avoid; }
.sn .daftar .c { text-align: center; width: 1cm; }
.sn .daftar .nip { white-space: nowrap; }
`;

export type IsiSuratTugas = { nomor: string | null; tanggal: string; tempat: string; dasar: string[]; untuk: string[]; penerima: PenerimaSurat[]; ttd: Penandatangan };

/**
 * Surat tugas untuk dicetak/disimpan PDF: susunan Permendagri 18/2024 Lampiran B.2 (versi UPT), sama dengan konsep Word. Dipakai surat
 * tugas mengajar dan surat tugas umum. Lebih dari PENERIMA_MAKS_BADAN penerima: "Daftar nama terlampir" + lampiran tabel (Ps. 28).
 */
export function SuratTugasCetak({ s }: { s: IsiSuratTugas }) {
  const lampiran = pakaiLampiran(s.penerima.length);
  const dasar = s.dasar.length ? s.dasar : ["-"];
  return (
    <div className="sn">
      <style>{CSS}</style>
      <KopNaskah />
      <div className="judul">SURAT TUGAS</div>
      <div className="nomor">{barisNomor(s.nomor)}</div>
      <table className="isi">
        <tbody>
          {dasar.map((d, i) => (
            <tr key={i}>
              <td className="lbl">{i === 0 ? "Dasar" : ""}</td>
              <td className="tt">{i === 0 ? ":" : ""}</td>
              <td className="j">
                {s.dasar.length > 1 ? (
                  <div className="butir">
                    <span className="n">{i + 1}.</span>
                    {d}
                  </div>
                ) : (
                  d
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="perintah">{KATA_PERINTAH}</div>
      <table className="isi">
        <tbody>
          {lampiran || !s.penerima.length ? (
            <tr>
              <td className="lbl">Kepada</td>
              <td className="tt">:</td>
              <td colSpan={4}>{lampiran ? TEKS_DAFTAR_TERLAMPIR : "-"}</td>
            </tr>
          ) : null}
          {(lampiran ? [] : s.penerima).map((r, i) => (
            <Fragment key={r.pegawaiId}>
              {[r.nama, r.pangkat, r.nip, r.jabatan].map((v, j) => (
                <tr key={j} className={j === 0 && i > 0 ? "awal" : undefined}>
                  <td className="lbl">{i === 0 && j === 0 ? "Kepada" : ""}</td>
                  <td className="tt">{i === 0 && j === 0 ? ":" : ""}</td>
                  <td className="no">{j === 0 ? `${i + 1}.` : ""}</td>
                  <td className="lbl2">{LABEL_PENERIMA[j]}</td>
                  <td className="tt">:</td>
                  <td>{v}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
      <table className="isi untuk">
        <tbody>
          {s.untuk.map((u, i) => (
            <tr key={i}>
              <td className="lbl">{i === 0 ? "Untuk" : ""}</td>
              <td className="tt">{i === 0 ? ":" : ""}</td>
              <td className="j">
                <div className="butir">
                  <span className="n">{i + 1}.</span>
                  {u}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <TtdNaskah tempat={s.tempat} tanggal={s.tanggal} ttd={s.ttd} />
      {lampiran ? (
        <div className="lampiran">
          <div className="kepala-lampiran">
            {kepalaLampiran(s.nomor, s.tanggal).map((b) => (
              <div key={b}>{b}</div>
            ))}
          </div>
          <div className="judul-daftar">DAFTAR NAMA</div>
          <table className="daftar">
            <thead>
              <tr>
                {KOLOM_LAMPIRAN.map((k) => (
                  <th key={k}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {s.penerima.map((r, i) => (
                <tr key={r.pegawaiId}>
                  <td className="c">{i + 1}.</td>
                  <td>{r.nama}</td>
                  <td>{r.pangkat}</td>
                  <td className="nip">{r.nip}</td>
                  <td>{r.jabatan}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <TtdNaskah tempat={s.tempat} tanggal={s.tanggal} ttd={s.ttd} />
        </div>
      ) : null}
    </div>
  );
}

function BlokTtd({ blok }: { blok: { atas: string[]; bawah: string[] } }) {
  return (
    <>
      {blok.atas.map((b, i) => (
        <div key={`a${i}`}>{b}</div>
      ))}
      <div className="ruang-tte" />
      {blok.bawah.map((b, i) => (
        <div key={`b${i}`}>{b}</div>
      ))}
    </>
  );
}

const blokPihak = (ph: PihakNaskah) => blokPenandatangan({ jabatan: [ph.sebutan ? `${ph.sebutan},` : "", ph.jabatan].filter(Boolean), nama: ph.nama, nip: ph.nip, pangkat: "" });

/** Naskah dinas modul persuratan untuk dicetak/disimpan PDF: tata letak sama dengan konsep Word, Permendagri 18/2024. */
export function NaskahCetak({ n }: { n: NaskahRecord }) {
  const bentuk = jenisNaskah(n.jenis)?.bentuk ?? "surat-dinas";
  if (bentuk === "surat-tugas")
    return <SuratTugasCetak s={{ nomor: n.nomor, tanggal: n.tanggal, tempat: n.tempat, dasar: n.isi.dasar, untuk: n.isi.untuk, penerima: n.penerima, ttd: n.ttd }} />;
  const nomorTeks = n.nomor?.trim() || "…………………";
  // Nota dinas & surat dinas: tanggal sudah di bagian atas, blok tanda tangan tanpa tempat-tanggal.
  const ttdAtas = (
    <div className="ttd">
      <BlokTtd blok={blokPenandatangan(n.ttd)} />
    </div>
  );
  const acara = n.isi.acara ? (
    <table className="label acara">
      <tbody>
        {(
          [
            ["Hari/tanggal", n.isi.acara.hari],
            ["Waktu", n.isi.acara.waktu],
            ["Tempat", n.isi.acara.tempat],
            ["Acara", n.isi.acara.acara],
          ] as const
        ).map(([l, v]) => (
          <tr key={l}>
            <td className="l">{l}</td>
            <td className="t">:</td>
            <td>{v || "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ) : null;
  const daftar = (xs: string[]) => xs.map((k, i) => <div key={i}>{`${xs.length > 1 ? `${i + 1}. ` : ""}${k}`}</div>);
  const pihakUrut = n.isi.pihak.length === 2 ? [n.isi.pihak[1], n.isi.pihak[0]] : n.isi.pihak;

  return (
    <div className="sn">
      <style>{CSS}</style>
      {bentuk !== "laporan" ? <KopNaskah /> : null}
      {bentuk === "nota-dinas" ? (
        <>
          <div className="judul">NOTA DINAS</div>
          <table className="label">
            <tbody>
              <tr>
                <td className="l">Yth.</td>
                <td className="t">:</td>
                <td>{daftar(n.kepada)}</td>
              </tr>
              <tr>
                <td className="l">Dari</td>
                <td className="t">:</td>
                <td>{jabatanSatuBaris(n.ttdJabatan)}</td>
              </tr>
              <tr>
                <td className="l">Tembusan</td>
                <td className="t">:</td>
                <td>{n.tembusan.length ? daftar(n.tembusan) : "-"}</td>
              </tr>
              {(
                [
                  ["Tanggal", tanggalPanjang(n.tanggal)],
                  ["Nomor", nomorTeks],
                  ["Sifat", n.sifat],
                  ["Lampiran", n.lampiranTeks || "-"],
                  ["Hal", n.hal],
                ] as const
              ).map(([l, v]) => (
                <tr key={l}>
                  <td className="l">{l}</td>
                  <td className="t">:</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr />
          {n.isi.paragraf.map((t, i) => (
            <p key={i} className="par">
              {t}
            </p>
          ))}
          {ttdAtas}
        </>
      ) : bentuk === "surat-dinas" ? (
        <>
          <div className="kanan">{tanggalPanjang(n.tanggal)}</div>
          <table className="label">
            <tbody>
              {(
                [
                  ["Nomor", nomorTeks],
                  ["Sifat", n.sifat],
                  ["Lampiran", n.lampiranTeks || "-"],
                  ["Hal", n.hal],
                ] as const
              ).map(([l, v]) => (
                <tr key={l}>
                  <td className="l">{l}</td>
                  <td className="t">:</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="yth">
            {n.kepada.map((k, i) => (
              <div key={i} className={i ? "lanjut" : undefined}>
                {i === 0 ? `Yth. ${k}` : k}
              </div>
            ))}
          </div>
          {n.isi.paragraf.map((t, i) => (
            <Fragment key={i}>
              <p className="par">{t}</p>
              {i === 0 ? acara : null}
            </Fragment>
          ))}
          {!n.isi.paragraf.length ? acara : null}
          {ttdAtas}
          {n.tembusan.length ? (
            <div className="tembusan">
              <div>Tembusan:</div>
              {n.tembusan.map((k, i) => (
                <div key={i}>{n.tembusan.length > 1 ? `${i + 1}. ${k};` : `${k}.`}</div>
              ))}
            </div>
          ) : null}
        </>
      ) : bentuk === "berita-acara" ? (
        <>
          <div className="judul">BERITA ACARA</div>
          {n.hal ? <div className="judul">{n.hal.toUpperCase()}</div> : null}
          <div className="nomor">{barisNomor(n.nomor)}</div>
          <p className="pj">{pembukaBeritaAcara(n.tanggal)} kami yang bertanda tangan di bawah ini:</p>
          <table className="label pihak">
            <tbody>
              {n.isi.pihak.map((ph, i) => (
                <Fragment key={i}>
                  <tr>
                    <td className="no">{i + 1}.</td>
                    <td className="l">Nama</td>
                    <td className="t">:</td>
                    <td>{ph.nama || "…………"}</td>
                  </tr>
                  <tr>
                    <td />
                    <td className="l">NIP</td>
                    <td className="t">:</td>
                    <td>{ph.nip || "-"}</td>
                  </tr>
                  <tr>
                    <td />
                    <td className="l">Jabatan</td>
                    <td className="t">:</td>
                    <td>{ph.jabatan || "…………"}</td>
                  </tr>
                  {ph.sebutan ? (
                    <tr>
                      <td />
                      <td colSpan={3}>selanjutnya disebut {ph.sebutan}.</td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
          {n.isi.paragraf.map((t, i) => (
            <p key={i} className="par">
              {t}
            </p>
          ))}
          <div className="pihak-ttd">
            {pihakUrut.map((ph, i) => (
              <div key={i}>
                <BlokTtd blok={blokPihak(ph)} />
              </div>
            ))}
          </div>
          {n.isi.mengetahui ? (
            <div className="mengetahui">
              <div>Mengetahui/Mengesahkan,</div>
              <BlokTtd blok={blokPenandatangan({ jabatan: [n.isi.mengetahui.jabatan], nama: n.isi.mengetahui.nama, nip: n.isi.mengetahui.nip, pangkat: "" })} />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="judul">LAPORAN</div>
          <div className="judul jarak">{(n.hal || n.label).toUpperCase()}</div>
          {n.isi.bagian.map((b, i) => (
            <Fragment key={i}>
              <div className="bagian">
                {romawi(i + 1)}. {b.judul}
              </div>
              {b.isi.map((t, j) => (
                <p key={j} className="par menjorok">
                  {t}
                </p>
              ))}
            </Fragment>
          ))}
          <TtdNaskah tempat={n.tempat} tanggal={n.tanggal} ttd={n.ttd} />
        </>
      )}
      {n.isi.lampiran && n.isi.lampiran.baris.length ? (
        <div className="lampiran">
          <div className="kepala-lampiran">
            <div>LAMPIRAN</div>
            <div>{n.label.toUpperCase()}</div>
            <div>{barisNomor(n.nomor)}</div>
            <div>TANGGAL {tanggalPanjang(n.tanggal).toUpperCase()}</div>
          </div>
          <div className="judul">{n.isi.lampiran.judul || "DAFTAR"}</div>
          <table className="daftar">
            <thead>
              <tr>
                {n.isi.lampiran.kolom.map((k, i) => (
                  <th key={i}>{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {n.isi.lampiran.baris.map((b, i) => (
                <tr key={i}>
                  {b.map((t, j) => (
                    <td key={j} className={j === 0 ? "c" : undefined}>
                      {t || "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {ttdAtas}
        </div>
      ) : null}
    </div>
  );
}
