package loader

import (
	"motor-town-server-tool/modules/commands/configure"
	"motor-town-server-tool/modules/commands/connect"
)

type Commander interface {
	Name() string
	Description() string
	Execute(args []string) error
}

func LoadCommands() map[string]Commander {
	commands := make(map[string]Commander)

	configureCmd := &configure.Command{}
	commands[configureCmd.Name()] = configureCmd

	connectCmd := &connect.Command{}
	commands[connectCmd.Name()] = connectCmd

	return commands
}
