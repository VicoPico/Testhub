package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/VicoPico/testhub/api/internal/config"
	httpx "github.com/VicoPico/testhub/api/internal/http"
	"github.com/VicoPico/testhub/api/internal/platform"
)

func main() {
	cfg := config.Load()

	logger := platform.NewLogger()

	router := httpx.NewRouter(logger)

	server := &http.Server{
		Addr:              ":" + cfg.APIPort,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	// Start server
	go func() {
		logger.Infof("api listening on :%s", cfg.APIPort)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Errorf("server error: %v", err)
			os.Exit(1)
		}
	}()

	// Graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	logger.Infof("shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Errorf("shutdown error: %v", err)
		os.Exit(1)
	}
	logger.Infof("bye")
}