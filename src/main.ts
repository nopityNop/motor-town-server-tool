import { invoke } from "@tauri-apps/api/core";

let configFormEl: HTMLFormElement | null;
let hostInputEl: HTMLInputElement | null;
let portInputEl: HTMLInputElement | null;
let passwordInputEl: HTMLInputElement | null;
let chatFormEl: HTMLFormElement | null;
let chatMessageInputEl: HTMLInputElement | null;
let kickFormEl: HTMLFormElement | null;
let kickUniqueIdInputEl: HTMLInputElement | null;
let kickResultEl: HTMLElement | null;
let banFormEl: HTMLFormElement | null;
let banUniqueIdInputEl: HTMLInputElement | null;
let banResultEl: HTMLElement | null;
let unbanFormEl: HTMLFormElement | null;
let unbanUniqueIdInputEl: HTMLInputElement | null;
let unbanResultEl: HTMLElement | null;
let getBanListBtnEl: HTMLButtonElement | null;
let playerSectionToggle: HTMLInputElement | null;
let playerSectionContent: HTMLDivElement | null;
let playerListBodyEl: HTMLTableSectionElement | null;
let playerPollRateInputEl: HTMLInputElement | null;
let refreshPlayerListIconEl: HTMLImageElement | null;
let refreshBanListIconEl: HTMLImageElement | null;
let totalOnlineDisplayEl: HTMLSpanElement | null;
let totalBansDisplayEl: HTMLSpanElement | null;
let playerListPollIntervalId: number | null = null;
let banListPollIntervalId: number | null = null;

let currentPage = 1;
const itemsPerPage = 10;
let totalPlayers = 0; 
let allPlayers: Player[] = [];
let consecutivePlayerFetchErrors = 0;
let consecutiveBanFetchErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 3;
let isPlayerPollingActive = true;
let isBanPollingActive = true;

let prevPageBtnEl: HTMLButtonElement | null;
let nextPageBtnEl: HTMLButtonElement | null;
let pageIndicatorEl: HTMLSpanElement | null;

let banListBodyEl: HTMLTableSectionElement | null;
let banPrevPageBtnEl: HTMLButtonElement | null;
let banNextPageBtnEl: HTMLButtonElement | null;
let banPageIndicatorEl: HTMLSpanElement | null;

let banCurrentPage = 1;
let totalBans = 0;

interface ApiConfig {
  host: string;
  port: number;
  password?: string;
  players_section_enabled: boolean;
  player_list_poll_rate_seconds?: number;
}

interface ChatMessagePayload {
  message: string;
}

interface KickPlayerPayload {
  unique_id: string;
}

interface BanPlayerPayload {
  unique_id: string;
}

interface UnbanPlayerPayload {
  unique_id: string;
}

interface Player {
  name: string;
  unique_id: string;
}

interface BannedPlayer {
  name: string;
  unique_id: string;
}

type PlayerListData = Record<string, Player>;
type BanListData = Record<string, BannedPlayer>;

interface PlayerCountData {
  num_players: number;
}

interface ApiResponse<T = unknown> {
  error?: string;
  data?: T;
  message: string;
  succeeded: boolean;
}

let apiConfig: ApiConfig | null = null;

let suppressConsoleErrors = false;

let isInitializing = true;

function showToast(message: string) {
  const container = document.getElementById('toast-container');
  if (!container) {
    console.error('Toast container not found!');
    return;
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 50); 

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      toast.remove();
    }, 500);
  }, 5000);
}

async function loadConfig() {
  try {
    const loadedConfig: ApiConfig | null = await invoke("load_config");

    if (loadedConfig) {
      apiConfig = loadedConfig;

      if (hostInputEl) hostInputEl.value = apiConfig.host;
      if (portInputEl) portInputEl.value = apiConfig.port.toString();
      if (passwordInputEl) passwordInputEl.value = apiConfig.password ?? '';
      if (playerPollRateInputEl) playerPollRateInputEl.value = apiConfig.player_list_poll_rate_seconds?.toString() ?? '';

      const isEnabled = apiConfig.players_section_enabled;

      if (playerSectionToggle) {
        playerSectionToggle.checked = isEnabled;
      } else {
        console.error("Player section toggle element not found!");
      }

      if (playerSectionContent) {
        playerSectionContent.classList.toggle('hidden', !isEnabled);
      } else {
        console.error("Player section content element not found!");
      }

      if (isEnabled) {
        const pollRate = apiConfig.player_list_poll_rate_seconds ?? 30;
        startPlayerListPolling(pollRate);
      } else {
        stopPlayerListPolling();
        if (playerListBodyEl) {
          playerListBodyEl.innerHTML = '';
        } else {
          console.error("Player list body element not found for clearing!");
        }
      }

      showToast("Config loaded!");
    } else {
      apiConfig = null;
      console.log("No saved configuration found via invoke.");
    }
  } catch (error) {
    console.error("Error invoking load_config:", error);
    showToast(`Error loading config: ${error}`);
  }
}

