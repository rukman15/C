// Dipakai layout (server), jadi terpisah dari lib/tema.ts yang khusus browser.
/** Skrip sebelum halaman tergambar (layout): tema tersimpan atau tema sistem, tanpa berkedip. */
export const SKRIP_TEMA = `try{var t=localStorage.getItem("tema");var g=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;var r=document.documentElement;r.dataset.theme=g?"dark":"light";r.style.colorScheme=g?"dark":"light"}catch(e){}`;
