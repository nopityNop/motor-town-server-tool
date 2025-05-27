package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"motor-town-server-tool/modules/types"
)

type APIResponse struct {
	Data      interface{} `json:"data"`
	Message   string      `json:"message"`
	Succeeded bool        `json:"succeeded"`
}

type VersionData struct {
	Version string `json:"version"`
}

type PlayerCountData struct {
	NumPlayers int `json:"num_players"`
}

type Player struct {
	Name     string `json:"name"`
	UniqueID string `json:"unique_id"`
}

type HousingData struct {
	OwnerUniqueID string `json:"owner_unique_id"`
	ExpireTime    string `json:"expire_time"`
}

func makeGETRequest(instance types.Instance, endpoint string, extraParams map[string]string) (*APIResponse, error) {
	baseURL := fmt.Sprintf("http://%s:%d", instance.IP, instance.Port)

	params := url.Values{}
	params.Set("password", instance.Password)

	for key, value := range extraParams {
		params.Set(key, value)
	}

	fullURL := fmt.Sprintf("%s%s?%s", baseURL, endpoint, params.Encode())

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	resp, err := client.Get(fullURL)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	var apiResp APIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return &apiResp, fmt.Errorf("HTTP %d: %s", resp.StatusCode, apiResp.Message)
	}

	if !apiResp.Succeeded {
		return &apiResp, fmt.Errorf("API call failed: %s", apiResp.Message)
	}

	return &apiResp, nil
}

func makePOSTRequest(instance types.Instance, endpoint string, extraParams map[string]string) (*APIResponse, error) {
	baseURL := fmt.Sprintf("http://%s:%d", instance.IP, instance.Port)

	params := url.Values{}
	params.Set("password", instance.Password)

	for key, value := range extraParams {
		params.Set(key, value)
	}

	fullURL := fmt.Sprintf("%s%s?%s", baseURL, endpoint, params.Encode())

	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	req, err := http.NewRequest("POST", fullURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	var apiResp APIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return &apiResp, fmt.Errorf("HTTP %d: %s", resp.StatusCode, apiResp.Message)
	}

	if !apiResp.Succeeded {
		return &apiResp, fmt.Errorf("API call failed: %s", apiResp.Message)
	}

	return &apiResp, nil
}

func SendChatMessage(instance types.Instance, message string) (*APIResponse, error) {
	if message == "" {
		return nil, fmt.Errorf("message cannot be empty")
	}

	params := map[string]string{
		"message": message,
	}
	return makePOSTRequest(instance, "/chat", params)
}

func GetPlayerCount(instance types.Instance) (*APIResponse, error) {
	return makeGETRequest(instance, "/player/count", nil)
}

func GetPlayerList(instance types.Instance) (*APIResponse, error) {
	return makeGETRequest(instance, "/player/list", nil)
}

func GetBanList(instance types.Instance) (*APIResponse, error) {
	return makeGETRequest(instance, "/player/banlist", nil)
}

func GetVersion(instance types.Instance) (*APIResponse, error) {
	return makeGETRequest(instance, "/version", nil)
}

func GetHousingList(instance types.Instance) (*APIResponse, error) {
	return makeGETRequest(instance, "/housing/list", nil)
}

func KickPlayer(instance types.Instance, uniqueID string) (*APIResponse, error) {
	if uniqueID == "" {
		return nil, fmt.Errorf("unique_id cannot be empty")
	}

	params := map[string]string{
		"unique_id": uniqueID,
	}
	return makePOSTRequest(instance, "/player/kick", params)
}

func BanPlayer(instance types.Instance, uniqueID string, hours int, reason string) (*APIResponse, error) {
	if uniqueID == "" {
		return nil, fmt.Errorf("unique_id cannot be empty")
	}

	params := map[string]string{
		"unique_id": uniqueID,
	}

	if hours > 0 {
		params["hours"] = fmt.Sprintf("%d", hours)
	}

	if reason != "" {
		params["reason"] = reason
	}

	return makePOSTRequest(instance, "/player/ban", params)
}

func UnbanPlayer(instance types.Instance, uniqueID string) (*APIResponse, error) {
	if uniqueID == "" {
		return nil, fmt.Errorf("unique_id cannot be empty")
	}

	params := map[string]string{
		"unique_id": uniqueID,
	}
	return makePOSTRequest(instance, "/player/unban", params)
}
