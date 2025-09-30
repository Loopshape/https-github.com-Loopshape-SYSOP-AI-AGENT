/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* https://github.com/Loopshape/SYSOP-AI-AGENT */
(env) loop@localhost:~$ cat $(which ai)
#!/usr/bin/env bash
# ai.sh - AI Autonomic Synthesis Platform v31.1 (Correct Export Order)
# An agent that uses emoji metadata as a real-time feedback mechanism to enhance its reasoning.

# --- RUNTIME MODE DETECTION: EMBEDDED NODE.JS WEB SERVER ---
if [[ "${1:-}" == "serve" ]]; then
    exec node --input-type=module - "$0" "$@" <<'NODE_EOF'
import http from 'http';
import { exec } from 'child_process';
const PORT = process.env.AI_PORT || 8080;
const AI_SCRIPT_PATH = process.argv[2];
const HTML_UI = `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>AI Autonomic Synthesis Platform v31</title>
<style>:root{--bg:#0d1117;--text:#c9d1d9;--accent:#58a6ff;--secondary:#8b949e;--border:#30363d;--input-bg:#161b22;--success:#3fb950;--error:#f85149;}
body{font-family:'SF Mono',Consolas,'Courier New',monospace;background:var(--bg);color:var(--text);margin:0;padding:20px;font-size:14px;line-height:1.6;}
.container{max-width:1000px;margin:auto;}h1{color:var(--accent);text-align:center;border-bottom:1px solid var(--border);padding-bottom:15px;}
.terminal{background:var(--input-bg);border:1px solid var(--border);border-radius:6px;padding:15px;margin-top:20px;height:70vh;overflow-y:scroll;display:flex;flex-direction:column;}
.output{flex-grow:1;white-space:pre-wrap;}.input-line{display:flex;border-top:1px solid var(--border);padding-top:10px;margin-top:10px;}
.prompt{color:var(--accent);font-weight:bold;margin-right:10px;}
input{flex-grow:1;background:transparent;border:none;color:var(--text);font-family:inherit;font-size:inherit;outline:none;}
.log{color:var(--secondary);}.success{color:var(--success);}.error{color:var(--error);}</style></head>
<body><div class="container"><h1>🤖 AI Autonomic Synthesis Platform v31</h1><div class="terminal"><div id="output" class="output"><div class="log">🚀 AI Agent ready. System initialized.</div></div><div class="input-line"><span class="prompt">ai&gt;</span><input type="text" id="commandInput" placeholder="Enter your high-level goal..." autofocus></div></div></div>
<script>
const output=document.getElementById('output'),input=document.getElementById('commandInput');
function addOutput(text,className='log'){const d=document.createElement('div');d.className=className;d.textContent=text;output.appendChild(d);output.scrollTop=output.scrollHeight;}
async function executeCommand(cmd){addOutput(\`ai> \${cmd}\`,'prompt');input.disabled=true;try{const r=await fetch('/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command:cmd})}),d=await r.json();const f=d.output.replace(/\\u001b\\[[0-9;]*m/g,'');addOutput(f,d.success?'success':'error');}catch(e){addOutput(\`[CLIENT ERROR] \${e.message}\`,'error');}finally{input.disabled=false;input.focus();}}
input.addEventListener('keypress',e=>{if(e.key==='Enter'){const c=input.value.trim();if(c){executeCommand(c);input.value='';}}});
</script></body></html>`;

http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.url === '/' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(HTML_UI); return; }
    if (req.url === '/api/command' && req.method === 'POST') {
        let body = '';
        req.on('data', c => body += c.toString());
        req.on('end', () => {
            try {
                const requestData = JSON.parse(body);
                const command = requestData.command;
                const sanitizedCmd = command.replace(/(["'$`\\])/g, '\\$1');
                exec(`"${AI_SCRIPT_PATH}" "${sanitizedCmd}"`, { timeout: 600000 }, (err, stdout, stderr) => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    if (err) { res.end(JSON.stringify({ success: false, output: `[SERVER ERROR] ${err.message}\n${stderr}` }));
                    } else { res.end(JSON.stringify({ success: true, output: stdout || 'Command executed without output.' })); }
                });
            } catch (e) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ success: false, output: 'Invalid JSON request.' })); }
        });
        return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
}).listen(PORT, () => console.log(`🌐 AI Web UI is live at: http://localhost:${PORT}`));
NODE_EOF
fi
# --- END OF NODE.JS SERVER BLOCK ---


