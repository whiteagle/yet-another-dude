package alerts

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"net/smtp"
	"strconv"
	"strings"
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

// smtpTimeout is the deadline applied to the entire SMTP dialogue.
const smtpTimeout = 15 * time.Second

// Notify sends an email alert.
// A 15-second timeout is applied to the SMTP connection so that a slow or
// unreachable mail server cannot block the notification goroutine indefinitely.
func (n *EmailNotifier) Notify(ctx context.Context, event db.AlertEvent, rule db.AlertRule) error {
	if rule.NotifyEmail == "" {
		return nil
	}

	addr := fmt.Sprintf("%s:%d", n.SMTPHost, n.SMTPPort)

	// Honour the caller's context but add a hard cap.
	dialCtx, cancel := context.WithTimeout(ctx, smtpTimeout)
	defer cancel()

	conn, err := (&net.Dialer{}).DialContext(dialCtx, "tcp", addr)
	if err != nil {
		return fmt.Errorf("dial smtp %s: %w", addr, err)
	}
	// Apply a hard deadline on the connection itself so that all SMTP operations
	// (AUTH, MAIL FROM, RCPT TO, DATA, body write) are also bounded, not just the
	// initial TCP dial.
	if err := conn.SetDeadline(time.Now().Add(smtpTimeout)); err != nil {
		conn.Close()
		return fmt.Errorf("set smtp deadline: %w", err)
	}

	c, err := smtp.NewClient(conn, n.SMTPHost)
	if err != nil {
		conn.Close()
		return fmt.Errorf("smtp handshake with %s: %w", n.SMTPHost, err)
	}
	defer c.Close()

	if n.Auth != nil {
		if err := c.Auth(n.Auth); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}
	if err := c.Mail(n.From); err != nil {
		return fmt.Errorf("smtp MAIL FROM %s: %w", n.From, err)
	}
	if err := c.Rcpt(rule.NotifyEmail); err != nil {
		return fmt.Errorf("smtp RCPT TO %s: %w", rule.NotifyEmail, err)
	}

	wc, err := c.Data()
	if err != nil {
		return fmt.Errorf("smtp DATA: %w", err)
	}

	body := fmt.Sprintf(
		"From: %s\r\nTo: %s\r\nSubject: YAD Alert: %s\r\n\r\n%s\r\n\r\nTriggered at: %s\r\n",
		n.From, rule.NotifyEmail, event.Message, event.Message,
		event.TriggeredAt.Format(time.RFC3339),
	)
	if _, err := fmt.Fprint(wc, body); err != nil {
		wc.Close()
		return fmt.Errorf("smtp write body: %w", err)
	}
	if err := wc.Close(); err != nil {
		return fmt.Errorf("smtp close data writer: %w", err)
	}
	return c.Quit()
}

// DBEmailNotifier reads SMTP settings from the database on each call so that
// configuration changes take effect immediately without restarting the server.
// It is a no-op when PrimarySMTP is not configured.
type DBEmailNotifier struct {
	db *db.DB
}

// NewDBEmailNotifier creates a DBEmailNotifier backed by the given database.
func NewDBEmailNotifier(database *db.DB) *DBEmailNotifier {
	return &DBEmailNotifier{db: database}
}

// Notify sends an email alert using the SMTP settings currently in the database.
func (n *DBEmailNotifier) Notify(ctx context.Context, event db.AlertEvent, rule db.AlertRule) error {
	if rule.NotifyEmail == "" {
		return nil
	}

	settings, err := n.db.GetSettings(ctx)
	if err != nil {
		return fmt.Errorf("get smtp settings: %w", err)
	}
	if settings.PrimarySMTP == "" {
		slog.Debug("SMTP not configured, skipping email notification", "rule", rule.ID)
		return nil
	}

	// PrimarySMTP may be "host" or "host:port".
	host, portStr, splitErr := net.SplitHostPort(settings.PrimarySMTP)
	if splitErr != nil {
		// No port specified — default to 25.
		host = settings.PrimarySMTP
		portStr = "25"
	}
	port, _ := strconv.Atoi(portStr)
	if port == 0 {
		port = 25
	}

	from := settings.SMTPFrom
	if from == "" {
		from = "yad@" + host
	}

	var auth smtp.Auth
	if settings.SMTPUsername != "" {
		auth = smtp.PlainAuth("", settings.SMTPUsername, settings.SMTPPassword, host)
	}

	en := NewEmailNotifier(host, port, from, auth)
	return en.Notify(ctx, event, rule)
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

// webhookMaxRetries is the number of additional attempts after the first failure.
const webhookMaxRetries = 3

// Notify sends a webhook POST request with the alert event.
// Transient failures (network errors, 5xx) are retried up to webhookMaxRetries
// times with exponential backoff (1s, 2s, 4s). Client errors (4xx) are not retried.
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

	var lastErr error
	backoff := time.Second
	for attempt := 0; attempt <= webhookMaxRetries; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return fmt.Errorf("webhook cancelled after %d attempts: %w", attempt, ctx.Err())
			case <-time.After(backoff):
				backoff *= 2
			}
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, rule.NotifyWebhook, bytes.NewReader(body))
		if err != nil {
			return fmt.Errorf("create webhook request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "YAD-AlertNotifier/1.0")

		resp, err := n.client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("webhook POST attempt %d: %w", attempt+1, err)
			slog.Warn("webhook delivery failed, retrying", "attempt", attempt+1, "url", rule.NotifyWebhook, "error", err)
			continue
		}
		resp.Body.Close()

		if resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("webhook returned %d on attempt %d", resp.StatusCode, attempt+1)
			slog.Warn("webhook server error, retrying", "attempt", attempt+1, "status", resp.StatusCode)
			continue
		}
		if resp.StatusCode >= 400 {
			// Client error — do not retry
			return fmt.Errorf("webhook returned client error %d", resp.StatusCode)
		}
		return nil // success
	}
	return fmt.Errorf("webhook failed after %d attempts: %w", webhookMaxRetries+1, lastErr)
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
// Every notifier is attempted even if a previous one fails.
func (m *MultiNotifier) Notify(ctx context.Context, event db.AlertEvent, rule db.AlertRule) error {
	var msgs []string
	for _, n := range m.notifiers {
		if err := n.Notify(ctx, event, rule); err != nil {
			msgs = append(msgs, err.Error())
		}
	}
	if len(msgs) > 0 {
		return fmt.Errorf("notification errors: %s", strings.Join(msgs, "; "))
	}
	return nil
}
