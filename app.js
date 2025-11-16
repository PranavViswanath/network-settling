/**
 * Network Settling - Interactive Visualization
 * Python logic via Pyodide
 */

// State
let pyodide = null;
let isRunning = false;
let animationInterval = null;
let gridSize = 4;
let selectedCell = null;
let watchedCell = null;

// Initialize
async function init() {
    showLoading();
    
    try {
        console.log('Loading Pyodide...');
        
        pyodide = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/"
        });
        
        console.log('Pyodide loaded successfully');
        
        const response = await fetch('network_settling.py');
        const pythonCode = await response.text();
        await pyodide.runPythonAsync(pythonCode);
        
        console.log('Python module loaded');
        
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

async function loadExampleGrid() {
    await pyodide.runPythonAsync(`set_clue(0, 0, 1)`);
    await pyodide.runPythonAsync(`set_clue(0, 1, 2)`);
    await pyodide.runPythonAsync(`set_clue(1, 2, 4)`);
    await pyodide.runPythonAsync(`set_clue(2, 3, 2)`);
    await pyodide.runPythonAsync(`set_clue(3, 1, 3)`);
}

// Python API
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

// Handle cell click - inline editing
async function handleCellClick(row, col) {
    if (isRunning) return;
    
    const state = await getState();
    const key = `${row},${col}`;
    const isClamped = state.clamped.some(([r, c]) => r === row && c === col);
    
    // Watch this cell's probabilities
    watchedCell = { row, col };
    updateProbabilityPanel(state);
    
    // Make cell editable
    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    
    if (selectedCell) {
        selectedCell.classList.remove('selected');
    }
    
    cell.classList.add('selected');
    selectedCell = cell;
    
    // If clamped, allow removal
    if (isClamped) {
        const valueSpan = cell.querySelector('.cell-value');
        valueSpan.style.cursor = 'pointer';
        
        // Double-click to remove
        const handleDoubleClick = async () => {
            await removeClue(row, col);
            await updateVisualization();
            cell.removeEventListener('dblclick', handleDoubleClick);
        };
        
        cell.addEventListener('dblclick', handleDoubleClick);
        return;
    }
    
    // Create input for editing
    const valueSpan = cell.querySelector('.cell-value');
    const currentValue = valueSpan.textContent;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cell-input';
    input.maxLength = 1;
    input.value = '';
    
    valueSpan.style.display = 'none';
    cell.appendChild(input);
    input.focus();
    
    const finishEdit = async (save) => {
        const newValue = input.value;
        input.remove();
        valueSpan.style.display = 'block';
        
        if (save && newValue && newValue !== currentValue) {
            const num = parseInt(newValue);
            if (num >= 1 && num <= gridSize) {
                await setClue(row, col, num);
                await updateVisualization();
            }
        }
    };
    
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            await finishEdit(true);
        } else if (e.key === 'Escape') {
            await finishEdit(false);
        }
    });
    
    input.addEventListener('blur', () => finishEdit(true));
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
    
    // Update probability panel if watching a cell
    if (watchedCell) {
        updateProbabilityPanel(state);
    }
}

// Update single cell
function updateCell(cell, probs, isClamped) {
    const maxProb = Math.max(...probs);
    const maxIndex = probs.indexOf(maxProb);
    const value = maxIndex + 1;
    
    const valueSpan = cell.querySelector('.cell-value');
    if (valueSpan) {
        valueSpan.textContent = value;
    }
    
    const probSpan = cell.querySelector('.cell-probability');
    if (probSpan) {
        if (!isClamped && maxProb < 0.99) {
            probSpan.textContent = maxProb.toFixed(2);
        } else {
            probSpan.textContent = '';
        }
    }
    
    if (isClamped) {
        cell.className = 'cell clamped';
        if (selectedCell && cell.dataset.row === selectedCell.dataset.row && 
            cell.dataset.col === selectedCell.dataset.col) {
            cell.classList.add('selected');
        }
    } else {
        cell.className = 'cell';
        if (selectedCell && cell.dataset.row === selectedCell.dataset.row && 
            cell.dataset.col === selectedCell.dataset.col) {
            cell.classList.add('selected');
        }
        
        // Subtle background based on confidence
        const gray = 250 - Math.floor(maxProb * 15);
        cell.style.background = `rgb(${gray}, ${gray}, ${gray})`;
    }
    
    // Add settling animation
    if (isRunning) {
        cell.classList.add('settling');
        setTimeout(() => cell.classList.remove('settling'), 500);
    }
}

// Update probability panel - shows live distribution
function updateProbabilityPanel(state) {
    if (!watchedCell) return;
    
    const viz = document.getElementById('probabilityViz');
    const key = `${watchedCell.row},${watchedCell.col}`;
    const probs = state.probabilities[key];
    const isClamped = state.clamped.some(([r, c]) => r === watchedCell.row && c === watchedCell.col);
    
    const maxProb = Math.max(...probs);
    
    let html = `
        <div class="prob-cell-header">
            Cell (${watchedCell.row}, ${watchedCell.col})${isClamped ? ' • clamped' : ''}
        </div>
        <div class="prob-bars">
    `;
    
    probs.forEach((prob, index) => {
        const value = index + 1;
        const isWinner = prob === maxProb && prob > 0.5;
        const isHigh = prob > 0.7;
        
        html += `
            <div class="prob-bar ${isRunning ? 'updating' : ''}">
                <div class="prob-label">
                    <span class="value-name ${isWinner ? 'winner' : ''}">
                        value ${value}${isWinner ? ' ←' : ''}
                    </span>
                    <span>${(prob * 100).toFixed(1)}%</span>
                </div>
                <div class="prob-track">
                    <div class="prob-fill ${isHigh ? 'high' : ''} ${isWinner ? 'winner' : ''}" 
                         style="width: ${prob * 100}%"></div>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    viz.innerHTML = html;
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
            document.querySelector('.button-text').textContent = 'Converged ✓';
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

async function stepOnce() {
    if (isRunning) return;
    await step();
    await updateVisualization();
}

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
    
    document.getElementById('speed').addEventListener('input', (e) => {
        document.getElementById('speedValue').textContent = `${e.target.value}ms`;
        if (isRunning) {
            pause();
            play();
        }
    });
    
    document.getElementById('inhibition').addEventListener('input', async (e) => {
        const strength = parseFloat(e.target.value) / 100;
        document.getElementById('inhibitionValue').textContent = strength.toFixed(2);
        await setInhibition(strength);
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === ' ' && !e.target.matches('input')) {
            e.preventDefault();
            togglePlayPause();
        }
    });
}

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

window.addEventListener('DOMContentLoaded', init);
