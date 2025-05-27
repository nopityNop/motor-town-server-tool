package connect

import (
	"bufio"
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"

	"motor-town-server-tool/modules/api"
	"motor-town-server-tool/modules/config"
	"motor-town-server-tool/modules/types"
)

type Command struct{}

func (c *Command) Name() string {
	return "connect"
}

func (c *Command) Description() string {
	return "Connect to a server instance"
}

func (c *Command) Execute(args []string) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	instances := cfg.ListInstances()
	if len(instances) == 0 {
		fmt.Println("No instances configured. Use 'configure' command to add instances.")
		return nil
	}

	scanner := bufio.NewScanner(os.Stdin)

	instance, instanceName, err := selectInstance(scanner, cfg, instances)
	if err != nil {
		return err
	}

	fmt.Printf("Connected to instance '%s' (%s:%d)\n", instanceName, instance.IP, instance.Port)
	fmt.Println("Type 'help' for available commands or 'exit' to disconnect.")
	fmt.Println()

	return startShell(scanner, instance, instanceName)
}

func selectInstance(scanner *bufio.Scanner, cfg *config.Config, instances []string) (types.Instance, string, error) {
	sort.Strings(instances)

	fmt.Println("=== Available Instances ===")
	for i, name := range instances {
		instance, _ := cfg.GetInstance(name)
		fmt.Printf("[%d] %s (%s:%d)\n", i+1, name, instance.IP, instance.Port)
	}
	fmt.Println()

	fmt.Print("Select instance to connect to: ")
	if !scanner.Scan() {
		return types.Instance{}, "", fmt.Errorf("failed to read input")
	}

	choiceStr := strings.TrimSpace(scanner.Text())
	choice, err := strconv.Atoi(choiceStr)
	if err != nil || choice < 1 || choice > len(instances) {
		return types.Instance{}, "", fmt.Errorf("invalid choice: %s", choiceStr)
	}

	instanceName := instances[choice-1]
	instance, _ := cfg.GetInstance(instanceName)

	return instance, instanceName, nil
}

func startShell(scanner *bufio.Scanner, instance types.Instance, instanceName string) error {
	for {
		fmt.Printf("%s> ", instanceName)

		if !scanner.Scan() {
			fmt.Println()
			break
		}

		input := strings.TrimSpace(scanner.Text())
		if input == "" {
			continue
		}

		parts := strings.Fields(input)
		command := strings.ToLower(parts[0])

		switch command {
		case "exit", "quit", "disconnect":
			fmt.Printf("Disconnected from instance '%s'\n", instanceName)
			return nil
		case "help":
			showShellHelp()
		case "chat":
			if err := handleChatCommand(parts, instance); err != nil {
				fmt.Printf("Error: %v\n", err)
			}
		case "players", "playerlist":
			if err := handlePlayerListCommand(instance); err != nil {
				fmt.Printf("Error: %v\n", err)
			}
		case "count", "playercount":
			if err := handlePlayerCountCommand(instance); err != nil {
				fmt.Printf("Error: %v\n", err)
			}
		case "banlist":
			if err := handleBanListCommand(instance); err != nil {
				fmt.Printf("Error: %v\n", err)
			}
		case "kick":
			if err := handleKickCommand(parts, instance); err != nil {
				fmt.Printf("Error: %v\n", err)
			}
		case "ban":
			if err := handleBanCommand(parts, instance); err != nil {
				fmt.Printf("Error: %v\n", err)
			}
		case "unban":
			if err := handleUnbanCommand(parts, instance); err != nil {
				fmt.Printf("Error: %v\n", err)
			}
		case "version":
			if err := handleVersionCommand(instance); err != nil {
				fmt.Printf("Error: %v\n", err)
			}
		case "housing":
			if err := handleHousingCommand(instance); err != nil {
				fmt.Printf("Error: %v\n", err)
			}
		default:
			fmt.Printf("Unknown command: %s\n", command)
			fmt.Println("Type 'help' for available commands.")
		}
	}

	return nil
}

func showShellHelp() {
	fmt.Println("Available commands:")
	fmt.Println("  chat <message>        Send a chat message to the server")
	fmt.Println("  players, playerlist   Get list of online players")
	fmt.Println("  count, playercount    Get number of online players")
	fmt.Println("  banlist               Get list of banned players")
	fmt.Println("  kick <unique_id>      Kick a player by unique ID")
	fmt.Println("  ban <unique_id> [hours] [reason]  Ban a player")
	fmt.Println("  unban <unique_id>     Unban a player by unique ID")
	fmt.Println("  version               Get server version")
	fmt.Println("  housing               Get housing list")
	fmt.Println("  help                  Show this help message")
	fmt.Println("  exit                  Disconnect and return to main menu")
	fmt.Println()
}

func handleChatCommand(parts []string, instance types.Instance) error {
	if len(parts) < 2 {
		return fmt.Errorf("usage: chat <message>")
	}

	message := strings.Join(parts[1:], " ")

	fmt.Printf("Sending message: %s\n", message)

	response, err := api.SendChatMessage(instance, message)
	if err != nil {
		return fmt.Errorf("failed to send chat message: %w", err)
	}

	fmt.Printf("✓ Message sent successfully: %s\n", response.Message)
	return nil
}

