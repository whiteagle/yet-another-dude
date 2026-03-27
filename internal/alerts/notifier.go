package alerts

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/smtp"
	"time"

	"github.com/whiteagle/yet-another-dude/internal/db"
)

// Notifier defines the interface for sending alert notifications.
type Notifier interface {
	// Notify sends an alert notification.
	Notify(ctx context.Context, event db.AlertEvent, rule db.AlertRule) error
}

// LogNotifier logs alerts using slog (always active as fallback).
type LogNotifier struct {
	logger *slog.Logger
}

// NewLogNotifier creates a new LogNotifier.
func NewLogNotifier(logger *slog.Logger) *LogNotifier {
	return &LogNotifier{logger: logger}
}

// Notify logs the alert event.
func (n *LogNotifier) Notify(_ context.Context, event db.AlertEvent, _ db.AlertRule) error {
	n.logger.Warn("ALERT",
		"rule_id", event.RuleID,
		"device_id", event.DeviceID,
		"message", event.Message,
		"value", event.Value,
	)
	return nil
}

// EmailNotifier sends alert notifications via email.
type EmailNotifier struct {
	SMTPHost string
	SMTPPort int
	From     string
	Auth     smtp.Auth
}

// NewEmailNotifier creates a new EmailNotifier.
func NewEmailNotifier(host string, port int, from string, auth smtp.Auth) *EmailNotifier {
	return &EmailNotifier{
		SMTPHost: host,
		SMTPPort: port,
		From:     from,
		Auth:     auth,
	}
}

// Notify sends an email alert.
func (n *EmailNotifier) Notify(_ context.Context, event db.AlertEvent, rule db.AlertRule) error {
	if rule.NotifyEmail == "" {
		return nil
	}

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: YAD Alert: %s\r\n\r\n%s\r\n\r\nTriggered at: %s\r\n",
		n.From, rule.NotifyEmail, event.Message, event.Message, event.TriggeredAt.Format(time.RFC3339))

	addr := fmt.Sprintf("%s:%d", n.SMTPHost, n.SMTPPort)
	if err := smtp.SendMail(addr, n.Auth, n.From, []string{rule.NotifyEmail}, []byte(msg)); err != nil {
		return fmt.Errorf("send email to %s: %w", rule.NotifyEmail, err)
	}
	return nil
}

// WebhookNotifier sends alert notifications via HTTP webhook.
type WebhookNotifier struct {
	client *http.Client
}

// NewWebhookNotifier creates a new WebhookNotifier.
func NewWebhookNotifier() *WebhookNotifier {
	return &WebhookNotifier{
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// WebhookPayload is the JSON body sent to webhook URLs.
type WebhookPayload struct {
	RuleID      string    `json:"rule_id"`
	DeviceID    string    `json:"device_id"`
	Message     string    `json:"message"`
	Value       float64   `json:"value"`
	TriggeredAt time.Time `json:"triggered_at"`
}

// Notify sends a webhook POST request with the alert event.
func (n *WebhookNotifier) Notify(ctx context.Context, event db.AlertEvent, rule db.AlertRule) error {
	if rule.NotifyWebhook == "" {
		return nil
	}

	payload := WebhookPayload{
		RuleID:      event.RuleID,
		DeviceID:    event.DeviceID,
		Message:     event.Message,
		Value:       event.Value,
		TriggeredAt: event.TriggeredAt,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal webhook payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, rule.NotifyWebhook, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("create webhook request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "YAD-AlertNotifier/1.0")

	resp, err := n.client.Do(req)
	if err != nil {
		return fmt.Errorf("webhook POST to %s: %w", rule.NotifyWebhook, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}

	return nil
}

// MultiNotifier dispatches notifications to multiple notifiers.
type MultiNotifier struct {
	notifiers []Notifier
}

// NewMultiNotifier creates a MultiNotifier that sends to all given notifiers.
func NewMultiNotifier(notifiers ...Notifier) *MultiNotifier {
	return &MultiNotifier{notifiers: notifiers}
}

// Notify sends the alert to all configured notifiers, collecting errors.
func (m *MultiNotifier) Notify(ctx context.Context, event db.AlertEvent, rule db.AlertRule) error {
	var errs []error
	for _, n := range m.notifiers {
		if err := n.Notify(ctx, event, rule); err != nil {
			errs = append(errs, err)
		}
	}
	if len(errs) > 0 {
		return fmt.Errorf("notification errors: %v", errs)
	}
	return nil
}
