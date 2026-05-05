// Implemented for spec: agent/specs/meal-appointment-local-testing-spec.md

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/config"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/domain"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
)

type templateRule struct {
	DayPattern string   `json:"dayPattern"`
	MealTypes  []string `json:"mealTypes"`
}

func main() {
	if envFile := os.Getenv("ENV_FILE"); envFile != "" {
		if err := config.LoadDotEnv(envFile); err != nil {
			fmt.Fprintf(os.Stderr, "load env file: %v\n", err)
			os.Exit(1)
		}
	}

	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	database, err := db.Open(cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "open database: %v\n", err)
		os.Exit(1)
	}
	defer database.Close()

	defaultRules, _ := json.Marshal([]templateRule{
		{DayPattern: "WEEKDAY", MealTypes: []string{"DINNER"}},
		{DayPattern: "WEEKEND", MealTypes: []string{"LUNCH", "DINNER"}},
	})

	demoRules, _ := json.Marshal(domain.DemoTemplate.Rules)

	ctx := context.Background()
	if _, err := database.ExecContext(ctx, `
		INSERT OR REPLACE INTO time_slot_templates (id, name, description, ruleset_json)
		VALUES (?, ?, ?, ?)
	`, "default_weekly", "주간 기본 템플릿", "평일 저녁과 주말 점심/저녁을 포함한 기본 템플릿", string(defaultRules)); err != nil {
		fmt.Fprintf(os.Stderr, "seed default_weekly: %v\n", err)
		os.Exit(1)
	}

	if _, err := database.ExecContext(ctx, `
		INSERT OR REPLACE INTO time_slot_templates (id, name, description, ruleset_json)
		VALUES (?, ?, ?, ?)
	`, domain.DemoTemplate.ID, domain.DemoTemplate.Name, "Seeded demo template", string(demoRules)); err != nil {
		fmt.Fprintf(os.Stderr, "seed demo template: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("[seed] Database seeded successfully.")
}
