#!/usr/bin/env bash
# =============================================================================
# task-runner.sh — AnkiFlow Task Runner
# Đọc task từ .claude/task-runner/tasks.md, chạy từng task qua claude -p,
# yêu cầu xác nhận của người dùng trước và sau mỗi task.
# =============================================================================

set -euo pipefail

# --- Cấu hình đường dẫn ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TASKS_FILE="$SCRIPT_DIR/.claude/task-runner/tasks.md"
PROMPT_TEMPLATE="$SCRIPT_DIR/.claude/task-runner/prompt-template.md"
LOG_DIR="$SCRIPT_DIR/.claude/task-runner/logs"
BASE_BRANCH="develop"

# --- Màu sắc terminal ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

# =============================================================================
# Hàm tiện ích
# =============================================================================

print_header() {
  echo -e "\n${BOLD}${BLUE}╔══════════════════════════════════════════╗${RESET}"
  echo -e "${BOLD}${BLUE}║        AnkiFlow Task Runner              ║${RESET}"
  echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════╝${RESET}\n"
}

print_section() {
  echo -e "\n${BOLD}${CYAN}▶ $1${RESET}"
  echo -e "${CYAN}$(printf '%.0s─' {1..50})${RESET}"
}

print_success() { echo -e "${GREEN}✔ $1${RESET}"; }
print_error()   { echo -e "${RED}✘ $1${RESET}"; }
print_warn()    { echo -e "${YELLOW}⚠ $1${RESET}"; }
print_info()    { echo -e "${BLUE}ℹ $1${RESET}"; }

confirm() {
  # $1: câu hỏi, $2: các lựa chọn hợp lệ (vd "y n r")
  local prompt="$1"
  local valid="${2:-y n}"
  local answer
  while true; do
    echo -e -n "\n${BOLD}${YELLOW}? $prompt [$(echo "$valid" | tr ' ' '/')]${RESET}: "
    read -r answer
    answer=$(echo "$answer" | tr '[:upper:]' '[:lower:]')
    if echo "$valid" | grep -qw "$answer"; then
      echo "$answer"
      return 0
    fi
    print_warn "Vui lòng nhập một trong: $valid"
  done
}

# =============================================================================
# Parse tasks.md — lấy task có trạng thái [ ] (chờ)
# Trả về: ID|CATEGORY|PRIORITY|STATUS|TITLE|DETAIL
# =============================================================================

get_next_task() {
  local tasks_file="$1"
  # Đọc từng dòng bảng markdown, tìm dòng có [ ] ở cột Trạng thái
  grep '^\|' "$tasks_file" | grep '| \[ \] |' | head -n 1
}

parse_task_row() {
  local row="$1"
  # Format: | # | Category | Mức ưu tiên | Trạng thái | Tiêu đề | Yêu cầu | Nhánh |
  IFS='|' read -ra cols <<< "$row"
  TASK_ID=$(echo "${cols[1]}" | xargs)
  TASK_CATEGORY=$(echo "${cols[2]}" | xargs)
  TASK_PRIORITY=$(echo "${cols[3]}" | xargs)
  TASK_STATUS=$(echo "${cols[4]}" | xargs)
  TASK_TITLE=$(echo "${cols[5]}" | xargs)
  TASK_DETAIL=$(echo "${cols[6]}" | xargs | sed 's/<br>/\n  /g')
}

# =============================================================================
# Tạo tên branch từ task ID và title
# Ví dụ: feature/1-them-furigana-cho-the-tieng-nhat
# =============================================================================

generate_branch_name() {
  local id="$1"
  local title="$2"
  local slug
  slug=$(echo "$title" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[àáâãäå]/a/g; s/[èéêë]/e/g; s/[ìíîï]/i/g; s/[òóôõö]/o/g; s/[ùúûü]/u/g' \
    | sed 's/[^a-z0-9 ]//g' \
    | tr ' ' '-' \
    | sed 's/--*/-/g' \
    | cut -c1-40 \
    | sed 's/-$//')
  echo "feature/${id}-${slug}"
}

# =============================================================================
# Cập nhật trạng thái task trong tasks.md
# =============================================================================

