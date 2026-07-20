import initWasm, { TitanEngine } from './titan_wasm.js';

let wasmInstance = null;

export async function initTitan() {
    if (!wasmInstance) {
        wasmInstance = await initWasm();
    }
    return Titan;
}

export function toA1(row, col) {
    let dividend = col + 1;
    let columnName = '';
    while (dividend > 0) {
        let modulo = (dividend - 1) % 26;
        columnName = String.fromCharCode(65 + modulo) + columnName;
        dividend = Math.floor((dividend - modulo) / 26);
    }
    return `${columnName}${row + 1}`;
}

export function fromA1(a1) {
    const match = a1.match(/^([A-Z]+)(\d+)$/i);
    if (!match) throw new Error(`Invalid A1 notation: ${a1}`);
    const colStr = match[1].toUpperCase();
    const rowStr = match[2];
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
        col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    return { row: parseInt(rowStr, 10) - 1, col: col - 1 };
}

function resolveRef(ref) {
    if (typeof ref === 'string') return fromA1(ref);
    return ref;
}

export class Titan {
    constructor() {
        this.engine = new TitanEngine();
        this.sheetsById = new Map();
        this.sheetsByName = new Map();
        this.listeners = new Set();
    }

    
    addSheet(name) {
        const id = this.engine.add_sheet(name);
        const sheet = new Sheet(this, id, name);
        this.sheetsById.set(id, sheet);
        this.sheetsByName.set(name, sheet);
        return sheet;
    }


    getSheet(nameOrId) {
        if (typeof nameOrId === 'number') return this.sheetsById.get(nameOrId) || null;
        return this.sheetsByName.get(nameOrId) || null;
    }

    onCellsChanged(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    _triggerChange(deltas) {
        if (!deltas || deltas.length === 0) { return; }
        if (this.listeners.size === 0) return;
        
        const changes = [];
        for (let i = 0; i < deltas.length; i += 3) {
            const sheetId = deltas[i];
            const row = deltas[i+1];
            const col = deltas[i+2];
            const sheet = this.getSheet(sheetId);
            if (sheet) {
                changes.push({
                    sheetId,
                    sheetName: sheet.name,
                    row,
                    col,
                    a1: toA1(row, col),
                    cell: sheet.get({row, col})
                });
            }
        }
        
        for (const listener of this.listeners) {
            listener(changes);
        }
    }

    setCells(updates) {
        console.log(`[TitanJS] setCells called with ${updates.length} updates`);
        this.engine.begin_batch();
        let rustTime = 0;
        let jsTime = 0;
        try {
            for (const update of updates) {
                const sheet = this.getSheet(update.sheet);
                if (sheet) {
                    const {row, col} = resolveRef(update.cell);
                    this.engine.set_cell(sheet.id, row, col, String(update.value));
                }
            }
        } finally {
            const t1 = performance.now();
            const deltas = this.engine.end_batch();
            const t2 = performance.now();
            rustTime = t2 - t1;
            
            this._triggerChange(deltas);
            const t3 = performance.now();
            jsTime = t3 - t2;
            console.log(`[Perf] Rust end_batch: ${rustTime.toFixed(2)}ms | JS _triggerChange: ${jsTime.toFixed(2)}ms | Deltas: ${deltas ? deltas.length / 3 : 0}`);
            return rustTime + jsTime;
        }
    }

    undo() {
        console.log(`[TitanJS] undo called`);
        const t1 = performance.now();
        const deltas = this.engine.undo();
        const t2 = performance.now();
        const rustTime = t2 - t1;
        this._triggerChange(deltas);
        const t3 = performance.now();
        const jsTime = t3 - t2;
        console.log(`[Perf] Rust undo: ${rustTime.toFixed(2)}ms | JS _triggerChange: ${jsTime.toFixed(2)}ms`);
        return rustTime + jsTime;
    }

    redo() {
        const t1 = performance.now();
        const deltas = this.engine.redo();
        const t2 = performance.now();
        const rustTime = t2 - t1;
        this._triggerChange(deltas);
        const t3 = performance.now();
        const jsTime = t3 - t2;
        console.log(`[Perf] Rust redo: ${rustTime.toFixed(2)}ms | JS _triggerChange: ${jsTime.toFixed(2)}ms`);
        return rustTime + jsTime;
    }
}

export class Sheet {
    constructor(titan, id, name) {
        this.titan = titan;
        this.id = id;
        this.name = name;
    }

