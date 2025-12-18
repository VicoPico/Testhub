package http

import (
	"net/http"

	"github.com/VicoPico/testhub/api/internal/platform"
	"github.com/go-chi/chi/v5"
)

func NewRouter(logger *platform.Logger) http.Handler {
	r := chi.NewRouter()

	r.Get("/health", HealthHandler())
	r.Get("/ready", ReadyHandler())

	return r
}