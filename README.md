# Motor Town Server Tool

A Go CLI utility for managing Motor Town dedicated servers via the Web API. This tool provides an interactive interface to configure server instances and execute server management commands.

## Prebuilt Binaries

I provide prebuilt binaries for Windows and Linux (both 32-bit and 64-bit) in the [releases](../../releases) section. These are ready to use - just download and run!

Don't worry, I don't bite - the binaries are clean and safe to use. However, if you prefer to build from source for security reasons or want to customize the build, see the section below.

**Testing Note:** I have only tested on Windows 11, which is the main operating system I use. I don't use or develop for macOS, but in theory it should be compatible since Go supports cross-platform compilation.

## Building from Source

### Prerequisites
- Go (I develop with 1.23.5 in mind primarily)
- Internet connection (for downloading dependencies)

### Build Commands

First, download dependencies:
```bash
go mod tidy
```

#### Cross-Platform Build Command

**For Linux (Bash)**
```bash
GOOS=<target_os> GOARCH=<target_arch> go build -ldflags="-s -w" -o <output_filename>
```

**For Windows (PowerShell):**
```powershell
$env:GOOS="<target_os>"; $env:GOARCH="<target_arch>"; go build -ldflags="-s -w" -o <output_filename>
```

#### Tested Target Platform Values

| Platform | GOOS | GOARCH | Example Output Filename |
|----------|------|--------|------------------------|
| Windows 64-bit | `windows` | `amd64` | `motor-town-server-tool_windows_x64.exe` |
| Windows 32-bit | `windows` | `386` | `motor-town-server-tool_windows_x86.exe` |
| Linux 64-bit | `linux` | `amd64` | `motor-town-server-tool_linux_x64` |
| Linux 32-bit | `linux` | `386` | `motor-town-server-tool_linux_x86` |

#### Example Commands

```powershell
# Windows 64-bit (Current Platform)
go build -ldflags="-s -w" -o motor-town-server-tool_windows_x64.exe

# Linux 64-bit (from Windows)
$env:GOOS="linux"; $env:GOARCH="amd64"; go build -ldflags="-s -w" -o motor-town-server-tool_linux_x64
```

For a complete list of GOOS and GOARCH values, see: [Go (Golang) GOOS and GOARCH](https://gist.github.com/asukakenji/f15ba7e588ac42795f421b48b8aede63)

## Usage

### Commands

The tool supports two main commands:

- `configure` - Configure server instances
- `connect` - Connect to a server instance and enter interactive mode

### Configuration Management

```bash
# Configure a new server instance
motor-town-server-tool configure
```

This opens an interactive menu where you can:
- **[1] Add Instance** - Create a new server configuration
- **[2] Edit Instance** - Modify existing server settings
- **[3] Delete Instance** - Remove a server configuration

#### Instance Configuration

When adding or editing an instance, you'll be prompted for:
- **Instance Name**: Unique identifier (lowercase, a-z0-9_-, max 72 chars)
- **Server IP**: IPv4 address (0.0.0.0 to 255.255.255.255)
- **Server Port**: Port number (0-65535, default: 8080)
- **Server Password**: API password (max 72 chars)

### Interactive Server Connection

```bash
# Connect to a configured server instance
motor-town-server-tool connect
```

This shows a list of configured instances and allows you to select one for an interactive session.

#### Available Shell Commands

Once connected to an instance, you can use these commands:

| Command | Description | Usage |
|---------|-------------|-------|
| `chat <message>` | Send a chat message | `chat Hello players!` |
| `players`, `playerlist` | Get list of online players | `players` |
| `count`, `playercount` | Get number of online players | `count` |
| `banlist` | Get list of banned players | `banlist` |
| `kick <unique_id>` | Kick a player | `kick 12345` |
| `ban <unique_id> [hours] [reason]` | Ban a player | `ban 12345 24 griefing` |
| `unban <unique_id>` | Unban a player | `unban 12345` |
| `version` | Get server version | `version` |
| `housing` | Get housing information | `housing` |
| `help` | Show available commands | `help` |
| `exit` | Disconnect from instance | `exit` |

### Configuration File

The tool creates an `instances.toml` file in the same directory as the executable:

```toml
[instances]

[instances.production]
ip = "192.168.1.100"
port = 8080
password = "secure_password"

[instances.development]
ip = "localhost"
port = 8080
password = "dev_password"
```

## Motor Town Server Setup

To use this tool, your Motor Town dedicated server must have the Web API enabled.

**Important:** Make sure the Web API port (default: 8080) is opened in your firewall.

### Supported API Endpoints

This tool interfaces with all available Motor Town Web API endpoints:

- **POST /chat** - Send chat messages
- **GET /player/count** - Get player count
- **GET /player/list** - Get online players
- **GET /player/banlist** - Get banned players
- **POST /player/kick** - Kick players
- **POST /player/ban** - Ban players
- **POST /player/unban** - Unban players
- **GET /version** - Get server version
- **GET /housing/list** - Get housing information