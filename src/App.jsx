import { useEffect, useState, useRef } from "react";

import Chat from "./components/Chat";
import ArrowRightIcon from "./components/icons/ArrowRightIcon";
import StopIcon from "./components/icons/StopIcon";
import Progress from "./components/Progress";
import LightBulbIcon from "./components/icons/LightBulbIcon";

const IS_WEBGPU_AVAILABLE = !!navigator.gpu;
const STICKY_SCROLL_THRESHOLD = 120;
const EXAMPLES = [
  "Solve the equation x^2 - 3x + 2 = 0",
  "Lily is three times older than her son. In 15 years, she will be twice as old as him. How old is she now?",
  "Write python code to compute the nth fibonacci number.",
];

function App() {
  // Create a reference to the worker object.
  const worker = useRef(null);

  const textareaRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Model loading and progress
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [progressItems, setProgressItems] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  // Inputs and outputs
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [tps, setTps] = useState(null);
  const [numTokens, setNumTokens] = useState(null);
  const [reasonEnabled, setReasonEnabled] = useState(false);

  function onEnter(message) {
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setTps(null);
    setIsRunning(true);
    setInput("");
  }

  function onInterrupt() {
    // NOTE: We do not set isRunning to false here because the worker
    // will send a 'complete' message when it is done.
    worker.current.postMessage({ type: "interrupt" });
  }

  useEffect(() => {
    resizeInput();
  }, [input]);

  function resizeInput() {
    if (!textareaRef.current) return;

    const target = textareaRef.current;
    target.style.height = "auto";
    const newHeight = Math.min(Math.max(target.scrollHeight, 24), 200);
    target.style.height = `${newHeight}px`;
  }

  // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
  useEffect(() => {
    // Create the worker if it does not yet exist.
    if (!worker.current) {
      worker.current = new Worker(new URL("./worker.js", import.meta.url), {
        type: "module",
      });
      worker.current.postMessage({ type: "check" }); // Do a feature check
    }

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = (e) => {
      switch (e.data.status) {
        case "loading":
          // Model file start load: add a new progress item to the list.
          setStatus("loading");
          setLoadingMessage(e.data.data);
          break;

        case "initiate":
          setProgressItems((prev) => [...prev, e.data]);
          break;

        case "progress":
          // Model file progress: update one of the progress items.
          setProgressItems((prev) =>
            prev.map((item) => {
              if (item.file === e.data.file) {
                return { ...item, ...e.data };
              }
              return item;
            }),
          );
          break;

        case "done":
          // Model file loaded: remove the progress item from the list.
          setProgressItems((prev) =>
            prev.filter((item) => item.file !== e.data.file),
          );
          break;

        case "ready":
          // Pipeline ready: the worker is ready to accept messages.
          setStatus("ready");
          break;

        case "start":
          {
            // Start generation
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "" },
            ]);
          }
          break;

        case "update":
          {
            // Generation update: update the output text.
            // Parse messages
            const { output, tps, numTokens, state } = e.data;
            setTps(tps);
            setNumTokens(numTokens);
            setMessages((prev) => {
              const cloned = [...prev];
              const last = cloned.at(-1);
              const data = {
                ...last,
                content: last.content + output,
              };
              if (data.answerIndex === undefined && state === "answering") {
                // When state changes to answering, we set the answerIndex
                data.answerIndex = last.content.length;
              }
              cloned[cloned.length - 1] = data;
              return cloned;
            });
          }
          break;

        case "complete":
          // Generation complete: re-enable the "Generate" button
          setIsRunning(false);
          break;

        case "error":
          setError(e.data.data);
          break;
      }
    };

    const onErrorReceived = (e) => {
      console.error("Worker error:", e);
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener("message", onMessageReceived);
    worker.current.addEventListener("error", onErrorReceived);

    // Define a cleanup function for when the component is unmounted.
    return () => {
      worker.current.removeEventListener("message", onMessageReceived);
      worker.current.removeEventListener("error", onErrorReceived);
    };
  }, []);

  // Send the messages to the worker thread whenever the `messages` state changes.
  useEffect(() => {
    if (messages.filter((x) => x.role === "user").length === 0) {
      // No user messages yet: do nothing.
      return;
    }
    if (messages.at(-1).role === "assistant") {
      // Do not update if the last message is from the assistant
      return;
    }
    setTps(null);
    worker.current.postMessage({
      type: "generate",
      data: { messages, reasonEnabled },
    });
  }, [messages, isRunning]);

  useEffect(() => {
    if (!chatContainerRef.current || !isRunning) return;
    const element = chatContainerRef.current;
    if (
      element.scrollHeight - element.scrollTop - element.clientHeight <
      STICKY_SCROLL_THRESHOLD
    ) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, isRunning]);

  return IS_WEBGPU_AVAILABLE ? (
    <div className="flex flex-col h-screen gradient-bg relative overflow-hidden">
      {/* Floating particles background effect */}
      <div className="particles">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 6}s`,
              animationDuration: `${6 + Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {status === null && messages.length === 0 && (
        <div className="h-full overflow-auto scrollbar-thin flex justify-center items-center flex-col relative z-10">
          <div className="flex flex-col items-center mb-8 max-w-5xl text-center px-6">
            {/* Hero Section */}
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-full blur-3xl scale-150"></div>
              <img
                src="logo.png"
                width="140"
                height="140"
                className="relative block drop-shadow-2xl glow-blue rounded-3xl transition-transform duration-500 hover:scale-105"
                alt="Private Talk Logo"
              />
            </div>

            {/* Main Title */}
            <div className="mb-8">
              <h1 className="text-7xl md:text-8xl font-extrabold mb-6 text-gradient text-glow leading-tight">
                Private Talk
              </h1>
              <div className="h-1 w-32 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mx-auto mb-6"></div>
              <h2 className="text-2xl md:text-3xl font-light text-white/90 mb-4 leading-relaxed max-w-4xl">
                Your personal AI assistant that runs entirely in your browser with
                <span className="text-gradient font-semibold block mt-2">
                  ⚡ WebGPU Acceleration
                </span>
              </h2>
            </div>

            {/* Description */}
            <div className="glass-card rounded-3xl p-10 mb-10 max-w-4xl">
              <p className="text-xl md:text-2xl leading-relaxed text-white/80 mb-8 font-light">
                Experience the future of private AI conversations. Load{" "}
                <a
                  href="https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gradient font-semibold hover:underline transition-all duration-300 text-2xl"
                >
                  Qwen3-0.6B
                </a>
                , a cutting-edge 0.6B parameter reasoning model optimized for blazing-fast in-browser inference.
              </p>

              {/* Feature Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="modern-card rounded-2xl p-6 group hover:scale-105 transition-all duration-300">
                  <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">🔒</div>
                  <h3 className="font-bold text-xl text-white mb-3">100% Private</h3>
                  <p className="text-white/70 leading-relaxed">Complete privacy - no data ever leaves your device. Your conversations stay yours.</p>
                </div>
                <div className="modern-card rounded-2xl p-6 group hover:scale-105 transition-all duration-300">
                  <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">⚡</div>
                  <h3 className="font-bold text-xl text-white mb-3">Lightning Fast</h3>
                  <p className="text-white/70 leading-relaxed">Hardware-accelerated inference with WebGPU for instant responses.</p>
                </div>
                <div className="modern-card rounded-2xl p-6 group hover:scale-105 transition-all duration-300">
                  <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">🌐</div>
                  <h3 className="font-bold text-xl text-white mb-3">Works Offline</h3>
                  <p className="text-white/70 leading-relaxed">Once loaded, no internet connection required. AI that travels with you.</p>
                </div>
              </div>

              {/* Technical Details */}
              <div className="glass rounded-2xl p-6 mb-8 bg-gradient-to-r from-blue-500/10 to-purple-600/10">
                <div className="flex flex-wrap justify-center items-center gap-6 text-sm text-white/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    Powered by 🤗 Transformers.js
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
                    ONNX Runtime Web
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                    WebGPU Optimized
                  </div>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="glass-card rounded-3xl p-8 mb-8 border-red-500/30 bg-red-500/10 text-center max-w-2xl">
                <div className="text-4xl mb-4">⚠️</div>
                <h3 className="text-xl font-semibold mb-4 text-red-400">
                  Unable to Load Model
                </h3>
                <p className="text-red-300 leading-relaxed">{error}</p>
              </div>
            )}

            {/* Call to Action */}
            <div className="flex flex-col items-center">

              <button
                className="group relative btn-premium px-12 py-6 rounded-3xl font-bold text-2xl transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed select-none glow-blue hover:glow-purple transform hover:scale-110 active:scale-95"
                onClick={() => {
                  worker.current.postMessage({ type: "load" });
                  setStatus("loading");
                }}
                disabled={status !== null || error !== null}
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl group-hover:rotate-12 transition-transform duration-300">🚀</span>
                  <span className="bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
                    Start Private Conversation
                  </span>
                </div>

                {/* Animated border effect */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 opacity-0 group-hover:opacity-20 transition-opacity duration-500 animate-pulse"></div>
              </button>

              <p className="text-white/50 text-sm mt-4 max-w-md text-center leading-relaxed">
                Click to load the AI model and begin your private conversation.
                <span className="block mt-1 text-gradient font-medium">No sign-up required • Free forever</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {status === "loading" && (
        <div className="flex justify-center items-center h-full relative z-10">
          <div className="glass-card rounded-2xl p-8 max-w-md w-full mx-4">
            <div className="flex justify-center mb-6">
              <div className="ai-spinner"></div>
            </div>
            <p className="text-center mb-6 text-lg font-medium text-gradient">
              {loadingMessage}
            </p>
            <div className="space-y-3">
              {progressItems.map(({ file, progress, total }, i) => (
                <Progress
                  key={i}
                  text={file}
                  percentage={progress}
                  total={total}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {status === "ready" && (
        <div
          ref={chatContainerRef}
          className="overflow-y-auto scrollbar-thin w-full flex flex-col items-center h-full relative z-10 px-4"
        >
          <div className="w-full max-w-4xl">
            <Chat messages={messages} />
            {messages.length === 0 && (
              <div className="my-8">
                <h3 className="text-xl font-semibold text-center mb-6 text-gradient">
                  Try these conversation starters:
                </h3>
                <div className="grid gap-3 max-w-2xl mx-auto">
                  {EXAMPLES.map((msg, i) => (
                    <div
                      key={i}
                      className="modern-card rounded-xl p-4 cursor-pointer transition-all duration-300 hover:scale-105"
                      onClick={() => onEnter(msg)}
                    >
                      <p className="text-white">{msg}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tps && messages.length > 0 && (
              <div className="text-center py-4">
                <div className="glass rounded-xl px-4 py-2 inline-block">
                  {!isRunning && (
                    <span className="text-secondary text-sm">
                      Generated {numTokens} tokens in{" "}
                      {(numTokens / tps).toFixed(2)} seconds (
                    </span>
                  )}
                  <span className="font-semibold text-gradient mr-1">
                    {tps.toFixed(2)}
                  </span>
                  <span className="text-secondary text-sm">tokens/second</span>
                  {!isRunning && (
                    <>
                      <span className="text-secondary text-sm">). </span>
                      <button
                        className="text-gradient hover:underline cursor-pointer text-sm font-medium"
                        onClick={() => {
                          worker.current.postMessage({ type: "reset" });
                          setMessages([]);
                        }}
                      >
                        Reset Chat
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Input Area */}
      <div className="w-full max-w-4xl mx-auto p-4 relative z-10">
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="relative flex items-end gap-3">
            {/* Compact Reasoning Toggle - Left side of textarea */}
            <div className="flex flex-col items-center gap-2 pb-4">
              <button
                className={`inline-flex items-center px-2 py-1 gap-1.5 rounded-lg text-xs font-medium transition-all duration-300 ${
                  reasonEnabled
                    ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                    : "bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 hover:text-white"
                }`}
                onClick={() => setReasonEnabled((prev) => !prev)}
              >
                <LightBulbIcon className="h-3 w-3" />
                <span className="text-xs">Reasoning</span>
                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs ${
                  reasonEnabled
                    ? "bg-white/20 text-white"
                    : "bg-gray-600/50 text-gray-400"
                }`}>
                  <div className={`w-1 h-1 rounded-full transition-all duration-300 ${
                    reasonEnabled ? "bg-green-400" : "bg-gray-500"
                  }`}></div>
                  <span className="text-xs">{reasonEnabled ? "ON" : "OFF"}</span>
                </div>
              </button>

              <div className="text-xs text-white/40 text-center leading-tight max-w-16">

              </div>
            </div>

            <textarea
              ref={textareaRef}
              className="ai-input flex-1 px-6 py-4 text-white placeholder-gray-400 resize-none focus:outline-none text-lg"
              placeholder="Start your private conversation..."
              rows={1}
              value={input}
              disabled={status !== "ready"}
              title={
                status === "ready" ? "Model is ready" : "Model not loaded yet"
              }
              onKeyDown={(e) => {
                if (
                  input.length > 0 &&
                  !isRunning &&
                  e.key === "Enter" &&
                  !e.shiftKey
                ) {
                  e.preventDefault();
                  onEnter(input);
                }
              }}
              onInput={(e) => setInput(e.target.value)}
            />

            <div className="p-4">
              {isRunning ? (
                <button
                  className="btn-premium p-3 rounded-xl transition-all duration-300 hover:scale-110"
                  onClick={onInterrupt}
                >
                  <StopIcon className="h-6 w-6 text-white" />
                </button>
              ) : input.length > 0 ? (
                <button
                  className="btn-premium p-3 rounded-xl transition-all duration-300 hover:scale-110 glow-purple"
                  onClick={() => onEnter(input)}
                >
                  <ArrowRightIcon className="h-6 w-6 text-white" />
                </button>
              ) : (
                <div className="p-3 rounded-xl bg-gray-600/30">
                  <ArrowRightIcon className="h-6 w-6 text-gray-500" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex justify-center items-center h-screen gradient-bg">
      <div className="glass-card rounded-2xl p-8 max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4 text-gradient">
          WebGPU Not Supported
        </h1>
        <p className="text-secondary">
          Private Talk requires WebGPU support. Please use a modern browser with WebGPU enabled.
        </p>
      </div>
    </div>
  );
}

export default App;
