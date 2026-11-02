// Daily Plate launcher: starts the desktop app with a double-click.
package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"unsafe"
)

const projectDir = `C:\Users\proan\Downloads\project\gym and nutrotious tracker`

func candidates() []string {
	var list []string
	if self, err := os.Executable(); err == nil {
		dir := filepath.Dir(self)
		list = append(list,
			filepath.Join(dir, "release", "Daily Plate", "Daily Plate.exe"),
			filepath.Join(dir, "Daily Plate", "Daily Plate.exe"),
		)
	}
	return append(list, filepath.Join(projectDir, "release", "Daily Plate", "Daily Plate.exe"))
}

func message(text string) {
	user32 := syscall.NewLazyDLL("user32.dll")
	box := user32.NewProc("MessageBoxW")
	t, _ := syscall.UTF16PtrFromString(text)
	c, _ := syscall.UTF16PtrFromString("Daily Plate")
	box.Call(0, uintptr(unsafe.Pointer(t)), uintptr(unsafe.Pointer(c)), 0x10)
}

func main() {
	for _, app := range candidates() {
		if info, err := os.Stat(app); err == nil && !info.IsDir() {
			cmd := exec.Command(app)
			cmd.Dir = filepath.Dir(app)
			if err := cmd.Start(); err != nil {
				message("Daily Plate could not start:\n" + err.Error())
			}
			return
		}
	}
	message("Daily Plate was not found.\n\nExpected it at:\n" + filepath.Join(projectDir, "release", "Daily Plate", "Daily Plate.exe"))
}
