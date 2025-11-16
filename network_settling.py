"""
Network Settling Algorithm
Implements parallel constraint satisfaction using connectionist principles
Based on cognitive science lecture on connections and constraint satisfaction
"""

import json
from typing import List, Dict, Tuple, Set


class NetworkSettling:
    """
    Represents a constraint satisfaction network that settles through
    parallel activation updates with inhibitory connections.
    """
    
    def __init__(self, grid_size: int):
        """
        Initialize the network with a given grid size.
        
        Args:
            grid_size: Size of the grid (e.g., 4 for 4x4)
        """
        self.grid_size = grid_size
        self.probabilities: Dict[Tuple[int, int], List[float]] = {}
        self.clamped: Set[Tuple[int, int]] = set()
        self.iteration = 0
        self.convergence_threshold = 0.001
        self.inhibition_strength = 0.5  # 0 to 1
        self.is_converged = False
        
        self.initialize()
    
    def initialize(self):
        """Initialize probability distributions for all cells."""
        uniform_prob = 1.0 / self.grid_size
        
        for row in range(self.grid_size):
            for col in range(self.grid_size):
                # Initialize with uniform distribution
                self.probabilities[(row, col)] = [uniform_prob] * self.grid_size
        
        self.iteration = 0
        self.is_converged = False
    
    def set_clue(self, row: int, col: int, value: int):
        """
        Set a cell as a clue (clamped value).
        
        Args:
            row: Row index (0-indexed)
            col: Column index (0-indexed)
            value: Value to clamp (1-indexed, e.g., 1-4 for 4x4 grid)
        """
        probs = [0.0] * self.grid_size
        probs[value - 1] = 1.0  # value is 1-indexed, array is 0-indexed
        self.probabilities[(row, col)] = probs
        self.clamped.add((row, col))
    
    def remove_clue(self, row: int, col: int):
        """Remove a clue from a cell."""
        self.clamped.discard((row, col))
        uniform_prob = 1.0 / self.grid_size
        self.probabilities[(row, col)] = [uniform_prob] * self.grid_size
    
    def is_clamped(self, row: int, col: int) -> bool:
        """Check if a cell is clamped."""
        return (row, col) in self.clamped
    
    def get_most_likely_value(self, row: int, col: int) -> Dict:
        """
        Get the current most likely value for a cell.
        
        Returns:
            Dict with 'value' (1-indexed) and 'probability'
        """
        probs = self.probabilities[(row, col)]
        max_prob = max(probs)
        max_index = probs.index(max_prob)
        return {
            'value': max_index + 1,  # Convert to 1-indexed
            'probability': max_prob
        }
    
    def get_probabilities(self, row: int, col: int) -> List[float]:
        """Get probability distribution for a cell."""
        return self.probabilities[(row, col)].copy()
    
    def step(self) -> float:
        """
        Perform one iteration of network settling.
        
        Returns:
            Maximum change in probabilities across all cells
        """
        if self.is_converged:
            return 0.0
        
        new_probabilities = {}
        max_change = 0.0
        
        # For each cell
        for row in range(self.grid_size):
            for col in range(self.grid_size):
                # Skip clamped cells
                if (row, col) in self.clamped:
                    new_probabilities[(row, col)] = self.probabilities[(row, col)].copy()
                    continue
                
                # Calculate new probabilities based on constraints
                new_probs = self.calculate_new_probabilities(row, col)
                new_probabilities[(row, col)] = new_probs
                
                # Track maximum change
                change = self.calculate_change(
                    self.probabilities[(row, col)], 
                    new_probs
                )
                max_change = max(max_change, change)
        
        # Update probabilities
        self.probabilities = new_probabilities
        self.iteration += 1
        
        # Check for convergence
        if max_change < self.convergence_threshold:
            self.is_converged = True
        
        return max_change
    
    def calculate_new_probabilities(self, row: int, col: int) -> List[float]:
        """
        Calculate new probabilities for a cell based on constraints.
        
        This implements the core connectionist principle:
        - Inhibitory connections reduce activation for conflicting values
        - Impossible values (clamped elsewhere) get probability 0
        - Probabilities are normalized to sum to 1
        """
        current_probs = self.probabilities[(row, col)]
        new_probs = current_probs.copy()
        
        # For each possible value
        for value_idx in range(self.grid_size):
            # Check if this value is impossible (already clamped elsewhere in row/col)
            if self.is_value_impossible(row, col, value_idx):
                new_probs[value_idx] = 0.0
                continue
            
            # Calculate inhibition from conflicting cells
            inhibition = self.calculate_inhibition(row, col, value_idx)
            
            # Apply inhibition to reduce probability
            # Higher inhibition -> lower probability
            new_probs[value_idx] = current_probs[value_idx] * (
                1 - inhibition * self.inhibition_strength
            )
            
            # Ensure non-negative
            new_probs[value_idx] = max(0.0, new_probs[value_idx])
        
        # Normalize probabilities to sum to 1
        return self.normalize(new_probs)
    
    def is_value_impossible(self, row: int, col: int, value_idx: int) -> bool:
        """
        Check if a value is impossible for a cell (clamped elsewhere in row/col).
        
        This enforces hard constraints from external inputs.
        """
        value = value_idx + 1  # Convert to 1-indexed
        
        # Check row for clamped cells with this value
        for c in range(self.grid_size):
            if c == col:
                continue
            if (row, c) in self.clamped:
                clamped_value = self.get_most_likely_value(row, c)['value']
                if clamped_value == value:
                    return True
        
        # Check column for clamped cells with this value
        for r in range(self.grid_size):
            if r == row:
                continue
            if (r, col) in self.clamped:
                clamped_value = self.get_most_likely_value(r, col)['value']
                if clamped_value == value:
                    return True
        
        return False
    
    def calculate_inhibition(self, row: int, col: int, value_idx: int) -> float:
        """
        Calculate inhibition strength for a value in a cell.
        
        Based on how much other cells in the same row/col want this value.
        This implements the parallel constraint satisfaction through
        inhibitory connections between conflicting units.
        """
        total_inhibition = 0.0
        count = 0
        
        # Check row
        for c in range(self.grid_size):
            if c == col:
                continue
            if (row, c) not in self.clamped:
                prob = self.probabilities[(row, c)][value_idx]
                total_inhibition += prob
                count += 1
        
        # Check column
        for r in range(self.grid_size):
            if r == row:
                continue
            if (r, col) not in self.clamped:
                prob = self.probabilities[(r, col)][value_idx]
                total_inhibition += prob
                count += 1
        
        # Average inhibition (normalized)
        return total_inhibition / count if count > 0 else 0.0
    
    def normalize(self, probs: List[float]) -> List[float]:
        """Normalize probability distribution to sum to 1."""
        total = sum(probs)
        if total == 0:
            # If all probabilities are 0, distribute uniformly
            return [1.0 / self.grid_size] * self.grid_size
        return [p / total for p in probs]
    
    def calculate_change(self, old_probs: List[float], new_probs: List[float]) -> float:
        """Calculate the maximum absolute change between two probability distributions."""
        return max(abs(new - old) for old, new in zip(old_probs, new_probs))
    
    def reset(self):
        """Reset the network to initial state."""
        self.clamped.clear()
        self.initialize()
    
    def set_inhibition_strength(self, strength: float):
        """Set inhibition strength (0 to 1)."""
        self.inhibition_strength = max(0.0, min(1.0, strength))
    
    def get_state(self) -> Dict:
        """Get current state summary."""
        return {
            'iteration': self.iteration,
            'is_converged': self.is_converged,
            'grid_size': self.grid_size,
            'clamped_count': len(self.clamped)
        }
    
    def is_valid_solution(self) -> bool:
        """Check if the current solution is valid (all constraints satisfied)."""
        # Check each row
        for row in range(self.grid_size):
            values = set()
            for col in range(self.grid_size):
                result = self.get_most_likely_value(row, col)
                if result['probability'] < 0.9:
                    return False  # Not confident enough
                if result['value'] in values:
                    return False  # Duplicate in row
                values.add(result['value'])
        
        # Check each column
        for col in range(self.grid_size):
            values = set()
            for row in range(self.grid_size):
                result = self.get_most_likely_value(row, col)
                if result['value'] in values:
                    return False  # Duplicate in column
                values.add(result['value'])
        
        return True
    
    def get_grid(self) -> List[List[int]]:
        """Get grid as 2D array of most likely values."""
        grid = []
        for row in range(self.grid_size):
            row_values = []
            for col in range(self.grid_size):
                value = self.get_most_likely_value(row, col)['value']
                row_values.append(value)
            grid.append(row_values)
        return grid
    
    def to_json(self) -> str:
        """Export current state as JSON for frontend."""
        state = {
            'grid_size': self.grid_size,
            'iteration': self.iteration,
            'is_converged': self.is_converged,
            'probabilities': {},
            'clamped': list(self.clamped),
            'grid': self.get_grid()
        }
        
        # Convert tuple keys to strings for JSON
        for (row, col), probs in self.probabilities.items():
            state['probabilities'][f"{row},{col}"] = probs
        
        return json.dumps(state)


