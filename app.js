/**
 * Network Settling - Minimal, Authentic Frontend
 * Python logic via Pyodide
 */

// State
let pyodide = null;
let isRunning = false;
let animationInterval = null;
let gridSize = 4;
let selectedCell = null;

// Initialize
async function init() {
    showLoading();
    
    try {
        console.log('Loading Pyodide...');
        
        // Load Pyodide with explicit config
        pyodide = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/"
        });
        
        console.log('Pyodide loaded successfully');
        
        // Load Python module
        console.log('Loading Python module...');
        const response = await fetch('network_settling.py');
        const pythonCode = await response.text();
        await pyodide.runPythonAsync(pythonCode);
        
        console.log('Python module loaded');
        
        // Create network with example grid
        await createNetwork(4);
        await loadExampleGrid();
        
        setupEventListeners();
        hideLoading();
        renderGrid();
        await updateVisualization();
        
        console.log('Initialization complete');
        
    } catch (error) {
        console.error('Failed to initialize:', error);
        const wrapper = document.querySelector('.grid-wrapper');
        if (wrapper) {
            wrapper.innerHTML = `
                <div class="loading">
                    <p>Failed to load Python runtime</p>
                    <p style="font-size: 0.75rem; color: var(--text-secondary); max-width: 400px; text-align: center;">
                        ${error.message || 'Unknown error'}
                    </p>
                    <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer; background: var(--accent); color: white; border: none; border-radius: 2px; font-family: var(--font-sans);">
                        Retry
                    </button>
                </div>
            `;
        }
    }
}

// Load the example grid from the image
async function loadExampleGrid() {
    // Based on typical Sudoku-like example: diagonal pattern
    await pyodide.runPythonAsync(`set_clue(0, 0, 1)`);
    await pyodide.runPythonAsync(`set_clue(0, 1, 2)`);
    await pyodide.runPythonAsync(`set_clue(1, 2, 4)`);
    await pyodide.runPythonAsync(`set_clue(2, 3, 2)`);
    await pyodide.runPythonAsync(`set_clue(3, 1, 3)`);
}

// Python API calls
async function createNetwork(size) {
    gridSize = size;
    const result = await pyodide.runPythonAsync(`create_network(${size})`);
    return JSON.parse(result);
}

async function setClue(row, col, value) {
    const result = await pyodide.runPythonAsync(`set_clue(${row}, ${col}, ${value})`);
    return JSON.parse(result);
}

async function removeClue(row, col) {
    const result = await pyodide.runPythonAsync(`remove_clue(${row}, ${col})`);
    return JSON.parse(result);
}

async function step() {
    const result = await pyodide.runPythonAsync(`step()`);
    return JSON.parse(result);
}

async function reset() {
    const result = await pyodide.runPythonAsync(`reset()`);
    return JSON.parse(result);
}

async function setInhibition(strength) {
    const result = await pyodide.runPythonAsync(`set_inhibition(${strength})`);
    return JSON.parse(result);
}

async function getState() {
    const result = await pyodide.runPythonAsync(`get_state()`);
    return JSON.parse(result);
}

// Render grid
function renderGrid() {
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            const value = document.createElement('span');
            value.className = 'cell-value';
            cell.appendChild(value);
            
            const prob = document.createElement('span');
            prob.className = 'cell-probability';
            cell.appendChild(prob);
            
            cell.addEventListener('click', () => handleCellClick(row, col));
            
            grid.appendChild(cell);
        }
    }
}

// Handle cell click
async function handleCellClick(row, col) {
    if (isRunning) return;
    
    const state = await getState();
    const key = `${row},${col}`;
    const probs = state.probabilities[key];
    const isClamped = state.clamped.some(([r, c]) => r === row && c === col);
    
    // Show detail panel
    showCellDetail(row, col, probs);
    
    // Toggle clue
    if (isClamped) {
        const remove = confirm(`Remove clue from cell (${row}, ${col})?`);
        if (remove) {
            await removeClue(row, col);
            await updateVisualization();
        }
    } else {
        const value = prompt(`Enter value for cell (${row}, ${col}) [1-${gridSize}]:`);
        if (value) {
            const num = parseInt(value);
            if (num >= 1 && num <= gridSize) {
                await setClue(row, col, num);
                await updateVisualization();
            }
        }
    }
}

// Update visualization
async function updateVisualization() {
    const state = await getState();
    
    // Update each cell
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            const key = `${row},${col}`;
            const probs = state.probabilities[key];
            const isClamped = state.clamped.some(([r, c]) => r === row && c === col);
            
            updateCell(cell, probs, isClamped);
        }
    }
    
    // Update stats
    document.getElementById('iteration').textContent = state.iteration;
    if (state.max_change !== undefined) {
        document.getElementById('delta').textContent = state.max_change.toFixed(4);
    }
}

