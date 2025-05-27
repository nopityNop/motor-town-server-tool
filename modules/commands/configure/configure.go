package configure

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"motor-town-server-tool/modules/config"
	"motor-town-server-tool/modules/types"
)

type Command struct{}

func (c *Command) Name() string {
	return "configure"
}

func (c *Command) Description() string {
	return "Configure a new server instance"
}

func (c *Command) Execute(args []string) error {
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	scanner := bufio.NewScanner(os.Stdin)

	for {
		showMenu(cfg)

		choice, err := promptChoice(scanner)
		if err != nil {
			return err
		}

		switch choice {
		case 1:
			if err := addInstance(scanner, cfg); err != nil {
				fmt.Printf("Error adding instance: %v\n\n", err)
				continue
			}
		case 2:
			if len(cfg.ListInstances()) == 0 {
				fmt.Println("No instances available to edit.\n")
				continue
			}
			if err := editInstance(scanner, cfg); err != nil {
				fmt.Printf("Error editing instance: %v\n\n", err)
				continue
			}
		case 3:
			if len(cfg.ListInstances()) == 0 {
				fmt.Println("No instances available to delete.\n")
				continue
			}
			if err := deleteInstance(scanner, cfg); err != nil {
				fmt.Printf("Error deleting instance: %v\n\n", err)
				continue
			}
		case 0:
			fmt.Println("Goodbye!")
			return nil
		default:
			fmt.Println("Invalid choice. Please try again.\n")
			continue
		}

		if err := cfg.Save(); err != nil {
			fmt.Printf("Warning: Failed to save configuration: %v\n", err)
		}

		fmt.Println()
	}
}

func promptInstanceConfig(scanner *bufio.Scanner) (types.Instance, error) {
	var instance types.Instance

	ip, err := promptWithRetry(scanner, "Enter server IP: ", validateIP)
	if err != nil {
		return instance, err
	}
	instance.IP = ip

	portStr, err := promptWithRetry(scanner, "Enter server port: ", validatePort)
	if err != nil {
		return instance, err
	}
	port, _ := strconv.Atoi(portStr)
	instance.Port = port

	password, err := promptWithRetry(scanner, "Enter server password: ", validatePassword)
	if err != nil {
		return instance, err
	}
	instance.Password = password

	return instance, nil
}

func promptWithRetry(scanner *bufio.Scanner, prompt string, validator func(string) error) (string, error) {
	const maxAttempts = 3

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		fmt.Print(prompt)
		if !scanner.Scan() {
			return "", fmt.Errorf("failed to read input")
		}

		input := strings.TrimSpace(scanner.Text())
		if err := validator(input); err != nil {
			fmt.Printf("Error: %v\n", err)
			if attempt < maxAttempts {
				fmt.Printf("Please try again (%d/%d attempts remaining).\n", maxAttempts-attempt, maxAttempts)
			} else {
				return "", fmt.Errorf("maximum attempts reached (%d/%d)", maxAttempts, maxAttempts)
			}
			continue
		}

		return input, nil
	}

	return "", fmt.Errorf("unexpected error in retry loop")
}

func validateInstanceName(name string) error {
	if name == "" {
		return fmt.Errorf("instance name cannot be empty")
	}
	if len(name) > 72 {
		return fmt.Errorf("instance name cannot exceed 72 characters")
	}

	validName := regexp.MustCompile(`^[a-z0-9_-]+$`)
	if !validName.MatchString(name) {
		return fmt.Errorf("instance name can only contain lowercase letters (a-z), numbers (0-9), hyphens (-), and underscores (_)")
	}

	return nil
}

func validateIP(ip string) error {
	if ip == "" {
		return fmt.Errorf("IP cannot be empty")
	}

	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return fmt.Errorf("invalid IP address format")
	}

	ipv4 := parsedIP.To4()
	if ipv4 == nil {
		return fmt.Errorf("only IPv4 addresses are supported")
	}

	parts := strings.Split(ip, ".")
	if len(parts) != 4 {
		return fmt.Errorf("IP address must have exactly 4 parts separated by dots")
	}

	for i, part := range parts {
		num, err := strconv.Atoi(part)
		if err != nil {
			return fmt.Errorf("IP part %d is not a valid number: %s", i+1, part)
		}
		if num < 0 || num > 255 {
			return fmt.Errorf("IP part %d must be between 0 and 255, got: %d", i+1, num)
		}
	}

	return nil
}

