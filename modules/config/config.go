package config

import (
	"fmt"
	"os"
	"path/filepath"

	"motor-town-server-tool/modules/types"

	"github.com/BurntSushi/toml"
)

type Config struct {
	Instances map[string]types.Instance `toml:"instances"`
}

func Load() (*Config, error) {
	configPath := getConfigPath()

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return &Config{
			Instances: make(map[string]types.Instance),
		}, nil
	}

	var cfg Config
	_, err := toml.DecodeFile(configPath, &cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}

	if cfg.Instances == nil {
		cfg.Instances = make(map[string]types.Instance)
	}

	return &cfg, nil
}

func (c *Config) Save() error {
	configPath := getConfigPath()

	file, err := os.Create(configPath)
	if err != nil {
		return fmt.Errorf("failed to create config file: %w", err)
	}
	defer file.Close()

	encoder := toml.NewEncoder(file)
	if err := encoder.Encode(c); err != nil {
		return fmt.Errorf("failed to encode config: %w", err)
	}

	return nil
}

func (c *Config) AddInstance(name string, instance types.Instance) {
	if c.Instances == nil {
		c.Instances = make(map[string]types.Instance)
	}
	c.Instances[name] = instance
}

func (c *Config) GetInstance(name string) (types.Instance, bool) {
	instance, exists := c.Instances[name]
	return instance, exists
}

func (c *Config) DeleteInstance(name string) bool {
	if c.Instances == nil {
		return false
	}
	_, exists := c.Instances[name]
	if exists {
		delete(c.Instances, name)
	}
	return exists
}

func (c *Config) ListInstances() []string {
	if c.Instances == nil {
		return []string{}
	}

	names := make([]string, 0, len(c.Instances))
	for name := range c.Instances {
		names = append(names, name)
	}
	return names
}

func getConfigPath() string {
	execPath, err := os.Executable()
	if err != nil {
		return "instances.toml"
	}

	execDir := filepath.Dir(execPath)
	return filepath.Join(execDir, "instances.toml")
}
