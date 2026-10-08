//go:build windows

package main

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/getlantern/systray"
	"github.com/wholesale-tally/agent/cloud"
	"github.com/wholesale-tally/agent/config"
	"github.com/wholesale-tally/agent/sync"
)

var (
	tallyUp   = false
	pending   = 0
	lastError = ""
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		runSetupWizard()
		cfg, err = config.Load()
		if err != nil {
			log.Fatal("Setup failed:", err)
		}
	}

	if cfg.CloudAPIURL == "" {
		cfg.CloudAPIURL = config.DefaultCloudURL()
		_ = config.Save(cfg)
	}

	go runLoops(cfg)

	systray.Run(onReady, onExit)
}

func onReady() {
	systray.SetTitle("Tally Sync")
	systray.SetTooltip("Wholesale Tally Sync Agent")
	updateIcon()

	mShow := systray.AddMenuItem("Status", "Current sync status")
	mShow.Disable()
	go func() {
		for {
			time.Sleep(2 * time.Second)
			status := fmt.Sprintf("Tally: %s | Pending: %d", tallyStatus(), pending)
			if lastError != "" {
				status += " | Error: " + lastError
			}
			mShow.SetTitle(status)
			updateIcon()
		}
	}()

	systray.AddSeparator()
	mQuit := systray.AddMenuItem("Quit", "Exit agent")
	go func() {
		<-mQuit.ClickedCh
		systray.Quit()
	}()
}

func onExit() {}

func tallyStatus() string {
	if tallyUp {
		return "Online"
	}
	return "Offline"
}

func updateIcon() {
	if lastError != "" {
		systray.SetTooltip("Tally Sync — Error")
	} else if pending > 0 {
		systray.SetTooltip(fmt.Sprintf("Tally Sync — %d pending", pending))
	} else if tallyUp {
		systray.SetTooltip("Tally Sync — All synced")
	} else {
		systray.SetTooltip("Tally Sync — Tally offline")
	}
}

func runLoops(cfg *config.Config) {
	worker := sync.NewWorker(cfg, func(up bool, p int, err string) {
		tallyUp = up
		pending = p
		lastError = err
	})

	pollTicker := time.NewTicker(10 * time.Second)
	hbTicker := time.NewTicker(60 * time.Second)

	for {
		select {
		case <-pollTicker.C:
			worker.RunOnce()
		case <-hbTicker.C:
			// heartbeat handled inside RunOnce
		}
	}
}

func runSetupWizard() {
	fmt.Println("=== Wholesale Tally Sync Agent — Setup ===")
	fmt.Println()

	baseURL := config.DefaultCloudURL()
	fmt.Printf("Cloud API URL [%s]: ", baseURL)
	reader := bufio.NewReader(os.Stdin)
	line, _ := reader.ReadString('\n')
	line = strings.TrimSpace(line)
	if line != "" {
		baseURL = strings.TrimRight(line, "/")
	}

	fmt.Print("Enter 6-digit pairing code from your phone app: ")
	codeLine, _ := reader.ReadString('\n')
	code := strings.TrimSpace(codeLine)

	fmt.Print("Tally company name (exactly as shown in Tally): ")
	companyLine, _ := reader.ReadString('\n')
	company := strings.TrimSpace(companyLine)
	if company == "" {
		log.Fatal("Tally company name is required (copy it exactly from the Tally title bar)")
	}

	result, err := cloud.PairAgent(baseURL, code, company)
	if err != nil {
		log.Fatal("Pairing failed:", err)
	}

	cfg := &config.Config{
		DeviceToken:      result.DeviceToken,
		UserID:           result.UserID,
		DeviceID:         result.DeviceID,
		TallyCompanyName: company,
		CloudAPIURL:      baseURL,
	}

	if err := config.Save(cfg); err != nil {
		log.Fatal("Could not save config:", err)
	}

	fmt.Println("Paired successfully! Starting agent...")
}
