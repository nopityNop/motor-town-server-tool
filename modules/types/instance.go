package types

type Instance struct {
	IP       string `toml:"ip"`
	Port     int    `toml:"port"`
	Password string `toml:"password"`
}
