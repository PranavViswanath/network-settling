# Network Settling Visualizer

An interactive visualization tool demonstrating **parallel constraint satisfaction** through network settling-a connectionist approach from cognitive science.

![Network Settling Demo](https://img.shields.io/badge/Python-In%20Browser-blue?logo=python) ![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-success?logo=github)

## 🧠 What is Network Settling?

This tool demonstrates how the brain might solve constraint satisfaction problems (like Sudoku) using **connectionist principles** rather than algorithmic search:

- **Units**: Each possible cell-value assignment has an activation level (probability)
- **Constraints**: Inhibitory connections between conflicting assignments
- **Settling**: Activations update iteratively through parallel relaxation
- **Clues**: Input values are clamped (fixed at probability 1)

This approach models human problem-solving through parallel activation, inhibition, and relaxation-similar to Hopfield networks and parallel distributed processing.

## ✨ Features

- 🐍 **Python Logic in Browser**: Real Python code running via Pyodide
- 🎨 **Beautiful Modern UI**: Clean, responsive design with smooth animations
- 📊 **Real-time Visualization**: Watch probabilities settle with heatmaps
- 🎮 **Interactive Controls**: Adjust speed, inhibition strength, and more
- 📈 **Detailed Analytics**: See probability distributions for each cell
- 🎯 **Multiple Grid Sizes**: Support for 4×4, 6×6, and 9×9 grids
- 💡 **Example Puzzles**: Pre-loaded examples to get started quickly

## 🚀 Quick Start

### Option 1: View Online (GitHub Pages)

1. Deploy to GitHub Pages (see deployment instructions below)
2. Visit your GitHub Pages URL
3. Wait for Python runtime to load (~10 seconds)
4. Start exploring!

### Option 2: Run Locally

1. Clone this repository:
```bash
git clone <your-repo-url>
cd network-settling
```

2. Serve the files with a local web server:
```bash
# Using Python
python -m http.server 8000

# Or using Node.js
npx serve

# Or using PHP
php -S localhost:8000
```

3. Open `http://localhost:8000` in your browser

**Note**: You must use a web server (not just opening `index.html` directly) because Pyodide requires proper CORS headers.

## 📖 How to Use

1. **Enter Clues**: Click any cell and enter a value (1-4 for 4×4 grid)
2. **Start Settling**: Click "Start Settling" to watch the network solve
3. **Observe**: Watch probabilities propagate through constraints
4. **Explore**: Click cells to see detailed probability distributions
5. **Adjust**: Change inhibition strength and animation speed
6. **Experiment**: Try different grid sizes and examples

### Understanding the Visualization

- **Color Intensity**: Darker blue = higher probability
- **Yellow Border**: Clamped input clues (fixed values)
- **Numbers**: Current most likely value for each cell
- **Percentages**: Confidence level (if enabled)

## 🎓 The Science Behind It

### Connectionist Principles

This tool implements key concepts from cognitive science:

1. **Parallel Processing**: All cells update simultaneously, not sequentially
2. **Inhibitory Connections**: Conflicting values reduce each other's activation
3. **Constraint Satisfaction**: Rules encoded as relationships, not explicit checks
4. **Graded Activation**: Probabilities model confidence/belief strength
5. **Relaxation**: System settles into stable state satisfying constraints

### The Algorithm

```python
# For each cell (in parallel):
for each possible value:
    # Hard constraints: impossible values get 0 probability
    if value_clamped_elsewhere_in_row_or_col:
        probability = 0
    else:
        # Soft constraints: inhibition from competing cells
        inhibition = average_probability_of_value_in_row_and_col
        probability *= (1 - inhibition * strength)
    
# Normalize probabilities to sum to 1
probabilities = normalize(probabilities)

# Repeat until convergence (no more changes)
```

### Why This Matters

- **Neural Plausibility**: Models how brains might solve problems
- **Parallel vs Sequential**: Contrast with traditional backtracking algorithms
- **Emergent Behavior**: Solution emerges from local interactions
- **Cognitive Modeling**: Demonstrates distributed representation and processing

## 🛠️ Technical Details

### Architecture

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend Logic**: Python 3.11 (via Pyodide)
- **Runtime**: Pyodide (Python compiled to WebAssembly)
- **Deployment**: Static site (GitHub Pages compatible)

### File Structure

```
network-settling/
├── index.html              # Main HTML structure
├── styles.css              # Beautiful modern styling
├── app.js                  # Frontend logic & Pyodide integration
├── network_settling.py     # Python network settling algorithm
└── README.md              # This file
```

### Browser Compatibility

- Chrome/Edge: ✅ Fully supported
- Firefox: ✅ Fully supported
- Safari: ✅ Fully supported (14+)
- Mobile: ✅ Responsive design

## 📦 Deployment to GitHub Pages

### Step 1: Create Repository

```bash
git init
git add .
git commit -m "Initial commit: Network Settling Visualizer"
```

### Step 2: Push to GitHub

```bash
# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/network-settling.git
git branch -M main
git push -u origin main
```

### Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under "Source", select **main** branch
4. Click **Save**
5. Your site will be live at: `https://YOUR_USERNAME.github.io/network-settling/`

**Note**: First load may take 10-15 seconds as Pyodide downloads (~10MB). Subsequent loads are cached.

## 🎨 Customization

### Change Grid Sizes

Edit the `<select id="gridSize">` in `index.html`:

```html
<select id="gridSize" class="control-input">
    <option value="4">4×4</option>
    <option value="6">6×6</option>
    <option value="9">9×9</option>
    <option value="16">16×16</option> <!-- Add custom sizes -->
</select>
```

### Adjust Algorithm Parameters

In `network_settling.py`:

```python
self.convergence_threshold = 0.001  # Lower = more precise
self.inhibition_strength = 0.5      # 0-1, higher = stronger inhibition
```

### Modify Colors

In `styles.css`, update CSS variables:

```css
:root {
    --primary-color: #2196F3;    /* Main theme color */
    --accent-color: #4CAF50;     /* Success/converged color */
    --secondary-color: #FF9800;  /* Warning/paused color */
}
```

## 🐛 Troubleshooting

### "Loading Python runtime..." never finishes

- **Cause**: Network issues or CORS problems
- **Solution**: Ensure you're using a web server (not `file://`)
- **Check**: Open browser console for error messages

### Grid doesn't update when clicking cells

- **Cause**: Pyodide not fully loaded
- **Solution**: Wait for "Ready" status before interacting

### Slow performance on large grids

- **Cause**: 9×9 grids have 81 cells × 9 values = 729 units
- **Solution**: Use smaller grids or reduce animation speed

## 🤝 Contributing

Contributions welcome! Ideas:

- Add support for Sudoku 3×3 box constraints
- Implement different constraint types
- Add visualization of inhibitory connections
- Export/import puzzle configurations
- Performance optimizations for larger grids

## 📚 References

- **Hopfield Networks**: Hopfield, J.J. (1982). Neural networks and physical systems with emergent collective computational abilities.
- **Parallel Distributed Processing**: Rumelhart, D.E., & McClelland, J.L. (1986). PDP: Explorations in the microstructure of cognition.
- **Constraint Satisfaction**: Kumar, V. (1992). Algorithms for constraint-satisfaction problems.

## 📄 License

MIT License - feel free to use this for educational purposes, presentations, or research!

## 🙏 Acknowledgments

Built to demonstrate connectionist principles from cognitive science lectures on constraint satisfaction and neural networks.

---

**Made with 🧠 and ❤️ for cognitive science education**

*Demonstrating how brains might solve puzzles through parallel activation and inhibition*

