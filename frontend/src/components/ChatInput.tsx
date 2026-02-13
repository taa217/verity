import type { KeyboardEvent } from "react";
import { Send } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

// ---------------------------------------------------------------------------
// ChatInput
// ---------------------------------------------------------------------------
export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Ask anything. Type @ for mentions and / for shortcuts.",
  autoFocus = false,
}: ChatInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) onSend();
  };

  return (
    <div className="chat-input-container">
      <input
        type="text"
        className="chat-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoFocus={autoFocus}
      />
      <button
        className="send-btn"
        onClick={() => onSend()}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
      >
        <Send size={16} />
      </button>
    </div>
  );
}
