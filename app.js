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
        
        // Auto-select first non-clamped cell
        await selectFirstUnclampedCell();
        
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
                // Check if this value would create a conflict
                const isValid = await checkIfValidClue(row, col, num);
                if (!isValid) {
                    showValidationWarning(row, col, num);
                    return;
                }
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

// Check if a clue would be valid
async function checkIfValidClue(row, col, value) {
    const state = await getState();
    
    // Check row for conflicts
    for (let c = 0; c < gridSize; c++) {
        if (c === col) continue;
        const isClamped = state.clamped.some(([r, c_]) => r === row && c_ === c);
        if (isClamped) {
            const cellValue = state.grid[row][c];
            if (cellValue === value) {
                return false; // Conflict in row
            }
        }
    }
    
    // Check column for conflicts
    for (let r = 0; r < gridSize; r++) {
        if (r === row) continue;
        const isClamped = state.clamped.some(([r_, c]) => r_ === r && c === col);
        if (isClamped) {
            const cellValue = state.grid[r][col];
            if (cellValue === value) {
                return false; // Conflict in column
            }
        }
    }
    
    return true; // No conflicts
}

// Show validation warning
function showValidationWarning(row, col, value) {
    const statusDiv = document.getElementById('networkStatus');
    if (!statusDiv) return;
    
    const originalMessage = statusDiv.textContent;
    const originalClass = statusDiv.className;
    
    statusDiv.textContent = `⚠️ Invalid! Value ${value} already exists in row ${row} or column ${col}. Choose a different value.`;
    statusDiv.className = 'network-status warning';
    
    // Reset after 4 seconds
    setTimeout(() => {
        statusDiv.textContent = originalMessage;
        statusDiv.className = originalClass;
    }, 4000);
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
            
            await updateCell(cell, probs, isClamped, state);
        }
    }
    
    // Update stats
    document.getElementById('iteration').textContent = state.iteration;
    if (state.max_change !== undefined) {
        document.getElementById('delta').textContent = state.max_change.toFixed(4);
    }
    
    // Update network status
    updateNetworkStatus(state);
    
    // Update probability panel if watching a cell
    if (watchedCell) {
        updateProbabilityPanel(state);
    }
}

// Update single cell
async function updateCell(cell, probs, isClamped, state) {
    const maxProb = Math.max(...probs);
    const maxIndex = probs.indexOf(maxProb);
    const value = maxIndex + 1;
    
    const hasStarted = state && state.iteration > 0;
    
    const valueSpan = cell.querySelector('.cell-value');
    if (valueSpan) {
        // Only show value if clamped OR if network has started settling
        if (isClamped) {
            valueSpan.textContent = value;
        } else if (hasStarted || isRunning) {
            valueSpan.textContent = value;
        } else {
            valueSpan.textContent = ''; // Blank until settling starts
        }
    }
    
    const probSpan = cell.querySelector('.cell-probability');
    if (probSpan) {
        if (!isClamped && maxProb < 0.99 && (isRunning || hasStarted)) {
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
        
        // Subtle background based on confidence (only when settling)
        if (hasStarted || isRunning) {
            const gray = 250 - Math.floor(maxProb * 15);
            cell.style.background = `rgb(${gray}, ${gray}, ${gray})`;
        } else {
            cell.style.background = ''; // Clear background when not settling
        }
    }
    
    // Add settling animation
    if (isRunning) {
        cell.classList.add('settling');
        setTimeout(() => cell.classList.remove('settling'), 500);
    }
}

// Auto-select first unclamped cell on load
async function selectFirstUnclampedCell() {
    const state = await getState();
    
    // Find first non-clamped cell
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const isClamped = state.clamped.some(([r, c]) => r === row && c === col);
            if (!isClamped) {
                watchedCell = { row, col };
                const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                if (cell) {
                    cell.classList.add('selected');
                    selectedCell = cell;
                }
                updateProbabilityPanel(state);
                return;
            }
        }
    }
}

