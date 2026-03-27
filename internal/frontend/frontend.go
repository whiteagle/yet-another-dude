// Package frontend embeds the compiled React frontend assets.
package frontend

import (
	"embed"
	"io/fs"
)

//go:embed dist
var dist embed.FS

// FS returns the embedded frontend filesystem rooted at the dist directory.
func FS() (fs.FS, error) {
	return fs.Sub(dist, "dist")
}