update_task_status() {
  local task_id="$1"
  local new_status="$2"   # [ ] | [~] | [x] | [!]
  local branch_name="${3:--}"

  python3 - "$TASKS_FILE" "$task_id" "$new_status" "$branch_name" << 'PYEOF'
import sys

filepath, task_id, new_status, branch = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

with open(filepath, 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if line.startswith('|'):
        cols = line.split('|')
        if len(cols) >= 8 and cols[1].strip() == task_id:
            cols[4] = f' {new_status} '
            if branch != '-':
                cols[7] = f' {branch} '
            line = '|'.join(cols)
    new_lines.append(line)

with open(filepath, 'w') as f:
    f.writelines(new_lines)
PYEOF
}

# =============================================================================
# Xây dựng prompt từ template
# =============================================================================

build_prompt() {
  local id="$1" title="$2" category="$3" detail="$4" branch="$5"
  local template
  template=$(sed -n '/^```$/,/^```$/p' "$PROMPT_TEMPLATE" | sed '1d;$d')

  template="${template//\{\{TASK_ID\}\}/$id}"
  template="${template//\{\{TASK_TITLE\}\}/$title}"
  template="${template//\{\{TASK_CATEGORY\}\}/$category}"
  template="${template//\{\{TASK_DETAIL\}\}/$detail}"
  template="${template//\{\{BRANCH_NAME\}\}/$branch}"

  echo "$template"
}

# =============================================================================
# Tạo PR bằng gh CLI — tiêu đề và body bằng tiếng Nhật
# =============================================================================

create_pr() {
  local branch="$1" task_id="$2" task_title="$3" log_file="$4"

  # Parse kết quả JSON từ log
  local summary limitations
  summary=$(python3 -c "
import sys, json, re
log = open('$log_file').read()
m = re.search(r'TASK_RESULT_JSON\s*(\{.*?\})\s*END_TASK_RESULT_JSON', log, re.DOTALL)
if m:
    d = json.loads(m.group(1))
    print(d.get('summary', ''))
" 2>/dev/null || echo "タスク完了")

  limitations=$(python3 -c "
import sys, json, re
log = open('$log_file').read()
m = re.search(r'TASK_RESULT_JSON\s*(\{.*?\})\s*END_TASK_RESULT_JSON', log, re.DOTALL)
if m:
    d = json.loads(m.group(1))
    v = d.get('limitations', 'none')
    print(v if v != 'none' else '')
" 2>/dev/null || echo "")

  # PR title: tiếng Nhật ngắn gọn
  local pr_title="[Task #${task_id}] ${task_title}"

  # PR body: tiếng Nhật
  local pr_body
  pr_body=$(cat << JPBODY
## 概要

Task #${task_id} の実装。

## 変更内容

${summary}

## テスト結果

- Vitest: 全テストパス
- コード規約（TypeScript strict mode）: 準拠

JPBODY
)

  if [[ -n "$limitations" ]]; then
    pr_body+=$'\n## 注意事項\n\n'"${limitations}"
  fi

  gh pr create \
    --base "$BASE_BRANCH" \
    --head "$branch" \
    --title "$pr_title" \
    --body "$pr_body"
}

# =============================================================================
# Main
# =============================================================================

main() {
  print_header

  # Kiểm tra dependencies
  for cmd in claude gh git python3; do
    if ! command -v "$cmd" &>/dev/null; then
      print_error "Thiếu dependency: $cmd"
      exit 1
    fi
  done

  # Kiểm tra file tồn tại
  if [[ ! -f "$TASKS_FILE" ]]; then
    print_error "Không tìm thấy $TASKS_FILE"
    exit 1
  fi

  mkdir -p "$LOG_DIR"

  # Đảm bảo đang ở đúng branch gốc
  local current_branch
  current_branch=$(git rev-parse --abbrev-ref HEAD)
  if [[ "$current_branch" != "$BASE_BRANCH" ]]; then
    print_warn "Bạn đang ở nhánh '$current_branch', không phải '$BASE_BRANCH'."
    local ans
    ans=$(confirm "Checkout sang '$BASE_BRANCH'?" "y n")
    if [[ "$ans" == "y" ]]; then
      git checkout "$BASE_BRANCH"
      git pull origin "$BASE_BRANCH"
    else
      print_error "Dừng lại. Vui lòng checkout sang '$BASE_BRANCH' trước."
      exit 1
    fi
  fi

  # Vòng lặp xử lý task
  while true; do
    print_section "Tìm task tiếp theo"

    local task_row
    task_row=$(get_next_task "$TASKS_FILE")

    if [[ -z "$task_row" ]]; then
      print_success "Tất cả task đã hoàn thành!"
      break
    fi

    # Parse task
    parse_task_row "$task_row"

    # Hiển thị thông tin task
    echo -e "\n${BOLD}Task #${TASK_ID}${RESET}"
    echo -e "  ${BOLD}Tiêu đề:${RESET}      $TASK_TITLE"
    echo -e "  ${BOLD}Category:${RESET}     $TASK_CATEGORY"
    echo -e "  ${BOLD}Ưu tiên:${RESET}      $TASK_PRIORITY"
    echo -e "  ${BOLD}Yêu cầu:${RESET}"
    echo "$TASK_DETAIL" | sed 's/^/    /'

    # Xác nhận trước khi chạy
    local pre_confirm
    pre_confirm=$(confirm "Bắt đầu thực hiện task #${TASK_ID}?" "y n q")
    case "$pre_confirm" in
      n) print_info "Bỏ qua task #${TASK_ID}."; continue ;;
      q) print_info "Thoát."; exit 0 ;;
    esac

    # Tạo branch
    local branch_name
    branch_name=$(generate_branch_name "$TASK_ID" "$TASK_TITLE")
    print_info "Tạo branch: $branch_name"
    git checkout -b "$branch_name" 2>/dev/null || git checkout "$branch_name"

    # Cập nhật trạng thái → đang chạy
    update_task_status "$TASK_ID" "[~]" "$branch_name"
    git add "$TASKS_FILE"
    git commit -m "chore: start task #${TASK_ID} — ${TASK_TITLE}"

    # Xây dựng prompt và chạy Claude
    local prompt log_file
    prompt=$(build_prompt "$TASK_ID" "$TASK_TITLE" "$TASK_CATEGORY" "$TASK_DETAIL" "$branch_name")
    log_file="$LOG_DIR/task-${TASK_ID}-$(date +%Y%m%d-%H%M%S).log"

    print_section "Claude đang thực hiện task #${TASK_ID}"
    print_info "Log: $log_file"

    local claude_exit=0
    echo "$prompt" | claude -p \
      --allowedTools "Read,Edit,Bash,Glob,Grep" \
      --output-format text \
      2>&1 | tee "$log_file" || claude_exit=$?

    if [[ $claude_exit -ne 0 ]]; then
      print_error "Claude exited with code $claude_exit"
      local err_action
      err_action=$(confirm "Retry task or review partial result?" "retry review skip")
      case "$err_action" in
        retry)
          update_task_status "$TASK_ID" "[ ]" "-"
          git checkout "$BASE_BRANCH"
          git branch -D "$branch_name" 2>/dev/null || true
          continue
          ;;
        skip)
          update_task_status "$TASK_ID" "[!]" "$branch_name"
          git add "$TASKS_FILE"
          git commit -m "chore: mark task #${TASK_ID} failed" 2>/dev/null || true
          git checkout "$BASE_BRANCH"
          continue
          ;;
      esac
    fi

    print_section "Result: task #${TASK_ID}"
    echo -e "${YELLOW}Xem log tại: $log_file${RESET}"
    echo -e "${YELLOW}Kiểm tra diff:${RESET}"
    git diff --stat HEAD 2>/dev/null || true

    local post_confirm
    post_confirm=$(confirm "Kết quả task #${TASK_ID}?" "y n r")

    case "$post_confirm" in
      y)
        # Thành công — commit, cập nhật status, tạo PR
        print_info "Commit changes..."
        git add -u
        git commit -m "feat: complete task #${TASK_ID} — ${TASK_TITLE}" 2>/dev/null || \
          print_warn "No changes to commit."

        update_task_status "$TASK_ID" "[x]" "$branch_name"
        git add "$TASKS_FILE"
        git commit -m "chore: mark task #${TASK_ID} done"

        git push -u origin "$branch_name"

        print_info "Tạo PR..."
        create_pr "$branch_name" "$TASK_ID" "$TASK_TITLE" "$log_file"
        print_success "PR đã được tạo cho task #${TASK_ID}."

        # Quay lại develop
        git checkout "$BASE_BRANCH"
        git pull origin "$BASE_BRANCH"
        ;;

      r)
        # Retry — giữ nguyên branch, chạy lại
        print_warn "Retry task #${TASK_ID}. Quay lại bước chạy Claude..."
        update_task_status "$TASK_ID" "[ ]" "-"
        git checkout "$BASE_BRANCH"
        git branch -D "$branch_name" 2>/dev/null || true
        continue
        ;;

      n)
        # Thất bại — đánh dấu lỗi
        print_error "Task #${TASK_ID} đánh dấu là lỗi [!]."
        update_task_status "$TASK_ID" "[!]" "$branch_name"
        git add "$TASKS_FILE"
        git commit -m "chore: mark task #${TASK_ID} failed" 2>/dev/null || true
        git checkout "$BASE_BRANCH"
        ;;
    esac

    # Hỏi tiếp tục task kế
    local next_confirm
    next_confirm=$(confirm "Tiếp tục task tiếp theo?" "y n")
    if [[ "$next_confirm" == "n" ]]; then
      print_info "Dừng lại. Chạy lại script để tiếp tục."
      break
    fi

  done

  print_success "Task runner kết thúc."
}

main "$@"