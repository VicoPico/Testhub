package platform

import (
	"log"
)

type Logger struct {
	info  *log.Logger
	error *log.Logger
}

func NewLogger() *Logger {
	return &Logger{
		info:  log.New(log.Writer(), "[INFO] ", log.LstdFlags|log.Lmsgprefix),
		error: log.New(log.Writer(), "[ERROR] ", log.LstdFlags|log.Lmsgprefix),
	}
}

func (l *Logger) Infof(format string, args ...any) {
	l.info.Printf(format, args...)
}

func (l *Logger) Errorf(format string, args ...any) {
	l.error.Printf(format, args...)
}