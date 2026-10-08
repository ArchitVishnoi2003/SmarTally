//go:build !windows

package main

import "fmt"

func main() {
	fmt.Println("Tally Sync Agent runs on Windows only.")
}
