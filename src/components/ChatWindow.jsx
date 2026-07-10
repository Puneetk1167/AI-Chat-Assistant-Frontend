import { useState, useRef, useEffect } from "react";
import { sendMessage } from "../services/chatApi.js";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition.js";
import { speakText } from "../hooks/useSpeechSynthesis.js";

function ChatWindow({ onClose }) {
  // State for all chat sessions
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem("ai_chat_sessions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error("Failed to parse saved sessions", e);
      }
    }
    return [
      {
        id: "default",
        title: "New Chat",
        messages: [
          { role: "model", text: "Hi! I'm your AI assistant. Ask me anything, by typing or by voice." },
        ],
        createdAt: Date.now(),
      },
    ];
  });

  // State for the currently active session ID
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const savedActive = localStorage.getItem("ai_chat_active_session_id");
    if (savedActive) {
      return savedActive;
    }
    const saved = localStorage.getItem("ai_chat_sessions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0].id;
      } catch (e) {}
    }
    return "default";
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);

  const messagesEndRef = useRef(null);

  // Sync sessions to localStorage
  useEffect(() => {
    localStorage.setItem("ai_chat_sessions", JSON.stringify(sessions));
  }, [sessions]);

  // Sync active session ID to localStorage
  useEffect(() => {
    localStorage.setItem("ai_chat_active_session_id", activeSessionId);
  }, [activeSessionId]);

  // Find the active session and its messages
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = activeSession ? activeSession.messages : [];

  // Scroll to bottom on message change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Builds the Gemini-style history array from our simple messages state.
  // Gemini requires history to start with role "user", so we drop any
  // leading "model" messages (like our initial greeting) before sending.
  const buildHistory = (msgs) => {
    const firstUserIndex = msgs.findIndex((m) => m.role === "user");
    if (firstUserIndex === -1) return [];
    return msgs.slice(firstUserIndex).map((m) => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));
  };

  const handleSend = async (textToSend) => {
    const text = (textToSend ?? input).trim();
    if (!text || isLoading) return;

    const targetSessionId = activeSessionId; // Capture current active session ID to prevent race updates
    const historyBeforeThisMessage = buildHistory(messages);
    const userMessage = { role: "user", text };

    // Update active session with the user's message
    setSessions((prevSessions) =>
      prevSessions.map((s) => {
        if (s.id === targetSessionId) {
          const updatedMessages = [...s.messages, userMessage];
          const isFirstUserMsg = !s.messages.some((m) => m.role === "user");
          const newTitle = isFirstUserMsg
            ? text.length > 25
              ? text.substring(0, 25) + "..."
              : text
            : s.title;
          return {
            ...s,
            title: newTitle,
            messages: updatedMessages,
          };
        }
        return s;
      })
    );
    setInput("");
    setIsLoading(true);

    try {
      const reply = await sendMessage(text, historyBeforeThisMessage);
      setSessions((prevSessions) =>
        prevSessions.map((s) => {
          if (s.id === targetSessionId) {
            return {
              ...s,
              messages: [...s.messages, { role: "model", text: reply }],
            };
          }
          return s;
        })
      );
      if (voiceReplyEnabled && targetSessionId === activeSessionId) speakText(reply);
    } catch (err) {
      setSessions((prevSessions) =>
        prevSessions.map((s) => {
          if (s.id === targetSessionId) {
            return {
              ...s,
              messages: [
                ...s.messages,
                { role: "model", text: "Sorry, I couldn't reach the server. Is it running?" },
              ],
            };
          }
          return s;
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    const newSession = {
      id: "session-" + Date.now(),
      title: "New Chat",
      messages: [
        { role: "model", text: "Hi! I'm your AI assistant. Ask me anything, by typing or by voice." },
      ],
      createdAt: Date.now(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleDeleteChat = (e, sessionId) => {
    e.stopPropagation();

    const updatedSessions = sessions.filter((s) => s.id !== sessionId);

    if (updatedSessions.length === 0) {
      const defaultSession = {
        id: "default",
        title: "New Chat",
        messages: [
          { role: "model", text: "Hi! I'm your AI assistant. Ask me anything, by typing or by voice." },
        ],
        createdAt: Date.now(),
      };
      setSessions([defaultSession]);
      setActiveSessionId("default");
      return;
    }

    setSessions(updatedSessions);

    if (activeSessionId === sessionId) {
      const index = sessions.findIndex((s) => s.id === sessionId);
      const nextActiveIndex = Math.max(0, index - 1);
      setActiveSessionId(updatedSessions[Math.min(nextActiveIndex, updatedSessions.length - 1)].id);
    }
  };

  const { startListening, isListening, isSupported } = useSpeechRecognition(
    (transcript) => {
      setInput(transcript);
      handleSend(transcript);
    }
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div className={`chat-window ${isSidebarOpen ? "sidebar-open" : ""}`}>
      {isSidebarOpen && (
        <div className="chat-sidebar">
          <div className="sidebar-header">
            <h3>History</h3>
            <button className="new-chat-btn" onClick={handleNewChat} title="Start new conversation">
              ＋ New Chat
            </button>
          </div>
          <div className="sidebar-content">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`session-item ${session.id === activeSessionId ? "active" : ""}`}
                onClick={() => setActiveSessionId(session.id)}
              >
                <span className="session-icon">💬</span>
                <span className="session-title" title={session.title}>
                  {session.title}
                </span>
                <button
                  className="delete-session-btn"
                  onClick={(e) => handleDeleteChat(e, session.id)}
                  title="Delete chat"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="chat-main-pane">
        <div className="chat-header">
          <div className="header-left">
            <button
              className={`sidebar-toggle-btn ${isSidebarOpen ? "active" : ""}`}
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? "Hide chat history" : "Show chat history"}
            >
              ☰
            </button>
            <span>AI Assistant</span>
          </div>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-bubble ${msg.role}`}>
              {msg.text}
            </div>
          ))}
          {isLoading && <div className="chat-bubble model typing">Thinking...</div>}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-row">
          <button
            className={`mic-btn ${isListening ? "listening" : ""}`}
            onClick={startListening}
            title={isSupported ? "Speak your message" : "Voice input not supported in this browser"}
            disabled={isLoading}
          >
            🎤
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening..." : "Type your message..."}
            disabled={isLoading}
          />

          <button className="send-btn" onClick={() => handleSend()} disabled={isLoading}>
            Send
          </button>
        </div>

        <label className="voice-toggle">
          <input
            type="checkbox"
            checked={voiceReplyEnabled}
            onChange={(e) => setVoiceReplyEnabled(e.target.checked)}
          />
          Read replies aloud
        </label>
      </div>
    </div>
  );
}

export default ChatWindow;