# API functions for JavaScript to call via Pyodide
_network = None


def create_network(grid_size):
    """Create a new network."""
    global _network
    _network = NetworkSettling(grid_size)
    return _network.to_json()


def set_clue(row, col, value):
    """Set a clue in the network."""
    global _network
    if _network is None:
        return json.dumps({'error': 'Network not initialized'})
    _network.set_clue(row, col, value)
    return _network.to_json()


def remove_clue(row, col):
    """Remove a clue from the network."""
    global _network
    if _network is None:
        return json.dumps({'error': 'Network not initialized'})
    _network.remove_clue(row, col)
    return _network.to_json()


def step():
    """Perform one step of settling."""
    global _network
    if _network is None:
        return json.dumps({'error': 'Network not initialized'})
    max_change = _network.step()
    result = json.loads(_network.to_json())
    result['max_change'] = max_change
    return json.dumps(result)


def reset():
    """Reset the network."""
    global _network
    if _network is None:
        return json.dumps({'error': 'Network not initialized'})
    _network.reset()
    return _network.to_json()


def set_inhibition(strength):
    """Set inhibition strength."""
    global _network
    if _network is None:
        return json.dumps({'error': 'Network not initialized'})
    _network.set_inhibition_strength(strength)
    return _network.to_json()


def get_state():
    """Get current state."""
    global _network
    if _network is None:
        return json.dumps({'error': 'Network not initialized'})
    return _network.to_json()

