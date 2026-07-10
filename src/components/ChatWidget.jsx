import { useState } from "react";
import HeroSection from "./HeroSection.jsx";
import ChatWindow from "./ChatWindow.jsx";

function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <HeroSection onOpenChat={() => setIsOpen(true)} />
      {isOpen && <ChatWindow onClose={() => setIsOpen(false)} />}
    </>
  );
}

export default ChatWidget;
