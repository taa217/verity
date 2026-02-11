import { Play, BookOpen, Target } from "lucide-react";
import ChatInput from "./ChatInput";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface HeroViewProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// HeroView — landing / idle state
// ---------------------------------------------------------------------------
export default function HeroView({
  input,
  onInputChange,
  onSend,
  isLoading,
}: HeroViewProps) {
  return (
    <div className="hero">
      <h1 className="hero__title">What do you want to learn?</h1>

      <ChatInput
        value={input}
        onChange={onInputChange}
        onSend={onSend}
        disabled={isLoading}
        autoFocus
      />

      <div className="hero__shortcuts">
        <button className="hero__shortcut" title="Quick lesson">
          <Play size={16} />
        </button>
        <button className="hero__shortcut" title="Browse topics">
          <BookOpen size={16} />
        </button>
        <button className="hero__shortcut" title="Learning goals">
          <Target size={16} />
        </button>
      </div>

      <p className="hero__subtitle">
        Start your learning journey with AI-powered assistance
      </p>
    </div>
  );
}