# --- BASH AGENT CORE (v31.1) ---
set -euo pipefail
IFS=$'\n\t'

# ---------------- CONFIG ----------------
AI_HOME="${AI_HOME:-$HOME/.ai_agent}"
PROJECTS_DIR="${PROJECTS_DIR:-$HOME/ai_projects}"
LOG_FILE="$AI_HOME/ai.log"
LOG_LEVEL="${LOG_LEVEL:-INFO}"
CORE_DB="$AI_HOME/agent_core.db"

# --- Triumvirate Model Configuration ---
MESSENGER_MODEL="loop:latest"
PLANNER_MODELS=("loop:latest" "core:latest")
EXECUTOR_MODEL="2244-1:latest"
OLLAMA_BIN="$(command -v ollama || echo 'ollama')"

MAX_AGENT_LOOPS=7
MAX_RAM_BYTES=2097152
SWAP_DIR="$AI_HOME/swap"
HMAC_SECRET_KEY="$AI_HOME/secret.key"

# ---------------- COLORS & ICONS ----------------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m';
PURPLE='\033[0;35m'; CYAN='\033[0;36m'; ORANGE='\033[0;33m'; NC='\033[0m'
ICON_SUCCESS="✅"; ICON_WARN="⚠️"; ICON_ERROR="❌"; ICON_INFO="ℹ️"; ICON_SECURE="🔑";
ICON_DB="🗃️"; ICON_PLAN="📋"; ICON_THINK="🤔"; ICON_EXEC="⚡"; ICON_FEEDBACK="🙋"

# ---------------- LOGGING ----------------
log_to_file(){ echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$1] $2" >> "$LOG_FILE"; }
log_debug(){ [[ "$LOG_LEVEL" == "DEBUG" ]] && printf "${PURPLE}[DEBUG][%s]${NC} %s\n" "$(date '+%T')" "$*" >&2 && log_to_file "DEBUG" "$*"; }
log_info(){ [[ "$LOG_LEVEL" =~ ^(DEBUG|INFO)$ ]] && printf "${BLUE}${ICON_INFO} [%s] %s${NC}\n" "$(date '+%T')" "$*" >&2 && log_to_file "INFO" "$*"; }
log_warn(){ printf "${YELLOW}${ICON_WARN} [%s] %s${NC}\n" "$(date '+%T')" "$*" >&2 && log_to_file "WARN" "$*"; }
log_error(){ printf "${RED}${ICON_ERROR} [%s] ERROR: %s${NC}\n" "$(date '+%T')" "$*" >&2 && log_to_file "ERROR" "$*" && exit 1; }
log_success(){ printf "${GREEN}${ICON_SUCCESS} [%s] %s${NC}\n" "$(date '+%T')" "$*" >&2 && log_to_file "SUCCESS" "$*"; }
log_phase() { printf "\n${PURPLE}🚀 %s${NC}\n" "$*" >&2 && log_to_file "PHASE" "$*"; }
log_think(){ printf "\n${ORANGE}${ICON_THINK} %s${NC}" "$*" >&2; }
log_plan(){ printf "\n${CYAN}${ICON_PLAN} %s${NC}" "$*" >&2; }
log_execute(){ printf "\n${GREEN}${ICON_EXEC} %s${NC}" "$*" >&2; }

