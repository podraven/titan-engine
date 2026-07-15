export type CellRef = string | { row: number; col: number };

export interface CellInfo {
    display: string;
    value: string;
}

export interface CellChange {
    sheetId: number;
    sheetName: string;
    row: number;
    col: number;
    a1: string;
    cell: CellInfo;
}

export interface CellUpdate {
    sheet: string | number;
    cell: CellRef;
    value: string | number | boolean;
}

export interface RawCell {
    type: number;
    value: number;
}

/**
 * Initializes the WebAssembly Titan engine and returns the Titan class.
 */
export function initTitan(): Promise<typeof Titan>;

/**
 * Converts a 0-indexed row and column into Excel A1 notation (e.g., row 0, col 0 -> "A1").
 */
export function toA1(row: number, col: number): string;

/**
 * Converts Excel A1 notation (e.g., "A1") into a 0-indexed row and column object.
 */
export function fromA1(a1: string): { row: number; col: number };

export class Titan {
    constructor();

    /**
     * Adds a new sheet to the engine.
     */
    addSheet(name: string): Sheet;

    /**
     * Retrieves an existing sheet by its string name or numeric ID.
     */
    getSheet(nameOrId: string | number): Sheet | null;

    /**
     * Subscribes to cell changes. Returns a function to unsubscribe.
     */
    onCellsChanged(callback: (changes: CellChange[]) => void): () => boolean;

    /**
     * Updates multiple cells across multiple sheets in a single atomic batch transaction.
     */
    setCells(updates: CellUpdate[]): void;

    /**
     * Undoes the last action or batch of actions.
     */
    undo(): void;

    /**
     * Redoes the previously undone action.
     */
    redo(): void;
}

export class Sheet {
    readonly id: number;
    readonly name: string;
    readonly titan: Titan;

    constructor(titan: Titan, id: number, name: string);

    /**
     * Sets a specific cell's value or formula.
     */
    set(cellRef: CellRef, value: string | number | boolean): void;

    /**
     * Gets the evaluated display value of a cell.
     */
    get(cellRef: CellRef): CellInfo;

    /**
     * Bulk updates a continuous 2D array of data starting from the specified top-left cell.
     * Evaluates in a single O(1) atomic batch transaction.
     */
    setRange(startCellRef: CellRef, data: (string | number | boolean)[][]): void;

    insertRow(row: number): void;
    deleteRow(row: number): void;
    insertCol(col: number): void;
    deleteCol(col: number): void;

    /**
     * Creates a high-performance zero-copy memory viewport for 60fps rendering.
     */
    createViewport(): Viewport;
}

export class Viewport {
    constructor(engine: any, sheetId: number);

    /**
     * Gets the raw memory type and payload from the WASM array buffer without crossing the JS boundary.
     * @returns type: 0=Empty, 1=Number, 2=StringId, 3=Bool, 4=ErrorId
     */
    getCell(row: number, col: number): RawCell;
}
