import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { RULES, stepAutomaton } from './CellularAutomata';
import Automata3D from './Automata3D';

const RESOLUTIONS = [32, 64, 128, 256];

function App() {
  const [mode, setMode] = useState('2D'); // '1D', '2D', or '3D'
  const [zoom, setZoom] = useState(1);
  // 2D state
  const [resolution, setResolution] = useState(256);
  const [rule, setRule] = useState('life');
  const [grid, setGrid] = useState(createEmptyGrid(256));
  // 1D state
  const [rule1D, setRule1D] = useState(30); // Default: Rule 30
  const [row1D, setRow1D] = useState(createEmptyRow(256));
  const [rows1D, setRows1D] = useState([createEmptyRow(256)]);
  // Shared
  const [speed, setSpeed] = useState(10);
  const [running, setRunning] = useState(false);
  const canvasRef = useRef(null);
  const animationRef = useRef();
  const mouseDown = useRef(false);

  useEffect(() => {
    setGrid(createEmptyGrid(resolution));
  }, [resolution]);

  // Reset 1D state if switching to 1D or changing resolution
  useEffect(() => {
    if (mode === '1D') {
      const empty = createEmptyRow(resolution);
      setRow1D(empty);
      setRows1D([empty]);
    }
  }, [mode, resolution]);

  useEffect(() => {
    if (!running) return; // Only run simulation when running is true
    let timeoutId;
    function wrappedRun() {
      if (mode === '2D') {
        setGrid(g => stepAutomaton(g, rule, resolution));
      } else if (mode === '1D') {
        setRows1D(prevRows => {
          if (prevRows.length === 0) return prevRows;
          // Only add one new row per step
          const nextRow = stepAutomaton1D(prevRows[prevRows.length - 1], rule1D);
          if (prevRows.length < Math.floor(canvasRef.current.height / (canvasRef.current.height / resolution))) {
            return [...prevRows, nextRow];
          } else {
            return [...prevRows.slice(1), nextRow];
          }
        });
      }
      timeoutId = setTimeout(() => {
        if (running) {
          animationRef.current = requestAnimationFrame(wrappedRun);
        }
      }, 1000 / speed);
    }

    animationRef.current = requestAnimationFrame(wrappedRun);
    return () => {
      cancelAnimationFrame(animationRef.current);
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line
  }, [running, speed, rule, resolution, mode, rule1D]);

  useEffect(() => {
    if (mode === '2D') {
      drawGrid();
    } else if (mode === '1D') {
      drawGrid1D();
    }
    // eslint-disable-next-line
  }, [grid, rows1D, resolution, mode, zoom]);

  // run() is now inlined in useEffect for better control


  function createEmptyGrid(n) {
    return new Uint8Array(n * n);
  }

  function handleCanvasMouse(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor(((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) / rect.width * resolution);
    const y = Math.floor(((e.touches ? e.touches[0].clientY : e.clientY) - rect.top) / rect.height * resolution);
    if (x >= 0 && x < resolution && y >= 0 && y < resolution) {
      setGrid(g => {
        const newGrid = g.slice();
        newGrid[y * resolution + x] = 1;
        return newGrid;
      });
    }
  }

  function drawGrid() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.save();
    ctx.setTransform(zoom, 0, 0, zoom, (w * (1 - zoom)) / 2, (h * (1 - zoom)) / 2);
    ctx.clearRect(0, 0, w, h);
    const imgData = ctx.createImageData(w, h);
    const cellW = w / resolution;
    const cellH = h / resolution;
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        if (grid[y * resolution + x]) {
          for (let dy = 0; dy < cellH; dy++) {
            for (let dx = 0; dx < cellW; dx++) {
              const px = Math.floor(x * cellW + dx);
              const py = Math.floor(y * cellH + dy);
              const idx = (py * w + px) * 4;
              imgData.data[idx] = 34;
              imgData.data[idx + 1] = 34;
              imgData.data[idx + 2] = 34;
              imgData.data[idx + 3] = 255;
            }
          }
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    ctx.restore();
  }

  function handleWheel(e) {
    e.preventDefault();
    setZoom(z => {
      let next = z - e.deltaY * 0.001;
      next = Math.max(1, Math.min(next, 8));
      return Math.round(next * 100) / 100;
    });
  }

  function handleClear() {
    setGrid(createEmptyGrid(resolution));
  }

  // 1D Cellular Automaton logic
  function createEmptyRow(n) {
    return new Uint8Array(n);
  }

  function stepAutomaton1D(prevRow, ruleNum) {
    // ruleNum: integer 0-255
    // Returns a new Uint8Array
    const n = prevRow.length;
    const ruleBits = ruleNum.toString(2).padStart(8, '0').split('').map(Number).reverse();
    // For each cell, determine neighborhood (left, center, right)
    const nextRow = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const left = prevRow[(i - 1 + n) % n];
      const center = prevRow[i];
      const right = prevRow[(i + 1) % n];
      const idx = (left << 2) | (center << 1) | right;
      nextRow[i] = ruleBits[idx];
    }
    return nextRow;
  }

  function handleClear1D() {
    const empty = createEmptyRow(resolution);
    setRow1D(empty);
    setRows1D([empty]);
  }

  function handleCanvasMouse1D(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor(((e.touches ? e.touches[0].clientX : e.clientX) - rect.left) / rect.width * resolution);
    if (x >= 0 && x < resolution) {
      setRow1D(r => {
        const newRow = r.slice();
        newRow[x] = 1;
        setRows1D([newRow]); // Always reset to only the new initial row
        return newRow;
      });
    }
  }

  function drawGrid1D() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.save();
    ctx.setTransform(zoom, 0, 0, zoom, (w * (1 - zoom)) / 2, (h * (1 - zoom)) / 2);
    ctx.clearRect(0, 0, w, h);
    const cellW = w / resolution;
    // Always use a fixed cellH based on max rows that fit in the canvas
    const maxRows = Math.floor(h / (h / resolution));
    const cellH = h / maxRows;
    // Only draw up to maxRows rows, showing the most recent generations
    const startIdx = Math.max(0, rows1D.length - maxRows);
    for (let y = 0; y < Math.min(rows1D.length, maxRows); y++) {
      const row = rows1D[startIdx + y];
      for (let x = 0; x < resolution; x++) {
        if (row[x]) {
          ctx.fillStyle = '#222';
          ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
        }
      }
    }
    ctx.restore();
  }

  return (
    <div className="App">
      <h1>Cellular Automata Explorer</h1>
      <div className="mode-selector" style={{ marginBottom: 20 }}>
        <label style={{ fontWeight: 600, marginRight: 8 }}>Mode:</label>
        <select value={mode} onChange={e => setMode(e.target.value)}>
          <option value="1D">1D</option>
          <option value="2D">2D</option>
          <option value="3D">3D</option>
        </select>
      </div>
      {mode === '2D' ? (
        <div>
          <div className="controls">
            <label>Resolution: 
              <select value={resolution} onChange={e => setResolution(Number(e.target.value))}>
                {RESOLUTIONS.map(r => <option key={r} value={r}>{r}x{r}</option>)}
              </select>
            </label>
            <label>Rule: 
              <select value={rule} onChange={e => setRule(e.target.value)}>
                {Object.entries(RULES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
              </select>
            </label>
            <label>Speed: 
              <input type="range" min="1" max="60" value={speed} onChange={e => setSpeed(Number(e.target.value))} />
              <span>{speed} fps</span>
            </label>
            <button onClick={() => setRunning(r => !r)}>{running ? 'Pause' : 'Start'}</button>
            <button onClick={handleClear}>Clear</button>
          </div>
          <canvas
            ref={canvasRef}
            width={600}
            height={600}
            className="automata-canvas"
            onMouseDown={e => { mouseDown.current = true; handleCanvasMouse(e); }}
            onMouseUp={() => { mouseDown.current = false; }}
            onMouseMove={e => { if (mouseDown.current) handleCanvasMouse(e); }}
            onTouchStart={e => { mouseDown.current = true; handleCanvasMouse(e); }}
            onTouchEnd={() => { mouseDown.current = false; }}
            onTouchMove={e => { if (mouseDown.current) handleCanvasMouse(e); }}
            onWheel={handleWheel}
            style={{ border: '1px solid #999', marginTop: 16, touchAction: 'none', cursor: zoom !== 1 ? 'zoom-in' : 'default' }}
          />
        </div>
      ) : mode === '1D' ? (
        <div>
          <div className="controls">
            <label>Resolution: 
              <select value={resolution} onChange={e => setResolution(Number(e.target.value))}>
                {RESOLUTIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label>Rule: 
              <select value={rule1D} onChange={e => setRule1D(Number(e.target.value))}>
                {Array.from({length: 256}, (_, i) => <option key={i} value={i}>{`Rule ${i}`}</option>)}
              </select>
            </label>
            <label>Speed: 
              <input type="range" min="1" max="60" value={speed} onChange={e => setSpeed(Number(e.target.value))} />
              <span>{speed} fps</span>
            </label>
            <button onClick={() => setRunning(r => !r)}>{running ? 'Pause' : 'Start'}</button>
            <button onClick={handleClear1D}>Clear</button>
          </div>
          <canvas
            ref={canvasRef}
            width={600}
            height={600}
            className="automata-canvas"
            onMouseDown={e => { mouseDown.current = true; handleCanvasMouse1D(e); }}
            onMouseUp={() => { mouseDown.current = false; }}
            onMouseMove={e => { if (mouseDown.current) handleCanvasMouse1D(e); }}
            onTouchStart={e => { mouseDown.current = true; handleCanvasMouse1D(e); }}
            onTouchEnd={() => { mouseDown.current = false; }}
            onTouchMove={e => { if (mouseDown.current) handleCanvasMouse1D(e); }}
            onWheel={handleWheel}
            style={{ border: '1px solid #999', marginTop: 16, touchAction: 'none', cursor: zoom !== 1 ? 'zoom-in' : 'default' }}
          />
        </div>
      ) : mode === '3D' ? (
        <div>
          <div className="controls">
            <label>Resolution: 
              <select value={resolution} onChange={e => setResolution(Number(e.target.value))}>
                {RESOLUTIONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>Speed: 
              <input
                type="range"
                min="1" max="20" step="1"
                value={speed}
                onChange={e => setSpeed(Number(e.target.value))}
              />
              {speed}
            </label>
            <label>Rule: 
              <select value={rule} onChange={e => setRule(e.target.value)}>
                {Object.keys(RULES).map(k => (
                  <option key={k} value={k}>{RULES[k].name}</option>
                ))}
              </select>
            </label>
            {mode === '3D' ? null : (
              <>
                <button onClick={handleStart} disabled={running}>{running ? 'Running...' : 'Start'}</button>
                <button onClick={handleClear} disabled={running}>Clear</button>
              </>
            )}
          </div>
          <Automata3D
            resolution={resolution}
            rule={rule}
            speed={speed}
            running={running}
            onStart={() => setRunning(true)}
            onClear={() => setGrid(Array.from({ length: resolution }, () => Array(resolution).fill(0)))}
            grid={grid}
          />
        </div>
      ) : null}
      <footer>
        <small>Rules: Life (B3/S23), HighLife (B36/S23), Seeds (B2/S). Drag to draw. Built with React.</small>
      </footer>
    </div>
  );
}

export default App;