async function saveConfig(): Promise<void> {
  if (!hostInputEl || !portInputEl || !passwordInputEl || !playerSectionToggle || !playerPollRateInputEl) {
    console.error("Required config elements not found for saving.");
    showToast("Failed to save config: UI elements missing.");
    return;
  }

  const hostValue = hostInputEl.value.trim();
  if (!isValidIpAddress(hostValue)) {
    showToast("Failed to save config: Invalid IP address.");
    return;
  }

  const portVal = parseInt(portInputEl.value, 10);
  if (isNaN(portVal) || portVal < 1 || portVal > 65535) {
    showToast("Failed to save config: Invalid port number.");
    return;
  }

  if (!passwordInputEl.value.trim()) {
    showToast("Failed to save config: Password missing.");
    return;
  }

  let newPollRate: number | undefined = parseInt(playerPollRateInputEl.value, 10);
  if (isNaN(newPollRate) || newPollRate === 0) {
    newPollRate = 30;
  } else {
    newPollRate = Math.max(1, Math.min(newPollRate, 999));
  }

  if (playerPollRateInputEl) {
    playerPollRateInputEl.value = newPollRate.toString();
  }

  apiConfig = {
    host: hostValue,
    port: portVal,
    password: passwordInputEl.value,
    players_section_enabled: playerSectionToggle.checked,
    player_list_poll_rate_seconds: newPollRate,
  };

  try {
    await invoke("save_config", { config: apiConfig });
    showToast("Configuration saved.");
    
    consecutivePlayerFetchErrors = 0;
    consecutiveBanFetchErrors = 0;
    
    console.log("[Config] Reset error counters for player and ban lists");
    
    if (playerSectionToggle?.checked && newPollRate) {
      startPlayerListPolling(newPollRate);
      startBanListPolling(newPollRate);
    } else {
      stopPlayerListPolling();
      stopBanListPolling();
    }
  } catch (error) {
    console.error("Failed to save config:", error);
    
    const errorStr = String(error);
    if (errorStr.includes("missing field `password`")) {
      showToast("Failed to save config: Password missing");
    } else {
      showToast(`Failed to save config: ${error}`);
    }
  }
}

