// The DocBrain evidence verifier, compiled from the same Rust crate the CLI
// uses, running in this tab. No network, no server, no trust in us.
//
// chrono's `wasmbind` feature (on by default) links wasm-bindgen glue that the
// verify path never reaches — nothing here touches the clock or JS interop.
// The stubs TRAP rather than return, so an unreachable path can never silently
// produce a wrong verdict.
const trap = (n) => () => { throw new Error(`unreachable wasm-bindgen import: ${n}`); };
const IMPORTS = {
  __wbindgen_placeholder__: {
    __wbindgen_describe: trap('describe'),
    __wbg___wbindgen_jspi_spawn_poll_186c854bb4cd8b1a: trap('jspi_spawn_poll'),
    __wbg___wbindgen_throw_5d9e815e6fdf150f: trap('throw'),
  },
  __wbindgen_externref_xform__: {
    __wbindgen_externref_table_set_null: trap('table_set_null'),
    __wbindgen_externref_table_grow: trap('table_grow'),
  },
};

let ex = null;

export async function load(url = 'assets/dbev_wasm.wasm') {
  const buf = await (await fetch(url)).arrayBuffer();
  const { instance } = await WebAssembly.instantiate(buf, IMPORTS);
  ex = instance.exports;
  return { bytes: buf.byteLength };
}

const u8 = () => new Uint8Array(ex.memory.buffer);
const view = () => new DataView(ex.memory.buffer);

export function verify(bytes) {
  if (!ex) throw new Error('verifier not loaded');
  const t0 = performance.now();
  const p = ex.db_alloc(bytes.length);
  u8().set(bytes, p);
  const out = ex.db_verify(p, bytes.length);
  const len = view().getUint32(out, true);
  const json = new TextDecoder().decode(u8().slice(out + 4, out + 4 + len));
  ex.db_free(p, bytes.length);
  ex.db_free(out, 4 + len);
  const report = JSON.parse(json);
  report.elapsed_ms = performance.now() - t0;
  return report;
}

export async function sha256(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/// The records inside the bundle, so the page can show the knowledge itself.
export function records(bytes) {
  if (!ex) throw new Error('verifier not loaded');
  const p = ex.db_alloc(bytes.length);
  u8().set(bytes, p);
  const out = ex.db_records(p, bytes.length);
  const len = view().getUint32(out, true);
  const json = new TextDecoder().decode(u8().slice(out + 4, out + 4 + len));
  ex.db_free(p, bytes.length);
  ex.db_free(out, 4 + len);
  return JSON.parse(json);
}
