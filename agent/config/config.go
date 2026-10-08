package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	DeviceToken      string `json:"device_token"`
	UserID           string `json:"user_id"`
	DeviceID         string `json:"device_id"`
	TallyCompanyName string `json:"tally_company_name"`
	CloudAPIURL      string `json:"cloud_api_url"`
}

func ConfigDir() string {
	appData := os.Getenv("APPDATA")
	if appData == "" {
		appData = "."
	}
	return filepath.Join(appData, "WholesaleTally")
}

func ConfigPath() string {
	return filepath.Join(ConfigDir(), "config.json")
}

func Load() (*Config, error) {
	path := ConfigPath()
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func Save(cfg *Config) error {
	dir := ConfigDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(ConfigPath(), data, 0600)
}

func DefaultCloudURL() string {
	if u := os.Getenv("WHOLESALE_API_URL"); u != "" {
		return strings.TrimRight(u, "/")
	}
	if u := os.Getenv("WHOLESALE_CLOUD_URL"); u != "" {
		return strings.TrimRight(u, "/")
	}
	return "https://tally-amber.vercel.app/api"
}
