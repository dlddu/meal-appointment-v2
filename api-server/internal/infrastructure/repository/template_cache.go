package repository

import (
	"sync"
	"time"
)

type TemplateCacheMetrics interface {
	UpdateTemplateCacheHitRatio(ratio float64)
}

type TemplateCache interface {
	Get(id string) *TemplateRecord
	Set(id string, value TemplateRecord)
	Clear()
}

type cacheEntry struct {
	value     TemplateRecord
	expiresAt time.Time
}

type InMemoryTemplateCache struct {
	mu      sync.Mutex
	entries map[string]cacheEntry
	ttl     time.Duration
	metrics TemplateCacheMetrics
	hits    int
	misses  int
	now     func() time.Time
}

func NewInMemoryTemplateCache(ttl time.Duration, metrics TemplateCacheMetrics) *InMemoryTemplateCache {
	return &InMemoryTemplateCache{
		entries: make(map[string]cacheEntry),
		ttl:     ttl,
		metrics: metrics,
		now:     time.Now,
	}
}

func (c *InMemoryTemplateCache) Get(id string) *TemplateRecord {
	c.mu.Lock()
	defer c.mu.Unlock()
	entry, ok := c.entries[id]
	if ok && entry.expiresAt.After(c.now()) {
		c.hits++
		c.emitRatio()
		v := entry.value
		return &v
	}
	if ok {
		delete(c.entries, id)
	}
	c.misses++
	c.emitRatio()
	return nil
}

func (c *InMemoryTemplateCache) Set(id string, value TemplateRecord) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[id] = cacheEntry{value: value, expiresAt: c.now().Add(c.ttl)}
}

func (c *InMemoryTemplateCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries = make(map[string]cacheEntry)
	c.hits = 0
	c.misses = 0
	c.emitRatio()
}

func (c *InMemoryTemplateCache) emitRatio() {
	total := c.hits + c.misses
	ratio := 0.0
	if total > 0 {
		ratio = float64(c.hits) / float64(total)
	}
	if c.metrics != nil {
		c.metrics.UpdateTemplateCacheHitRatio(ratio)
	}
}
