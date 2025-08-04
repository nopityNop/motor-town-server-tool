# Motor Town Server Tool

A Go CLI utility to interact with the web API for Motor Town dedicated servers.

## Platform Support

| Platform | Architecture | Supported | Example Output Filename |
|----------|--------------|-----------|------------------------|
| Windows 32-bit | 386 | ✅ | `mtst_windows_x86.exe` |
| Windows 64-bit | amd64 | ✅ | `mtst_windows_x86_64.exe` |
| Linux 32-bit | 386 | ✅ | `mtst_linux_x86` |
| Linux 64-bit | amd64 | ✅ | `mtst_linux_x86_64` |
| Darwin 64-bit | amd64 | ❌ | `` |
| Darwin ARM64 | arm64 | ❌ | `` |

> **Note:** Platforms marked as unsupported or not listed may still be compatible but have not been tested, verified, or built for those architectures.

## Prebuilt Binaries

Download the latest release for your platform from the [releases](../../releases) section

## Building from Source

### Prerequisites

- Go 1.23.5

### Build Commands

```bash
go mod tidy
go build -ldflags="-s -w" -o <output_filename>
```

## Usage

### Commands

```bash
# Configure a new server instance
./mtst_windows_x86.exe configure

# Connect to a server instance shell
./mtst_windows_x86.exe connect
```

### Shell Commands

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

## License

[MIT](https://raw.githubusercontent.com/nopityNop/motor-town-server-tool/master/LICENSE)

##

Part of [nope.tools](https://nope.tools).