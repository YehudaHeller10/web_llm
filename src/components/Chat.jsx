import { useState } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

import BotIcon from "./icons/BotIcon";
import BrainIcon from "./icons/BrainIcon";
import UserIcon from "./icons/UserIcon";

import { MathJaxContext, MathJax } from "better-react-mathjax";
import "./Chat.css";

function render(text) {
  // Replace all instances of single backslashes before brackets with double backslashes
  // See https://github.com/markedjs/marked/issues/546 for more information.
  text = text.replace(/\\([\[\]\(\)])/g, "\\\\$1");

  const result = DOMPurify.sanitize(
    marked.parse(text, {
      async: false,
      breaks: true,
    }),
  );
  return result;
}

function Message({ role, content, answerIndex }) {
  const thinking =
    answerIndex !== undefined ? content.slice(0, answerIndex) : content;
  const answer = answerIndex !== undefined ? content.slice(answerIndex) : "";

  const [showThinking, setShowThinking] = useState(false);

  const doneThinking = answerIndex === 0 || answer.length > 0;

  return (
    <div className="chat-bubble mb-6 max-w-4xl mx-auto">
      {role === "assistant" ? (
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center glow-blue">
              <BotIcon className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="ai-message glass-card rounded-2xl p-6 flex-1">
            <div className="min-h-6 text-white overflow-wrap-anywhere">
              {answerIndex === 0 || thinking.length > 0 ? (
                <>
                  {thinking.length > 0 && (
                    <div className="modern-card rounded-xl mb-4">
                      <button
                        className="flex items-center gap-3 cursor-pointer p-4 hover:bg-slate-700/50 rounded-xl w-full text-left transition-all duration-300"
                        onClick={() => setShowThinking((prev) => !prev)}
                      >
                        <BrainIcon
                          className={`h-5 w-5 text-purple-400 ${doneThinking ? "" : "animate-pulse"}`}
                        />
                        <span className="text-white font-medium">
                          {doneThinking ? "View reasoning process" : "Analyzing..."}
                        </span>
                        <span className="ml-auto text-blue-400 text-lg">
                          {showThinking ? "▲" : "▼"}
                        </span>
                      </button>
                      {showThinking && (
                        <div className="border-t border-slate-600/50 mt-2 pt-4 px-4 pb-4">
                          <MathJax dynamic>
                            <div
                              className="markdown text-gray-300 prose prose-invert max-w-none"
                              dangerouslySetInnerHTML={{
                                __html: render(thinking),
                              }}
                            />
                          </MathJax>
                        </div>
                      )}
                    </div>
                  )}
                  {doneThinking && (
                    <MathJax dynamic>
                      <div
                        className="markdown text-white prose prose-invert max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: render(answer),
                        }}
                      />
                    </MathJax>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-pulse"></div>
                    <div className="w-2.5 h-2.5 bg-purple-400 rounded-full animate-pulse animation-delay-200"></div>
                    <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-pulse animation-delay-400"></div>
                  </div>
                  <span className="text-gray-300 ml-2 typing-pulse">Private Talk is thinking...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start space-x-4 justify-end">
          <div className="user-message glass-card rounded-2xl p-6 max-w-2xl">
            <p className="min-h-6 overflow-wrap-anywhere text-white">{content}</p>
          </div>
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center glow-purple">
              <UserIcon className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Chat({ messages }) {
  const config = {
    loader: { load: ["[tex]/mhchem"] },
    tex: {
      packages: { "[+]": ["mhchem"] },
      inlineMath: [
        ["$", "$"],
        ["\\(", "\\)"],
      ],
      displayMath: [
        ["$$", "$$"],
        ["\\[", "\\]"],
      ],
    },
  };

  return (
    <MathJaxContext config={config}>
      <div className="w-full py-8">
        {messages.map((message, index) => (
          <Message key={index} {...message} />
        ))}
      </div>
    </MathJaxContext>
  );
}

export default Chat;