    set(cellRef, value) {
        const {row, col} = resolveRef(cellRef);
        this.titan.engine.begin_batch();
        const t1 = performance.now();
        this.titan.engine.set_cell(this.id, row, col, String(value));
        const deltas = this.titan.engine.end_batch();
        const t2 = performance.now();
        const rustTime = t2 - t1;
        this.titan._triggerChange(deltas);
        const t3 = performance.now();
        const jsTime = t3 - t2;
        return rustTime + jsTime;
    }

    get(cellRef) {
        const {row, col} = resolveRef(cellRef);
        const display = this.titan.engine.get_value_string(this.id, row, col);
        const raw_input = this.titan.engine.get_raw_input(this.id, row, col);
        // For simplicity, we expose the formatted string.
        // Complex objects can be built by expanding WASM exports or Viewports later.
        return {
            display,
            value: raw_input != null ? raw_input : display
        };
    }

    setRange(startCellRef, data) {
        const {row, col} = resolveRef(startCellRef);
        this.titan.engine.begin_batch();
        try {
            for (let r = 0; r < data.length; r++) {
                for (let c = 0; c < data[r].length; c++) {
                    this.titan.engine.set_cell(this.id, row + r, col + c, String(data[r][c]));
                }
            }
        } finally {
            const deltas = this.titan.engine.end_batch();
            this.titan._triggerChange(deltas);
        }
    }

    insertRow(row) {
        this.titan.engine.insert_row(this.id, row);
    }

    deleteRow(row) {
        this.titan.engine.delete_row(this.id, row);
    }

    insertCol(col) {
        this.titan.engine.insert_col(this.id, col);
    }

    deleteCol(col) {
        this.titan.engine.delete_col(this.id, col);
    }

    createViewport() {
        return new Viewport(this.titan.engine, this.id);
    }
}

export class Viewport {
    constructor(engine, sheetId) {
        this.engine = engine;
        this.sheetId = sheetId;
        this.chunkCache = new Map();
    }

    _getChunk(chunkR, chunkC) {
        const key = `${chunkR}_${chunkC}`;
        let chunk = this.chunkCache.get(key);
        
        // Detect memory reallocation/detachment
        if (chunk && chunk.types.buffer.byteLength === 0) {
            this.chunkCache.clear();
            chunk = null;
        }

        if (!chunk) {
            const typesPtr = this.engine.get_chunk_types_ptr(this.sheetId, chunkR * 32, chunkC * 32);
            const payloadsPtr = this.engine.get_chunk_payloads_ptr(this.sheetId, chunkR * 32, chunkC * 32);
            
            if (typesPtr !== 0 && payloadsPtr !== 0) {
                chunk = {
                    types: new Uint8Array(wasmInstance.memory.buffer, typesPtr, 1024),
                    payloads: new Float64Array(wasmInstance.memory.buffer, payloadsPtr, 1024)
                };
                this.chunkCache.set(key, chunk);
            }
        }
        return chunk;
    }

    getCell(row, col) {
        const chunkR = Math.floor(row / 32);
        const chunkC = Math.floor(col / 32);
        const chunk = this._getChunk(chunkR, chunkC);
        
        if (!chunk) return { type: 0, value: 0 };

        const localR = row % 32;
        const localC = col % 32;
        const idx = localR * 32 + localC;

        return {
            type: chunk.types[idx],
            value: chunk.payloads[idx]
        };
    }
}
