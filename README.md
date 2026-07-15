# Titan

Titan is a spreadsheet engine written in Rust and compiled to WebAssembly.

It exists because I wanted something that could recalculate large sheets without spending half its time allocating JavaScript objects or serializing data across the WASM boundary.

The project borrows ideas from existing spreadsheet engines, but it prioritizes browser performance over strict 1:1 compatibility with Excel internals.

## Design Decisions

### Data layout
Instead of representing cells as JS objects, memory is split into fixed 32×32 chunks. Each chunk stores types and payloads in separate arrays (Struct-of-Arrays).

That layout is less convenient to work with than objects, but it keeps memory contiguous and makes sequential scans cheap. I tried larger chunk sizes, but cache behavior got worse before memory usage got better, so 32×32 ended up being the best compromise.

### Execution & Lazy Evaluation
Formulas don't evaluate the AST directly. They compile to bytecode and run on a stack-based VM.

Ranges are deliberately capped. A formula shouldn't be able to allocate half a gigabyte and crash the browser just because someone typed `=A:A * 2`. Lookup and aggregation functions like `VLOOKUP` and `SUMIFS` use lazy `RangeRef` pointers instead of materializing full arrays, which means they can scan large columns without blowing up the VM stack.

### Standard Library
The engine includes about 40 common functions:
- **Math & Logic:** `SUM`, `AVERAGE`, `MIN`, `MAX`, `IF`, `IFERROR`, `ROUND`, `AND`, `OR`
- **Lookup & Aggregation:** `VLOOKUP`, `HLOOKUP`, `INDEX`, `MATCH`, `XLOOKUP`, `SUMIF`, `COUNTIFS`
- **Text:** `CONCATENATE`, `TEXTJOIN`, `LEFT`, `RIGHT`, `MID`, `SUBSTITUTE`
- **Dates (Excel 1900-system):** `TODAY`, `NOW`, `DATE`, `EOMONTH`, `DATEDIF`

### Dependency tracking
Dependencies are recalculated using Kahn's algorithm. If you create a circular reference, the engine yields a `#CYCLE!` error instead of freezing the main thread.

### Strings
Strings are expensive to duplicate in WASM. Titan interns strings into a shared `StringPool` and tracks them with a runtime reference count. Identical strings share the same `u32` ID. When a cell is overwritten, the reference count drops and the string is garbage-collected.

### Type system
A cell isn't just a float. The VM has a full `CellValue` enum tracking numbers, booleans, strings, errors (`#DIV/0!`, `#VALUE!`), and empty states. If you try to do math on a string, it propagates `#VALUE!` forward instead of silently converting it to `NaN` or `0`. Short-circuiting (`JumpIfFalse`) and VM-level `TryCatch` blocks keep untaken branches from crashing the engine.

### Zero-copy JS boundary
Most WASM spreadsheet engines serialize results back into JavaScript. Titan doesn't.

The frontend creates typed array views over WASM memory instead. Reading values becomes pointer arithmetic. JavaScript mostly just tells the engine what changed, catches the returned array of updated coordinates, and renders the result.

## Usage

We provide a high-level JavaScript wrapper (`TitanJS`) that abstracts away the WebAssembly pointers, provides A1 notation, and introduces a reactive, event-driven subscription model perfectly aligned with React, Vue, and vanilla JS.

### Initialization & Sheet Management

```javascript
import { initTitan } from './titan.js';

const Titan = await initTitan();
const engine = new Titan();

// Creates a sheet object. No more tracking integer IDs!
const sheet1 = engine.addSheet("Dashboard");
```

### Mutating the Grid (Polymorphic API)
You can set cells using traditional Excel `A1` notation or `{row, col}` objects.

```javascript
// Setting a cell parses the '=' and compiles the formula automatically.
sheet1.set("B2", "=SUM(A1:A100) * 2");
sheet1.set({ row: 0, col: 0 }, "15");
```

### Reactivity & Event Subscriptions
You don't need to manually check if cells updated. You simply write data, and the event listener reacts with an array of exactly what changed (including cascading dependencies).

```javascript
engine.onCellsChanged((changes) => {
    console.log(`Updated ${changes.length} cells.`);
    changes.forEach(change => {
        console.log(`${change.sheetName}!${change.a1} = ${change.cell.display}`);
    });
    
    // Pass cleanly to your UI layer
    // myGrid.updateCells(changes);
});
```

### Bulk Operations (The Batch Manager)
If you are pasting a CSV or loading a database state, `TitanJS` handles the `O(1)` batch mode internally. It safely expands boundaries, suspends the topological graph, and fires exactly *one* reactive event at the end.

```javascript
// Paste a 2D array starting at A1
sheet1.setRange("A1", [
    ["ID", "Name", "Sales"],
    ["1", "Alice", 500],
    ["2", "Bob", "=C2*1.5"]
]);

// Scattershot updates across multiple sheets
engine.setCells([
    { sheet: "Dashboard", cell: "Z1", value: 100 },
    { sheet: 0, cell: {row: 5, col: 5}, value: "=Dashboard!Z1" }
]);
```

### Reading Data & Zero-Copy Viewports
You can instantly request the fully formatted display value of a cell:
```javascript
const cell = sheet1.get("A1");
console.log(cell.display); // "15", "Banana", "#DIV/0!"
```

For rendering massive grids at 60fps, use the `Viewport` class. It safely wraps the WASM buffer, abstracts the modulo chunking math, and automatically re-acquires pointers if `memory.grow()` detaches them.

```javascript
const viewport = sheet1.createViewport();

// Inside the grid render loop:
const { type, value } = viewport.getCell(150, 20); 
```

## Examples

Check out the live interactive examples included in this repository:

- **[Basic Example](examples/basic-example.html)** - Basic parsing, zero-copy memory reads, formula recalculations, and structural mutations.
- **[Glide Data Grid Integration](examples/glide-example.html)** - A complete React-based spreadsheet UI built with Glide Data Grid. It supports cross-sheet references, massive CSV pasting (via the `O(1)` Batch Manager API), and infinite dynamic grid expansion without freezing the main thread.