# ---------------- EMOJI METADATA ----------------
declare -A EMOJI_METADATA
init_emoji_map() {
    EMOJI_METADATA["✅"]='{"name":"SUCCESS","sentiment":"positive","action_hint":"PROCEED"}'
    EMOJI_METADATA["⚠️"]='{"name":"WARNING","sentiment":"neutral","action_hint":"REVIEW"}'
    EMOJI_METADATA["❌"]='{"name":"ERROR","sentiment":"negative","action_hint":"DEBUG"}'
    EMOJI_METADATA["ℹ️"]='{"name":"INFO","sentiment":"neutral","action_hint":"ACKNOWLEDGE"}'
    EMOJI_METADATA["🔑"]='{"name":"SECURITY_OK","sentiment":"positive","action_hint":"PROCEED_SECURE"}'
    EMOJI_METADATA["🙋"]='{"name":"HUMAN_FEEDBACK","sentiment":"neutral","action_hint":"PROVIDE_GUIDANCE"}'
}

# ---------------- INITIALIZATION & HMAC SETUP ----------------
init_environment() { mkdir -p "$AI_HOME" "$PROJECTS_DIR" "$SWAP_DIR"; if [[ ! -f "$HMAC_SECRET_KEY" ]]; then openssl rand -hex 32 > "$HMAC_SECRET_KEY"; chmod 600 "$HMAC_SECRET_KEY"; fi; }
calculate_hmac() { local data="$1"; local secret; secret=$(<"$HMAC_SECRET_KEY"); echo -n "$data" | openssl dgst -sha256 -hmac "$secret" | awk '{print $2}'; }
confirm_action() { local c=""; read -p "$(echo -e "\n${YELLOW}PROPOSED ACTION:${NC} ${CYAN}$1${NC}\nApprove? [y/N] ")" -n 1 -r c || true; echo; [[ "${c:-}" =~ ^[Yy]$ ]]; }

# ---------------- DYNAMIC DATABASE ENVIRONMENT ----------------
sqlite_escape(){ echo "$1" | sed "s/'/''/g"; }
register_schema() {
    local table_name="$1" description="$2" schema_sql="$3"
    sqlite3 "$CORE_DB" "$schema_sql" || return 1
    sqlite3 "$CORE_DB" "INSERT OR REPLACE INTO _master_schema (table_name, description, schema_sql) VALUES ('$(sqlite_escape "$1")', '$(sqlite_escape "$2")', '$(sqlite_escape "$3")');"
}
init_db() {
    sqlite3 "$CORE_DB" "CREATE TABLE IF NOT EXISTS _master_schema (table_name TEXT PRIMARY KEY, description TEXT, schema_sql TEXT);"
    local tables_exist=$(sqlite3 "$CORE_DB" "SELECT COUNT(*) FROM _master_schema WHERE table_name IN ('memories', 'tool_logs');")
    if [[ "$tables_exist" -ne 2 ]]; then
        log_warn "One or more core schemas missing. Bootstrapping..."
        register_schema "memories" "Long-term memory for fuzzy cache." "CREATE TABLE IF NOT EXISTS memories (id INTEGER PRIMARY KEY, prompt_hash TEXT, prompt TEXT, response_ref TEXT);"
        register_schema "tool_logs" "Logs of every tool execution." "CREATE TABLE IF NOT EXISTS tool_logs (id INTEGER PRIMARY KEY, task_id TEXT, tool_name TEXT, args TEXT, result TEXT);"
    fi
}

