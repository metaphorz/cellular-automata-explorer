import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { RULES, stepAutomaton } from './CellularAutomata';

const RESOLUTIONS = [256, 512];

function App() {
  const [zoom, setZoom] = useState(1);
  const [resolution, setResolution] = useState(256);
  const [rule, setRule] = useState('life');
  const [speed, setSpeed] = useState(10);
  const [running, setRunning] = useState(false);
  const [grid, setGrid] = useState(createEmptyGrid(256));
  const canvasRef = useRef(null);
  const animationRef = useRef();
  const mouseDown = useRef(false);

  useEffect(() => {
    setGrid(createEmptyGrid(resolution));
  }, [resolution]);

  useEffect(() => {
    let timeoutId;
    function wrappedRun() {
      setGrid(g => stepAutomaton(g, rule, resolution));
      timeoutId = setTimeout(() => {
        if (running) {
          animationRef.current = requestAnimationFrame(wrappedRun);
        }
      }, 1000 / speed);
    }

    if (running) {
      animationRef.current = requestAnimationFrame(wrappedRun);
    } else {
      cancelAnimationFrame(animationRef.current);
      if (timeoutId) clearTimeout(timeoutId);
    }
    return () => {
      cancelAnimationFrame(animationRef.current);
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line
  }, [running, speed, rule, resolution]);

  useEffect(() => {
    drawGrid();
    // eslint-disable-next-line
  }, [grid, resolution]);

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

  return (
    <div className="App">
      <h1>Cellular Automata Explorer</h1>
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
      <footer>
        <small>Rules: Life (B3/S23), HighLife (B36/S23), Seeds (B2/S). Drag to draw. Built with React.</small>
      </footer>
    </div>
  );
}

export default App;
