package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/joho/godotenv"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/domain"
	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/db"
)

type seedRule struct {
	DayPattern string   `json:"dayPattern"`
	MealTypes  []string `json:"mealTypes"`
}

func main() {
	if path := os.Getenv("ENV_FILE"); path != "" {
		_ = godotenv.Load(path)
	} else {
		for _, candidate := range []string{".env", ".env.local", ".env.test", ".env.e2e"} {
			if _, err := os.Stat(candidate); err == nil {
				_ = godotenv.Load(candidate)
				break
			}
		}
	}

	client, err := db.Open(os.Getenv("DATABASE_URL"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to open database: %v\n", err)
		os.Exit(1)
	}
	defer client.Close()

	ctx := context.Background()

	defaultRules := []seedRule{
		{DayPattern: "WEEKDAY", MealTypes: []string{"DINNER"}},
		{DayPattern: "WEEKEND", MealTypes: []string{"LUNCH", "DINNER"}},
	}
	defaultJSON, err := json.Marshal(defaultRules)
	if err != nil {
		fmt.Fprintf(os.Stderr, "encode default rules: %v\n", err)
		os.Exit(1)
	}
	if _, err := client.ExecContext(ctx,
		`INSERT OR REPLACE INTO time_slot_templates (id, name, description, ruleset_json) VALUES (?, ?, ?, ?)`,
		"default_weekly",
		"주간 기본 템플릿",
		"평일 저녁과 주말 점심/저녁을 포함한 기본 템플릿",
		string(defaultJSON),
	); err != nil {
		fmt.Fprintf(os.Stderr, "seed default template: %v\n", err)
		os.Exit(1)
	}

	demo := domain.DemoTemplate()
	demoJSON, err := json.Marshal(demo.Rules)
	if err != nil {
		fmt.Fprintf(os.Stderr, "encode demo rules: %v\n", err)
		os.Exit(1)
	}
	if _, err := client.ExecContext(ctx,
		`INSERT OR REPLACE INTO time_slot_templates (id, name, description, ruleset_json) VALUES (?, ?, ?, ?)`,
		demo.ID,
		demo.Name,
		"Seeded demo template",
		string(demoJSON),
	); err != nil {
		fmt.Fprintf(os.Stderr, "seed demo template: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("[seed] Database seeded successfully.")
}