func validatePort(portStr string) error {
	if portStr == "" {
		return fmt.Errorf("port cannot be empty")
	}

	port, err := strconv.Atoi(portStr)
	if err != nil {
		return fmt.Errorf("port must be a number: %s", portStr)
	}

	if port < 0 || port > 65535 {
		return fmt.Errorf("port must be between 0 and 65535, got: %d", port)
	}

	return nil
}

func validatePassword(password string) error {
	if password == "" {
		return fmt.Errorf("password cannot be empty")
	}
	if len(password) > 72 {
		return fmt.Errorf("password cannot exceed 72 characters")
	}

	return nil
}

func maskPassword(password string) string {
	if len(password) <= 3 {
		return strings.Repeat("*", len(password))
	}
	return password[:2] + strings.Repeat("*", len(password)-2)
}

func showMenu(cfg *config.Config) {
	fmt.Println("=== Motor Town Server Configuration ===")
	fmt.Println()

	instances := cfg.ListInstances()
	if len(instances) > 0 {
		fmt.Println("Instances:")
		sort.Strings(instances)
		for _, name := range instances {
			instance, _ := cfg.GetInstance(name)
			fmt.Printf("  - %s (%s:%d)\n", name, instance.IP, instance.Port)
		}
		fmt.Println()
	}

	fmt.Println("[1] Add Instance")
	if len(instances) > 0 {
		fmt.Println("[2] Edit Instance")
		fmt.Println("[3] Delete Instance")
	}
	fmt.Println("[0] Exit")
	fmt.Println()
}

func promptChoice(scanner *bufio.Scanner) (int, error) {
	fmt.Print("Enter your choice: ")
	if !scanner.Scan() {
		return 0, fmt.Errorf("failed to read choice")
	}

	choiceStr := strings.TrimSpace(scanner.Text())
	choice, err := strconv.Atoi(choiceStr)
	if err != nil {
		return 0, fmt.Errorf("invalid choice: %s", choiceStr)
	}

	return choice, nil
}

func addInstance(scanner *bufio.Scanner, cfg *config.Config) error {
	fmt.Println("\n=== Add New Instance ===")

	instanceName, err := promptWithRetry(scanner, "Enter instance name: ", validateInstanceName)
	if err != nil {
		return err
	}

	if _, exists := cfg.GetInstance(instanceName); exists {
		return fmt.Errorf("instance '%s' already exists", instanceName)
	}

	instance, err := promptInstanceConfig(scanner)
	if err != nil {
		return err
	}

	cfg.AddInstance(instanceName, instance)

	fmt.Printf("Instance '%s' added successfully!\n", instanceName)
	fmt.Printf("  IP: %s\n", instance.IP)
	fmt.Printf("  Port: %d\n", instance.Port)
	fmt.Printf("  Password: %s\n", maskPassword(instance.Password))

	return nil
}

