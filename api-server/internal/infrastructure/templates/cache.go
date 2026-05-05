// Implemented for spec: agent/specs/meal-appointment-view-appointment-backend-implementation-spec.md

package templates

import (
	"sync"
	"time"

	"github.com/dlddu/meal-appointment-v2/api-server/internal/infrastructure/repos"
)

type CacheMetrics interface {
	UpdateTemplateCacheHitRatio(ratio float64)
}

type TemplateCache interface {
	Get(id string) *repos.TemplateRecord
	Set(id string, value repos.TemplateRecord)
	Clear()
}

type entry struct {
	value     repos.TemplateRecord
	expiresAt time.Time
}

type InMemoryCache struct {
	mu      sync.Mutex
	entries map[string]entry
	hits    int
	misses  int

	ttl     time.Duration
	now     func() time.Time
	metrics CacheMetrics
}

func NewInMemoryCache(ttl time.Duration, metrics CacheMetrics) *InMemoryCache {
	return &InMemoryCache{
		entries: make(map[string]entry),
		ttl:     ttl,
		now:     time.Now,
		metrics: metrics,
	}
}

// WithClock is a test helper that overrides the cache's clock.
func (c *InMemoryCache) WithClock(now func() time.Time) *InMemoryCache {
	c.now = now
	return c
}

func (c *InMemoryCache) Get(id string) *repos.TemplateRecord {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[id]
	if ok && e.expiresAt.After(c.now()) {
		c.hits++
		c.emitRatioLocked()
		v := e.value
		return &v
	}
	if ok {
		delete(c.entries, id)
	}
	c.misses++
	c.emitRatioLocked()
	return nil
}

func (c *InMemoryCache) Set(id string, value repos.TemplateRecord) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[id] = entry{value: value, expiresAt: c.now().Add(c.ttl)}
}

func (c *InMemoryCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = make(map[string]entry)
	c.hits = 0
	c.misses = 0
	c.emitRatioLocked()
}

func (c *InMemoryCache) emitRatioLocked() {
	total := c.hits + c.misses
	ratio := 0.0
	if total > 0 {
		ratio = float64(c.hits) / float64(total)
	}
	if c.metrics != nil {
		c.metrics.UpdateTemplateCacheHitRatio(ratio)
	}
}
