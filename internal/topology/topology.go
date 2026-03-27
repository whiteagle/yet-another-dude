// Package topology provides graph operations for network topology visualization.
package topology

import (
	"math"
)

// Node represents a device in the topology graph.
type Node struct {
	ID    string  `json:"id"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Label string  `json:"label,omitempty"`
}

// Edge represents a connection between two devices.
type Edge struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Weight int    `json:"weight,omitempty"`
}

// Graph represents the network topology.
type Graph struct {
	Nodes map[string]*Node
	Edges []Edge
}

// NewGraph creates an empty Graph.
func NewGraph() *Graph {
	return &Graph{
		Nodes: make(map[string]*Node),
	}
}

// AddNode adds a node to the graph.
func (g *Graph) AddNode(id string, x, y float64) {
	g.Nodes[id] = &Node{ID: id, X: x, Y: y}
}

// AddEdge adds an edge between two nodes.
func (g *Graph) AddEdge(source, target string, weight int) {
	g.Edges = append(g.Edges, Edge{Source: source, Target: target, Weight: weight})
}

// Neighbors returns the IDs of nodes adjacent to the given node.
func (g *Graph) Neighbors(id string) []string {
	var neighbors []string
	seen := make(map[string]bool)

	for _, e := range g.Edges {
		if e.Source == id && !seen[e.Target] {
			neighbors = append(neighbors, e.Target)
			seen[e.Target] = true
		}
		if e.Target == id && !seen[e.Source] {
			neighbors = append(neighbors, e.Source)
			seen[e.Source] = true
		}
	}
	return neighbors
}

// ShortestPath finds the shortest path between two nodes using BFS.
// Returns the path as a slice of node IDs, or nil if no path exists.
func (g *Graph) ShortestPath(from, to string) []string {
	if from == to {
		return []string{from}
	}

	if _, ok := g.Nodes[from]; !ok {
		return nil
	}
	if _, ok := g.Nodes[to]; !ok {
		return nil
	}

	visited := make(map[string]bool)
	parent := make(map[string]string)
	queue := []string{from}
	visited[from] = true

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		for _, neighbor := range g.Neighbors(current) {
			if visited[neighbor] {
				continue
			}
			visited[neighbor] = true
			parent[neighbor] = current

			if neighbor == to {
				return reconstructPath(parent, from, to)
			}
			queue = append(queue, neighbor)
		}
	}

	return nil // No path found
}

// reconstructPath builds the path from parent map.
func reconstructPath(parent map[string]string, from, to string) []string {
	var path []string
	current := to
	for current != from {
		path = append([]string{current}, path...)
		current = parent[current]
	}
	path = append([]string{from}, path...)
	return path
}

// AutoLayout assigns positions to nodes using a simple force-directed layout.
// This is a basic implementation suitable for small networks.
func AutoLayout(nodes []Node, edges []Edge, width, height float64) []Node {
	if len(nodes) == 0 {
		return nodes
	}

	// Initialize positions in a circle
	cx, cy := width/2, height/2
	radius := math.Min(width, height) * 0.35
	for i := range nodes {
		angle := 2 * math.Pi * float64(i) / float64(len(nodes))
		nodes[i].X = cx + radius*math.Cos(angle)
		nodes[i].Y = cy + radius*math.Sin(angle)
	}

	// Simple force-directed iterations
	const iterations = 100
	const repulsion = 5000.0
	const attraction = 0.01
	const damping = 0.9

	nodeMap := make(map[string]int)
	for i, n := range nodes {
		nodeMap[n.ID] = i
	}

	vx := make([]float64, len(nodes))
	vy := make([]float64, len(nodes))

	for iter := range iterations {
		_ = iter

		// Repulsive forces between all pairs
		for i := range nodes {
			for j := i + 1; j < len(nodes); j++ {
				dx := nodes[i].X - nodes[j].X
				dy := nodes[i].Y - nodes[j].Y
				dist := math.Max(math.Sqrt(dx*dx+dy*dy), 1)
				force := repulsion / (dist * dist)

				fx := force * dx / dist
				fy := force * dy / dist

				vx[i] += fx
				vy[i] += fy
				vx[j] -= fx
				vy[j] -= fy
			}
		}

		// Attractive forces along edges
		for _, e := range edges {
			si, ok1 := nodeMap[e.Source]
			ti, ok2 := nodeMap[e.Target]
			if !ok1 || !ok2 {
				continue
			}

			dx := nodes[si].X - nodes[ti].X
			dy := nodes[si].Y - nodes[ti].Y
			dist := math.Max(math.Sqrt(dx*dx+dy*dy), 1)
			force := attraction * dist

			fx := force * dx / dist
			fy := force * dy / dist

			vx[si] -= fx
			vy[si] -= fy
			vx[ti] += fx
			vy[ti] += fy
		}

		// Apply velocities with damping
		for i := range nodes {
			vx[i] *= damping
			vy[i] *= damping
			nodes[i].X += vx[i]
			nodes[i].Y += vy[i]

			// Keep within bounds
			nodes[i].X = math.Max(50, math.Min(width-50, nodes[i].X))
			nodes[i].Y = math.Max(50, math.Min(height-50, nodes[i].Y))
		}
	}

	return nodes
}
