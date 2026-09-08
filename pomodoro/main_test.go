package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNewHandlerHealthz(t *testing.T) {
	handler := newHandler("web")
	request := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}

	if recorder.Body.String() != "ok" {
		t.Fatalf("body = %q, want %q", recorder.Body.String(), "ok")
	}

	if contentType := recorder.Header().Get("Content-Type"); contentType != "text/plain; charset=utf-8" {
		t.Fatalf("Content-Type = %q, want %q", contentType, "text/plain; charset=utf-8")
	}
}

func TestNewHandlerHealthzRejectsNonGet(t *testing.T) {
	handler := newHandler("web")
	request := httptest.NewRequest(http.MethodPost, "/healthz", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusMethodNotAllowed)
	}
}

func TestNewHandlerServesWebFiles(t *testing.T) {
	handler := newHandler("web")

	tests := []struct {
		name string
		path string
		want int
	}{
		{name: "index", path: "/", want: http.StatusOK},
		{name: "stylesheet", path: "/static/css/style.css", want: http.StatusOK},
		{name: "script", path: "/static/js/app.js", want: http.StatusOK},
		{name: "unknown path", path: "/missing", want: http.StatusNotFound},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			recorder := httptest.NewRecorder()

			handler.ServeHTTP(recorder, request)

			if recorder.Code != test.want {
				t.Fatalf("status = %d, want %d", recorder.Code, test.want)
			}
		})
	}
}

func TestNewHandlerIndexRejectsNonGetOrHead(t *testing.T) {
	handler := newHandler("web")
	request := httptest.NewRequest(http.MethodPost, "/", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusMethodNotAllowed)
	}
}

func TestNewHandlerIndexAllowsHead(t *testing.T) {
	handler := newHandler("web")
	request := httptest.NewRequest(http.MethodHead, "/", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
}

func TestNewHandlerIndexContainsApplicationMarkup(t *testing.T) {
	handler := newHandler("web")
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	recorder := httptest.NewRecorder()

	handler.ServeHTTP(recorder, request)

	body := recorder.Body.String()
	for _, want := range []string{"<title>Pomodoro Timer</title>", "/static/css/style.css", "/static/js/app.js"} {
		if !strings.Contains(body, want) {
			t.Errorf("index body does not contain %q", want)
		}
	}
}