// Update single cell
function updateCell(cell, probs, isClamped) {
    const maxProb = Math.max(...probs);
    const maxIndex = probs.indexOf(maxProb);
    const value = maxIndex + 1;
    
    // Update value
    const valueSpan = cell.querySelector('.cell-value');
    valueSpan.textContent = value;
    
    // Update probability
    const probSpan = cell.querySelector('.cell-probability');
    if (!isClamped && maxProb < 0.99) {
        probSpan.textContent = maxProb.toFixed(2);
    } else {
        probSpan.textContent = '';
    }
    
    // Update styling
    if (isClamped) {
        cell.className = 'cell clamped';
    } else {
        cell.className = 'cell';
        
        // Subtle background based on confidence
        const intensity = Math.floor(maxProb * 255);
        const gray = 250 - Math.floor(maxProb * 15); // Very subtle
        cell.style.background = `rgb(${gray}, ${gray}, ${gray})`;
    }
}

// Show cell detail panel
function showCellDetail(row, col, probs) {
    const detail = document.getElementById('cellDetail');
    const title = document.getElementById('detailTitle');
    const bars = document.getElementById('detailBars');
    
    title.textContent = `Cell (${row}, ${col})`;
    
    bars.innerHTML = '';
    probs.forEach((prob, index) => {
        const value = index + 1;
        const isMax = prob === Math.max(...probs);
        
        const bar = document.createElement('div');
        bar.className = 'detail-bar';
        
        const label = document.createElement('div');
        label.className = 'bar-label';
        label.innerHTML = `
            <span>${value}${isMax ? ' ←' : ''}</span>
            <span>${(prob * 100).toFixed(1)}%</span>
        `;
        
        const track = document.createElement('div');
        track.className = 'bar-track';
        
        const fill = document.createElement('div');
        fill.className = `bar-fill ${prob > 0.7 ? 'high' : ''}`;
        fill.style.width = `${prob * 100}%`;
        
        track.appendChild(fill);
        bar.appendChild(label);
        bar.appendChild(track);
        bars.appendChild(bar);
    });
    
    detail.classList.remove('hidden');
}

// Play/Pause
async function togglePlayPause() {
    if (isRunning) {
        pause();
    } else {
        play();
    }
}

async function play() {
    isRunning = true;
    
    const playIcon = document.querySelector('.play-icon');
    const pauseIcon = document.querySelector('.pause-icon');
    const buttonText = document.querySelector('.button-text');
    
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    buttonText.textContent = 'Settling...';
    
    const speed = parseInt(document.getElementById('speed').value);
    
    animationInterval = setInterval(async () => {
        const state = await step();
        await updateVisualization();
        
        if (state.is_converged) {
            pause();
            document.querySelector('.button-text').textContent = 'Converged';
        }
    }, speed);
}

function pause() {
    isRunning = false;
    
    if (animationInterval) {
        clearInterval(animationInterval);
        animationInterval = null;
    }
    
    const playIcon = document.querySelector('.play-icon');
    const pauseIcon = document.querySelector('.pause-icon');
    const buttonText = document.querySelector('.button-text');
    
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    buttonText.textContent = 'Watch it settle';
}

// Step once
async function stepOnce() {
    if (isRunning) return;
    
    await step();
    await updateVisualization();
}

// Reset
async function resetGrid() {
    pause();
    await reset();
    await loadExampleGrid();
    await updateVisualization();
    
    document.getElementById('delta').textContent = '—';
    document.querySelector('.button-text').textContent = 'Watch it settle';
}

// Event listeners
function setupEventListeners() {
    document.getElementById('playPause').addEventListener('click', togglePlayPause);
    document.getElementById('step').addEventListener('click', stepOnce);
    document.getElementById('reset').addEventListener('click', resetGrid);
    
    document.getElementById('closeDetail').addEventListener('click', () => {
        document.getElementById('cellDetail').classList.add('hidden');
    });
    
    // Speed slider
    document.getElementById('speed').addEventListener('input', (e) => {
        document.getElementById('speedValue').textContent = `${e.target.value}ms`;
        
        if (isRunning) {
            pause();
            play();
        }
    });
    
    // Inhibition slider
    document.getElementById('inhibition').addEventListener('input', async (e) => {
        const strength = parseFloat(e.target.value) / 100;
        document.getElementById('inhibitionValue').textContent = strength.toFixed(2);
        await setInhibition(strength);
    });
}

// Loading states
function showLoading() {
    const wrapper = document.querySelector('.grid-wrapper');
    if (wrapper) {
        wrapper.innerHTML = '<div class="loading">Loading Python runtime...</div>';
    }
}

function hideLoading() {
    const wrapper = document.querySelector('.grid-wrapper');
    if (wrapper) {
        wrapper.innerHTML = '<div id="grid" class="grid"></div>';
    }
}

// Initialize on load
window.addEventListener('DOMContentLoaded', init);