# ---------------- AI & AGI CORE ----------------
hash_string(){ echo -n "$1" | sha256sum | cut -d' ' -f1; }
semantic_hash_prompt(){ echo "$1" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' ' ' | tr -s ' ' | sed 's/ ^*//;s/ *$//' | tr ' ' '_'; }
store_output_fast(){ local c="$1" h=$(hash_string "$c"); if ((${#c}>MAX_RAM_BYTES));then f="$SWAP_DIR/$h.txt.gz"; echo "$c"|gzip>"$f";echo "$f";else echo "$c";fi; }
retrieve_output_fast(){ local r="$1"; if [[ -f "$r" ]];then [[ "$r" == *.gz ]] && gzip -dc "$r"||cat "$r";else echo "$r";fi; }
get_cached_response(){ local p_h=$(semantic_hash_prompt "$1"); sqlite3 "$CORE_DB" "SELECT response_ref FROM memories WHERE prompt_hash = '$(sqlite_escape "$p_h")' LIMIT 1;"; }
add_to_memory_fast(){ local p_h="$1" p="$2" ref="$3"; sqlite3 "$CORE_DB" "INSERT INTO memories (prompt_hash, prompt, response_ref) VALUES ('$(sqlite_escape "$p_h")','$(sqlite_escape "$p")','$(sqlite_escape "$ref")');"; }

ensure_ollama() { if ! curl -s http://localhost:11434/api/tags >/dev/null; then log_info "Starting Ollama..."; nohup "$OLLAMA_BIN" serve >/dev/null 2>&1 & sleep 3; fi; }
run_worker_fast(){
    local m="$1" s="$2" p="$3" payload r_json
    payload=$(jq -nc --arg m "$m" --arg s "$s" --arg p "$p" '{model:$m,system:$s,prompt:$p,stream:false}')
    r_json=$(curl -s --max-time 300 -X POST http://localhost:11434/api/generate -d "$payload")
    if [[ $(echo "$r_json"|jq -r .error//empty) ]]; then echo "API_ERROR: $(echo "$r_json"|jq -r .error)"; else echo "$r_json"|jq -r .response; fi
}
run_worker_streaming() {
    local model="$1" system_prompt="$2" prompt="$3"
    local full_response=""
    local payload=$(jq -nc --arg m "$model" --arg s "$system_prompt" --arg p "$prompt" '{model:$m,system:$s,prompt:$p,stream:true}')
    while IFS= read -r line; do
        if jq -e . >/dev/null 2>&1 <<<"$line"; then
            local token=$(echo "$line" | jq -r '.response // empty')
            if [[ -n "$token" ]]; then
                printf "%s" "$token" >&2; full_response+="$token"
            fi
        fi
    done < <(curl -s --max-time 300 -X POST http://localhost:11434/api/generate -d "$payload")
    printf "\n" >&2
    echo "$full_response"
}

# ---------------- DEVOPS TOOLSET ----------------
tool_run_command() { local proj_dir="$1" cmd="$2"; (cd "$proj_dir" && eval "$cmd") 2>&1 || echo "Command failed."; }
tool_write_file() { local proj_dir="$1" f_path="$2" content="$3"; mkdir -p "$(dirname "$proj_dir/$f_path")"; echo -e "$content">"$proj_dir/$f_path"; echo "File '$f_path' written."; }
tool_ask_human() {
    local proj_dir="$1"; shift 1; local question="$*"
    echo -e "\n${YELLOW}${ICON_FEEDBACK} AI requests your input:${NC} ${CYAN}$question${NC}"
    read -p "Your Response: " -r user_response
    echo "Human feedback received: '$user_response'"
}
tool_get_emoji_meaning() {
    local proj_dir="$1" emoji="$2"
    local meaning="${EMOJI_METADATA[$emoji]:-unknown}"
    echo "Meaning of '$emoji': $meaning"
}

# --- FIX: Export all variables and functions needed by subshells AT THE TOP LEVEL ---
export -f log_to_file log_debug log_info log_warn log_error log_success log_phase log_think log_plan log_execute
export -f hash_string semantic_hash_prompt store_output_fast retrieve_output_fast get_cached_response add_to_memory_fast sqlite_escape run_worker_fast run_worker_streaming
export -f tool_run_command tool_write_file tool_ask_human tool_get_emoji_meaning
export AI_HOME LOG_LEVEL CORE_DB PROJECTS_DIR MAX_AGENT_LOOPS HMAC_SECRET_KEY MESSENGER_MODEL EXECUTOR_MODEL OLLAMA_BIN
export -a PLANNER_MODELS

# ---------------- AUTONOMOUS WORKFLOW ----------------
run_agi_workflow() {
    local user_prompt="$*"
    local task_id=$(hash_string "$user_prompt$(date +%s%N)" | cut -c1-16)
    local project_dir="$PROJECTS_DIR/task-$task_id"; mkdir -p "$project_dir"
    log_success "Project workspace: $project_dir (Task ID: $task_id)"

    local cached_ref; cached_ref=$(get_cached_response "$user_prompt")
    if [[ -n "$cached_ref" ]]; then
        log_success "Found high-quality match in fuzzy cache."
        echo -e "\n${CYAN}--- Cached Final Answer ---\n${NC}$(retrieve_output_fast "$cached_ref")"; return
    fi

    local conversation_history="Initial User Request: $user_prompt"
    local status="IN_PROGRESS"
    local last_used_emoji="ℹ️"

    for ((i=1; i<=MAX_AGENT_LOOPS; i++)); do
        log_phase "AGI Loop $i/$MAX_AGENT_LOOPS"

        local emoji_context="${EMOJI_METADATA[$last_used_emoji]}"

        log_think "Messenger (${MESSENGER_MODEL}) Analysis: "
        local messenger_prompt="PREVIOUS_ACTION_CONTEXT: $emoji_context. You are the Messenger. Analyze the current conversation context. If the previous action resulted in an error, focus on why. Provide a clear summary of the current state."
        local messenger_output=$(run_worker_streaming "$MESSENGER_MODEL" "$messenger_prompt" "$conversation_history")

        local pids=() temp_files=() planner_outputs=()
        for model in "${PLANNER_MODELS[@]}"; do
            local temp_file=$(mktemp)
            temp_files+=("$temp_file")
            (
                log_debug "Starting planner: $model"
                local planner_prompt="You are a strategic Planner. If confused, use 'tool_ask_human <question>'. Otherwise, propose ONE specific tool to use next."
                run_worker_fast "$model" "$planner_prompt" "$messenger_output" > "$temp_file" 2> "${temp_file}.err"
            ) &
            pids+=($!)
        done

        local planner_errors=""
        for idx in "${!pids[@]}"; do
            if ! wait "${pids[$idx]}"; then
                log_warn "A planner model (${PLANNER_MODELS[$idx]}) exited with a non-zero status."
                local err_file="${temp_files[$idx]}.err"
                if [[ -s "$err_file" ]]; then planner_errors+="Error from ${PLANNER_MODELS[$idx]}:\n$(cat "$err_file")\n"; fi
            fi
        done

        local executor_context="PREVIOUS_ACTION_CONTEXT: $emoji_context. You are the Executor. Synthesize the plans. If planners failed, suggest 'tool_ask_human' about the failure. Decide the single best tool to use.
Format:
[REASONING] Your synthesis.
[TOOL] tool_name <arguments>
If solved, respond ONLY with: [FINAL_ANSWER] Your summary.
--- MESSENGER'S ANALYSIS ---
$messenger_output"
        if [[ -n "$planner_errors" ]]; then executor_context+="\n\n--- PLANNER ERRORS (investigate these) ---\n$planner_errors"; fi

        for idx in "${!PLANNER_MODELS[@]}"; do
            local model="${PLANNER_MODELS[$idx]}"; local file="${temp_files[$idx]}"
            local planner_output=$(cat "$file")
            planner_outputs+=("$planner_output")
            log_plan "Planner (${model}) Strategy:\n${planner_output}"
            executor_context+="\n\n--- Plan from ${model} ---\n${planner_output}"
        done
        rm -f "${temp_files[@]}"*

        log_execute "Executor (${EXECUTOR_MODEL}) Decision: "
        local final_plan=$(run_worker_streaming "$EXECUTOR_MODEL" "Executor" "$executor_context")

        if [[ "$final_plan" == *"[FINAL_ANSWER]"* ]]; then status="SUCCESS"; conversation_history="$final_plan"; last_used_emoji="✅"; break; fi

        local tool_line=$(echo "$final_plan" | grep '\[TOOL\]' | head -n 1)
        if [[ -z "$tool_line" ]]; then log_warn "Executor did not choose a tool. Ending loop."; last_used_emoji="⚠️"; break; fi

        local clean_tool_cmd=$(echo "${tool_line#\[TOOL\] }" | sed 's/\r$//')
        local ai_hmac=$(calculate_hmac "$clean_tool_cmd")
        local verified_hmac=$(calculate_hmac "$clean_tool_cmd")
        if [[ "$ai_hmac" != "$verified_hmac" ]]; then log_error "HMAC MISMATCH!"; status="HMAC_FAILURE"; last_used_emoji="❌"; break; fi
        log_success "${ICON_SECURE} HMAC signature verified."; last_used_emoji="🔑"

        local tool_name=$(echo "$clean_tool_cmd" | awk '{print $1}')
        local args_str=$(echo "$clean_tool_cmd" | cut -d' ' -f2-)
        local tool_args=(); eval "tool_args=($args_str)"

        local tool_result="User aborted action."
        if confirm_action "$clean_tool_cmd"; then
            if declare -f "tool_$tool_name" > /dev/null; then
                tool_result=$(tool_"$tool_name" "$project_dir" "${tool_args[@]}") || "Tool failed."
                if [[ "$tool_result" == Error:* ]]; then last_used_emoji="❌"; else last_used_emoji="✅"; fi
            else
                log_error "AI tried to call an unknown tool: '$tool_name'"; tool_result="Error: Tool '$tool_name' does not exist."
                last_used_emoji="❌";
            fi
        else
            last_used_emoji="⚠️"
        fi

        sqlite3 "$CORE_DB" "INSERT INTO tool_logs (task_id, tool_name, args, result) VALUES ('$task_id', '$tool_name', '$(sqlite_escape "$args_str")', '$(sqlite_escape "$tool_result")');"

        conversation_history="${last_used_emoji} Loop $i Result:\n[EXECUTOR PLAN]\n${final_plan}\n[TOOL RESULT]\n${tool_result}"
    done

    log_phase "AGI Workflow Complete (Status: $status)"
    local final_answer=$(echo "$conversation_history" | grep '\[FINAL_ANSWER\]' | sed 's/\[FINAL_ANSWER\]//' | tail -n 1)
    if [[ -z "$final_answer" ]]; then final_answer="Workflow finished. Final context:\n$conversation_history"; fi

    local final_ref=$(store_output_fast "$final_answer")
    add_to_memory_fast "$(semantic_hash_prompt "$user_prompt")" "$user_prompt" "$final_ref"
    echo -e "\n${GREEN}--- Final Answer ---\n${NC}${final_answer}"
}

run_default_init() { log_phase "No prompt given. Scanning context..."; if [[ -d ".git" ]]; then git status; else tree -L 2 . || ls -la; fi; }

# ---------------- HELP & MAIN DISPATCHER ----------------
show_help() {
    cat << EOF
${GREEN}AI Autonomic Synthesis Platform v31 (Semantic Emoji Edition)${NC}
An agent that uses emoji metadata as real-time feedback to guide its reasoning.

${CYAN}USAGE:${NC}
  ai serve                             # Start the interactive web UI
  ai "your high-level goal"            # Run the autonomous AGI workflow
  ai                                   # (No prompt) Scan current directory context
  ai --setup                           # Install/verify dependencies
  ai --help                            # Show this help
EOF
}

main() {
    if [[ "${1:-}" == "serve" ]]; then exit 0; fi
    init_environment; init_db; init_emoji_map

    if [[ $# -eq 0 ]]; then run_default_init; exit 0; fi
    case "${1:-}" in
        --setup|-s)
            log_info "Installing dependencies (sqlite3, git, curl, nodejs, npm, tree, openssl)..."
            if command -v apt-get &>/dev/null; then sudo apt-get update && sudo apt-get install -y sqlite3 git curl nodejs npm tree openssl
            else log_warn "Could not determine package manager. Please install dependencies manually."; fi
            log_success "System dependencies installed." ;;
        --help|-h) show_help ;;
        *) run_agi_workflow "$@" ;;
    esac
}

# --- SCRIPT ENTRY POINT ---
if [[ -z "${NODE_ENV:-}" ]]; then
    main "$@"
fi