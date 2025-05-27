package main

import (
	"fmt"
	"os"

	"motor-town-server-tool/modules/loader"
)

func main() {
	commands := loader.LoadCommands()

	if len(os.Args) < 2 {
		printUsage(commands)
		os.Exit(1)
	}

	commandName := os.Args[1]

	if commandName == "help" || commandName == "-h" || commandName == "--help" {
		printUsage(commands)
		return
	}

	command, exists := commands[commandName]
	if !exists {
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n\n", commandName)
		printUsage(commands)
		os.Exit(1)
	}

	args := []string{}
	if len(os.Args) > 2 {
		args = os.Args[2:]
	}

	if err := command.Execute(args); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func printUsage(commands map[string]loader.Commander) {
	fmt.Println("Motor Town Server Tool")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  motor-town-server-tool <command> [args...]")
	fmt.Println()
	fmt.Println("Commands:")

	for _, command := range commands {
		fmt.Printf("  %-12s %s\n", command.Name(), command.Description())
	}

	fmt.Println("  help         Show this help message")
	fmt.Println()
	fmt.Println("Examples:")
	fmt.Println("  motor-town-server-tool configure")
}