func editInstance(scanner *bufio.Scanner, cfg *config.Config) error {
	fmt.Println("\n=== Edit Instance ===")

	instances := cfg.ListInstances()
	sort.Strings(instances)

	fmt.Println("Available instances:")
	for i, name := range instances {
		instance, _ := cfg.GetInstance(name)
		fmt.Printf("[%d] %s (%s:%d)\n", i+1, name, instance.IP, instance.Port)
	}
	fmt.Println()

	fmt.Print("Enter instance number to edit: ")
	if !scanner.Scan() {
		return fmt.Errorf("failed to read input")
	}

	choiceStr := strings.TrimSpace(scanner.Text())
	choice, err := strconv.Atoi(choiceStr)
	if err != nil || choice < 1 || choice > len(instances) {
		return fmt.Errorf("invalid choice: %s", choiceStr)
	}

	instanceName := instances[choice-1]
	existing, _ := cfg.GetInstance(instanceName)

	fmt.Printf("\nEditing instance '%s'\n", instanceName)
	fmt.Printf("Current: %s:%d\n", existing.IP, existing.Port)
	fmt.Println("Enter new values (press Enter to keep current value):")

	newInstance, err := promptInstanceConfigWithDefaults(scanner, existing)
	if err != nil {
		return err
	}

	cfg.AddInstance(instanceName, newInstance)

	fmt.Printf("Instance '%s' updated successfully!\n", instanceName)
	fmt.Printf("  IP: %s\n", newInstance.IP)
	fmt.Printf("  Port: %d\n", newInstance.Port)
	fmt.Printf("  Password: %s\n", maskPassword(newInstance.Password))

	return nil
}

func deleteInstance(scanner *bufio.Scanner, cfg *config.Config) error {
	fmt.Println("\n=== Delete Instance ===")

	instances := cfg.ListInstances()
	sort.Strings(instances)

	fmt.Println("Available instances:")
	for i, name := range instances {
		instance, _ := cfg.GetInstance(name)
		fmt.Printf("[%d] %s (%s:%d)\n", i+1, name, instance.IP, instance.Port)
	}
	fmt.Println()

	fmt.Print("Enter instance number to delete: ")
	if !scanner.Scan() {
		return fmt.Errorf("failed to read input")
	}

	choiceStr := strings.TrimSpace(scanner.Text())
	choice, err := strconv.Atoi(choiceStr)
	if err != nil || choice < 1 || choice > len(instances) {
		return fmt.Errorf("invalid choice: %s", choiceStr)
	}

	instanceName := instances[choice-1]

	fmt.Printf("Are you sure you want to delete instance '%s'? (y/N): ", instanceName)
	if !scanner.Scan() {
		return fmt.Errorf("failed to read confirmation")
	}

	confirmation := strings.ToLower(strings.TrimSpace(scanner.Text()))
	if confirmation != "y" && confirmation != "yes" {
		fmt.Println("Deletion cancelled.")
		return nil
	}

	if cfg.DeleteInstance(instanceName) {
		fmt.Printf("Instance '%s' deleted successfully!\n", instanceName)
	} else {
		return fmt.Errorf("failed to delete instance '%s'", instanceName)
	}

	return nil
}

func promptInstanceConfigWithDefaults(scanner *bufio.Scanner, existing types.Instance) (types.Instance, error) {
	var instance types.Instance

	ip, err := promptWithDefaults(scanner, "Enter server IP", existing.IP, validateIP)
	if err != nil {
		return instance, err
	}
	instance.IP = ip

	portStr, err := promptWithDefaults(scanner, "Enter server port", strconv.Itoa(existing.Port), validatePort)
	if err != nil {
		return instance, err
	}
	port, _ := strconv.Atoi(portStr)
	instance.Port = port

	password, err := promptWithDefaults(scanner, "Enter server password", existing.Password, validatePassword)
	if err != nil {
		return instance, err
	}
	instance.Password = password

	return instance, nil
}

func promptWithDefaults(scanner *bufio.Scanner, prompt, defaultValue string, validator func(string) error) (string, error) {
	const maxAttempts = 3

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		fmt.Printf("%s [%s]: ", prompt, defaultValue)
		if !scanner.Scan() {
			return "", fmt.Errorf("failed to read input")
		}

		input := strings.TrimSpace(scanner.Text())
		if input == "" {
			input = defaultValue
		}

		if err := validator(input); err != nil {
			fmt.Printf("Error: %v\n", err)
			if attempt < maxAttempts {
				fmt.Printf("Please try again (%d/%d attempts remaining).\n", maxAttempts-attempt, maxAttempts)
			} else {
				return "", fmt.Errorf("maximum attempts reached (%d/%d)", maxAttempts, maxAttempts)
			}
			continue
		}

		return input, nil
	}

	return "", fmt.Errorf("unexpected error in retry loop")
}