async function fetchBanList() {
  if (!hostInputEl || !portInputEl || !passwordInputEl || !banListBodyEl || !banPrevPageBtnEl || !banNextPageBtnEl || !banPageIndicatorEl) return;

  if (isInitializing && banListPollIntervalId) {
    return;
  }

  if (consecutiveBanFetchErrors >= MAX_CONSECUTIVE_ERRORS) {
    if (isBanPollingActive) {
      console.log("Max consecutive ban fetch errors reached, stopping polling");
      stopBanListPolling();
      showErrorState(banListBodyEl!, "Polling stopped due to multiple request failures", 3);
      if (totalBansDisplayEl) {
        totalBansDisplayEl.textContent = `Total Bans: -`;
      }
      updateBanPaginationControls(banCurrentPage, 0);
    }
    return;
  }

  if (!isBanPollingActive) {
    showErrorState(banListBodyEl!, "Polling stopped due to multiple request failures", 3);
    if (totalBansDisplayEl) {
      totalBansDisplayEl.textContent = `Total Bans: -`;
    }
    updateBanPaginationControls(banCurrentPage, 0);
    return;
  }

  banListBodyEl!.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
  if (totalBansDisplayEl) {
    totalBansDisplayEl.textContent = `Total Bans: -`;
  }

  const config: ApiConfig = {
    host: hostInputEl.value,
    port: parseInt(portInputEl.value, 10), 
    password: passwordInputEl.value,
    players_section_enabled: playerSectionToggle ? playerSectionToggle.checked : true
  };

  console.log(`[Ban List] Fetching from ${config.host}:${config.port} at ${new Date().toLocaleTimeString()}`);
  
  try {
    const activeWhenStarted = isBanPollingActive;
    
    suppressConsoleErrors = true;
    console.log("[Ban List] Starting request");
    const startTime = performance.now();
    const response = await invoke<ApiResponse<BanListData>>("get_ban_list", { config });
    const endTime = performance.now();
    console.log(`[Ban List] Request completed in ${Math.round(endTime - startTime)}ms`);
    suppressConsoleErrors = false;

    if (!activeWhenStarted || !isBanPollingActive) {
      console.log("[Ban List] Request completed after polling was stopped, ignoring results");
      return;
    }

    console.log(`[Ban List] Response received: success=${response.succeeded}, message="${response.message}"`);
    
    if (response && response.succeeded) {
      consecutiveBanFetchErrors = 0;
      let bannedPlayers: BannedPlayer[] = [];
      
      if (response.data) {
        bannedPlayers = Object.values(response.data);
        console.log(`[Ban List] Received ${bannedPlayers.length} banned players`);
      } else {
        console.log(`[Ban List] No banned players data found in response or empty list`);
      }
      
      totalBans = bannedPlayers.length;
      
      if (totalBansDisplayEl) {
        totalBansDisplayEl.textContent = `Total Bans: ${totalBans}`;
      }
      
      const totalPages = Math.ceil(totalBans / itemsPerPage);
      if (banCurrentPage > totalPages && totalPages > 0) {
        banCurrentPage = totalPages;
      }
      
      banListBodyEl!.innerHTML = '';
      
      if (bannedPlayers.length === 0) {
        showEmptyState(banListBodyEl!, "No banned players found.", 3);
      } else {
        const start = (banCurrentPage - 1) * itemsPerPage;
        const end = Math.min(start + itemsPerPage, bannedPlayers.length);
        const currentPageBans = bannedPlayers.slice(start, end);
        
        currentPageBans.forEach(bannedPlayer => {
          const row = banListBodyEl!.insertRow();
          
          const nameCell = row.insertCell();
          nameCell.textContent = bannedPlayer.name;
          
          const idCell = row.insertCell();
          idCell.textContent = bannedPlayer.unique_id;
          
          const unbanCell = row.insertCell();
          unbanCell.textContent = 'Unban';
          unbanCell.classList.add('action-cell', 'unban-cell-button');
          unbanCell.dataset.uniqueId = bannedPlayer.unique_id;
          unbanCell.title = `Unban ${bannedPlayer.name}`;
        });
      }
      
      updateBanPaginationControls(banCurrentPage, totalPages);
    } else if (response && response.message && (
               response.message.includes("No banned players") || 
               response.message === "No banned players")) {
      console.log("[Ban List] No banned players message detected");
      consecutiveBanFetchErrors = 0;
      totalBans = 0;
      if (totalBansDisplayEl) {
        totalBansDisplayEl.textContent = `Total Bans: 0`;
      }
      showEmptyState(banListBodyEl!, "No banned players found.", 3);
      updateBanPaginationControls(banCurrentPage, 0);
    } else {
      if (isBanPollingActive) {
        consecutiveBanFetchErrors++;
        console.error(`[Ban List] Failed to fetch: ${response?.message || "Unknown error"}`);
        showErrorState(banListBodyEl!, "Request Timed Out", 3);
      }
      totalBans = 0;
      if (totalBansDisplayEl) {
        totalBansDisplayEl.textContent = `Total Bans: 0`;
      }
      updateBanPaginationControls(banCurrentPage, 0);
      
      if (consecutiveBanFetchErrors >= MAX_CONSECUTIVE_ERRORS && isBanPollingActive) {
        console.log(`[Ban List] Error threshold reached (${consecutiveBanFetchErrors}/${MAX_CONSECUTIVE_ERRORS}), stopping polling`);
        stopBanListPolling();
        showErrorState(banListBodyEl!, "Polling stopped due to multiple request failures", 3);
      }
    }
  } catch (error) {
    console.error(`[Ban List] Exception in fetchBanList: ${error}`);
    if (isBanPollingActive) {
      consecutiveBanFetchErrors++;
      console.error(`[Ban List] Error fetching: Request timed out or failed`);
      showErrorState(banListBodyEl!, "Request Timed Out", 3);
      
      if (consecutiveBanFetchErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.log(`[Ban List] Error threshold reached (${consecutiveBanFetchErrors}/${MAX_CONSECUTIVE_ERRORS}), stopping polling`);
        stopBanListPolling();
        showErrorState(banListBodyEl!, "Polling stopped due to multiple request failures", 3);
      }
    }
    totalBans = 0;
    if (totalBansDisplayEl) {
      totalBansDisplayEl.textContent = `Total Bans: 0`;
    }
    updateBanPaginationControls(banCurrentPage, 0);
  }
}

