package topology

import (
	"testing"
)

func TestGraphNeighbors(t *testing.T) {
	g := NewGraph()
	g.AddNode("a", 0, 0)
	g.AddNode("b", 1, 0)
	g.AddNode("c", 2, 0)
	g.AddNode("d", 3, 0)
	g.AddEdge("a", "b", 1)
	g.AddEdge("b", "c", 1)
	g.AddEdge("a", "d", 1)

	tests := []struct {
		name string
		node string
		want int
	}{
		{"a has 2 neighbors", "a", 2},
		{"b has 2 neighbors", "b", 2},
		{"c has 1 neighbor", "c", 1},
		{"d has 1 neighbor", "d", 1},
		{"unknown has 0 neighbors", "x", 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := g.Neighbors(tt.node)
			if len(got) != tt.want {
				t.Errorf("Neighbors(%q) returned %d nodes, want %d", tt.node, len(got), tt.want)
			}
		})
	}
}

func TestShortestPath(t *testing.T) {
	g := NewGraph()
	g.AddNode("a", 0, 0)
	g.AddNode("b", 1, 0)
	g.AddNode("c", 2, 0)
	g.AddNode("d", 3, 0)
	g.AddNode("e", 4, 0)
	g.AddEdge("a", "b", 1)
	g.AddEdge("b", "c", 1)
	g.AddEdge("c", "d", 1)
	g.AddEdge("a", "d", 1) // shortcut

	tests := []struct {
		name     string
		from     string
		to       string
		wantLen  int
		wantNil  bool
	}{
		{"same node", "a", "a", 1, false},
		{"direct neighbor", "a", "b", 2, false},
		{"shortcut a->d", "a", "d", 2, false},
		{"reverse d->a", "d", "a", 2, false},
		{"isolated node", "a", "e", 0, true},
		{"unknown source", "x", "a", 0, true},
		{"unknown target", "a", "x", 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			path := g.ShortestPath(tt.from, tt.to)
			if tt.wantNil {
				if path != nil {
					t.Errorf("ShortestPath(%q, %q) = %v, want nil", tt.from, tt.to, path)
				}
				return
			}
			if path == nil {
				t.Fatalf("ShortestPath(%q, %q) = nil, want path of length %d", tt.from, tt.to, tt.wantLen)
			}
			if len(path) != tt.wantLen {
				t.Errorf("ShortestPath(%q, %q) length = %d, want %d (path: %v)", tt.from, tt.to, len(path), tt.wantLen, path)
			}
			if path[0] != tt.from {
				t.Errorf("path starts with %q, want %q", path[0], tt.from)
			}
			if path[len(path)-1] != tt.to {
				t.Errorf("path ends with %q, want %q", path[len(path)-1], tt.to)
			}
		})
	}
}

func TestAutoLayout(t *testing.T) {
	nodes := []Node{
		{ID: "a"},
		{ID: "b"},
		{ID: "c"},
	}
	edges := []Edge{
		{Source: "a", Target: "b"},
		{Source: "b", Target: "c"},
	}

	result := AutoLayout(nodes, edges, 800, 600)

	if len(result) != 3 {
		t.Fatalf("AutoLayout returned %d nodes, want 3", len(result))
	}

	// All nodes should be within bounds
	for _, n := range result {
		if n.X < 50 || n.X > 750 || n.Y < 50 || n.Y > 550 {
			t.Errorf("node %s out of bounds: (%v, %v)", n.ID, n.X, n.Y)
		}
	}

	// No two nodes should be at the exact same position
	for i := range result {
		for j := i + 1; j < len(result); j++ {
			if result[i].X == result[j].X && result[i].Y == result[j].Y {
				t.Errorf("nodes %s and %s overlap at (%v, %v)", result[i].ID, result[j].ID, result[i].X, result[i].Y)
			}
		}
	}
}

func TestAutoLayoutEmpty(t *testing.T) {
	result := AutoLayout(nil, nil, 800, 600)
	if len(result) != 0 {
		t.Errorf("AutoLayout(nil) returned %d nodes, want 0", len(result))
	}
}
