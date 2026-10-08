package cloud

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type API struct {
	BaseURL     string
	DeviceToken string
	client      *http.Client
}

func New(baseURL, deviceToken string) *API {
	return &API{
		BaseURL:     baseURL,
		DeviceToken: deviceToken,
		client:      &http.Client{Timeout: 30 * time.Second},
	}
}

func (a *API) agentAuth() string {
	return "Agent " + a.DeviceToken
}

type QueueItem struct {
	QueueID          string   `json:"queue_id"`
	InvoiceID        string   `json:"invoice_id"` // Firestore invoice doc id
	SequenceNumber   int      `json:"sequence_number"`
	VoucherType      string   `json:"voucher_type"`
	TallyXMLPayload  string   `json:"tally_xml_payload"`
	PartyName        string   `json:"party_name"`
	LineItemNames    []string `json:"line_item_names"`
	Status           string   `json:"status"`
}

type PendingResponse struct {
	Success bool        `json:"success"`
	Items   []QueueItem `json:"items"`
}

func (a *API) GetPendingQueue() ([]QueueItem, error) {
	url := a.BaseURL + "/getPendingQueue"
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", a.agentAuth())

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("getPendingQueue: %s", string(body))
	}

	var result PendingResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return result.Items, nil
}

func (a *API) MarkInFlight(queueID string) error {
	return a.postJSON("/markInFlight", map[string]string{"queue_id": queueID})
}

func (a *API) MarkSynced(queueID, invoiceID, tallyVoucherID, status, errMsg string) error {
	return a.postJSON("/markSynced", map[string]interface{}{
		"queue_id":         queueID,
		"invoice_id":       invoiceID,
		"tally_voucher_id": tallyVoucherID,
		"status":           status,
		"error_message":    errMsg,
	})
}

func (a *API) Heartbeat(tallyStatus string, pendingCount int) error {
	return a.postJSON("/agentHeartbeat", map[string]interface{}{
		"tally_status":   tallyStatus,
		"pending_count":  pendingCount,
	})
}

type PairResponse struct {
	Success     bool   `json:"success"`
	DeviceToken string `json:"device_token"`
	UserID      string `json:"user_id"`
	DeviceID    string `json:"device_id"`
}

func PairAgent(baseURL, pairingCode, companyName string) (*PairResponse, error) {
	payload, _ := json.Marshal(map[string]string{
		"pairing_code":        pairingCode,
		"tally_company_name": companyName,
	})
	req, err := http.NewRequest(http.MethodPost, baseURL+"/pairAgent", bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("pair failed: %s", string(body))
	}

	var result PairResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (a *API) postJSON(path string, body interface{}) error {
	data, _ := json.Marshal(body)
	req, err := http.NewRequest(http.MethodPost, a.BaseURL+path, bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", a.agentAuth())

	resp, err := a.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("%s: %s", path, string(b))
	}
	return nil
}