async function sendChatMessage(event: SubmitEvent) {
  event.preventDefault();
  if (!hostInputEl || !portInputEl || !passwordInputEl || !chatMessageInputEl) return;

  const config: ApiConfig = {
    host: hostInputEl.value,
    port: parseInt(portInputEl.value, 10), 
    password: passwordInputEl.value,
    players_section_enabled: playerSectionToggle ? playerSectionToggle.checked : true
  };

  const message = chatMessageInputEl.value.trim();
  
  if (!message) {
    showToast("Cannot send empty announcement");
    return;
  }
  
  const payload: ChatMessagePayload = { message };

  showToast(`Attempting to send announcement...`);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await Promise.race([
      invoke<ApiResponse<null>>("send_chat_message", { config, payload }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Request timed out after 5 seconds")), 5000);
      })
    ]);
    
    clearTimeout(timeoutId);

    if (response.succeeded) {
      showToast("Announcement sent successfully");
      chatMessageInputEl.value = '';
    } else {
      showToast(`Announcement failed: ${response.message || "Unknown error"}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("timed out")) {
      showToast("Announcement failed: Request timed out");
    } else {
      showToast(`Announcement failed: ${error}`);
    }
    console.error("[Announcement] Error sending:", error);
  }
}

async function kickPlayer(event: SubmitEvent) {
  event.preventDefault();
  if (!hostInputEl || !portInputEl || !passwordInputEl || !kickUniqueIdInputEl || !kickResultEl) return;

  const config: ApiConfig = {
    host: hostInputEl.value,
    port: parseInt(portInputEl.value, 10), 
    password: passwordInputEl.value,
    players_section_enabled: playerSectionToggle ? playerSectionToggle.checked : true
  };

  const payload: KickPlayerPayload = {
    unique_id: kickUniqueIdInputEl.value,
  };

  kickResultEl.textContent = 'Sending...';

  try {
    const response = await invoke<ApiResponse<null>>("kick_player", { config, payload });
    kickResultEl.textContent = `Result: ${response.message || (response.succeeded ? 'Success' : 'Failed')}`;
    if (response.succeeded) {
      kickUniqueIdInputEl.value = '';
    }
  } catch (error) {
    kickResultEl.textContent = `Error invoking command: ${JSON.stringify(error)}`;
  }
}

async function banPlayer(event: SubmitEvent) {
  event.preventDefault();
  if (!hostInputEl || !portInputEl || !passwordInputEl || !banUniqueIdInputEl || !banResultEl) return;

  const config: ApiConfig = {
    host: hostInputEl.value,
    port: parseInt(portInputEl.value, 10), 
    password: passwordInputEl.value,
    players_section_enabled: playerSectionToggle ? playerSectionToggle.checked : true
  };

  const payload: BanPlayerPayload = {
    unique_id: banUniqueIdInputEl.value,
  };

  banResultEl.textContent = 'Sending...';

  try {
    const response = await invoke<ApiResponse<null>>("ban_player", { config, payload });
    banResultEl.textContent = `Result: ${response.message || (response.succeeded ? 'Success' : 'Failed')}`;
    if (response.succeeded) {
      banUniqueIdInputEl.value = '';
    }
  } catch (error) {
    banResultEl.textContent = `Error invoking command: ${JSON.stringify(error)}`;
  }
}

async function unbanPlayer(event: SubmitEvent) {
  event.preventDefault();
  if (!hostInputEl || !portInputEl || !passwordInputEl || !unbanUniqueIdInputEl || !unbanResultEl) return;

  const config: ApiConfig = {
    host: hostInputEl.value,
    port: parseInt(portInputEl.value, 10), 
    password: passwordInputEl.value,
    players_section_enabled: playerSectionToggle ? playerSectionToggle.checked : true
  };

  const payload: UnbanPlayerPayload = {
    unique_id: unbanUniqueIdInputEl.value,
  };

  unbanResultEl.textContent = 'Sending...';

  try {
    const response = await invoke<ApiResponse<null>>("unban_player", { config, payload });
    unbanResultEl.textContent = `Result: ${response.message || (response.succeeded ? 'Success' : 'Failed')}`;
    if (response.succeeded) {
      unbanUniqueIdInputEl.value = '';
    }
  } catch (error) {
    unbanResultEl.textContent = `Error invoking command: ${JSON.stringify(error)}`;
  }
}

async function fetchPlayerList(): Promise<void> {
  if (!hostInputEl || !portInputEl || !passwordInputEl || !playerListBodyEl || !totalOnlineDisplayEl) {
    console.error("Missing DOM elements for player list");
    return;
  }

  if (isInitializing && playerListPollIntervalId) {
    return;
  }

  if (consecutivePlayerFetchErrors >= MAX_CONSECUTIVE_ERRORS) {
    if (isPlayerPollingActive) {
      console.log("Max consecutive errors reached, stopping polling");
      stopPlayerListPolling();
      showErrorState(playerListBodyEl!, "Polling stopped due to multiple request failures", 4);
      totalOnlineDisplayEl.textContent = "Total Online: -";
    }
    return;
  }

  if (!isPlayerPollingActive) {
    showErrorState(playerListBodyEl!, "Polling stopped due to multiple request failures", 4);
    totalOnlineDisplayEl.textContent = "Total Online: -";
    return;
  }

  playerListBodyEl!.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
  totalOnlineDisplayEl.textContent = "Total Online: -";

  console.log(`[Player List] Fetching from ${apiConfig?.host}:${apiConfig?.port} at ${new Date().toLocaleTimeString()}`);

  try {
    const activeWhenStarted = isPlayerPollingActive;
    
    suppressConsoleErrors = true;
    console.log("[Player List] Starting requests (player list and count)");
    const startTime = performance.now();
    
    const results = await Promise.allSettled([
      invoke<ApiResponse<PlayerListData>>("get_player_list", { config: apiConfig }),
      invoke<ApiResponse<PlayerCountData>>("get_player_count", { config: apiConfig })
    ]);
    
    const endTime = performance.now();
    console.log(`[Player List] Requests completed in ${Math.round(endTime - startTime)}ms`);
    suppressConsoleErrors = false;
    
    if (!activeWhenStarted || !isPlayerPollingActive) {
      console.log("[Player List] Requests completed after polling was stopped, ignoring results");
      return;
    }
    
    const playerListResponse = results[0].status === 'fulfilled' ? results[0].value : null;
    const playerCountResponse = results[1].status === 'fulfilled' ? results[1].value : null;
    
    if (playerListResponse) {
      console.log(`[Player List] Response received: success=${playerListResponse.succeeded}, message="${playerListResponse.message || ''}"`);
    }
    
    if (playerCountResponse) {
      console.log(`[Player Count] Response received: success=${playerCountResponse.succeeded}, count=${playerCountResponse.data?.num_players || 'unknown'}`);
    }
    
    const failures = [];
    if (!playerListResponse || !playerListResponse.succeeded) {
      failures.push("player list");
    }
    if (!playerCountResponse || !playerCountResponse.succeeded) {
      failures.push("player count");
    }
    
    if (failures.length > 0 && isPlayerPollingActive) {
      console.error(`[Player List] Failed to fetch ${failures.join(" and ")}: Request timed out`);
    }
    
    if (playerListResponse && playerListResponse.succeeded && playerListResponse.data) {
      consecutivePlayerFetchErrors = 0;
      allPlayers = Object.values(playerListResponse.data);
      totalPlayers = allPlayers.length;
      
      console.log(`[Player List] Received ${totalPlayers} players`);
      
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const playersToShow = allPlayers.slice(startIndex, endIndex);

      playerListBodyEl!.innerHTML = ''; 
      if (playersToShow.length === 0 && totalPlayers > 0) {
        showEmptyState(playerListBodyEl!, "No players on this page.", 4);
      } else if (playersToShow.length === 0 && totalPlayers === 0) {
        showEmptyState(playerListBodyEl!, "No players currently connected.", 4);
      } else {
        playersToShow.forEach(player => {
          const row = playerListBodyEl!.insertRow();
          row.insertCell().textContent = player.name;
          row.insertCell().textContent = player.unique_id; 
 
          const kickCell = row.insertCell();
          kickCell.textContent = 'Kick'; 
          kickCell.classList.add('action-cell', 'kick-cell-button');
          kickCell.dataset.uniqueId = player.unique_id;
          kickCell.title = `Kick ${player.name}`;
 
          const banCell = row.insertCell();
          banCell.textContent = 'Ban'; 
          banCell.classList.add('action-cell', 'ban-cell-button');
          banCell.dataset.uniqueId = player.unique_id;
          banCell.title = `Ban ${player.name}`;
        });
      }
      
      const totalPages = Math.ceil(totalPlayers / itemsPerPage);
      updatePaginationControls(currentPage, totalPages);
    } else {
      consecutivePlayerFetchErrors++;
      if (isPlayerPollingActive) {
        console.error(`[Player List] Failed to fetch: ${playerListResponse?.message || "Unknown error"}`);
        showErrorState(playerListBodyEl!, "Request Timed Out", 4);
      }
      totalPlayers = 0;
      allPlayers = [];
      updatePaginationControls(currentPage, 0); 
      
      if (consecutivePlayerFetchErrors >= MAX_CONSECUTIVE_ERRORS && isPlayerPollingActive) {
        console.log(`[Player List] Error threshold reached (${consecutivePlayerFetchErrors}/${MAX_CONSECUTIVE_ERRORS}), stopping polling`);
        stopPlayerListPolling();
        showErrorState(playerListBodyEl!, "Polling stopped due to multiple request failures", 4);
      }
    }

    if (playerCountResponse && playerCountResponse.succeeded && playerCountResponse.data) {
      totalOnlineDisplayEl.textContent = `Total Online: ${playerCountResponse.data.num_players}`;
    } else if (isPlayerPollingActive) {
      totalOnlineDisplayEl.textContent = `Total Online: -`;
    }
  } catch (error) {
    console.error(`[Player List] Exception in fetchPlayerList: ${error}`);
    if (isPlayerPollingActive) {
      consecutivePlayerFetchErrors++;
      console.error(`[Player List] Error fetching: Request timed out or failed`);
      showErrorState(playerListBodyEl!, "Request Timed Out", 4);
      
      if (consecutivePlayerFetchErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.log(`[Player List] Error threshold reached (${consecutivePlayerFetchErrors}/${MAX_CONSECUTIVE_ERRORS}), stopping polling`);
        stopPlayerListPolling();
        showErrorState(playerListBodyEl!, "Polling stopped due to multiple request failures", 4);
      }
    }
    totalOnlineDisplayEl.textContent = "Total Online: -";
    totalPlayers = 0; 
    allPlayers = []; 
    updatePaginationControls(currentPage, 0);
  }
}

function showEmptyState(tbody: HTMLTableSectionElement, message: string, colSpan: number): void {
  tbody.innerHTML = `<tr><td colspan="${colSpan}">${message}</td></tr>`;
}

function showErrorState(tbody: HTMLTableSectionElement, message: string, colSpan: number): void {
  tbody.innerHTML = `<tr><td colspan="${colSpan}" class="error-message">${message}</td></tr>`;
}

function updatePaginationControls(currentPage: number, totalPages: number): void {
  if (prevPageBtnEl) {
    prevPageBtnEl.disabled = currentPage <= 1;
  }
  if (nextPageBtnEl) {
    nextPageBtnEl.disabled = currentPage >= totalPages;
  }
  if (pageIndicatorEl) {
    pageIndicatorEl.textContent = totalPages > 0 ? `Page ${currentPage} of ${totalPages}` : 'Page 0 of 0';
  }
}

function updateBanPaginationControls(currentPage: number, totalPages: number): void {
  if (banPrevPageBtnEl) {
    banPrevPageBtnEl.disabled = currentPage <= 1;
  }
  if (banNextPageBtnEl) {
    banNextPageBtnEl.disabled = currentPage >= totalPages;
  }
  if (banPageIndicatorEl) {
    banPageIndicatorEl.textContent = totalPages > 0 ? `Page ${currentPage} of ${totalPages}` : 'Page 0 of 0';
  }
}

function goToPrevPage(): void {
  if (currentPage > 1) {
    currentPage--;
    fetchPlayerList(); 
  }
}

function goToNextPage(): void {
  const totalPages = Math.ceil(totalPlayers / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    fetchPlayerList(); 
  }
}

function goToPrevBanPage(): void {
  if (banCurrentPage > 1) {
    banCurrentPage--;
    fetchBanList(); 
  }
}

function goToNextBanPage(): void {
  const totalPages = Math.ceil(totalBans / itemsPerPage);
  if (banCurrentPage < totalPages) {
    banCurrentPage++;
    fetchBanList(); 
  }
}

function stopPlayerListPolling(): void {
  if (playerListPollIntervalId !== null) {
    clearInterval(playerListPollIntervalId);
    playerListPollIntervalId = null;
    isPlayerPollingActive = false;
    console.log("Player list polling stopped.");
    if (playerListBodyEl) {
      showErrorState(playerListBodyEl, "Polling stopped due to multiple request failures", 4);
    }
  }
}

function startPlayerListPolling(rateSeconds: number): void {
  if (isInitializing && playerListPollIntervalId) {
    return;
  }
  
  stopPlayerListPolling(); 
  consecutivePlayerFetchErrors = 0;
  isPlayerPollingActive = true;

  if (rateSeconds <= 0) {
    console.log("[Player List] Invalid poll rate, polling not started.");
    if (!isInitializing) {
      fetchPlayerList();
    }
    return;
  }

  console.log(`[Player List] Starting polling every ${rateSeconds} seconds.`);
  fetchPlayerList(); 
  
  playerListPollIntervalId = setInterval(() => {
    if (consecutivePlayerFetchErrors >= MAX_CONSECUTIVE_ERRORS) {
      stopPlayerListPolling();
    } else {
      fetchPlayerList();
    }
  }, rateSeconds * 1000);
}

function stopBanListPolling(): void {
  if (banListPollIntervalId !== null) {
    clearInterval(banListPollIntervalId);
    banListPollIntervalId = null;
    isBanPollingActive = false;
    console.log("Ban list polling stopped.");
    if (banListBodyEl) {
      showErrorState(banListBodyEl, "Polling stopped due to multiple request failures", 3);
    }
  }
}

function startBanListPolling(rateSeconds: number): void {
  if (isInitializing && banListPollIntervalId) {
    return;
  }
  
  stopBanListPolling();
  consecutiveBanFetchErrors = 0;
  isBanPollingActive = true;

  if (rateSeconds <= 0) {
    console.log("[Ban List] Invalid poll rate for ban list, polling not started.");
    if (!isInitializing) {
      fetchBanList();
    }
    return;
  }

  console.log(`[Ban List] Starting polling every ${rateSeconds} seconds.`);
  fetchBanList();
  
  banListPollIntervalId = setInterval(() => {
    if (consecutiveBanFetchErrors >= MAX_CONSECUTIVE_ERRORS) {
      stopBanListPolling();
    } else {
      fetchBanList();
    }
  }, rateSeconds * 1000);
}

function isValidIpAddress(ip: string): boolean {
  const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}

window.addEventListener("DOMContentLoaded", async () => {
  configFormEl = document.querySelector("#config-form");
  hostInputEl = document.querySelector("#api-host");
  portInputEl = document.querySelector("#api-port");
  passwordInputEl = document.querySelector("#api-password");
  getBanListBtnEl = document.querySelector("#get-ban-list-btn");
  chatFormEl = document.querySelector("#chat-form");
  chatMessageInputEl = document.querySelector("#chat-message");
  kickFormEl = document.querySelector("#kick-form");
  kickUniqueIdInputEl = document.querySelector("#kick-unique-id");
  kickResultEl = document.querySelector("#kick-result");
  banFormEl = document.querySelector("#ban-form");
  banUniqueIdInputEl = document.querySelector("#ban-unique-id");
  banResultEl = document.querySelector("#ban-result");
  unbanFormEl = document.querySelector("#unban-form");
  unbanUniqueIdInputEl = document.querySelector("#unban-unique-id");
  unbanResultEl = document.querySelector("#unban-result");
  playerSectionToggle = document.querySelector("#player-section-toggle");
  playerSectionContent = document.querySelector("#player-section-content");
  playerListBodyEl = document.querySelector("#player-list-body");
  playerPollRateInputEl = document.querySelector("#player-poll-rate");
  refreshPlayerListIconEl = document.querySelector<HTMLImageElement>("#refresh-player-list-icon");
  refreshBanListIconEl = document.querySelector<HTMLImageElement>("#refresh-ban-list-icon");
  totalOnlineDisplayEl = document.querySelector("#total-online-display");
  totalBansDisplayEl = document.querySelector("#total-bans-display");

  prevPageBtnEl = document.querySelector("#prev-page-btn");
  nextPageBtnEl = document.querySelector("#next-page-btn");
  pageIndicatorEl = document.querySelector("#page-indicator");

  banListBodyEl = document.querySelector("#ban-list-body");
  banPrevPageBtnEl = document.querySelector("#ban-prev-page-btn");
  banNextPageBtnEl = document.querySelector("#ban-next-page-btn");
  banPageIndicatorEl = document.querySelector("#ban-page-indicator");
  
  if (passwordInputEl) {
    passwordInputEl.type = 'text';
    passwordInputEl.style.color = '#F6F8FF';
  }
  
  configFormEl?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveConfig();
  });
  getBanListBtnEl?.addEventListener("click", () => {
    console.log("Refreshing ban list");
    showToast("Refreshing ban list");
    consecutiveBanFetchErrors = 0;
    fetchBanList();
  });
  chatFormEl?.addEventListener("submit", sendChatMessage);
  kickFormEl?.addEventListener("submit", kickPlayer);
  banFormEl?.addEventListener("submit", banPlayer);
  unbanFormEl?.addEventListener("submit", unbanPlayer);

  prevPageBtnEl?.addEventListener('click', goToPrevPage);
  nextPageBtnEl?.addEventListener('click', goToNextPage);

  banPrevPageBtnEl?.addEventListener('click', goToPrevBanPage);
  banNextPageBtnEl?.addEventListener('click', goToNextBanPage);

  if (playerSectionToggle) { 
    const toggleElement = playerSectionToggle;
    toggleElement.addEventListener('change', () => {
      const isChecked = toggleElement.checked;

      if(playerSectionContent) { 
        playerSectionContent.classList.toggle('hidden', !isChecked);
      }

      if (isChecked) {
        const pollRate = apiConfig?.player_list_poll_rate_seconds ?? 30; 
        startPlayerListPolling(pollRate); 
      } else {
        if (playerListBodyEl) { 
          playerListBodyEl.innerHTML = ''; 
        }
        stopPlayerListPolling(); 
      }

      saveConfig().catch(error => {
        console.error("Failed to save config after toggle:", error);
        showToast("Error saving toggle state.");
      });
    });
  } else {
    console.error("Player section toggle not found!");
  }

  if (playerPollRateInputEl) {
    playerPollRateInputEl.addEventListener('change', saveConfig);
    playerPollRateInputEl.addEventListener('input', (event) => {
      const input = event.target as HTMLInputElement;
      let cleanedValue = input.value.replace(/\D/g, '');
      
      if (cleanedValue.length > 3) {
        cleanedValue = cleanedValue.slice(0, 3);
      }
      
      const numValue = parseInt(cleanedValue, 10);
      if (!isNaN(numValue) && numValue > 65535) {
        cleanedValue = '65535';
      }
      
      if (input.value !== cleanedValue) {
        input.value = cleanedValue;
      }
    });
  }

  if (portInputEl) {
    portInputEl.addEventListener('input', (event) => {
      const input = event.target as HTMLInputElement;
      let cleanedValue = input.value.replace(/\D/g, '');
      
      if (cleanedValue.length > 5) {
        cleanedValue = cleanedValue.slice(0, 5);
      }
      
      const numValue = parseInt(cleanedValue, 10);
      if (!isNaN(numValue) && numValue > 65535) {
        cleanedValue = '65535';
      }
      
      if (input.value !== cleanedValue) {
        input.value = cleanedValue;
      }
    });
  }

  if (playerListBodyEl) {
    playerListBodyEl.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
  }
  if (banListBodyEl) {
    banListBodyEl.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
  }
  
  isInitializing = true;
  
  await loadConfig();
  
  if (!banListPollIntervalId) {
    startBanListPolling(30);
  }
  
  isInitializing = false;
  
  playerListBodyEl?.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;

    if (target.classList.contains('action-cell') && target.dataset.uniqueId) {
      const uniqueId = target.dataset.uniqueId;
      let action: 'kick_player' | 'ban_player' | null = null;
      let payload: KickPlayerPayload | BanPlayerPayload | null = null;

      if (target.classList.contains('kick-cell-button')) {
        action = 'kick_player';
        payload = { unique_id: uniqueId };
      } else if (target.classList.contains('ban-cell-button')) {
        action = 'ban_player';
        payload = { unique_id: uniqueId };
      }

      if (action && payload && apiConfig) {
        try {
          const actionName = action.split('_')[0]; 
          showToast(`Attempting to ${actionName} player ${uniqueId}...`);
          const response = await invoke<ApiResponse<null>>(action, { config: apiConfig, payload });
          
          if (response.succeeded) {
            showToast(`Player successfully ${actionName}ed`);
            if (action === 'kick_player') {
              fetchPlayerList(); 
            } else if (action === 'ban_player') {
              fetchPlayerList();
              fetchBanList(); 
            }
          } else {
            showToast(`${actionName.charAt(0).toUpperCase() + actionName.slice(1)} failed: ${response.message || "Unknown error"}`);
          }
        } catch (error) {
          console.error(`Error invoking ${action}:`, error);
          showToast(`Error during ${action.split('_')[0]} action: ${error}`);
        }
      } else if (!apiConfig) {
        showToast("Error: API configuration is missing.");
      }
    }
  });

  banListBodyEl?.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;

    if (target.classList.contains('unban-cell-button') && target.dataset.uniqueId) {
      const uniqueId = target.dataset.uniqueId;
      const action = 'unban_player';
      const payload: UnbanPlayerPayload = { unique_id: uniqueId };

      if (apiConfig) {
        try {
          showToast(`Attempting to unban player ${uniqueId}...`);
          const response = await invoke<ApiResponse<null>>(action, { config: apiConfig, payload });
          if (response.succeeded) {
            showToast("Player successfully unbanned");
            fetchBanList();
          } else {
            showToast(`Unban failed: ${response.message || "Unknown error"}`);
          }
        } catch (error) {
          console.error(`Error invoking ${action}:`, error);
          showToast(`Error during unban action: ${error}`);
        }
      } else {
        showToast("Error: API configuration is missing.");
      }
    }
  });

  refreshPlayerListIconEl = document.querySelector<HTMLImageElement>("#refresh-player-list-icon");
  if (refreshPlayerListIconEl) {
    refreshPlayerListIconEl.addEventListener("click", () => {
      console.log("Refresh icon clicked, showing toast and fetching player list...");
      showToast("Refreshing player list"); 
      consecutivePlayerFetchErrors = 0;
      
      if (!isPlayerPollingActive || playerListPollIntervalId === null) {
        const pollRate = apiConfig?.player_list_poll_rate_seconds ?? 30;
        startPlayerListPolling(pollRate);
      } else {
        fetchPlayerList();
      }
    });
  } else {
    console.error("Refresh player list icon element not found!");
  }
  
  if (refreshBanListIconEl) {
    refreshBanListIconEl.addEventListener("click", () => {
      console.log("Refresh ban list icon clicked, showing toast and fetching ban list...");
      showToast("Refreshing ban list"); 
      consecutiveBanFetchErrors = 0;
      
      if (!isBanPollingActive || banListPollIntervalId === null) {
        startBanListPolling(30);
      } else {
        fetchBanList();
      }
    });
  } else {
    console.error("Refresh ban list icon element not found!");
  }

  if (hostInputEl) {
    hostInputEl.addEventListener('input', (event) => {
      const input = event.target as HTMLInputElement;
      let currentValue = input.value;
      
      let cleanedValue = currentValue
        .replace(/[^0-9.]/g, '')
        .replace(/\.{2,}/g, '.');

      const periods = cleanedValue.match(/\./g) || [];
      if (periods.length > 3) {
        cleanedValue = cleanedValue.substring(0, cleanedValue.lastIndexOf('.'));
      }
      
      const octets = cleanedValue.split('.');
      for (let i = 0; i < octets.length; i++) {
        if (octets[i].length > 0) {
          let octetValue = parseInt(octets[i], 10);
          
          if (octets[i].length > 1 && octets[i][0] === '0') {
            octets[i] = octetValue.toString();
          }
          
          if (octetValue > 255) {
            octets[i] = '255';
          }
        }
      }
      
      cleanedValue = octets.join('.');
      
      if (input.value !== cleanedValue) {
        input.value = cleanedValue;
      }
    });
  }

  const passwordInput = document.getElementById('api-password') as HTMLInputElement;
  passwordInput.type = 'text';

  if (playerListBodyEl) {
    playerListBodyEl.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
  }
  if (banListBodyEl) {
    banListBodyEl.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
  }
});

const originalConsoleError = console.error;
console.error = function(...args) {
  if (suppressConsoleErrors && typeof args[0] === 'string' && 
      (args[0].includes('Failed to fetch') || args[0].includes('Error fetching'))) {
    return;
  }
  originalConsoleError.apply(console, args);
};
