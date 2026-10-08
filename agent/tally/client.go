package tally

import (
	"bytes"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

const DefaultPort = "9000"

type Client struct {
	baseURL string
	client  *http.Client
	ping    *http.Client
}

func NewClient() *Client {
	return &Client{
		baseURL: "http://127.0.0.1:" + DefaultPort,
		client:  &http.Client{Timeout: 90 * time.Second},
		ping:    &http.Client{Timeout: 8 * time.Second},
	}
}

// IsUp checks that Tally answers HTTP on port 9000 (TCP alone is not enough).
func (c *Client) IsUp() bool {
	if conn, err := net.DialTimeout("tcp", "127.0.0.1:"+DefaultPort, 2*time.Second); err != nil {
		return false
	} else {
		conn.Close()
	}
	_, err := c.postWith(c.ping, pingXML)
	return err == nil
}

const pingXML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>License Info</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`

func (c *Client) PostXML(xml string) (string, error) {
	return c.postWith(c.client, xml)
}

func (c *Client) postWith(httpClient *http.Client, xml string) (string, error) {
	req, err := http.NewRequest(http.MethodPost, c.baseURL, bytes.NewBufferString(xml))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "text/xml")

	resp, err := httpClient.Do(req)
	if err != nil {
		if strings.Contains(err.Error(), "timeout") || strings.Contains(err.Error(), "deadline") {
			return "", fmt.Errorf(
				"tally did not respond on port %s — open Tally, load your company, set F1 → Connectivity → Both, port 9000, restart Tally: %w",
				DefaultPort,
				err,
			)
		}
		return "", fmt.Errorf("tally request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func ResponseCreated(response string) bool {
	upper := strings.ToUpper(response)
	return strings.Contains(upper, "CREATED</CREATED>") ||
		strings.Contains(upper, "<CREATED>1</CREATED>") ||
		strings.Contains(upper, "ACTION=\"Create\"") && !strings.Contains(upper, "LINEERROR")
}

func ResponseError(response string) string {
	if idx := strings.Index(response, "<LINEERROR>"); idx >= 0 {
		end := strings.Index(response[idx:], "</LINEERROR>")
		if end > 0 {
			return response[idx+11 : idx+end]
		}
	}
	if idx := strings.Index(response, "<ERRORS>"); idx >= 0 {
		endIdx := idx + 200
		if endIdx > len(response) {
			endIdx = len(response)
		}
		return response[idx:endIdx]
	}
	return ""
}
