package config

import "os"

type Config struct {
	APIPort string

	DBHost    string
	DBPort    string
	DBName    string
	DBUser    string
	DBPass    string
	DBSSLMode string
}

func Load() Config {
	return Config{
		APIPort: getenv("TESTHUB_API_PORT", "8080"),

		DBHost:    getenv("TESTHUB_DB_HOST", "localhost"),
		DBPort:    getenv("TESTHUB_DB_PORT", "5432"),
		DBName:    getenv("TESTHUB_DB_NAME", "testhub"),
		DBUser:    getenv("TESTHUB_DB_USER", "testhub"),
		DBPass:    getenv("TESTHUB_DB_PASSWORD", "testhub"),
		DBSSLMode: getenv("TESTHUB_DB_SSLMODE", "disable"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}