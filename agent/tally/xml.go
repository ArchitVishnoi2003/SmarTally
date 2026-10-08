package tally

import (
	"regexp"
	"strings"
)

var svcCompanyRe = regexp.MustCompile(`(?i)<SVCURRENTCOMPANY>[^<]*</SVCURRENTCOMPANY>`)

func escapeXML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	return s
}

// EnsureCompanyInXML sets SVCURRENTCOMPANY on voucher/master XML (fixes empty company in queued payloads).
func EnsureCompanyInXML(xml, companyName string) string {
	companyName = strings.TrimSpace(companyName)
	if companyName == "" {
		return xml
	}
	tag := "<SVCURRENTCOMPANY>" + escapeXML(companyName) + "</SVCURRENTCOMPANY>"
	if svcCompanyRe.MatchString(xml) {
		return svcCompanyRe.ReplaceAllString(xml, tag)
	}
	return xml
}
