/* tslint:disable */
/* eslint-disable */

export class TitanEngine {
    free(): void;
    [Symbol.dispose](): void;
    add_sheet(name: string): number;
    begin_batch(): void;
    delete_col(sheet: number, target_col: number): void;
    delete_row(sheet: number, target_row: number): void;
    end_batch(): Uint32Array;
    get_chunk_payloads_ptr(sheet: number, row: number, col: number): number;
    get_chunk_types_ptr(sheet: number, row: number, col: number): number;
    get_value(sheet: number, row: number, col: number): number;
    get_value_string(sheet: number, row: number, col: number): string;
    insert_col(sheet: number, target_col: number): void;
    insert_row(sheet: number, target_row: number): void;
    constructor();
    redo(): Uint32Array;
    set_cell(sheet: number, row: number, col: number, input: string): Uint32Array;
    undo(): Uint32Array;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_titanengine_free: (a: number, b: number) => void;
    readonly titanengine_add_sheet: (a: number, b: number, c: number) => number;
    readonly titanengine_begin_batch: (a: number) => void;
    readonly titanengine_delete_col: (a: number, b: number, c: number) => [number, number];
    readonly titanengine_delete_row: (a: number, b: number, c: number) => [number, number];
    readonly titanengine_end_batch: (a: number) => [number, number, number];
    readonly titanengine_get_chunk_payloads_ptr: (a: number, b: number, c: number, d: number) => number;
    readonly titanengine_get_chunk_types_ptr: (a: number, b: number, c: number, d: number) => number;
    readonly titanengine_get_value: (a: number, b: number, c: number, d: number) => number;
    readonly titanengine_get_value_string: (a: number, b: number, c: number, d: number) => [number, number];
    readonly titanengine_insert_col: (a: number, b: number, c: number) => [number, number];
    readonly titanengine_insert_row: (a: number, b: number, c: number) => [number, number];
    readonly titanengine_new: () => number;
    readonly titanengine_redo: (a: number) => [number, number, number];
    readonly titanengine_set_cell: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly titanengine_undo: (a: number) => [number, number, number];
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
