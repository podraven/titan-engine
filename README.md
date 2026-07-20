# Titan

Titan is a spreadsheet engine written in Rust and compiled to WebAssembly.

It exists because I wanted something that could recalculate large sheets without spending half its time allocating JavaScript objects or serializing data across the WASM boundary.

The project borrows ideas from existing spreadsheet engines, but it prioritizes browser performance over strict 1:1 compatibility with Excel internals.

## 🔗 Quick Links

| Resource | Link |
|----------|------|
| 📚 **Documentation** | https://podraven.github.io/titan-engine/ |
| ✨ **Request Feature + Bug report** | https://github.com/podraven/titan-engine/issues |
| ⚡ **Benchmark** | https://podraven.github.io/titan-engine/benchmark.html |

## Installation

Install the package via NPM:

```bash
npm install titan-engine
```

[![npm version](https://badge.fury.io/js/titan-engine.svg)](https://badge.fury.io/js/titan-engine)

## Usage

The `TitanJS` wrapper abstracts the WebAssembly pointers and provides A1 notation. It includes an event subscription model for UI updates.

### Initialization & Sheet Management

```javascript
import { initTitan } from 'titan-engine';

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
For bulk updates (like pasting a CSV), `TitanJS` uses a batch mode. This suspends the topological sort during insertion and recalculates the graph once at the end.

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

The `Viewport` class provides a zero-copy read mechanism. It abstracts the chunk math and re-acquires pointers if WebAssembly calls `memory.grow()`.

```javascript
const viewport = sheet1.createViewport();

// Inside the grid render loop:
const { type, value } = viewport.getCell(150, 20); 
```


## Design Decisions

### Data layout
Instead of representing cells as JS objects, memory is split into fixed 32×32 chunks. Each chunk stores types and payloads in separate arrays (Struct-of-Arrays).

That layout is less convenient to work with than objects, but it keeps memory contiguous and makes sequential scans cheap. I tried larger chunk sizes, but cache behavior got worse before memory usage got better, so 32×32 ended up being the best compromise.

### Execution & Lazy Evaluation
Formulas don't evaluate the AST directly. They compile to bytecode and run on a stack-based VM.

Ranges are deliberately capped. A formula shouldn't be able to allocate half a gigabyte and crash the browser just because someone typed `=A:A * 2`. Lookup and aggregation functions like `VLOOKUP` and `SUMIFS` use lazy `RangeRef` pointers instead of materializing full arrays, which means they can scan large columns without blowing up the VM stack.

### Standard Library
Titan includes 42 built-in functions. Lookup functions use lazy evaluation to avoid materializing large arrays.

- **Math:** `SUM`, `AVERAGE`, `MIN`, `MAX`, `ROUND`, `ROUNDUP`, `ROUNDDOWN`, `ABS`, `MOD`
- **Logic:** `IF`, `IFERROR`, `AND`, `OR`, `NOT`
- **Lookup & Reference:** `VLOOKUP`, `HLOOKUP`, `INDEX`, `MATCH`, `XLOOKUP`
- **Conditional Aggregation:** `COUNT`, `COUNTA`, `COUNTBLANK`, `SUMIF`, `SUMIFS`, `COUNTIF`, `COUNTIFS`, `AVERAGEIF`, `AVERAGEIFS`
- **Text:** `CONCATENATE`, `TEXTJOIN`, `LEFT`, `RIGHT`, `MID`, `LEN`, `FIND`, `SEARCH`, `SUBSTITUTE`, `REPLACE`, `TRIM`
- **Dates (Excel 1900-system):** `TODAY`, `NOW`, `DATE`, `YEAR`, `MONTH`, `DAY`, `EOMONTH`, `DATEDIF`

*(It also fully supports inline operators: `+`, `-`, `*`, `/`, `^`, `&`, `=`, `<`, `>`)*

### Dependency tracking
Dependencies are recalculated using Kahn's algorithm. If you create a circular reference, the engine yields a `#CYCLE!` error instead of freezing the main thread.

### Strings
Strings are expensive to duplicate in WASM. Titan interns strings into a shared `StringPool` and tracks them with a runtime reference count. Identical strings share the same `u32` ID. When a cell is overwritten, the reference count drops and the string is garbage-collected.

### Type system
A cell isn't just a float. The VM has a full `CellValue` enum tracking numbers, booleans, strings, errors (`#DIV/0!`, `#VALUE!`), and empty states. If you try to do math on a string, it propagates `#VALUE!` forward instead of silently converting it to `NaN` or `0`. Short-circuiting (`JumpIfFalse`) and VM-level `TryCatch` blocks keep untaken branches from crashing the engine.

### Zero-copy JS boundary
Most WASM spreadsheet engines serialize results back into JavaScript. Titan doesn't.

The frontend creates typed array views over WASM memory instead. Reading values becomes pointer arithmetic. JavaScript mostly just tells the engine what changed, catches the returned array of updated coordinates, and renders the result.