// Update network status with dynamic explanation
function updateNetworkStatus(state) {
    const statusDiv = document.getElementById('networkStatus');
    if (!statusDiv) return;
    
    let message = '';
    let statusClass = 'network-status';
    
    if (isRunning) {
        // Check if entire grid has converged (not just one cell)
        const gridConverged = state.is_converged || state.max_change < 0.001;
        
        if (gridConverged) {
            // Entire grid converged - flash green!
            message = `🎉 Grid Converged! Solution found after ${state.iteration} iterations.`;
            statusClass = 'network-status converged';
        } else {
            // Still settling - auto-switch to uncertain cells
            if (watchedCell) {
                const key = `${watchedCell.row},${watchedCell.col}`;
                const probs = state.probabilities[key];
                const maxProb = Math.max(...probs);
                
                // If watched cell is confident, find another uncertain one
                if (maxProb > 0.95) {
                    const switched = findNextUncertainCell(state);
                    if (switched) {
                        // Flash green briefly for this cell, then back to blue
                        message = `Cell (${watchedCell.row}, ${watchedCell.col}) settled! Moving to next uncertain cell...`;
                        statusClass = 'network-status cell-converged';
                        
                        // Reset to blue after brief flash
                        setTimeout(() => {
                            if (isRunning && !state.is_converged) {
                                statusDiv.className = 'network-status active';
                            }
                        }, 800);
                    }
                }
            }
            
            // Default active messages if no cell just converged
            if (!message) {
                if (state.iteration === 0) {
                    message = 'Starting network settling... Each cell-value pair is a unit with activation.';
                    statusClass = 'network-status active';
                } else if (state.iteration < 5) {
                    message = `Iteration ${state.iteration}: Units are sending inhibitory signals to conflicting values in same row/column.`;
                    statusClass = 'network-status active';
                } else if (state.max_change > 0.01) {
                    message = `Iteration ${state.iteration}: Probabilities adjusting as conflicts resolve. High-confidence values suppress alternatives.`;
                    statusClass = 'network-status active';
                } else if (state.max_change > 0.001) {
                    message = `Iteration ${state.iteration}: Network stabilizing... Changes getting smaller as solution emerges.`;
                    statusClass = 'network-status active stabilizing';
                } else {
                    message = `Iteration ${state.iteration}: Fine-tuning final probabilities...`;
                    statusClass = 'network-status active stabilizing';
                }
            }
        }
    } else if (state.iteration === 0) {
        message = '👆 Try entering different values in the grid. When ready, press "Watch it settle" to see the network solve it.';
        statusClass = 'network-status';
    } else if (state.is_converged || state.max_change < 0.001) {
        message = `✓ Grid Converged! Network found stable solution after ${state.iteration} iterations.`;
        statusClass = 'network-status converged';
    } else {
        message = `Paused at iteration ${state.iteration}. Network still settling...`;
        statusClass = 'network-status';
    }
    
    statusDiv.textContent = message;
    statusDiv.className = statusClass;
}

// Find next uncertain cell to watch
function findNextUncertainCell(state) {
    let mostUncertain = null;
    let lowestConfidence = 1.0;
    
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const isClamped = state.clamped.some(([r, c]) => r === row && c === col);
            if (!isClamped) {
                const key = `${row},${col}`;
                const probs = state.probabilities[key];
                const maxProb = Math.max(...probs);
                
                if (maxProb < lowestConfidence) {
                    lowestConfidence = maxProb;
                    mostUncertain = { row, col };
                }
            }
        }
    }
    
    if (mostUncertain && lowestConfidence < 0.95) {
        // Switch to watching this cell
        if (selectedCell) {
            selectedCell.classList.remove('selected');
        }
        
        watchedCell = mostUncertain;
        const cell = document.querySelector(`[data-row="${mostUncertain.row}"][data-col="${mostUncertain.col}"]`);
        if (cell) {
            cell.classList.add('selected');
            selectedCell = cell;
        }
        return true; // Switched to new cell
    }
    return false; // No uncertain cells left
}

// Update probability panel - shows live distribution
function updateProbabilityPanel(state) {
    if (!watchedCell) return;
    
    const viz = document.getElementById('probabilityViz');
    const key = `${watchedCell.row},${watchedCell.col}`;
    const probs = state.probabilities[key];
    const isClamped = state.clamped.some(([r, c]) => r === watchedCell.row && c === watchedCell.col);
    
    const maxProb = Math.max(...probs);
    const hasStarted = state.iteration > 0;
    
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
        
        // Show all probabilities as equal if not started, unless clamped
        const displayProb = (!hasStarted && !isClamped) ? 25.0 : prob * 100;
        
        html += `
            <div class="prob-bar ${isRunning ? 'updating' : ''}">
                <div class="prob-label">
                    <span class="value-name ${isWinner && hasStarted ? 'winner' : ''}">
                        value ${value}${isWinner && hasStarted ? ' ←' : ''}
                    </span>
                    <span>${displayProb.toFixed(1)}%</span>
                </div>
                <div class="prob-track">
                    <div class="prob-fill ${isHigh && hasStarted ? 'high' : ''} ${isWinner && hasStarted ? 'winner' : ''}" 
                         style="width: ${displayProb}%"></div>
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
        
        if (state.is_converged || state.max_change < 0.001) {
            pause();
            document.querySelector('.button-text').textContent = '🎉 Grid Converged!';
            
            // Flash green celebration
            const playButton = document.getElementById('playPause');
            playButton.classList.add('converged');
            setTimeout(() => playButton.classList.remove('converged'), 2000);
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
    
    // Reset network status
    const statusDiv = document.getElementById('networkStatus');
    if (statusDiv) {
        statusDiv.textContent = '👆 Try entering different values in the grid. When ready, press "Watch it settle" to see the network solve it.';
        statusDiv.className = 'network-status';
    }
    
    // Auto-select first unclamped cell
    await selectFirstUnclampedCell();
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
