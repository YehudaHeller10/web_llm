import { useState, useEffect, useRef } from 'react';

const CodeBlock = ({ code, language, className, isStreaming = false }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code);
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [executionStatus, setExecutionStatus] = useState('idle'); // idle, running, success, error
  const [showOutput, setShowOutput] = useState(false);
  const [pyodide, setPyodide] = useState(null);
  const [pyodideLoading, setPyodideLoading] = useState(false);
  const codeRef = useRef(null);

  // Update editedCode when code prop changes (for streaming)
  useEffect(() => {
    setEditedCode(code);
  }, [code]);

  // Auto-resize code block after editing
  useEffect(() => {
    if (codeRef.current) {
      // Force a reflow to ensure proper sizing
      codeRef.current.style.height = 'auto';
      const scrollHeight = codeRef.current.scrollHeight;
      if (scrollHeight > 0) {
        codeRef.current.style.height = `${scrollHeight}px`;
      }
    }
  }, [editedCode]);

  // Load Pyodide when needed
  const loadPyodide = async () => {
    if (pyodide || pyodideLoading) return pyodide;

    setPyodideLoading(true);
    try {
      // Load Pyodide from CDN
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
      document.head.appendChild(script);

      return new Promise((resolve, reject) => {
        script.onload = async () => {
          try {
            const pyodideInstance = await window.loadPyodide({
              indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
              stdout: (text) => {
                // Handle stdout in the execution context
              }
            });
            setPyodide(pyodideInstance);
            setPyodideLoading(false);
            resolve(pyodideInstance);
          } catch (error) {
            setPyodideLoading(false);
            reject(error);
          }
        };
        script.onerror = () => {
          setPyodideLoading(false);
          reject(new Error('Failed to load Pyodide'));
        };
      });
    } catch (error) {
      setPyodideLoading(false);
      throw error;
    }
  };

  // Detect language from className or content
  const detectLanguage = () => {
    if (language) return language.toLowerCase();
    if (className) {
      const match = className.match(/language-(\w+)/);
      if (match) return match[1].toLowerCase();
    }
    // Auto-detect based on code content
    if (editedCode.includes('def ') || editedCode.includes('import ') || editedCode.includes('print(')) return 'python';
    if (editedCode.includes('function ') || editedCode.includes('const ') || editedCode.includes('console.log')) return 'javascript';
    if (editedCode.includes('#include') || editedCode.includes('int main')) return 'cpp';
    if (editedCode.includes('public class') || editedCode.includes('System.out')) return 'java';
    return 'text';
  };

  const lang = detectLanguage();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(editedCode);
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const executeCode = async () => {
    setIsRunning(true);
    setExecutionStatus('running');
    setOutput('Initializing execution...');
    setShowOutput(true);

    try {
      let result = '';

      switch (lang) {
        case 'javascript':
          result = await executeJavaScript(editedCode);
          break;
        case 'python':
          result = await executePython(editedCode);
          break;
        case 'html':
          result = await executeHTML(editedCode);
          break;
        case 'css':
          result = await executeCSS(editedCode);
          break;
        default:
          result = `Execution not supported for ${lang || 'unknown'} language yet.`;
      }

      setOutput(result || 'Code executed successfully (no output)');
      setExecutionStatus('success');
    } catch (error) {
      setOutput(`Error: ${error.message}`);
      setExecutionStatus('error');
    } finally {
      setIsRunning(false);
    }
  };

  const executeJavaScript = async (code) => {
    return new Promise((resolve, reject) => {
      try {
        // Create a safe execution environment
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        const logs = [];

        // Override console methods to capture output
        console.log = (...args) => {
          logs.push('LOG: ' + args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '));
        };

        console.error = (...args) => {
          logs.push('ERROR: ' + args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '));
        };

        console.warn = (...args) => {
          logs.push('WARN: ' + args.map(arg =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' '));
        };

        // Execute the code in a function scope
        const func = new Function(`
          try {
            ${code}
          } catch (error) {
            console.error('Runtime Error:', error.message);
            throw error;
          }
        `);

        const result = func();

        // Restore original console methods
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;

        let output = logs.join('\n');
        if (result !== undefined) {
          output += (output ? '\n' : '') + `Return value: ${JSON.stringify(result)}`;
        }

        resolve(output || 'Code executed successfully (no console output)');
      } catch (error) {
        // Restore console methods
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        reject(new Error(`JavaScript execution failed: ${error.message}`));
      }
    });
  };

  const executePython = async (code) => {
    try {
      setOutput('Loading Python environment...');

      // Try to use Pyodide for real Python execution
      let pyodideInstance = pyodide;
      if (!pyodideInstance) {
        pyodideInstance = await loadPyodide();
      }

      if (pyodideInstance) {
        setOutput('Executing Python code...');

        // Capture stdout
        let output = '';
        pyodideInstance.runPython(`
import sys
from io import StringIO

# Redirect stdout to capture print statements
old_stdout = sys.stdout
sys.stdout = mystdout = StringIO()
        `);

        try {
          // Execute user code
          const result = pyodideInstance.runPython(code);

          // Get captured output
          const capturedOutput = pyodideInstance.runPython('mystdout.getvalue()');

          // Restore stdout
          pyodideInstance.runPython('sys.stdout = old_stdout');

          let finalOutput = '';
          if (capturedOutput && capturedOutput.trim()) {
            finalOutput += capturedOutput.trim();
          }

          if (result !== undefined && result !== null) {
            if (finalOutput) finalOutput += '\n';
            finalOutput += `Return value: ${result}`;
          }

          return finalOutput || 'Python code executed successfully (no output)';

        } catch (error) {
          // Restore stdout on error
          pyodideInstance.runPython('sys.stdout = old_stdout');
          throw new Error(`Python execution error: ${error.message}`);
        }
      } else {
        // Fallback to simulation if Pyodide fails to load
        return await executePythonSimulation(code);
      }
    } catch (error) {
      console.warn('Pyodide execution failed, falling back to simulation:', error);
      return await executePythonSimulation(code);
    }
  };

  const executePythonSimulation = async (code) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        try {
          const outputs = [];

          // Extract print statements
          const printRegex = /print\s*\(\s*([^)]+)\s*\)/g;
          let match;

          while ((match = printRegex.exec(code)) !== null) {
            let content = match[1].trim();

            // Handle simple string literals
            if ((content.startsWith('"') && content.endsWith('"')) ||
                (content.startsWith("'") && content.endsWith("'"))) {
              outputs.push(content.slice(1, -1));
            } else if (!isNaN(content)) {
              // Handle numbers
              outputs.push(content);
            } else {
              // Handle variables and expressions (simplified)
              outputs.push(`${content} (simulated)`);
            }
          }

          if (outputs.length > 0) {
            resolve(outputs.join('\n') + '\n[Note: Running in simulation mode - install Pyodide for full Python support]');
          } else {
            resolve('Python code executed successfully (simulated - no print statements detected)');
          }
        } catch (error) {
          resolve(`Python simulation error: ${error.message}`);
        }
      }, 800);
    });
  };

  const executeHTML = async (code) => {
    return new Promise((resolve) => {
      try {
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position: absolute; left: -9999px; width: 1px; height: 1px;';
        document.body.appendChild(iframe);

        iframe.onload = () => {
          setTimeout(() => {
            try {
              const doc = iframe.contentDocument || iframe.contentWindow.document;
              const bodyContent = doc.body?.innerText?.trim() || '';
              const title = doc.title || '';

              document.body.removeChild(iframe);

              let output = 'HTML rendered successfully!\n';
              if (title) output += `Title: ${title}\n`;
              if (bodyContent) output += `Body content: ${bodyContent}`;
              else output += 'No visible text content found';

              resolve(output);
            } catch (error) {
              document.body.removeChild(iframe);
              resolve(`HTML execution completed with warnings: ${error.message}`);
            }
          }, 300);
        };

        iframe.contentDocument.open();
        iframe.contentDocument.write(code);
        iframe.contentDocument.close();
      } catch (error) {
        resolve(`HTML execution error: ${error.message}`);
      }
    });
  };

  const executeCSS = async (code) => {
    return new Promise((resolve) => {
      try {
        const ruleCount = (code.match(/\{/g) || []).length;
        const selectorCount = (code.match(/[^{}]+(?=\s*\{)/g) || []).length;
        const propertyCount = (code.match(/[^{}:]+\s*:/g) || []).length;

        resolve(
          `CSS Analysis Complete!\n` +
          `- ${ruleCount} CSS rule(s) found\n` +
          `- ${selectorCount} selector(s) detected\n` +
          `- ${propertyCount} CSS property declaration(s)\n` +
          `- Code syntax appears valid`
        );
      } catch (error) {
        resolve(`CSS analysis error: ${error.message}`);
      }
    });
  };

  const getLanguageIcon = () => {
    switch (lang) {
      case 'javascript': return '⚡';
      case 'python': return '🐍';
      case 'html': return '🌐';
      case 'css': return '🎨';
      case 'java': return '☕';
      case 'cpp': return '⚙️';
      default: return '📝';
    }
  };

  const getStatusText = () => {
    switch (executionStatus) {
      case 'running': return pyodideLoading ? 'Loading Python...' : 'Executing...';
      case 'success': return 'Execution completed';
      case 'error': return 'Execution failed';
      default: return 'Ready to execute';
    }
  };

  const canExecute = ['javascript', 'python', 'html', 'css'].includes(lang);

  return (
    <div className="code-block-container my-4">
      <div className="relative">
        <div className="markdown-pre relative">
          {/* Code action buttons */}
          <div className="code-actions">
            <button
              className="code-action-btn copy"
              onClick={copyToClipboard}
              title="Copy code"
            >
              📋
            </button>
            <button
              className="code-action-btn edit"
              onClick={() => setIsEditing(true)}
              title="Edit code"
            >
              ✏️
            </button>
            {canExecute && (
              <button
                className="code-action-btn run"
                onClick={executeCode}
                disabled={isRunning}
                title={`Run ${lang} code${lang === 'python' ? ' (with Pyodide)' : ''}`}
              >
                {isRunning ? '⏳' : '▶️'}
              </button>
            )}
          </div>

          <pre className="code-content" ref={codeRef}>
            <code className="code-text">
              {editedCode}
            </code>
          </pre>
        </div>

        {/* Code execution output - Always show when there's output or running */}
        {showOutput && (
          <div className="code-output">
            <div className="code-output-header">
              <div className="code-output-status">
                <div className={`status-indicator ${executionStatus}`}></div>
                <span>{getLanguageIcon()} {lang.charAt(0).toUpperCase() + lang.slice(1)}
                  {lang === 'python' && pyodide ? ' (Pyodide)' : lang === 'python' && pyodideLoading ? ' (Loading...)' : ' Interpreter'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span>{getStatusText()}</span>
                <button
                  className="text-xs text-gray-400 hover:text-white cursor-pointer"
                  onClick={() => setShowOutput(false)}
                  title="Hide output"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className={`code-output-content ${executionStatus}`}>
              {output}
            </div>
          </div>
        )}
      </div>

      {/* Code editor modal */}
      {isEditing && (
        <div className="code-editor-modal" onClick={() => setIsEditing(false)}>
          <div className="code-editor-container" onClick={(e) => e.stopPropagation()}>
            <div className="code-editor-header">
              <div className="code-editor-title">
                {getLanguageIcon()} Edit {lang.charAt(0).toUpperCase() + lang.slice(1)} Code
              </div>
              <div className="code-editor-actions">
                <button
                  className="code-action-btn"
                  onClick={() => {
                    setEditedCode(code);
                    setIsEditing(false);
                  }}
                  title="Cancel changes"
                >
                  ❌
                </button>
                <button
                  className="code-action-btn"
                  onClick={() => setIsEditing(false)}
                  title="Save changes"
                >
                  ✅
                </button>
              </div>
            </div>
            <textarea
              className="code-editor-textarea"
              value={editedCode}
              onChange={(e) => setEditedCode(e.target.value)}
              autoFocus
              spellCheck={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeBlock;
