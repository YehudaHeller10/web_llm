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
          <div className="flex flex-col items-center mb-8 max-w-[480px] text-center">
            <div className="relative mb-6">
              <img
                src="logo.png"
                width="120"
                height="120"
                className="block drop-shadow-2xl glow-blue rounded-2xl"
                alt="Private Talk Logo"
              />
            </div>
            <h1 className="text-6xl font-bold mb-4 text-gradient text-glow">
              Private Talk
            </h1>
            <h2 className="text-xl font-medium text-secondary mb-6 leading-relaxed">
              Your personal AI assistant that runs entirely in your browser with
              <span className="text-gradient font-semibold"> WebGPU acceleration</span>
            </h2>
          </div>

          <div className="flex flex-col items-center px-6 max-w-2xl">
            <div className="glass-card rounded-2xl p-8 mb-8 text-center">
              <p className="text-lg leading-relaxed text-secondary mb-6">
                Experience the future of private AI conversations. Load{" "}
                <a
                  href="https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gradient font-semibold hover:underline transition-all duration-300"
                >
                  Qwen3-0.6B
                </a>
                , a cutting-edge 0.6B parameter reasoning model optimized for blazing-fast in-browser inference.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="modern-card rounded-xl p-4">
                  <div className="text-2xl mb-2">🔒</div>
                  <h3 className="font-semibold text-white mb-1">100% Private</h3>
                  <p className="text-sm text-secondary">No data leaves your device</p>
                </div>
                <div className="modern-card rounded-xl p-4">
                  <div className="text-2xl mb-2">⚡</div>
                  <h3 className="font-semibold text-white mb-1">Lightning Fast</h3>
                  <p className="text-sm text-secondary">WebGPU acceleration</p>
                </div>
                <div className="modern-card rounded-xl p-4">
                  <div className="text-2xl mb-2">🌐</div>
                  <h3 className="font-semibold text-white mb-1">Works Offline</h3>
                  <p className="text-sm text-secondary">Once loaded, no internet needed</p>
                </div>
              </div>

              <p className="text-sm text-secondary mb-6">
                Powered by{" "}
                <a
                  href="https://huggingface.co/docs/transformers.js"
                  target="_blank"
                  rel="noreferrer"
                  className="text-gradient hover:underline transition-all duration-300"
                >
                  🤗 Transformers.js
                </a>{" "}
                and ONNX Runtime Web
              </p>
            </div>

            {error && (
              <div className="glass-card rounded-2xl p-6 mb-6 border-red-500/30 bg-red-500/10 text-center">
                <p className="mb-2 text-red-400 font-medium">
                  Unable to load model due to the following error:
                </p>
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <button
              className="btn-premium px-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed select-none glow-blue"
              onClick={() => {
                worker.current.postMessage({ type: "load" });
                setStatus("loading");
              }}
              disabled={status !== null || error !== null}
            >
              🚀 Launch Private Talk
            </button>
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
          <div className="relative flex items-end">
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

          {/* Reasoning Toggle */}
          <div className="px-6 pb-4">
            <button
              className={`inline-flex items-center px-4 py-2 gap-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                reasonEnabled
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white glow-purple"
                  : "bg-gray-700/50 text-gray-400 hover:bg-gray-600/50"
              }`}
              onClick={() => setReasonEnabled((prev) => !prev)}
            >
              <LightBulbIcon className="h-4 w-4" />
              Enhanced Reasoning {reasonEnabled ? "ON" : "OFF"}
            </button>
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