func handlePlayerListCommand(instance types.Instance) error {
	response, err := api.GetPlayerList(instance)
	if err != nil {
		return fmt.Errorf("failed to get player list: %w", err)
	}

	data, ok := response.Data.(map[string]interface{})
	if !ok {
		fmt.Println("No players online")
		return nil
	}

	if len(data) == 0 {
		fmt.Println("No players online")
		return nil
	}

	fmt.Printf("Online players (%d):\n", len(data))
	for _, playerData := range data {
		if player, ok := playerData.(map[string]interface{}); ok {
			name := player["name"]
			uniqueID := player["unique_id"]
			fmt.Printf("  - %s (ID: %s)\n", name, uniqueID)
		}
	}
	return nil
}

func handlePlayerCountCommand(instance types.Instance) error {
	response, err := api.GetPlayerCount(instance)
	if err != nil {
		return fmt.Errorf("failed to get player count: %w", err)
	}

	data, ok := response.Data.(map[string]interface{})
	if !ok {
		return fmt.Errorf("unexpected response format")
	}

	if numPlayers, ok := data["num_players"].(float64); ok {
		fmt.Printf("Players online: %d\n", int(numPlayers))
	} else {
		return fmt.Errorf("unexpected player count format")
	}
	return nil
}

func handleBanListCommand(instance types.Instance) error {
	response, err := api.GetBanList(instance)
	if err != nil {
		return fmt.Errorf("failed to get ban list: %w", err)
	}

	data, ok := response.Data.(map[string]interface{})
	if !ok || len(data) == 0 {
		fmt.Println("No banned players")
		return nil
	}

	fmt.Printf("Banned players (%d):\n", len(data))
	for _, playerData := range data {
		if player, ok := playerData.(map[string]interface{}); ok {
			name := player["name"]
			uniqueID := player["unique_id"]
			fmt.Printf("  - %s (ID: %s)\n", name, uniqueID)
		}
	}
	return nil
}

func handleKickCommand(parts []string, instance types.Instance) error {
	if len(parts) < 2 {
		return fmt.Errorf("usage: kick <unique_id>")
	}

	uniqueID := parts[1]

	fmt.Printf("Kicking player with ID: %s\n", uniqueID)

	response, err := api.KickPlayer(instance, uniqueID)
	if err != nil {
		return fmt.Errorf("failed to kick player: %w", err)
	}

	fmt.Printf("✓ Player kicked successfully: %s\n", response.Message)
	return nil
}

func handleBanCommand(parts []string, instance types.Instance) error {
	if len(parts) < 2 {
		return fmt.Errorf("usage: ban <unique_id> [hours] [reason]")
	}

	uniqueID := parts[1]
	hours := 0
	reason := ""

	if len(parts) > 2 {
		if h, err := strconv.Atoi(parts[2]); err == nil {
			hours = h
		}
	}

	if len(parts) > 3 {
		reason = strings.Join(parts[3:], " ")
	}

	fmt.Printf("Banning player with ID: %s", uniqueID)
	if hours > 0 {
		fmt.Printf(" for %d hours", hours)
	}
	if reason != "" {
		fmt.Printf(" (reason: %s)", reason)
	}
	fmt.Println()

	response, err := api.BanPlayer(instance, uniqueID, hours, reason)
	if err != nil {
		return fmt.Errorf("failed to ban player: %w", err)
	}

	fmt.Printf("✓ Player banned successfully: %s\n", response.Message)
	return nil
}

func handleUnbanCommand(parts []string, instance types.Instance) error {
	if len(parts) < 2 {
		return fmt.Errorf("usage: unban <unique_id>")
	}

	uniqueID := parts[1]

	fmt.Printf("Unbanning player with ID: %s\n", uniqueID)

	response, err := api.UnbanPlayer(instance, uniqueID)
	if err != nil {
		return fmt.Errorf("failed to unban player: %w", err)
	}

	fmt.Printf("✓ Player unbanned successfully: %s\n", response.Message)
	return nil
}

func handleVersionCommand(instance types.Instance) error {
	response, err := api.GetVersion(instance)
	if err != nil {
		return fmt.Errorf("failed to get version: %w", err)
	}

	data, ok := response.Data.(map[string]interface{})
	if !ok {
		return fmt.Errorf("unexpected response format")
	}

	if version, ok := data["version"].(string); ok {
		fmt.Printf("Server version: %s\n", version)
	} else {
		return fmt.Errorf("unexpected version format")
	}
	return nil
}

func handleHousingCommand(instance types.Instance) error {
	response, err := api.GetHousingList(instance)
	if err != nil {
		return fmt.Errorf("failed to get housing list: %w", err)
	}

	data, ok := response.Data.(map[string]interface{})
	if !ok || len(data) == 0 {
		fmt.Println("No housing data available")
		return nil
	}

	fmt.Printf("Housing list (%d entries):\n", len(data))
	for houseName, houseData := range data {
		if house, ok := houseData.(map[string]interface{}); ok {
			ownerID := house["owner_unique_id"]
			expireTime := house["expire_time"]
			fmt.Printf("  - %s (Owner: %s, Expires: %s)\n", houseName, ownerID, expireTime)
		}
	}
	return nil
}
